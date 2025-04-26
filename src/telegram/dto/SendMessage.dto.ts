import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export enum ContentTypeEnum {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  FILE = 'FILE',
}

export enum TypeTelegramMessage {
  SINGLE_CHAT = 'SINGLE_CHAT',
  BROADCAST = 'BROADCAST',
  GROUP = 'GROUP',
}

export class SendMessageDto {
  @IsNotEmpty()
  botToken: string;

  @IsNotEmpty()
  chatId: string;

  @IsNotEmpty()
  text: string;

  @IsOptional()
  fileUrl?: string;

  @IsOptional()
  fileId?: string;

  @IsOptional()
  replyMarkup?: any;

  @IsOptional()
  @IsEnum(ContentTypeEnum)
  contentType?: ContentTypeEnum;

  @IsOptional()
  @IsEnum(TypeTelegramMessage)
  type: TypeTelegramMessage;
}

export class SendMessageBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @Type(() => SendMessageDto)
  messages: SendMessageDto[];
}
