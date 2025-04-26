import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { HandledEventInterceptor } from '../interceptors/handled-event.interceptor';

export function HandledEventPattern(pattern: string) {
  return applyDecorators(
    EventPattern(pattern),
    UseInterceptors(HandledEventInterceptor),
  );
}
