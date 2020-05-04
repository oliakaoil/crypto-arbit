import { IMarketController } from './market.controller.interface';

import { ICacheService } from '../services/cache.service.interface';
import { ILoggingService } from '../services/logging.service.interface';
import { IArbitService } from '../services/arbit.service.interface';
import { ICoinService } from '../services/coin.service.interface';

import { ExchangeProductModel } from '../models/exchange-product.model';

import { ServiceResponse } from '../service.response';
import { ExchangeOrderbook, ExchangeTicker } from '../exchange.response';
import { ExchangeIds, ExchangeLocalizeType } from '../enums/exchange.enum';

import { sleep, Timer, getQuoteFromPair, getBaseFromPair } from '../helpers';
import { CurrencyConvertModel } from '../models/currency-convert.model';
import { PublicTicker } from '../services/coin.service';


export class MarketController implements IMarketController {

    private logService: ILoggingService;
    private cacheService: ICacheService;
    private arbitService: IArbitService;
    private coinService: ICoinService;
    private getExchangeServiceById: CallableFunction;
    private getExchangeWebsocketServiceById: CallableFunction;
        
    constructor(opts) {
        this.logService = opts.logService;
        this.cacheService = opts.cacheService;
        this.arbitService = opts.arbitService;
        this.coinService = opts.coinService;
        this.getExchangeServiceById = opts.getExchangeServiceById;
        this.getExchangeWebsocketServiceById = opts.getExchangeWebsocketServiceById;
    }

    public async smartGetOrderbook(
        exchangeId: ExchangeIds, 
        currencyPair: string
    ): Promise<ExchangeOrderbook>
    {
        const logId = `MarketController::smartGetOrderbook | ex [${exchangeId}] ${currencyPair} |`;

        // 1. Most efficient, pull from running websocket service memory
        const exchangeWebsocketService = this.getExchangeWebsocketServiceById(exchangeId);
        if (exchangeWebsocketService) {
            const wsOrderbook: ExchangeOrderbook = exchangeWebsocketService.getOrderbook(currencyPair);

            if (wsOrderbook && wsOrderbook.primed && wsOrderbook.dequeueing) {
                return wsOrderbook;
            }
        }

        // 2. WS not available, try to pull from the cache
        const cacheOrderbook = await this.getOrderbookFromCache(exchangeId, currencyPair);

        if (cacheOrderbook)
            return cacheOrderbook;


        // 3. WS and Cache not available, hit the REST API
        const exchangeService = this.getExchangeServiceById(exchangeId);
        if (!exchangeService) {
            await this.logService.warn(`${logId} unable to load ex service`);
            return;
        }      
        const apiOrderbookResponse = await exchangeService.getOrderbook(currencyPair);

        if (!apiOrderbookResponse.isOk()) {
            await this.logService.warn(`${logId} unable to pull orderbook`);
            return;
        }        
 
        const orderbook: ExchangeOrderbook = apiOrderbookResponse.getData();

        return orderbook;           
    }    

    public async getOrderbookFromCache(
        exchangeId: ExchangeIds, 
        currencyPair: string
    ): Promise<ExchangeOrderbook>
    {
        const logId = `MarketController::getOrderbookFromCache | ex [${exchangeId}] ${currencyPair} |`;

        const exchangeService = this.getExchangeServiceById(exchangeId);
        if (!exchangeService) {
            await this.logService.warn(`${logId} unable to load ex service`);
            return;
        }        

        const orderbookResponse = await this.cacheService.getServiceResponse(
            exchangeService, 
            exchangeService.getOrderbook, 
            [currencyPair]
        );        

        if (!orderbookResponse.isOk()) {
            await this.logService.warn(`${logId} unable to pull orderbook`);
            return;
        }

        const orderbook: ExchangeOrderbook = orderbookResponse.getData();        

        return orderbook;        
    }        


