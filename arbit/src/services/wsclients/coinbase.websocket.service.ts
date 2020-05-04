import { IWebSocketService } from './websocket.service.interface';
import { BaseWebSocketService } from './base.websocket.service';
import { ExchangeIds } from '../../enums/exchange.enum';
import { ExchangeOrderbook, ExchangeOrderbookLevel } from '../../exchange.response';
import { sleep } from '../../helpers';


export class CoinbaseWebSocketService extends BaseWebSocketService implements IWebSocketService {

  // coinbase level 2 channel guarantees delivery of all updates, so there is no reason to worry about out-of-sequence messages
  private sequence: Map<string, number>;

  constructor(opts)
  {
    super(opts);
    this.exchangeService = opts.coinbaseExchangeService;
    this.exchangeId = ExchangeIds.Coinbase;
    this.wsUrl = opts.coinbaseConfig.wsUrl;
    this.sequence = new Map();
  }

  public subscribeDiffOrders(currencyPair: string) : void
  {
    const subscribeData = {
        type: "subscribe",
        product_ids: [currencyPair],
        channels: ["level2"]
    };

    this.send(subscribeData);
  }

  protected async initOrderbook(currencyPair: string): Promise<boolean>
  {
    // initialization from scratch is handled by the snapshot message below

    // reset due to fall-behind or other issue
    let orderbook = this.orderbooks.get(currencyPair);

    if (orderbook) {
        this.send({
            type: "unsubscribe",
            product_ids: [ currencyPair ],
            channels: ["level2"]            
        });

        this.orderbooks.set(currencyPair, null);

        // give the websocket a little time to process the unsubscribe message
        await sleep(2000);

        this.subscribeDiffOrders(currencyPair);
    }

    return true;       
  }  

  public async onMessage(message: any): Promise<boolean>
  {
    let currencyPair: string;

    switch(message.type) {

        case 'heartbeat':
            // @todo verification, health check, etc.
            // Assuming that if we connect and get a hearbeat, the socket service must be healthy, so reset the reconnect counter
            this.reconnectCount = 0;                    
        break; 

        case 'snapshot':

            currencyPair = message.product_id;

            const orderbook = new ExchangeOrderbook(ExchangeIds.Coinbase, currencyPair);

            message.asks.map(level => {
                orderbook.asks.push(new ExchangeOrderbookLevel(level[0], level[1]));
            });

            message.bids.map(level => {
                orderbook.bids.push(new ExchangeOrderbookLevel(level[0], level[1]));
            });            

            orderbook.primed = true;
            orderbook.dequeueing = false;

            orderbook.sequence = 0;
            this.sequence.set(currencyPair,1);

            this.orderbooks.set(currencyPair, orderbook);

            this.initOrderbookQueueFlush(currencyPair);

        break;

        case 'l2update':

            currencyPair = message.product_id;

            let sequenceVal = this.sequence.get(currencyPair);
            this.sequence.set(currencyPair, sequenceVal + 1);
            
            message.changes.map(change => {
                let side = change.shift();
                side = (side === 'buy' ? 'bid' : 'ask');
                const price = change.shift();
                const size = change.shift();
                
                this.pushOrderbookUpdate(currencyPair, sequenceVal, side, price, size);
            });
 
            
        break;
    }

    return true;
  }

}

/*

  // Coinbase docs are less than great:
  // https://docs.pro.coinbase.com/#websocket-feed

    // Order was received by the order book
    {
        type: 'received',
        order_id: 'aa977cd4-d887-4c21-b8fa-22a2e70a09ef',
        order_type: 'limit',
        size: '0.01000000',
        price: '7361.25000000',
        side: 'buy',
        client_oid: '80a0017e-1deb-47ee-867e-04619d542bad',
        product_id: 'BTC-USD',
        sequence: 54256443,
        user_id: '593c2b73d59e1ca2c660e780',
        profile_id: 'f91449d7-de8d-411d-96b7-3f7f2f3df13c',
        time: '2019-07-30T02:41:02.159000Z'
    }    

    // Order is now open on the order book
    {
        type: 'open',
        side: 'buy',
        price: '7361.25000000',
        order_id: 'aa977cd4-d887-4c21-b8fa-22a2e70a09ef',
        remaining_size: '0.00900000',
        product_id: 'BTC-USD',
        sequence: 54256446,
        user_id: '593c2b73d59e1ca2c660e780',
        profile_id: 'f91449d7-de8d-411d-96b7-3f7f2f3df13c',
        time: '2019-07-30T02:41:02.159000Z'
    }    

    // Trade was cancelled
    {
        type: 'done',
        side: 'sell',
        order_id: '3e0e0a51-ba1e-441b-a71e-ca5dc3ff15de',
        reason: 'canceled',
        product_id: 'BTC-USD',
        price: '99.99000000',
        remaining_size: '0.01000000',
        user_id: '593c2b73d59e1ca2c660e780',
        profile_id: 'f91449d7-de8d-411d-96b7-3f7f2f3df13c',
        time: '2019-07-30T02:46:42.452000Z'
    }

    // Trade was completely filled
    {
        type: 'done',
        side: 'buy',
        order_id: 'aa977cd4-d887-4c21-b8fa-22a2e70a09ef',
        reason: 'filled',
        product_id: 'BTC-USD',
        price: '7361.25000000',
        remaining_size: '0',
        sequence: 54257242,
        user_id: '593c2b73d59e1ca2c660e780',
        profile_id: 'f91449d7-de8d-411d-96b7-3f7f2f3df13c',
        time: '2019-07-30T03:08:21.781000Z'
    }                    

    // full/partial fill
    {
        type: 'match',
        trade_id: 4671614,
        maker_order_id: 'a68588f4-7c17-4172-876a-864417d81d30',
        taker_order_id: 'd897406d-3e51-4c86-9524-ae64126e0b80',
        side: 'buy',
        size: '0.00100000',
        price: '7355.00000000',
        product_id: 'BTC-USD',
        sequence: 54256426,
        time: '2019-07-30T02:39:48.753000Z'        
    }

    // full/partial fill
    {
        type: 'last_match',
        trade_id: 4671613,
        maker_order_id: 'a68588f4-7c17-4172-876a-864417d81d30',
        taker_order_id: 'd7e32df6-eb42-4ca0-bd73-d9eb0c8d1d66',
        side: 'buy',
        size: '0.00100000',
        price: '7355.00000000',
        product_id: 'BTC-USD',
        sequence: 54256421,
        time: '2019-07-30T02:39:27.348000Z'
    }      
*/