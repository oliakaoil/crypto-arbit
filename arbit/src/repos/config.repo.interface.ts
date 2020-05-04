import { ConfigModel } from '../models/config.model';


export interface IConfigRepo {

  getAll(): Promise<ConfigModel[]>

}