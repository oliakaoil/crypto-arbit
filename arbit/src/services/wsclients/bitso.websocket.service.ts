import { IWebSocketService } from './websocket.service.interface';
import { BaseWebSocketService } from './base.websocket.service';
import { sleep } from '../../helpers';
import * as uuidv4 from 'uuid/v4';


export class BitsoWebsocketService extends BaseWebSocketService implements IWebSocketService
{
    constructor(opts)
    {
        super(opts);
        this.exchangeService = opts.bsExchangeService;
        this.wsUrl = opts.bsWebsocketConfig.url;
    }

    protected subscribeDiffOrders(currencyPair: string): void
    {
        const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

        // 1. Start recording order diffs for this currency and queuing the response
        this.send({ action: 'subscribe', book: localCurrencyPair, type: 'diff-orders' });
    }

    public async onMessage(message: any): Promise<boolean>
    {
        switch(message.type) {

            case 'ka':
                // seems to be hearbeat, but no docs on playing pingpong, etc.
                return;

            case 'diff-orders':
                if (message.action === 'subscribe')
                    return;

                const payloads = message.payload;

                for(let i=0; i<payloads.length;i++)
                {
                    const payload = payloads[i];

                    const symbol = this.makeCurrencyPair(message.book);
                    const side = (payload.t === 1 ? 'ask' : 'bid');

                    const action = payload.s; // open|cancelled
                    const price = Number(payload.r);
                    const size = (action === 'cancelled' ? 0 : Number(payload.a));
                    

                    /*
                    {
                    type: 'diff-orders',
                    book: 'btc_mxn',
                    payload: [
                    // {
                    // o: 'ZdgKTVKqPL4aQ9HN',  // orderId
                    // r: 0.00003132,          // rate (price?)
                    // a: 159.64240102,        // amount (size?)
                    // v: 0.005,               // value
                    // t: 1,                   // 0 = buy, 1 = sell
                    // d: 1572627464487,       // timestamp
                    // s: 'undefined'
                    // },
                    ],
                    sequence: 290278784
                    }
                    */

                    //console.log(payload);
                    //console.log(`symbol: ${symbol} | sequence: ${message.sequence} | side: ${side} | price: ${price} | size: ${size}`);


                    this.pushOrderbookUpdate(symbol, message.sequence, side, price, size);
                }
            break;
            
            default:
                console.log('unknown message');
                console.log(message);

        }

        return false;
    }    

    private makeLocalCurrencyPair(currencyPair: string) : string
    {
        return currencyPair.replace('-','_').toLowerCase();
    }

    private makeCurrencyPair(localCurrencyPair: string) : string
    {
        return localCurrencyPair.replace('_','-').toUpperCase();
    }
}



/*

    private async onOrderDiffMessage(data: any, useQueue: boolean = true): Promise<boolean>
    {
        if (!data.book)
            return true;

        const currencyPair = this.exchangeService.makeCurrencyPair(data.book);
        const payload = data.payload[0];
        const sideStr = (payload.t === 0 ? 'bids' : 'asks');
        const orderbookPrimed = Boolean(this.orderbook[currencyPair]);

        console.log(`received ${currencyPair} ${payload.s} ${payload.o}`);

        if (!this.orderDiffQueue[currencyPair])
            this.orderDiffQueue[currencyPair] = [];

        // the order book is not primed, so this message should be queued
        if (!orderbookPrimed) {
            console.log(`queueing ${currencyPair} ${payload.s} ${payload.o}`);
            this.orderDiffQueue[currencyPair].push(data);
            return true;
        }

        // the order book is primed, but there are messages in the queue, so this message cannot be 
        // processed, add it to the queue and then attempt to flush the queue
        if (this.orderDiffQueue[currencyPair].length && useQueue) {
            

            console.log(`queueing ${currencyPair} ${payload.s} ${payload.o}`);
            this.orderDiffQueue[currencyPair].push(data);

            console.log(`attempting to flush ${this.orderDiffQueue[currencyPair].length} order diff queue messages`);

            while (this.orderDiffQueue[currencyPair].length) {
                const data = this.orderDiffQueue[currencyPair].shift();
                this.onOrderDiffMessage(data, false);
            }

            return true;
        }



        const orderbook = this.orderbook[currencyPair][sideStr];
        const orderIndex = orderbook.findIndex(o => o.o === payload.o);

        switch (payload.s) {
            case 'open':

                if (orderIndex !== -1)
                    this.orderbook[currencyPair][sideStr][orderIndex] = payload;
                else
                    this.orderbook[currencyPair][sideStr].push(payload);

            break;
            
            case 'cancelled':
            case 'completed':
                // the assumption here is that since we only have the top 20 fills in the order book for either side, this order was 
                // not found because its not in the top 20
                if (orderIndex === -1)
                    return true;

                delete this.orderbook[currencyPair][sideStr][orderIndex];
                this.orderbook[currencyPair][sideStr] = this.orderbook[currencyPair][sideStr].filter(o => o);
                
            break;

            default:
                await this.logService.error(`Unknown order diff action ${payload.s}`, payload);
                process.exit();
        }

        this.updateTArbitEstimates(currencyPair);

        return true;
    }
*/