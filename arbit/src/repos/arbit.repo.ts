import { IArbitRepo } from './arbit.repo.interface';
import { BaseRepo } from './base.repo';

import { TriangleArbitModel } from '../models/triangle-arbit.model';


export class ArbitRepo extends BaseRepo implements IArbitRepo {


  constructor(opts)
  {
    super(opts);
    this.dbModel = this.dbService.models.triangle_arbits;
  }

  public async createTriangleArbit(arbitModel: TriangleArbitModel): Promise<TriangleArbitModel>
  {
    try {

      let data = arbitModel.toDbModelJSON(true);

      if (!data.id)
        delete data.id;      

      const result = await this.dbModel.create(data, {returning: true});

      return new TriangleArbitModel(result.dataValues);

    } catch (err) {
      await this.logService.error('ArbitRepo::createTriangleArbit', err);
      return;
    }  
  }

  public async updateTriangleArbitById(arbitId: number, attrs: any): Promise<boolean>
  {
    try {

      const result = await this.dbModel.update(attrs, {where: {id: arbitId }});
   
      return true;

    } catch (err) {
      await this.logService.error('ArbitRepo::updateTriangleArbitById', err);
      return false;
    }
  }
}