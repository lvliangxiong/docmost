import { Notification } from '@docmost/db/types/entity.types';

export class NotificationCreatedEvent {
  constructor(
    public readonly notification: Notification,
    public readonly workspaceId: string,
  ) {}
}

export class NotificationReadEvent {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
  ) {}
}

export class NotificationAllReadEvent {
  constructor(
    public readonly userId: string,
    public readonly notificationIds: string[],
  ) {}
}

export class NotificationBatchScheduledEvent {
  constructor(
    public readonly batchId: string,
    public readonly scheduledFor: Date,
  ) {}
}

export class NotificationAggregatedEvent {
  constructor(
    public readonly aggregationId: string,
    public readonly notificationIds: string[],
  ) {}
}

// Event names as constants
export const NOTIFICATION_EVENTS = {
  CREATED: 'notification.created',
  READ: 'notification.read',
  ALL_READ: 'notification.allRead',
  BATCH_SCHEDULED: 'notification.batchScheduled',
  AGGREGATED: 'notification.aggregated',
} as const;
