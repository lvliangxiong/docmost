import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  NotificationType,
  NotificationPriority,
} from '../types/notification.types';

export class CreateNotificationDto {
  @IsUUID()
  @IsNotEmpty()
  workspaceId: string;

  @IsUUID()
  @IsNotEmpty()
  recipientId: string;

  @IsUUID()
  @IsOptional()
  actorId?: string;

  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  entityType: string;

  @IsUUID()
  @IsNotEmpty()
  entityId: string;

  @IsObject()
  @IsNotEmpty()
  context: Record<string, any>;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @IsString()
  @IsOptional()
  groupKey?: string;

  @IsString()
  @IsOptional()
  deduplicationKey?: string;

  // For scheduling notifications (quiet hours, etc.)
  @IsOptional()
  scheduledFor?: Date;
}
