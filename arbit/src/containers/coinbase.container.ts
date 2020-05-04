import { AwilixContainer, asFunction, asClass } from 'awilix';
import { IContainer } from './container.interface';
import { PublicClient, AuthenticatedClient, WebsocketClient } from 'coinbase-pro';

import { CoinbaseExchangeService } from '../services/exchanges/coinbase.exchange.service';
import { CoinbaseWebSocketService } from '../services/wsclients/coinbase.websocket.service';

export class CoinbaseContainer implements IContainer {

    public register(container: AwilixContainer): void
    {
        container.register({

            coinbaseConfig: asFunction((opts) => {

              const pEnv = process.env;

              return  {
                wsUrl: pEnv.COINBASE_PRO_API_WEBSOCKET_URL,
                apiUrl: pEnv.COINBASE_PRO_API_URL,
                apiKey: pEnv.COINBASE_PRO_API_KEY,
                apiSecret: pEnv.COINBASE_PRO_API_SECRET,
                apiPassphrase: pEnv.COINBASE_PRO_API_PASSPHRASE
              };
            }),
          
            coinbaseService: asFunction((opts) => {
          
              return new PublicClient(opts.coinbaseConfig.apiUrl);
                
            }).singleton(),
                      
            coinbaseAuthService: asFunction((opts) => {
          
              const cbConfig = opts.coinbaseConfig;
          
              return new AuthenticatedClient(
                  cbConfig.apiKey,
                  cbConfig.apiSecret,
                  cbConfig.apiPassphrase,
                  cbConfig.apiUrl
                );
          
            }).singleton(),
          
            coinbaseExchangeService: asClass(CoinbaseExchangeService).singleton(),

            coinbaseWebsocketService: asClass(CoinbaseWebSocketService).singleton(),
        });
    }
}