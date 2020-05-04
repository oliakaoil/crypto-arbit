import * as WebSocket from 'ws';

import { IWebSocketService } from './websocket.service.interface';
import { ILoggingService } from '../logging.service.interface';

import { IExchangeService } from '../exchanges/exchange.service.interface';
import { ExchangeProductModel } from '../../models/exchange-product.model';
import { ExchangeOrderbook, ExchangeOrderbookLevel } from '../../exchange.response';
import { IExchangeOrderbookService } from '../exchange-orderbook.service.interface';
import { ExchangeIds } from '../../enums/exchange.enum';
import { ICacheService } from '../cache.service.interface';
import { IArbitService } from '../arbit.service.interface';
import { ServiceResponse } from '../../service.response';
import { sleep } from '../../helpers';


export class BaseWebSocketService implements IWebSocketService {

  protected exchangeId: ExchangeIds;

  protected logService: ILoggingService;
  protected cacheService: ICacheService;
  protected exchangeService: IExchangeService;
  protected exchangeOrderbookService: IExchangeOrderbookService;
  protected arbitService: IArbitService;
  protected products: ExchangeProductModel[] = [];
  protected wsClient:any;

  protected wsUrl: string;
  protected reconnectEnabled: boolean = true;
  protected reconnectCount: number = 0;
  protected maxReconnectCount: number = 10;
  protected reconnectWaitMs: number = 2000;
  protected connected: boolean = false;
  
  protected orderbooks: Map<string, ExchangeOrderbook> = new Map();
  protected orderbookQueue: Map<string, IArguments[]> = new Map();

  constructor(opts)
  {
    this.logService = opts.logService;
    this.cacheService = opts.cacheService;
    this.exchangeOrderbookService = opts.exchangeOrderbookService;
    this.arbitService = opts.arbitService;
  }

  public getExchangeId(): ExchangeIds
  {
      return this.exchangeId;
  }  

  public async connect(): Promise<boolean> 
  {
    await this.onBeforeConnect();

    const logId = `BaseWebsocketService::connect | ex [${this.getExchangeId()}] |`;
    this.logService.info(`${logId} connecting ${this.wsUrl}`);

    const wsClient = await this.getWsClient();
    

    /*
    * Fail safe if the socket connection is not available by only trying
    * to reconnect a few times.
    */
    if (this.reconnectCount > this.maxReconnectCount) {
        await this.logService.error(`${logId} not attempting to reconnect to websocket, reached max reconnect limit ${this.maxReconnectCount}`);
        return false;
    }

    if (this.reconnectCount > 0 && !this.reconnectEnabled) {
        await this.logService.warn(`${logId} not attempting to reconnect, reconnect disabled`);
        return false;
    }

    this.reconnectCount += 1;
    wsClient.removeAllListeners();

    wsClient.on('open', () => {
        this.logService.info(`${logId} opened ${this.wsUrl}`);

        this.connected = true;

        this.onOpen();   
    });    

    wsClient.on('error', (err) => {
        this.logService.error(`${logId} error ${this.wsUrl}`, err);
      });

    wsClient.on('close', (err) => {

        this.logService.warn(`${logId} closed ${this.wsUrl}`, err);

        this.connected = false;

        setTimeout( () => {
            this.connect();
        }, this.reconnectWaitMs);
    });

    wsClient.on('message', async (data: any) => {

        try {

            data = JSON.parse(data);

        } catch (err) {

            this.logService.error(`${logId} message json parse error`, err);
            return;
        }

        if (data && data.type === 'error')
            this.logService.error(`${logId} message error`, data);

        this.onMessage(data);
    });

    this.wsClient = wsClient;
    
    return true;
  }
  

  public async disconnect(): Promise<boolean>
  {
      await this.logService.info(`Disconnecting from ${this.wsUrl}`);

      this.reconnectEnabled = false;

      await this.wsClient.terminate();
      return true;
  }

  public isConnected(): boolean
  {
    return (this.wsClient && this.wsClient.readyState === 1);
  }

  public async onBeforeConnect(): Promise<boolean>
  {
      return true;
  }  

  protected async onBeforeInitProducts(): Promise<boolean>
  {
      return true;
  }

