import { ExchangeOrderbookModel } from '../models/exchange-orderbook.model';
import { ExchangeProductModel } from '../models/exchange-product.model';


export interface IExchangeOrderbookRepo {

    getByProductId(productId: number): Promise<ExchangeOrderbookModel[]>

    removeAllLevelsByProductId(productId: number): Promise<boolean>

    deleteOrderbookLevel(productId: number, side: 'ask'|'bid', price: number): Promise<boolean>

    upsertOrderbookLevel(productId: number, side: 'ask'|'bid', price: number, size: number)
}