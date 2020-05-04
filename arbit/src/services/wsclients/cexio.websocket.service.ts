import * as  crypto from 'crypto';
import * as WebSocket from 'ws';

import { IWebSocketService } from './websocket.service.interface';
import { BaseWebSocketService } from './base.websocket.service';
import { ExchangeIds } from '../../enums/exchange.enum';
import { sleep } from '../../helpers';


export class CexioWebSocketService extends BaseWebSocketService implements IWebSocketService
{
    private config: any;

    constructor(opts)
    {
        super(opts);
        this.exchangeService = opts.cexioExchangeService;
        this.exchangeId = ExchangeIds.Cexio;
        this.wsUrl = opts.cexioConfig.wsUrl;
        this.config = opts.cexioConfig;
    }

    protected async getWsClient(): Promise<WebSocket>
    {
      return new WebSocket(this.wsUrl, {origin: 'wss://ws.cex.io', perMessageDeflate: false});      
    }    

    protected async onBeforeInitProducts(): Promise<boolean>
    {
        // make sure the auth message has time to be sent
        await sleep(2000);

        return true;
    }    

    public subscribeDiffOrders(currencyPair: string) : void
    {
        this.send({
            "e": "order-book-subscribe",
            "data": {
              "pair": currencyPair.split('-'),
              "subscribe": true,
              "depth": 30
            },
            "oid": Math.floor(Date.now() / 1000) + "_3_order-book-subscribe"
          });
    }

    public async onMessage(message: any): Promise<boolean>
    {
        switch(message.e) {

            // Play pingpong to keep the connection alive
            case 'ping':

                this.send({type: 'pong'});

            break;

            case 'connected':

                const sig = this.createSignature(this.config.apiKey, this.config.apiSecret);

                this.send({
                    "e": "auth",
                    "auth": {
                        "key": this.config.apiKey,
                        "signature": sig.signature,
                        "timestamp": sig.timestamp
                    }                    
                });
           
            break;

            case 'md_update':
                const data = message.data;
                const currencyPair = data.pair.replace(':','-');
                const sequence = data.id;

                data.bids.map(level => {
                    const price = level[0];
                    const size = level[1];
                    this.pushOrderbookUpdate(currencyPair, sequence, 'bid', price, size);
                });

                data.asks.map(level => {
                    const price = level[0];
                    const size = level[1];
                    this.pushOrderbookUpdate(currencyPair, sequence, 'ask', price, size);
                });


                // {
                //     e: 'md_update',
                //     data: {
                //       id: 247807036,
                //       pair: 'BTC:EUR',
                //       time: 1579498568167,
                //       bids: [],
                //       asks: [ [Array] ]
                //     }
                //   }
                  
            break;

        }

        return false;
    }    

    private createSignature(key: string, secret: string){
        const timestamp = Math.floor(Date.now() / 1000);
        var hmac = crypto.createHmac('sha256', secret );
        hmac.update(timestamp + key);
      
        return {
            timestamp,
            signature: hmac.digest('hex')
        };
      }    

}