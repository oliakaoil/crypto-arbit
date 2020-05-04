import { AwilixContainer, asFunction, asClass } from 'awilix';
import { IContainer } from './container.interface';
import { IdcmExchangeService } from '../services/exchanges/idcm.exchange.service';
import { IdcmWebSocketService } from '../services/wsclients/idcm.websocket.service';

export class IdcmContainer implements IContainer {

    public register(container: AwilixContainer): void
    {
        container.register({

            idcmConfig: asFunction(opts => {
              const pEnv = process.env;

              return {
                apiUrl: pEnv.IDCM_API_URL,
                apiKey: pEnv.IDCM_API_KEY, 
                apiSecret: pEnv.IDCM_API_SECRET,
                wsUrl: pEnv.IDCM_WEBSOCKET_URL
              };
            }),
                                                     
            idcmExchangeService: asClass(IdcmExchangeService).singleton(),

            idcmWebsocketService: asClass(IdcmWebSocketService).singleton()

        });
    }
}