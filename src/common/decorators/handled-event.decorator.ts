import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { HandledEventInterceptor } from '../interceptors/handled-event.interceptor';

export function HandledEventPattern(pattern: string, dtoClass?: any) {
  return applyDecorators(
    EventPattern(pattern),
    UseInterceptors(new HandledEventInterceptor(dtoClass)),
  );
}
