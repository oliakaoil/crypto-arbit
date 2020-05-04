import { ILoggingService } from '../services/logging.service.interface';
import { OrderType, OrderLockType } from '../enums/order.enum';
import { IArbitService } from '../services/arbit.service.interface';
import { IExchangeOrderService } from '../services/exchange-order.service.interface';
import { ExchangeOrderModel } from '../models/exchange-order.model';
import { 
    ExchangeOrder, 
    ExchangeOrderbookLevel,
    ExchangeQuickFill,
    ExchangeOrderbook
} from '../exchange.response';
import { sleep } from '../helpers';
import { ExchangeIds } from '../enums/exchange.enum';
import { IOrderController } from './order.controller.interface';
import { ICacheService } from '../services/cache.service.interface';
import { IMarketController } from './market.controller.interface';


export class OrderController implements IOrderController {

    private logService: ILoggingService;
    private cacheService: ICacheService;
    private arbitService: IArbitService;
    private exchangeOrderService: IExchangeOrderService;
    private getExchangeServiceById: CallableFunction;
    private getExchangeWebsocketServiceById: CallableFunction;
    private marketController: IMarketController;
        
    constructor(opts) {
        this.logService = opts.logService;
        this.cacheService = opts.cacheService;
        this.arbitService = opts.arbitService;
        this.exchangeOrderService = opts.exchangeOrderService;
        this.getExchangeServiceById = opts.getExchangeServiceById;
        this.getExchangeWebsocketServiceById = opts.getExchangeWebsocketServiceById;
        this.marketController = opts.marketController;
    }

