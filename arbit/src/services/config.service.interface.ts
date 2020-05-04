import { ServiceResponse } from '../service.response';

export interface IConfigService {

    getConfig(): Promise<ServiceResponse>
}