import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { 
  NotificationBatch, 
  InsertableNotificationBatch, 
  UpdatableNotificationBatch 
} from '@docmost/db/types/entity.types';

@Injectable()
export class NotificationBatchRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insertBatch(batch: InsertableNotificationBatch): Promise<NotificationBatch> {
    return await this.db
      .insertInto('notificationBatches')
      .values(batch)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<NotificationBatch | undefined> {
    return await this.db
      .selectFrom('notificationBatches')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async findByBatchKey(
    batchKey: string,
    recipientId: string,
    notSentOnly = true
  ): Promise<NotificationBatch | undefined> {
    let query = this.db
      .selectFrom('notificationBatches')
      .selectAll()
      .where('batchKey', '=', batchKey)
      .where('recipientId', '=', recipientId);

    if (notSentOnly) {
      query = query.where('sentAt', 'is', null);
    }

    return await query.executeTakeFirst();
  }

  async getPendingBatches(limit = 100): Promise<NotificationBatch[]> {
    return await this.db
      .selectFrom('notificationBatches')
      .selectAll()
      .where('sentAt', 'is', null)
      .where('scheduledFor', '<=', new Date())
      .orderBy('scheduledFor', 'asc')
      .limit(limit)
      .execute();
  }

  async updateBatch(id: string, update: UpdatableNotificationBatch): Promise<NotificationBatch> {
    return await this.db
      .updateTable('notificationBatches')
      .set(update)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async markAsSent(id: string): Promise<void> {
    await this.db
      .updateTable('notificationBatches')
      .set({
        sentAt: new Date(),
      })
      .where('id', '=', id)
      .execute();
  }

  async incrementNotificationCount(id: string): Promise<void> {
    await this.db
      .updateTable('notificationBatches')
      .set((eb) => ({
        notificationCount: eb('notificationCount', '+', 1),
      }))
      .where('id', '=', id)
      .execute();
  }

  async deleteOldBatches(olderThan: Date): Promise<number> {
    const result = await this.db
      .deleteFrom('notificationBatches')
      .where('sentAt', '<', olderThan)
      .execute();

    return Number(result[0].numDeletedRows);
  }

  async getScheduledBatchesForUser(
    recipientId: string,
    workspaceId: string
  ): Promise<NotificationBatch[]> {
    return await this.db
      .selectFrom('notificationBatches')
      .selectAll()
      .where('recipientId', '=', recipientId)
      .where('workspaceId', '=', workspaceId)
      .where('sentAt', 'is', null)
      .orderBy('scheduledFor', 'asc')
      .execute();
  }
}