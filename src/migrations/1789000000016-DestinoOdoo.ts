import { MigrationInterface, QueryRunner } from 'typeorm';

export class DestinoOdoo1789000000016 implements MigrationInterface {
  name = 'DestinoOdoo1789000000016';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE integracion_sap.destino_odoo (
        id SERIAL PRIMARY KEY,
        empresa_codigo VARCHAR(20) NOT NULL DEFAULT 'DEFAULT',
        nombre VARCHAR(100) NOT NULL,
        catalogo VARCHAR(50) NOT NULL,
        odoo_modelo VARCHAR(100) NOT NULL,
        campo_clave_local VARCHAR(50) NOT NULL,
        campo_clave_odoo VARCHAR(50) NOT NULL,
        auto_sync BOOLEAN NOT NULL DEFAULT FALSE,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        ultima_sync TIMESTAMPTZ,
        ultimo_error TEXT,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await qr.query(`
      CREATE TABLE integracion_sap.destino_odoo_campo (
        id SERIAL PRIMARY KEY,
        destino_id INTEGER NOT NULL REFERENCES integracion_sap.destino_odoo(id) ON DELETE CASCADE,
        campo_local VARCHAR(100) NOT NULL,
        campo_odoo VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'char'
      )
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query('DROP TABLE IF EXISTS integracion_sap.destino_odoo_campo');
    await qr.query('DROP TABLE IF EXISTS integracion_sap.destino_odoo');
  }
}
