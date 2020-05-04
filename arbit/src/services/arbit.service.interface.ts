import { ServiceResponse } from '../service.response';
import { ExchangeProductModel } from '../models/exchange-product.model';
import { ExchangeIds } from '../enums/exchange.enum';
import { IExchangeService } from './exchanges/exchange.service.interface';
import { ExchangeTransferModel } from '../models/exchange-transfer.model';
import { TriangleArbitModel } from '../models/triangle-arbit.model';
import { TriangleArbitEstimate, TriangleArbitSet } from '../arbit.response';
import { IWebSocketService } from './wsclients/websocket.service.interface';


export interface IArbitService {

  getExchangeById(exchangeId: ExchangeIds): Promise<ServiceResponse>

  getActiveExchanges(): Promise<ServiceResponse>

  getAllProductsByExchangeId(exchangeId: ExchangeIds): Promise<ServiceResponse> 

  getArbitExchangeProducts(exchangeId: ExchangeIds): Promise<ServiceResponse>

  filterExchangeProducts(
    products: ExchangeProductModel[], 
    usdOnly: boolean,
    min24hrUsdVolume: number
  ): ExchangeProductModel[]  

  getProductByCurrencyPair(exchangeId: ExchangeIds, currencyPair: string): Promise<ServiceResponse>

  createTransfer(transferModel: ExchangeTransferModel): Promise<ServiceResponse>

  updateTransfer(transferModel: ExchangeTransferModel): Promise<ServiceResponse>

  upsertExchangeProduct(product: ExchangeProductModel): Promise<ServiceResponse>

  updateExchangeProductById(productId: number, attrs: any): Promise<ServiceResponse>

  incrementInsufficientFills(productId: number): Promise<ServiceResponse>

  createTriangleArbitFromEstimate(arbitEstimate: TriangleArbitEstimate, parentId?:number): Promise<ServiceResponse>

  createTriangleArbit(arbitModel: TriangleArbitModel): Promise<ServiceResponse>

  updateTriangleArbitById(arbitId: number, attrs: any): Promise<ServiceResponse>

  findSetsByExchange(exchangeId: ExchangeIds): Promise<TriangleArbitSet[]>
}
