import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogoUbicacion1789000000015 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE IF NOT EXISTS integracion_sap.catalogo_ubicacion (
        id              SERIAL PRIMARY KEY,
        empresa_codigo  VARCHAR(20)   NOT NULL,
        puesto          INTEGER       NOT NULL,
        cliente         VARCHAR(255),
        razon_social    VARCHAR(255),
        sucursal        VARCHAR(255),
        area            VARCHAR(100),
        industria       VARCHAR(100),
        departamento    VARCHAR(100),
        municipio       VARCHAR(100),
        zona            INTEGER,
        direccion       TEXT,
        categoria       VARCHAR(100),
        encargado_area  VARCHAR(255),
        facturacion     VARCHAR(50),
        posiciones      TEXT[]        NOT NULL DEFAULT '{}',
        calidad_score   SMALLINT      NOT NULL DEFAULT 100,
        issues          TEXT[]        NOT NULL DEFAULT '{}',
        activo          BOOLEAN       NOT NULL DEFAULT TRUE,
        actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_ubicacion_empresa_puesto UNIQUE (empresa_codigo, puesto)
      )
    `);
    await runner.query(`
      CREATE INDEX IF NOT EXISTS idx_catalogo_ubicacion_empresa
        ON integracion_sap.catalogo_ubicacion (empresa_codigo)
    `);
    await runner.query(`
      CREATE INDEX IF NOT EXISTS idx_catalogo_ubicacion_area
        ON integracion_sap.catalogo_ubicacion (empresa_codigo, area)
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE IF EXISTS integracion_sap.catalogo_ubicacion`);
  }
}
