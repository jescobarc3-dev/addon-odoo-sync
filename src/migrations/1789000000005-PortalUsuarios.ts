import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalUsuarios1789000000005 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS portal_usuario (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        odoo_uid        INTEGER       NOT NULL UNIQUE,
        odoo_login      VARCHAR(255)  NOT NULL UNIQUE,
        nombre          VARCHAR(255)  NOT NULL,
        permisos        TEXT[]        NOT NULL DEFAULT '{}',
        activo          BOOLEAN       NOT NULL DEFAULT false,
        ultimo_login    TIMESTAMPTZ,
        sincronizado_en TIMESTAMPTZ,
        creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_portal_usuario_activo
        ON portal_usuario (activo);

      CREATE INDEX IF NOT EXISTS idx_portal_usuario_odoo_uid
        ON portal_usuario (odoo_uid);
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS portal_usuario;`);
  }
}
