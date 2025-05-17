import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediaService } from './media.service';
import { createHash } from 'crypto';
import { access, writeFile } from 'fs/promises';
import { resolve, join, extname } from 'path';
import { ConfigService } from '@nestjs/config';

@Controller('api/media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async handleFileUpload(@UploadedFile() file: Express.Multer.File) {
    const uploadsDir = resolve(
      __dirname,
      this.configService.get('MEDIA_FOLDER') ?? '../../../updates',
    );

    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const ext = extname(file.originalname);
    const filename = `${hash}${ext}`;
    const filepath = join(uploadsDir, filename);

    let isExist = await access(filepath)
      .then((_value) => true)
      .catch((_err) => false);

    if (isExist) {
      return {
        fileUrl: `${this.configService.get('MEDIA_HOST')}/${filename}`,
        filename,
        path: filepath,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      };
    }

    await writeFile(filepath, file.buffer);

    await this.mediaService.lockFile(filename);

    return {
      fileUrl: `${this.configService.get('MEDIA_HOST')}/${filename}`,
      filename,
      path: filepath,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}
