import { ServiceResponse } from '../service.response';
import { ExchangeOrderbook } from '../exchange.response';


export interface IExchangeOrderbookService {

  getByProductId(productId: number): Promise<ServiceResponse>

  removeAllLevelsByProductId(productId: number): Promise<boolean>

  initOrderbook(orderbook: ExchangeOrderbook): Promise<boolean> 

  deleteOrderbookLevel(productId: number, side: 'ask'|'bid', price: number): Promise<boolean>

  upsertOrderbookLevel(productId: number, side: 'ask'|'bid', price: number, size: number): Promise<boolean>
}
