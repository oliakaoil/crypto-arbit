export enum OrderType {

    LimitBuy = 1,

    LimitSell = 2,

    MarketBuy = 3,
    
    MarketSell = 4,    

    StopLoss = 5,

    BuyStop = 6
};

export enum OrderStatus {
    // We just created the order in the DB and haven't heard back from the API yet
    Created = 1,

    // The API accepted our order and gave it an external ID, it's in the order book
    Open = 2,

    // The API filled our order, we now have a position
    Filled = 3,

    // There is sometimes a small lag between when an order is filled and when products/cash/etc. actually hit your account
    Settled = 4,

    // the order was rejected by the API for some reason, no position created
    Failed = 6,

    // the order was cancelled or closed without being filled
    Closed = 7,

    Unknown = 8
};

export enum OrderLockType {
    Unlocked = 0,

    CreateLimitOrder = 1,

    CreateStopOrder = 2,
  
    CancelOrder = 3
};