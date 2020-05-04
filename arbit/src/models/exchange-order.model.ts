import { DataTypes } from 'sequelize';
import { ISequelizeModel } from './sequelize.model.interface';
import { OrderType } from '../enums/order.enum';
import { BaseModel } from './base.model';
import { IDatabaseService } from '../services/database.service.interface';
import { toFixedTruncate } from '../helpers';


export class ExchangeOrderModel extends BaseModel implements ISequelizeModel {
  
  public id: number;
  public exchange_id: number;

  // the unique id assigned to the order by the exchange
  public ext_id: string;

  // a unique id we can send to exchnages like cb to help track orders in their orderbook
  public uuid: string;

  // For stop orders, the id of the complimentary limit buy order that this stop is covering
  // For limit sell orders, id the of complimentary limit buy order that this sell is closing out
  public parent_id: number;

  public type_id: OrderType;
  public currency_pair: string;
  public size: number;

  // The requested limit price we initially sent to the cb api, for both limit and stop orders
  public price: number;

  // The confirmed price and date sent back by the cb api when the order is accepted to the order book
  public open_price: number;
  public open_date: string;

  // What price and date did the order actually get filled at by the exchange? Hopefully close to the open price
  public fill_price: number;
  public fill_date: string;
  public fill_fee: number;

  // Stop orders only. The frequently-updated stop price, and the date when it was last updated
  public stop_price: number;
  public stop_date: string;
  public stop_pts: number;

  public order_lock: number;
  public status: number;
  public sandbox: boolean;

  // added by sequelize
  public created_at: string;
  public updated_at: string;
  public deleted_at: string;

  constructor(o?: any) {
    super(o);

    if (!o)
      return;

    this.id = o.id;
    this.exchange_id = o.exchange_id;
    this.ext_id = o.ext_id;
    this.uuid = o.uuid;
    this.parent_id = o.parent_id;
    this.type_id = o.type_id;
    this.currency_pair = o.currency_pair;
    this.size = (typeof o.size === 'number' || typeof o.size === 'string' ? toFixedTruncate(o.size, 6) : null);
    this.price = (o.price ? toFixedTruncate(o.price, 8) : null);
    this.open_price = (o.open_price ? toFixedTruncate(o.open_price, 8) : null);
    this.open_date = o.open_date;
    this.fill_price = (o.fill_price ? toFixedTruncate(o.fill_price, 8) : null);
    this.fill_fee = (o.fill_fee ? toFixedTruncate(o.fill_fee, 8) : null);
    this.fill_date = o.fill_date;
    this.stop_price = (o.stop_price ? toFixedTruncate(o.stop_price, 8) : null);
    this.stop_date = o.stop_date;
    this.stop_pts = (o.stop_pts ? Number(o.stop_pts) : null);
    this.order_lock = o.order_lock;
    this.status = o.status; 
    this.sandbox = o.sandbox;
    this.created_at = o.created_at;
    this.updated_at = o.updated_at;
    this.deleted_at = o.deleted_at;
  }

  /*
  * A rather unfortunate limitation of the Bitforex API is that it only returns 4-decimal
  * precision, so amounts purchased and fees may be reported as slightly smaller. For this 
  * reason we can sadly only estimate the actual net size of currency obtained from an order.
  * 
  * Also note that we are assuming that the order was filled and fees were paid, so this only 
  * makes sense in the context of a filled order.
  */
  public getEstimatedNetSize(): number
  {
    // When buying, the fee is assessed in the base currency, so you net the size of your order minus the fill fee
    if (this.type_id === OrderType.LimitBuy) 
    {
      const apiSlipageAmount = 0.00009999; // see above note regarding API inaccuracy
      return this.size - this.fill_fee - apiSlipageAmount;
    }
      
    // When selling, the fee is assessed in the quote currency, so the size of the order remains the same
    if (this.type_id === OrderType.LimitSell)
      return this.size;
  }

  public getTableName(): string
  {
      return 'exchange_orders';
  }

  public getSequelizeDef(): any
  {
    return [{
          id: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            primaryKey: true, 
            autoIncrement: true 
          },

          exchange_id: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            allowNull: false
          },          
          
          ext_id: {
            type: DataTypes.STRING(36),
            allowNull: true,
            unique: true
          },

          uuid: {
            type: DataTypes.STRING(36),
            allowNull: false,
            unique: true
          },

          parent_id: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            allowNull: true,
            defaultValue: null
          },

          type_id: {
            type: DataTypes.TINYINT,
            allowNull: false
          },          

          currency_pair: {
            type: DataTypes.STRING,
            allowNull: false
          },

          size: {
            type: DataTypes.DECIMAL(18,8),
            allowNull: false
          },          

          price: {
            type: DataTypes.DECIMAL(18,8),
            allowNull: true
          },          

          open_price: {
            type: DataTypes.DECIMAL(18,8),
            allowNull: true
          },

          open_date: {
            type: DataTypes.DATE,
            allowNull: true          
          },          

          fill_price: {
            type: DataTypes.DECIMAL(18,8),
            allowNull: true
          },

          fill_date: {
            type: DataTypes.DATE,
            allowNull: true          
          },

          fill_fee: {
            type: DataTypes.DECIMAL(18,8),
            allowNull: true
          },          
          
          stop_price: {
            type: DataTypes.DECIMAL(18,8),
            allowNull: true
          },

          stop_pts: {
            type: DataTypes.TINYINT.UNSIGNED,
            allowNull: true
          },

          stop_date: {
            type: DataTypes.DATE,
            allowNull: true          
          },

          order_lock: {
            type: DataTypes.TINYINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0
          },          

          status: {
            type: DataTypes.TINYINT,
            allowNull: false,
            defaultValue: 1
          },

          sandbox: {
            type: DataTypes.BOOLEAN,
            allowNull: false
          }
    },
    {},
    ( dbService: IDatabaseService ) => {


    }    
    ];

  }
}