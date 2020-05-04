import { IExchangeOrderService } from './exchange-order.service.interface';
import { ILoggingService } from './logging.service.interface';

import { IExchangeOrderRepo } from '../repos/exchange-order.repo.interface';

import { ServiceResponse } from '../service.response';
import { ExchangeOrder } from '../exchange.response';
import { ExchangeOrderModel } from '../models/exchange-order.model';

import { OrderType, OrderLockType, OrderStatus } from "../enums/order.enum";
import { ExchangeIds } from '../enums/exchange.enum'


export class ExchangeOrderService implements IExchangeOrderService {

  private logService: ILoggingService;
  private exchangeOrderRepo: IExchangeOrderRepo;

  constructor(opts)
  {
    this.logService = opts.logService;
    this.exchangeOrderRepo = opts.exchangeOrderRepo;
  }

  public async getById(orderId: number): Promise<ServiceResponse>
  {
    const orderModel = await this.exchangeOrderRepo.getById(orderId);

    if (!orderModel)
      return new ServiceResponse(false);

    return new ServiceResponse(true, orderModel);
  }  

  public async getByExtId(exchangeId: ExchangeIds, extId: string): Promise<ServiceResponse>
  {
    const orderModel = await this.exchangeOrderRepo.getByExtId(exchangeId, extId);

    if (!orderModel)
      return new ServiceResponse(false);

    return new ServiceResponse(true, orderModel);
  }

  public async getAll(): Promise<ServiceResponse>
  {
    const orderModels = await this.exchangeOrderRepo.getAll();

    if (!orderModels)
      return new ServiceResponse(false);

    return new ServiceResponse(true, orderModels);
  }

  public async limitOrder(
    orderType: OrderType.LimitBuy | OrderType.LimitSell, 
    exchangeId: ExchangeIds, 
    currencyPair: string, 
    size: number, 
    price: number, 
    parentId?: number
  ): Promise<ServiceResponse>
  {
    await this.logService.info(`ExchangeOrderService::limitOrder | create ${exchangeId}-${orderType} | currencyId ${currencyPair} | size: ${size} | price: ${price} | parentId: ${parentId}`);

    // @todo validation!

    const newOrderModel = new ExchangeOrderModel({
      exchange_id: exchangeId,
      type_id: orderType,
      size: size,
      currency_pair: currencyPair,
      price: price,
      trade_lock: OrderLockType.CreateLimitOrder,
      parent_id: (parentId ? parentId : null),
    });

    const newOrder = await this.exchangeOrderRepo.create(newOrderModel);

    if (!newOrder || !newOrder.id) {
      await this.logService.error('ExchangeOrderService::limitOrder | db error');
      return new ServiceResponse(false);
    }

    return new ServiceResponse(true, newOrder);
  }
  
  /*
   * Sync a trade in the database with order info from the exchange. Set the open
   * price, date, status, external ID, and fill price and date if applicable. For
   * stop orders, make sure the stop price is correct. 
   */
  public async syncOrderPair(exResp: ExchangeOrder, orderModel: ExchangeOrderModel): Promise<ServiceResponse>
  {
    orderModel.ext_id = exResp.id;
    orderModel.open_date = exResp.createdAt;
    orderModel.open_price = exResp.price;
    orderModel.status = exResp.status;
    orderModel.size = exResp.size;

    if (this.exchangeOrderRepo.orderIsFilled(orderModel.status)) {
      orderModel.fill_price = orderModel.open_price; // @todo right now this will always be the same as the open price, is this accurate?
      orderModel.fill_date = exResp.doneAt;
      orderModel.fill_fee = exResp.fillFees;
    }

    const result = await this.exchangeOrderRepo.update(orderModel.id, orderModel);

    if (!result) {
      await this.logService.error('ExchangeOrderService::syncLimitOrder | db update failed');
      return new ServiceResponse(false);
    }

    return new ServiceResponse(true, orderModel);    
  }

  public async cancelOrder(orderModel: ExchangeOrderModel): Promise<ServiceResponse>
  {
      const response = await this.exchangeOrderRepo.update(orderModel.id, { status: OrderStatus.Closed, trade_lock: false });
      
      if (response !== 1) {
          await this.logService.error('ExchangeOrderService::cancelOrder | db update failed');
          return new ServiceResponse(false);
      }

      return new ServiceResponse(true);
  }  

  public async getOrderLock(orderId: number, lockType: OrderLockType): Promise<ServiceResponse>
  {
    const response = await this.exchangeOrderRepo.getOrderLock(orderId, lockType);

    if (!response)
      await this.logService.error('ExchangeOrderService::getOrderLock | unable to lock trade');

    return new ServiceResponse(response);
  }

  public async unlockOrder(orderId: number): Promise<ServiceResponse>
  {
    const response = await this.exchangeOrderRepo.unlockOrder(orderId);

    if (!response)
      await this.logService.error('ExchangeOrderService::unlockOrder | unable to lock trade');

    return new ServiceResponse(response);
  }  

  public orderIsOpen(status: OrderStatus): boolean
  {
    return this.exchangeOrderRepo.orderIsOpen(status);
  }

  public orderIsFilled(status: OrderStatus): boolean
  {
    return this.exchangeOrderRepo.orderIsFilled(status);
  }

  public orderIsClosed(status: OrderStatus): boolean  
  {
    return this.exchangeOrderRepo.orderIsClosed(status);
  }
}