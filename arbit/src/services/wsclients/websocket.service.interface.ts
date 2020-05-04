import { ExchangeOrderbook } from '../../exchange.response';
import { ExchangeIds } from '../../enums/exchange.enum';

export interface IWebSocketService {

    getExchangeId(): ExchangeIds

    connect(): Promise<boolean>

    disconnect(): Promise<boolean>

    isConnected(): boolean

    onBeforeConnect(): Promise<boolean>

    onOpen(): Promise<boolean>

    onMessage(data: any): Promise<boolean>

    send(message: any): boolean

    subscribe(channelName: string): boolean
}