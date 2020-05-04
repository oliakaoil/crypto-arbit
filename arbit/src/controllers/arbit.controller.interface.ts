import { ExchangeIds } from '../enums/exchange.enum';
import { ArbitEstimate } from '../arbit.response';


export interface IArbitController {

    findArbits(
        exchangeId1: ExchangeIds,
        exchangeId2: ExchangeIds
    ): Promise<boolean>;
    
    createArbitEstimate(
        exchangeId1: ExchangeIds,
        exchangeId2: ExchangeIds,        
        currencyPair: string,
        size?: number,
        funds?: number
    ): Promise<ArbitEstimate>;
}
