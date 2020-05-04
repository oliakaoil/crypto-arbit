import { AwilixContainer, asFunction, asClass } from 'awilix';
import { IContainer } from './container.interface';
import { AltillyExchangeService } from '../services/exchanges/altilly.exchange.service';
import altillyApi from 'nodeAltillyApi';


export class AltillyContainer implements IContainer {

    public register(container: AwilixContainer): void
    {
        container.register({

            altillyAuthService: asFunction((opts) => {
              const pEnv = process.env;

              return new altillyApi(
                pEnv.ALTILLY_API_KEY, 
                pEnv.ALTILLY_API_SECRET, 
                pEnv.ALTILLY_API_URL
              );
            }),
                                              
            altillyExchangeService: asClass(AltillyExchangeService).singleton(),
        });
    }
}