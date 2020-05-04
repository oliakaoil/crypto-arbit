import { IWebSocketService } from './websocket.service.interface';
import { BaseWebSocketService } from './base.websocket.service';
import { ExchangeIds } from '../../enums/exchange.enum';
import { ExchangeOrderbook, ExchangeOrderbookLevel } from '../../exchange.response';
import { sleep } from '../../helpers';


export class BilaxyWebSocketService extends BaseWebSocketService implements IWebSocketService
{
    constructor(opts)
    {
        super(opts);
        this.exchangeService = opts.bilaxyExchangeService;
        this.exchangeId = ExchangeIds.Bilaxy;
        this.wsUrl = opts.bilaxyConfig.wsUrl;
    }  

    public async onMessage(message: any): Promise<boolean>
    {            

        console.log(message);

        switch (message.event) {
        }

        return true;
    }      
    

    protected subscribeDiffOrders(currencyPair: string): void
    {

    }       
}