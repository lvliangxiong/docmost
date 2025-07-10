import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { Notification, InsertableNotification, UpdatableNotification } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

@Injectable()
export class NotificationRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insertNotification(notification: InsertableNotification): Promise<Notification> {
    return await this.db
      .insertInto('notifications')
      .values(notification)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<Notification | undefined> {
    return await this.db
      .selectFrom('notifications')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async findByRecipient(
    recipientId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Notification[]> {
    let query = this.db
      .selectFrom('notifications')
      .selectAll()
      .where('recipientId', '=', recipientId)
      .orderBy('createdAt', 'desc');

    if (options.status) {
      query = query.where('status', '=', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return await query.execute();
  }

  async findByBatchId(batchId: string): Promise<Notification[]> {
    return await this.db
      .selectFrom('notifications')
      .selectAll()
      .where('batchId', '=', batchId)
      .orderBy('createdAt', 'desc')
      .execute();
  }

  async findRecent(params: {
    recipientId: string;
    type: string;
    entityId: string;
    since: Date;
  }): Promise<Notification[]> {
    return await this.db
      .selectFrom('notifications')
      .selectAll()
      .where('recipientId', '=', params.recipientId)
      .where('type', '=', params.type)
      .where('entityId', '=', params.entityId)
      .where('createdAt', '>', params.since)
      .orderBy('createdAt', 'desc')
      .execute();
  }

  async existsByDeduplicationKey(key: string): Promise<boolean> {
    const result = await this.db
      .selectFrom('notifications')
      .select(['id'])
      .where('deduplicationKey', '=', key)
      .executeTakeFirst();

    return !!result;
  }

  async updateNotification(id: string, update: UpdatableNotification): Promise<Notification> {
    return await this.db
      .updateTable('notifications')
      .set(update)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async markAsRead(id: string): Promise<void> {
    await this.db
      .updateTable('notifications')
      .set({
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where('id', '=', id)
      .execute();
  }

  async markManyAsRead(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.db
      .updateTable('notifications')
      .set({
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where('id', 'in', ids)
      .execute();
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    const result = await this.db
      .selectFrom('notifications')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('recipientId', '=', recipientId)
      .where('status', '=', 'unread')
      .executeTakeFirst();

    return result?.count || 0;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db
      .deleteFrom('notifications')
      .where('expiresAt', '<', new Date())
      .execute();

    return Number(result[0].numDeletedRows);
  }

  async getNotificationsByGroupKey(
    groupKey: string,
    recipientId: string,
    since: Date
  ): Promise<Notification[]> {
    return await this.db
      .selectFrom('notifications')
      .selectAll()
      .where('groupKey', '=', groupKey)
      .where('recipientId', '=', recipientId)
      .where('createdAt', '>', since)
      .orderBy('createdAt', 'desc')
      .execute();
  }

  async updateBatchId(notificationIds: string[], batchId: string): Promise<void> {
    if (notificationIds.length === 0) return;

    await this.db
      .updateTable('notifications')
      .set({
        batchId: batchId,
        isBatched: true,
        updatedAt: new Date(),
      })
      .where('id', 'in', notificationIds)
      .execute();
  }
}