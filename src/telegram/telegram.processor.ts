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
  | 'sendVideoNote'
  | 'sendAudio'
  | 'sendVoice'
  | 'sendDocument'
  | 'sendAnimation'
  | 'sendSticker';

export type RequestPayload = {
  chat_id: number | string;
  text?: string;
  caption?: string;
  reply_markup?: any;
  parse_mode?: string;
  document?: string;
  audio?: string;
  voice?: string;
  photo?: string;
  video?: string;
  video_note?: string;
  animation?: string;
  sticker?: string;
};

@Processor('telegram-queue')
export class TelegramProcessor {
  private logger: Logger = new Logger(TelegramProcessor.name);
  ignoredTextAtMethods = [
    ContentTypeEnum.STICKER,
    ContentTypeEnum.VIDEO_NOTE,
    ContentTypeEnum.VOICE,
  ];

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
    const blockKey = `${botToken}:${chatId}:429`;

    try {
      const isBlockedBy429 = await this.redisService.getClient().get(blockKey);

      if (isBlockedBy429) {
        await new Promise((resolve) =>
          setTimeout(resolve, Number(isBlockedBy429)),
        );
      }

      const payload: RequestPayload = {
        chat_id: chatId,
        reply_markup: replyMarkup,
        parse_mode: 'HTML',
      };

      if (!this.ignoredTextAtMethods.includes(contentType)) {
        payload[
          contentType && contentType !== ContentTypeEnum.TEXT
            ? 'caption'
            : 'text'
        ] = text;
      }

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
        case ContentTypeEnum.VIDEO:
          method = 'sendVideo';
          payload.video = fileUrl ?? fileId;
          break;
        case ContentTypeEnum.VIDEO_NOTE:
          method = 'sendVideoNote';
          payload.video_note = fileUrl ?? fileId;
          break;
        case ContentTypeEnum.AUDIO:
          method = 'sendAudio';
          payload.audio = fileUrl ?? fileId;
          break;
        case ContentTypeEnum.VOICE:
          method = 'sendVoice';
          payload.voice = fileUrl ?? fileId;
          break;
        case ContentTypeEnum.FILE:
          method = 'sendDocument';
          payload.document = fileUrl ?? fileId;
          break;
        case ContentTypeEnum.ANIMATION:
          method = 'sendAnimation';
          payload.animation = fileUrl ?? fileId;
          break;
        case ContentTypeEnum.STICKER:
          method = 'sendSticker';
          payload.sticker = fileUrl ?? fileId;
          break;
      }

      console.log(`https://api.telegram.org/bot${botToken}/${method}`, payload);

      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/${method}`,
        payload,
      );

      this.logger.log(
        `Message with type ${contentType} sent to ${chatId}: Result ${response.data.ok ? 'OK' : response.data}`,
      );

      if (
        this.ignoredTextAtMethods.includes(contentType) &&
        text &&
        response.status >= 200 &&
        response.status < 300
      ) {
        try {
          await axios.post(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              chat_id: chatId,
              text,
              reply_to_message_id: response.data?.result?.message_id,
              parse_mode: 'HTML',
              reply_markup: replyMarkup,
            },
          );
          this.logger.log(
            `Message Reply on Media to ${chatId} with Result ${response.data.ok ? 'OK' : response.data}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send reply message on media to ${chatId}:`,
            error.response?.data || error.message,
          );
        }
      }
    } catch (error) {
      console.error(error);

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
        const retryAfter = error.response.data.parameters?.retry_after || 5;
        const delay = retryAfter * 1000;
        await this.redisService.getClient().setex(blockKey, retryAfter, delay);

        this.logger.warn(
          `429 for chat ${chatId}, delaying next messages for ${retryAfter}s`,
        );
        throw error;
      }
    }
  }
}
