import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { 
  NotificationAggregation, 
  InsertableNotificationAggregation, 
  UpdatableNotificationAggregation 
} from '@docmost/db/types/entity.types';

@Injectable()
export class NotificationAggregationRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insertAggregation(aggregation: InsertableNotificationAggregation): Promise<NotificationAggregation> {
    return await this.db
      .insertInto('notificationAggregations')
      .values(aggregation)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<NotificationAggregation | undefined> {
    return await this.db
      .selectFrom('notificationAggregations')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async findByKey(aggregationKey: string): Promise<NotificationAggregation | undefined> {
    return await this.db
      .selectFrom('notificationAggregations')
      .selectAll()
      .where('aggregationKey', '=', aggregationKey)
      .executeTakeFirst();
  }

  async updateAggregation(
    aggregationKey: string,
    update: UpdatableNotificationAggregation
  ): Promise<NotificationAggregation> {
    return await this.db
      .updateTable('notificationAggregations')
      .set({
        ...update,
        updatedAt: new Date(),
      })
      .where('aggregationKey', '=', aggregationKey)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async addNotificationToAggregation(
    aggregationKey: string,
    notificationId: string,
    actorId?: string
  ): Promise<void> {
    const aggregation = await this.findByKey(aggregationKey);
    if (!aggregation) {
      throw new Error(`Aggregation not found: ${aggregationKey}`);
    }

    const updates: UpdatableNotificationAggregation = {
      notificationIds: [...aggregation.notificationIds, notificationId],
      updatedAt: new Date(),
    };

    if (actorId && !aggregation.actorIds.includes(actorId)) {
      updates.actorIds = [...aggregation.actorIds, actorId];
    }

    // Update summary data
    updates.summaryData = {
      ...(aggregation.summaryData as Record<string, any> || {}),
      totalCount: aggregation.notificationIds.length + 1,
      actorCount: updates.actorIds?.length || aggregation.actorIds.length,
      timeSpan: {
        ...((aggregation.summaryData as any).timeSpan || {}),
        end: new Date(),
      },
    };

    await this.updateAggregation(aggregationKey, updates);
  }

  async findRecentByRecipient(
    recipientId: string,
    limit = 10
  ): Promise<NotificationAggregation[]> {
    return await this.db
      .selectFrom('notificationAggregations')
      .selectAll()
      .where('recipientId', '=', recipientId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .execute();
  }

  async deleteOldAggregations(olderThan: Date): Promise<number> {
    const result = await this.db
      .deleteFrom('notificationAggregations')
      .where('updatedAt', '<', olderThan)
      .execute();

    return Number(result[0].numDeletedRows);
  }

  async getAggregationsByEntity(
    entityType: string,
    entityId: string,
    recipientId?: string
  ): Promise<NotificationAggregation[]> {
    let query = this.db
      .selectFrom('notificationAggregations')
      .selectAll()
      .where('entityType', '=', entityType)
      .where('entityId', '=', entityId);

    if (recipientId) {
      query = query.where('recipientId', '=', recipientId);
    }

    return await query.orderBy('updatedAt', 'desc').execute();
  }
}