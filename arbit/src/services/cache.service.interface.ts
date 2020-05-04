import { ServiceResponse } from '../service.response';

export interface ICacheService {

    connect() : void

    get(key: string): Promise<any>

    set(key: string, val: any, expires?: number): Promise<boolean>

    delete(key: string): Promise<boolean>

    flush(): Promise<boolean>

    getServiceResponse(
        classInst: any, 
        method: Function, 
        args: any[]
    ): Promise<ServiceResponse>    

    storeServiceResponse(
        classInst: any, 
        method: Function, 
        args: any[], 
        expires: number,
        response: ServiceResponse
    ): Promise<boolean>    

    serviceResponseWrapper(
        classInst: any, 
        method: CallableFunction, 
        args: any[], 
        expires: number,
        skipCache?: boolean
    ): Promise<any>
}
