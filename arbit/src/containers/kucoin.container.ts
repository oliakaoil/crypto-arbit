import * as ccxt from 'ccxt';
import { AwilixContainer, asFunction, asClass } from 'awilix';
import { IContainer } from './container.interface';
import { KuCoinExchangeService } from '../services/exchanges/kucoin.exchange.service';
import { KuCoinWebsocketService } from '../services/wsclients/kucoin.websocket.service';


export class KuCoinContainer implements IContainer {

    public register(container: AwilixContainer): void
    {
        container.register({

            kuAuthApi: asFunction( opts => {

                const pEnv = process.env;

                return new ccxt.kucoin({
                    apiKey: pEnv.KUCOIN_API_KEY,
                    secret: pEnv.KUCOIN_API_SECRET,
                    passphrase: pEnv.KUCOIN_API_PASSPHRASE,
                    environment: 'live',
                    timeout: 20000
                });
            }),

            kucoinWebsocketService: asClass(KuCoinWebsocketService).singleton(),
                                                
            kucoinExchangeService: asClass(KuCoinExchangeService).singleton(),
        });
    }
}