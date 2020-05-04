import * as convertHrTime from "convert-hrtime";

export enum DateFormat {
  Default = 'YYYY-MM-DD HH:mm:ssZ'
};

// https://stackoverflow.com/questions/33289726/combination-of-async-function-await-settimeout
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
} 

// https://stackoverflow.com/questions/30521224/javascript-convert-pascalcase-to-underscore-case
export function toUnderscoreCase(s: string, ignoreNumbers?: boolean): string {
  const pattern = (ignoreNumbers ? new RegExp(/\.?([A-Z])/, 'g') : new RegExp(/\.?([A-Z0-9])/, 'g'));

  return s
    .replace(pattern, (x,y) => {return "_" + y.toLowerCase()})
    .replace(/^_/, "") // remove leading underscore
    .replace(/([0-9]{1})_([0-9]{1})/,"$1$2"); // group numbers back together, so foo123bar => foo_1_2_3_bar => foo_123_bar
}

// If we just use toFixed, the value will be rounded up, which is not helpful. This will simply truncate the number, in effect rounding down slightly
export function toFixedTruncate(v: number|string,n: number): number  {
  let p = String(v).split('.');
  if (p.length === 1)
    return Number(v);
  let d = p.pop();
  return Number(p.shift() + '.' + d.substring(0,n));
 };


// https://stackoverflow.com/questions/11616630/how-can-i-print-a-circular-structure-in-a-json-like-format
export function circularSafeStringify(circ: any): string {
  let cache = [];
  
  return JSON.stringify(circ, function(key, value) {
      if (typeof value === 'object' && value !== null) {
          if (cache.indexOf(value) !== -1) {
              // Duplicate reference found, discard key
              return;
          }
          // Store value in our collection
          cache.push(value);
      }
      return value;
  });  
};


// https://stackoverflow.com/questions/1960473/get-all-unique-values-in-a-javascript-array-remove-duplicates
export function arrayUnique(a: any): any {

  function onlyUnique(value, index, self) { 
    return self.indexOf(value) === index;
  }

  return a.filter( onlyUnique );
}

export class Timer {

  private timer: [number,number];

  public start(): [number,number] 
  {
    this.timer = process.hrtime();
    return this.timer;
  }

  public stop(): { ms: number, seconds: number }
  {
      if (!this.timer) {
          this.timer = null;
          return;
      }

      const endTime = process.hrtime(this.timer);
      this.timer = null;

      const hrTime = convertHrTime(endTime);

      return {
        ms: hrTime.milliseconds,
        seconds: hrTime.seconds
      };
  }  
}

export function getQuoteFromPair(currencyPair: string): string {
  const currencyParts: string[] = currencyPair.split('-');
  return currencyParts.pop();
}

export function getBaseFromPair(currencyPair: string): string {
  const currencyParts: string[] = currencyPair.split('-');
  const quoteCurrency = currencyParts.pop();
  const baseCurrency = currencyParts.join('-');     
  return baseCurrency;
}