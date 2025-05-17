import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

//TODO LIST
//1. add isolated redis for this service

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());

  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ extended: true }));

  const rabbitUrl = process.env.RABBITMQ_URL;
  const rabbitQueue = process.env.RABBITMQ_QUEUE;

  if (!rabbitUrl || !rabbitQueue) {
    console.log('Doesn`t exist envs RABBITMQ_URL and/or RABBITMQ_QUEUE');
    process.exit(1);
  }

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitUrl],
      queue: rabbitQueue, //tg_sender_queue
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
  });

  await app.startAllMicroservices();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  console.log(
    `✅ TgSender listening on HTTP port ${port} and RabbitMQ queue 'tg_sender_queue'`,
  );
}
bootstrap();
