import { IWebSocketService } from './websocket.service.interface';
import { BaseWebSocketService } from './base.websocket.service';
import { ExchangeIds } from '../../enums/exchange.enum';

import * as signalR from 'signalr-client';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import * as util from 'util';
import { sleep } from '../../helpers';
import { ExchangeOrderbook, ExchangeOrderbookLevel } from '../../exchange.response';
const zlibInflateRaw = util.promisify(zlib.inflateRaw);

// https://gist.github.com/flavioespinoza/a69dacfac67739c26b30dab4bbddaf6b
// https://github.com/Bittrex/beta/blob/master/samples/WebsocketSample.js

export class BittrexWebSocketService extends BaseWebSocketService implements IWebSocketService
{
    private signalrClient: signalR;
    private config: any;

    constructor(opts)
    {
        super(opts);
        this.exchangeService = opts.bittrexExchangeService;
        this.exchangeId = ExchangeIds.Bittrex;
        this.config = opts.bittrexWsConfig;
    }

    public async connect(): Promise<boolean> 
    {
        const self = this;
        const logId = `BittrexWebSocketService::connect |`

        this.signalrClient = new signalR.client(this.config.url, ['c2']);

        this.signalrClient.serviceHandlers.connected = () => {

            self.connected = true;

            // authentication context
            this.signalrClient.call('c2', 'GetAuthContext', this.config.apiKey)
                .done(function(err, challenge) {
                    if (err) {
                        this.logService.error(`${logId} GetAuthContext error`, err);
                        return;
                    }

                    // sign the challenge we just got back from the auth context call
                    const signedChallenge = self.sign(challenge);

                    /** Authenticate */
                    self.signalrClient.call('c2', 'Authenticate', self.config.apiKey, signedChallenge)
                        .done(function(err, result) {

                            if (err) {
                                this.logService.error(`${logId} Authenticate error`, err);
                            }

                            if (result === true)
                                self.onOpen();
                        })
                });
        };

        await sleep(5000);

        return true;
    }

    public subscribeDiffOrders(currencyPair: string) : void
    {
        const logId = `BittrexWebsocketService::subscribeDiffOrders | cp ${currencyPair}`;

        const localCurrencyPair = this.exchangeService.makeLocalCurrencyPair(currencyPair);

        this.signalrClient.call('c2', 'SubscribeToExchangeDeltas', localCurrencyPair)
            .done((err, result) => {

                if (err) {
                    this.logService.error(`${logId} SubscribeToExchangeDeltas error`, err);
                    return;
                }

                if (result !== true) {
                    this.logService.error(`${logId} result is not true`);
                }

                this.signalrClient.on('c2', 'uE', async (message: string) => {

                    const messageBuffer = Buffer.from(message, 'base64');

                    try {
            
                        const inflated: any = await zlibInflateRaw(messageBuffer);
                        const payload = JSON.parse(inflated.toString('utf8'));
            
                        const data = {
                            market: this.exchangeService.makeCurrencyPair(payload.M),
                            sequence: payload.N,
                            changes: []
                        };
            
                        const makeLevelUpdate = (side: 'ask'|'bid', change: any): {
                            side: 'ask'|'bid',
                            price: number,
                            size: number
                        } => {
            
                            const action = change.TY; // 0 = Add, 1 = Remove, 2 = Update
            
                            return {
                                side,
                                price: change.R,
                                size: (action === 1 ? 0 : change.Q)
                            };                
                        };
            
                        if (payload.Z && payload.Z.length)
                            data.changes = data.changes.concat(payload.Z.map(change => makeLevelUpdate('bid', change)));
                                
                        if (payload.S && payload.S.length)
                            data.changes = data.changes.concat(payload.S.map(change => makeLevelUpdate('ask', change)));
            
                        data.changes.map(change => {
                            this.pushOrderbookUpdate(data.market, data.sequence, change.side, change.price, change.size);
                        });

                        // no change, just update sequence
                        if (!data.changes.length) {
                            this.pushOrderbookUpdate(data.market, data.sequence, 'ask', 0, 0);
                        }

            
                        // {
                        //     M: 'BTC-LTC',
                        //     N: 78978,
                        //     Z: [
                        //       { TY: 1, R: 0.0075673, Q: 0 },
                        //       { TY: 0, R: 0.00756332, Q: 14.106 }
                        //     ],
                        //     S: [],
                        //     f: []
                        //   }
                            
            
                    } catch (err) {
            
                        await this.logService.error(`BittrexWebsocketService::onExchangeDelta`, err);
                        return;
                    }                        
                });


                // Now that we are successfully subscribed to deltas we can safely prime the orderbook
                const orderbook = this.orderbooks.get(currencyPair);
                if (!orderbook.primed) {
                    this.primeOrderbook(currencyPair);
                }
            });
    }

    public async onMessage(message: any): Promise<boolean>
    {


        return false;
    }    

    public subscribe(channelName: string): boolean
    {

        return true;
    }

    protected async resetOrderbook(currencyPair: string): Promise<boolean>
    {  
      this.initOrderbook(currencyPair);
  
      this.primeOrderbook(currencyPair);
  
      this.initOrderbookQueueFlush(currencyPair);
  
      return true;
    }    

   

    /*
     * For some reason bittrex can send multiple orderbook changes with a single sequence number
     */    
    protected validateIncomingSequence(sequence: number, orderbook: ExchangeOrderbook)
    {
        if (sequence === orderbook.sequence)
            return true;

        return ((sequence - 1) === orderbook.sequence);
    }    

    protected incomingSequenceOutdated(sequence: number, orderbook: ExchangeOrderbook): boolean
    {
      return (sequence < orderbook.sequence);
    }    

    private sign(challenge) : string 
    {
        return crypto.createHmac('sha512', this.config.secret)
          .update(challenge)
          .digest('hex');
    }    

    private async primeOrderbook(currencyPair: string): Promise<boolean>
    {
      const logId = `BittrexWebsocketService::primeOrderbook | ${currencyPair} |`;
      const orderbook = this.orderbooks.get(currencyPair);
      const localCurrencyPair = this.exchangeService.makeLocalCurrencyPair(currencyPair);
  
      // prime the order book so we have a base to apply the order diffs
      this.signalrClient.call('c2', 'QueryExchangeState', localCurrencyPair)
        .done(async (err, response) => {
            if (err) {
                this.logService.error(`${logId} QueryExchangeState error`, err);
                return;
            }

            try {

                const message = Buffer.from(response, 'base64');
                const inflated: any = await zlibInflateRaw(message);
                const payload = JSON.parse(inflated.toString('utf8'));           
                
                orderbook.sequence = payload.N;

                orderbook.asks = payload.S.map(m => new ExchangeOrderbookLevel(m.R, m.Q));
                orderbook.bids = payload.Z.map(m => new ExchangeOrderbookLevel(m.R, m.Q));

                orderbook.primed = true;

                this.orderbooks.set(currencyPair, orderbook);               
  
            } catch(err) {
                this.logService.error(`${logId} | unable to decompress exchange state payload`, err);
            }
        });      
  
        return true;
    }     
}