import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramModule } from './telegram/telegram.module';
import { HandledEventInterceptor } from './common/interceptors/handled-event.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
        password: configService.get<string>('REDIS_PASSWORD'),
        db: configService.get<number>('REDIS_DB') ?? 0,
      }),
      inject: [ConfigService],
    }),
    TelegramModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: HandledEventInterceptor,
      useClass: HandledEventInterceptor,
    },
  ],
})
export class AppModule {}
