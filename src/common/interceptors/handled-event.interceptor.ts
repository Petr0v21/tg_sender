import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import { Observable, catchError, of, tap, throwError } from 'rxjs';

@Injectable()
export class HandledEventInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HandledEventInterceptor.name);
  private readonly MAX_RETRIES = 5;
  private readonly DELAYED_EXCHANGE = 'delayed_exchange'; // твой exchange для задержек

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToRpc().getContext<RmqContext>();
    const channel = ctx.getChannelRef();
    const message = ctx.getMessage();
    const pattern = ctx.getPattern();

    const messageId = message?.properties?.messageId ?? 'unknown';

    const content = message?.content
      ? JSON.parse(message.content.toString())
      : {};

    const payload = content.data.payload ?? content.data;

    const headers = {
      ...message?.properties?.headers,
      ...(content.data.headers || {}),
    };

    const retryCount = headers['x-retry-count'] ?? 0;
    const originalRoutingKey = headers['x-original-routing-key'];

    this.logger.log(`📨 [${messageId}] Handling event: ${pattern}`);

    return next.handle().pipe(
      tap(() => {
        channel.ack(message);
        this.logger.log(`✅ [${messageId}] Event processed successfully.`);
      }),
      catchError((error) => {
        this.logger.error(
          `❌ [${messageId}] Error processing event: ${pattern} - ${error.message}`,
          error,
        );

        if (retryCount >= this.MAX_RETRIES) {
          this.logger.error(
            `❌ [${messageId}] Maximum retry attempts reached. No further retries will be attempted.`,
          );
          channel.nack(message, false, false);
          return of(null);
        } else {
          const retryDelayMs = Math.pow(2, retryCount) * 1000;

          const newHeaders = {
            ...headers,
            'x-retry-count': retryCount + 1,
            'x-delay': retryDelayMs,
          };

          if (!originalRoutingKey) {
            this.logger.error('❌ No original routing key found in headers!');
            channel.nack(message, false, false);
            return of(null);
          }

          this.logger.warn(
            `⚠️ [${messageId}] Scheduling retry after ${retryDelayMs}ms to routing key: ${originalRoutingKey}`,
          );

          channel.publish(
            this.DELAYED_EXCHANGE,
            originalRoutingKey,
            Buffer.from(
              JSON.stringify({
                pattern: originalRoutingKey,
                data: {
                  payload,
                  headers: newHeaders,
                },
              }),
            ),
            {
              headers: newHeaders,
              persistent: true,
            },
          );

          channel.ack(message);
          return throwError(() => error);
        }
      }),
    );
  }
}
