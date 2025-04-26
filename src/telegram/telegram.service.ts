import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisService } from 'src/redis/redis.service';
import {
  ContentTypeEnum,
  SendMessageDto,
  TypeTelegramMessage,
} from './dto/SendMessage.dto';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

@Injectable()
export class TelegramService {
  constructor(
    @InjectQueue('telegram-queue') private mailingQueue: Queue,
    private readonly redisService: RedisService,
  ) {}

  private getCacheKey(
    type: TypeTelegramMessage,
    botToken: string,
    chatId: string,
  ) {
    let lastPart = '';
    switch (type) {
      case TypeTelegramMessage.BROADCAST:
        lastPart = `lastBroadcastMessageTime`;
        break;
      case TypeTelegramMessage.GROUP:
        lastPart = `lastGroupMessageTime:${chatId}`;
        break;
      default:
        lastPart = `lastChatMessageTime:${chatId}`;
    }
    return `${botToken}:${lastPart}`;
  }

  private async calculateDelay(
    type: TypeTelegramMessage,
    cacheKey: string,
  ): Promise<number> {
    const now = Date.now();
    const lastMessageTime = await this.redisService.getClient().get(cacheKey);

    const diff = now - (lastMessageTime ? parseInt(lastMessageTime) : 0);
    let delay = 0;
    switch (type) {
      case TypeTelegramMessage.BROADCAST:
        delay = Math.max(0, 1000 / 30 - diff);
        break;
      case TypeTelegramMessage.GROUP:
        delay = Math.max(0, 1000 / 20 - diff);
        break;
      default:
        delay = Math.max(0, 1000 - diff);
    }
    await this.redisService.getClient().set(cacheKey, now + delay);
    return delay;
  }

  async addToQueue({
    chatId,
    botToken,
    fileUrl,
    type,
    contentType,
    ...args
  }: SendMessageDto) {
    const rudeContentType =
      !contentType && fileUrl ? await this.getTypeFromUrl(fileUrl) : null;
    const delay = await this.calculateDelay(
      type,
      this.getCacheKey(type, botToken, chatId),
    );

    await this.mailingQueue.add(
      'send-telegram-message',
      {
        chatId,
        fileUrl,
        botToken,
        ...args,
        contentType: contentType ?? rudeContentType,
      },
      { delay, attempts: 3, backoff: 5000 },
    );
  }

  async getTypeFromUrl(url: string): Promise<ContentTypeEnum> {
    try {
      const cacheValue = await this.redisService.getClient().get(url);
      if (cacheValue) {
        return cacheValue as ContentTypeEnum;
      }
      const type = await this.getFileContentType(url);
      await this.redisService.getClient().setex(url, 600, type);
      return type;
    } catch (err) {
      console.error('Get Type From URL Error', err.message);
    }
  }

  async getFileContentType(url: string): Promise<ContentTypeEnum | null> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      protocol
        .get(url, (response) => {
          const contentType = response.headers['content-type'];
          if (!contentType) {
            resolve(null);
          } else {
            const mimeType = contentType.split(';')[0];
            resolve(this.getContentTypeFromMimeType(mimeType));
          }
          response.resume();
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  getContentTypeFromMimeType(mimeType: string): ContentTypeEnum {
    switch (true) {
      case mimeType.startsWith('image/'):
        return ContentTypeEnum.PHOTO;
      case mimeType.startsWith('video/'):
        return ContentTypeEnum.VIDEO;
      case mimeType.startsWith('audio/'):
        return ContentTypeEnum.AUDIO;
      default:
        return ContentTypeEnum.FILE;
    }
  }
}
