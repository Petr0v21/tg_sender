import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import axios from 'axios';
import { ContentTypeEnum, SendMessageDto } from './dto/SendMessage.dto';
import { Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';

export type MethodType =
  | 'sendMessage'
  | 'sendPhoto'
  | 'sendVideo'
  | 'sendAudio'
  | 'sendDocument'
  | 'sendAnimation';

export type RequestPayload = {
  chat_id: number | string;
  text?: string;
  caption?: string;
  reply_markup?: any;
  parse_mode?: string;
  document?: string;
  audio?: string;
  photo?: string;
  video?: string;
  animation?: string;
};

@Processor('telegram-queue')
export class TelegramProcessor {
  private logger: Logger = new Logger(TelegramProcessor.name);

  constructor(private readonly redisService: RedisService) {}

  @Process('send-telegram-message')
  async handleSendMessage(job: Job<SendMessageDto>) {
    const {
      botToken,
      chatId,
      text,
      contentType,
      replyMarkup,
      fileUrl,
      fileId,
    } = job.data;
    try {
      const payload: RequestPayload = {
        chat_id: chatId,
        reply_markup: replyMarkup,
        parse_mode: 'HTML',
      };

      payload[
        contentType && contentType !== ContentTypeEnum.TEXT ? 'caption' : 'text'
      ] = text;
      let method: MethodType = 'sendMessage';
      switch (contentType) {
        case ContentTypeEnum.PHOTO:
          method = 'sendPhoto';
          payload.photo = fileUrl ?? fileId;
          break;
        case ContentTypeEnum.VIDEO:
          method = 'sendVideo';
          payload.video = fileUrl ?? fileId;
          break;
        case ContentTypeEnum.AUDIO:
          method = 'sendAudio';
          payload.audio = fileUrl ?? fileId;
          break;
        case ContentTypeEnum.FILE:
          method = 'sendDocument';
          payload.document = fileUrl ?? fileId;
          break;
        case ContentTypeEnum.ANIMATION:
          method = 'sendAnimation';
          payload.animation = fileUrl ?? fileId;
          break;
      }

      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/${method}`,
        payload,
      );

      this.logger.log(
        `Message with type ${contentType} sent to ${chatId}: Result ${response.data.ok ? 'OK' : response.data}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send message to ${chatId}:`,
        error.response?.data || error.message,
      );

      if (
        error.response?.data?.error_code === 403 &&
        error.response?.data?.description ===
          'Forbidden: bot was blocked by the user'
      ) {
        await this.redisService
          .getClient()
          .setex(`${botToken}:${chatId}:block`, 300, 'blocked on 5 minutes');
      }

      if (error.status === 429) {
        throw error;
      }
    }
  }
}
