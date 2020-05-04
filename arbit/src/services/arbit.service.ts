import { IArbitService } from './arbit.service.interface';
import { ILoggingService } from './logging.service.interface';
import { ICoinService } from './coin.service.interface';

import { IArbitRepo } from '../repos/arbit.repo.interface';
import { IExchangeRepo } from '../repos/exchange.repo.interface';

import { ExchangeProductModel } from '../models/exchange-product.model';
import { ExchangeTransferModel } from '../models/exchange-transfer.model';
import { ExchangeMetaModel } from '../models/exchange-meta.model';
import { TriangleArbitModel } from '../models/triangle-arbit.model';

import { ServiceResponse } from '../service.response';
import { TriangleArbitEstimate, TriangleArbitSet } from '../arbit.response';

import { ExchangeIds } from '../enums/exchange.enum';
import { ArbitStatus } from '../enums/arbit.enum';


export class ArbitService implements IArbitService {

  private logService: ILoggingService;
  private exchangeRepo: IExchangeRepo;
  private arbitRepo: IArbitRepo;
  private coinService: ICoinService;
  private getExchangeServiceById: CallableFunction;

  constructor(opts) {
    this.logService = opts.logService;
    this.exchangeRepo = opts.exchangeRepo;
    this.arbitRepo = opts.arbitRepo;
    this.coinService = opts.coinService;
    this.getExchangeServiceById = opts.getExchangeServiceById;
  }

  public async getActiveExchanges(): Promise<ServiceResponse>
  {
    const exchanges = await this.exchangeRepo.getActive();

    return new ServiceResponse(true, exchanges);
  }

  public async getExchangeById(exchangeId: ExchangeIds): Promise<ServiceResponse>
  {
    const exchange = await this.exchangeRepo.getById(exchangeId);

    return new ServiceResponse(true, exchange);
  }

  public async getAllProductsByExchangeId(exchangeId: number): Promise<ServiceResponse> 
  {
    let products = await this.exchangeRepo.getAllProductsByExchangeId(exchangeId);

    return new ServiceResponse(true, products);
  }

  public async getProductByCurrencyPair(exchangeId: ExchangeIds, currencyPair: string): Promise<ServiceResponse>
  {
    const product = await this.exchangeRepo.getProductByCurrencyPair(exchangeId, currencyPair);

    return new ServiceResponse(true, product);    
  }

  public async getArbitExchangeProducts(exchangeId: ExchangeIds): Promise<ServiceResponse>
  {
    const productResponse = await this.getAllProductsByExchangeId(exchangeId);

    if (!productResponse.isOk())
      return productResponse;
    
    const products: ExchangeProductModel[] = this.filterExchangeProducts(productResponse.getData(), false, 10000);

    return new ServiceResponse(true, products);
  }

  public filterExchangeProducts(
    products: ExchangeProductModel[], 
    usdOnly: boolean,
    min24hrUsdVolume: number
  ): ExchangeProductModel[]
  {

    // create a set of currencies that have usd/stablecoin pairs at the given exchange
    if (usdOnly) {  
      const quoteCurrenciesWithUsd: Set<string> = new Set();

      products.map((exchangeProduct: ExchangeProductModel) => {
        if (this.coinService.isStablecoin(exchangeProduct.quoteCurrency) || this.coinService.isFiat(exchangeProduct.quoteCurrency))
          quoteCurrenciesWithUsd.add(exchangeProduct.baseCurrency);
      });

      products = products.filter((exchangeProduct: ExchangeProductModel) => {
        return quoteCurrenciesWithUsd.has(exchangeProduct.baseCurrency);
      });
    }

    if (min24hrUsdVolume) {
      products = products.filter((exchangeProduct: ExchangeProductModel) => {

        // if the volume value === -1, that means it's not available because a conversion rate was not available, just let it by
        return (exchangeProduct.volume24hrUsd === -1 || exchangeProduct.volume24hrUsd > min24hrUsdVolume);
      });
    }    

    return products;
  }

  public async upsertExchangeProduct(product: ExchangeProductModel): Promise<ServiceResponse>
  {
    const response = await this.exchangeRepo.upsertExchangeProduct(product);

    return new ServiceResponse(response);
  }

  public async updateExchangeProductById(productId: number, attrs: any): Promise<ServiceResponse>
  {
    const response = await this.exchangeRepo.updateExchangeProductById(productId, attrs);

    return new ServiceResponse(response);
  }    

  public async incrementInsufficientFills(productId: number): Promise<ServiceResponse>
  {
    const response = await this.exchangeRepo.incrementInsufficientFills(productId);

    return new ServiceResponse(response);    
  }  

  public async createTransfer(transfer: ExchangeTransferModel): Promise<ServiceResponse>
  {
    const response = await this.exchangeRepo.createTransfer(transfer);

    if (!response)
      return new ServiceResponse(false);

    return new ServiceResponse(true, response);
  }

