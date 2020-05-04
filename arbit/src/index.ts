import * as dotenv from 'dotenv';
import * as commandLineArgs from 'command-line-args';
import { createContainer, asValue, asClass, asFunction } from 'awilix';
import * as moment from 'moment';
import * as path from 'path';

import { WebClient } from '@slack/web-api';

import { LoggingService } from './services/logging.service';
import { IDatabaseService } from './services/database.service.interface';
import { DatabaseService } from './services/database.service';
import { ICacheService } from './services/cache.service.interface';
import { CacheService } from './services/cache.service';
import { NotifService } from './services/notif.service';
import { ConfigService } from './services/config.service';
import { ArbitService } from './services/arbit.service';
import { ExchangeOrderService } from './services/exchange-order.service';
import { ExchangeOrderbookService } from './services/exchange-orderbook.service';
import { CoinService } from './services/coin.service';

import { ConfigRepo } from './repos/config.repo';
import { ExchangeRepo } from './repos/exchange.repo';
import { ArbitRepo } from './repos/arbit.repo';
import { ExchangeOrderRepo } from './repos/exchange-order.repo';
import { ExchangeOrderbookRepo } from './repos/exchange-orderbook.repo';
import { CoinRepo } from './repos/coin.repo';

import { MainController } from './controllers/main.controller';
import { UtilController } from './controllers/util.controller';
import { OrderController } from './controllers/order.controller';
import { TArbitController } from './controllers/tarbit.controller';
import { AccountController } from './controllers/account.controller';
import { MarketController } from './controllers/market.controller';

import { ConfigModel } from './models/config.model';
import { ExchangeModel } from './models/exchange.model';
import { ExchangeProductModel } from './models/exchange-product.model';
import { ExchangeOrderModel } from './models/exchange-order.model';
import { ExchangeMetaModel } from './models/exchange-meta.model';
import { ExchangeTransferModel } from './models/exchange-transfer.model';
import { TriangleArbitModel } from './models/triangle-arbit.model';
import { ExchangeOrderbookModel } from './models/exchange-orderbook.model';
import { CurrencyConvertModel } from './models/currency-convert.model';

import { ExchangeIds } from './enums/exchange.enum';

import { CoinbaseContainer } from './containers/coinbase.container';
import { CoinexContainer } from './containers/coinex.container';
import { BittrexContainer } from './containers/bittrex.container';
import { CexioContainer } from './containers/cexio.container';
import { BitsoContainer } from './containers/bitso.container';
import { KuCoinContainer } from './containers/kucoin.container';
import { AltillyContainer } from './containers/altilly.container';
import { BitforexContainer } from './containers/bitforex.container';
import { BilaxyContainer } from './containers/bilaxy.container';
import { IdcmContainer } from './containers/idcm.container';

import { IExchangeService } from './services/exchanges/exchange.service.interface';
import { IWebSocketService } from './services/wsclients/websocket.service.interface';


dotenv.config({path: path.join(__dirname, '.env')});

// For IDCM websocket
// https://stackoverflow.com/questions/56293822/how-to-fix-eproto-error-after-upgrading-nodes-version
require('tls').DEFAULT_MIN_VERSION = 'TLSv1';

process.on('uncaughtException', (err) => {
    console.error(err);
    process.exit(1);
  });

process.on('unhandledRejection', (err) => {
    console.error(err);
    process.exit(1);
  });

// https://stackoverflow.com/questions/18391212/is-it-not-possible-to-stringify-an-error-using-json-stringify
if (!('toJSON' in Error.prototype))
  Object.defineProperty(Error.prototype, 'toJSON', {
      value: function () {
          var alt = {};
  
          Object.getOwnPropertyNames(this).forEach(function (key) {
              alt[key] = this[key];
          }, this);
  
          return alt;
      },
      configurable: true,
      writable: true
  });



const cliOpts = commandLineArgs([
  {name: 'mode', type: String, defaultValue: ''},
  {name: 'exchangeId', type: Number, defaultValue: 0},
  {name: 'help', type: Boolean, defaultValue: false}
]);

const modes = {
  // Main
  'exchange-stats': { desc: 'Show info and statistics for the given exchange' },
  'localize': { desc: 'Localize orderbooks for all active exchanges using either REST API or WebSocket' },
  'localize-rest': { desc: 'Localize orderbooks for all active exchanges via REST API' },
  'localize-websocket': { desc: 'Localize orderbooks for all active exchanges via WebSocket' },
  'tarbit-scan': { desc: 'Scan for triangle arbitrage opportunities' },
  //'arbit-find': { desc: 'Check for arbitrage conditions between exchanges' },
  //'arbit-find': { desc: 'Check for triangle arbitrage conditions at 1 exchange' },
  'update-exchange-products': { desc: 'Sync the list of available products for all exchanges' },
  'update-converts': { desc: 'Update the public stablecoin conversion rates for all active products' },

  // Utilities
  'test': { desc: 'Run arbitrary test code' },
  'db-migrate': { desc: 'Run Sequelize database migrations' },
  'cache-flush': { desc: 'Flush Memcache' }
};

