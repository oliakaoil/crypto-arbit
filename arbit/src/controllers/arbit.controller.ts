import { ILoggingService } from '../services/logging.service.interface';
import { IArbitService } from '../services/arbit.service.interface';

import { ExchangeIds } from '../enums/exchange.enum';
import { ArbitEstimate } from '../arbit.response';
import { OrderController } from './order.controller';
import { IArbitController } from './arbit.controller.interface';


export class ArbitController implements IArbitController {

    private logService: ILoggingService;
    private arbitService: IArbitService;
    private orderController: OrderController;
    private getExchangeServiceById: CallableFunction;

        
    constructor(opts) {
        this.logService = opts.logService;
        this.arbitService = opts.arbitService;
        this.orderController = opts.orderController;
        this.getExchangeServiceById = opts.getExchangeServiceById;
    }


    /*
     * Given 2 exchanges, iterate through the list of all shared products 
     * and look for profitable arbits.
     */
    public async findArbits(
        exchangeId1: ExchangeIds,
        exchangeId2: ExchangeIds
    ): Promise<boolean>
    {
        const size = 10;
        const funds = 5000;
        const exchangeService1 = this.getExchangeServiceById(exchangeId1);
        const exchangeService2 = this.getExchangeServiceById(exchangeId2);

        await this.logService.info(`ArbitController::findArbits | finding arbits between exchanges ${exchangeService1.getExchangeId()} and ${exchangeService2.getExchangeId()}`);

        const ex1ProductResponse = await this.arbitService.getAllProductsByExchangeId(exchangeService1.getExchangeId());
        if (!ex1ProductResponse.isOk()) {
            await this.logService.error('ArbitController::findArbits | cannot load ex1 products');
            return false;
        }
        const ex1Products = ex1ProductResponse.getData();

        const ex2ProductResponse = await this.arbitService.getAllProductsByExchangeId(exchangeService2.getExchangeId());
        if (!ex2ProductResponse.isOk()) {
            await this.logService.error('ArbitController::findArbits | cannot load ex2 products');
            return false;
        }
        const ex2Products = ex2ProductResponse.getData();

        for (let i=0; i < ex1Products.length; i++)
        {
            const ex1Product = ex1Products[i];

            const ex2Product = ex2Products.find(p => 
                p.baseCurrency === ex1Product.baseCurrency && 
                p.quoteCurrency === ex1Product.quoteCurrency
            );

            if (!ex2Product) {
                //await this.logService.debug(`No Match ${ex1Product.getCurrencyPair()}`); 
                continue;
            }

            await this.logService.debug(`Checking ${ex1Product.getCurrencyPair()}`);            


            const arbit = await this.createArbitEstimate(exchangeId1, exchangeId2, ex1Product.getCurrencyPair(), null, funds);

            if (!arbit)
                continue;

            await this.logService.debug(`Risk: ${(funds ? funds : size * arbit.sourceExchangeQuickFill.bestPrice)} | Net: ${arbit.arbitNet} | Gross: ${arbit.arbitGross}`);

            if (arbit.arbitNet > 0)
                console.log(arbit);
        }

        return true;
    }


