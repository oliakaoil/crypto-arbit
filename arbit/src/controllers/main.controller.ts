import { ITArbitController } from './tarbit.controller.interface';
import { IMainController } from './main.controller.interface';
import { IMarketController } from './market.controller.interface';

import { ICoinService } from '../services/coin.service.interface';
import { ILoggingService } from '../services/logging.service.interface';
import { IArbitService } from '../services/arbit.service.interface';
import { IExchangeService } from '../services/exchanges/exchange.service.interface';

import { ExchangeModel } from '../models/exchange.model';
import { TriangleArbitModel } from '../models/triangle-arbit.model';
import { ExchangeProductModel } from '../models/exchange-product.model';

import { ExchangeIds, ExchangeLocalizeType } from '../enums/exchange.enum';

import { sleep } from '../helpers';
import { PublicTicker } from '../services/coin.service';


export class MainController implements IMainController {

    private cliOpts: any;
    private logService: ILoggingService;
    private arbitService: IArbitService;
    private coinService: ICoinService;
    private tarbitController: ITArbitController;
    private marketController: IMarketController;
    private getExchangeServiceById: CallableFunction;
    private getExchangeWebsocketServiceById: CallableFunction;
   
    constructor(opts) {
        this.cliOpts = opts.cliOpts;
        this.logService = opts.logService;
        this.arbitService = opts.arbitService;
        this.coinService = opts.coinService;
        this.tarbitController = opts.tarbitController;
        this.marketController = opts.marketController;
        this.getExchangeServiceById = opts.getExchangeServiceById;
        this.getExchangeWebsocketServiceById = opts.getExchangeWebsocketServiceById;
    }

    public async showExchangeStats(): Promise<boolean>
    {
        const exchangeId = this.cliOpts.exchangeId;

        const exchangeResponse = await this.arbitService.getExchangeById(exchangeId);
        const exchange = exchangeResponse.getData();

        const productResponse = await this.arbitService.getAllProductsByExchangeId(exchangeId);
        const products = productResponse.getData();
        const activeProductCount = products.filter(product => product.status === 1).length;

        const arbitProductsResponse = await this.arbitService.getArbitExchangeProducts(exchangeId);
        const arbitProducts = arbitProductsResponse.getData();

        const tarbitSets = await this.arbitService.findSetsByExchange(exchangeId);
        
        const stats = [
            { label: 'Name' , value: exchange.name },
            { label: 'Status' , value: exchange.status },
            { label: 'Localize Type' , value: exchange.localizeType },
            { label: 'Tarbit Enabled' , value: exchange.tarbitEnabled },
            { label: 'Num Products', value: products.length },
            { label: 'Num Active Products', value: activeProductCount },
            { label: 'Num Arbit Products', value: arbitProducts.length },
            { label: 'Num Tarbit Sets', value: tarbitSets.length },
        ];

        stats.map(stat => console.log(`${stat.label} : ${stat.value}`));

        console.log("\nTriangle Arbitrage Sets:");
        tarbitSets.map(tarbitSet => console.log(tarbitSet.getLog()));

        return true;
    }

    public async localizeOrderbooksByWebsocket(): Promise<boolean>
    {
        const activeExchanges: ExchangeModel[] = await this.getActiveExchanges();
        const enabledExchanges = activeExchanges.filter(e => e.localizeType === ExchangeLocalizeType.Websocket);

        await this.logService.info(`Enabled exchanges for Websocket localization: ${enabledExchanges.map(e => e.name).join(', ')}`);

        enabledExchanges.map((exchange: ExchangeModel) => {
            const wsService = this.getExchangeWebsocketServiceById(exchange.id);
            if (wsService && !wsService.isConnected())
                wsService.connect();
        });

        return true;
    }

    public async localizeOrderbooksByRest(): Promise<boolean>
    {
        const activeExchanges: ExchangeModel[] = await this.getActiveExchanges();
        const enabledExchanges = activeExchanges.filter(e => e.localizeType === ExchangeLocalizeType.RestAPI);

        await this.logService.info(`Enabled exchanges for REST localization: ${enabledExchanges.map(e => e.name).join(', ')}`);

        enabledExchanges.map((exchange: ExchangeModel) => {
            this.marketController.localizeOrderbookByRestAPI(exchange.id);
        });

        return true;
    }

