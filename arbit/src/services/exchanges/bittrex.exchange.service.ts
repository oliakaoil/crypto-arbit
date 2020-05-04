import { IExchangeService } from './exchange.service.interface'
import { BaseExchangeService } from './base.exchange.service';
import { ExchangeIds, ExchangeProductStatus } from '../../enums/exchange.enum';
import { ServiceResponse } from '../../service.response';
import { ExchangeProductModel } from '../../models/exchange-product.model';
import { ExchangeTicker, ExchangeOrderbook, ExchangeOrderbookLevel } from '../../exchange.response';


export class BittrexExchangeService extends BaseExchangeService implements IExchangeService {

    constructor(opts)
    {
        super(opts);
        this.exchangeId = ExchangeIds.Bittrex;
        this.api = opts.bittrexAuthApi;

        // https://bittrex.zendesk.com/hc/en-us/articles/115000199651-What-fees-does-Bittrex-charge-
        this.makerFillFee = 0.0025;
        this.takerFillFee = 0.0025;

        // https://bittrex.github.io/api/v1-1
        this.apiRateLimit = 1;
        this.tweaks.apiRateLimitOrderbook = 1;
    }

    public async getAccounts(): Promise<ServiceResponse>
    {
        try {

            const result = await this.api.balances();

            await this.logService.error(`BittrexExchangeService::getAccounts | NOT IMPLEMENTED`);

            return new ServiceResponse(false);


            // if (!result || !result.info)
            //     return new ServiceResponse(false);

            // const reservedKeys = ['info','free','used','total'];

            // const accounts = Object.keys(result)
            //     .filter(k => reservedKeys.indexOf(k) === -1)
            //     .map(k => {
            //         let accountInfo = result[k];
            //         accountInfo.currency = k;
            //         return this.makeExchangeAccount(accountInfo)
            //     }).filter(a => a.balance > 0);

            // return new ServiceResponse(true, accounts);

        } catch (err) {
            await this.logService.error(`BittrexExchangeService::getAccounts | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    }      

    public async getProductTicker(currencyPair: string): Promise<ServiceResponse>
    {
        try {

            const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

            const result = await this.api.marketSummary(localCurrencyPair);

            if (!result || !result.length)
                return new ServiceResponse(false);

            return new ServiceResponse(true, this.makeExchangeTicker(result.shift()));

        } catch (err) {
            await this.logService.error(`BittrexExchangeService::getProductTicker | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    }      

    public async getAllProducts(): Promise<ServiceResponse>
    {
        try {

            const result = await this.api.markets();

            if (!result || !result.length)
                return new ServiceResponse(false);

            const availableMarkets = result
                .filter(market => market.IsActive && !market.IsRestricted);

            return new ServiceResponse(true, availableMarkets.map(r => this.makeExchangeProduct(r)));

        } catch (err) {
            await this.logService.error(`BittrexExchangeService::getAllProducts | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    }   

    public async getOrderbook(currencyPair: string): Promise<ServiceResponse>
    {
        try {

            const product = await this.exchangeRepo.getProductByCurrencyPair(this.getExchangeId(), currencyPair);

            const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

            const result = await this.api.orderBook(localCurrencyPair, {type: 'both'});

            if (!result || !result.buy || !result.sell)
                throw new Error(`missing bids/asks from fetchOrderBook ${currencyPair}`);

            const orderbook = new ExchangeOrderbook(this.getExchangeId(), currencyPair);

            orderbook.asks = result.sell.map(m => new ExchangeOrderbookLevel(m.Rate, m.Quantity));
            orderbook.bids = result.buy.map(m => new ExchangeOrderbookLevel(m.Rate, m.Quantity));

            orderbook.sortFills();

            if (product)
                orderbook.productId = product.id;

            return new ServiceResponse(true, orderbook);

        } catch (err) {
            await this.logService.error(`BittrexExchangeService::getOrderbook | ex [${this.getExchangeId()}] API error`, err);
            return new ServiceResponse(false);
        }
    }    

    public makeLocalCurrencyPair(currencyPair: string): string
    {
        const pairParts = currencyPair.split('-');
        const baseCurrency = pairParts.shift();
        const quoteCurrency = pairParts.join('-');

        return `${quoteCurrency}-${baseCurrency}`;
    }

    public makeCurrencyPair(localCurrencyPair: string): string
    {
        const pairParts = localCurrencyPair.split('-');
        const quoteCurrency = pairParts.shift();
        const baseCurrency = pairParts.join('-');

        return `${baseCurrency}-${quoteCurrency}`;
    }        

    protected makeExchangeProduct(marketInfo: any): ExchangeProductModel
    {
        return new ExchangeProductModel({
            ext_id: marketInfo.MarketName,
            exchange_id: this.getExchangeId(),
            base_currency: marketInfo.MarketCurrency,
            quote_currency: marketInfo.BaseCurrency,
            volume_24hr: null,
            status: ExchangeProductStatus.Online
        });
    }      

    protected makeExchangeTicker(marketInfo: any): ExchangeTicker
    {
        return new ExchangeTicker({
            currencyPair: this.makeCurrencyPair(marketInfo.MarketName),
            bid: Number(marketInfo.Bid),
            ask: Number(marketInfo.Ask),
            price: Number(marketInfo.Last),
            volume: Number(marketInfo.Volume),
            date: marketInfo.TimeStamp
        });     
    }    
}
    