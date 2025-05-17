import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { TypeTelegramMessage } from './dto/SendMessage.dto';

@Injectable()
export class TelegramRateLimitService {
  constructor(private readonly redisService: RedisService) {}

  async calculateDelay(
    type: TypeTelegramMessage,
    botToken: string,
    chatId: string,
    hasMedia: boolean = false,
  ): Promise<number> {
    const redis = this.redisService.getClient();
    const now = Date.now();
    const delays: number[] = [];

    const globalKey = `${botToken}:lastGlobalMessageTime`;
    const lastGlobal = await redis.get(globalKey);
    const diffGlobal = now - (lastGlobal ? parseInt(lastGlobal) : 0);
    const globalDelay = Math.max(0, 33 - diffGlobal);
    delays.push(globalDelay);

    let typeKey = '';
    let minInterval = 1000;

    switch (type) {
      case TypeTelegramMessage.GROUP:
        typeKey = `${botToken}:lastGroupMessageTime:${chatId}`;
        minInterval = 3000;
        break;
      case TypeTelegramMessage.SINGLE_CHAT:
      default:
        typeKey = `${botToken}:lastChatMessageTime:${chatId}`;
        minInterval = 1000;
        break;
    }

    const lastType = await redis.get(typeKey);
    const diffType = now - (lastType ? parseInt(lastType) : 0);
    const typeDelay = Math.max(0, minInterval - diffType);
    delays.push(typeDelay);

    if (hasMedia) {
      const mediaKey = `${botToken}:lastMediaMessageTime`;
      const lastMedia = await redis.get(mediaKey);
      const diffMedia = now - (lastMedia ? parseInt(lastMedia) : 0);
      const mediaDelay = Math.max(0, 5000 - diffMedia);
      delays.push(mediaDelay);
      await redis.set(mediaKey, now + mediaDelay);
    }

    const burstKey = `${botToken}:burst:${Math.floor(now / 1000)}`;
    const currentBurst = await redis.incr(burstKey);
    await redis.expire(burstKey, 5);

    let dynamicDelay = 0;
    if (currentBurst > 15) {
      dynamicDelay = Math.pow(2, currentBurst - 15) * 10;
    }
    delays.push(dynamicDelay);

    const finalDelay = Math.max(...delays);

    const nextSendTime = now + finalDelay;
    await redis.set(globalKey, nextSendTime);
    await redis.set(typeKey, nextSendTime);

    return finalDelay;
  }
}
