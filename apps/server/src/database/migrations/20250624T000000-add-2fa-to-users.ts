import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('is_2fa_enabled', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('twofa_secret', 'varchar')
    .addColumn('twofa_method', 'varchar')
    .addColumn('twofa_backup_codes', 'jsonb')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropColumn('is_2fa_enabled')
    .dropColumn('twofa_secret')
    .dropColumn('twofa_method')
    .dropColumn('twofa_backup_codes')
    .execute();
} 