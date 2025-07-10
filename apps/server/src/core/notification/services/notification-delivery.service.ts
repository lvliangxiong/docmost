import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueName } from '../../../integrations/queue/constants';
import { WsGateway } from '../../../ws/ws.gateway';
import { NotificationBatchingService } from './notification-batching.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationRepo } from '@docmost/db/repos/notification/notification.repo';
import { Notification } from '@docmost/db/types/entity.types';
import {
  NotificationCreatedEvent,
  NotificationReadEvent,
  NotificationAllReadEvent,
  NOTIFICATION_EVENTS,
} from '../events/notification.events';
import { NotificationType, NotificationPriority } from '../types/notification.types';

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    @InjectQueue(QueueName.EMAIL_QUEUE) private readonly mailQueue: Queue,
    private readonly wsGateway: WsGateway,
    private readonly batchingService: NotificationBatchingService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly notificationRepo: NotificationRepo,
  ) {}

  @OnEvent(NOTIFICATION_EVENTS.CREATED)
  async handleNotificationCreated(event: NotificationCreatedEvent) {
    const { notification, workspaceId } = event;

    try {
      const decision = await this.preferenceService.makeNotificationDecision(
        notification.recipientId,
        workspaceId,
        notification.type as NotificationType,
        notification.priority as NotificationPriority,
      );

      // In-app delivery (always immediate)
      if (decision.channels.includes('in_app')) {
        await this.deliverInApp(notification, workspaceId);
      }

      // Email delivery (may be batched)
      if (decision.channels.includes('email')) {
        if (decision.batchingEnabled) {
          await this.batchingService.addToBatch(notification);
        } else {
          await this.deliverEmailInstant(notification);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to deliver notification ${notification.id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async deliverInApp(notification: Notification, workspaceId: string) {
    try {
      // Send notification via WebSocket to user's workspace room
      const notificationData = {
        id: notification.id,
        type: notification.type,
        status: notification.status,
        priority: notification.priority,
        actorId: notification.actorId,
        entityType: notification.entityType,
        entityId: notification.entityId,
        context: notification.context,
        createdAt: notification.createdAt,
      };

      // Emit to user-specific room
      this.wsGateway.emitToUser(
        notification.recipientId,
        'notification:new',
        notificationData,
      );

      // Update unread count
      const unreadCount = await this.notificationRepo.getUnreadCount(
        notification.recipientId,
      );
      this.wsGateway.emitToUser(
        notification.recipientId,
        'notification:unreadCount',
        { count: unreadCount },
      );

      // Update delivery status
      await this.notificationRepo.updateNotification(notification.id, {
        inAppDeliveredAt: new Date(),
      });

      this.logger.debug(`In-app notification delivered: ${notification.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to deliver in-app notification ${notification.id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async deliverEmailInstant(notification: Notification) {
    try {
      await this.mailQueue.add(
        'send-notification-email',
        {
          notificationId: notification.id,
          type: notification.type,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.debug(`Email notification queued: ${notification.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to queue email notification ${notification.id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.READ)
  async handleNotificationRead(event: NotificationReadEvent) {
    const { notificationId, userId } = event;

    // Send real-time update to user
    this.wsGateway.emitToUser(userId, 'notification:read', {
      notificationId,
    });

    // Update unread count
    const unreadCount = await this.notificationRepo.getUnreadCount(userId);
    this.wsGateway.emitToUser(userId, 'notification:unreadCount', {
      count: unreadCount,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.ALL_READ)
  async handleAllNotificationsRead(event: NotificationAllReadEvent) {
    const { userId, notificationIds } = event;

    // Send real-time update to user
    this.wsGateway.emitToUser(userId, 'notification:allRead', {
      notificationIds,
    });

    // Update unread count (should be 0)
    this.wsGateway.emitToUser(userId, 'notification:unreadCount', { count: 0 });
  }

  /**
   * Process email delivery for a notification
   * Called by the mail queue processor
   */
  async processEmailNotification(notificationId: string) {
    const notification = await this.notificationRepo.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    // Check if already sent
    if (notification.emailSentAt) {
      this.logger.debug(
        `Notification already sent via email: ${notificationId}`,
      );
      return;
    }

    // TODO: Load user and workspace data
    // TODO: Render appropriate email template based on notification type
    // TODO: Send email using mail service

    // For now, just mark as sent
    await this.notificationRepo.updateNotification(notificationId, {
      emailSentAt: new Date(),
    });

    this.logger.log(`Email notification sent: ${notificationId}`);
  }
}