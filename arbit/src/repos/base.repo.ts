import { IDatabaseService } from '../services/database.service.interface';
import { ILoggingService } from '../services/logging.service.interface';

export class BaseRepo {
    
    protected dbService: IDatabaseService;
    protected logService: ILoggingService;
    protected dbModel;
  
    constructor(opts)
    {
      this.dbService = opts.dbService;
      this.logService = opts.logService;
      this.dbModel = this.dbService.models.config;
    }
  
}