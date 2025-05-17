import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TelegramService } from './telegram.service';
import { TelegramProcessor } from './telegram.processor';
import { TelegramController } from './telegram.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TelegramRateLimitService } from './telegram-rate-limit.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'telegram-queue',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    }),
    ClientsModule.registerAsync([
      {
        name: 'TG_SENDER_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: configService.get<string>('RABBITMQ_QUEUE'),
            noAck: false,
            queueOptions: {
              durable: true,
              arguments: {
                'x-message-ttl': 60000,
                'x-dead-letter-exchange': 'dlx_exchange',
                'x-dead-letter-routing-key': 'dlx_routing_key',
              },
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramRateLimitService, TelegramProcessor],
})
export class TelegramModule {}
