import { MigrationInterface, QueryRunner } from 'typeorm';

export class HistorialArchivoOriginal1789000000013 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE integracion_sap.historial_carga_inventario
        ADD COLUMN IF NOT EXISTS archivo_original BYTEA NULL,
        ADD COLUMN IF NOT EXISTS archivo_original_mimetype VARCHAR(50) NULL
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE integracion_sap.historial_carga_inventario
        DROP COLUMN IF EXISTS archivo_original,
        DROP COLUMN IF EXISTS archivo_original_mimetype
    `);
  }
}