    public async localizeOrderbookByRestAPI(exchangeId: ExchangeIds): Promise<boolean>
    {
        const logId = `MarketController::localOrderbookByExchange | ex [${exchangeId}] |`;
        let orderbookErrorCount = 0;
        const maxOrderbookErrors = 50;

        const exchangeService = this.getExchangeServiceById(exchangeId);
        if (!exchangeService) {
            await this.logService.warn(`${logId} unable to load ex service`);
            return false;
        }

        const exchangeModel = await exchangeService.getModel();

        if (exchangeModel.localizeType !== ExchangeLocalizeType.RestAPI) {
            await this.logService.warn(`${logId} localize via REST API not enabled`);
            return false;
        }

        const productResponse = await this.arbitService.getArbitExchangeProducts(exchangeService.getExchangeId());
        if (!productResponse.isOk()) {
            await this.logService.warn(`${logId} unable to load products`);
            return false;            
        }
        const exchangeProducts = productResponse.getData();

        await this.logService.debug(`${logId} processing ${exchangeProducts.length} products`);

        const timer = new Timer();
        const exchangeTweaks = exchangeService.getTweaks();

        const productBatches: ExchangeProductModel[][] = [];
        const productCount = exchangeProducts.length;

        do {

            productBatches.push(exchangeProducts.splice(0,exchangeTweaks.apiRateLimitOrderbook));

        } while(exchangeProducts.length);

        const exchangeTimer = new Timer();
        exchangeTimer.start();

        await this.logService.debug(`${logId} processing ${productBatches.length} batches`);

        for (let i=0; i<productBatches.length;i++) {

            const productBatch: ExchangeProductModel[] = productBatches[i];

            timer.start();

            const promises = productBatch.map((exchangeProduct: ExchangeProductModel) => {

                return this.cacheService.serviceResponseWrapper(
                    exchangeService, 
                    exchangeService.getOrderbook, 
                    [exchangeProduct.getCurrencyPair()], 
                    15,
                    true
                );
            });

            let result: ServiceResponse[];

            try {
                result = await Promise.all(promises);
            } catch(err) {
                await this.logService.error(`${logId} api error`, err);
                return false;                  
            }

            const ordebrookTime = timer.stop();

            // if there were any errors make sure this process stops
            let orderbookError = false;
            result.map((orderbookResponse) => {
                if (!orderbookResponse.isOk())
                    orderbookError = true;
            });

            if (orderbookError) {
                orderbookErrorCount++;
                await this.logService.debug(`${logId} orderbook error | count [${orderbookErrorCount}]`);

                await sleep(2000);

                if (orderbookErrorCount >= maxOrderbookErrors) {
                    await this.logService.debug(`${logId} orderbook error | max errors of ${maxOrderbookErrors} reached, terminating localization process`);
                    return false;
                }
            }

            // did the request response take a shorter amount of time than the rate limit? wait the different plus a small buffer
            if (ordebrookTime.ms < 1000) {
                const rateLimitSleepTime = 1000 - ordebrookTime.ms + 10;
                await this.logService.debug(`${logId} rate-limit sleeping ${rateLimitSleepTime}ms`);
                await sleep(rateLimitSleepTime);
            }
        }

        const exchangeTime = exchangeTimer.stop();

        // orderbooks were successfully localized, sleep a little to help make good time, then pull them again
        await this.logService.debug(`Localized ${productCount} products in ${exchangeTime.seconds} seconds`);

        return this.localizeOrderbookByRestAPI(exchangeId);
    }    

    /*
     * Convert the volume for a given currency pair into stable so it can more easily be assessed
     */
    public async convertVolumeStable(
        exchangeId: ExchangeIds,
        currencyPair: string,
        volume: number
    ): Promise<number> {
        const logId = `MarketController::convertVolumeUsd | ex [${exchangeId}] | cp ${currencyPair}`; 

        if (!volume)
            return 0;

        const currencyConvert = await this.getStableConvertRate(getBaseFromPair(currencyPair));

        if (!currencyConvert) {
            this.logService.error(`${logId} unable to find conversion rate`);
            return;            
        }

        return (volume * currencyConvert.rate);
    }

