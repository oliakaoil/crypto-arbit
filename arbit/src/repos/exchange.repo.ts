import { Op, Sequelize } from 'sequelize';

import { IExchangeRepo } from './exchange.repo.interface';
import { BaseRepo } from './base.repo';

import { ExchangeProductModel } from '../models/exchange-product.model';
import { ExchangeTransferModel } from '../models/exchange-transfer.model';
import { ExchangeModel } from '../models/exchange.model';

import { ExchangeIds, ExchangeLockType } from '../enums/exchange.enum';

import { getQuoteFromPair, getBaseFromPair } from '../helpers';


export class ExchangeRepo extends BaseRepo implements IExchangeRepo {

  private exchangeModel;
  private exchangeProductModel;
  private exchangeMetaModel;
  private exchangeTransferModel;

  constructor(opts)
  {
    super(opts);

    const models = this.dbService.models;
    this.exchangeModel = models.exchanges;
    this.exchangeProductModel = models.exchange_products;
    this.exchangeMetaModel = models.exchange_meta;
    this.exchangeTransferModel = models.exchange_transfers;
  }

  public async getById(exchangeId: ExchangeIds): Promise<ExchangeModel>
  {
    try {
      const data = await this.exchangeModel.findOne({where: { id: exchangeId }});

      if (!data || !data.dataValues)
        return null;

      return new ExchangeModel(data.dataValues);
    } catch (err) {
      await this.logService.error('ExchangeRepo::getById', err);
      return null;
    }
  }

  public async getActive(): Promise<ExchangeModel[]>
  {
    try {
      const result = await this.exchangeModel.findAll({ 
        where: { 
          status: 1
        } 
      });

      if (!result)
        return null;

      return result.map(r => new ExchangeModel(r));

    } catch (err) {
      await this.logService.error('ExchangeRepo::getAll', err);
      return null;
    } 
  }

  public async getAllProductsByExchangeId(exchangeId: ExchangeIds): Promise<ExchangeProductModel[]>
  {
    try {
      const result = await this.exchangeProductModel.findAll({ 
        where: { 
          exchange_id: exchangeId,
          status: 1
        } 
      });

      if (!result)
        return null;

      return result.map(r => new ExchangeProductModel(r.dataValues));

    } catch (err) {
      await this.logService.error('ExchangeRepo::getAllProductsByExchangeId', err);
      return null;
    } 
  }

  public async getProductByCurrencyPair(exchangeId: ExchangeIds, currencyPair: string): Promise<ExchangeProductModel>
  {
    try {

      const baseCurrency = getBaseFromPair(currencyPair);
      const quoteCurrency = getQuoteFromPair(currencyPair);

      const result = await this.exchangeProductModel.findOne({ 
        where: {
         base_currency: baseCurrency,
         quote_currency: quoteCurrency,
         exchange_id: exchangeId
        } 
      });

      if (!result)
        return null;

      return new ExchangeProductModel(result);

    } catch (err) {
      await this.logService.error('ExchangeRepo::getProductByCurrencyPair', err);
      return null;
    }    
  }

  public async findProductByCurrency(bases: string[], quotes: string[]): Promise<ExchangeProductModel[]>
  {
    let result;

    try {
      result = await this.exchangeProductModel.findAll({ 
        where: {
         base_currency: { [Op.in]: bases },
         quote_currency: { [Op.in]: quotes },
         status: 1
        } 
      });

      if (!result)
        return;

      return result.map(r => new ExchangeProductModel(r));

    } catch (err) {
      this.logService.error('ExchangeRepo::findProductByCurrency', err);
      return;
    }
  }   

  public async getAllProductsByBase(currency: string, exchangeId: ExchangeIds): Promise<ExchangeProductModel[]>
  {
    try {
      const result = await this.exchangeProductModel.findAll({ 
        where: {
         base_currency: currency,
         exchange_id: exchangeId,
         status: 1
        } 
      });

      if (!result)
        return null;

      return result.map(r => new ExchangeProductModel(r));

    } catch (err) {
      await this.logService.error('ExchangeRepo::getAllProductsByBase', err);
      return null;
    }
  }

  public async createTransfer(transferModel: ExchangeTransferModel): Promise<ExchangeTransferModel>
  {
    try {
      let data = transferModel.toDbModelJSON();

      if (!data.id)
        delete data.id;      

      const result = await this.exchangeTransferModel.create(data, {returning: true});

      return new ExchangeTransferModel(result.dataValues);

    } catch (err) {
      await this.logService.error('ExchangeRepo::createTransfer', err);
      return;
    }  
  }

  public async updateTransfer(transferModel: ExchangeTransferModel): Promise<ExchangeTransferModel>
  {
    try {
      let data = transferModel.toDbModelJSON();

      if (data.id)
        delete data.id;      

      const result = await this.exchangeTransferModel.update(data, { where: { id: transferModel.id } });

      return result;

    } catch (err) {
      await this.logService.error('ExchangeRepo::updateTransfer', err);
      return;
    }  
  }  

  public async upsertExchangeProduct(product: ExchangeProductModel): Promise<boolean>
  {
    try {
        let data = product.toDbModelJSON();
       
        // these models are sometimes generated from exchange api calls and do not have an id field, so they 
        // upsert on the ext_id/exchange_id unique key instead of id
        if (!data.id)
            delete data.id;

        if (data.volume_24hr === null)
            delete data.volume_24hr;

        // status is usually manually modified to turn off certain products, so leave it alone here
        delete data.status;

        const result = await this.exchangeProductModel.upsert(data);

        return result;
  
      } catch (err) {
        await this.logService.error('ExchangeRepo::upsertExchangeProduct', err);
        return false;
      }  
  }

  public async updateExchangeProductById(productId: number, attrs: any): Promise<boolean>
  {
    try {

      const result = await this.exchangeProductModel.update(attrs, {where: {id: productId }});

      return true;

    } catch (err) {
      await this.logService.error('ExchangeRepo::updateExchangeProductById', err);
      return false;
    }
  }  

  public async incrementInsufficientFills(productId: number): Promise<boolean>
  {
    const updateCond = {
      where: { 
        id: productId
      }
    };

    try {

      const result = await this.exchangeProductModel.update({ins_fill_count: Sequelize.literal('ins_fill_count + 1')}, updateCond);

      return (Array.isArray(result) && result.pop() === 1);

    } catch (err) {

      await this.logService.error('ExchangeRepo::incrementInsufficientFills error', err);
      return false;
    }      
  }  

  public async getExchangeLock(exchangeId: number, lockType: ExchangeLockType): Promise<boolean>
  {
    try {

      const updateCond = {
        where: { 
          id: exchangeId, 
          ex_lock: ExchangeLockType.Unlocked
        }
      };

      const result = await this.exchangeModel.update({ ex_lock: lockType }, updateCond);

      return (Array.isArray(result) && result.pop() === 1);

    } catch (err) {

      await this.logService.error('ExchangeRepo::getExchangeLock error', err);
      return false;
    }
  }  

  public async unlockExchange(exchangeId: number): Promise<boolean>
  {
    const updateCond = {
      where: { 
        id: exchangeId,
        ex_lock: { [Op.ne]: ExchangeLockType.Unlocked }
      }
    };

    try {

      const result = await this.exchangeModel.update({ex_lock: ExchangeLockType.Unlocked}, updateCond);

      return (Array.isArray(result) && result.pop() === 1);

    } catch (err) {

      await this.logService.error('ExchangeRepo::unlockExchange error', err);
      return false;
    }    
  }  
}
