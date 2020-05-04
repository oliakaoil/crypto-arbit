import { DataTypes } from 'sequelize';
import { ISequelizeModel } from './sequelize.model.interface';
import { BaseModel } from './base.model';


export class ConfigModel extends BaseModel implements ISequelizeModel {

  public id: number;
  public configKey: string;
  public configValue: string;
  public configValueType: 'string' | 'json' | 'number';
  public desc: string;
  
  constructor(o?: any) {
    super(o);

    if (!o)
      return;

    this.id = o.id;
    this.configKey = o.config_key;
    this.configValue = o.config_value;
    this.configValueType = o.config_value_type;
    this.desc = (o.desc ? o.desc : '');
  }

  public getTableName(): string
  {
      return 'config';
  }

  public getSequelizeDef(): any
  {
    return [{
          id: { 
            type: DataTypes.INTEGER.UNSIGNED, 
            primaryKey: true, 
            autoIncrement: true 
          },
          
          config_key: {
            type: DataTypes.STRING(24),
            allowNull: false,
            unique: true
          },

          config_value: {
            type: DataTypes.TEXT,
            allowNull: false
          },

          config_value_type: {
              type: DataTypes.ENUM('string','json','number'),
              allowNull: false,
              defaultValue: 'string'
          },

          desc: {
            type: DataTypes.STRING,
            allowNull: true
          }          
      },
      {}
    ];

  }
}