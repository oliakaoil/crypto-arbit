import { IConfigRepo } from './config.repo.interface';
import { BaseRepo } from './base.repo';

import { ConfigModel } from '../models/config.model';


export class ConfigRepo extends BaseRepo implements IConfigRepo {

  constructor(opts)
  {
    super(opts);
    this.dbModel = this.dbService.models.config;
  }

  public async getAll(): Promise<ConfigModel[]>
  {
    try {
      const result = await this.dbModel.findAll();

      if (!result)
        return null;

      return result.map(r => new ConfigModel(r));

    } catch (err) {
      await this.logService.error('ConfigRepo::getAll', err);
      return null;
    }    
  }
}