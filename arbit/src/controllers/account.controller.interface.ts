import { ExchangeTransferModel } from '../models/exchange-transfer.model';
import { ExchangeIds } from '../enums/exchange.enum';


export interface IAccountController {

    cryptoTransfer(
        sourceExchangeId: number, 
        destExchangeId: number,
        currency: string,
        size: number,
        waitForConfirmation: boolean,
    ) : Promise<ExchangeTransferModel>;

    confirmCryptoTransfer(
        transfer: ExchangeTransferModel
    ) : Promise<ExchangeTransferModel>;

    getFundsAvailable(
        exchangeId: ExchangeIds,
        currency: string
    ): Promise<number>;    

    confirmFundsAvailable(
        exchangeId: ExchangeIds,
        currency: string,
        size: number
    ): Promise<boolean>;
}
