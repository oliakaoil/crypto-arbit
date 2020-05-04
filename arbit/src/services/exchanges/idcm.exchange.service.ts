import * as RequestPromise from 'request-promise';
import * as utf8 from 'utf8';
import * as crypto from 'crypto';
import * as moment from 'moment';

import { IExchangeService } from './exchange.service.interface'
import { BaseExchangeService } from './base.exchange.service';
import { ServiceResponse } from '../../service.response';
import { ExchangeProductModel } from '../../models/exchange-product.model';
import { ExchangeIds, ExchangeProductStatus } from '../../enums/exchange.enum';
import { ExchangeTicker, ExchangeAccount, ExchangeOrder, ExchangeOrderbook, ExchangeOrderbookLevel } from '../../exchange.response';
import { ExchangeTransferModel } from '../../models/exchange-transfer.model';
import { ExchangeMetaModel } from '../../models/exchange-meta.model';
import { OrderStatus, OrderType } from '../../enums/order.enum';



export class IdcmExchangeService extends BaseExchangeService implements IExchangeService {

    private config: any;

    constructor(opts)
    {
        super(opts);
        this.exchangeId = ExchangeIds.Idcm;
        this.config = opts.idcmConfig;

        // https://idcm.io/help/rate
        this.makerFillFee = 0.001;
        this.takerFillFee = 0.001;        

        this.apiRateLimit = 9;
        this.tweaks.apiRateLimitOrderbook = 9;
    }

    public async getAccounts(): Promise<ServiceResponse>
    {
        return new ServiceResponse(true); 
    }

    public async getOrderById(orderId: string): Promise<ServiceResponse>
    {
        return new ServiceResponse(true);
    }

    public async getAllOrders(): Promise<ServiceResponse>
    {

        return new ServiceResponse(true);
    }

    public async getOrderbook(currencyPair: string): Promise<ServiceResponse>
    {
        const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

        const result = await this.request('POST','/getdepth', { Symbol: localCurrencyPair });

        if (!result)
            return new ServiceResponse(false);

        const orderbook = new ExchangeOrderbook(this.getExchangeId(), currencyPair);

        orderbook.asks = result.asks.map(m => new ExchangeOrderbookLevel(m.price, m.amount));
        orderbook.bids = result.bids.map(m => new ExchangeOrderbookLevel(m.price, m.amount))

        orderbook.sortFills();

        return new ServiceResponse(true, orderbook);
    }    

    public async getProductTicker(currencyPair: string): Promise<ServiceResponse>
    {
        const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

        this.checkRateLimit('getProductTicker');

        const result = await this.request('POST','/getticker', { Symbol: localCurrencyPair });

        if (!result)
            return new ServiceResponse(false);

        const ticker = new ExchangeTicker({
            currencyPair: currencyPair,
            price: result.last,
            date: moment.utc().format('YYYY-MM-DD HH:mm:ssZ'),
            bid: result.buy,
            ask: result.sell,
            volume: result.vol
          });
    
        return new ServiceResponse(true, ticker);
    }

    // API Doesn't seem to support this endpoint, so I scraped a list from their spot trading web app
    public async getAllProducts(): Promise<ServiceResponse>
    {
        const allPairs = this.getStaticPairsList();
        const allProducts: ExchangeProductModel[] = [];

        for (let i=0;i<allPairs.length;i++) {

            const currencyPair = allPairs[i];
            const pairParts = currencyPair.split('-');

            const tickerResponse = await this.getProductTicker(currencyPair);
            const ticker = tickerResponse.getData();

            allProducts.push(new ExchangeProductModel({
                ext_id: this.makeLocalCurrencyPair(currencyPair),
                exchange_id: this.getExchangeId(),
                base_currency: pairParts.shift(),
                quote_currency: pairParts.join('-'),
                volume_24hr: ticker.volume,
                status: ExchangeProductStatus.Online
            }));
        }

        return new ServiceResponse(true, allProducts);
    }

    // protected makeExchangeProduct(marketInfo: any): ExchangeProductModel
    // {
    //     const pairParts = marketInfo.pair.split(':');
    //     const baseCurrency = pairParts.shift();
    //     const quoteCurrency = pairParts.pop();

    //     return new ExchangeProductModel({
    //         ext_id: marketInfo.pair,
    //         exchange_id: this.getExchangeId(),
    //         base_currency: baseCurrency,
    //         quote_currency: quoteCurrency,
    //         volume_24hr: Number(marketInfo.volume),
    //         status: ExchangeProductStatus.Online
    //     });
    // }

