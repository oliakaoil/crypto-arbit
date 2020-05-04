import { Op } from 'sequelize';

import { ICoinRepo } from './coin.repo.interface';
import { BaseRepo } from './base.repo';

import { CurrencyConvertModel } from '../models/currency-convert.model';

import { ServiceResponse } from '../service.response';


export class CoinRepo extends BaseRepo implements ICoinRepo {

  constructor(opts)
  {
      super(opts);
      this.dbModel = this.dbService.models.currency_converts;
  }

  public async findCoinsByCurrency(bases: string[], quotes?: string[]): Promise<CurrencyConvertModel[]>
  {
    try {
      let dbOpts: any = { 
        where: {
         base_currency: { [Op.in]: bases }
        } 
      };

      if (quotes && quotes.length)
        dbOpts.where.quote_currency = { [Op.in]: quotes };

      const result = await this.dbModel.findAll(dbOpts);

      if (!result)
        return null;

      return result.map(r => new CurrencyConvertModel(r));

    } catch (err) {
      await this.logService.error('CoinRepo::findProductByCurrency', err);
      return null;
    }
  }     

  public async upsertConversion(
      baseCurrency: string, 
      quoteCurrency: string, 
      rate: number,
      source: string
    ): Promise<ServiceResponse>
  {
    try {
        let data = new CurrencyConvertModel({
            base_currency: baseCurrency, 
            quote_currency: quoteCurrency, 
            rate, 
            source
        }).toDbModelJSON();
       
        const result = await this.dbModel.upsert(data);

        return new ServiceResponse(true, result);
  
      } catch (err) {
        await this.logService.error('CoinRepo::upsertConversion', err);
        return new ServiceResponse(false);
      }  
  }
}