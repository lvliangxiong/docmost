import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { NotificationStatus } from '../types/notification.types';

export class GetNotificationsDto {
  @IsEnum(NotificationStatus)
  @IsOptional()
  status?: NotificationStatus;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  grouped?: boolean = true;

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}
