import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
  IsArray,
} from 'class-validator';
import {
  EmailFrequency,
  NotificationTypeSettings,
} from '../types/notification.types';

export class UpdateNotificationPreferencesDto {
  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  inAppEnabled?: boolean;

  @IsObject()
  @IsOptional()
  notificationSettings?: Record<string, NotificationTypeSettings>;

  @IsNumber()
  @Min(5)
  @Max(60)
  @IsOptional()
  batchWindowMinutes?: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxBatchSize?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  batchTypes?: string[];

  @IsEnum(EmailFrequency)
  @IsOptional()
  emailFrequency?: EmailFrequency;

  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
  @IsOptional()
  digestTime?: string;

  @IsBoolean()
  @IsOptional()
  quietHoursEnabled?: boolean;

  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
  @IsOptional()
  quietHoursStart?: string;

  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
  @IsOptional()
  quietHoursEnd?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsBoolean()
  @IsOptional()
  weekendNotifications?: boolean;
}
