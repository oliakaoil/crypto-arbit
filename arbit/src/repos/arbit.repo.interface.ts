import { TriangleArbitModel } from '../models/triangle-arbit.model';


export interface IArbitRepo {

    createTriangleArbit(arbitModel: TriangleArbitModel): Promise<TriangleArbitModel>

    updateTriangleArbitById(arbitId: number, attrs: any): Promise<boolean>
}