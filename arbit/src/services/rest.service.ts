import * as moment from 'moment';
import { ILoggingService } from './logging.service.interface';

import { sleep } from '../helpers';


class ApiCall { 
    token: string; // a unique identifier for the endpoint (other than the URI)
    timestamp: number; // the time when the call is happening
    private: boolean = false; // whether or not the call is to a private endpoint. private endpoints tend to have higher rate limits.
};


export class RestService
{
    protected logService: ILoggingService;
    protected apiCallBucket: ApiCall[] = [];
    protected apiRateLimit: number = 100;

    constructor(opts)
    {
        this.logService = opts.logService;
    }

    protected async checkRateLimit(
        callToken: string,
        callPrivate: boolean = false
    ): Promise<boolean>
    {
        // current timestamp in milliseconds (https://momentjs.com/docs/#/displaying/unix-timestamp-milliseconds/)
        const currentTimestamp = moment().valueOf(); 

        // How many calls made in the last second?
        const recentTimestamp = currentTimestamp - 1000;

        // filter the bucket down to only calls made since the last rate limit window
        this.apiCallBucket = this.apiCallBucket
            .filter((apiCall: ApiCall) => apiCall.timestamp >= recentTimestamp);

        // Number of calls since the last second exceeds the rate limit? we need to wait
        if (this.apiCallBucket.length >= this.apiRateLimit) {

            const oldestCall = this.apiCallBucket[0];
            const targetTimestamp = oldestCall.timestamp + 1001;
            const waitTimeMs = (targetTimestamp - currentTimestamp);

            // call 1 @ 2.1 seconds
            // call 2 @ 2.2 seconds
            // call 3 @ 2.3 seconds
            // it's now 3.0 seconds
            // recent timestamp = 2.0 seconds
            // recent call length = 3
            // oldest call 2.1 seconds
            // we must wait until slightly after the last call, 2.1 + 1 + 0.1

            await sleep(waitTimeMs);

            await this.logService.debug(`RestService::checkRateLimit | token ${callToken} | sleeping ${waitTimeMs}`);
        }

        // record the call
        const apiCall: ApiCall = new ApiCall();
        apiCall.private = callPrivate;
        apiCall.token = callToken;
        apiCall.timestamp = moment().valueOf();

        this.apiCallBucket.push(apiCall);

        return true;
    }    
}



/*

Coinbase
===

Public endpoints

We throttle public endpoints by IP: 3 requests per second, up to 6 requests per second in bursts.

Private endpoints

We throttle private endpoints by profile ID: 5 requests per second, up to 10 requests per second in bursts.

*/