    public async limitOrder(
        exchangeId: ExchangeIds, 
        orderType: OrderType.LimitBuy|OrderType.LimitSell,
        currencyPair: string,
        size?: number,
        funds?: number,
        price?: number
    ) : Promise<ExchangeOrderModel>
    {
        const logId = `OrderController::limitOrder | ex [${exchangeId}] ${orderType === OrderType.LimitBuy ? 'buy' : 'sell'} ${currencyPair} |`;
        await this.logService.infoWithNotif(`${logId} creating new order | size: ${size ? size : 'n/a'} | funds: ${funds ? funds : 'n/a'} | price ${price ? price : 'n/a'}`);

        if (orderType === OrderType.LimitBuy && !funds) {
            await this.logService.error(`${logId} you must specify funds when placing a limit buy order`);
            return;            
        }

        if (!size && !funds) {
            await this.logService.error(`${logId} refusing to execute order without size or funds`);
            return;
        }

        const exchangeService = this.getExchangeServiceById(exchangeId);

        if (!exchangeService) {
            await this.logService.error(`${logId} unknown ex id ${exchangeId}`);
            return;
        }


        /* 
         * Get the current price at the exchange and set the limit order price
         */        
        const quickFillSize = (orderType === OrderType.LimitBuy ? funds : size);
        const quickFill = await this.getQuickFill(exchangeId, currencyPair, orderType, quickFillSize);

        if (!price)
            price = quickFill.bestPrice;
        
        if (!price) {
            await this.logService.error(`${logId} unable to get quick fill data for ${currencyPair}`);
            return;
        }


        const failsafePercentage = 0.015;
        const priceDiff = Math.abs(price - quickFill.marketPrice);

        if ((priceDiff / quickFill.marketPrice) > failsafePercentage) {
            await this.logService.error(`${logId} price failsafe check failed | failsafe pct ${failsafePercentage} | priceDiff ${priceDiff} | market price ${quickFill.marketPrice}`);
            return;
        }
        

        if (!size)
            size = funds / price;


        /* 
         * Create the local order
         */
        const localOrderResponse = await this.exchangeOrderService.limitOrder(orderType, exchangeId, currencyPair, size, price);

        if (!localOrderResponse.isOk()) {
            await this.logService.error(`${logId} unable to create local order`);
            return;            
        }

        const localOrder: ExchangeOrderModel = localOrderResponse.getData();

        await this.logService.debug(`${logId} new local order ${localOrder.id}`);


        /* 
         * Lock the local order to prevent order duplication at the exchange
         */        
        const lockReseponse = await this.exchangeOrderService.getOrderLock(localOrder.id, OrderLockType.CreateLimitOrder);

        if (!lockReseponse.isOk()) {
            await this.logService.error(`${logId} unable lock local order ${localOrder.id}`);
            return localOrder;            
        }        


        /* 
         * Create the exchange order
         */        
        const exchangeResponse = await exchangeService.limitOrder(orderType, localOrder.uuid, String(currencyPair), size, localOrder.price);
        const exchangeOrder: ExchangeOrder = exchangeResponse.getData();

        if (!exchangeResponse.isOk() || !exchangeOrder || !exchangeOrder.id) {
            await this.logService.error(`${logId} exchange API error`);
            return localOrder;
        }


        /* 
         * Exchange order was a success, unlock the local order and sync it with the exchange response
         */
        const unlockResponse = await this.exchangeOrderService.unlockOrder(localOrder.id);

        if (!unlockResponse.isOk()) {
            await this.logService.error(`${logId} unable to unlock order`);
            return localOrder;
        }

        localOrder.order_lock = OrderLockType.Unlocked;

        const syncResponse = await this.exchangeOrderService.syncOrderPair(exchangeOrder, localOrder);        
        const syncedOrder: ExchangeOrderModel = syncResponse.getData();

        if (!syncResponse.isOk()) {
            await this.logService.error(`${logId} unable to sync local and exchange order`);
            return syncedOrder;
        }        


        // already filled? awesome!
        if (this.exchangeOrderService.orderIsFilled(syncedOrder.status))
            return syncedOrder;

        if (!this.exchangeOrderService.orderIsOpen(syncedOrder.status)) {
            await this.logService.error(`${logId} unable to create open exchange order`);
            return syncedOrder;
        }


        /*
         * Wait for the order to be filled
         *
         * Rather than using a Websocket connection, or polling at a later time, just wait a few seconds right now and then check to see
         * if the order was filled. The currently available exchanges tend to fill orders fairly quickly, so this tends to work. May need 
         * to be removed later.
         */
        await this.logService.info(`${logId} local order created, waiting for fill...`);

        const fillWaitSeconds = [2,5,10,10,15,30,30,30,30,30,30,30,30,30,30,30];
        let updatedOrder: ExchangeOrderModel;

        for (let i=0; i < fillWaitSeconds.length; i++) {
            const waitSeconds = fillWaitSeconds[i];

            await sleep(waitSeconds * 1000);

            updatedOrder = await this.syncOrderById(localOrder.id);

            if (!this.exchangeOrderService.orderIsOpen(updatedOrder.status)) {
                return updatedOrder;
            }
        }

        return updatedOrder;
    }

    public async syncOrderById(orderId: number): Promise<ExchangeOrderModel>
    {
        const logId = `OrderController::syncOrderById | order Id ${orderId} |`;
        await this.logService.infoWithNotif(`${logId} syncing order ${orderId}`);

        /*
         * Lookup the relevant order by the passed Id
         */
        const lookupResponse = await this.exchangeOrderService.getById(orderId);

        if (!lookupResponse.isOk()) {
            await this.logService.error(`${logId} db error on lookup`);
            return null;
        }

        const localOrder: ExchangeOrderModel = lookupResponse.getData();

        if (!localOrder) {
            await this.logService.error(`${logId} unable to find order in db`);
            return null;
        }        

        if (!localOrder.ext_id) {
            await this.logService.error(`${logId} missing extId, cannot sync with exchange`);
            return null;            
        }


        /*
         * Lookup the order at the exchange
         */
        const exchangeService = this.getExchangeServiceById(localOrder.exchange_id);

        if (!exchangeService) {
            await this.logService.error(`${logId} unknown ex id ${localOrder.exchange_id}`);
            return null;
        }        

        const exchangeResponse = await exchangeService.getOrderById(localOrder.ext_id, localOrder.currency_pair);

        if (!exchangeResponse.isOk()) {
            await this.logService.error(`${logId} unable to find order at exchange`);
            return null;
        }        

        const exchangeOrder: ExchangeOrder = exchangeResponse.getData();
        

        /*
         * Sync the order and return the new order
         */
        const syncResponse = await this.exchangeOrderService.syncOrderPair(exchangeOrder, localOrder);        

        if (!syncResponse.isOk()) {
            await this.logService.error(`${logId} unable to sync local and exchange order`);
            return null;
        }         

        return syncResponse.getData();
    }

