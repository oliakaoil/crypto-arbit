import { ExchangeProductModel } from '../models/exchange-product.model';
import { ExchangeMetaModel } from '../models/exchange-meta.model';
import { ExchangeTransferModel } from '../models/exchange-transfer.model';
import { ExchangeIds, ExchangeLockType } from '../enums/exchange.enum';
import { ExchangeModel } from '../models/exchange.model';


export interface IExchangeRepo {

  getById(exchangeId: ExchangeIds): Promise<ExchangeModel>

  getActive(): Promise<ExchangeModel[]>

  getAllProductsByExchangeId(exchangeId: ExchangeIds): Promise<ExchangeProductModel[]>

  getProductByCurrencyPair(exchangeId: ExchangeIds, currencyPair: string): Promise<ExchangeProductModel>

  findProductByCurrency(bases: string[], quotes: string[]): Promise<ExchangeProductModel[]>

  getAllProductsByBase(currency: string, exchangeId: ExchangeIds): Promise<ExchangeProductModel[]>

  createTransfer(transferModel: ExchangeTransferModel): Promise<ExchangeTransferModel>

  updateTransfer(transferModel: ExchangeTransferModel): Promise<ExchangeTransferModel>

  upsertExchangeProduct(product: ExchangeProductModel): Promise<boolean>

  updateExchangeProductById(productId: number, attrs: any): Promise<boolean>

  incrementInsufficientFills(productId: number): Promise<boolean>

  getExchangeLock(exchangeId: number, lockType: ExchangeLockType): Promise<boolean>

  unlockExchange(exchangeId: number): Promise<boolean>
}