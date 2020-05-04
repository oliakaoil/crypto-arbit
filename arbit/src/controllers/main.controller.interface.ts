export interface IMainController 
{
    showExchangeStats(): Promise<boolean>

    localizeOrderbooksByWebsocket(): Promise<boolean>

    localizeOrderbooksByRest(): Promise<boolean>

    tarbitScan(): Promise<boolean>

    updateExchangeProducts() : Promise<boolean>
}
