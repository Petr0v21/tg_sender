import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisService } from 'src/redis/redis.service';
import { ContentTypeEnum, SendMessageDto } from './dto/SendMessage.dto';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { TelegramRateLimitService } from './telegram-rate-limit.service';

@Injectable()
export class TelegramService {
  constructor(
    @InjectQueue('telegram-queue') private mailingQueue: Queue,
    private readonly redisService: RedisService,
    private readonly telegramRateLimitService: TelegramRateLimitService,
  ) {}

  async addToQueue({
    chatId,
    botToken,
    fileUrl,
    type,
    contentType,
    fileId,
    ...args
  }: SendMessageDto) {
    const isBlocked = await this.redisService
      .getClient()
      .get(`${botToken}:${chatId}:block`);

    if (isBlocked) {
      return;
    }

    const rudeContentType =
      !contentType && fileUrl
        ? await this.getTypeFromUrl(fileUrl)
        : ContentTypeEnum.TEXT;

    const delay = await this.telegramRateLimitService.calculateDelay(
      type,
      botToken,
      chatId,
      !!(fileUrl ?? fileId),
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
    if (!mimeType) return ContentTypeEnum.FILE;

    switch (true) {
      case mimeType === 'image/gif':
        return ContentTypeEnum.ANIMATION;
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
