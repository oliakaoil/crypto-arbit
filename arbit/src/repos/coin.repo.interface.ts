import { ServiceResponse } from "../service.response";
import { CurrencyConvertModel } from "../models/currency-convert.model";

export interface ICoinRepo {

    findCoinsByCurrency(bases: string[], quotes?: string[]): Promise<CurrencyConvertModel[]>

    upsertConversion(
        baseCurrency: string, 
        quoteCurrency: string, 
        rate: number,
        source: string
    ): Promise<ServiceResponse>

}