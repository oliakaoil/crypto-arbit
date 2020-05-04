import * as _ from 'underscore';
import { IDatabaseService } from './database.service.interface';
import { Sequelize, DataTypes } from 'sequelize';
import { ISequelizeModel } from '../models/sequelize.model.interface';
import { LogLevel } from "../enums/log-level.enum";
import { ILoggingService } from './logging.service.interface';


export class DatabaseService implements IDatabaseService {

  public models: any;
  public schemaCallbacks: Function[];
  private sequelizeInst: Sequelize;

  private appEnv: any;
  private logService: ILoggingService;

  constructor(opts) {
    this.appEnv = opts.appEnv;
    this.logService = opts.logService;
    this.schemaCallbacks = [];
    this.models = {};
  }

  public connect(): void {
    const sequelizeOpts = { 
      host: this.appEnv.MYSQL_HOST,
      operatorsAliases: false,
      dialect: 'mysql',
      logging: (e) => {
        if (Number(this.appEnv.MYSQL_DEBUG) === 1)
          console.log(e);
      },
      timezone: '+00:00'
    };

    this.sequelizeInst = new Sequelize(this.appEnv.MYSQL_DATABASE, this.appEnv.MYSQL_USER, this.appEnv.MYSQL_PASSWORD, sequelizeOpts);
  }

  public async query(sql: string): Promise<any>
  {
    try {
      const result = await this.sequelizeInst.query(sql);
      if (!result || !result.length)
        throw new Error('Query result missing data or metadata');

      // https://sequelize.readthedocs.io/en/v3/docs/raw-queries
      // raw queries return an array containing the query result and some metadata, which we generally don't need
      return result.shift();
    } catch (err) {
      await this.logService.error('DbService::query | query',err);
      return null;
    }
  }

  public migrate(): Promise<Boolean> {
    return this.sequelizeInst.sync({ force: false })
      .then(() => {
        console.log('done');
        this.sequelizeInst.close();
        return true;
      }).catch((err) => {
        console.error('Db migrate error');
        console.error(err);
        this.sequelizeInst.close();
        return false;
      });    
  }

  public initModel(sModel: ISequelizeModel, modelKey?: string ): void
  {
    const tableName = sModel.getTableName();
    const modelTableDefaults = sModel.getTableDefaults();
    const instTableDefaults = _.extend( {} , modelTableDefaults, { tableName });

    const sModelDef = sModel.getSequelizeDef();
    let fieldsDef, tableOpts;

    if (sModelDef.length) {
      fieldsDef = sModelDef[0];
      tableOpts = sModelDef[1];
      if (sModelDef[2])
        this.schemaCallbacks.push(sModelDef[2]);
    } else {
      fieldsDef = sModelDef;
      tableOpts = {};
    }

    this.models[(modelKey ? modelKey : tableName)] = this.sequelizeInst.define(tableName, fieldsDef, _.extend( {} , instTableDefaults, tableOpts));
  }

  public initSchema() : void
  {
    this.schemaCallbacks.map(c => c(this));
  }
}
