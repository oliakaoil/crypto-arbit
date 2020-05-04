import * as CEXIO from 'cexio-api-node';
import { AwilixContainer, asFunction, asClass } from 'awilix';
import { IContainer } from './container.interface';
import { CexioExchangeService } from '../services/exchanges/cexio.exchange.service';
import { CexioWebSocketService } from '../services/wsclients/cexio.websocket.service';

export class CexioContainer implements IContainer {

    public register(container: AwilixContainer): void
    {
        container.register({

            cexioConfig: asFunction(opts => {
              const pEnv = process.env;

              return {
                userId: pEnv.CEXIO_USER_ID, 
                apiKey: pEnv.CEXIO_API_KEY, 
                apiSecret: pEnv.CEXIO_API_SECRET,
                wsUrl: pEnv.CEXIO_WEBSOCKET_URL
              };
            }),

            cexioService: asFunction(opts => {
              return new CEXIO().promiseRest;
            }).singleton(),

            cexioAuthService: asFunction((opts) => {
        
              const config = opts.cexioConfig;
          
              return new CEXIO(
                config.userId, 
                config.apiKey, 
                config.apiSecret
              ).promiseRest;
          
            }).singleton(),              
                                              
            cexioExchangeService: asClass(CexioExchangeService).singleton(),

            cexioWebsocketService: asClass(CexioWebSocketService).singleton()
        });
    }
}