  public async updateTransfer(transfer: ExchangeTransferModel): Promise<ServiceResponse>
  {
    const response = await this.exchangeRepo.updateTransfer(transfer);

    if (!response)
      return new ServiceResponse(false);

    return new ServiceResponse(true, response);
  }

  public async createTriangleArbitFromEstimate(arbitEstimate: TriangleArbitEstimate, parentId?:number): Promise<ServiceResponse>
  {
    const quickFill1 = arbitEstimate.firstLegQuickFill;
    const quickFill2 = arbitEstimate.secondLegQuickFill;
    const quickFill3 = arbitEstimate.thirdLegQuickFill;

    const arbitModel = new TriangleArbitModel({
      id: null,
      exchange_id: arbitEstimate.exchangeId,
      parent_id: parentId,
      quote_currency: arbitEstimate.quoteCurrency,
      currency_pair1: quickFill1.currencyPair,
      currency_pair2: quickFill2.currencyPair,
      currency_pair3: quickFill3.currencyPair,
      est_gross: 0,
      est_net: arbitEstimate.netDiff,
      est_base_size: arbitEstimate.baseSize,

      est_qf_price1: quickFill1.bestPrice,
      est_qf_size1: quickFill1.size,
      est_qf_fee1: quickFill1.takerFee,

      est_qf_price2: quickFill2.bestPrice,
      est_qf_size2: quickFill2.size,
      est_qf_fee2: quickFill2.takerFee,
      
      est_qf_price3: quickFill3.bestPrice,
      est_qf_size3: quickFill3.size,
      est_qf_fee3: quickFill3.takerFee,

      order_id1: null,
      order_id2: null,
      order_id3: null,
      net: null,
      status: ArbitStatus.Created
    });

    return this.createTriangleArbit(arbitModel);
  }

  public async createTriangleArbit(arbitModel: TriangleArbitModel): Promise<ServiceResponse>
  {
    const response = await this.arbitRepo.createTriangleArbit(arbitModel);

    if (!response)
      return new ServiceResponse(false);

    return new ServiceResponse(true, response);
  }

  public async updateTriangleArbitById(arbitId: number, attrs: any): Promise<ServiceResponse>
  {
    const response = await this.arbitRepo.updateTriangleArbitById(arbitId, attrs);

    return new ServiceResponse(response);
  } 
  
  /*
   * Iterate through the list of all available products at the given 
   * exchange and look for matching currency pairs that make up a triangle arbit
   */
  public async findSetsByExchange(
      exchangeId: ExchangeIds
  ): Promise<TriangleArbitSet[]>
  {
      const logId = `ArbitService::findSetsByExchange | ex [${exchangeId}]`;

      const exchangeService = this.getExchangeServiceById(exchangeId);

      if (!exchangeService) {
          await this.logService.error(`${logId} unable to load ex service`);
          return;
      }

      const exProductResponse = await this.getArbitExchangeProducts(exchangeService.getExchangeId());
      if (!exProductResponse.isOk()) {
          await this.logService.error(`${logId} cannot load products`);
          return;
      }
      const allExProducts: ExchangeProductModel[] = exProductResponse.getData();
      const setExProducts: Map<string, ExchangeProductModel> = new Map();
      allExProducts.map(exchangeProduct => setExProducts.set(exchangeProduct.getCurrencyPair(), exchangeProduct));


      const arbitSets: TriangleArbitSet[] = [];

      allExProducts.map(firstLegProduct => {

          // 1. Start with first leg XRP-BTC (base-quote)

          // 2. Find every product that can be bought using the first-leg base currency of XRP (i.e. ETH-XRP, USDT-XRP, BCH-XRP)
          const secondLegProducts = allExProducts.filter(exchangeProduct => {
              return exchangeProduct.quoteCurrency === firstLegProduct.baseCurrency
          });


          secondLegProducts.map(secondLegProduct => {

            // 3. Does a product exist which has a base of the second leg product and a quote of the first leg product (i.e. ETH-BTC)?
            const thirdLegPair = `${secondLegProduct.baseCurrency}-${firstLegProduct.quoteCurrency}`;

            const thirdLegProduct = setExProducts.get(thirdLegPair);

            if (thirdLegProduct) {
                const taSet = new TriangleArbitSet();
                taSet.exchangeId = exchangeId;
                taSet.firstLegProduct = firstLegProduct;
                taSet.secondLegProduct = secondLegProduct;
                taSet.thirdLegProduct = thirdLegProduct;
                arbitSets.push(taSet);
            }
          });
      });

      await this.logService.debug(`${logId} found ${arbitSets.length} sets`);

      return arbitSets;
  }    
}
