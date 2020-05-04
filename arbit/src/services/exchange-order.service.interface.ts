import { ExchangeOrderModel } from '../models/exchange-order.model';
import { ServiceResponse } from '../service.response';
import { ExchangeOrder } from '../exchange.response';
import { OrderType, OrderLockType, OrderStatus } from "../enums/order.enum";
import { ExchangeIds } from '../enums/exchange.enum'
import { ExchangeProductModel } from '../models/exchange-product.model';


export interface IExchangeOrderService {

    getById(orderId: number): Promise<ServiceResponse>

    getByExtId(exchangeId: ExchangeIds, extId: string): Promise<ServiceResponse>

    getAll(): Promise<ServiceResponse>

    limitOrder(
        orderType: OrderType.LimitBuy | OrderType.LimitSell, 
        exchangeId: ExchangeIds, 
        currencyPair: string, 
        size: number, 
        price: number, 
        parentId?: number
    ): Promise<ServiceResponse>

    cancelOrder(orderModel: ExchangeOrderModel): Promise<ServiceResponse>

    syncOrderPair(exResp: ExchangeOrder, orderModel: ExchangeOrderModel): Promise<ServiceResponse>

    getOrderLock(orderId: number, lockType: OrderLockType): Promise<ServiceResponse>

    unlockOrder(orderId: number): Promise<ServiceResponse>

    orderIsOpen(status: OrderStatus): boolean

    orderIsFilled(status: OrderStatus): boolean

    orderIsClosed(status: OrderStatus): boolean
}