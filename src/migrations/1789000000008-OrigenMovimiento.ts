import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrigenMovimiento1789000000008 implements MigrationInterface {
  name = 'OrigenMovimiento1789000000008';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE integracion_sap.registro_sincronizacion
        ADD COLUMN IF NOT EXISTS origen VARCHAR(10) NOT NULL DEFAULT 'EXT';
    `);
    await qr.query(`
      ALTER TABLE integracion_sap.historial_carga_inventario
        ADD COLUMN IF NOT EXISTS origen VARCHAR(10) NOT NULL DEFAULT 'INT';
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE integracion_sap.registro_sincronizacion DROP COLUMN IF EXISTS origen;`);
    await qr.query(`ALTER TABLE integracion_sap.historial_carga_inventario DROP COLUMN IF EXISTS origen;`);
  }
}
