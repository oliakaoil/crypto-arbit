import { BittrexClient } from 'bittrex-node';
import { AwilixContainer, asFunction, asClass } from 'awilix';
import { IContainer } from './container.interface';
import { BittrexExchangeService } from '../services/exchanges/bittrex.exchange.service';
import { BittrexWebSocketService } from '../services/wsclients/bittrex.websocket.service';


export class BittrexContainer implements IContainer {

    public register(container: AwilixContainer): void
    {
        container.register({

            bittrexAuthApi: asFunction(opts => {

                const pEnv = process.env;

                return new BittrexClient({
                    apiKey: pEnv.BITTREX_API_KEY,
                    apiSecret: pEnv.BITTREX_API_SECRET,
                    timeout: 20000
                  });
            }),

            bittrexWsConfig: asFunction(opts => {

                const pEnv = process.env;

                return {
                    url: pEnv.BITTREX_WEBSOCKET_URL,
                    apiKey: pEnv.BITTREX_API_KEY,
                    secret: pEnv.BITTREX_API_SECRET                    
                };
            }),

            bittrexExchangeService: asClass(BittrexExchangeService).singleton(),

            bittrexWebsocketService: asClass(BittrexWebSocketService).singleton()
        });
    }
}