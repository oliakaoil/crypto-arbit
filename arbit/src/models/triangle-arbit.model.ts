import { DataTypes } from 'sequelize';
import { BaseModel } from './base.model';
import { ISequelizeModel } from './sequelize.model.interface';
import { IDatabaseService } from '../services/database.service.interface';
import { ArbitStatus } from '../enums/arbit.enum';

export class TriangleArbitModel extends BaseModel implements ISequelizeModel {

    public id: number;
    public exchangeId: number;
    public parentId: number;
    
    public quoteCurrency: string;
    public currencyPair1: string;
    public currencyPair2: string;
    public currencyPair3: string;

    public estGross: number;
    public estNet: number;
    public estBaseSize: number;
    
    public estQfPrice1: number;
    public estQfSize1: number;
    public estQfFee1: number;

    public estQfPrice2: number;
    public estQfSize2: number;
    public estQfFee2: number;

    public estQfPrice3: number;
    public estQfSize3: number;    
    public estQfFee3: number;

    public orderId1: number;
    public orderId2: number;
    public orderId3: number;

    public net: number;
    public status: ArbitStatus;
  
    constructor(o?: any) {
        super(o);

        if (!o)
            return;

        this.id = o.id;
        this.exchangeId = o.exchange_id;
        this.parentId = o.parent_id;

        this.quoteCurrency = o.quote_currency;
        this.currencyPair1 = o.currency_pair1;
        this.currencyPair2 = o.currency_pair2;
        this.currencyPair3 = o.currency_pair3;

        this.estGross = o.est_gross;
        this.estNet = o.est_net;
        this.estBaseSize = o.est_base_size;
        
        this.estQfPrice1 = o.est_qf_price1;
        this.estQfSize1 = o.est_qf_size1;
        this.estQfFee1 = o.est_qf_fee1;

        this.estQfPrice2 = o.est_qf_price2;
        this.estQfSize2 = o.est_qf_size2;
        this.estQfFee2 = o.est_qf_fee2;

        this.estQfPrice3 = o.est_qf_price3;        
        this.estQfSize3 = o.est_qf_size3;
        this.estQfFee3 = o.est_qf_fee3;         

        this.orderId1 = o.order_id1;
        this.orderId2 = o.order_id2;
        this.orderId3 = o.order_id3;

        this.net = o.net;
        this.status = o.status;
    }

    getLog(): string {
        const currencyStr = [
            `${this.currencyPair1} @ ${this.estQfPrice1}`,
            `${this.currencyPair2} @ ${this.estQfPrice2}`,
            `${this.currencyPair3} @ ${this.estQfPrice3}`
        ].join(' => ');
        return `ex [${this.exchangeId}] ${currencyStr} | est net ${this.estNet}`;
    }

    public getTableName(): string
    {
        return 'triangle_arbits';
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

            parent_id: { 
                type: DataTypes.INTEGER.UNSIGNED, 
                allowNull: true,
                defaultValue: null
            },

            quote_currency: { 
                type: DataTypes.STRING, 
                allowNull: false
            },            

            currency_pair1: { 
                type: DataTypes.STRING, 
                allowNull: false
            },

            currency_pair2: { 
                type: DataTypes.STRING, 
                allowNull: false
            },

            currency_pair3: { 
                type: DataTypes.STRING, 
                allowNull: false
            },            

            est_gross: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            },             

            est_net: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            },               

            est_base_size: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            },  

            est_qf_price1: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            },             

            est_qf_size1: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            },            
                        
            est_qf_fee1: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            }, 

            est_qf_price2: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            }, 
            
            est_qf_size2: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            },             

            est_qf_fee2: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            }, 
            
            est_qf_price3: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            },   

            est_qf_size3: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            },

            est_qf_fee3: { 
                type: DataTypes.DECIMAL(15,8), 
                allowNull: false
            }, 

            order_id1: { 
                type: DataTypes.INTEGER.UNSIGNED, 
                allowNull: true
            },

            order_id2: { 
                type: DataTypes.INTEGER.UNSIGNED, 
                allowNull: true
            },

            order_id3: { 
                type: DataTypes.INTEGER.UNSIGNED, 
                allowNull: true
            },            

            net: {
                type: DataTypes.DECIMAL(15,8),
                allowNull: true
            },

            status: { 
                type: DataTypes.INTEGER.UNSIGNED, 
                allowNull: false
            }
        },
        {
            indexes: [
            ]
        },
        ( dbService: IDatabaseService ) => {

            const exchangeModel = dbService.models.exchanges;
            //const localOrderModel = dbService.models.local_orders;

            const tarbitModel = dbService.models.triangle_arbits;

            //exchangeModel.hasMany(tarbitModel, { onDelete: 'NO ACTION' });
        }
        ];
    }
}