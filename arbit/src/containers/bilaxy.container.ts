import { AwilixContainer, asFunction, asClass } from 'awilix';
import { IContainer } from './container.interface';
import { BilaxyExchangeService } from '../services/exchanges/bilaxy.exchange.service';
import { BilaxyWebSocketService } from '../services/wsclients/bilaxy.websocket.service';


export class BilaxyContainer implements IContainer {

    public register(container: AwilixContainer): void
    {
        container.register({

            bilaxyConfig: asFunction( opts => {

                const pEnv = process.env;

                return {
                  apiUrl: pEnv.BILAXY_API_URL,
                  apiKey: pEnv.BILAXY_API_KEY,
                  apiSecret: pEnv.BILAXY_API_SECRET,
                  wsUrl: pEnv.BILAXY_WEBSOCKET_URL
                };
            }),
                                                
            bilaxyExchangeService: asClass(BilaxyExchangeService).singleton(),

            bilaxyWebsocketService: asClass(BilaxyWebSocketService).singleton()
        });
    }
}