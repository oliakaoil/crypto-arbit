import { ITArbitController } from './tarbit.controller.interface';
import { MarketController } from './market.controller';
import { OrderController } from './order.controller';

import { ILoggingService } from '../services/logging.service.interface';
import { IArbitService } from '../services/arbit.service.interface';

import { IExchangeOrderService } from '../services/exchange-order.service.interface';

import { TriangleArbitModel } from '../models/triangle-arbit.model';
import { ExchangeOrderModel } from '../models/exchange-order.model';

import { ArbitStatus } from '../enums/arbit.enum';
import { OrderType } from '../enums/order.enum';
import { ExchangeIds, ExchangeLockType } from '../enums/exchange.enum';
import { TriangleArbitEstimate, TriangleArbitSet } from '../arbit.response';



export class TArbitController implements ITArbitController {

    private logService: ILoggingService;
    private arbitService: IArbitService;
    private orderController: OrderController;
    private marketController: MarketController;
    private exchangeOrderService: IExchangeOrderService;
    private getExchangeServiceById: CallableFunction;
        
    constructor(opts) {
        this.logService = opts.logService;
        this.arbitService = opts.arbitService;
        this.orderController = opts.orderController;
        this.marketController = opts.marketController;
        this.exchangeOrderService = opts.exchangeOrderService;
        this.getExchangeServiceById = opts.getExchangeServiceById;
    }

    /*
     * Iterate through the list of all available products at the given 
     * exchange and look for profitable triangle arbits.
     */
    public async findByExchange(
        exchangeId: ExchangeIds
    ): Promise<TriangleArbitModel[]>
    {
        const logId = `TArbitController::findByExchange ex [${exchangeId}] |`;
        const exchangeService = this.getExchangeServiceById(exchangeId);
        
        if (!exchangeService) {
            await this.logService.error(`${logId} unable to load ex service ${exchangeId}`);
            return;
        }

        const exchange = await exchangeService.getModel();
        const arbitSets: TriangleArbitSet[] = await this.arbitService.findSetsByExchange(exchangeId);
        const tarbitModels: TriangleArbitModel[] = [];

        const startTime = + new Date();

        await this.logService.debug(`${logId} found ${arbitSets.length} sets, scanning...`);
                
        for (let i=0; i < arbitSets.length; i++)
        {
            const arbitSet = arbitSets[i];
            const quoteCurrency = arbitSet.firstLegProduct.quoteCurrency;
            let baseSize: number;

            if (quoteCurrency === 'USD') {
                baseSize = exchange.funds;
            } else {
                const stableBase = await this.marketController.getStableConvertRate(quoteCurrency, true, true);
                if (stableBase)
                    baseSize = exchange.funds / stableBase.rate;
            }

            if (!baseSize) {
                this.logService.warn(`${logId} unable to find stable convert for ${quoteCurrency}`);
                continue;
            }
            
            const tarbitModel = await this.create(
                exchangeId,
                baseSize,
                quoteCurrency,  
                arbitSet.firstLegProduct.getCurrencyPair(),
                arbitSet.secondLegProduct.getCurrencyPair(),
                arbitSet.thirdLegProduct.getCurrencyPair()
            );

            if (!tarbitModel)
                continue;

            tarbitModels.push(tarbitModel);
        }

        const endTime = (+ new Date()) - startTime;
        await this.logService.info(`${logId} scanned ${arbitSets.length} sets in ${endTime/1000} seconds`);

        return tarbitModels;
    }


