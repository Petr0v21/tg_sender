import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export async function validateDto<T extends object>(
  dtoClass: new () => T,
  data: unknown,
): Promise<{ isValid: boolean; errors?: any[]; dto?: T }> {
  const dto = plainToInstance(dtoClass, data);
  const errors = await validate(dto);

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, dto };
}
