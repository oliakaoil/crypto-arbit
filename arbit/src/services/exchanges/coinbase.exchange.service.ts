
import { 
  AuthenticatedClient,
  PublicClient,
  ProductInfo,
  OrderInfo,
  LimitOrder,
  Account
} from 'coinbase-pro';

import { IExchangeService } from './exchange.service.interface';
import { BaseExchangeService } from './base.exchange.service';
import { ServiceResponse } from '../../service.response';

import { ExchangeProductModel } from '../../models/exchange-product.model';

import { OrderStatus, OrderType } from '../../enums/order.enum';
import { 
  ExchangeOrder,
  ExchangeTicker,
  ExchangeAccount,
  ExchangeOrderbookLevel,
  ExchangeOrderbook
} from '../../exchange.response';
import { ExchangeIds, ExchangeProductStatus } from '../../enums/exchange.enum';
import { ExchangeTransferModel } from '../../models/exchange-transfer.model';
import { TransferStatus } from '../../enums/transfer.enum';
import { toFixedTruncate, sleep } from '../../helpers';


export class CoinbaseExchangeService extends BaseExchangeService implements IExchangeService {

  private cbAuthService: AuthenticatedClient;
  private cbService: PublicClient;

  constructor(opts)
  {
    super(opts);
    this.exchangeId = ExchangeIds.Coinbase;
    this.cbAuthService = opts.coinbaseAuthService;
    this.cbService = opts.coinbaseService;

    // https://docs.pro.coinbase.com/#rate-limits
    this.apiRateLimit = 3;
    this.tweaks.apiRateLimitOrderbook = 1;
  }

  public async getAccounts(): Promise<ServiceResponse>
  {
    try {

      const cbAccounts = await this.rateLimitSafeApiCallAuth(this.cbAuthService.getAccounts);

      return new ServiceResponse(true, this.makeExchangeAccounts(cbAccounts));

    } catch (err) {
      await this.logService.error('CoinbaseExchangeService::getAccounts', err);
      return new ServiceResponse(false, err);
    }    
  }

  public async getOrderById(orderId: string): Promise<ServiceResponse>
  {
    try {

      const cbOrder = await this.rateLimitSafeApiCallAuth(this.cbAuthService.getOrder, [orderId]);
      return new ServiceResponse(true, await this.makeExchangeOrder(cbOrder));

    } catch (err) {

      /* 
       * A rather unfortunate limitation of the Coinbase REST API is that if an order is cancelled, the 
       * above API call may return a 404: 
       * 
       * https://docs.pro.coinbase.com/#get-an-order
       * 
       * This means there is currently NO way to differentiate between an order that never existed (i.e. 
       * an invalid order id) and an order that was created, and then later closed/cancelled, using this
       * API call. We therefore must assume that the order exists, but was cancelled, when getting a 404.
       */
      if (err.response && err.response.statusCode === 404)        
        return new ServiceResponse(true, null);
        
      await this.logService.error('CoinbaseExchangeService::getOrderById', err);

      return new ServiceResponse(false, err);
    }
  }

  public async getAllOrders(): Promise<ServiceResponse>
  {
    try {

      const cbOrders = await this.rateLimitSafeApiCallAuth(this.cbAuthService.getOrders, [{status: 'all'}]);
      return new ServiceResponse(true, await this.makeExchangeOrders(cbOrders));

    } catch (err) {
      await this.logService.error('CoinbaseExchangeService::getAllOrders', err);
      return new ServiceResponse(false, err);
    }
  }

  public async getOrderbook(currencyPair: string): Promise<ServiceResponse>
  {
      try {

        await this.checkRateLimit('orderbook');

        //const result = await this.rateLimitSafeApiCall(this.cbService.getProductOrderBook, [currencyPair, { level: 2 }]);
        const result = await this.cbService.getProductOrderBook(currencyPair, {level: 2});

        if (!result || !result.bids || !result.asks)
          return new ServiceResponse(false);

        const marketDepth = new ExchangeOrderbook(this.getExchangeId(), currencyPair);

        marketDepth.asks = result.asks.map(m => new ExchangeOrderbookLevel(m[0], m[1]));
        marketDepth.bids = result.bids.map(m => new ExchangeOrderbookLevel(m[0], m[1]));

        marketDepth.sortFills();

        return new ServiceResponse(true, marketDepth);

      } catch(err) {

        await this.logService.error('CoinbaseExchangeService::getOrderbook', err);
        return new ServiceResponse(false, err);
        }
  }

