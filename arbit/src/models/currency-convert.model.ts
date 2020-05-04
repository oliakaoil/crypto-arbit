import { DataTypes } from 'sequelize';
import { BaseModel } from './base.model';
import { ISequelizeModel } from './sequelize.model.interface';
import { IDatabaseService } from '../services/database.service.interface';


export class CurrencyConvertModel extends BaseModel implements ISequelizeModel {

    public id: number;
    public baseCurrency: string;
    public quoteCurrency: string;
    public rate: number;
    public source: string;
    
    constructor(o?: any) {
        super(o);

        if (!o)
            return;

        this.id = o.id;
        this.baseCurrency = o.base_currency;
        this.quoteCurrency = o.quote_currency;
        this.rate = Number(o.rate);
        this.source = o.source;
    }

    public getTableName(): string
    {
        return 'currency_converts';
    }

    public getSequelizeDef(): any
    {
        return [{
            id: { 
                type: DataTypes.INTEGER.UNSIGNED, 
                primaryKey: true, 
                autoIncrement: true 
            },

            base_currency: { 
                type: DataTypes.STRING, 
                allowNull: false
            },              

            quote_currency: { 
                type: DataTypes.STRING, 
                allowNull: false
            },            

            rate: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            },  
            
            source: { 
                type: DataTypes.STRING, 
                allowNull: true
            },              
        },
        {
            indexes: [
                {
                    unique: true,
                    fields: ['quote_currency', 'base_currency']
                }                
            ]
        },
        ( dbService: IDatabaseService ) => {

            // schema
        }
        ];
    }
}