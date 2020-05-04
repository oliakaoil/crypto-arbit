import * as AltillyClient from 'nodeAltillyApi';

import { IExchangeService } from './exchange.service.interface'
import { BaseExchangeService } from './base.exchange.service';
import { ServiceResponse } from '../../service.response';
import { ExchangeProductModel } from '../../models/exchange-product.model';
import { ExchangeIds, ExchangeProductStatus } from '../../enums/exchange.enum';
import { 
    ExchangeTicker, 
    ExchangeAccount, 
    ExchangeOrder,
    ExchangeOrderbook,
    ExchangeOrderbookLevel
} from '../../exchange.response';
import { ExchangeTransferModel } from '../../models/exchange-transfer.model';
import { ExchangeMetaModel } from '../../models/exchange-meta.model';
import { OrderStatus, OrderType } from '../../enums/order.enum';



export class AltillyExchangeService extends BaseExchangeService implements IExchangeService {

    private altillyAuthService: AltillyClient;

    constructor(opts)
    {
        super(opts);
        this.altillyAuthService = opts.altillyAuthService;
        this.exchangeId = ExchangeIds.Altilly;
  
        // https://www.altilly.com/page/fees
        this.makerFillFee = 0;
        this.takerFillFee = 0.0012;
        
        this.tweaks.apiRateLimitOrderbook = 150;
    }  

    public async getAccounts(): Promise<ServiceResponse>
    {

        return new ServiceResponse(true);
    }

    public async getOrderById(orderId: string): Promise<ServiceResponse>
    {

        return new ServiceResponse(true);
    }

    public async getAllOrders(): Promise<ServiceResponse>
    {

        return new ServiceResponse(true);
    }

    public async getOrderbook(currencyPair: string, raw: boolean = false): Promise<ServiceResponse>
    {
        try {

            const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

            const result = await this.altillyAuthService.getOrderBook(localCurrencyPair);

            if (!result || !result.ask || !result.bid)
                return new ServiceResponse(false);

            const orderbook = new ExchangeOrderbook(this.getExchangeId(), currencyPair);

            orderbook.asks = result.ask.map(m => new ExchangeOrderbookLevel(m.price, m.size));
            orderbook.bids = result.bid.map(m => new ExchangeOrderbookLevel(m.price, m.size));

            orderbook.sortFills();

            return new ServiceResponse(true, orderbook);

        } catch (err) {
            await this.logService.error('AltillyExchangeService::getOrderbook | API error', err);
            return new ServiceResponse(false);
        }

    }

    public async getProductTicker(currencyPair: string): Promise<ServiceResponse>
    {
        try {

            const localCurrencyPair = this.makeLocalCurrencyPair(currencyPair);

            const result = await this.altillyAuthService.getTicker(localCurrencyPair);

            if (!result || !result.symbol)
                return new ServiceResponse(false);

            return new ServiceResponse(true, new ExchangeTicker({
                currencyPair: currencyPair,
                bid: Number(result.bid),
                ask: Number(result.ask),
                price: Number(result.last),
                volume: Number(result.volume),
                date: result.timestamp
            }));

        } catch (err) {
            await this.logService.error('AltillyExchangeService::getProductTicker | API error', err);
            return new ServiceResponse(false);
        }
    }

    public async getAllProducts(): Promise<ServiceResponse>
    {
        try {
            const tickerResult = await this.altillyAuthService.getTickers();

            if (!tickerResult || !tickerResult.length)
                return new ServiceResponse(false);


            /* 
             * For some reason, the getTickers call, which returns the volume information we need, reports the currency pair
             * without using any symbol to separate the base currency and the quote currency, i.e. BTCUSD rather than BTC-USD.
             * This makes it a PITA to determine where the base ends and the quote starts within that string. In order to ensure
             * no mistakes are made, we now pull from a separate endpoint that lists all pairs, and which contains separate fields 
             * for base and quote currencies, but does not include volume information, then match the two up.
             */
            let symbolResult = await this.altillyAuthService.getSymbols();

            if (!symbolResult || !symbolResult.length)
                return new ServiceResponse(false);

            symbolResult = symbolResult.map(s => {
                const ticker = tickerResult.find(t => t.symbol === s.id);
                s.volume = (ticker ? Number(ticker.volume) : null);
                return s;
            });

            symbolResult = symbolResult.filter(s => s.volume >= 10);

            return new ServiceResponse(true, symbolResult.map(r => this.makeExchangeProduct(r)))

        } catch (err) {
            await this.logService.error('AltillyExchangeService::getAllProducts | API error', err);
            return new ServiceResponse(false);
        }
    }
    
    public async limitOrder(orderType: OrderType, localId: string, currencyPair: string, size: number, price: number): Promise<ServiceResponse>
    {

        return new ServiceResponse(true);
    } 

    public async cancelOrder(extId: string): Promise<ServiceResponse>
    {

        return new ServiceResponse(true);
    }

    public async cryptoTransfer(transfer: ExchangeTransferModel): Promise<ServiceResponse>
    {

        return new ServiceResponse(true, transfer);
    }  

    protected makeExchangeProduct(marketInfo: any): ExchangeProductModel
    {
        return new ExchangeProductModel({
            ext_id: marketInfo.id,
            exchange_id: this.getExchangeId(),
            base_currency: marketInfo.baseCurrency,
            quote_currency: marketInfo.quoteCurrency,
            volume_24hr: Number(marketInfo.volume),
            status: ExchangeProductStatus.Online,
        });
    }
 
    public makeLocalCurrencyPair(currencyPair: string): string
    {
        return currencyPair.replace('-','');
    }
}

