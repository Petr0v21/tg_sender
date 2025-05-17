import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { RedisService } from 'src/redis/redis.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MediaService implements OnModuleInit {
  private logger: Logger = new Logger(MediaService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    console.log(resolve(__dirname, this.configService.get('MEDIA_FOLDER')));
  }

  async onModuleInit() {
    const mediaDir = resolve(__dirname, this.configService.get('MEDIA_FOLDER'));
    try {
      await fs.mkdir(mediaDir, { recursive: true });
      this.logger.log(`[INIT] Media folder ensured at: ${mediaDir}`);
    } catch (err) {
      this.logger.error(`[INIT] Failed to create media folder: ${err}`);
    }
  }

  public getLockFileKey(fileName: string) {
    return `media_lock:${fileName}`;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCleanup() {
    try {
      const mediaDir = resolve(
        __dirname,
        this.configService.get('MEDIA_FOLDER'),
      );

      const files = await fs.readdir(mediaDir);

      for (const filename of files) {
        const filePath = join(mediaDir, filename);

        const isUsed = await this.redisService
          .getClient()
          .get(this.getLockFileKey(filename));

        if (!isUsed) {
          fs.unlink(filePath);
          this.logger.log(`[CLEANER] Deleted unused file: ${filename}`);
        }
      }
    } catch (err) {
      this.logger.error(`Error cron job cleanup: ${err}`);
    }
  }

  public async lockFile(fileName: string) {
    return this.redisService
      .getClient()
      .setex(this.getLockFileKey(fileName), 60 * 60, Date.now());
  }
}