    /*
     * Given a set of 3 currency pairs at one exchange, calculate the
     * complete triangle arbitrage for that set.
     */
    public async create(
        exchangeId: ExchangeIds,
        baseSize: number,
        quoteCurrency: string,
        firstLegCurrencyPair: string,
        secondLegCurrencyPair: string,
        thirdLegCurrencyPair: string,
        parentId?: number
    ) : Promise<TriangleArbitModel>
    {
        const exchangeService = this.getExchangeServiceById(exchangeId);
        if (!exchangeService) {
            await this.logService.error(`TArbitController::create | unable to find exchange ${exchangeId}`);
            return;
        }        

        // 1. Buy the first currency pair (i.e. ETH-USDT)
        const firstLegQuickFill = await this.orderController.getQuickFill(exchangeId, firstLegCurrencyPair, OrderType.LimitBuy, baseSize);

        if (!firstLegQuickFill.bestPrice)
            return;

        // 2. Use the base currency from the first leg to buy the second currency pair (i.e. BTC-ETH)
        const firstLegSize = firstLegQuickFill.size - firstLegQuickFill.takerFee;
        const secondLegQuickFill = await this.orderController.getQuickFill(exchangeId, secondLegCurrencyPair, OrderType.LimitBuy, firstLegSize);

        if (!secondLegQuickFill.bestPrice)
            return;

        // 3. Sell the base currency from the second leg for the quote currency from the first leg to get back to the starting stablecoin (i.e. BTC-USDT)
        const secondLegSize = secondLegQuickFill.size - secondLegQuickFill.takerFee;
        const thirdLegQuickFill = await this.orderController.getQuickFill(exchangeId, thirdLegCurrencyPair, OrderType.LimitSell, secondLegSize);

        if (!thirdLegQuickFill.bestPrice)
            return;

        const thirdLegNet = (thirdLegQuickFill.size * thirdLegQuickFill.bestPrice) - thirdLegQuickFill.takerFee;
        const netDiff = thirdLegNet - baseSize;


        /*
         * This intermediary format TriangleArbitEstimate has *a lot* more information 
         * than what is finally stored in the db. It's useful for debugging etc.
         */
        const arbitEstimate = new TriangleArbitEstimate();

        arbitEstimate.exchangeId = exchangeId;
        arbitEstimate.baseSize = baseSize;
        arbitEstimate.quoteCurrency = quoteCurrency;
        
        arbitEstimate.firstLegQuickFill = firstLegQuickFill;
        arbitEstimate.secondLegQuickFill = secondLegQuickFill;
        arbitEstimate.thirdLegQuickFill = thirdLegQuickFill;
        arbitEstimate.netDiff = netDiff;

        await this.logService.debug(arbitEstimate.getLog());

        // don't store unprofitable tarbits, there's going to be a lot of these
        if (arbitEstimate.netDiff <= 0)
            return;


        const createResponse = await this.arbitService.createTriangleArbitFromEstimate(arbitEstimate, parentId);
        if (!createResponse.isOk()) {
            this.logService.error(`TarbitController::create | unable to store estimate`, arbitEstimate);
            return;
        }
        const tarbitModel: TriangleArbitModel = createResponse.getData();        

        return tarbitModel;
    }


