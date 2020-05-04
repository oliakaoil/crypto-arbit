import { DataTypes } from 'sequelize';
import { ISequelizeModel } from './sequelize.model.interface';
import { BaseModel } from './base.model';
import { IDatabaseService } from '../services/database.service.interface';


export class ExchangeOrderbookModel extends BaseModel implements ISequelizeModel {

  public id: number;
  public productId: number;
  public side: 'ask'|'bid';
  public size: number;
  public price: number;

  constructor(o?: any) {
      super(o);

      if (!o)
          return;

      this.productId = o.product_id;
      this.side = o.side;
      this.size = o.size;
      this.price = o.price;
  }

  public getTableDefaults(): boolean
  {
      let baseDefaults = super.getTableDefaults();
      baseDefaults.timestamps = false;
      baseDefaults.paranoid = false;
      return baseDefaults;
  }  

  public getTableName(): string
  {
      return 'exchange_orderbooks';
  }

  public getSequelizeDef(): any
  {
    return [{

          product_id: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            allowNull: false
          },          

          side: { 
            type: DataTypes.ENUM('ask','bid'), 
            allowNull: false
          }, 

          size: {
            type: DataTypes.DECIMAL(18,8),
            allowNull: false
          },          

          price: {
            type: DataTypes.DECIMAL(18,8),
            allowNull: true
          }
    },
    {
        indexes: [
            {
                fields: ['product_id','side','price'],
                unique: true
            }
        ]
    },
    ( dbService: IDatabaseService ) => {
        // schema
        dbService.models.exchange_orderbooks.removeAttribute('id');
    }    
    ];

  }
}