const validModes = Object.keys(modes);

if (cliOpts.help || validModes.indexOf(cliOpts.mode) === -1) {
    console.error(`Invalid/missing mode: ${cliOpts.mode}\nTry one of these:`);
    validModes.forEach(m => {
      const mode = modes[m];
      console.log(`${m}: ${mode.desc}`);
    });

    process.exit(1);
}


console.log('WARNING: Live Trading Enabled');


       
/*
 * Initialize and register the IoC container
 */

const container = createContainer();

container.register({
  cliOpts: asValue(cliOpts),
  appEnv: asFunction(opts => {

    const pEnv = process.env;

    return {
      'NODE_ENV': pEnv.NODE_ENV,
      'LOG_LEVEL': pEnv.LOG_LEVEL,

      'MYSQL_HOST': pEnv.MYSQL_HOST, 
      'MYSQL_DATABASE': pEnv.MYSQL_DATABASE,
      'MYSQL_USER': pEnv.MYSQL_USER,
      'MYSQL_PASSWORD': pEnv.MYSQL_PASSWORD,
      'MYSQL_DEBUG': (pEnv.MYSQL_DEBUG === '1'),

      'MEMCACHED_HOST': pEnv.MEMCACHED_HOST,
      'MEMCACHED_PREFIX': pEnv.MEMCACHED_PREFIX,
      
      'SLACK_OAUTH_ACCESS_TOKEN': pEnv.SLACK_OAUTH_ACCESS_TOKEN,
      'SLACK_NOTIF_CHANNEL_ID': pEnv.SLACK_NOTIF_CHANNEL_ID,
      'SLACK_IM_ID': pEnv.SLACK_IM_ID,

      'COINGECKO_API_URL': pEnv.COINGECKO_API_URL
    };
    
  }),

  logService: asClass(LoggingService).singleton(),

  slackService: asFunction((opts) : WebClient => {

    return new WebClient(opts.appEnv.SLACK_OAUTH_ACCESS_TOKEN);

  }).singleton(),

  dbService: asFunction((opts): IDatabaseService => {
    
    const dbService = new DatabaseService(opts);

    dbService.connect();
    dbService.initModel(new ConfigModel());
    dbService.initModel(new ExchangeModel());
    dbService.initModel(new ExchangeProductModel());
    dbService.initModel(new ExchangeOrderModel());
    dbService.initModel(new ExchangeMetaModel());
    dbService.initModel(new ExchangeTransferModel());
    dbService.initModel(new TriangleArbitModel());
    dbService.initModel(new ExchangeOrderbookModel());
    dbService.initModel(new CurrencyConvertModel());

    dbService.initSchema();
        
    return dbService;

  }).singleton(),

  cacheService: asFunction((opts): ICacheService => {

    const cacheService = new CacheService(opts);

    cacheService.connect();

    return cacheService;

  }).singleton(),

  notifService: asClass(NotifService).singleton(),
  configService: asClass(ConfigService).singleton(),
  arbitService: asClass(ArbitService).singleton(),
  exchangeOrderService: asClass(ExchangeOrderService).singleton(),
  exchangeOrderbookService: asClass(ExchangeOrderbookService).singleton(),
  coinService: asClass(CoinService).singleton(),

  configRepo: asClass(ConfigRepo).singleton(),
  exchangeRepo: asClass(ExchangeRepo).singleton(),
  exchangeOrderRepo: asClass(ExchangeOrderRepo).singleton(),
  arbitRepo: asClass(ArbitRepo).singleton(),
  exchangeOrderbookRepo: asClass(ExchangeOrderbookRepo).singleton(),
  coinRepo: asClass(CoinRepo).singleton(),

  mainController: asClass(MainController).singleton(),
  utilController: asClass(UtilController).singleton(),
  orderController: asClass(OrderController).singleton(),
  tarbitController: asClass(TArbitController).singleton(),
  accountController: asClass(AccountController).singleton(),
  marketController:  asClass(MarketController).singleton(),

  fiat: asValue(new Set([
    'USD', // us dollars
    'MXN', // mexican peso
    'GBP', // british pound
    'EUR', // euros
  ])),

  // https://coincodex.com/stablecoins
  stablecoins: asValue(new Set([
      'TUSD',
      'USDC',
      'USDT',
      'USDK',
      'BGBP', 
      'PAX',
      'EOSDT',
      'GUSD',
      'DAI'
  ])),

  popcoins: asValue(new Set([
    'BTC', // bitcoin
    'BCH', // bitcoin cash
    'ETH' // ethereum
  ]))
});


/* 
 * Register and enable exchanges
 */
