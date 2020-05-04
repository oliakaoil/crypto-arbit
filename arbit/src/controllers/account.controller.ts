import { ILoggingService } from '../services/logging.service.interface';
import { IArbitService } from '../services/arbit.service.interface';
import { ExchangeAccount } from '../exchange.response';
import { sleep } from '../helpers';
import { ExchangeTransferModel } from '../models/exchange-transfer.model';
import { TransferStatus } from '../enums/transfer.enum';
import { ExchangeIds } from '../enums/exchange.enum';
import { IAccountController } from './account.controller.interface';


export class AccountController implements IAccountController {

    private logService: ILoggingService;
    private arbitService: IArbitService;
    private getExchangeServiceById: CallableFunction;
        
    constructor(opts) {
        this.logService = opts.logService;
        this.arbitService = opts.arbitService;
        this.getExchangeServiceById = opts.getExchangeServiceById;
    }

    public async cryptoTransfer(
        sourceExchangeId: number, 
        destExchangeId: number,
        currency: string,
        size: number,
        waitForConfirmation: boolean = true
    ) : Promise<ExchangeTransferModel>
    {
        await this.logService.infoWithNotif(`AccountController::cryptoTransfer | transfering ${size} ${currency} from exchange ${sourceExchangeId} to ${destExchangeId}`);

        const sourceExchangeService = this.getExchangeServiceById(sourceExchangeId);

        if (!sourceExchangeService) {
            await this.logService.error(`AccountController::cryptoTransfer | unable to load source ex service ${sourceExchangeId}`);
            return;
        }


        /*
         * Create the transfer record
         */
        const transferModel = new ExchangeTransferModel({
            source_exchange_id: sourceExchangeId,
            dest_exchange_id: destExchangeId,
            currency: currency,
            size: size,
            withdrawal_fee: null,
            status: TransferStatus.Created
        });

        const createResponse = await this.arbitService.createTransfer(transferModel);

        if (!createResponse.isOk()) {
            await this.logService.error('AccountController::cryptoTransfer | unable to create transfer record', transferModel);
            return;
        }

        const transfer: ExchangeTransferModel = createResponse.getData();


        /*
         * Make the transfer
         */
        const transferResponse = await sourceExchangeService.cryptoTransfer(transfer);
        const completedTransfer: ExchangeTransferModel = transferResponse.getData();
        
        if (!transferResponse.isOk() || !completedTransfer || !completedTransfer.extId) {
            await this.logService.error('AccountController::cryptoTransfer | unable to complete transfer', transfer);
            return;
        }

        
        /*
         * Save the updated transfer record
         */        
        const updateResponse = await this.arbitService.updateTransfer(completedTransfer);

        if (!updateResponse.isOk()) {
            await this.logService.error('AccountController::cryptoTransfer | unable to update completed transfer record', completedTransfer);
            return;
        }

        if (!waitForConfirmation)
            return completedTransfer;

        return this.confirmCryptoTransfer(completedTransfer);
    }


    /*
     * Attempt to "confirm" that a transfer was successful by checking the available balance 
     * of the destination exchange account. Since the account could obviously have funds from 
     * another source, this is not an actual confirmation. Long term we should use blockchain or 
     * some other method to generate an actual confirmation.
     */
    public async confirmCryptoTransfer(
        transfer: ExchangeTransferModel
    ) : Promise<ExchangeTransferModel>
    {
        const destExchangeService = this.getExchangeServiceById(transfer.destExchangeId);

        if (!destExchangeService) {
            await this.logService.error(`AccountController::cryptoTransfer | unable to load target ex service ${transfer.destExchangeId}`);
            return;
        }

        
        const totalWaitTimeMinutes = 8;  // max amount of time to wait for a confirmation
        const waitSeconds = 30; // how long to wait before checking again
        let currentWaitSeconds = 0;

        // simple failsafe count
        let failsafeCounter = 0;
        const failsafeMax = 100;        

        do {

            await this.logService.debug(`Sleeping for ${waitSeconds}s and then checking for transfer fill...`);

            await sleep(waitSeconds * 1000);

            const fundsAvailable = await this.confirmFundsAvailable(transfer.destExchangeId, transfer.currency, transfer.size);

            // Funds are available, consider this confirmed
            if (fundsAvailable) {
                await this.logService.debug(`Funds are available, updating transfer to confirmed`);

                transfer.confirmed = true;

                const updateResponse = await this.arbitService.updateTransfer(transfer);

                if (!updateResponse.isOk()) {
                    await this.logService.error('AccountController::confirmCryptoTransfer | unable to update confirmed transfer record', transfer);
                    transfer.confirmed = false;
                }

                return transfer;
            }

            currentWaitSeconds += waitSeconds;

        } while((currentWaitSeconds < (totalWaitTimeMinutes * 60)) && failsafeCounter++ < failsafeMax);
        
        return transfer;
    }

    public async getFundsAvailable(
        exchangeId: ExchangeIds,
        currency: string
    ): Promise<number>
    {
        const logId = `AccountController::getFundsAvailable | ex [${exchangeId}]`;
        const exchangeService = this.getExchangeServiceById(exchangeId);

        if (!exchangeService) {
            await this.logService.error(`${logId} unable to load ex service`);
            return;
        }

        const accountResponse = await exchangeService.getAccounts();      

        if (!accountResponse.isOk()) {
            await this.logService.error(`${logId} | unable to retrieve accounts`);
            return;
        }
    
        const accounts: ExchangeAccount[] = accountResponse.getData();
        const targetAccount = accounts.find(a => a.currency === currency);        

        if (!targetAccount)
            return 0;

        return targetAccount.available;
    }    

    public async confirmFundsAvailable(
        exchangeId: ExchangeIds,
        currency: string,
        size: number
    ): Promise<boolean>
    {
        const availableFunds = await this.getFundsAvailable(exchangeId, currency);
        return (availableFunds >= size);
    }    
}
