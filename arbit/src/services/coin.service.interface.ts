import { ServiceResponse } from "../service.response";


export interface ICoinService {

    getPopCoins(): string[];

    isFiat(symbol: string): boolean;

    isStablecoin(symbol: string): boolean;

    isPopcoin(symbol: string): boolean;

    getAllCoins(): Promise<ServiceResponse>;

    getTicker(currencyPair: string): Promise<ServiceResponse>;

    getStablecoinTicker(baseCurrency: string): Promise<ServiceResponse>;

    findConverts(bases: string[], quotes?: string[]): Promise<ServiceResponse>

    findStableConverts(baseCurrency: string): Promise<ServiceResponse>;

    findExchangePairs(bases: string[], quotes: string[]): Promise<ServiceResponse>

    findExchangeStablecoinPairs(baseCurrency): Promise<ServiceResponse>

    findExchangePopcoinPairs(baseCurrency: string): Promise<ServiceResponse>

    upsertConversion(
        baseCurrency: string, 
        quoteCurrency: string, 
        rate: number,
        source: string
    ): Promise<ServiceResponse>    
}
