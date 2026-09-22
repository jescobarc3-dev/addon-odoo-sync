import { MigrationInterface, QueryRunner } from 'typeorm';

export class MapeoBodegaTipoOperacion1789000000002 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "integracion_sap"."mapeo_bodega"
        ADD COLUMN IF NOT EXISTS "tipo_operacion" character varying(20) NOT NULL DEFAULT 'SALIDA'
    `);

    // Eliminar la constraint única anterior (empresa_codigo, whs_code_sap)
    await queryRunner.query(`
      DO $$
      DECLARE cname TEXT;
      BEGIN
        SELECT c.conname INTO cname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'integracion_sap' AND t.relname = 'mapeo_bodega' AND c.contype = 'u'
        LIMIT 1;
        IF cname IS NOT NULL THEN
          EXECUTE 'ALTER TABLE integracion_sap.mapeo_bodega DROP CONSTRAINT "' || cname || '"';
        END IF;
      END $$
    `);

    await queryRunner.query(
      `ALTER TABLE "integracion_sap"."mapeo_bodega" ADD CONSTRAINT "UQ_mapeo_bodega_empresa_whs_tipo" UNIQUE ("empresa_codigo", "whs_code_sap", "tipo_operacion")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "integracion_sap"."mapeo_bodega" DROP CONSTRAINT IF EXISTS "UQ_mapeo_bodega_empresa_whs_tipo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "integracion_sap"."mapeo_bodega" DROP COLUMN "tipo_operacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "integracion_sap"."mapeo_bodega" ADD CONSTRAINT "UQ_mapeo_bodega_empresa_whs" UNIQUE ("empresa_codigo", "whs_code_sap")`,
    );
  }
}