  public async onOpen(): Promise<boolean>
  {
      const logId = `BaseWebsocketService::onOpen |`;

      await this.onBeforeInitProducts();

      // at this point we should known which exchange we are, so load up the product and tarbit lists
      await this.initProducts();

      // TESTING
      //this.products = this.products.filter(p => ['XRP-USDT','XTZ-BTC'].indexOf(p.getCurrencyPair()) >-1);

      this.logService.info(`${logId} subscribing to ${this.products.length} products`);

      for (let i=0;i<this.products.length; i++)
      {
        const exProduct = this.products[i];
        const currencyPair = exProduct.getCurrencyPair();

        await this.logService.debug(`${logId} ${currencyPair}`);

        this.initOrderbook(currencyPair);

        this.subscribeDiffOrders(currencyPair);

        this.initOrderbookQueueFlush(currencyPair);
      }

      this.initPersistOrderbooks();

      return true;
  }

  public async onMessage(data: any): Promise<boolean>
  {
      return true;
  }  

  protected async getWsClient(): Promise<WebSocket>
  {
    return new WebSocket(this.wsUrl);      
  }

  public subscribe(channelName: string): boolean
  {
      return true;
  }

  public send(message: any): boolean
  {
      this.wsClient.send(JSON.stringify(message));
      return true;
  }    

  protected async initProducts(): Promise<boolean>
  {
    const productResponse = await this.arbitService.getArbitExchangeProducts(this.getExchangeId());

    if (!productResponse.isOk()) {
        await this.logService.error(`BaseWebSocketService::initProducts | unable to load products`);
        return false;            
    }

    this.products = productResponse.getData();

    return true;
  }

  protected subscribeDiffOrders(currencyPair: string): void
  {
      /*
       * The extending class must override this method and do 2 things:
       *   1. Subscribe to a ws channel that sends orderbook diffs
       *   2. Prime the orderbook, either via REST API call, or via WS, but only after step 1 is successful.
       */
  }

  protected async initOrderbook(currencyPair: string): Promise<boolean>
  {
    const logId = `BaseWebsocketService::initOrderbook | ex [${this.exchangeService.getExchangeId()}] | ${currencyPair} |`;

    this.orderbookQueue.set(currencyPair, []);

    const orderbook = new ExchangeOrderbook(this.getExchangeId(), currencyPair);

    this.orderbooks.set(currencyPair, orderbook);
    
    return true;
  }

  // Extending class must override
  protected async resetOrderbook(currencyPair: string): Promise<boolean>
  {
    // You don't need to re-sub, you just need to take a new snapshot, the system will disregard any old diffs

    // 1. this.initOrderbook(currencyPair);

    // 2. Prime the orderbook

    // 3. this.initOrderbookQueueFlush(currencyPair);

    return true;
  }


  /*
   * The orderbook may not be primed, and diff-order messages may come in faster
   * than they can be processed, so rather than simply processing the message, queue
   * the message in memory, and use a separate process to flush the queue
   */
  protected async pushOrderbookUpdate(
      currencyPair: string, 
      sequence: number,
      side: 'ask'|'bid',
      price: number,
      size: number
      ) : Promise<boolean>
  { 
    let orderbookQueue: IArguments[] = this.orderbookQueue.get(currencyPair);
    orderbookQueue.push(arguments);
    return true;
  }

  protected async initOrderbookQueueFlush(currencyPair: string) : Promise<void>
  {
    const logId: string = `BaseWebsocketService::initOrderbookQueueFlush | ex [${this.exchangeService.getExchangeId()}] | ${currencyPair} |`

    this.logService.debug(`${logId} initalized`);

    const orderbook = this.orderbooks.get(currencyPair);

    if (!orderbook) {
        this.logService.error(`${logId} attempting to init queue flush on un-initialized orderbook`);
        return;
    }

    if (orderbook.dequeueing) {
        this.logService.error(`${logId} attempting to init queue flush on already dequeueing orderbook`);
        return;
    }

    orderbook.dequeueing = true;
    let orderbookQueue: IArguments[] = this.orderbookQueue.get(currencyPair);

    /*
     * If the dequeueing process cannot keep up with the incoming messages, give up to 
     * ensure that decisions are not being made based on an outdated orderbook, and to
     * avoid eating up too much memory.
     */
    const fallBehindFailsafe = 200;

    while (true) {

        // nothing in the queue? wait a little and try again
        if (!orderbookQueue.length) {
            await sleep(100);
            continue;
        }

        // not ready yet? wait a little and try again
        if (!orderbook.primed) {
            await sleep(1000);
            continue;
        }

        if (!orderbook.dequeueing)
            break;

        // in-memory orderbook is too far behind, fail
        if (orderbookQueue.length >= fallBehindFailsafe) {
            await this.logService.error(`${logId} fell too far behind, ${orderbookQueue.length} diffs in the queue, sleeping and reseting`);
            
            await sleep(3000);

            this.resetOrderbook(currencyPair);

            orderbook.dequeueing = false;

            break;
        }

        const updateArgs: IArguments = orderbookQueue.shift();

        this.updateOrderbook.apply(this, Array.from(updateArgs));
    }
  }

