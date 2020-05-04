import { ExchangeIds } from '../enums/exchange.enum';
import { TriangleArbitModel } from '../models/triangle-arbit.model';
import { ExchangeModel } from '../models/exchange.model';


export interface ITArbitController {

    findByExchange(
        exchangeId: ExchangeIds
    ): Promise<TriangleArbitModel[]>;

    create(
        exchangeId: ExchangeIds,
        baseSize: number,
        baseCurrency: string,
        firstLegCurrencyPair: string,
        secondLegCurrencyPair: string,
        thirdLegCurrencyPair: string,
        parentId?: number
    ) : Promise<TriangleArbitModel>;
 
    execute(
        tarbitModel: TriangleArbitModel,
        repeat?: boolean
    ): Promise<boolean>;
}
