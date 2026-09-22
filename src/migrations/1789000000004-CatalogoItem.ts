import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogoItem1789000000004 implements MigrationInterface {
  name = 'CatalogoItem1789000000004';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS integracion_sap.catalogo_item (
        id              SERIAL          PRIMARY KEY,
        empresa_codigo  VARCHAR(20)     NOT NULL,
        item_code       VARCHAR(50)     NOT NULL,
        item_name       VARCHAR(255)    NOT NULL,
        uom_code        VARCHAR(20),
        precio_unitario NUMERIC(18,4),
        activo          BOOLEAN         NOT NULL DEFAULT TRUE,
        actualizado_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_catalogo_item UNIQUE (empresa_codigo, item_code)
      )
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_catalogo_item_code
        ON integracion_sap.catalogo_item (empresa_codigo, item_code)
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_catalogo_item_tsvector
        ON integracion_sap.catalogo_item
        USING gin(to_tsvector('simple', item_name || ' ' || item_code))
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS integracion_sap.catalogo_item`);
  }
}
