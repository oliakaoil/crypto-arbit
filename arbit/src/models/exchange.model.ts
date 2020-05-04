import { DataTypes } from 'sequelize';
import { ISequelizeModel } from './sequelize.model.interface';
import { BaseModel } from './base.model';
import { ExchangeLockType, ExchangeStatus, ExchangeLocalizeType } from '../enums/exchange.enum';

export class ExchangeModel extends BaseModel implements ISequelizeModel {

  public id: number;
  public name: string;
  public status: ExchangeStatus;
  public exLock: ExchangeLockType;

  // localize orderbooks using REST API
  public localizeType: ExchangeLocalizeType;

  // triangle arbit scan all slow-polling method included/excluded flag
  public tarbitEnabled: boolean;

  // arbit scan all slow-polling method included/excluded flag
  public arbitEnabled: boolean;

  // funds available for arbit, tarbits
  public funds: number;

  // triangle arbit execution enabled
  public tarbitExecute: boolean;

  // arbit execution enabled
  public arbitExecute: boolean;

  constructor(o?: any) {
    super(o);

    if (!o)
      return;
      
    this.id = o.id;
    this.name = o.name;
    this.status = o.status;
    this.exLock = o.ex_lock;
    this.localizeType = o.localize_type;
    this.tarbitEnabled = o.tarbit_enabled;
    this.arbitEnabled = o.arbit_enabled;
    this.funds = o.funds;
    this.tarbitExecute = o.tarbit_execute;
    this.arbitExecute = o.arbit_execute;
  }

  public getTableName(): string
  {
      return 'exchanges';
  }

  public getSequelizeDef(): any
  {
    return [{
          id: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            primaryKey: true, 
            autoIncrement: true 
          },
          
          name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
          },

          status: {
            type: DataTypes.TINYINT,
            allowNull: false,
            defaultValue: 1
          },
          
          ex_lock: {
            type: DataTypes.TINYINT,
            allowNull: false,
            defaultValue: 1
          },

          localize_type: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
          },          

          tarbit_enabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
          },

          arbit_enabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
          },          

          funds: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
          },   

          tarbit_execute: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
          },

          arbit_execute: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
          }          
      },
      {}
    ];

  }
}