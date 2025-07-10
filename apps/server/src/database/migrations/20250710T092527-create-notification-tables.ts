import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create notifications table
  await db.schema
    .createTable('notifications')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('recipient_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('actor_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('type', 'varchar(50)', (col) => col.notNull())
    .addColumn('status', 'varchar(20)', (col) =>
      col.notNull().defaultTo('unread'),
    )
    .addColumn('priority', 'varchar(20)', (col) =>
      col.notNull().defaultTo('normal'),
    )
    .addColumn('entity_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('entity_id', 'uuid', (col) => col.notNull())
    .addColumn('context', 'jsonb', (col) => col.notNull().defaultTo('{}'))
    .addColumn('group_key', 'varchar(255)')
    .addColumn('group_count', 'integer', (col) => col.defaultTo(1))
    .addColumn('deduplication_key', 'varchar(255)')
    .addColumn('batch_id', 'uuid')
    .addColumn('is_batched', 'boolean', (col) => col.defaultTo(false))
    .addColumn('email_sent_at', 'timestamp')
    .addColumn('in_app_delivered_at', 'timestamp')
    .addColumn('read_at', 'timestamp')
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn('expires_at', 'timestamp')
    .execute();

  // Create indexes for notifications
  await db.schema
    .createIndex('idx_notifications_recipient_status')
    .on('notifications')
    .columns(['recipient_id', 'status'])
    .execute();

  await db.schema
    .createIndex('idx_notifications_group_key')
    .on('notifications')
    .columns(['group_key', 'created_at'])
    .execute();

  await db.schema
    .createIndex('idx_notifications_batch_pending')
    .on('notifications')
    .columns(['batch_id', 'is_batched'])
    .where('is_batched', '=', false)
    .execute();

  await db.schema
    .createIndex('idx_notifications_expires')
    .on('notifications')
    .column('expires_at')
    .where('expires_at', 'is not', null)
    .execute();

  await db.schema
    .createIndex('idx_notifications_deduplication')
    .unique()
    .on('notifications')
    .column('deduplication_key')
    .where('deduplication_key', 'is not', null)
    .execute();

  // Create notification_preferences table
  await db.schema
    .createTable('notification_preferences')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('email_enabled', 'boolean', (col) =>
      col.notNull().defaultTo(true),
    )
    .addColumn('in_app_enabled', 'boolean', (col) =>
      col.notNull().defaultTo(true),
    )
    .addColumn('notification_settings', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{
        "mention_in_page": {"email": true, "in_app": true, "batch": false},
        "mention_in_comment": {"email": true, "in_app": true, "batch": false},
        "comment_on_page": {"email": true, "in_app": true, "batch": true},
        "reply_to_comment": {"email": true, "in_app": true, "batch": false},
        "comment_in_thread": {"email": true, "in_app": true, "batch": true},
        "comment_resolved": {"email": true, "in_app": true, "batch": true},
        "export_completed": {"email": true, "in_app": true, "batch": false},
        "page_shared": {"email": true, "in_app": true, "batch": true},
        "task_assigned": {"email": true, "in_app": true, "batch": false}
      }'::jsonb`),
    )
    .addColumn('batch_window_minutes', 'integer', (col) => col.defaultTo(15))
    .addColumn('max_batch_size', 'integer', (col) => col.defaultTo(20))
    .addColumn('batch_types', sql`text[]`, (col) =>
      col.defaultTo(
        sql`ARRAY['comment_on_page', 'comment_in_thread', 'comment_resolved']`,
      ),
    )
    .addColumn('email_frequency', 'varchar(20)', (col) =>
      col.notNull().defaultTo('smart'),
    )
    .addColumn('digest_time', 'time', (col) => col.defaultTo('09:00:00'))
    .addColumn('quiet_hours_enabled', 'boolean', (col) => col.defaultTo(false))
    .addColumn('quiet_hours_start', 'time', (col) => col.defaultTo('18:00:00'))
    .addColumn('quiet_hours_end', 'time', (col) => col.defaultTo('09:00:00'))
    .addColumn('timezone', 'varchar(50)', (col) => col.defaultTo('UTC'))
    .addColumn('weekend_notifications', 'boolean', (col) => col.defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  // Create unique index for user_workspace
  await db.schema
    .createIndex('idx_notification_preferences_user_workspace')
    .unique()
    .on('notification_preferences')
    .columns(['user_id', 'workspace_id'])
    .execute();

  // Create notification_batches table
  await db.schema
    .createTable('notification_batches')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('recipient_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('batch_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('batch_key', 'varchar(255)', (col) => col.notNull())
    .addColumn('notification_count', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn('first_notification_id', 'uuid', (col) =>
      col.references('notifications.id').onDelete('set null'),
    )
    .addColumn('scheduled_for', 'timestamp', (col) => col.notNull())
    .addColumn('sent_at', 'timestamp')
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  // Create indexes for notification_batches
  await db.schema
    .createIndex('idx_notification_batches_scheduled_pending')
    .on('notification_batches')
    .columns(['scheduled_for', 'sent_at'])
    .where('sent_at', 'is', null)
    .execute();

  await db.schema
    .createIndex('idx_notification_batches_batch_key')
    .on('notification_batches')
    .columns(['batch_key', 'recipient_id'])
    .execute();

  // Create notification_aggregations table
  await db.schema
    .createTable('notification_aggregations')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('aggregation_key', 'varchar(255)', (col) => col.notNull())
    .addColumn('recipient_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('aggregation_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('entity_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('entity_id', 'uuid', (col) => col.notNull())
    .addColumn('actor_ids', sql`uuid[]`, (col) =>
      col.notNull().defaultTo(sql`'{}'`),
    )
    .addColumn('notification_ids', sql`uuid[]`, (col) =>
      col.notNull().defaultTo(sql`'{}'`),
    )
    .addColumn('summary_data', 'jsonb', (col) => col.notNull().defaultTo('{}'))
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  // Create indexes for notification_aggregations
  await db.schema
    .createIndex('idx_notification_aggregations_key')
    .unique()
    .on('notification_aggregations')
    .column('aggregation_key')
    .execute();

  await db.schema
    .createIndex('idx_notification_aggregations_recipient_updated')
    .on('notification_aggregations')
    .columns(['recipient_id', 'updated_at'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('notification_aggregations').ifExists().execute();
  await db.schema.dropTable('notification_batches').ifExists().execute();
  await db.schema.dropTable('notification_preferences').ifExists().execute();
  await db.schema.dropTable('notifications').ifExists().execute();
}
