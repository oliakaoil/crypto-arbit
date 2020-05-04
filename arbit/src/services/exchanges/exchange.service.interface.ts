import { ServiceResponse } from '../../service.response';
import { ExchangeIds, ExchangeLockType } from '../../enums/exchange.enum';
import { ExchangeTransferModel } from '../../models/exchange-transfer.model';
import { OrderType } from '../../enums/order.enum';
import { ExchangeTweaks } from './base.exchange.service';


export interface IExchangeService {

    getExchangeId(): ExchangeIds

    getFees(): { maker: number, taker: number }

    getTweaks(): ExchangeTweaks;

    getModel(): Promise<any>

    getApi(): any

    getAccounts(): Promise<ServiceResponse>

    getOrderById(orderId: string, currencyPair?: string): Promise<ServiceResponse>

    getAllOrders(): Promise<ServiceResponse>

    getOrderbook(currencyPair: string): Promise<ServiceResponse>

    getProductTicker(currencyPair: string): Promise<ServiceResponse>

    getAllProducts(): Promise<ServiceResponse>    

    makeWithdrawalFee(size: number): number;

    makeTakerFee(orderType: OrderType, currencyPair: string, size: number, price: number): number;

    limitOrder(orderType: OrderType, localId: string, currencyPair: string, size: number, price: number): Promise<ServiceResponse>

    cancelOrder(orderId: string): Promise<ServiceResponse>

    cryptoTransfer(transfer: ExchangeTransferModel): Promise<ServiceResponse>

    getExchangeLock(lockType: ExchangeLockType): Promise<ServiceResponse>
  
    unlockExchange(): Promise<ServiceResponse>
    
    makeLocalCurrencyPair(currencyPair: string): string;

    makeCurrencyPair(localCurrencyPair: string): string;
}