    public async tarbitScan(): Promise<boolean>
    {

        const logId = `MainController::tarbitScan |`

        const activeExchanges: ExchangeModel[] = await this.getActiveExchanges();
        const enabledExchanges = activeExchanges.filter(e => e.tarbitEnabled);

        await this.logService.info(`${logId} enabled exchanges: ${enabledExchanges.map(e => e.name).join(', ')}`);

        const scanExchange = async (exchangeId: ExchangeIds) => {

            // @todo scanning enabled? need to check db every time, so it can be turned off via db config
            const exchangeModel: ExchangeModel = (await this.arbitService.getExchangeById(exchangeId)).getData();

            if (!exchangeModel || !exchangeModel.tarbitEnabled || !exchangeModel.status) {
                this.logService.warn(`${logId} scanning stopped for exh [${exchangeId}]`);
                return;
            }

            const tarbits = await this.tarbitController.findByExchange(exchangeId);
            
            if (tarbits && tarbits.length) {
                const posTarbits = tarbits.filter((tarbitModel: TriangleArbitModel) => tarbitModel.estNet > 0);

                if (posTarbits.length) {
                    // share the good news
                    posTarbits.map((tarbitModel: TriangleArbitModel) => {
                        this.logService.infoWithNotif(tarbitModel.getLog());
                    });                        

                    // execute the most profitable one
                    const bestTarbit = posTarbits.sort((tarbitModel1: TriangleArbitModel, tarbitModel2: TriangleArbitModel) => { 
                        if (tarbitModel1.estNet === tarbitModel2.estNet)
                            return 0;
                        return (tarbitModel1.estNet > tarbitModel2.estNet ? -1 : 1);
                    }).shift();

                    // In the future we may want to do this async so multiple tarbit can be executed simultaneously, but right now
                    // an exchange is locked if a single tarbit is being executed
                    await this.tarbitController.execute(bestTarbit, true);
                }
            }

            await sleep(300);

            scanExchange(exchangeId);
        };

        enabledExchanges.map(exchange => scanExchange(exchange.id));

        return true;
    }

    public async updateExchangeProducts() : Promise<boolean>
    {
        const logId = `MainController::updateExchangeProducts |`;
        await this.logService.info(`${logId} updating active exchanges and products`);

        const activeExchanges: ExchangeModel[] = await this.getActiveExchanges();

        /*
         * For each active exchange, pull a list of current products from the exchange and make sure
         * they are available locally, then remove any local products which are not listed
         */
        for (let i=0; i < activeExchanges.length; i++)
        {
            const exchangeModel = activeExchanges[i];
            const exchangeId: ExchangeIds = exchangeModel.id;
            const exchangeService: IExchangeService = this.getExchangeServiceById(exchangeId);
            
            await this.logService.info(`${logId} updating ${exchangeModel.name}`);


            /*
             * Ensure that all products listed at the exchange are added
             */
            const currentProductResponse = await exchangeService.getAllProducts();
            if (!currentProductResponse.isOk()) {
                await this.logService.error(`${logId} unable to pull list of current products`);
                continue;
            }         
            
            const currentProducts: ExchangeProductModel[] = currentProductResponse.getData();
            const currentExtIds: Set<string> = new Set();

            for (let j=0; j < currentProducts.length; j++)
            {            
                const product: ExchangeProductModel = currentProducts[j];
                currentExtIds.add(String(product.ext_id));

                await this.logService.debug(`${logId} ${product.getCurrencyPair()}`);

                const updateResponse = await this.arbitService.upsertExchangeProduct(product);

                if (!updateResponse)
                    await this.logService.error(`${logId} unable to upsert exchange product`, product);
            }

            await this.logService.info(`${logId} updated ${currentProducts.length} product(s) for ex [${exchangeService.getExchangeId()}]`);

            /*
             * Disable any local products which are no longer listed
             */

            const localProductResponse = await this.arbitService.getAllProductsByExchangeId(exchangeId);
            if (!localProductResponse.isOk()) {
                await this.logService.error(`${logId} unable to pull list of local products`);
                continue;
            }

            const localProducts = localProductResponse.getData();
            const badLocalProducts = localProducts.filter(p => !currentExtIds.has(p.ext_id));

            for (let k=0; k < badLocalProducts.length; k++)
            {    
                const product: ExchangeProductModel = badLocalProducts[k];
                await this.arbitService.updateExchangeProductById(product.id, { status: 0 });
            }

            await this.logService.info(`${logId} disabled ${badLocalProducts.length} product(s) for ex [${exchangeService.getExchangeId()}]`);
        };


        
        /* 
         * Update 24hr volume for all products
         */
        for (let i=0; i < activeExchanges.length; i++)
        {
            const exchangeModel = activeExchanges[i];
            const exchangeId: ExchangeIds = exchangeModel.id;
            const exchangeService: IExchangeService = this.getExchangeServiceById(exchangeId);

            await this.logService.info(`${logId} updating volume for ex [${exchangeService.getExchangeId()}]`);

            const productResponse = await this.arbitService.getAllProductsByExchangeId(exchangeService.getExchangeId());

            if (!productResponse.isOk()) {
                await this.logService.error(`${logId} unable to pull list of products for exchange`);
                continue;
            }         
            
            const products: ExchangeProductModel[] = productResponse.getData();

            for (let j=0; j < products.length; j++)
            {            
                const product: ExchangeProductModel = products[j];
                const currencyPair: string = product.getCurrencyPair();

                await this.logService.debug(`${logId} ${currencyPair}`);

                const tickerResponse = await exchangeService.getProductTicker(currencyPair);

                if (!tickerResponse.isOk()) {
                    await this.logService.error(`${logId} unable to pull ticker | ex [${exchangeId}] ${currencyPair}`);
                    continue;
                }   

                const ticker = tickerResponse.getData();

                product.volume24hr = ticker.volume;
                product.volume24hrUsd = await this.marketController.convertVolumeStable(exchangeId, currencyPair, ticker.volume);

                if (product.volume24hrUsd === null)
                    product.volume24hrUsd = -1;

                await this.logService.debug(`${logId} ${product.getCurrencyPair()}`);

                const updateResponse = await this.arbitService.upsertExchangeProduct(product);

                if (!updateResponse)
                    await this.logService.error(`${logId} unable to upsert exchange product | ex [${exchangeId}] ${currencyPair}`, product);
            }
        };        

        return true;
    }

