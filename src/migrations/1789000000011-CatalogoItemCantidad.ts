import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogoItemCantidad1789000000011 implements MigrationInterface {
  name = 'CatalogoItemCantidad1789000000011';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE integracion_sap.catalogo_item
      ADD COLUMN IF NOT EXISTS cantidad_sap NUMERIC(18, 4) NULL
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE integracion_sap.catalogo_item
      DROP COLUMN IF EXISTS cantidad_sap
    `);
  }
}
