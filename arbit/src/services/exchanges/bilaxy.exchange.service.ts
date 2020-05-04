import * as moment from 'moment';
import * as RequestPromise from 'request-promise';
import * as utf8 from 'utf8';
import * as crypto from 'crypto';

import { IExchangeService } from './exchange.service.interface'
import { BaseExchangeService } from './base.exchange.service';
import { ServiceResponse } from '../../service.response';
import { ExchangeProductModel } from '../../models/exchange-product.model';
import { ExchangeIds, ExchangeProductStatus } from '../../enums/exchange.enum';
import { 
    ExchangeTicker, 
    ExchangeAccount, 
    ExchangeOrder,
    ExchangeOrderbook,
    ExchangeOrderbookLevel
} from '../../exchange.response';
import { ExchangeTransferModel } from '../../models/exchange-transfer.model';
import { OrderStatus, OrderType } from '../../enums/order.enum';
import { sleep } from '../../helpers';


// https://bilaxy.com/api#write
// checkout loadCurrencyMap as well, below
class BilaxyCoin {
    name: string;
    key: string;
    id: number;
    url: string;
    order: number;    
    currencyPair: string;
}

export class BilaxyExchangeService extends BaseExchangeService implements IExchangeService {

    private coinmap: Map<string, string> = new Map();

    constructor(opts)
    {
        super(opts);
        this.exchangeId = ExchangeIds.Bilaxy;
        this.apiConfig = opts.bilaxyConfig;

        this.makerFillFee = 0.0015;
        this.takerFillFee = 0.0015;

        this.coinmap = new Map();

        this.apiRateLimit = 6;
        this.tweaks.apiRateLimitOrderbook = 6;
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
        //await this.loadCurrencyMap();

        const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

        const result = await this.request('GET','/v1/orderbook', { pair: localCurrencyPair });

        if (!result || !result.asks || !result.bids)
            return new ServiceResponse(false);

        const orderbook = new ExchangeOrderbook(this.getExchangeId(), currencyPair);

        orderbook.asks = result.asks.map(m => new ExchangeOrderbookLevel(m[0], m[1]));
        orderbook.bids = result.bids.map(m => new ExchangeOrderbookLevel(m[0], m[1]))

        orderbook.sortFills();

        return new ServiceResponse(true, orderbook);
    }

    public async getProductTicker(currencyPair: string): Promise<ServiceResponse>
    {
        //await this.loadCurrencyMap();

        const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

        const result = await this.request('GET','/v1/ticker/24hr', { pair: localCurrencyPair });

        if (!result || !result[localCurrencyPair])
            return new ServiceResponse(false);

        const tickerData = result[localCurrencyPair];

        // apparently the new API does not have a ticker endpoint that returns the price?
        const orderbookResponse = await this.getOrderbook(currencyPair);

        if (!orderbookResponse.isOk())
            return new ServiceResponse(false);

        const orderbook: ExchangeOrderbook = orderbookResponse.getData();

        const ticker = new ExchangeTicker({
            currencyPair: currencyPair,
            price: orderbook.getPrice(),
            date: moment.utc().format('YYYY-MM-DD HH:mm:ssZ'),
            bid: orderbook.getBestBid().price,
            ask: orderbook.getBestAsk().price,
            volume: Number(tickerData.base_volume),
          });
    

        return new ServiceResponse(true, ticker);
    }

    public async getAllProducts(): Promise<ServiceResponse>
    {
        //await this.loadCurrencyMap();

        const result = await this.request('GET', '/v1/pairs');

        if (!result)
            return new ServiceResponse(false);
        
        return new ServiceResponse(true, Object.keys(result).map(k => this.makeExchangeProduct(result[k])));
    }
    
    public async limitOrder(orderType: OrderType, localId: string, currencyPair: string, size: number, price: number): Promise<ServiceResponse>
    {
        return new ServiceResponse(true);
    } 

    public async cancelOrder(extId: string): Promise<ServiceResponse>
    {

        return new ServiceResponse(true);
    }

    public async cryptoTransfer(transfer: ExchangeTransferModel): Promise<ServiceResponse>
    {
        return new ServiceResponse(true);
    }  

    public async getRateLimit(): Promise<ServiceResponse>
    {
        const result = await this.request('GET', '/ratelimits');

        if (!result)
            return new ServiceResponse(false);

        return new ServiceResponse(true, result);
    }

    protected makeExchangeProduct(marketInfo: any): ExchangeProductModel
    {
        return new ExchangeProductModel({
            ext_id: marketInfo.pair_id,
            exchange_id: this.exchangeId,
            base_currency: marketInfo.base,
            quote_currency: marketInfo.quote,
            status: (marketInfo.trade_enabled ? ExchangeProductStatus.Online : ExchangeProductStatus.Offline),
            volume_24hr: 0
        });
    }

