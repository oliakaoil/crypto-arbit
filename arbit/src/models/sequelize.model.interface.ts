
export interface ISequelizeModel
{
    getTableName(): string;

    getTableDefaults(): boolean;

    getSequelizeDef(): any;

    toJSON(): any;

    toDbModelJSON(): any;
}