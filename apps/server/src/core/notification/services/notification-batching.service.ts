import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationRepo } from '../../../database/repos/notification/notification.repo';
import { NotificationBatchRepo } from '../../../database/repos/notification/notification-batch.repo';
import { NotificationPreferenceService } from './notification-preference.service';
import { Notification } from '@docmost/db/types/entity.types';
import { NotificationType, BatchType } from '../types/notification.types';

interface NotificationGroup {
  type: NotificationType;
  entityId: string;
  entityType: string;
  notifications: Notification[];
  actors: Set<string>;
  summary: string;
}

@Injectable()
export class NotificationBatchingService {
  private readonly logger = new Logger(NotificationBatchingService.name);

  constructor(
    private readonly notificationRepo: NotificationRepo,
    private readonly batchRepo: NotificationBatchRepo,
    private readonly preferenceService: NotificationPreferenceService,
    @InjectQueue('notification-batch') private readonly batchQueue: Queue,
  ) {}

  async addToBatch(notification: Notification): Promise<void> {
    try {
      const preferences = await this.preferenceService.getUserPreferences(
        notification.recipientId,
        notification.workspaceId,
      );

      const batchKey = this.generateBatchKey(notification);
      
      // Find or create batch
      let batch = await this.batchRepo.findByBatchKey(
        batchKey,
        notification.recipientId,
        true, // notSentOnly
      );

      if (!batch) {
        // Create new batch
        const scheduledFor = new Date();
        scheduledFor.setMinutes(scheduledFor.getMinutes() + preferences.batchWindowMinutes);

        batch = await this.batchRepo.insertBatch({
          recipientId: notification.recipientId,
          workspaceId: notification.workspaceId,
          batchType: BatchType.SIMILAR_ACTIVITY,
          batchKey: batchKey,
          notificationCount: 1,
          firstNotificationId: notification.id,
          scheduledFor: scheduledFor,
        });

        // Schedule batch processing
        await this.batchQueue.add(
          'process-batch',
          { batchId: batch.id },
          {
            delay: preferences.batchWindowMinutes * 60 * 1000,
          },
        );
      } else {
        // Add to existing batch
        await this.batchRepo.incrementNotificationCount(batch.id);
      }

      // Update notification with batch ID
      await this.notificationRepo.updateNotification(notification.id, {
        batchId: batch.id,
        isBatched: true,
      });

      this.logger.debug(`Notification ${notification.id} added to batch ${batch.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to batch notification ${notification.id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Fall back to instant delivery on error
      throw error;
    }
  }

  private generateBatchKey(notification: Notification): string {
    switch (notification.type) {
      case NotificationType.COMMENT_ON_PAGE:
      case NotificationType.COMMENT_RESOLVED: {
        const context = notification.context as any;
        return `page:${context?.pageId}:comments`;
      }

      case NotificationType.MENTION_IN_PAGE:
        return `page:${notification.entityId}:mentions`;

      case NotificationType.COMMENT_IN_THREAD: {
        const mentionContext = notification.context as any;
        return `thread:${mentionContext?.threadRootId}`;
      }

      default:
        return `${notification.entityType}:${notification.entityId}:${notification.type}`;
    }
  }

  async processBatch(batchId: string): Promise<void> {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch || batch.sentAt) {
      this.logger.debug(`Batch ${batchId} not found or already sent`);
      return;
    }

    const notifications = await this.notificationRepo.findByBatchId(batchId);

    if (notifications.length === 0) {
      this.logger.debug(`No notifications found for batch ${batchId}`);
      return;
    }

    // Group notifications by type for smart formatting
    const grouped = this.groupNotificationsByType(notifications);

    // Send batch email
    await this.sendBatchEmail(batch.recipientId, batch.workspaceId, grouped);

    // Mark batch as sent
    await this.batchRepo.markAsSent(batchId);

    // Update email sent timestamp for all notifications
    const notificationIds = notifications.map(n => n.id);
    await Promise.all(
      notificationIds.map(id =>
        this.notificationRepo.updateNotification(id, { emailSentAt: new Date() })
      ),
    );

    this.logger.log(`Batch ${batchId} processed with ${notifications.length} notifications`);
  }

  private groupNotificationsByType(notifications: Notification[]): NotificationGroup[] {
    const groups = new Map<string, NotificationGroup>();

    for (const notification of notifications) {
      const key = `${notification.type}:${notification.entityId}`;

      if (!groups.has(key)) {
        groups.set(key, {
          type: notification.type as NotificationType,
          entityId: notification.entityId,
          entityType: notification.entityType,
          notifications: [],
          actors: new Set(),
          summary: '',
        });
      }

      const group = groups.get(key)!;
      group.notifications.push(notification);
      if (notification.actorId) {
        group.actors.add(notification.actorId);
      }
    }

    // Generate summaries for each group
    for (const group of groups.values()) {
      group.summary = this.generateSummary(group.type, group.notifications);
    }

    return Array.from(groups.values());
  }

  private generateSummary(type: NotificationType, notifications: Notification[]): string {
    const count = notifications.length;
    const actors = new Set(notifications.map(n => n.actorId).filter(Boolean));

    switch (type) {
      case NotificationType.COMMENT_ON_PAGE:
        if (count === 1) return 'commented on a page you follow';
        return `and ${actors.size - 1} others commented on a page you follow`;

      case NotificationType.MENTION_IN_COMMENT:
        if (count === 1) return 'mentioned you in a comment';
        return `mentioned you ${count} times in comments`;

      case NotificationType.COMMENT_RESOLVED:
        if (count === 1) return 'resolved a comment';
        return `resolved ${count} comments`;

      default:
        return `${count} new activities`;
    }
  }

  private async sendBatchEmail(
    recipientId: string,
    workspaceId: string,
    groups: NotificationGroup[],
  ): Promise<void> {
    // TODO: Implement email sending with batch template
    // This will be implemented when we create email templates
    this.logger.log(
      `Sending batch email to ${recipientId} with ${groups.length} notification groups`,
    );
  }

  async getPendingBatches(): Promise<any[]> {
    return await this.batchRepo.getPendingBatches();
  }
}