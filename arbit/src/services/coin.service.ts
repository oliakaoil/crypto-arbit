import { ICoinService } from './coin.service.interface';
import { RestService } from './rest.service';
import { ICacheService } from './cache.service.interface';

import { ServiceResponse } from '../service.response';
import { ExchangeTicker } from '../exchange.response';

import * as RequestPromise from 'request-promise';
import { ICoinRepo } from '../repos/coin.repo.interface';
import { IExchangeRepo } from '../repos/exchange.repo.interface';


export class PublicCoin
{
    id: string;
    symbol: string;
    name: string;
}

export class PublicTicker
{
    baseCurrency: string;
    quoteCurrency: string;
    price: number;
    volume: number;
    date: string;
    source: string;  

    public getCurrencyPair(): string {
        return `${this.baseCurrency}-${this.quoteCurrency}`;
    }
}

export class CoinService extends RestService implements ICoinService {

    private stablecoins: Set<string>;
    private fiat:  Set<string>;
    private popcoins: Set<string>;
    private convertibleCoins: string[]; // coins that can be used for easy conversion to a stablecoin value
    private apiUrl: string;
    private coinMap: Map<string, PublicCoin> = new Map();
    private cacheService: ICacheService;
    private coinRepo: ICoinRepo;
    private exchangeRepo: IExchangeRepo;

    constructor(opts)
    {
        super(opts);
        this.stablecoins = opts.stablecoins;
        this.fiat = opts.fiat;
        this.popcoins = opts.popcoins;
        this.convertibleCoins = Array.from(this.stablecoins).concat(['USD']);

        this.cacheService = opts.cacheService;
        this.coinRepo = opts.coinRepo;
        this.exchangeRepo = opts.exchangeRepo;

        this.apiUrl = opts.appEnv.COINGECKO_API_URL;
        this.apiRateLimit = 1;
    }  

    public getPopCoins(): string[]
    {
        return Array.from(this.popcoins);
    }
    
    public isFiat(symbol: string): boolean 
    {
        return this.fiat.has(String(symbol).toUpperCase());
    }    

    public isStablecoin(symbol: string): boolean 
    {
        return this.stablecoins.has(String(symbol).toUpperCase());
    }

    public isPopcoin(symbol: string): boolean
    {
        return this.popcoins.has(String(symbol).toUpperCase());
    }

    public async getAllCoins(): Promise<ServiceResponse>
    {
        const result = await this.request('GET', '/coins/list');

        if (!result)
           return new ServiceResponse(false);

        const allCoins: Map<string, PublicCoin> = new Map();

        result.map(r => {
            allCoins.set(String(r.id).toUpperCase(), r);
            allCoins.set(String(r.symbol).toUpperCase(), r);
            allCoins.set(String(r.name).toUpperCase(), r);
        });

        return new ServiceResponse(true, allCoins);
    }

    public async findConverts(bases: string[], quotes?: string[]): Promise<ServiceResponse>
    {
      const products = await this.coinRepo.findCoinsByCurrency(
          bases, 
          quotes
        );
  
      return new ServiceResponse(true, products);    
    }  

    public async findStableConverts(baseCurrency: string): Promise<ServiceResponse>
    {
        return this.findConverts([baseCurrency], this.convertibleCoins);
    }      

    public async findExchangePairs(bases: string[], quotes: string[]): Promise<ServiceResponse>
    {
      const products = await this.exchangeRepo.findProductByCurrency(
          bases, 
          quotes
        );
  
      return new ServiceResponse(true, products);    
    }  

    public async findExchangeStablecoinPairs(baseCurrency: string): Promise<ServiceResponse>
    {
        return this.findExchangePairs([baseCurrency], this.convertibleCoins);
    } 

    public async findExchangePopcoinPairs(baseCurrency: string): Promise<ServiceResponse>
    {
        return this.findExchangePairs([baseCurrency], Array.from(this.popcoins));
    }

