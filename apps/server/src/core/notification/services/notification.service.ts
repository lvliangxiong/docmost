import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationRepo } from '@docmost/db/repos/notification/notification.repo';
import { NotificationDeduplicationService } from './notification-deduplication.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { Notification } from '@docmost/db/types/entity.types';
import {
  NotificationStatus,
  NotificationPriority,
  NotificationType,
} from '../types/notification.types';
import {
  NotificationCreatedEvent,
  NotificationReadEvent,
  NotificationAllReadEvent,
  NOTIFICATION_EVENTS,
} from '../events/notification.events';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepo: NotificationRepo,
    private readonly eventEmitter: EventEmitter2,
    private readonly deduplicationService: NotificationDeduplicationService,
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  async createNotification(
    dto: CreateNotificationDto,
  ): Promise<Notification | null> {
    try {
      // Set default priority if not provided
      const priority = dto.priority || NotificationPriority.NORMAL;

      // Check user preferences first
      const decision = await this.preferenceService.makeNotificationDecision(
        dto.recipientId,
        dto.workspaceId,
        dto.type,
        priority,
      );

      if (!decision.shouldNotify) {
        this.logger.debug(
          `Notification blocked by user preferences: ${dto.type} for ${dto.recipientId}`,
        );
        return null;
      }

      // Generate deduplication key
      let deduplicationKey = dto.deduplicationKey;
      if (
        !deduplicationKey &&
        this.deduplicationService.shouldDeduplicate(dto.type)
      ) {
        deduplicationKey =
          this.deduplicationService.generateDeduplicationKey(dto);
      }

      // Check if duplicate
      if (
        deduplicationKey &&
        (await this.notificationRepo.existsByDeduplicationKey(deduplicationKey))
      ) {
        this.logger.debug(
          `Duplicate notification prevented: ${deduplicationKey}`,
        );
        return null;
      }

      // Generate group key if not provided
      const groupKey = dto.groupKey || this.generateGroupKey(dto);

      // Calculate expiration
      const expiresAt = this.calculateExpiration(dto.type);

      // Create notification
      const notification = await this.notificationRepo.insertNotification({
        workspaceId: dto.workspaceId,
        recipientId: dto.recipientId,
        actorId: dto.actorId || null,
        type: dto.type,
        status: NotificationStatus.UNREAD,
        priority,
        entityType: dto.entityType,
        entityId: dto.entityId,
        context: dto.context,
        groupKey: groupKey,
        groupCount: 1,
        deduplicationKey: deduplicationKey,
        batchId: null,
        isBatched: false,
        emailSentAt: null,
        inAppDeliveredAt: null,
        readAt: null,
        expiresAt: expiresAt,
      });

      // Emit event for delivery processing
      this.eventEmitter.emit(
        NOTIFICATION_EVENTS.CREATED,
        new NotificationCreatedEvent(notification, dto.workspaceId),
      );

      this.logger.debug(
        `Notification created: ${notification.id} for user ${dto.recipientId}`,
      );

      return notification;
    } catch (error) {
      this.logger.error(
        `Failed to create notification: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getNotifications(
    userId: string,
    workspaceId: string,
    options: {
      status?: NotificationStatus;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<Notification[]> {
    return await this.notificationRepo.findByRecipient(userId, options);
  }

  async getGroupedNotifications(
    userId: string,
    workspaceId: string,
    options: {
      status?: NotificationStatus;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{
    notifications: Notification[];
    groups: Map<string, Notification[]>;
  }> {
    const notifications = await this.getNotifications(
      userId,
      workspaceId,
      options,
    );

    // Group notifications by group_key
    const groups = new Map<string, Notification[]>();

    for (const notification of notifications) {
      if (notification.groupKey) {
        const group = groups.get(notification.groupKey) || [];
        group.push(notification);
        groups.set(notification.groupKey, group);
      }
    }

    return { notifications, groups };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepo.findById(notificationId);

    if (!notification || notification.recipientId !== userId) {
      throw new Error('Notification not found or unauthorized');
    }

    if (notification.status === NotificationStatus.READ) {
      return; // Already read
    }

    await this.notificationRepo.markAsRead(notificationId);

    // Emit event for real-time update
    this.eventEmitter.emit(
      NOTIFICATION_EVENTS.READ,
      new NotificationReadEvent(notificationId, userId),
    );

    this.logger.debug(`Notification marked as read: ${notificationId}`);
  }

  async markAllAsRead(userId: string): Promise<void> {
    const unreadNotifications = await this.notificationRepo.findByRecipient(
      userId,
      {
        status: NotificationStatus.UNREAD,
      },
    );

    const ids = unreadNotifications.map((n) => n.id);

    if (ids.length > 0) {
      await this.notificationRepo.markManyAsRead(ids);

      // Emit event for real-time update
      this.eventEmitter.emit(
        NOTIFICATION_EVENTS.ALL_READ,
        new NotificationAllReadEvent(userId, ids),
      );

      this.logger.debug(
        `Marked ${ids.length} notifications as read for user ${userId}`,
      );
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepo.getUnreadCount(userId);
  }

  async deleteExpiredNotifications(): Promise<number> {
    const deletedCount = await this.notificationRepo.deleteExpired();

    if (deletedCount > 0) {
      this.logger.log(`Deleted ${deletedCount} expired notifications`);
    }

    return deletedCount;
  }

  private generateGroupKey(dto: CreateNotificationDto): string {
    // Generate a group key based on notification type and entity
    return `${dto.type}:${dto.entityType}:${dto.entityId}`;
  }

  private calculateExpiration(type: string): Date | null {
    // Set expiration based on notification type
    const expirationDays = {
      [NotificationType.EXPORT_COMPLETED]: 7, // Expire after 7 days
      [NotificationType.EXPORT_FAILED]: 3, // Expire after 3 days
      [NotificationType.MENTION_IN_PAGE]: 30, // Expire after 30 days
      [NotificationType.MENTION_IN_COMMENT]: 30,
      [NotificationType.COMMENT_ON_PAGE]: 60, // Expire after 60 days
      [NotificationType.REPLY_TO_COMMENT]: 60,
      [NotificationType.COMMENT_IN_THREAD]: 60,
      [NotificationType.COMMENT_RESOLVED]: 90, // Expire after 90 days
      [NotificationType.PAGE_SHARED]: 90,
    };

    const days = expirationDays[type as NotificationType];
    if (!days) {
      return null; // No expiration
    }

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);
    return expirationDate;
  }

  async createTestNotification(
    userId: string,
    workspaceId: string,
    type: NotificationType,
  ): Promise<Notification | null> {
    return await this.createNotification({
      workspaceId,
      recipientId: userId,
      actorId: userId,
      type,
      entityType: 'test',
      entityId: 'test-notification',
      context: {
        message: 'This is a test notification',
        timestamp: new Date(),
      },
      priority: NotificationPriority.NORMAL,
    });
  }
}
