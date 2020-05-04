import { IWebSocketService } from './websocket.service.interface';
import { BaseWebSocketService } from './base.websocket.service';
import { sleep } from '../../helpers';
import { ExchangeOrderbook, ExchangeOrderbookLevel } from '../../exchange.response';
import { ExchangeIds } from '../../enums/exchange.enum';
import { Exchange } from 'ccxt';
import { ServiceResponse } from '../../service.response';


export class CoinexWebSocketService extends BaseWebSocketService implements IWebSocketService
{
    private id: number = 15;
    private currencyPairMap: Map<string,string> = new Map();

    constructor(opts)
    {
        super(opts);
        this.exchangeId = ExchangeIds.Coinex;
        this.exchangeService = opts.coinexExchangeService;
        this.wsUrl = opts.coinexConfig.wsUrl;
    }

    public async onOpen(): Promise<boolean>
    {
        const logId = `CoinexWebsocketService::onOpen |`;

        this.sendPing();
  
        await this.initProducts();

        // TESTING
        //this.products = this.products.filter(p => ['XRP-USDT','XTZ-BTC'].indexOf(p.getCurrencyPair()) >-1);
    
        this.logService.info(`${logId} subscribing to ${this.products.length} products`);

        const productSubs: any[] = [];
  
        for (let i=0; i < this.products.length; i++)
        {
          const exProduct = this.products[i];
          const currencyPair = exProduct.getCurrencyPair();
          const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

          this.currencyPairMap.set(localCurrencyPair, currencyPair);
  
          await this.logService.debug(`${logId} ${currencyPair}`);

          this.initOrderbook(currencyPair);

          productSubs.push([
            localCurrencyPair, // #1.market: See<API invocation description·market> 
              10, // #2.limit: Count limit
              "0" // #3.interval: Merge，String
          ]);

          this.initOrderbookQueueFlush(currencyPair); 
        }

        // https://github.com/coinexcom/coinex_exchange_api/wiki/044depth
        // https://www.jsonrpc.org/specification_v1
        this.send({
          method: "depth.subscribe_multi",
          params: productSubs,
          id: this.id++
        });                

        this.initPersistOrderbooks();

        return true;
    }

    protected async resetOrderbook(currencyPair: string): Promise<boolean>
    {
        /* 
         * Coinex seems to have not implemented unsubscribing from their depth channels. There is nothing in
         * the documentation about unsubscribing, and the CCXWS method of unsubbing:
         * 
         * https://github.com/altangent/ccxws/blob/master/src/exchanges/coinex-client.js#L143
         * 
         * causes a disconnect from the WS all-together.
         */

        // decrement reconnect count, since this is a "normal" reconnect, and not an error reconnect
        this.reconnectCount -= 1;         

        this.send({
            method: "depth.unsubscribe"
        });        
  
        return true;
    }    

    public async onMessage(message: any): Promise<boolean>
    {
        const logId = `CoinexWebsocketService::onMessage |`;

        if (message.error) 
            this.logService.error(`${logId} response error`, message.error);        

        switch (message.id) {

            // ping response, play some ping pong
            case 11:
                await sleep(10000);
                return this.sendPing();

            // depth.update response, init the orderbook
            case 15:
                return true;
        }

        switch (message.method) {

            case 'depth.update':

                const isFullUpdate = message.params[0];
                const orderbookData = message.params[1];
                const localCurrencyPair = message.params[2];
                const currencyPair = this.makeCurrencyPair(localCurrencyPair);

                // The first update will be a full update so we can prime, subsequent updates will be diffs
                if (isFullUpdate) {

                    const orderbook = this.orderbooks.get(currencyPair);

                    orderbook.timestamp = orderbookData.time;

                    orderbook.bids = orderbookData.bids.map(update => new ExchangeOrderbookLevel(Number(update[0]), Number(update[1])));
                    orderbook.asks = orderbookData.asks.map(update => new ExchangeOrderbookLevel(Number(update[0]), Number(update[1])));

                    orderbook.primed = true;
  
                    this.orderbooks.set(currencyPair, orderbook);

                    return true;
                }

                if (orderbookData.bids) {
                    orderbookData.bids.map(update => {
                        this.pushOrderbookUpdate(currencyPair, orderbookData.time, 'bid', Number(update[0]), Number(update[1]));
                    });
                }

                if (orderbookData.asks) {
                    orderbookData.asks.map(update => {
                        this.pushOrderbookUpdate(currencyPair, orderbookData.time, 'ask', Number(update[0]), Number(update[1]));
                    });
                }                

                // {
                //     method: 'depth.update',
                //     params: [
                //       false,
                //       {
                //         asks: [Array],
                //         bids: [Array],
                //         last: '6684.94',
                //         time: 1585242299284,
                //         checksum: 1380272942
                //       },
                //       'BTCUSDC'
                //     ],
                //     id: null
                //   }


            break;
            
            default:
                console.log('unknown message');
                console.log(message);

        }

        return false;
    }    

    protected validateIncomingSequence(sequence: number, orderbook: ExchangeOrderbook): boolean
    {
      return (sequence > orderbook.timestamp);
    }

    protected incomingSequenceOutdated(sequence: number, orderbook: ExchangeOrderbook): boolean
    {
      return (sequence <= orderbook.timestamp);
    }      
 
    private sendPing(): boolean 
    {
        return this.send({
            "method":"server.ping",
            "params":[],
            "id": 11
           });
    }    

    private makeCurrencyPair(localCurrencyPair: string): string
    {
        return this.currencyPairMap.get(localCurrencyPair);
    }

    private makeLocalCurrencyPair(currencyPair:string): string
    {
        return currencyPair.replace(/[\-\\\/]+/g,'');
    }    
}
