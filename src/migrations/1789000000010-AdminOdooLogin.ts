import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminOdooLogin1789000000010 implements MigrationInterface {
  name = 'AdminOdooLogin1789000000010';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE public.admin_usuario
      ADD COLUMN IF NOT EXISTS odoo_login VARCHAR(255) NULL
    `);
    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_usuario_odoo_login
        ON public.admin_usuario (odoo_login)
        WHERE odoo_login IS NOT NULL
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS public.idx_admin_usuario_odoo_login`);
    await qr.query(`ALTER TABLE public.admin_usuario DROP COLUMN IF EXISTS odoo_login`);
  }
}
