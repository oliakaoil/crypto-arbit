import { DataTypes } from 'sequelize';
import { BaseModel } from './base.model';
import { ISequelizeModel } from './sequelize.model.interface';
import { IDatabaseService } from '../services/database.service.interface';

export class ExchangeProductModel extends BaseModel implements ISequelizeModel {

  public id: number;
  public ext_id: string;
  public exchangeId: number;
  public baseCurrency: string;
  public quoteCurrency: string;
  public volume24hr: number;
  public volume24hrUsd: number;
  public insFillCount: number;
  public status: string;
  
  constructor(o?: any) {
    super(o);

    if (!o)
      return;
    this.id = o.id;
    this.ext_id = o.ext_id;
    this.exchangeId = o.exchange_id;
    this.baseCurrency = o.base_currency;
    this.quoteCurrency = o.quote_currency;
    this.volume24hr = o.volume_24hr;
    this.volume24hrUsd = o.volume_24hr_usd;
    this.insFillCount = o.ins_fill_count;
    this.status = o.status;
  }

  public getCurrencyPair(): string
  {
    return `${this.baseCurrency}-${this.quoteCurrency}`
  }

  public getTableName(): string
  {
      return 'exchange_products';
  }

  public getSequelizeDef(): any
  {
    return [{
          id: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            primaryKey: true, 
            autoIncrement: true 
          },

          ext_id: {
            type: DataTypes.STRING, 
            allowNull: false
          },
          
          exchange_id: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            allowNull: false
          },

          base_currency: { 
            type: DataTypes.STRING, 
            allowNull: false
          },
          
          quote_currency: { 
            type: DataTypes.STRING, 
            allowNull: false
          },

          volume_24hr: {
            type: DataTypes.DECIMAL(15,4),
            allowNull: true
          },

          volume_24hr_usd: {
            type: DataTypes.DECIMAL(15,4),
            allowNull: true
          },

          ins_fill_count: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
          },
          
          status: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            allowNull: false,
            defaultValue: 1
          }
      },
      {
        indexes: [
          { unique: true, fields: ['ext_id','exchange_id'] },
          { unique: true, fields: ['exchange_id','base_currency','quote_currency'] }
        ]
      },
      ( dbService: IDatabaseService ) => {

        const exchangeModel = dbService.models.exchanges;
        const exchangeProductModel = dbService.models.exchange_products;

        exchangeModel.hasMany(exchangeProductModel, { onDelete: 'NO ACTION' });
      }
    ];

  }
}