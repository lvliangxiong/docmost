import { Injectable, Logger } from '@nestjs/common';
import { NotificationAggregationRepo } from '@docmost/db/repos/notification/notification-aggregation.repo';
import { NotificationRepo } from '@docmost/db/repos/notification/notification.repo';
import { Notification, NotificationAggregation } from '@docmost/db/types/entity.types';
import { 
  NotificationType,
  AggregationType,
  AggregatedNotificationMessage,
} from '../types/notification.types';

interface AggregationRule {
  types: NotificationType[];
  timeWindow: number;
  minCount: number;
  aggregationType: 'actor_based' | 'time_based' | 'count_based';
}

@Injectable()
export class NotificationAggregationService {
  private readonly logger = new Logger(NotificationAggregationService.name);

  private readonly aggregationRules: Map<NotificationType, AggregationRule> =
    new Map([
      [
        NotificationType.COMMENT_ON_PAGE,
        {
          types: [NotificationType.COMMENT_ON_PAGE],
          timeWindow: 3600000, // 1 hour
          minCount: 2,
          aggregationType: 'actor_based',
        },
      ],
      [
        NotificationType.MENTION_IN_COMMENT,
        {
          types: [
            NotificationType.MENTION_IN_COMMENT,
            NotificationType.MENTION_IN_PAGE,
          ],
          timeWindow: 1800000, // 30 minutes
          minCount: 3,
          aggregationType: 'count_based',
        },
      ],
      [
        NotificationType.COMMENT_IN_THREAD,
        {
          types: [NotificationType.COMMENT_IN_THREAD],
          timeWindow: 3600000, // 1 hour
          minCount: 2,
          aggregationType: 'actor_based',
        },
      ],
    ]);

  constructor(
    private readonly aggregationRepo: NotificationAggregationRepo,
    private readonly notificationRepo: NotificationRepo,
  ) {}

  async aggregateNotifications(
    recipientId: string,
    type: NotificationType,
    entityId: string,
    timeWindow: number = 3600000, // 1 hour default
  ): Promise<NotificationAggregation | null> {
    const aggregationKey = this.generateAggregationKey(
      recipientId,
      type,
      entityId,
    );

    // Check if there's an existing aggregation within time window
    const existing = await this.aggregationRepo.findByKey(aggregationKey);

    if (existing && this.isWithinTimeWindow(existing.updatedAt, timeWindow)) {
      return existing;
    }

    // Find recent notifications to aggregate
    const recentNotifications = await this.notificationRepo.findRecent({
      recipientId,
      type,
      entityId,
      since: new Date(Date.now() - timeWindow),
    });

    const rule = this.aggregationRules.get(type);
    if (!rule || recentNotifications.length < rule.minCount) {
      return null;
    }

    // Create new aggregation
    return await this.createAggregation(
      aggregationKey,
      recentNotifications,
      type,
    );
  }

  async updateAggregation(
    aggregation: NotificationAggregation,
    notification: Notification,
  ): Promise<void> {
    await this.aggregationRepo.addNotificationToAggregation(
      aggregation.aggregationKey,
      notification.id,
      notification.actorId || undefined,
    );

    this.logger.debug(
      `Updated aggregation ${aggregation.id} with notification ${notification.id}`,
    );
  }

  private async createAggregation(
    key: string,
    notifications: Notification[],
    type: NotificationType,
  ): Promise<NotificationAggregation> {
    const actors = [
      ...new Set(notifications.map((n) => n.actorId).filter(Boolean)),
    ];
    const notificationIds = notifications.map((n) => n.id);

    const summaryData = {
      totalCount: notifications.length,
      actorCount: actors.length,
      firstActorId: actors[0],
      recentActors: actors.slice(0, 3),
      timeSpan: {
        start: notifications[notifications.length - 1].createdAt.toISOString(),
        end: notifications[0].createdAt.toISOString(),
      },
    };

    const aggregation = await this.aggregationRepo.insertAggregation({
      aggregationKey: key,
      recipientId: notifications[0].recipientId,
      aggregationType: this.getAggregationType(type),
      entityType: notifications[0].entityType,
      entityId: notifications[0].entityId,
      actorIds: actors,
      notificationIds: notificationIds,
      summaryData: summaryData,
    });

    this.logger.log(
      `Created aggregation ${aggregation.id} for ${notifications.length} notifications`,
    );

    return aggregation;
  }

  private generateAggregationKey(
    recipientId: string,
    type: NotificationType,
    entityId: string,
  ): string {
    return `${recipientId}:${type}:${entityId}`;
  }

  private isWithinTimeWindow(updatedAt: Date, timeWindow: number): boolean {
    return Date.now() - updatedAt.getTime() < timeWindow;
  }

  private getAggregationType(type: NotificationType): AggregationType {
    switch (type) {
      case NotificationType.COMMENT_ON_PAGE:
      case NotificationType.COMMENT_RESOLVED:
        return AggregationType.COMMENTS_ON_PAGE;

      case NotificationType.MENTION_IN_PAGE:
        return AggregationType.MENTIONS_IN_PAGE;

      case NotificationType.MENTION_IN_COMMENT:
        return AggregationType.MENTIONS_IN_COMMENTS;

      case NotificationType.COMMENT_IN_THREAD:
        return AggregationType.THREAD_ACTIVITY;

      default:
        return AggregationType.COMMENTS_ON_PAGE;
    }
  }

  async createAggregatedNotificationMessage(
    aggregation: NotificationAggregation,
  ): Promise<AggregatedNotificationMessage> {
    // TODO: Load actor information from user service
    // For now, return a simplified version
    const actors = aggregation.actorIds.slice(0, 3).map((id) => ({
      id,
      name: 'User', // TODO: Load actual user name
      avatarUrl: undefined,
    }));

    const primaryActor = actors[0];
    const otherActorsCount = aggregation.actorIds.length - 1;

    let message: string;
    let title: string;

    switch (aggregation.aggregationType) {
      case AggregationType.COMMENTS_ON_PAGE:
        if (otherActorsCount === 0) {
          title = `${primaryActor.name} commented on a page`;
          message = 'View the comment';
        } else if (otherActorsCount === 1) {
          title = `${primaryActor.name} and 1 other commented on a page`;
          message = 'View 2 comments';
        } else {
          title = `${primaryActor.name} and ${otherActorsCount} others commented on a page`;
          message = `View ${aggregation.notificationIds.length} comments`;
        }
        break;

      case AggregationType.MENTIONS_IN_PAGE:
      case AggregationType.MENTIONS_IN_COMMENTS: {
        const totalMentions = aggregation.notificationIds.length;
        if (totalMentions === 1) {
          title = `${primaryActor.name} mentioned you`;
          message = 'View mention';
        } else {
          title = `You were mentioned ${totalMentions} times`;
          message = `By ${primaryActor.name} and ${otherActorsCount} others`;
        }
        break;
      }

      default:
        title = `${aggregation.notificationIds.length} new notifications`;
        message = 'View all';
    }

    return {
      id: aggregation.id,
      title,
      message,
      actors,
      totalCount: aggregation.notificationIds.length,
      entityId: aggregation.entityId,
      entityType: aggregation.entityType,
      createdAt: aggregation.createdAt,
      updatedAt: aggregation.updatedAt,
    };
  }

  async cleanupOldAggregations(olderThan: Date): Promise<number> {
    const deletedCount =
      await this.aggregationRepo.deleteOldAggregations(olderThan);

    if (deletedCount > 0) {
      this.logger.log(`Cleaned up ${deletedCount} old aggregations`);
    }

    return deletedCount;
  }
}