import { Injectable } from '@nestjs/common';
import { NotificationType } from '../types/notification.types';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { createHash } from 'crypto';

@Injectable()
export class NotificationDeduplicationService {
  /**
   * Generate a unique deduplication key based on notification type and context
   */
  generateDeduplicationKey(params: CreateNotificationDto): string | null {
    switch (params.type) {
      case NotificationType.MENTION_IN_PAGE:
        // Only one notification per mention in a page (until page is updated again)
        return this.hash([
          'mention',
          'page',
          params.entityId,
          params.actorId,
          params.recipientId,
        ]);

      case NotificationType.MENTION_IN_COMMENT:
        // One notification per comment mention
        return this.hash([
          'mention',
          'comment',
          params.entityId,
          params.actorId,
          params.recipientId,
        ]);

      case NotificationType.COMMENT_ON_PAGE:
        // Allow multiple notifications for different comments on the same page
        return null; // No deduplication, rely on batching instead

      case NotificationType.REPLY_TO_COMMENT:
        // One notification per reply
        return this.hash([
          'reply',
          params.entityId,
          params.actorId,
          params.recipientId,
        ]);

      case NotificationType.COMMENT_RESOLVED:
        // One notification per comment resolution
        return this.hash([
          'resolved',
          params.context.commentId,
          params.actorId,
          params.recipientId,
        ]);

      case NotificationType.EXPORT_COMPLETED:
      case NotificationType.EXPORT_FAILED:
        // One notification per export job
        return this.hash([
          'export',
          params.context.jobId || params.entityId,
          params.recipientId,
        ]);

      case NotificationType.PAGE_SHARED:
        // One notification per page share action
        return this.hash([
          'share',
          params.entityId,
          params.actorId,
          params.recipientId,
          Date.now().toString(), // Include timestamp to allow re-sharing
        ]);

      default:
        // For other types, generate a key based on common fields
        return this.hash([
          params.type,
          params.entityId,
          params.actorId,
          params.recipientId,
        ]);
    }
  }

  /**
   * Check if a notification should be deduplicated based on recent activity
   */
  shouldDeduplicate(type: NotificationType): boolean {
    const deduplicatedTypes = [
      NotificationType.MENTION_IN_PAGE,
      NotificationType.MENTION_IN_COMMENT,
      NotificationType.REPLY_TO_COMMENT,
      NotificationType.COMMENT_RESOLVED,
      NotificationType.EXPORT_COMPLETED,
      NotificationType.EXPORT_FAILED,
    ];

    return deduplicatedTypes.includes(type);
  }

  /**
   * Get the time window for deduplication (in milliseconds)
   */
  getDeduplicationWindow(type: NotificationType): number {
    switch (type) {
      case NotificationType.MENTION_IN_PAGE:
        return 24 * 60 * 60 * 1000; // 24 hours

      case NotificationType.MENTION_IN_COMMENT:
        return 60 * 60 * 1000; // 1 hour

      case NotificationType.EXPORT_COMPLETED:
      case NotificationType.EXPORT_FAILED:
        return 5 * 60 * 1000; // 5 minutes

      default:
        return 30 * 60 * 1000; // 30 minutes default
    }
  }

  /**
   * Create a hash from array of values
   */
  private hash(values: (string | null | undefined)[]): string {
    const filtered = values.filter((v) => v !== null && v !== undefined);
    const input = filtered.join(':');
    return createHash('sha256').update(input).digest('hex').substring(0, 32);
  }

  /**
   * Generate a key for custom deduplication scenarios
   */
  generateCustomKey(
    type: string,
    entityId: string,
    recipientId: string,
    additionalData?: Record<string, any>,
  ): string {
    const baseValues = [type, entityId, recipientId];

    if (additionalData) {
      // Sort keys for consistent hashing
      const sortedKeys = Object.keys(additionalData).sort();
      for (const key of sortedKeys) {
        baseValues.push(`${key}:${additionalData[key]}`);
      }
    }

    return this.hash(baseValues);
  }
}
