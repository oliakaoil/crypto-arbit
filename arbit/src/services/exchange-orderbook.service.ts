import { IExchangeOrderbookService } from './exchange-orderbook.service.interface';
import { ILoggingService } from './logging.service.interface';

import { IExchangeOrderbookRepo } from '../repos/exchange-orderbook.repo.interface';
import { ServiceResponse } from '../service.response';
import { ExchangeOrderbook } from '../exchange.response';


export class ExchangeOrderbookService implements IExchangeOrderbookService {

    private logService: ILoggingService;
    private repo: IExchangeOrderbookRepo;

    constructor(opts) {
        this.logService = opts.logService;
        this.repo = opts.exchangeOrderbookRepo;
    }

    public async getByProductId(productId: number): Promise<ServiceResponse> 
    {
        const orderbook = await this.repo.getByProductId(productId);

        return new ServiceResponse(true, {
            bids: orderbook.filter(o => o.side === 'bid'),
            asks: orderbook.filter(o => o.side === 'ask')
        });
    }   

    public async removeAllLevelsByProductId(productId: number): Promise<boolean>
    {
        return this.repo.removeAllLevelsByProductId(productId);
    }

    public async initOrderbook(orderbook: ExchangeOrderbook): Promise<boolean>    
    {
        const productId = orderbook.productId;
        await this.removeAllLevelsByProductId(productId);

        const orderbookLevels = orderbook.getAllLevels();

        for(let i=0; i<orderbookLevels.length;i++)
        {
            const level = orderbookLevels[i];
            await this.upsertOrderbookLevel(productId, level.side, level.price, level.size);
        }

        return true;
    }

    public async deleteOrderbookLevel(productId: number, side: 'ask'|'bid', price: number): Promise<boolean>
    {
        return this.repo.deleteOrderbookLevel(productId, side, price);
    }

    public async upsertOrderbookLevel(productId: number, side: 'ask'|'bid', price: number, size: number): Promise<boolean>
    {
        return this.repo.upsertOrderbookLevel(productId, side, price, size);
    }
}
