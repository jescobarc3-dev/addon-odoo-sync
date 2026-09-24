import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalUsuarioPasswordLocal1789000000007 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE portal_usuario
        ADD COLUMN IF NOT EXISTS password_hash TEXT,
        ALTER COLUMN odoo_uid DROP NOT NULL;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE portal_usuario
        DROP COLUMN IF EXISTS password_hash,
        ALTER COLUMN odoo_uid SET NOT NULL;
    `);
  }
}
