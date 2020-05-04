import * as memcachedPromise from 'memcached-promisify';
import * as md5 from 'md5';

import { ICacheService } from './cache.service.interface';
import { ILoggingService } from './logging.service.interface';
import { ServiceResponse } from '../service.response';


export class CacheService implements ICacheService {

    private appEnv: any;
    private logService: ILoggingService;
    private client: any;

    constructor(opts) {
        this.appEnv = opts.appEnv;
        this.logService = opts.logService;
    }

    public connect(): void 
    {
        this.client = new memcachedPromise(this.appEnv.MEMCACHED_HOST);
    }

    public async get(key: string): Promise<any>
    {
        return this.client.get(key);
    }

    public async set(key: string, val: any, expires?: number): Promise<boolean>
    {
        return this.client.set(key, val, (expires ? expires : 0));
    }

    public async delete(key: string): Promise<boolean>
    {
        return this.client.del(key);
    }

    public async flush(): Promise<boolean>
    {
        return this.client.flush();
    }

    public async getServiceResponse(
        classInst: any, 
        method: Function, 
        args: any[]
    ): Promise<ServiceResponse>
    {    
        const cachekey = this.getServiceResponseCacheKey(classInst, method, args);

        const cachedResponse = await this.get(cachekey);

        if (!cachedResponse)
            return new ServiceResponse(false);

        return new ServiceResponse(cachedResponse.ok, cachedResponse.data);
    }    

    public async storeServiceResponse(
        classInst: any, 
        method: Function, 
        args: any[], 
        expires: number,
        response: ServiceResponse
    ): Promise<boolean>
    {    
        const cachekey = this.getServiceResponseCacheKey(classInst, method, args);

        await this.set(cachekey, response, expires);

        return true;
    }

    public async serviceResponseWrapper(
        classInst: any, 
        method: Function, 
        args: any[], 
        expires: number,
        skipCache?: boolean
    ): Promise<ServiceResponse>
    {
        const cachekey = this.getServiceResponseCacheKey(classInst, method, args);

        const cachedResponse = (skipCache ? null : await this.get(cachekey));

        if (cachedResponse) {
            // await this.logService.debug(`CacheService::wrapper | pulling from cache for ${classInst.constructor.name}.${method.name}(${JSON.stringify(args)})`);
            return new ServiceResponse(cachedResponse.ok, cachedResponse.data);
        }

        const response:ServiceResponse = await method.apply(classInst, args);

        if (response.isOk())
            await this.set(cachekey, response, expires);

        return response;
    }

    private getServiceResponseCacheKey(
        classInst: any, 
        method: Function, 
        args: any[],         
    ): string
    {
        return md5(`${classInst.constructor.name}.${method.name}.${JSON.stringify(args)}`);
    }
}
