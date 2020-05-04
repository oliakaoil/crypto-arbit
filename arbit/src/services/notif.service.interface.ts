
export interface INotifService {

  send(message: string, attachment?: string): Promise<Boolean>
};