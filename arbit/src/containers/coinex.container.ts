import * as ccxt from 'ccxt';
import { AwilixContainer, asFunction, asClass, asValue } from 'awilix';
import { IContainer } from './container.interface';
import { CoinexExchangeService } from '../services/exchanges/coinex.exchange.service';
import { CoinexWebSocketService } from '../services/wsclients/coinex.websocket.service';


export class CoinexContainer implements IContainer {

    public register(container: AwilixContainer): void
    {
        container.register({

            coinexConfig: asFunction((opts) => {

                const pEnv = process.env;
                
                return  {
                    apiKey: pEnv.COINEX_API_KEY,
                    apiSecret: pEnv.COINEX_API_SECRET,
                    wsUrl: pEnv.COINEX_WEBSOCKET_URL
                };
            }),

            coinexAuthApi: asFunction( opts => {

                const coinexConfig = opts.coinexConfig;

                return new ccxt.coinex({
                    apiKey: coinexConfig.apiKey,
                    secret: coinexConfig.apiSecret,
                    timeout: 20000
                });
            }),
                                                
            coinexExchangeService: asClass(CoinexExchangeService).singleton(),

            coinexWebsocketService: asClass(CoinexWebSocketService).singleton()
        });
    }
}