    public async cancelOrder(): Promise<boolean>
    {
        /*
         *
            if (!orderModel.ext_id) {
            await this.logService.error('TradeService::cancelOrder | unable to cancel order, no extId found', orderModel);
            return new ServiceResponse(false, 'Unable to find extId');      
            }

            // Obtain a write lock on the position to prevent overwriting of stop values, duplicate orders, etc.
            const tradeLock = await this.localOrderRepo.getTradeLock(orderModel.id, TradeLockType.CancelOrder);

            if (!tradeLock) {
                await this.logService.error('TradeService::cancelOrder | Unable to get trade lock', orderModel);
                return new ServiceResponse(false, 'Unable to get trade lock');
            }                 



            const exchangeResponse = await this.exchangeService.cancelOrder(orderModel.ext_id);

            if (!exchangeResponse.isOk()) {
                await this.logService.error('TradeService::cancelOrder | unable to cancel order via API');
                return new ServiceResponse(false);   
            }

        */

        // localOrderService.cancelOrder

        return true;
    }




    /* 
     * Determine the price at which an order could be quickly filled if submitted immediately, by 
     * looking at the price, volume and order book for a given currency pair at a given exchange.
     * 
     * NOTE: When buying, size refers to the quote currency (i.e. I have 500 USD, how much BTC 
     * can I buy?) whereas when selling, size refers to the base currency (i.e. I have 2 BTC, how
     * much USD can I get for them?)
     * 
     * Fees are assesed within the quote currency both when buying AND selling!
     * 
     * At least at Bitforex, the fee amonut is taken out of the funds amount, so if you specify 200 USD as funds, you will end up buying a little less than that amount, if you don't have extra in the acct
     */
    public async getQuickFill(
        exchangeId: ExchangeIds,
        currencyPair: string,
        orderType: OrderType.LimitBuy|OrderType.LimitSell,
        sizeOrFunds: number
    ): Promise<ExchangeQuickFill>
    {
        const logId = `OrderController::getQuickFillPrice | ex [${exchangeId}] ${currencyPair} |`;
        const quickFill = new ExchangeQuickFill(exchangeId, currencyPair, orderType);

        // await this.logService.debug(`OrderController::getQuickFill | ex ${exchangeId} | currencyPair: ${currencyPair} | type: ${orderType} | sizeOrFunds: ${sizeOrFunds}`);

        const exchangeService = this.getExchangeServiceById(exchangeId);
        if (!exchangeService) {
            await this.logService.warn(`${logId} unable to load ex service`);
            return quickFill;
        }


        // Let's leave this out for now and be a little optimistic. We can cross this bridge later if/when we come to it.
        const delayVolume = 0;
        // const delayVolume = await this.getQuickfillDelayVolume(exchangeId, currencyPair, 1);
        // if (delayVolume === null) {
        //     await this.logService.error(`${logId} unable to load ex product`);
        //     return quickFill;
        // }
        // quickFill.delayVolume = delayVolume;

        const orderbook = await this.marketController.getOrderbookFromCache(exchangeId, currencyPair);

        if (!orderbook) {
            await this.logService.warn(`${logId} unable to load orderbook`);
            return quickFill;
        }
    
        let remainingFunds: number;
        let orderbookSide: ExchangeOrderbookLevel[];

        if (orderType === OrderType.LimitBuy) {
            quickFill.funds = sizeOrFunds;
            orderbookSide = orderbook.asks;
            remainingFunds = sizeOrFunds;
        } else {
            quickFill.size = sizeOrFunds;
            orderbookSide = orderbook.bids;
        }

        if (orderbook.asks.length && orderbook.bids.length) { 
            const marketSpread = orderbook.asks[0].price - orderbook.bids[0].price;
            quickFill.marketPrice = orderbook.bids[0].price + (marketSpread / 2);
        }


        let totalVolume = 0;
        let filledSize = 0;


        for (let i = 0; i < orderbookSide.length; i++) {
            const md: ExchangeOrderbookLevel = orderbookSide[i];
            quickFill.fills.push(md);
            totalVolume += md.size;
            let done = false;

            if (totalVolume < quickFill.delayVolume)
                continue;                

            switch (orderType) {
                case OrderType.LimitSell:

                    filledSize += md.size;

                    done = (filledSize >= quickFill.size);                    

                break;

                case OrderType.LimitBuy:

                    // how much can you afford to buy at this level?
                    const maxLevelBuySize = remainingFunds / md.price;

                    // fill as much as possible
                    const actualFillSize = Math.min(maxLevelBuySize, md.size);

                    filledSize += actualFillSize;

                    // subtract the price of what I just bought from my available funds
                    remainingFunds -= (actualFillSize * md.price);

                    if (remainingFunds <=0)
                        done = true;

                break;
            }
            

            // fully filled? cut the rest of the for-loop short by jacking up the incrementor
            if (done)
                i += orderbookSide.length;
        }
        

        if (quickFill.fills.length)
            quickFill.bestPrice = quickFill.fills[ quickFill.fills.length - 1 ].price;


        if (orderType === OrderType.LimitBuy) {

            quickFill.size = filledSize;

            if (remainingFunds > 0) {
                await this.logService.debug(`${logId} unable to get sufficient fills | orderType: ${orderType} | sizeOrFunds: ${sizeOrFunds} | remaining funds: ${remainingFunds}`);
                quickFill.bestPrice = null;
                return quickFill;
            }

        } else {

            quickFill.funds = quickFill.bestPrice * quickFill.size;

            if (filledSize < quickFill.size) {
                await this.logService.debug(`${logId} unable to get sufficient fills | orderType: ${orderType} | sizeOrFunds: ${sizeOrFunds} | remaining funds: ${remainingFunds}`);
                quickFill.bestPrice = null;
                return quickFill;                
            }
        }

        quickFill.takerFee = exchangeService.makeTakerFee(orderType, currencyPair, quickFill.size, quickFill.bestPrice);

        return quickFill;

        /*
         * Further work:
           - Assessing liquidity
              - Take a look at the bid-ask spread on percentage basis. tighter spread means more liquidity
              - can we actually count the sellers/buyers to see what kind of fill we would get?
              - https://www.5minutefinance.org/concepts/the-limit-order-book

           - Use the order book to determine size, rather than starting with a set funds size, and then assess the potential profit using order book sizes
         */
    }

    private async getQuickfillDelayVolume(
        exchangeId: ExchangeIds, 
        currencyPair: string,
        delaySeconds: number
        ): Promise<number>
    {
        const productResponse = await this.arbitService.getProductByCurrencyPair(exchangeId, currencyPair);
        const product = productResponse.getData();
        const logId = `OrderController::getQuickfillDelayVolume | ex [${exchangeId}] ${currencyPair} |`;

        if (!productResponse.isOk()) {
            await this.logService.error(`${logId} unable to load ex product`);
            return;
        }

        if (!product || product.volume === null)
            await this.logService.warn(`${logId} unable to get volume`);

        const volume24hr = (product ? product.volume : 0);
        const volumePerSecond = volume24hr / 24 / 60 / 60 / 2;
        const delayVolume = volumePerSecond * delaySeconds;        

        return delayVolume;
    }
}
