import { MigrationInterface, QueryRunner } from 'typeorm';

export class MapeoBodegaForzarSinStock1789000000006 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "integracion_sap"."mapeo_bodega"
        ADD COLUMN IF NOT EXISTS "forzar_sin_stock" boolean NOT NULL DEFAULT true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "integracion_sap"."mapeo_bodega"
        DROP COLUMN IF EXISTS "forzar_sin_stock"
    `);
  }
}
