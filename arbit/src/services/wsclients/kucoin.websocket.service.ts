import { IWebSocketService } from './websocket.service.interface';
import { BaseWebSocketService } from './base.websocket.service';
import { sleep } from '../../helpers';
import * as uuidv4 from 'uuid/v4';
import { ExchangeIds } from '../../enums/exchange.enum';


export class KuCoinWebsocketService extends BaseWebSocketService implements IWebSocketService
{
    private clientId: string;

    constructor(opts)
    {
        super(opts);
        this.exchangeService = opts.kucoinExchangeService;
        this.exchangeId = ExchangeIds.KuCoin;
    }

    public async onBeforeConnect(): Promise<boolean>
    {
        try {

            this.clientId = uuidv4();

            const response = await this.exchangeService.getApi().public_post_bullet_public();

            const wsHost = response.data.instanceServers
                .filter(s => s.protocol === 'websocket')
                .pop();

            this.wsUrl = `${wsHost.endpoint}?token=${response.data.token}&acceptUserMessage=true&connectId=${this.clientId}`;

        } catch (err) {
            await this.logService.error(`KuCoinWebsocketService::onBeforeConnect | unable to get token and ws URL from API`);
            return false;
        }


        return true;
    }

    public subscribeDiffOrders(currencyPair: string) : void
    {
        this.subscribe(`/market/level2:${currencyPair}`);
    }

    public async onMessage(message: any): Promise<boolean>
    {
        switch(message.type) {

            // Play pingpong to keep the connection alive
            case 'welcome':
            case 'pong':

                if (message.id !== this.clientId) {
                    await this.logService.error(`KuCoinWebsocketService::onMessage | invalid clientId`);
                    this.disconnect();
                    return false;
                }

                await sleep(30 * 1000);
                this.send({id: this.clientId, type: 'ping'});

            break;

            case 'ack':
                // acknowledge a subscription, clientId will match subscription send id
                // security check?
            break;

            case 'message':
                const data = message.data;
                if (message.subject === 'trade.l2update') {
 
                    const sides = ['ask','bid'];

                    for (let i=0; i<sides.length; i++) {
                        const side: any = sides[i];
                        const changes = data.changes[`${side}s`];

                        for(let j=0; j<changes.length;j++) {
                            const change = changes[j];
                            const price: number = Number(change.shift());
                            const size: number = Number(change.shift());
                            const sequence: number = Number(change.shift());

                            this.pushOrderbookUpdate(data.symbol, sequence, side, price, size);
                        }
                    }
                }
            break;

            default:
                console.log('unknown message');
                console.log(message);

            /*
            onMessage
            {
            data: {
                sequenceStart: 1568367435049,
                symbol: 'ETH-USDT',
                changes: { asks: [], bids: [ [ '0', '0', '1568368471597' ] ] }, // price, size, sequence
                sequenceEnd: 1568367435049
            },
            subject: 'trade.l2update',
            topic: '/market/level2:ETH-USDT',
            type: 'message'
            }
            onMessage
            {
            data: {
                sequenceStart: 1568367435050,
                symbol: 'ETH-USDT',
                changes: { asks: [], bids: [Array] },
                sequenceEnd: 1568367435050
            },
            subject: 'trade.l2update',
            topic: '/market/level2:ETH-USDT',
            type: 'message'
            }
            */
        }

        return false;
    }    

    public subscribe(channelName: string): boolean
    {
        const message = {
            "id": uuidv4(), // The id should be an unique value
            "type": "subscribe",
            "topic": channelName,  // Topic needs to be subscribed. Some topics support to divisional subscribe the informations of multiple trading pairs through ",".
            "privateChannel": false, // Adopted the private channel or not
            "response": true  // Whether or not the server needs to return the receipt information of this subscription
        };

        return this.send(message);
    }

    protected async initProducts(): Promise<boolean>
    {
        const productResponse = await this.arbitService.getArbitExchangeProducts(this.getExchangeId());

        if (!productResponse.isOk()) {
            await this.logService.error(`KuCoinWebSocketService::initProducts | unable to load products`);
            return false;
        }
    
        // KuCoin seems to only allow subscription to 100 level2 feeds, so just listen to USDT since there are only 75, and that's our only available base
        this.products = productResponse.getData()    
            .filter(p => p.quoteCurrency === 'USDT')
            // for some reason BCH/USDT is no longer listed at kucoin, but the ticket and orderbook fetch queries still work? Seems to be replaced by BCHABC, but is not suported by the API
            .filter(p => p.baseCurrency !== 'BCH')
            .slice(0,100);
  
        return true;
    }    
}