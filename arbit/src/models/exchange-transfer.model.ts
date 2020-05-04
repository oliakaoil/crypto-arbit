import { DataTypes } from 'sequelize';
import { ISequelizeModel } from './sequelize.model.interface';
import { BaseModel } from './base.model';
import { TransferStatus } from '../enums/transfer.enum';


export class ExchangeTransferModel extends BaseModel implements ISequelizeModel {

  public id: number;
  public extId: string;
  public sourceExchangeId: number;
  public destExchangeId: number;
  public exchangeAddressId: number;
  public currency: string;
  public size: number;
  public withdrawalFee: number;
  public status: TransferStatus;
  public confirmed: boolean;

  /*
    public buyExchangeId: number;
  public sellExchangeId: number;
  public buyLocalOrderId: number;
  public sellLocalOrderId: number;
    */

  
  constructor(o?: any) {
    super(o);

    if (!o)
      return;

    this.id = o.id;
    this.extId = o.ext_id;
    this.sourceExchangeId = o.source_exchange_id;
    this.destExchangeId = o.dest_exchange_id;
    this.exchangeAddressId = o.exchange_address_id;
    this.currency = o.currency;
    this.size = Number(o.size);
    this.withdrawalFee = Number(o.withdrawal_fee);
    this.status = o.status;
  }

  public getTableName(): string
  {
      return 'exchange_transfers';
  }

  public getSequelizeDef(): any
  {
    return [{
          id: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            primaryKey: true, 
            autoIncrement: true 
          },
          
          source_exchange_id: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            allowNull: false
          },

          dest_exchange_id: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            allowNull: false
          },          
         
          exchange_address_id: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            allowNull: true
          },            

          currency: { 
            type: DataTypes.STRING, 
            allowNull: false
          },       
          
          size: { 
            type: DataTypes.DECIMAL(10,4), 
            allowNull: false
          },

          withdrawal_fee: { 
            type: DataTypes.DECIMAL(10,4), 
            allowNull: true
          },          
          
          status: { 
            type: DataTypes.TINYINT, 
            allowNull: false
          },

          confirmed: { 
            type: DataTypes.BOOLEAN, 
            allowNull: false,
            defaultValue: false
          }          
      },
      {}
    ];

  }
}