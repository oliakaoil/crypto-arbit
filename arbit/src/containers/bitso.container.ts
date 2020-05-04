import * as ccxt from 'ccxt';
import { AwilixContainer, asFunction, asClass } from 'awilix';
import { IContainer } from './container.interface';
import { BitsoExchangeService } from '../services/exchanges/bitso.exchange.service';
import { BitsoWebsocketService } from '../services/wsclients/bitso.websocket.service';


export class BitsoContainer implements IContainer {

    public register(container: AwilixContainer): void
    {
        container.register({

            bsAuthApi: asFunction(opts => {

                const pEnv = process.env;

                return new ccxt.bitso({
                    apiKey: pEnv.BITSO_API_KEY,
                    secret: pEnv.BITSO_API_SECRET,
                    timeout: 20000
                });
            }),

            bsWebsocketConfig: asFunction(opts => {

                const pEnv = process.env;

                return {
                    url: pEnv.BITSO_WEBSOCKET_URL
                };
            }),

            bsWebsocketService: asClass(BitsoWebsocketService).singleton(),
                                                
            bsExchangeService: asClass(BitsoExchangeService).singleton(),
        });
    }
}