  /* 
   * Is the update immediately following the current state of the orderbook? If it's ahead, that 
   * means our current orderbook snapshot is out of date and cannot be recovered, it must be reset.
   */
  protected validateIncomingSequence(sequence: number, orderbook: ExchangeOrderbook): boolean
  {
    return ((sequence - 1) === orderbook.sequence);
  }

  /* 
   * Did this update happen before our current snapshot? It can be safely disregarded with no-op, unlike the 
   * above validation check, which can trigger the orderbook to be reset.
   */
  protected incomingSequenceOutdated(sequence: number, orderbook: ExchangeOrderbook): boolean
  {
    return (sequence <= orderbook.sequence);
  }  

  protected async updateOrderbook(
    currencyPair: string, 
    sequence: number,
    side: 'ask'|'bid', 
    price: number,  // set price = 0 to update the sequence and make no other changes
    size: number // set size = 0 to remove the price level
    ): Promise<boolean>
  {
    const logId = `BaseWebsocketService::updateOrderbook | ex [${this.exchangeService.getExchangeId()}] | ${currencyPair} |`;

    //console.log(`${currencyPair} | sequence ${sequence} | ${side} | ${size} @ ${price}`);

    const orderbook:ExchangeOrderbook = this.orderbooks.get(currencyPair);

    // is this update older than the current orderbook snapshot? safely ignore it
    if (this.incomingSequenceOutdated(sequence, orderbook))
        return false;
   
    // is this update too new? we need to reset and try again.
    if (!this.validateIncomingSequence(sequence, orderbook)) {
        this.logService.debug(`${logId} out of sequence | incoming ${sequence} | current ${orderbook.sequence} | reseting orderbook ${currencyPair}`);

        // ensure that dequeueing stops
        orderbook.dequeueing = false;

        this.resetOrderbook(currencyPair);

        return false;
    }


    /*
     * Now that we know the update is validate, apply
     */

    orderbook.sequence = sequence;

    // noop
    if (price === 0) {
        return true;
    }

    const orders:ExchangeOrderbookLevel[] = orderbook[`${side}s`];

    const levelIndex = orders.findIndex(l => l.price === price);
    const upsertLevel = new ExchangeOrderbookLevel(price, size);

    /*
     * Remove existing level
     */
    if (size === 0)
    {
        if (levelIndex === -1) {
            await this.logService.debug(`${logId} attempt to remove non-existent price level ${price}`);
            //console.log(side); console.log(price); console.log(size); orderbook.printDebug(200); process.exit();
            return true;
        }

        orders.splice(levelIndex,1);

        // console.log(`${currencyPair} | REMOVE ${price}`);

        return true;
    }

     
    /*
     * Add/Update Level
     */

    let action: string;

    
    if (levelIndex === -1) {
        orders.push(upsertLevel);
        action = 'ADD';
    // Update the size of an existing level
    } else {
        action = 'UPDATE';
        orders[levelIndex].size = upsertLevel.size;
    }

    //console.log(`${currencyPair} | ${side} ${action} ${size} @ ${price}`);
    //const bestAsk = orderbook.getBestAsk(); console.log(`best ask | ${orderbook.currencyPair} p${bestAsk.price} s${bestAsk.size}`);

    return true;
  }

  protected initPersistOrderbooks(): void 
  {
    const cacheStoreAllOrderbooks = async () => {

        if (this.connected) {
            this.orderbooks.forEach((orderbook: ExchangeOrderbook, key: string) => {
                if (!orderbook || !orderbook.primed)
                    return;

                this.cacheService.storeServiceResponse(
                    this.exchangeService, 
                    this.exchangeService.getOrderbook, 
                    [key], 
                    30,
                    new ServiceResponse(true, orderbook)
                );        
            });
        }

        await sleep(1000);

        cacheStoreAllOrderbooks();
    };

    cacheStoreAllOrderbooks();
  }

  // Assuming that if we connect and get a hearbeat, the socket service must be healthy, so reset the reconnect counter
  protected heartbeat(): boolean
  {
    this.reconnectCount = 0;      
    return true;
  }
}