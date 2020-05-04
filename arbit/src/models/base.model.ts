import { toUnderscoreCase } from '../helpers';

export class BaseModel
{
    constructor(o)
    {
    }

    public getTableDefaults(): any
    {
        return {
            timestamps: true,
            paranoid: true,
            underscored: true,
            engine: "InnoDB",
            charset: "UTF8"
          };
    }

    public toJSON(): any
    {
        let o = {};
        Object.getOwnPropertyNames(this).map(p => o[p] = this[p]);
        return o;
    }

    public toDbModelJSON(ignoreNumbers?: boolean): any
    {
        let o = {};
        Object.getOwnPropertyNames(this).map(p => o[toUnderscoreCase(p, ignoreNumbers)] = this[p]);
        return o;
    }
}