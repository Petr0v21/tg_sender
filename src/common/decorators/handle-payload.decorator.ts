import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';

export const HandledPayload = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const rmqContext = ctx.switchToRpc().getContext<RmqContext>();
    const message = rmqContext.getMessage();
    const content = message?.content
      ? JSON.parse(message.content.toString())
      : {};
    return content.data?.payload ?? content.data;
  },
);
