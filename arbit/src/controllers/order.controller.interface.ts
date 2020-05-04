import { OrderType } from '../enums/order.enum';
import { ExchangeOrderModel } from '../models/exchange-order.model';
import { ExchangeQuickFill, ExchangeOrderbook } from '../exchange.response';
import { ExchangeIds } from '../enums/exchange.enum';


export interface IOrderController {

    limitOrder(
        exchangeId: ExchangeIds, 
        orderType: OrderType.LimitBuy|OrderType.LimitSell,
        currencyPair: string,
        size?: number,
        funds?: number,
        price?: number
    ) : Promise<ExchangeOrderModel>;

    syncOrderById(orderId: number): Promise<ExchangeOrderModel>;

    cancelOrder(): Promise<boolean>;

    getQuickFill(
        exchangeId: ExchangeIds,
        currencyPair: string,
        size?: number,
        funds?: number
    ): Promise<ExchangeQuickFill>;
}
