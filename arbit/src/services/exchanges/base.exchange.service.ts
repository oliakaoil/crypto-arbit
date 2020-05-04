import { RestService } from "../rest.service";

import { IExchangeRepo } from "../../repos/exchange.repo.interface";
import { IExchangeOrderRepo } from '../../repos/exchange-order.repo.interface';

import { ExchangeProductModel } from "../../models/exchange-product.model";
import { ExchangeTransferModel } from '../../models/exchange-transfer.model';


import { ServiceResponse } from "../../service.response";
import { ExchangeIds, ExchangeProductStatus, ExchangeLockType } from "../../enums/exchange.enum";
import { OrderType, OrderStatus } from "../../enums/order.enum";
import { ExchangeTicker, ExchangeOrderbookLevel, ExchangeOrderbook, ExchangeAccount, ExchangeOrder } from "../../exchange.response";
import { sleep, DateFormat } from '../../helpers';

import * as moment from 'moment';


export class ExchangeTweaks {
    // Some exchanges are not capable of returning full account balance information
    apiFullAccounts: boolean;

    // how many asks/bids to return when querying for market depth
    apiMarketDepthLevels: number;

    // After creating a new order, some exchanges take a short period of time before the order can be pulled from the api by Id
    newOrderQueryWaitMs: number;

    // some exchanges have a separate rate limit for orderbook endpoints
    apiRateLimitOrderbook: number;

    // bitforex seems to require a long pause after pulling their list of products
    afterGetAllProductsDelayMs: number;
}


export class BaseExchangeService extends RestService {
 
    protected exchangeId: ExchangeIds;

    protected exchangeRepo: IExchangeRepo;
    protected exchangeOrderRepo: IExchangeOrderRepo;

    protected takerFillFee: number = 0;
    protected makerFillFee: number = 0;

    protected apiConfig: any = {};
    protected api: any;

    protected tweaks: ExchangeTweaks;

    constructor(opts)
    {
        super(opts);
        this.exchangeRepo = opts.exchangeRepo;        
        this.exchangeOrderRepo = opts.exchangeOrderRepo;

        this.tweaks = new ExchangeTweaks();
        this.tweaks.apiFullAccounts = true;
        this.tweaks.newOrderQueryWaitMs = 0;
        this.tweaks.apiMarketDepthLevels = 100;
        this.tweaks.apiRateLimitOrderbook = 100;
        this.tweaks.afterGetAllProductsDelayMs = 0;
    }

    public getExchangeId(): ExchangeIds
    {
        return this.exchangeId;
    }

    public getFees(): { maker: number, taker: number }
    {
        return {
            maker: this.makerFillFee,
            taker: this.takerFillFee
        };
    }

    public makeWithdrawalFee(size: number): number
    {
        // @todo
        return 0;
    }

    /*
     * Fees are taken out of the "end result" currency, or whatever currency you will 
     * end up with after your order completes. Presumably this is to ensure that your 
     * account will hold enough currency to pay the fee.
     */
    public makeTakerFee(orderType: OrderType, currencyPair: string, size: number, price: number): number
    {
        // when buying, fees are assessed in the base currency
        if (orderType === OrderType.LimitBuy)
            return size * this.takerFillFee;

        // when selling, fees are assessed in the quote currency
        return size * price * this.takerFillFee;
    }

    public getTweaks(): ExchangeTweaks
    {
        return this.tweaks;
    }

    public async getModel(): Promise<any>
    {
        return this.exchangeRepo.getById(this.exchangeId);
    }

    public getApi(): any
    {
        return this.api;
    }

