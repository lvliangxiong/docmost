import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import { 
  NotificationPreference, 
  InsertableNotificationPreference, 
  UpdatableNotificationPreference 
} from '@docmost/db/types/entity.types';

export const DEFAULT_NOTIFICATION_SETTINGS = {
  mention_in_page: { email: true, in_app: true, batch: false },
  mention_in_comment: { email: true, in_app: true, batch: false },
  comment_on_page: { email: true, in_app: true, batch: true },
  reply_to_comment: { email: true, in_app: true, batch: false },
  comment_in_thread: { email: true, in_app: true, batch: true },
  comment_resolved: { email: true, in_app: true, batch: true },
  export_completed: { email: true, in_app: true, batch: false },
  export_failed: { email: true, in_app: true, batch: false },
  page_shared: { email: true, in_app: true, batch: true },
  page_updated: { email: false, in_app: true, batch: true },
  task_assigned: { email: true, in_app: true, batch: false },
  task_due_soon: { email: true, in_app: true, batch: false },
};

@Injectable()
export class NotificationPreferenceRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insertPreference(preference: InsertableNotificationPreference): Promise<NotificationPreference> {
    return await this.db
      .insertInto('notificationPreferences')
      .values(preference)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findByUserAndWorkspace(
    userId: string,
    workspaceId: string
  ): Promise<NotificationPreference | undefined> {
    return await this.db
      .selectFrom('notificationPreferences')
      .selectAll()
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findOrCreate(
    userId: string,
    workspaceId: string
  ): Promise<NotificationPreference> {
    const existing = await this.findByUserAndWorkspace(userId, workspaceId);
    if (existing) {
      return existing;
    }

    return await this.insertPreference({
      userId: userId,
      workspaceId: workspaceId,
      emailEnabled: true,
      inAppEnabled: true,
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      batchWindowMinutes: 15,
      maxBatchSize: 20,
      batchTypes: ['comment_on_page', 'comment_in_thread', 'comment_resolved'],
      emailFrequency: 'smart',
      digestTime: '09:00:00',
      quietHoursEnabled: false,
      quietHoursStart: '18:00:00',
      quietHoursEnd: '09:00:00',
      timezone: 'UTC',
      weekendNotifications: true,
    });
  }

  async updatePreference(
    userId: string,
    workspaceId: string,
    update: UpdatableNotificationPreference
  ): Promise<NotificationPreference> {
    return await this.db
      .updateTable('notificationPreferences')
      .set({
        ...update,
        updatedAt: new Date(),
      })
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findUsersWithBatchingEnabled(
    workspaceId: string,
    notificationType: string
  ): Promise<NotificationPreference[]> {
    return await this.db
      .selectFrom('notificationPreferences')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('emailEnabled', '=', true)
      .where('emailFrequency', '!=', 'instant')
      .where(
        sql<boolean>`notification_settings::jsonb->'${sql.raw(notificationType)}'->>'batch' = 'true'`
      )
      .execute();
  }

  async findUsersForDigest(
    workspaceId: string,
    currentTime: string,
    timezone: string
  ): Promise<NotificationPreference[]> {
    return await this.db
      .selectFrom('notificationPreferences')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('emailFrequency', '=', 'daily')
      .where('digestTime', '=', currentTime)
      .where('timezone', '=', timezone)
      .where('emailEnabled', '=', true)
      .execute();
  }

  async deletePreference(userId: string, workspaceId: string): Promise<void> {
    await this.db
      .deleteFrom('notificationPreferences')
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }
}