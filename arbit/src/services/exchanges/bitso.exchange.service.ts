import { IExchangeService } from './exchange.service.interface'
import { BaseExchangeService } from './base.exchange.service';
import { ExchangeIds } from '../../enums/exchange.enum';
import { OrderType } from '../../enums/order.enum';


export class BitsoExchangeService extends BaseExchangeService implements IExchangeService {

    constructor(opts)
    {
        super(opts);
        this.exchangeId = ExchangeIds.Bitso;
        this.api = opts.bsAuthApi;

        this.apiRateLimit = 1;
        this.tweaks.apiRateLimitOrderbook = 1;   
    }

    // https://bitso.com/fees?l=en

    public makeTakerFee(orderType: OrderType, currencyPair: string, size: number, price: number): number
    {
        const againstCurrency = currencyPair.split('-').pop();
        const takerFee = (againstCurrency === 'MXN' ? 0.0065 : 0.00098);

        // when buying, fees are assessed in the base currency
        if (orderType === OrderType.LimitBuy)
            return size * takerFee;

        // when selling, fees are assessed in the quote currency
        return size * price * takerFee;
    }      
}
