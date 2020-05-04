export class ServiceResponse
{
    private ok: boolean;
    private data: any;

    constructor(ok: boolean, data?: any)
    {
        this.ok = ok;
        this.data = data;
    }

    public isOk(): boolean
    {
        return this.ok;
    }

    public getData(): any
    {
        return this.data;
    }

}