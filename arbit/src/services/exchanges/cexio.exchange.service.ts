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



export class CexioExchangeService extends BaseExchangeService implements IExchangeService {

    private cexioService: any;
    private cexioAuthService: any;

    constructor(opts)
    {
        super(opts);
        this.exchangeId = ExchangeIds.Cexio;
        this.cexioService = opts.cexioService;
        this.cexioAuthService = opts.cexioAuthService;

        // https://cex.io/fee-schedule
        this.makerFillFee = 0.0016;
        this.takerFillFee = 0.0025;        

        this.apiRateLimit = 1;
        this.tweaks.apiRateLimitOrderbook = 1;
    }

    public async getAccounts(): Promise<ServiceResponse>
    {
        try {

        const result = await this.cexioAuthService.account_balance();

        if (!result)
            return new ServiceResponse(false);
        
        const username = result.username;
        delete result.timestamp;
        delete result.username;

        return new ServiceResponse(true, Object.keys(result).map(k => {
                const accountInfo = result[k];
                accountInfo.currency = k;
                accountInfo.id = `${k}-${username}`;
                return this.makeExchangeAccount(accountInfo);
            }));

        } catch (err) {
            await this.logService.error('CexioExchangeService::getAccounts', err);
            return new ServiceResponse(false, err);
        }    
    }

    public async getOrderById(orderId: string): Promise<ServiceResponse>
    {
        const result = await this.cexioAuthService.get_order_details(orderId);

        if (!result || !result.id)
            return new ServiceResponse(false);

        return new ServiceResponse(true, this.makeExchangeOrder(result));
    }

    public async getAllOrders(): Promise<ServiceResponse>
    {

        return new ServiceResponse(true);
    }

    public async getOrderbook(currencyPair: string): Promise<ServiceResponse>
    {
        try {

            const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

            const result = await this.cexioService.orderbook(localCurrencyPair, 15);

            if (!result || !result.asks || !result.bids) {
                await this.logService.error(`CexioExchangeService::getOrderbook | API error`, result);
                return new ServiceResponse(false);
            }

            const orderbook = new ExchangeOrderbook(this.getExchangeId(), currencyPair);
            
            orderbook.sequence = result.id;

            orderbook.asks = result.asks.map(m => new ExchangeOrderbookLevel(m[0], m[1]));
            orderbook.bids = result.bids.map(m => new ExchangeOrderbookLevel(m[0], m[1]));

            orderbook.sortFills();

            return new ServiceResponse(true, orderbook);

        } catch (err) {
            await this.logService.error('CexioExchangeService::getOrderbook | API error', err);
            return new ServiceResponse(false);
        }
    }    

    public async getProductTicker(currencyPair: string): Promise<ServiceResponse>
    {
        try {

            const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

            const result = await this.cexioService.ticker(localCurrencyPair);
      
            if (!result || !result.last)
                return new ServiceResponse(false);

            const ticker = new ExchangeTicker({
              currencyPair: currencyPair,
              price: Number(result.last),
              date: moment.unix(Number(result.timestamp)).format('YYYY-MM-DD HH:mm:ssZ'),
              bid: Number(result.bid),
              ask: Number(result.ask),
              volume: Number(result.volume),
            });
      
            return new ServiceResponse(true, ticker);
      
          } catch(err) {
      
            await this.logService.error('CexioExchangeService::getProductTicker', err);
            return new ServiceResponse(false, err);
          }
    }

    public async getAllProducts(): Promise<ServiceResponse>
    {
        try {

            const result = await this.cexioService.all_tickers();

            if (!result || !result.length)
                return new ServiceResponse(false);

            return new ServiceResponse(true, result.map(r => this.makeExchangeProduct(r)) );
      
          } catch(err) {
      
            await this.logService.error('CexioExchangeService::getAllProducts', err);
            return new ServiceResponse(false, err);
          }
    }
    
    public async limitOrder(orderType: OrderType, localId: string, currencyPair: string, size: number, price: number): Promise<ServiceResponse>
    {
        const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);
        const orderTypeStr = (orderType === OrderType.LimitBuy ? 'buy' : 'sell');

        const result = await this.cexioAuthService.place_order(localCurrencyPair, orderTypeStr, size, price, 'limit');

        if (!result || !result.id)
            return new ServiceResponse(false);
        
        /*
         * The result from a place order call is just a small amount of info, so we 
         * make a second api call to get the full order info
            {
                complete: true,
                id: '10544624159',
                time: 1571190572973,
                pending: '0.00000000',
                amount: '0.10000000',
                type: 'sell',
                price: '54.97'
            }
        */
            
        return this.getOrderById(result.id);
    }

    public async cancelOrder(extId: string): Promise<ServiceResponse>
    {

        return new ServiceResponse(true);
    }

    public async cryptoTransfer(transfer: ExchangeTransferModel): Promise<ServiceResponse>
    {

        return new ServiceResponse(true);
    }  

    public makeLocalCurrencyPair(currencyPair): string
    {
        return currencyPair.replace(/-/,'/');
    }    

    protected makeExchangeProduct(marketInfo: any): ExchangeProductModel
    {
        const pairParts = marketInfo.pair.split(':');
        const baseCurrency = pairParts.shift();
        const quoteCurrency = pairParts.pop();

        return new ExchangeProductModel({
            ext_id: marketInfo.pair,
            exchange_id: this.getExchangeId(),
            base_currency: baseCurrency,
            quote_currency: quoteCurrency,
            volume_24hr: Number(marketInfo.volume),
            status: ExchangeProductStatus.Online
        });
    }

    protected makeExchangeAccount(accountInfo: any): ExchangeAccount
    {
        const available = Number(accountInfo.available);
        const hold = Number(accountInfo.orders);

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
        const status = this.determineOrderStatus(orderInfo);
        const size = Number(orderInfo.amount);
        const createdAt = moment.unix(orderInfo.time/1000).format('YYYY-MM-DD HH:mm:ss');

        return new ExchangeOrder({
            id: orderInfo.id,
            price: Number(orderInfo.price),
            size: size,
            currencyPair: `${orderInfo.symbol1}-${orderInfo.symbol2}`,
            side: orderInfo.type,
            // strangely enough this does not seem to be indicated
            type: 'limit',
            // also not provided
            timeInForce: 'GTC', 
            createdAt: createdAt,
            // also not provided, so just copy the created at for orders that are filled right away
            doneAt: (status === OrderStatus.Settled ? createdAt : null),
            doneReason: '',
            fillFees: (orderInfo.tradingFeeTaker ? Number(orderInfo.tradingFeeTaker) : null),
            filledSize: size - Number(orderInfo.remains),
            stopPrice: 0,
            status: status
        });
    }

    protected determineOrderStatus(orderInfo: any)
    {
        switch (orderInfo.status) {
            case 'd': // done, fully executed
                return OrderStatus.Settled;
            case 'c': 
            case 'cd': // cancelled and not executed
                return OrderStatus.Closed;
            case 'a':  // active
                return OrderStatus.Open;
            default:
                return OrderStatus.Unknown;
        }
    }
}
