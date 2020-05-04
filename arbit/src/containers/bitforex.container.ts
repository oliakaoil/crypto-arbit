import * as ccxt from 'ccxt';

import { AwilixContainer, asFunction, asClass } from 'awilix';
import { IContainer } from './container.interface';
import { BitforexExchangeService } from '../services/exchanges/bitforex.exchange.service';
import { BitforexWebSocketService } from '../services/wsclients/bitforex.websocket.service';


export class BitforexContainer implements IContainer {

    public register(container: AwilixContainer): void
    {
        container.register({

            bitforexConfig: asFunction(opts => {
                const pEnv = process.env;

                return {
                    apiKey: pEnv.BITFOREX_API_KEY,
                    apiSecret: pEnv.BITFOREX_API_SECRET,
                    wsUrl: pEnv.BITFOREX_WEBSOCKET_URL
                }                
            }),

            bitforexAuthApi: asFunction( opts => {

                const config = opts.bitforexConfig;

                return new ccxt.bitforex({
                    apiKey: config.apiKey,
                    secret: config.apiSecret,
                    timeout: 20000
                });
            }),
                                                
            bitforexExchangeService: asClass(BitforexExchangeService).singleton(),

            bitforexWebsocketService: asClass(BitforexWebSocketService).singleton()
        });
    }
}