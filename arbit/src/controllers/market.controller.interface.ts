import { OrderType } from '../enums/order.enum';
import { ExchangeOrderModel } from '../models/exchange-order.model';
import { ExchangeQuickFill, ExchangeOrderbook } from '../exchange.response';
import { ExchangeIds } from '../enums/exchange.enum';


export interface IMarketController {

    localizeOrderbookByRestAPI(exchangeId: ExchangeIds): Promise<boolean>

    smartGetOrderbook(
        exchangeId: ExchangeIds, 
        currencyPair: string
    ): Promise<ExchangeOrderbook>

    getOrderbookFromCache(
        exchangeId: ExchangeIds, 
        currencyPair: string
    ): Promise<ExchangeOrderbook>    

    convertVolumeStable(
        exchangeId: ExchangeIds,
        currencyPair: string,
        volume: number
    ): Promise<number>

    getStableConvertRate(
        currencyPair: string,
        skipPublic?: boolean,
        skipExchanges?: boolean
    ): Promise<{ rate: number, baseCurrency: string, quoteCurrency: string, source: string }>
}
