import { MigrationInterface, QueryRunner } from 'typeorm';

export class MimetypeLength1789000000014 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE integracion_sap.historial_carga_inventario
        ALTER COLUMN archivo_original_mimetype TYPE VARCHAR(150)
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE integracion_sap.historial_carga_inventario
        ALTER COLUMN archivo_original_mimetype TYPE VARCHAR(50)
    `);
  }
}
