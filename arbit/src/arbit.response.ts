import chalk from 'chalk';
import { ExchangeQuickFill, ExchangeAccount } from "./exchange.response";
import { ExchangeMetaModel } from "./models/exchange-meta.model";
import { ExchangeProductModel } from './models/exchange-product.model';
import { ExchangeIds } from './enums/exchange.enum';


export class ArbitEstimate {
    
    public sourceExchangeQuickFill: ExchangeQuickFill;
    public sourceExchangeMeta: ExchangeMetaModel;
    
    public targetExchangeQuickFill: ExchangeQuickFill;
    public targetExchangeMeta: ExchangeMetaModel;

    public currencyPair: string;
    public size: number;
    public arbitNet: number;
    public arbitGross: number;
    public arbitNetPct: number;
    public fillFee: number;
    public withdrawalFee: number;
};

export class TriangleArbitEstimate {
  exchangeId: number;
  baseSize: number;
  quoteCurrency: string;
  firstLegQuickFill: ExchangeQuickFill;
  secondLegQuickFill: ExchangeQuickFill;
  thirdLegQuickFill: ExchangeQuickFill;
  netDiff: number;

  getLog(): string {

    const firstLegLog = `Buy ${this.firstLegQuickFill.size.toFixed(4)} ${this.firstLegQuickFill.currencyPair} @ ${this.firstLegQuickFill.bestPrice.toFixed(4)}`;
    const secondLegLog = `Buy ${this.secondLegQuickFill.size.toFixed(4)} ${this.secondLegQuickFill.currencyPair} @ ${this.secondLegQuickFill.bestPrice.toFixed(4)}`;
    const thirdLegLog = `Sell ${this.secondLegQuickFill.size.toFixed(4)} ${this.thirdLegQuickFill.currencyPair} @ ${this.thirdLegQuickFill.bestPrice.toFixed(4)}`;
    let netLog = `Net => ${this.netDiff.toFixed(4)}`;

        
    if (this.netDiff > 0)
        netLog = chalk.green(netLog);                

    return `ex [${this.exchangeId}] ${firstLegLog} => ${secondLegLog} => ${thirdLegLog} | ${netLog}`;    
  }  
}

export class TriangleArbitSet {
  exchangeId: ExchangeIds;
  firstLegProduct: ExchangeProductModel;
  secondLegProduct: ExchangeProductModel;
  thirdLegProduct: ExchangeProductModel;

  getId(): string {
    return `ex${this.exchangeId}|${this.firstLegProduct.getCurrencyPair()}=${this.secondLegProduct.getCurrencyPair()}=${this.thirdLegProduct.getCurrencyPair()}`;
  }

  getLog(): string {
    return `ex [${this.exchangeId}] ${this.firstLegProduct.getCurrencyPair()} => ${this.secondLegProduct.getCurrencyPair()} => ${this.thirdLegProduct.getCurrencyPair()}`;
  }

  getProducts(): ExchangeProductModel[]
  {
    return [
      this.firstLegProduct,
      this.secondLegProduct,
      this.thirdLegProduct
    ];
  }
}