new CoinbaseContainer().register(container);
new CoinexContainer().register(container);
new BittrexContainer().register(container);
new CexioContainer().register(container);
new BitsoContainer().register(container);
new KuCoinContainer().register(container);
new AltillyContainer().register(container);
new BitforexContainer().register(container);
new BilaxyContainer().register(container);
new IdcmContainer().register(container);


container.register({
  getExchangeServiceMap: asValue((): Map<ExchangeIds, IExchangeService> =>{

    const exMap = new Map<ExchangeIds, IExchangeService>();

    // Coinbase
    exMap.set(ExchangeIds.Coinbase, container.cradle.coinbaseExchangeService);

    // Coinex
    exMap.set(ExchangeIds.Coinex, container.cradle.coinexExchangeService);

    // Bittrex
    exMap.set(ExchangeIds.Bittrex, container.cradle.bittrexExchangeService);

    // Cex.io
    exMap.set(ExchangeIds.Cexio, container.cradle.cexioExchangeService);

    // Bitso
    exMap.set(ExchangeIds.Bitso, container.cradle.bsExchangeService);

    // KuCoin
    exMap.set(ExchangeIds.KuCoin, container.cradle.kucoinExchangeService);

    // Altilly
    exMap.set(ExchangeIds.Altilly, container.cradle.altillyExchangeService);

    // Bitforex
    exMap.set(ExchangeIds.Bitforex, container.cradle.bitforexExchangeService);

    // Bilaxy
    exMap.set(ExchangeIds.Bilaxy, container.cradle.bilaxyExchangeService);

    // IDCM
    exMap.set(ExchangeIds.Idcm, container.cradle.idcmExchangeService);

    return exMap;
  }),

  getExchangeWebsocketServiceMap: asValue((): Map<ExchangeIds, IWebSocketService> => {
    const exMap = new Map<ExchangeIds, IWebSocketService>();

    // Coinex
    exMap.set(ExchangeIds.Coinex, container.cradle.coinexWebsocketService);

    // Bittrex
    exMap.set(ExchangeIds.Bittrex, container.cradle.bittrexWebsocketService);

    // Bitforex
    exMap.set(ExchangeIds.Bitforex, container.cradle.bitforexWebsocketService);

    // KuCoin
    exMap.set(ExchangeIds.KuCoin, container.cradle.kucoinWebsocketService);

    // Bilaxy
    exMap.set(ExchangeIds.Bilaxy, container.cradle.bilaxyWebsocketService);

    // IDCM
    exMap.set(ExchangeIds.KuCoin, container.cradle.idcmWebsocketService);

    return exMap;
  }),

  getExchangeServiceById: asValue((exchangeId: ExchangeIds) => {
    const exServiceMap = container.cradle.getExchangeServiceMap();
    return exServiceMap.get(exchangeId);
  }),

  getExchangeWebsocketServiceById: asValue((exchangeId: ExchangeIds) => {
    const exServiceMap = container.cradle.getExchangeWebsocketServiceMap();
    return exServiceMap.get(exchangeId);
  })
})


const currentDate = moment().utc().format('YYYY-MM-DD hh:mm:ss');
console.log(`Starting | ${currentDate} | ${JSON.stringify(cliOpts)}`);

/*
 * Route the cli-requested mode to the correct controller and route handler
 */
switch (cliOpts.mode) {

    case 'exchange-stats':

      container.cradle.mainController.showExchangeStats();

    break;

    case 'localize':

      container.cradle.mainController.localizeOrderbooksByWebsocket();                        
      container.cradle.mainController.localizeOrderbooksByRest();

    break;

    case 'localize-websocket':

      container.cradle.mainController.localizeOrderbooksByWebsocket();

    break;  

    case 'localize-rest':

      container.cradle.mainController.localizeOrderbooksByRest();

    break;

    case 'tarbit-scan':

      container.cradle.mainController.tarbitScan();
        
    break;

    case 'arbit-find':

      (async () => {

        await container.cradle.arbitController.findTriangleArbitEstimatesByExchange(
          ExchangeIds.Coinex
        );

        // await container.cradle.arbitController.findArbits(
        //   ExchangeIds.Cexio,
        //   ExchangeIds.Coinex
        // );

        process.exit();

      })();
    break;

    case 'update-exchange-products':

      (async () => {

        await container.cradle.mainController.updateExchangeProducts();

        process.exit();

      })();

    break;

    case 'update-converts':

      (async () => {

        await container.cradle.mainController.updateStablecoinConverts();

        process.exit();

      })();    

    break;


    case 'test':

      (async () => {

        await container.cradle.utilController.test();
        
      })();      

    break;

    case 'db-migrate':

      container.cradle.dbService.migrate();

    break;

    case 'cache-flush':

      container.cradle.cacheService.flush();

    break;

    default:

      console.error(`Unkonw mode ${cliOpts.mode}`);
}
