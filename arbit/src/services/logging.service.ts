import * as moment from 'moment';
import chalk from 'chalk';

import { LogLevel } from "../enums/log-level.enum";
import { ILoggingService } from "./logging.service.interface";
import { INotifService } from "./notif.service.interface";
import { circularSafeStringify } from "../helpers";


export class LoggingService implements ILoggingService {

    private appEnv: any;
    private notifService: INotifService;

    public logLevel: number;
    private queryLog: Array<any>;
    private apiLog: Array<any>;
    private timer: [number,number];

    constructor(opts) {
        this.appEnv = opts.appEnv; 
        this.notifService = opts.notifService;

        this.logLevel = this.getLogLevel();
        this.queryLog = [];
        this.apiLog = [];
    }

    public getLogLevel(): number
    {
        return LogLevel[ String(this.appEnv.LOG_LEVEL).toLowerCase() ];
    }

    public async debug( ...params: any[]): Promise<Boolean> {
        return this.log(LogLevel.debug, ...params);
    }

    public async info( ...params: any[]): Promise<Boolean> {
        return this.log(LogLevel.info, ...params);
    }
    
    public async notice( ...params: any[]): Promise<Boolean> {
        return this.log(LogLevel.notice, ...params);
    }    

    public async warn(...params: any[]): Promise<Boolean> {
        return this.log(LogLevel.warn, ...params);
    }

    public async error(...params: any[]): Promise<Boolean> {
        return this.log(LogLevel.error, ...params);
    }

    public async critical( ...params: any[]): Promise<Boolean> {
        return this.log(LogLevel.critical, ...params);
    }

    public async infoWithNotif( ...params: any[]): Promise<Boolean> {
        await this.log(LogLevel.info, ...params);

        const fullLogMessage = this.getFullLogMessage(LogLevel.info, params.shift());

        return this.notifService.send(fullLogMessage);
    }

    public isDebug(): Boolean
    {
        return (this.getLogLevel() === LogLevel.debug);
    }

    private async log(level: LogLevel, ...params: any[]): Promise<Boolean> {

        if (level < this.logLevel) 
            return;

        const message = params.shift();
        const logMethod = (level >= LogLevel.error ? console.error : console.log);

        logMethod.apply(console, [this.getFullLogMessage(level, message)]);

        if (params.length)
            logMethod.apply(console, [params]);

        if (level < LogLevel.error)
            return;

        const notifLogMessage = this.getFullLogMessage(level, message, false);
        const notifLogData = (params.length ? circularSafeStringify(params) : null);
  
        return this.notifService.send(notifLogMessage, notifLogData);
    }

    private getFullLogMessage(level: LogLevel, message: string, useConsoleColors: boolean = true) : string
    {
        const logDate = moment().utc().format('YYYY-MM-DD HH:mm:ss');
        
        let levelLabel = String(LogLevel[level]).toUpperCase();
        
        if (useConsoleColors) {
            switch (level){
                case LogLevel.critical:
                    levelLabel = chalk.bgRed(levelLabel);
                break;
                case LogLevel.error:
                    levelLabel = chalk.red(levelLabel);
                break;
                case LogLevel.warn:
                    levelLabel = chalk.yellow(levelLabel);
                break;
      
            }
        }

        return `${logDate} | ${levelLabel} | ${message}`;
    }


}