  public async getProductTicker(currencyPair: string): Promise<ServiceResponse>
  {
    try {

      await this.checkRateLimit('product-ticker');

      const result = await this.cbService.getProductTicker(currencyPair);

      const ticker = new ExchangeTicker({
        currencyPair: currencyPair,
        price: Number(result.price),
        date: result.time,
        bid: Number(result.bid),
        ask: Number(result.ask),
        volume: Number(result.volume),
      });

      return new ServiceResponse(true, ticker);

    } catch(err) {

      await this.logService.error('CoinbaseExchangeService::getProductTicker', err);
      return new ServiceResponse(false, err);
    }
  }

  public async getAllProducts(): Promise<ServiceResponse>
  {
    try {

      await this.checkRateLimit('all-products');

      const result: ProductInfo[] = await this.cbService.getProducts();

      return new ServiceResponse(true, result.map(r => this.makeExchangeProduct(r)));

    } catch(err) {

      await this.logService.error('CoinbaseExchangeService::getCurrencies', err);
      return new ServiceResponse(false, err);
    }   
  }

  public makeTakerFee(orderType: OrderType, currencyPair: string, size: number, price: number): number
  {
      // https://support.pro.coinbase.com/customer/en/portal/articles/2945310-fees
      const netPrice = size * price;
      let feePct: number;

      if (netPrice < 10000)
        feePct = 0.005;

      if (netPrice < 50000)
        feePct = 0.0035;

      if (netPrice < 100000)
        feePct = 0.0025;

      if (orderType === OrderType.LimitBuy)
        return size * feePct;

      return size * price * feePct;
  }

  public async limitOrder(orderType: OrderType, localId: string, currencyPair: string, size: number, price: number): Promise<ServiceResponse>
  {
    const cbOpts = this.getLimitOrderOpts((orderType === OrderType.LimitBuy ? 'buy' : 'sell'), localId, price, size, currencyPair);

    let response: ExchangeOrder;

    try {

      const cbResult:OrderInfo = await this.rateLimitSafeApiCallAuth(this.cbAuthService.placeOrder, [cbOpts]);
      response = await this.makeExchangeOrder(cbResult);

    } catch(err) {
      await this.logService.error('CoinbaseExchangeService::limitOrder | API error', err);
      return new ServiceResponse(false, err);
    }

    return new ServiceResponse(true, response);
  }

  public async cancelOrder(extId: string): Promise<ServiceResponse>
  {
    try {
      const canceledOrderId: String = await this.rateLimitSafeApiCallAuth(this.cbAuthService.cancelOrder, [extId]);
      const success = (canceledOrderId && canceledOrderId === extId);
      return new ServiceResponse(success);
    } catch (err) {
      await this.logService.error('CoinbaseExchangeService::cancelOrder API error', err);
      return new ServiceResponse(false, err);
    }
  }

  public async cryptoTransfer(transfer: ExchangeTransferModel): Promise<ServiceResponse>
  {
    const exchangeMeta = null;
    //const exchangeMeta = await this.exchangeRepo.getExchangeMeta(transfer.destExchangeId, transfer.currency);

    if (!exchangeMeta) {
      await this.logService.error(`CoinbaseExchangeService::cryptoTransfer | unable to find transfer address | exchange ${transfer.destExchangeId} ${transfer.currency}`);
      return new ServiceResponse(false);
    }

    if (exchangeMeta.depositMin > 0 && exchangeMeta.depositMin > transfer.size) {
      await this.logService.error(`CoinbaseExchangeService::cryptoTransfer | did not meet minimum transfer size | exchange  ${transfer.destExchangeId} ${transfer.currency} ${transfer.size} ${exchangeMeta.depositMin}`);
      return new ServiceResponse(false);      
    }

    try {

      const withdrawParams = {
        amount: transfer.size,
        currency: transfer.currency,
        crypto_address: exchangeMeta.depositAddress,
        destination_tag: (exchangeMeta.destTag ? exchangeMeta.destTag : null),
        // A boolean flag to opt out of using a destination tag for currencies that support one. This is required when not providing a destination tag
        no_destination_tag: (exchangeMeta.destTag ? true : false) 
      };
 
      const response = await this.rateLimitSafeApiCallAuth(this.cbAuthService.withdrawCrypto, [withdrawParams]);

      if (!response || !response.id) {
        await this.logService.error('CoinbaseExchangeService::cryptoTransfer | transfer request did not return id', response);
        return new ServiceResponse(false);  
      }

      transfer.extId = response.id;
      transfer.exchangeAddressId = exchangeMeta.id;
      transfer.status = TransferStatus.Completed;
      transfer.withdrawalFee = 0;
      
      return new ServiceResponse(true, transfer);

    } catch (err) {
      await this.logService.error('CoinbaseExchangeService::cryptoTransfer | API error', err);
      return new ServiceResponse(false, err);
    }
  }  

