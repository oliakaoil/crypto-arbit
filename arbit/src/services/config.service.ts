
import { IConfigService } from './config.service.interface';
import { ILoggingService } from './logging.service.interface';
import { IConfigRepo } from '../repos/config.repo.interface';

import { ServiceResponse } from '../service.response';


export class ConfigService implements IConfigService {

  private logService: ILoggingService;
  private configRepo: IConfigRepo;

  constructor(opts)
  {
    this.logService = opts.logService;
    this.configRepo = opts.configRepo;
  }

  public async getConfig(): Promise<ServiceResponse>
  {
    const configModels = await this.configRepo.getAll();

    if (!configModels)
      return new ServiceResponse(false);

    const config = {};

    configModels.map(c => { 
        let val;
        
        switch (c.configValueType) {
            case 'number':
                val = Number(c.configValue);
            break;
            case 'json':
                val = JSON.parse(c.configValue);
            break;
            default:
                val = c.configValue;
        }

        config[c.configKey] = val; 
    });

    return new ServiceResponse(true, config);
  }
}