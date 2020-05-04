import { IExchangeService } from './exchange.service.interface'
import { BaseExchangeService } from './base.exchange.service';
import { ExchangeIds } from '../../enums/exchange.enum';
import { ServiceResponse } from '../../service.response';


export class CoinexExchangeService extends BaseExchangeService implements IExchangeService {

    constructor(opts)
    {
        super(opts);
        this.exchangeId = ExchangeIds.Coinex;
        this.api = opts.coinexAuthApi;

        this.tweaks.apiMarketDepthLevels = 50;
        
        // https://www.coinex.com/fees?lang=en_US
        this.makerFillFee = 0.001;
        this.takerFillFee = 0.001;

        this.apiRateLimit = 8;
        this.tweaks.apiRateLimitOrderbook = 8;
    }

    public async getAllProducts(): Promise<ServiceResponse>
    {
        try {

            const result = await this.api.fetchMarkets();

            if (!result || !result.length)
                return new ServiceResponse(false);

            const products = result
                .map(row => this.makeExchangeProduct(row))
                // no idea what these are or why they don't work for ticker calls
                .filter(product => !product.getCurrencyPair().match(/^BTCUSDT[0-9A-Z]+-USDT$/) )
                .filter(product => !product.getCurrencyPair().match(/^F-[A-Z]+-USDT$/) );

            return new ServiceResponse(true, products);

        } catch (err) {
            await this.logService.error(`CoinexExchangeService::getAllProducts | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    }     
}