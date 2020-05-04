import { IWebSocketService } from './websocket.service.interface';
import { BaseWebSocketService } from './base.websocket.service';
import { ExchangeIds } from '../../enums/exchange.enum';
import { ExchangeOrderbook, ExchangeOrderbookLevel } from '../../exchange.response';
import { sleep } from '../../helpers';


export class BitforexWebSocketService extends BaseWebSocketService implements IWebSocketService
{
    constructor(opts)
    {
        super(opts);
        this.exchangeService = opts.bitforexExchangeService;
        this.exchangeId = ExchangeIds.Bitforex;
        this.wsUrl = opts.bitforexConfig.wsUrl;
    }  

    public async onOpen(): Promise<boolean>
    {
        const logId = `BitforexWebSocketService::onOpen |`;

        // Start playing pingpong
        this.wsClient.on('pong', async (response) => {
            await sleep(10000);
            this.wsClient.ping();
        });
        this.wsClient.ping();


        /* 
         * Bitforex seems to normally close the connection once every 2 minutes, so repeated re-connection 
         * is a requirement. Rather than simply throwing a warning and triggering the normal reconnect 
         * process, detect "normal" connection closes and be sure to not count them towards reconnect attempts.
         * 
         * https://meta.stackexchange.com/questions/269419/my-chat-websockets-are-getting-closed-what-gives
         * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
         */
        this.wsClient.removeAllListeners('close');
        this.wsClient.on('close', async (err) => {

            this.connected = false;

            // 1000 = Normal closure
            if (err === 1000) {

                await sleep(8000);

                // decrement reconnect count, since this is a "normal" reconnect, and not an error reconnect
                this.reconnectCount -= 1;

                this.connect();

                return;
            }

            this.logService.warn(`${logId} closed ${this.wsUrl}`, err);
    
            await sleep(this.reconnectWaitMs);

            this.connect();
        });
    
  
        await this.initProducts();
    
        this.logService.info(`${logId} subscribing to ${this.products.length} products`);
  
        for (let i=0;i<this.products.length; i++)
        {
          const exProduct = this.products[i];
          const currencyPair = exProduct.getCurrencyPair();
  
          this.initOrderbook(currencyPair);
          
          this.subscribeDiffOrders(currencyPair);
        }
  
        this.initPersistOrderbooks();
  
        return true;
    }    

    public async onMessage(message: any): Promise<boolean>
    {            
        switch (message.event) {
            case 'depth10':
                // seems to be sending the entire orderbook, not just diffs
                if (!message.data)
                    return;

                const localCurrencyPair = message.param.businessType;
                const currencyPair = this.makeCurrencyPair(localCurrencyPair);

                const orderbook = this.orderbooks.get(currencyPair);

                orderbook.primed = true;
                orderbook.dequeueing  = false;

                if (message.data.asks)
                    orderbook.asks = message.data.asks.map(level => new ExchangeOrderbookLevel(level.price, level.amount));

                if (message.data.bids)
                    orderbook.bids = message.data.bids.map(level => new ExchangeOrderbookLevel(level.price, level.amount));

            break;
        }

        return true;
    }      
    
    protected makeLocalCurrencyPair(currencyPair: string): string
    {
        const pairParts = currencyPair.split('-');
        const quoteCurrency = pairParts.shift();
        const baseCurrency = pairParts.join('-');

        return String(`coin-${baseCurrency}-${quoteCurrency}`).toLowerCase();
    }

    protected makeCurrencyPair(localCurrencyPair: string): string
    {
        const pairParts = localCurrencyPair.split('-');
        pairParts.shift(); // coin-btc-abbc
        const quoteCurrency = pairParts.shift();
        const baseCurrency = pairParts.shift();
        return String(`${baseCurrency}-${quoteCurrency}`).toUpperCase();
    }

    protected subscribeDiffOrders(currencyPair: string): void
    {
        this.send([{
            "type": "subHq",
            "event": "depth10",
            "param": { 
                "businessType": this.makeLocalCurrencyPair(currencyPair), 
                "dType": 0
        }}]);
    }       
}