import { ISequelizeModel } from '../models/sequelize.model.interface';


export interface IDatabaseService {

  models: any;

  connect() : void

  query(sql: string): Promise<any>

  migrate(): Promise<Boolean>

  initModel(sModel: ISequelizeModel, modelKey?: string) : void

  initSchema() : void
}