    public async getStableConvertRate(
        baseCurrency: string,
        skipPublic?: boolean,
        skipExchanges?: boolean
    ): Promise<{ rate: number, baseCurrency: string, quoteCurrency: string, source: string }>
    {
        const logId = `MarketController::getStablecoinConvertRate | base ${baseCurrency} |`;


        /*
         * 1. Is there a conversion rate already available in the conversion table?
         */

        const allConvertsResponse = await this.coinService.findConverts([baseCurrency]);

        if (!allConvertsResponse.isOk()) {
            this.logService.error(`${logId} unable to load stablecoin conversions`);
            return;
        }

        const allConverts = allConvertsResponse.getData();


        if (allConverts && allConverts.length) {

            // a. Is there a USD pair?
            const usdConvertPair = allConverts.find((convert: CurrencyConvertModel) => convert.quoteCurrency.match(/^USD.*/));
            if (usdConvertPair)
                return { 
                    baseCurrency: baseCurrency,
                    quoteCurrency: usdConvertPair.quoteCurrency,
                    rate: usdConvertPair.rate, 
                    source: usdConvertPair.source
                };

            // b. Is there a stablecoin or non-USD fiat pair?
            const stableConvertPair = allConverts.find((convert: CurrencyConvertModel) => { 
                return (
                    this.coinService.isStablecoin(convert.quoteCurrency) || 
                    this.coinService.isFiat(convert.quoteCurrency)
                );
            });
          
            if (stableConvertPair)
                return { 
                    baseCurrency: baseCurrency,
                    quoteCurrency: stableConvertPair.quoteCurrency,                    
                    rate: stableConvertPair.rate, 
                    source: stableConvertPair.source 
                };


            // c. Is there a popcoin pair?
            const popularConvertPair = allConverts.find((convert: CurrencyConvertModel) => {
                return (this.coinService.getPopCoins().indexOf(convert.quoteCurrency) > -1);
            });

            if (popularConvertPair) {

                const psConvertPair = await this.getPreferredStableConvert(popularConvertPair.quoteCurrency);

                if (psConvertPair) {
                    return { 
                        baseCurrency: baseCurrency,
                        quoteCurrency: popularConvertPair.quoteCurrency,                          
                        rate: (popularConvertPair.rate * psConvertPair.rate), 
                        source: psConvertPair.source 
                    };
                }
            }
        }



        /*
         * 2. Is there a conversion rate available at the public API
         */
        if (!skipPublic) {
            const publicConvertResponse = await this.coinService.getStablecoinTicker(baseCurrency);
            if (!publicConvertResponse.isOk()) {
                this.logService.error(`${logId} unable to query for public stablecoin pairs`);
                return;
            }
            const publicConvert: PublicTicker = publicConvertResponse.getData();
            
    
            if (publicConvert) {
    
                // this is a stable pair, this rate can be used directly
                if (!this.coinService.isPopcoin(publicConvert.getCurrencyPair()))
                    return { 
                        baseCurrency: baseCurrency,
                        quoteCurrency: publicConvert.quoteCurrency,                    
                        rate: publicConvert.price, 
                        source: publicConvert.source 
                    };
    
                // this is a popcoin pair, convert to stable
                const psConvertPair = await this.getPreferredStableConvert(publicConvert.quoteCurrency);
    
                if (psConvertPair) {
                    return { 
                        baseCurrency: baseCurrency,
                        quoteCurrency: publicConvert.quoteCurrency,                          
                        rate: (publicConvert.price * psConvertPair.rate), 
                        source: psConvertPair.source 
                    };
                }
            }
        }


        if (skipExchanges)
            return;

        this.logService.debug(`${logId} no public conversions available, attempting active exchange lookup`);

        /*
         * 3. Is there enough information at any active exchange to make a conversion?
         */        

        // a. Is there a stablecoin/fiat pair? @todo include more fiats?
        const exStablecoinPairResponse = await this.coinService.findExchangeStablecoinPairs(baseCurrency);
        if (!exStablecoinPairResponse.isOk()) {
            this.logService.error(`${logId} unable to query for exchange stablecoin pairs`);
            return;
        }
        const exStablecoins: ExchangeProductModel[] = exStablecoinPairResponse.getData();

        if (exStablecoins.length) {
            const exStablecoin = exStablecoins.shift();

            const exchangeService = this.getExchangeServiceById(exStablecoin.exchangeId);
            if (!exchangeService) {
                this.logService.warn(`${logId} unable to load ex service for stablecoin pair`);
                return;
            }

            const ticker: ExchangeTicker = (await exchangeService.getProductTicker(exStablecoin.getCurrencyPair())).getData();

            if (ticker) {
                return {
                    baseCurrency: baseCurrency,
                    quoteCurrency: getQuoteFromPair(ticker.currencyPair),
                    rate: ticker.price,
                    source: `ex [${exStablecoin.exchangeId}]`
                };
            }
        }

        // b. Is there a popcoin pair?
        const exPopcoinPairResponse = await this.coinService.findExchangePopcoinPairs(baseCurrency);
        if (!exPopcoinPairResponse.isOk()) {
            this.logService.error(`${logId} unable to query for exchange popcoin pairs`);
            return;
        }
        const exPopcoins: ExchangeProductModel[] = exPopcoinPairResponse.getData();
        if (exPopcoins.length) {
            const exPopcoin = exPopcoins.shift();

            const exchangeService = this.getExchangeServiceById(exPopcoin.exchangeId);
            if (!exchangeService) {
                this.logService.warn(`${logId} unable to load ex service for popcoin pair`);
                return;
            }            

            const ticker:ExchangeTicker = (await exchangeService.getProductTicker(exPopcoin.getCurrencyPair())).getData();

            // get the exchange rate for the popcoin
            const psConvertPair = await this.getPreferredStableConvert(exPopcoin.quoteCurrency);

            if (ticker && psConvertPair) {
                return {
                    baseCurrency: baseCurrency,
                    quoteCurrency: getQuoteFromPair(ticker.currencyPair),
                    rate: (ticker.price * psConvertPair.rate),
                    source: `ex [${exPopcoin.exchangeId}]`
                };
            }
        }

    }

    private async getPreferredStableConvert(baseCurrency: string): Promise<CurrencyConvertModel>
    {
        const psConvertResponse = await this.coinService.findStableConverts(baseCurrency);
        if (!psConvertResponse.isOk()) {
            this.logService.error(`MarketController::getPreferredStableConvert | unable to query for public stablecoin conversions`);
        }
        const psConverts = psConvertResponse.getData();

        if (!psConverts || !psConverts.length)
            return;

        let psConvertPair:CurrencyConvertModel;

        // prefer usd
        psConvertPair = psConverts.find((convert: CurrencyConvertModel) => convert.quoteCurrency.match(/^USD.*/));

        // Any other stablecoin
        if (!psConvertPair) {
            psConvertPair = psConverts.shift();
        }

        return psConvertPair;
    }
}