    protected makeExchangeAccount(accountInfo: any): ExchangeAccount
    {
        const available = Number(accountInfo.available);
        const hold = Number(accountInfo.frozen);

        return new ExchangeAccount({
            id: accountInfo.id,
            currency: accountInfo.currency,
            balance: available + hold,
            hold: hold,
            available: available
        });
    }   
    
    protected makeExchangeOrder(orderInfo: any): ExchangeOrder
    {
        const exOrderStatus = this.determineOrderStatus(orderInfo);
        let doneAt = orderInfo.finished_time;

        if (!doneAt && exOrderStatus === OrderStatus.Settled)
            doneAt = orderInfo.create_time;

        return new ExchangeOrder({
            id: orderInfo.id,
            price: Number(orderInfo.price),
            size: Number(orderInfo.amount),
            currencyPair: orderInfo.market,
            side: orderInfo.type,
            type: orderInfo.order_type,
            timeInForce: 'GTC', // @todo verify this
            createdAt: moment.unix(orderInfo.create_time).format('YYYY-MM-DD HH:mm:ssZ'),
            doneAt: moment.unix(doneAt).format('YYYY-MM-DD HH:mm:ssZ'),
            doneReason: '',
            fillFees: Number(orderInfo.asset_fee),
            filledSize: Number(orderInfo.deal_amount),
            stopPrice: null,
            status: exOrderStatus
        });    
    }

    protected determineOrderStatus(orderInfo: any): OrderStatus
    {
        switch (orderInfo.status){
            case 'done':
                return OrderStatus.Settled;
            case 'not_deal':
            case 'part_deal':
                return OrderStatus.Open;
            default:
                return OrderStatus.Unknown;
        }
    }


    private async request(method: 'GET'|'POST', uri: string, params?: any): Promise<any>
    {
        if (!params)
            params = {};

        // params.access_id = this.apiConfig.apiKey;
        // params.tonce = moment().unix() * 1000;

        // Sign the request per https://github.com/fatbtc/fatbtc-api-rest/blob/master/README_en.md
        const alphaSort = (a,b) => {
            if (a === b)
                return 0;
            return (a > b ? 1 : -1);
        };

        let alphaSortParams: any = {};

        Object.keys(params).sort(alphaSort).map(k => alphaSortParams[k] = params[k]);

        let alphaSortParamStr = Object.keys(alphaSortParams)
            .map(k => `${k}=${encodeURIComponent(params[k])}`)
            .join('&');

        alphaSortParamStr = `${alphaSortParamStr}&secret_key=${this.apiConfig.apiSecret}`;

        const signedAuthVal = crypto
            .createHash('md5')
            .update(utf8.encode(alphaSortParamStr))
            .digest('hex')
            .toUpperCase();

        const fullUrl = `${this.apiConfig.apiUrl}${uri}`;

        let opts: any = {
            method: method,
            uri: fullUrl,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:70.0) Gecko/20100101 Firefox/70.0'
            },
        };    

        if (method === 'GET')
            opts.qs = alphaSortParams;
        if (method === 'POST')
            opts.body = JSON.stringify(alphaSortParams);

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

    public makeLocalCurrencyPair(currencyPair: string): string
    {
        const pairParts = currencyPair.split('-');
        const quoteCurrency = pairParts.pop();
        const baseCurrency = pairParts.join('-');

        return `${baseCurrency}_${quoteCurrency}`;
        //return this.coinmap.get(currencyPair);
    }

    public makeCurrencyPair(localCurrencyPair: string): string
    {
        return localCurrencyPair.replace('_','-');
        //return this.coinmap.get(`${localCurrencyPair}`);
    }     

    public async loadCurrencyMap(forceRefresh?:boolean): Promise<any>
    {
        if (!forceRefresh && this.coinmap.size)
            return;

        let opts: any = {
            method: 'GET',
            uri: 'https://bilaxy.com/api/v1/coins',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:70.0) Gecko/20100101 Firefox/70.0',
                'Content-Type': 'application/json; charset=utf-8',
            }
        };  

        let response = await RequestPromise(opts);        

        const json = JSON.parse(response);

        this.coinmap = new Map();

        json.data.map((coin: BilaxyCoin) => {
            const currencyPair = `${coin.name}-${coin.key}`;
            this.coinmap.set(currencyPair, `${coin.id}`);
            this.coinmap.set(`${coin.id}`, currencyPair);
        });
    }
}
