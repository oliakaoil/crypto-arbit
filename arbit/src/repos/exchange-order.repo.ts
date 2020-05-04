import { Op } from 'sequelize';
import * as uuidv4 from 'uuid/v4';

import { IExchangeOrderRepo } from './exchange-order.repo.interface';
import { BaseRepo } from './base.repo';

import { ExchangeOrderModel } from '../models/exchange-order.model';
import { OrderLockType, OrderStatus, OrderType } from '../enums/order.enum';
import { ExchangeIds } from '../enums/exchange.enum';


export class ExchangeOrderRepo extends BaseRepo implements IExchangeOrderRepo {

  constructor(opts)
  {
    super(opts);
    this.dbModel = opts.dbService.models.exchange_orders;
  }

  public async create(orderModel: ExchangeOrderModel): Promise<ExchangeOrderModel>
  {
    orderModel.uuid = uuidv4();
    orderModel.sandbox = false;

    if (!orderModel.status)
      orderModel.status = OrderStatus.Created;
        
    try {

      const result = await this.dbModel.create(orderModel);

      if (!result || !result.id)
        return null;

      return new ExchangeOrderModel(result.dataValues);

    } catch (err) {
      await this.logService.error('ExchangeOrderRepo::create', err)
      return null;
    }
  }

  public async update(orderId: number, attrs): Promise<number>
  {
    try {

      await this.dbModel.update(attrs, { where: { id: orderId }});
      return 1;

    } catch (err) {
      await this.logService.error('ExchangeOrderRepo::update', err)
      return 0;
    }
  }

  public async getById(orderId: Number): Promise<ExchangeOrderModel>
  {
    try {
      const data = await this.dbModel.findOne({where: { id: orderId }});

      if (!data || !data.dataValues)
        return null;

      return new ExchangeOrderModel(data.dataValues);
    } catch (err) {
      await this.logService.error('ExchangeOrderRepo::getById', err);
      return null;
    }    
  }

  public async getByExtId(exchangeId: ExchangeIds, extId: string): Promise<ExchangeOrderModel>
  {
    const orderData = await this.dbModel.findOne({ 
      where: { 
        exchange_id: exchangeId,
        ext_id: extId 
      }
    });

    if (!orderData)
      return;

    return new ExchangeOrderModel(orderData.dataValues);
  }    

  public async getAll(orderTypes?: OrderType[], orderStati?: OrderStatus[]): Promise<ExchangeOrderModel[]>
  {
    let  whereOpts = { type_id: null, status: null };

    if (orderTypes && orderTypes.length)
      whereOpts.type_id = { [Op.in]: orderTypes };

    if (orderStati && orderStati.length)
      whereOpts.status = { [Op.in]: orderStati };

    if (!whereOpts.type_id)
      delete whereOpts.type_id;

    if (!whereOpts.status)
      delete whereOpts.status;

    try {
      return this.dbModel.findAll({ where: whereOpts }).then((rows) => {
        return rows.map(r => new ExchangeOrderModel(r.dataValues));
      });
    } catch(err) {
      await this.logService.error('ExchangeOrderRepo::getAll', err);
      return;
    }    
  }

  public async getAllByParentId(orderId: Number) : Promise<ExchangeOrderModel[]>
  {
    try {
      const queryOpts = {
        where: { 
          parent_id: orderId
        }
      };

      const data = await this.dbModel.findAll(queryOpts);

      if (!data || !data.length)
        return [];

      return data.map(r => new ExchangeOrderModel(r.dataValues));

    } catch (err) {
      await this.logService.error('ExchangeOrderRepo::getAllByParentId', err);
      return null;
    }     
  }    

  public async getOrderLock(orderId: number, lockType: OrderLockType): Promise<boolean>
  {
    try {

      const updateCond = {
        where: { 
          id: orderId, 
          order_lock: OrderLockType.Unlocked
        }
      };

      const result = await this.dbModel.update({ order_lock: lockType }, updateCond);

      return (Array.isArray(result) && result.pop() === 1);

    } catch (err) {

      await this.logService.error('ExchangeOrderRepo::getOrderLock error', err);
      return false;
    }
  }  

  public async unlockOrder(orderId: number): Promise<boolean>
  {
    const updateCond = {
      where: { 
        id: orderId,
        order_lock: { [Op.ne]: OrderLockType.Unlocked }
      }
    };

    try {

      const result = await this.dbModel.update({order_lock: OrderLockType.Unlocked}, updateCond);

      return (Array.isArray(result) && result.pop() === 1);

    } catch (err) {

      await this.logService.error('ExchangeOrderRepo::getOrderLock error', err);
      return false;
    }    
  }

  // live at the exchange and unfilled
  public orderIsOpen(status: OrderStatus): boolean
  {
    return ([OrderStatus.Created, OrderStatus.Open].indexOf(status) > -1);
  }
  
  // dead at the exchange and was NOT filled
  public orderIsClosed(status: OrderStatus): boolean
  {
    return ([OrderStatus.Failed, OrderStatus.Closed].indexOf(status) > -1);
  }

  // dead at the exchange and was filled
  public orderIsFilled(status: OrderStatus): boolean
  {
    return ([OrderStatus.Filled, OrderStatus.Settled].indexOf(status) > -1);
  }
}