    public async getStablecoinTicker(baseCurrency: string): Promise<ServiceResponse>
    {
        await this.initCoinMap();

        const logId = `CoinService::getStablecoinTicker | ${baseCurrency} |`;

        const coin = this.coinMap.get(baseCurrency);

        if (!coin) {
            this.logService.warn(`${logId} unable to find matching public coin`);
            return new ServiceResponse(true);
        }

        const result = await this.request('GET', `/coins/${coin.id}`, {community_data: false, sparkline: false});

        if (!result) {
            this.logService.error(`${logId} null response from public API`);
            return new ServiceResponse(false);
        }

        let tickerData;

        // prefer fiat conversion
        tickerData = result.tickers.find(tickerData => this.fiat.has(tickerData.target));

        // no fiat available? try a stablecoin
        if (!tickerData)
            tickerData = result.tickers.find(tickerData => this.stablecoins.has(tickerData.target));

        // no fiat or stablecoin? try popcoin
        if (!tickerData)
            tickerData = result.tickers.find(tickerData => this.popcoins.has(tickerData.target));

        if (!tickerData) {
            this.logService.warn(`${logId} unable to find stable ticker data`, result.tickers);
            return new ServiceResponse(true);
        }

        const publicTicker = this.makePublicTicker(tickerData);

        return new ServiceResponse(true, publicTicker);        
    }


    public async getTicker(currencyPair: string): Promise<ServiceResponse>
    {
        await this.initCoinMap();

        const pairParts = currencyPair.split('-');
        const baseCurrency = pairParts.shift();
        const quoteCurrency = pairParts.join('-');

        const coin = this.coinMap.get(baseCurrency);

        if (!coin)
            return new ServiceResponse(false,' unable to find matching public coin');

        const result = await this.request('GET', `/coins/${coin.id}`, {community_data: false, sparkline: false});

        if (!result)
           return new ServiceResponse(false, 'unable to pull coin details');

        const tickerData = result.tickers.find(tickerData => tickerData.target === quoteCurrency);

        if (!tickerData)
           return new ServiceResponse(false, 'unable to find requested currency pair');

        const publicTicker = this.makePublicTicker(tickerData);

        const response = new ServiceResponse(true, publicTicker);

        return response; 
    }

    public async upsertConversion(
        baseCurrency: string, 
        quoteCurrency: string, 
        rate: number,
        source: string
    ): Promise<ServiceResponse>    
    {
        return this.coinRepo.upsertConversion(baseCurrency, quoteCurrency, rate, source);
    }

    private async initCoinMap(): Promise<boolean>
    {
        if (this.coinMap.size)

            return true;

        this.coinMap = (await this.getAllCoins()).getData();

        return true;
    }

    private makePublicTicker(tickerData: any): PublicTicker
    {
        const publicTicker = new PublicTicker();
        publicTicker.baseCurrency = tickerData.base;
        publicTicker.quoteCurrency = tickerData.target;
        publicTicker.price = Number(tickerData.last);
        publicTicker.volume = Number(tickerData.volume);
        publicTicker.date = tickerData.last_fetch_at;
        publicTicker.source = String(tickerData.market.identifier).toLowerCase();
        
        return publicTicker;
    }

    private async request(method: 'GET'|'POST', uri: string, params?: any): Promise<any>
    {
        if (!params)
            params = {};

        const fullUrl = `${this.apiUrl}${uri}`;

        await this.checkRateLimit(fullUrl);

        let opts: any = {
            method: method,
            uri: fullUrl,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
        };    

        if (method === 'GET')
            opts.qs = params;
        if (method === 'POST')
            opts.body = JSON.stringify(params);

        try {

            const response = await RequestPromise(opts);
            let json: any;

            if (typeof response === 'string') {
                json = JSON.parse(response);
            }            

            if (!json)
                return response;

            if (json.code && Number(json.code) !== 200)
                throw new Error(json.code);

            if (json.data)
                return json.data;

            return json;

        } catch (err) {
            await this.logService.error('PublicCoinService::request', err, opts);
            return null;
        }
    }

}
