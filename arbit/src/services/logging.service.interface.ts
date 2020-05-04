
export interface ILoggingService {

    logLevel: number;

    getLogLevel(): number;

    debug( ...params: any[]): Promise<Boolean>

    info( ...params: any[]): Promise<Boolean>
    
    notice( ...params: any[]): Promise<Boolean>

    warn(...params: any[]): Promise<Boolean>

    error(...params: any[]): Promise<Boolean>

    critical( ...params: any[]): Promise<Boolean>

    isDebug(): Boolean

    infoWithNotif( ...params: any[]): Promise<Boolean>
}
