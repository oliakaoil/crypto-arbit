import { IExchangeService } from './exchange.service.interface'
import { BaseExchangeService } from './base.exchange.service';
import { ExchangeIds } from '../../enums/exchange.enum';


export class BitforexExchangeService extends BaseExchangeService implements IExchangeService {

    constructor(opts)
    {
        super(opts);
        this.exchangeId = ExchangeIds.Bitforex;
        this.api = opts.bitforexAuthApi;

        // https://www.bitforex.com/Fees
        this.makerFillFee = 0.001;
        this.takerFillFee = 0.001;
        
        this.tweaks.newOrderQueryWaitMs = 2000;

        // rate limits: https://github.com/ccxt/ccxt/issues/5054

        this.apiRateLimit = 1;
        this.tweaks.apiRateLimitOrderbook = 1;
        this.tweaks.afterGetAllProductsDelayMs = 10000;
    }
}