    // protected makeExchangeAccount(accountInfo: any): ExchangeAccount
    // {
    //     const available = Number(accountInfo.available);
    //     const hold = Number(accountInfo.orders);

    //     return new ExchangeAccount({
    //         id: accountInfo.id,
    //         currency: accountInfo.currency,
    //         balance: available + hold,
    //         hold: hold,
    //         available: available
    //     });
    // }

    public makeLocalCurrencyPair(currencyPair: string): string
    {
        return currencyPair.replace('-','/');
    }    


    private async request(method: 'GET'|'POST', uri: string, params?: any): Promise<any>
    {
        if (!params)
            params = {};

        // Sign the request per https://idcm.io/api/list
        // Example: https://github.com/IDCG/IDCM-API

        // Sign uses HmacSHA384 encryption. The encryption method is as follows:
        // (1) Use UTF-8 encoding for request parameters and UTF-8 encoding for SecretKey (request parameters cannot be empty)
        // (2) Get the signature calculation result and perform Base64 encoding
        // (3) Add the above value as a sign to the Http request header.

        // utf8 encode => HmacSHA384 encrypt => base64 encode


        // The payload is the parameters object, first JSON encoded, and then encoded into Base64
        // payload = parameters-object -> JSON encode
        
        // These are encoded as HTTP headers named:
        // X-IDCM-APIKEY
        // X-IDCM-SIGNATURE
        // X-IDCM-INPUT        

        const inputHeaderVal = JSON.stringify(params);
        const signatureHeaderVal = this.createRequestSignature(inputHeaderVal);


        const fullUrl = `${this.config.apiUrl}${uri}`;

        let opts: any = {
            method: method,
            uri: fullUrl,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'X-IDCM-APIKEY': this.config.apiKey,
                'X-IDCM-SIGNATURE': signatureHeaderVal,
                'X-IDCM-INPUT': inputHeaderVal
            },
        };    

        if (method === 'GET')
            opts.qs = params;
        if (method === 'POST')
            opts.body = JSON.stringify(params);

        try {

            let response = await RequestPromise(opts);

            if (typeof response === 'string') {
                response = JSON.parse(response);
            }            

            if (!response)
                return;

            if (response.code && Number(response.code) !== 200)
                throw new Error(response.code);

            if (response.data)
                return response.data;

            return response;

        } catch (err) {
            await this.logService.error('BilaxyExchangeService::request', err, opts);
            return null;
        }
    }


    private createRequestSignature(requestInput: string): string
    {
        const hash = crypto.createHmac('sha384', this.config.apiSecret).update(requestInput).digest('hex');
        return Buffer.from(hash).toString('base64');        
    }    

    private getStaticPairsList(): string[]
    {
        const allPairs: Set<string> = new Set();

        const pairMap = {
            // key = quote, value = array of bases
            USDT: [
                'EOS',
                'BTC',
                'ETH',
                'LTC',
                'XRP',
                'ETC',
                'VHKD',
                'SQN',
                'CONM',
                'EVY',
                'NECC',
                'FCS',
                'RISE',
                'USNS',
                'MSEC',
                'CRS',
                'GARD',
                'BDX',
                'BCT',
                'KEY',
                'EVEO',
                'GBT',
                'JAC',
                'CBM'
            ],
            BTC: [
                'XRP',
                'ETH',
                'EOS',
                'ETC',
                'LTC',
                'BAT',
                'BDX',
                'FCS',
                'EVY',
                'SAIT',
                'BNK',
                'CBM',
                'MIR',
                'UTNP',
                'ARTS',
                'CONM',
                'EPM',
                'MGC',
                'PTON',
                'VMC',
                'KEY',
                'EVEO',
                'BETRA',
                'JAC',
                'FLT',
                // 'HINT' // API is returning a 4100 error code (i.e. Invalid Parameter)
            ],
            ETH: [
                'CMT',
                'USNS',
                'NECC',
                'UTNP',
                'SAIT',
                'BETRA',
                'PTON',
                'CXAT',
                'MGC',
                'TUT',
                //'SPIN'
            ]
        };


        Object.keys(pairMap).map(quoteCurrency => {
            pairMap[quoteCurrency].map(baseCurrency => {
                allPairs.add(`${baseCurrency}-${quoteCurrency}`);
            });
        });

        return Array.from(allPairs);
    }
}

