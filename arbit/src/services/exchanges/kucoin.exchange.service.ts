import { IExchangeService } from './exchange.service.interface'
import { BaseExchangeService } from './base.exchange.service';
import { ExchangeIds } from '../../enums/exchange.enum';
import { ServiceResponse } from '../../service.response';


export class KuCoinExchangeService extends BaseExchangeService implements IExchangeService {

    constructor(opts)
    {
        super(opts);
        this.exchangeId = ExchangeIds.KuCoin;
        this.api = opts.kuAuthApi;

        // https://www.kucoin.com/news/en-fee
        this.makerFillFee = 0.001;
        this.takerFillFee = 0.001;

        this.apiRateLimit = 30;
        this.tweaks.apiRateLimitOrderbook = 30;
    }

    public async getAllProducts(): Promise<ServiceResponse>
    {
        try {

            const result = await this.api.fetchMarkets();

            if (!result || !result.length)
                return new ServiceResponse(false);

            const products = result
                .map(row => this.makeExchangeProduct(row))
                .filter(product => product.getCurrencyPair() !== 'BCH-USDT')
                .filter(product => product.getCurrencyPair() !== 'BSV-USDT');

            return new ServiceResponse(true, products);

        } catch (err) {
            await this.logService.error(`CoinexExchangeService::getAllProducts | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    } 
}