  private getLimitOrderOpts(side: 'buy'|'sell', localId: string, price: number, size: number, productId: string):LimitOrder
  {
    const cbOpts:LimitOrder = {
      type: 'limit',
      client_oid: localId, // unique id of the order on my side
      side: side,
      price: String(toFixedTruncate(price,4)),
      size: String(toFixedTruncate(size,4)),
      product_id: productId,
      time_in_force: 'GTC',
      stp: 'dc', // self-trade prevention flag
    };

    return cbOpts;
  }

  private makeExchangeAccounts(cbAccounts: Account[]): ExchangeAccount[]
  {
    return cbAccounts.map(c => this.makeExchangeAccount(c));
  }

  protected makeExchangeAccount(cbAccount: Account): ExchangeAccount
  {
    return new ExchangeAccount({
      id: cbAccount.id,
      currency: cbAccount.currency,
      balance: Number(cbAccount.balance),
      available: Number(cbAccount.available),
      hold: Number(cbAccount.hold)
    });
  }


  private async makeExchangeOrders(cbOrders: OrderInfo[]): Promise<ExchangeOrder[]>
  {
    const exchangeOrders: ExchangeOrder[] = [];
    for(var i=0; i < cbOrders.length; i++) {
      const cbOrder = cbOrders[i];
      exchangeOrders.push(await this.makeExchangeOrder(cbOrder));
    }
    return exchangeOrders;
  }
  
  protected makeExchangeProduct(cbProduct: ProductInfo): ExchangeProductModel
  {
    return new ExchangeProductModel({
      ext_id: cbProduct.id,
      exchange_id: this.exchangeId,
      base_currency: cbProduct.base_currency,
      quote_currency: cbProduct.quote_currency,
      status: (cbProduct.status === 'online' ? ExchangeProductStatus.Online : ExchangeProductStatus.Offline),
      volume_24hr: null
    });
  }

  protected makeExchangeOrder(cbOrder: OrderInfo): ExchangeOrder
  {
     return new ExchangeOrder({
        id: cbOrder.id,
        price: Number(cbOrder.price),
        size: Number(cbOrder.size),
        currencyPair: cbOrder.product_id,
        side: cbOrder.side,
        type: cbOrder.type,
        timeInForce: cbOrder.time_in_force,
        createdAt: cbOrder.created_at,
        doneAt: cbOrder.done_at,
        doneReason: cbOrder.done_reason,
        fillFees: Number(cbOrder.fill_fees),
        filledSize: Number(cbOrder.filled_size),
        stopPrice: Number(cbOrder.stop_price),
        status: this.determineOrderStatus(cbOrder)
     });    
  }

  protected determineOrderStatus(cbOrderResult: OrderInfo): OrderStatus
  {
    if (cbOrderResult.settled)
      return OrderStatus.Settled;

    switch (cbOrderResult.status) {
      case 'open':
      case 'pending': 
      case 'received': 
      case 'active':
        return OrderStatus.Open;

      case 'done':
          switch (cbOrderResult.done_reason) {
            case 'filled':
              return OrderStatus.Filled;

            // unknown done reason? that's not good
            default:
              this.logService.error('CoinbaseExchangeServce::determineOrderStatus | encountered unknown done reason in order info', cbOrderResult);
              return OrderStatus.Unknown;
          }

      case 'settled':
        // order status is settled, but the settled flag is not on? that's not good
        this.logService.error('CoinbaseExchangeServce::determineOrderStatus | order status is settled, but settled flag is not flipped', cbOrderResult);
        return OrderStatus.Unknown;

      case 'rejected':
          return OrderStatus.Failed;

      default:
        this.logService.error('CoinbaseExchangeServce::determineOrderStatus | encountered unknown order status', cbOrderResult);
        return OrderStatus.Unknown;
    }
  }

  private async rateLimitSafeApiCallAuth(method: any, args?: any[]) : Promise<any>
  {
    await sleep(150);
    return method.apply(this.cbAuthService, args);
  }

  private async rateLimitSafeApiCall(method: any, args?: any[]) : Promise<any>
  {
    await sleep(150);
    return method.apply(this.cbService, args);
  }  
}