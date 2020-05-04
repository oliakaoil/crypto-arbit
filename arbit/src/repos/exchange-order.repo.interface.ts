import { ExchangeOrderModel } from '../models/exchange-order.model';
import { OrderLockType, OrderStatus, OrderType } from '../enums/order.enum';
import { ExchangeIds } from '../enums/exchange.enum';


export interface IExchangeOrderRepo {

  create(orderModel: ExchangeOrderModel): Promise<ExchangeOrderModel>

  update(orderId: number, attrs): Promise<number>

  getById(orderId: Number): Promise<ExchangeOrderModel>

  getByExtId(exchangeId: ExchangeIds, extId: string): Promise<ExchangeOrderModel>

  getAll(orderTypes?: OrderType[], orderStati?: OrderStatus[]): Promise<ExchangeOrderModel[]>

  getOrderLock(orderId: number, lockType: OrderLockType): Promise<boolean>

  unlockOrder(orderId: number): Promise<boolean>

  orderIsOpen(status: OrderStatus): boolean

  orderIsClosed(status: OrderStatus): boolean

  orderIsFilled(status: OrderStatus): boolean
}