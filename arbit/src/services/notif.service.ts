import { INotifService } from './notif.service.interface';
import { WebClient } from '@slack/web-api';


export class NotifService implements INotifService {

  private slackService: WebClient;
  private appEnv: any;

  constructor(opts) {
    this.slackService = opts.slackService;
    this.appEnv = opts.appEnv;
  }

  public async send(message: string, attachment?: string): Promise<Boolean> {

    if (!message) 
      return false;

    const messageOpts = { 
      as_user: false,
      channel: this.appEnv.SLACK_NOTIF_CHANNEL_ID,
      text: String(message)
    };

    try {

      // await this.showSlackInfo();

      if (attachment) {
        const result: any = await this.slackService.files.upload({
          filename: 'debug-message.json',
          filetype: 'application/json',
          content: attachment
        });

        messageOpts.text += `\n${result.file.url_private}`;
      }      

      await this.slackService.chat.postMessage(messageOpts);
      
      return true;

    } catch (err) {
      // @todo how to use logService here? can't right now because it has this service as a dependency
      console.error('NotifService::send | probably failed to send a message');
      console.error(err);
      return false;
    }
  }

  private async showSlackInfo(): Promise<any>
  {
        const result = await this.slackService.files.upload({
    //      channels: this.appEnv.SLACK_NOTIF_CHANNEL_ID,
          filename: 'debug-message-01.json',
          filetype: 'json',
          content: '{ "foo": 1 }'
        });

      // //console.log(await this.slackService.files.remote.list());

      console.log(result);

      // console.log(await this.slackService.files.remote.info({external_id: 'FPN2TUC1G'}));

      //console.log(await this.slackService.conversations.list());
      // console.log(await this.slackService.im.list());
      // console.log(await this.slackService.users.list());
      process.exit();
  }
};