    public async updateStablecoinConverts(): Promise<boolean>
    {
        const logId = `MainController::updateStablecoinConverts |`;
        this.logService.info(`${logId} updating stablecoin conversion rates for all active products`);

        const activeExchanges: ExchangeModel[] = await this.getActiveExchanges();        
        const allActiveCurrenciesSet: Set<string> = new Set();
        
        for (let i=0; i < activeExchanges.length; i++)
        {
            const exchangeModel = activeExchanges[i];
            const exchangeId: ExchangeIds = exchangeModel.id;

            const productResponse = await this.arbitService.getAllProductsByExchangeId(exchangeId);

            if (!productResponse.isOk()) {
                await this.logService.error(`${logId} unable to pull list of products for exchange`);
                continue;
            }

            const allProducts = productResponse.getData();
            allProducts
                .filter((product: ExchangeProductModel) => product.volume24hr > 0)
                .map((product: ExchangeProductModel) => allActiveCurrenciesSet.add(product.baseCurrency));
        }

        this.logService.info(`${logId} updating ${allActiveCurrenciesSet.size} products`);

        const allActiveCurrencies: string[] = Array.from(allActiveCurrenciesSet);
        let missingCoins: string[] = [];

        for (let i=0; i < allActiveCurrencies.length; i++)
        {        
            const baseCurrency = allActiveCurrencies[i];

            this.logService.debug(`${logId} ${baseCurrency}`);

            const stableConvert = await this.marketController.getStableConvertRate(baseCurrency);

            if (!stableConvert) {
                this.logService.warn(`${logId} unable to find stable conversion for ${baseCurrency}`);  
                missingCoins.push(baseCurrency);
                continue;
            }

            await this.coinService.upsertConversion(
                baseCurrency, 
                stableConvert.quoteCurrency, 
                stableConvert.rate,
                stableConvert.source
            );     
        }

        this.logService.info(`${logId} could not find stablecoin conversion for ${missingCoins.length} currencies`, missingCoins);
        return true;
    }

    // get all products
    // for each product, get the publiccoin ticker
    // update the 24hr vol usd value for the product

    private async getActiveExchanges(): Promise<ExchangeModel[]>
    {
        const allExResponse = await this.arbitService.getActiveExchanges();
        if (!allExResponse.isOk()) {
            await this.logService.error(`MainController::getActiveExchanges | could not retrieve all exchanges`);
            return [];
        }

        const allExchanges: ExchangeModel[] = allExResponse.getData();

        if (!this.cliOpts.exchangeId)
            return allExchanges;

            
        return [
            allExchanges.find(e => e.id === this.cliOpts.exchangeId)
        ];
    }
}
