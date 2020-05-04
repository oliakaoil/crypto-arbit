import { ILoggingService } from '../services/logging.service.interface';
import { ExchangeIds, ExchangeLockType } from '../enums/exchange.enum';
import { OrderType } from '../enums/order.enum';
import { TransferStatus } from '../enums/transfer.enum';
import { ExchangeTransferModel } from '../models/exchange-transfer.model';
import { IArbitController } from './arbit.controller.interface';
import { ArbitController } from './arbit.controller';
import { TArbitController } from './tarbit.controller';
import { ITArbitController } from './tarbit.controller.interface';
import { TriangleArbitModel } from '../models/triangle-arbit.model';
import { ExchangeOrderModel } from '../models/exchange-order.model';
import { ExchangeOrderbookRepo } from '../repos/exchange-orderbook.repo';
import { ExchangeOrderbookService } from '../services/exchange-orderbook.service';
import { sleep, Timer } from '../helpers';
import { CoinexWebSocketService } from '../services/wsclients/coinex.websocket.service';
import { TriangleArbitSet } from '../arbit.response';


export class UtilController {

    private opts: any;
    private logService: ILoggingService;
        
    constructor(opts) {
        this.logService = opts.logService;
        this.opts = opts;
    }

    public async test() : Promise<boolean>
    {
        const opts = this.opts;

        // Repos
        const exchangeOrderRepo = opts.exchangeOrderRepo;
        const exchangeOrderbookRepo = opts.exchangeOrderbookRepo;
        const coinRepo = opts.coinRepo;

        // Services
        const notifService = opts.notifService;
        const cacheService = opts.cacheService;
        const arbitService = opts.arbitService;
        const exchangeOrderbookService = opts.exchangeOrderbookService;
        const coinService = opts.coinService;
        

        // Exchange Services
        const coinexExchangeService = opts.coinexExchangeService;
        const bittrexExchangeService = opts.bittrexExchangeService;
        //const altillyExchangeService = opts.altillyExchangeService;
        const kucoinExchangeService = opts.kucoinExchangeService;
        const bitforexExchangeService = opts.bitforexExchangeService;
        const bilaxyExchangeService = opts.bilaxyExchangeService;
        const idcmExchangeService = opts.idcmExchangeService;

        // Websocket Services
        const coinexWebSocketService = opts.coinexWebsocketService;
        const bsWebsocketService = opts.bsWebsocketService;
        const kucoinWebsocketService = opts.kucoinWebsocketService;
        const bittrexWebsocketService = opts.bittrexWebsocketService;
        const bitforexWebsocketService = opts.bitforexWebsocketService;
        const bilaxyWebsocketService = opts.bilaxyWebsocketService;
        const idcmWebsocketService = opts.idcmWebsocketService;
        

        // Controllers
        const orderController = opts.orderController;
        const tarbitController: ITArbitController = this.opts.tarbitController;
        const accountController = opts.accountController;
        const marketController = opts.marketController;

        // Timer
        // const timer = new Timer();
        // timer.start();
        // await sleep(4500);
        // const response = timer.stop();


        /*
         * Repos
         */
        //const response: ExchangeOrderModel = await exchangeOrderRepo.getById(4);
        //const response = await exchangeOrderbookRepo.removeAllLevelsByProductId(1);
        //const response = await exchangeOrderbookService.upsertOrderbookLevel(3033, 'ask', 0.00000415, 12345);
        //const response = await exchangeOrderbookService.deleteOrderbookLevel(3033, 'ask', 0.00000415);
        //const response = await coinRepo.upsertConversion('BTC', 'USD', 7705.3456, 'coin-gecko1');
        //const response = await exchangeRepo.findProductByCurrency();
        
        /*
         * Cache Service
         */
        //const response = await cacheService.set('foo',140,30);
        //const response = await cacheService.get('foo');
        //const response = await cacheService.serviceResponseWrapper(cxExchangeService, cxExchangeService.getProductTicker, ['ETH-USD'], 20);

        /*
         * Coin service
         */
        
        //const response = await coinService.getAllCoins();
        //const response = await coinService.getTicker('WCH-BCH');
        //const response = await coinService.getStablecoinTicker('ARTS');

        /*
         * Arbit Service
         */
        // const response = null;
        // const response1 = await arbitService.findSetsByExchange(ExchangeIds.Coinex);
        // response1.map(r => console.log(r.getLog()));

        /*
         * Triangle Arbit Controller
         */
        //const response = await tarbitController.findByExchange(ExchangeIds.Coinex);
        //const response = await tarbitController.create(ExchangeIds.Bitforex, 50, 'USDT', 'BTC-USDT','ETH-BTC','ETH-USDT');
        //const response = await tarbitController.findEstimatesByExchange(sourceExchangeId, funds, false);
        //const response1 = await tarbitController.execute(response, false); console.log(response1);

        /*
         * Tarbit execute
         */
        const exchangeId = ExchangeIds.Coinex;
        const baseSize = 0.01;
        const arbitSets: TriangleArbitSet[] = await arbitService.findSetsByExchange(exchangeId);

        const arbitSet = arbitSets.shift();
        const quoteCurrency = arbitSet.firstLegProduct.quoteCurrency;

        const tarbitModel = await tarbitController.create(
            exchangeId,
            baseSize,
            quoteCurrency,  
            arbitSet.firstLegProduct.getCurrencyPair(),
            arbitSet.secondLegProduct.getCurrencyPair(),
            arbitSet.thirdLegProduct.getCurrencyPair()
        );        

        const response = await tarbitController.execute(tarbitModel, false);

        /*
         * Arbit Controller
         */        
        //const response = await arbitController.createArbit(currency, size, ExchangeIds.Coinbase, ExchangeIds.Coinex);
        //const response = await arbitController.findArbits(ExchangeIds.Coinex, ExchangeIds.Bittrex);
        //const response = await accountController.cryptoTransfer(ExchangeIds.Coinex, ExchangeIds.Coinbase, "ETH", 1.50890022);


        /*
         * Order Controller
         */        
        //const response = await orderController.getQuickFill(ExchangeIds.Coinex, 'ELA-BCH', OrderType.LimitBuy, 3.1830778158373496);
        //const response = await orderController.getQuickFill(sourceExchangeId, currencyPair, OrderType.LimitBuy, funds);
        //const response = await orderController.limitOrder(ExchangeIds.Bitforex, OrderType.LimitBuy, 'LTC-USDT', null, 50);
        //const response = await orderController.limitOrder(ExchangeIds.Bitforex, OrderType.LimitSell, 'LTC-USDT', 0.8943048);
        //const response = await orderController.syncOrderById(2);
        

        /*
         * Market Controller
         */
        const convertAmount = 1500;
        const convertPair = 'XPX-ETH';
        const convertExchange = ExchangeIds.Coinex;

        // const convertPair = 'AEON-XQR';
        // const convertExchange = ExchangeIds.Altilly;

        //const response = await marketController.smartGetOrderbook(ExchangeIds.KuCoin, 'ETH-USDT');
        //const response = await marketController.localizeOrderbookByExchange(ExchangeIds.Bilaxy);
        //  const response = await marketController.convertVolumeUsd(convertExchange, convertPair, convertAmount);
        //const response = await marketController.getStablecoinConvertRate(convertPair, convertExchange);
        //  console.log(`${convertAmount} of ${convertPair} is worth ${response} ~stablecoin`);

        /*
         * Base Exchange Service
         */
        //const response = await bfExchangeService.getExchangeLock(ExchangeLockType.LockTarbit);
        //const response = await bfExchangeService.unlockExchange();



        /*
         * Coinbase
         */        
        //const response = await coinbaseExchangeService.getOrderbook('BTC-USD');
        //const response = await coinbaseExchangeService.getAccounts();

        /*
         * Cexio
         */        
        //const response = await cexioExchangeService.getProductTicker('ETH-USD');
        //const response = await cexioExchangeService.getAllProducts();
        //const response = await cexioExchangeService.getAccounts();
        //const response = await cexioExchangeService.getOrderById('10544953900');
        //const response = await cexioExchangeService.getOrderbook('ETH-USD');        

    
        /*
         * Coinex
         */        
        //const response = await coinexExchangeService.getOrderbook('GNT-ETH');
        //const response = await coinexExchangeService.getProductTicker('GNT-ETH');
        //const response = await coinexExchangeService.getAllProducts();
        //const response = await coinexExchangeService.getAccounts();
        //const response = await coinexExchangeService.getOrderById('8356935195', 'GNT-ETH');
        //const response = coinexWebSocketService.connect();


        /*
         * Bittrex
         */        
        //const response = await bittrexExchangeService.getAccounts();
        //const response = await bittrexExchangeService.getProductTicker('BTC-USD');
        //const response = await bittrexExchangeService.getAllProducts();
        //const response = await bittrexExchangeService.getOrderbook('BTC-ETH');
        //const response = bittrexWebsocketService.connect();

        /*
         * Altilly
         */        
        //const response = await altillyExchangeService.getAllProducts();
        //const response = await altillyExchangeService.getProductTicker('XQR-USDT');
        //const response = await altillyExchangeService.getOrderbook('XQR-USDT');


        /*
         * Bitso
         */        
        //const response = await bsExchangeService.getAllProducts();
        //const response = await bsExchangeService.getProductTicker('ETH-BTC');
        //const response = await bsExchangeService.getOrderbook('MANA-BTC');
        //const response = bsWebsocketService.connect();
        //await exchangeOrderbookService.initOrderbook(response.getData());


        /*
         * KuCoin
         */        
        // const response = await kucoinExchangeService.getAllProducts();
        //const response = await kucoinExchangeService.getProductTicker('BCH-USDT');
        //const response = await kucoinExchangeService.getOrderbook('BCH-USDT');
        //response.getData().printDebug(); process.exit();
        //const response = await kucoinExchangeService.getAccounts();
        //const response = kucoinWebsocketService.connect();

        // await sleep(10000);

        // const orderbook = await orderController.smartGetOrderbook(ExchangeIds.KuCoin, 'ETH-USDT');
        // console.log(orderbook.getBestAsk());process.exit();
        
        
        /*
         * Bitforex
         */
        //const response = await bitforexExchangeService.getAllProducts();
        //const response = await bitforexExchangeService.getProductTicker('ETH-TUSD');
        //const response = await bitforexExchangeService.getOrderbook('KBC-USDT');
        //const response = await bitforexExchangeService.getAccounts();
        //const response = await bitforexExchangeService.limitOrder(OrderType.LimitBuy, 'abc123', 'LTC-USDT', 0.1);
        //const response = await bitforexExchangeService.getOrderById('0c6c831a-1fc1-4498-8de6-57eb2008aa8f', 'BTC-USDT');
        //const response = await bitforexExchangeService.getAllOrders();
        //const response = await bitforexExchangeService.cancelOrder('b904696c-0425-4206-b8d3-cce05fe7e792', 'ETH-USDT');
        //const response = bitforexWebsocketService.connect();
        

        /*
         * Bilaxy
         */        

        //const response = await bilaxyExchangeService.getAllProducts();
        //const response = await bilaxyExchangeService.getProductTicker('WRX-USDT');
        //const response = await bilaxyExchangeService.getOrderbook('EMB-ETH');
        //const response = await bilaxyExchangeService.getRateLimit();
        //const response = bilaxyWebsocketService.connect();

        /*
         * IDCM
         */        

        //const response = await idcmExchangeService.getAllProducts();
        //const response = await idcmExchangeService.getProductTicker('BTC-USDT');
        //const response = await idcmExchangeService.getOrderbook('BTC-USDT');
        //const response = idcmWebsocketService.connect();

        console.log(response);
    
        return true;
    }
}