    public async execute(tarbitModel: TriangleArbitModel, repeat?: boolean): Promise<boolean>
    {
        const logId = `TArbitController::execute | tarbit ${tarbitModel.id} |`;
        await this.logService.info(`${logId} ${(repeat ? 'REPEAT | ' : '')}${tarbitModel.getLog()}`);

        if (tarbitModel.status !== ArbitStatus.Created) {
            await this.logService.error(`${logId} refusing to execute with status ${tarbitModel.status}`);
            return false;            
        }

        const netMin = 0.1;

        if (tarbitModel.estNet < netMin) {
            await this.logService.error(`${logId} refusing to execute with netdiff less than ${netMin}`);
            return false;
        }

        const exchangeId = tarbitModel.exchangeId;
        const exchangeService = this.getExchangeServiceById(exchangeId);
        if (!exchangeService) {
            await this.logService.error(`${logId} unable to load ex service ${exchangeId}`);
            return false;
        }

        const exModel = await exchangeService.getModel();
        if (!exModel) {
            await this.logService.error(`${logId} unable to load ex model ${exchangeId}`);
            return false;
        }


        /*
         * Action lock the exchange before attempting to execute trades
         */
        const lockResponse = await exchangeService.getExchangeLock(ExchangeLockType.LockTarbit);
        if (!lockResponse.isOk()) {
            await this.logService.error(`${logId} unable to get ex lock on ex [${exchangeService.getExchangeId()}]`);
            return false;
        }


        /*
         * Update Tarbit status to active
         */
        const updateActiveResponse = await this.arbitService.updateTriangleArbitById(tarbitModel.id, {status: ArbitStatus.Active});
        if (!updateActiveResponse.isOk()) {
            await this.logService.error(`${logId} unable to set status active`);
            return false;            
        }


        /* 
         * Buy the first pair
         */
        const firstOrder: ExchangeOrderModel = await this.orderController.limitOrder(
            exchangeId, 
            OrderType.LimitBuy, 
            tarbitModel.currencyPair1, 
            null, // size
            tarbitModel.estBaseSize // funds
        );

        if (firstOrder)
            await this.arbitService.updateTriangleArbitById(tarbitModel.id, {order_id1: firstOrder.id});
       
        if (!firstOrder || !this.exchangeOrderService.orderIsFilled(firstOrder.status)) {
            await this.arbitService.updateTriangleArbitById(tarbitModel.id, {status: ArbitStatus.Failed});
            await this.logService.error(`${logId} unable to fill first order`);
            return false;
        }

 
        /* 
         * Buy the second pair
         */
        const secondOrder: ExchangeOrderModel = await this.orderController.limitOrder(
            exchangeId, 
            OrderType.LimitBuy, 
            tarbitModel.currencyPair2, 
            null, // size
            firstOrder.getEstimatedNetSize(), // funds
        );

        if (secondOrder)
            await this.arbitService.updateTriangleArbitById(tarbitModel.id, {order_id2: secondOrder.id});

        if (!secondOrder || !this.exchangeOrderService.orderIsFilled(secondOrder.status)) {
            await this.arbitService.updateTriangleArbitById(tarbitModel.id, {status: ArbitStatus.Failed});
            await this.logService.error(`${logId} unable to fill second order`);
            return false;
        }


        /* 
         * Sell the third pair
         */
        const thirdOrder: ExchangeOrderModel = await this.orderController.limitOrder(
            exchangeId, 
            OrderType.LimitSell, 
            tarbitModel.currencyPair3, 
            secondOrder.getEstimatedNetSize(), // size
            null, // funds
        );

        if (thirdOrder)
            await this.arbitService.updateTriangleArbitById(tarbitModel.id, {order_id3: thirdOrder.id});        

        if (!thirdOrder || !this.exchangeOrderService.orderIsFilled(thirdOrder.status)) {
            await this.arbitService.updateTriangleArbitById(tarbitModel.id, {status: ArbitStatus.Failed});
            await this.logService.error(`${logId} unable to fill third order`);
            return false;
        }

        /*
         * Update Tarbit status to completed
         */
        const updateCompletedResponse = await this.arbitService.updateTriangleArbitById(tarbitModel.id, {status: ArbitStatus.Completed});
        if (!updateCompletedResponse.isOk()) {
            await this.logService.error(`${logId} unable to set status completed`);
            return false;            
        }

        /*
         * Release the action lock
         */
        const unlockResponse = await exchangeService.unlockExchange();
        if (!unlockResponse.isOk()) {
            await this.logService.error(`${logId} unable to unlock ex [${exchangeService.getExchangeId()}]`);
            return false;
        }        


        /*
         * Repeat this tarbit, assuming it's still profitable
         */
        if (!repeat)
            return true;

        const newTarbitModel = await this.create(
            exchangeId,
            tarbitModel.estBaseSize,
            tarbitModel.quoteCurrency,
            tarbitModel.currencyPair1,
            tarbitModel.currencyPair2,
            tarbitModel.currencyPair3,
            tarbitModel.id
        );

        if (!newTarbitModel) {
            await this.logService.error(`${logId} unable to create new tarbit model during repeat`, tarbitModel);
            return false;            
        }

        if (newTarbitModel.estNet > netMin)
            return this.execute(newTarbitModel, true);

        return true;
    }
}
