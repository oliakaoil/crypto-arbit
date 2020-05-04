import { OrderStatus, OrderType } from './enums/order.enum';
import { ExchangeIds } from './enums/exchange.enum';

export class ExchangeOrder
{
    public id: string;
    public price: number;
    public size: number;
    public currencyPair: string;
    public side: 'buy' | 'sell';
    public type: 'limit' | 'market' | 'stop';
    public timeInForce: 'GTC' | 'GTT' | 'IOC' | 'FOK';
    public createdAt: string;
    public doneAt: string;
    public doneReason: string;
    public fillFees: number;
    public filledSize: number;
    public stopPrice: number;
    public status: OrderStatus;

    constructor(o?:any)
    {
        if (!o)
            return;

        this.id = o.id;
        this.price = o.price;
        this.size = o.size;
        this.currencyPair = o.currencyPair;
        this.side = o.side;
        this.type = o.type;
        this.timeInForce = o.timeInForce;
        this.createdAt = o.createdAt;
        this.doneAt = o.doneAt;
        this.doneReason = o.doneReason;
        this.fillFees = o.fillFees;
        this.filledSize = o.filledSize;
        this.stopPrice = o.stopPrice;
        this.status = o.status;
    }
}

export class ExchangeOrderbookLevel {
    price: number;
    size: number;
    side: 'bid'|'ask';

    constructor(price?: string|number, size?: string|number)
    {
        if (price && size) {
            this.price = Number(price);
            this.size = Number(size);
        }
    }

    getLevelFunds(): number
    {
        return this.price * this.size;
    }
}

export class ExchangeOrderbook {
    
    public exchangeId: ExchangeIds;
    public currencyPair: string;
    public productId: number;
    public sequence: number;
    public timestamp: number;
    public primed: boolean = false;
    public dequeueing: boolean = false;
    public asks: ExchangeOrderbookLevel[] = [];
    public bids: ExchangeOrderbookLevel[] = [];

    constructor(exchangeId: ExchangeIds, currencyPair: string)
    {
        this.exchangeId = exchangeId;
        this.currencyPair = currencyPair;
        this.asks = [];
        this.bids = [];
        this.primed = false;
        this.dequeueing = false;
    }

    public getSpread(): number
    {
        if (!this.asks.length || !this.bids.length)
            return 0;

        this.sortFills();

        return this.asks[0].price - this.bids[0].price;
    }

    public getBestAsk(): ExchangeOrderbookLevel
    {
        if (!this.asks.length)
            return new ExchangeOrderbookLevel(0,0);

        this.sortFills();
        return this.asks[0];
    }

    public getBestBid(): ExchangeOrderbookLevel
    {
        if (!this.bids.length)
            return new ExchangeOrderbookLevel(0,0);

        this.sortFills();
        return this.bids[0];
    }

    public getPrice(): number
    {
        this.sortFills();    
        
        if (!this.asks.length && !this.bids.length)
            return 0;

        if (!this.asks.length)
            return this.bids[0].price;

        if (!this.bids.length)
            return this.asks[0].price;

        return ((this.asks[0].price + this.bids[0].price) / 2);
    }

    public printDebug(maxLevels: number = 10): void
    {
        this.sortFills();

        console.log(`${this.currencyPair} Asks:`);

        this.asks.slice(0,maxLevels).map(l => {
            console.log(`${l.size} @ ${l.price}`);
        });

        console.log(`\n${this.currencyPair} Bids:`);

        this.bids.slice(0,maxLevels).map(l => {
            console.log(`${l.size} @ ${l.price}`);
        });       
    }

    public sortFills(): void
    {
        this.asks.sort((a,b) => {
            if (a.price === b.price)
                return 0;
            return a.price > b.price ? 1 : -1;
        });

        this.bids.sort((a,b) => {
            if (a.price === b.price)
                return 0;
            return a.price > b.price ? -1 : 1;
        });
    }

    public getAllLevels(): ExchangeOrderbookLevel[]
    {
        const allLevels: ExchangeOrderbookLevel[] = [];

        this.asks.map(level => {
            level.side = 'ask';
            allLevels.push(level);
        });

        this.bids.map(level => {
            level.side = 'bid';
            allLevels.push(level);
        });        

        return allLevels;
    }
}


export class ExchangeTicker
{
    public currencyPair: string;
    public price: number;
    public date: string;
    public bid: number;
    public ask: number;
    public volume: number;

    constructor(o?:any)
    {
        if (!o)
            return;

        this.currencyPair = o.currencyPair;
        this.price = o.price;
        this.date = o.date;
        this.bid = o.bid;
        this.ask = o.ask;
        this.volume = o.volume;
    }    

    public getCurrencyPair(): string
    {
        return this.currencyPair;
    }
}

export class ExchangeQuickFill
{
    public exchangeId: ExchangeIds;
    public currencyPair: string;
    public orderType: OrderType;
    public size: number;
    public funds: number;
    public bestPrice: number;
    public marketPrice: number;
    public takerFee: number;
    public delayVolume: number;
    public fills: ExchangeOrderbookLevel[];

    constructor(
        exchangeId: ExchangeIds, 
        currencyPair: string, 
        orderType: OrderType
    )
    {
        this.exchangeId = exchangeId;
        this.currencyPair = currencyPair;
        this.orderType = orderType;
        this.size = 0;
        this.funds = 0;
        this.bestPrice = 0;
        this.marketPrice = 0;
        this.takerFee = 0;
        this.delayVolume = 0;
        this.fills = [];
        this.fills = [];
    }
}

export class ExchangeAccount
{
    public id: string;
    public currency: string;
    public balance: number;
    public hold: number;
    public available: number;

    constructor(o?:any)
    {
        if (!o)
            return;

        this.id = o.id;
        this.currency = o.currency;
        this.balance = o.balance;
        this.hold = o.hold;
        this.available = o.available;
    }
}
