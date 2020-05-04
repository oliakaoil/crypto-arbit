import * as md5 from 'md5';
import * as WebSocket from 'ws';

import { IWebSocketService } from './websocket.service.interface';
import { BaseWebSocketService } from './base.websocket.service';
import { ExchangeIds } from '../../enums/exchange.enum';


export class IdcmWebSocketService extends BaseWebSocketService implements IWebSocketService
{
    private config: any;

    constructor(opts)
    {
        super(opts);
        this.exchangeService = opts.idcmExchangeService;
        this.exchangeId = ExchangeIds.Idcm;
        this.config = opts.idcmConfig;
        this.wsUrl = opts.idcmConfig.wsUrl;
    }

    protected async getWsClient(): Promise<WebSocket>
    {
      return new WebSocket(this.wsUrl, {rejectUnauthorized: false});
    }    

    public async onOpen(): Promise<boolean>
    {
        const logId = `IdcmWebSocketService::onOpen |`;

        console.log('sending login event');

        this.send({
            event: 'login',
            parameters: {
                ApiKey: this.config.apiKey,
                Sign: this.createRequestSignature()
            }
        });

        return true;
  
    //     await this.onBeforeInitProducts();
  
    //     // at this point we should known which exchange we are, so load up the product and tarbit lists
    //     await this.initProducts();
  
    //     // TESTING
    //   //   this.products = [ 
    //   //     this.products[0], 
    //   //   ];
  
    //     this.logService.info(`${logId} subscribing to ${this.products.length} products`);
  
    //     for (let i=0;i<this.products.length; i++)
    //     {
    //       const exProduct = this.products[i];
    //       const currencyPair = exProduct.getCurrencyPair();
  
    //       await this.logService.debug(`${logId} ${currencyPair}`);
  
    //       this.initOrderbook(currencyPair);
  
    //       this.subscribeDiffOrders(currencyPair);
  
    //       this.initOrderbookQueueFlush(currencyPair);
    //     }
  
    //     this.initPersistOrderbooks();
  
    //     return true;
    }    

    public subscribeDiffOrders(currencyPair: string) : void
    {

    }

    public async onMessage(message: any): Promise<boolean>
    {
        console.log(message);

        // switch(message.type) {

        //     // Play pingpong to keep the connection alive
        //     case 'welcome':
        //     case 'pong':

        //         if (message.id !== this.clientId) {
        //             await this.logService.error(`KuCoinWebsocketService::onMessage | invalid clientId`);
        //             this.disconnect();
        //             return false;
        //         }

        //         await sleep(30 * 1000);
        //         this.send({id: this.clientId, type: 'ping'});

        //     break;

        //     case 'ack':
        //         // acknowledge a subscription, clientId will match subscription send id
        //         // security check?
        //     break;

        //     case 'message':
        //         const data = message.data;
        //         if (message.subject === 'trade.l2update') {
 
        //             const sides = ['ask','bid'];

        //             for (let i=0; i<sides.length; i++) {
        //                 const side: any = sides[i];
        //                 const changes = data.changes[`${side}s`];

        //                 for(let j=0; j<changes.length;j++) {
        //                     const change = changes[j];
        //                     const price: number = Number(change.shift());
        //                     const size: number = Number(change.shift());
        //                     const sequence: number = Number(change.shift());

        //                     this.pushOrderbookUpdate(data.symbol, sequence, side, price, size);
        //                 }
        //             }
        //         }
        //     break;

        //     default:
        //         console.log('unknown message');
        //         console.log(message);

        // }

        return false;
    }        

    private createRequestSignature(): string
    {
        return md5(`apikey=${this.config.apiKey}&secret_key=${this.config.apiSecret}`);
        // Sign uses MD5 encryption. The encryption method is as follows:
        // Splice apikey={your apikey}&secret_key={your secretkey} for MD5,Result capitalization.

    }
}