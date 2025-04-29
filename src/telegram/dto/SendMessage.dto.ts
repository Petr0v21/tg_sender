import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export enum ContentTypeEnum {
  TEXT = 'TEXT',
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  FILE = 'FILE',
  ANIMATION = 'ANIMATION',
}

export enum TypeTelegramMessage {
  SINGLE_CHAT = 'SINGLE_CHAT',
  BROADCAST = 'BROADCAST',
  GROUP = 'GROUP',
}

@ValidatorConstraint({ name: 'FilePresence', async: false })
class FilePresenceConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const dto = args.object as SendMessageDto;
    if (dto.contentType && dto.contentType !== ContentTypeEnum.TEXT) {
      return !!dto.fileUrl || !!dto.fileId;
    }
    return !!dto.text;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Field text must be filled if contentType not exist or equal TEXT. In other cases must be fileId or fileUrl';
  }
}

export class SendMessageDto {
  @IsNotEmpty()
  botToken: string;

  @IsNotEmpty()
  chatId: string;

  @IsOptional()
  text?: string;

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

  @Validate(FilePresenceConstraint)
  filePresenceCheck: boolean;
}

export class SendMessageBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @Type(() => SendMessageDto)
  messages: SendMessageDto[];
}