    /*
     * For some exchanges, returned account balances have only 4 decimals of precision, even though this value
     * is tracked at the exchange up to 8 decimal
     */
    public async getAccounts(): Promise<ServiceResponse>
    {
        try {

            const result = await this.api.fetchBalance();

            if (!result || !result.info)
                return new ServiceResponse(false);

            const reservedKeys = ['info','free','used','total'];

            const accounts = Object.keys(result)
                .filter(k => reservedKeys.indexOf(k) === -1)
                .map(k => {
                    let accountInfo = result[k];
                    accountInfo.currency = k;
                    return this.makeExchangeAccount(accountInfo)
                }).filter(a => a.balance > 0);

            return new ServiceResponse(true, accounts);

        } catch (err) {
            await this.logService.error(`BaseExchangeService::getAccounts | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    }    

    public async getAllProducts(): Promise<ServiceResponse>
    {
        try {

            const result = await this.api.fetchMarkets();

            if (!result || !result.length)
                return new ServiceResponse(false);

            if (this.tweaks.afterGetAllProductsDelayMs) 
                await sleep(this.tweaks.afterGetAllProductsDelayMs);                

            return new ServiceResponse(true, result.map(r => this.makeExchangeProduct(r)));

        } catch (err) {
            await this.logService.error(`BaseExchangeService::getAllProducts | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    }      

    public async getProductTicker(currencyPair: string): Promise<ServiceResponse>
    {
        try {

            const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);
            const result = await this.api.fetchTicker(localCurrencyPair);

            if (!result)
                return new ServiceResponse(false);

            return new ServiceResponse(true, this.makeExchangeTicker(result));

        } catch (err) {
            await this.logService.error(`BaseExchangeService::getProductTicker | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    }    

    public async getOrderbook(currencyPair: string): Promise<ServiceResponse>
    {
        try {
            const product = await this.exchangeRepo.getProductByCurrencyPair(this.getExchangeId(), currencyPair);

            const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

            const result = await this.api.fetchOrderBook(localCurrencyPair, this.tweaks.apiMarketDepthLevels);

            if (!result || !result.bids || !result.asks)
                throw new Error(`missing bids/asks from fetchOrderBook ${currencyPair}`);

            const orderbook = new ExchangeOrderbook(this.getExchangeId(), currencyPair);

            if (result.nonce)
                orderbook.sequence = result.nonce;

            if (result.timestamp)
                orderbook.timestamp = result.timestamp;

            orderbook.asks = result.asks.map(m => new ExchangeOrderbookLevel(m[0], m[1]));
            orderbook.bids = result.bids.map(m => new ExchangeOrderbookLevel(m[0], m[1]));

            orderbook.sortFills();

            if (product)
                orderbook.productId = product.id;

            return new ServiceResponse(true, orderbook);

        } catch (err) {
            await this.logService.error(`BaseExchangeService::getOrderbook | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    }

    public async limitOrder(
        orderType: OrderType, 
        localId: string, 
        currencyPair: string, 
        size: number, 
        price: number
    ): Promise<ServiceResponse>
    {
        const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);
        const orderSide = (orderType === OrderType.LimitBuy ? 'buy' : 'sell');
        let newOrderId: string;

        try {

            const result = await this.api.createOrder(localCurrencyPair, 'limit', orderSide, size, price);

            if (!result || !result.id)
                return new ServiceResponse(false);

            newOrderId = result.id;

        } catch (err) {
            await this.logService.error(`BaseExchangeService::limitOrder | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }

        // If you query the API for the order created above too quickly, it may return as not found, so try a few times
        // if there is a delay configured for this exchange
        const hasNewOrderQueryWait = (this.tweaks.newOrderQueryWaitMs > 0);
        const newOrderQueryRetryCount = ( hasNewOrderQueryWait ? 3 : 1);
        let getOrderResponse:ServiceResponse;

        for (let i=0; i < newOrderQueryRetryCount; i++)
        {
            if (hasNewOrderQueryWait)
                await sleep(this.tweaks.newOrderQueryWaitMs);

            getOrderResponse = await this.getOrderById(newOrderId, currencyPair);

            // querying the new order seems to have worked, break out of the retry loop
            if (getOrderResponse.isOk())
                break;
        }

        return getOrderResponse;
    }

    public async getOrderById(orderId: string, currencyPair?: string): Promise<ServiceResponse>
    {
        await this.logService.debug(`BaseExchangeService::getOrderById | ${orderId} ${currencyPair}`);

        try {

            const localCurrencyPair = (currencyPair ? this.makeLocalCurrencyPair(currencyPair) : null);

            const result = await this.api.fetchOrder(orderId, localCurrencyPair);

            if (!result || !result.id)
                throw new Error('invalid response and/or missing id');

            return new ServiceResponse(true, this.makeExchangeOrder(result));

        } catch (err) {
            await this.logService.error(`BaseExchangeService::getOrderById | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    }    

    public async getAllOrders(): Promise<ServiceResponse>
    {
        try {

            const result = await this.api.fetchOrders();

            if (!result || !result.length)
                return new ServiceResponse(false);

            return new ServiceResponse(true, result.map(r => this.makeExchangeOrder(r)));

        } catch (err) {
            await this.logService.error(`BaseExchangeService::getAllOrders | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    }   
    
    public async cancelOrder(orderId: string, currencyPair?: string): Promise<ServiceResponse>
    {
        try {

            const localCurrencyPair = (currencyPair ? this.makeLocalCurrencyPair(currencyPair) : null);

            const result = await this.api.cancelOrder(orderId, localCurrencyPair);

            if (!result || !result.success)
                return new ServiceResponse(false);

            return new ServiceResponse(true, true);

        } catch (err) {
            await this.logService.error(`BaseExchangeService::cancelOrder | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    }    

    public async cryptoTransfer(transfer: ExchangeTransferModel): Promise<ServiceResponse>
    {


        return new ServiceResponse(true, transfer);
    }    


    public async getExchangeLock(lockType: ExchangeLockType): Promise<ServiceResponse>
    {
      const response = await this.exchangeRepo.getExchangeLock(this.exchangeId, lockType);
  
      return new ServiceResponse(response);
    }  
  
    public async unlockExchange(): Promise<ServiceResponse>
    {
      const response = await this.exchangeRepo.unlockExchange(this.exchangeId);
  
      return new ServiceResponse(response);
    }


    public makeLocalCurrencyPair(currencyPair: string): string
    {
        return currencyPair.replace('-','/');
    }

    public makeCurrencyPair(localCurrencyPair: string): string
    {
        return localCurrencyPair.replace('/','-');
    }    




    /*
     * Protected methods
     */

    protected makeExchangeTicker(marketInfo: any): ExchangeTicker
    {
        let date = marketInfo.datetime;
        if (!date && marketInfo.info && marketInfo.info.time)
            date = moment.unix(marketInfo.info.time/1000).utc().format(DateFormat.Default);

        return new ExchangeTicker({
            currencyPair: this.makeCurrencyPair(marketInfo.symbol),
            bid: Number(marketInfo.bid),
            ask: Number(marketInfo.ask),
            price: Number(marketInfo.last),
            volume: Number(marketInfo.baseVolume),
            date: date
        })        
    }

    protected makeExchangeProduct(marketInfo: any): ExchangeProductModel
    {
        return new ExchangeProductModel({
            ext_id: marketInfo.symbol,
            exchange_id: this.getExchangeId(),
            base_currency: marketInfo.base,
            quote_currency: marketInfo.quote,
            volume_24hr: null,
            status: ExchangeProductStatus.Online
        });
    }    

    protected makeExchangeAccount(accountInfo: any): ExchangeAccount
    {
        return new ExchangeAccount({
            id: null,
            currency: String(accountInfo.currency).toUpperCase(),
            balance: accountInfo.total,
            hold: accountInfo.used,
            available: accountInfo.free
        });
    }   

    protected makeExchangeOrder(orderInfo: any): ExchangeOrder
    {
        return new ExchangeOrder({
            id: orderInfo.id,
            price: orderInfo.price,
            size: orderInfo.amount,
            currencyPair: this.makeCurrencyPair(orderInfo.symbol),
            side: orderInfo.side,
            type: (orderInfo.side === 'sell' ? OrderType.LimitSell : OrderType.LimitBuy),
            timeInForce: null,
            createdAt: moment.unix(orderInfo.timestamp/1000).format(DateFormat.Default),
            doneAt: (orderInfo.lastTradeTimestamp ? moment.unix(orderInfo.lastTradeTimestamp/1000).format(DateFormat.Default) : null),
            doneReason: '',
            fillFees: orderInfo.fee.cost,
            filledSize: orderInfo.filled,
            stopPrice: null,
            status: this.determineOrderStatus(orderInfo)
        });    
    }

    protected determineOrderStatus(orderInfo: any): OrderStatus
    {
        switch (orderInfo.status) {
            case 'open':
                return OrderStatus.Open;
            case 'closed':
                return OrderStatus.Settled;
            case 'canceled':
                return OrderStatus.Failed;
            default:
                return OrderStatus.Unknown;
        }
    }    
}

