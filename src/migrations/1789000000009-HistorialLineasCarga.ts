import { MigrationInterface, QueryRunner } from 'typeorm';

export class HistorialLineasCarga1789000000009 implements MigrationInterface {
  name = 'HistorialLineasCarga1789000000009';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE integracion_sap.historial_carga_inventario
      ADD COLUMN IF NOT EXISTS lineas_carga JSONB NOT NULL DEFAULT '[]'
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE integracion_sap.historial_carga_inventario
      DROP COLUMN IF EXISTS lineas_carga
    `);
  }
}
