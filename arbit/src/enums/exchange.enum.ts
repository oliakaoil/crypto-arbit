export enum ExchangeLockType {

    Unlocked = 0,

    LockTarbit = 1, // locked for triangle arbitrage action

    LockArbit = 2 // locked for arbitrage action
}

export enum ExchangeStatus {

    Enabled = 1,

    Disabled = 0
};

export enum ExchangeProductStatus {
    
    Online = 1,

    Offline = 2
}

export enum ExchangeLocalizeType {
    
    RestAPI = 1,

    Websocket = 2
}

// INSERT INTO exchanges (name,status,created_at,updated_at) VALUES ('',1,NOW(),NOW());

export enum ExchangeIds {

    // Fees are too high and its too high-profile, but going to scan anyways just in case
    Coinbase = 1,

    // Found 1 tarbit here so far, keep scanning
    Coinex = 2,

    // scanning for first time now that rate limit issues were resolved
    Cexio = 3,

    // Found 4 tarbits here so far, need to enable execute + fast scan
    Bittrex = 4,

    // Doesn't currently support non-USD currentcy pairs, no need to scan
    Robinhood = 5,

    // No tarbits found here, but keep scanning
    Altilly = 6,

    // Got pretty far with this one and found many tarbits, but they don't allow non-US and they just jacked up their fees, too expensive now
    Bitso = 7,

    // Found 2 tarbits here so far, need to enable fast scanner + execute
    KuCoin = 8,

    // Many tarbits found here, but REST API rate limit is very low and there is no websocket available. not sure how to work around that.
    Bitforex = 9,

    // Not enough supported products
    Bitflyer = 10,

    // API cloudflare issue, de-prioritized for now
    Fatbtc = 11,

    // Nothing yet
    Bilaxy = 12,

    Idcm = 13
}