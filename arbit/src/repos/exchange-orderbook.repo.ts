import { IExchangeOrderbookRepo } from './exchange-orderbook.repo.interface';
import { BaseRepo } from './base.repo';

import { ExchangeOrderbookModel } from '../models/exchange-orderbook.model';


export class ExchangeOrderbookRepo extends BaseRepo implements IExchangeOrderbookRepo {

    constructor(opts)
    {
        super(opts);
        this.dbModel = this.dbService.models.exchange_orderbooks;
    }

    public async getByProductId(productId: number): Promise<ExchangeOrderbookModel[]>
    {
        try {

            const result = await this.dbModel.findAll({where: { product_id: productId }});

            if (!result)
                return null;

            return result.map(r => new ExchangeOrderbookModel(r.dataValues));

        } catch (err) {
            await this.logService.error('ExchangeOrderbook::getByProductId | db error', err);
        }
    }

    public async removeAllLevelsByProductId(productId: number): Promise<boolean>
    {
        try {

            await this.dbModel.destroy({where: { product_id: productId }});

            return true;

        } catch (err) {
            await this.logService.error('ExchangeOrderbook::clearByProductId | db error', err);
        }        
    }

    public async deleteOrderbookLevel(productId: number, side: 'ask'|'bid', price: number): Promise<boolean>
    {
        try {

            await this.dbModel.destroy({where: { product_id: productId, side, price }});

            return true;

        } catch (err) {
            await this.logService.error('ExchangeOrderbook::deleteOrderbookLevel | db error', err);
        }  
    }

    public async upsertOrderbookLevel(productId: number, side: 'ask'|'bid', price: number, size: number): Promise<boolean>
    {
      try {
          let data = {
              product_id: productId,
              side,
              price,
              size
          };
  
          const result = await this.dbModel.upsert(data, {fields: ['size']});
  
          return result;
    
        } catch (err) {
          await this.logService.error('ExchangeRepo::upsertExchangeProduct', err);
          return false;
        }  
    }    
}