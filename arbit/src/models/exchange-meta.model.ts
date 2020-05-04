import { DataTypes } from 'sequelize';
import { ISequelizeModel } from './sequelize.model.interface';
import { BaseModel } from './base.model';
import { IDatabaseService } from '../services/database.service.interface';


export class ExchangeMetaModel extends BaseModel implements ISequelizeModel {

  public id:number;
  public exchangeId: number;
  public currency: string;
  public depositAddress: string;
  public destTag: string;
  public depositMin: number;
  public withdrawalFee: number;
  
  constructor(o?: any) {
    super(o);

    if (!o)
      return;

    this.id = o.id;
    this.exchangeId = o.exchange_id;
    this.currency = o.currency;
    this.depositAddress = o.deposit_address;
    this.destTag = o.dest_tag;
    this.depositMin = Number(o.deposit_min);
    this.withdrawalFee = Number(o.withdrawal_fee);
  }

  public getTableName(): string
  {
      return 'exchange_meta';
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
          
          currency: {
            type: DataTypes.STRING,
            allowNull: false
          },

          deposit_address: {
            type: DataTypes.STRING,
            allowNull: false
          },

          dest_tag: {
            type: DataTypes.STRING,
            allowNull: true
          },
          
          deposit_min: {
            type: DataTypes.DECIMAL(10,4),
            allowNull: true
          },
          
          withdrawal_fee: {
            type: DataTypes.DECIMAL(10,4),
            allowNull: true
          }             
      },
      {
          indexes: [
              { unique: true, fields: ['exchange_id','currency'] }
          ]
      },
      ( dbService: IDatabaseService ) => {

        const exchangeModel = dbService.models.exchanges;
        const ExchangeMetaModel = dbService.models.exchange_meta;
  
        exchangeModel.hasMany(ExchangeMetaModel, { onDelete: 'NO ACTION' });
      }          
    ];

  }
}