import { Controller, Post, Body, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { SendMessageBulkDto, SendMessageDto } from './dto/SendMessage.dto';
import { HandledEventPattern } from 'src/common/decorators/handled-event.decorator';
import { HandledPayload } from 'src/common/decorators/handle-payload.decorator';

@Controller('telegram')
export class TelegramController {
  private logger: Logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  @Post('/send-message')
  async sendMessage(@Body() body: SendMessageDto) {
    await this.telegramService.addToQueue(body);
    return { status: 'Message added to queue' };
  }

  @Post('/send-message/bulk')
  async sendMessageBulk(@Body() { messages }: SendMessageBulkDto) {
    for (let index = 0; index < messages.length; index++) {
      await this.telegramService.addToQueue(messages[index]);
    }
    return { status: 'Messages added to queue' };
  }

  @HandledEventPattern('tg.send', SendMessageDto)
  async handleTgSend(@HandledPayload() data: SendMessageDto) {
    await this.telegramService.addToQueue(data);
  }
}