    public async createArbitEstimate(
        exchangeId1: ExchangeIds,
        exchangeId2: ExchangeIds,        
        currencyPair: string,
        size?: number,
        funds?: number
    ): Promise<ArbitEstimate>
    {
        const exchangeService1 = this.getExchangeServiceById(exchangeId1);
        const exchangeService2 = this.getExchangeServiceById(exchangeId2);

        if (!exchangeService1) {
            await this.logService.error(`ArbitController::createArbitEstimate | unable to load exchange service for exchange ${exchangeId1}`);
            return;
        }

        if (!exchangeService2) {
            await this.logService.error(`ArbitController::createArbitEstimate | unable to load exchange service for exchange ${exchangeId2}`);
            return;
        }

        /*
         * Get exchange meta for both exchanges to account for fees and
         * ensure that a transfer is actually possible
         */

         // @todo ^^^
         
        /*
         * Get up-to-date tickers for the currency at both exchanges
         */
        // currencyPair
        const quickFill1 = await this.orderController.getQuickFill(
            exchangeId1,
            currencyPair,
            size,
            funds
        );

        if (!quickFill1) {
            await this.logService.error(`ArbitController::createArbitEstimate | cannot get ex1 quickfill for ${currencyPair}`);
            return;
        }

        const quickFill2 = await this.orderController.getQuickFill(
            exchangeId2,
            currencyPair,
            size,
            funds
        );
        if (!quickFill2) {
            await this.logService.error(`ArbitController::createArbitEstimate | cannot get ex2 quickfill for ${currencyPair}`);
            return;
        }


        let size1 = size;
        let size2 = size;

        if (!size) {
            //size1 = (funds / quickFill1.ask);
            //size2 = (funds / quickFill2.ask);
        }   

        return new ArbitEstimate();

        /* 
         * Determine price differences between the 2 exchanges to see if gross arbitrage is possible
        
        const ex1WithdrawalFee = exchangeService1.makeWithdrawalFee(exchangeMeta1, size1);
        const ex1TakerFeeBid = exchangeService1.makeTakerFee(OrderType.LimitSell, size1, quickFill1.bid);
        const ext1TakerFeeAsk = exchangeService1.makeTakerFee(OrderType.LimitBuy. size1, quickFill1.ask);

        const ex2WithdrawalFee = exchangeService2.makeWithdrawalFee(exchangeMeta2, size2);
        const ex2TakerFeeBid = exchangeService2.makeTakerFee(OrderType.LimitSell, size2, quickFill1.bid);
        const ext2TakerFeeAsk = exchangeService2.makeTakerFee(OrderType.LimitBuy, size2, quickFill1.ask);


        // buy at ex1 and sell at ex2
        const source1FillFees = ext1TakerFeeAsk + ex2TakerFeeBid;
        const source1Gross = (quickFill2.bid - quickFill1.ask) * size1;
        const source1Net = source1Gross - source1FillFees - ex1WithdrawalFee;
        
        // buy at ex2 and sell at ex1
        const source2FillFees = ext2TakerFeeAsk + ex1TakerFeeBid;
        const source2Gross = (quickFill1.bid - quickFill2.ask) * size2; 
        const source2Net = source2Gross - source2FillFees - ex2WithdrawalFee;

        
        const arbit = new ArbitEstimate();
        arbit.currencyPair = currencyPair;

        // more profitable to buy at ex1 and sell at ex2
        if (source1Net > source2Net) {
            arbit.sourceExchangeQuickFill = quickFill1;
            arbit.sourceExchangeMeta = exchangeMeta1;

            arbit.targetExchangeQuickFill = quickFill2;
            arbit.targetExchangeMeta = exchangeMeta2;
            
            arbit.arbitNet = source1Net;
            arbit.arbitGross = source1Gross;
            arbit.fillFee = source1FillFees;
            arbit.withdrawalFee = ex1WithdrawalFee;
            arbit.size = size1;

        } else {
            
            // more profitable to buy at ex2 and sell at ex1
            arbit.sourceExchangeQuickFill = quickFill2;
            arbit.sourceExchangeMeta = exchangeMeta2;

            arbit.targetExchangeQuickFill = quickFill1;
            arbit.targetExchangeMeta = exchangeMeta1;
            
            arbit.arbitNet = source2Net;
            arbit.arbitGross = source2Gross;
            arbit.fillFee = source2FillFees;
            arbit.withdrawalFee = ex2WithdrawalFee;
            arbit.size = size2;
        }

        arbit.arbitNetPct = Number( ((arbit.arbitNet / (arbit.sourceExchangeQuickFill.bestPrice * arbit.size))).toFixed(4) );

        return arbit;
         */
    }
}
