"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegracionSapSchema1789000000000 = void 0;
class IntegracionSapSchema1789000000000 {
    constructor() {
        this.name = 'IntegracionSapSchema1789000000000';
    }
    async up(qr) {
        await qr.query(`CREATE SCHEMA IF NOT EXISTS integracion_sap`);
        await qr.query(`
      CREATE TABLE IF NOT EXISTS integracion_sap.registro_sincronizacion (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        empresa_codigo   VARCHAR(20)  NOT NULL,
        sap_docnum       INTEGER      NOT NULL,
        hash_pdf         VARCHAR(64)  NOT NULL,
        documento_archivo_id VARCHAR(36),
        estado           VARCHAR(40)  NOT NULL DEFAULT 'recibido',
        odoo_picking_id  INTEGER,
        odoo_origin      VARCHAR(60),
        ultimo_error     TEXT,
        intentos         SMALLINT     NOT NULL DEFAULT 0,
        sap_doc_entry    INTEGER,
        sap_doc_date     DATE,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_reg_empresa_docnum UNIQUE (empresa_codigo, sap_docnum),
        CONSTRAINT uq_reg_hash_pdf       UNIQUE (hash_pdf)
      )
    `);
        await qr.query(`CREATE INDEX IF NOT EXISTS idx_reg_estado ON integracion_sap.registro_sincronizacion (estado)`);
        await qr.query(`
      CREATE TABLE IF NOT EXISTS integracion_sap.mapeo_item (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        empresa_codigo   VARCHAR(20)  NOT NULL,
        item_code_sap    VARCHAR(50)  NOT NULL,
        odoo_product_id  INTEGER      NOT NULL,
        factor_uom       NUMERIC(10,4) NOT NULL DEFAULT 1,
        activo           BOOLEAN      NOT NULL DEFAULT true,
        notas            TEXT,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_mapeo_item UNIQUE (empresa_codigo, item_code_sap)
      )
    `);
        await qr.query(`
      CREATE TABLE IF NOT EXISTS integracion_sap.mapeo_bodega (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        empresa_codigo          VARCHAR(20)  NOT NULL,
        whs_code_sap            VARCHAR(20)  NOT NULL,
        odoo_location_id        INTEGER      NOT NULL,
        odoo_picking_type_id    INTEGER      NOT NULL,
        odoo_location_dest_id   INTEGER      NOT NULL,
        activo                  BOOLEAN      NOT NULL DEFAULT true,
        notas                   TEXT,
        created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_mapeo_bodega UNIQUE (empresa_codigo, whs_code_sap)
      )
    `);
    }
    async down(qr) {
        await qr.query(`DROP TABLE IF EXISTS integracion_sap.mapeo_bodega`);
        await qr.query(`DROP TABLE IF EXISTS integracion_sap.mapeo_item`);
        await qr.query(`DROP TABLE IF EXISTS integracion_sap.registro_sincronizacion`);
        await qr.query(`DROP SCHEMA IF EXISTS integracion_sap CASCADE`);
    }
}
exports.IntegracionSapSchema1789000000000 = IntegracionSapSchema1789000000000;
//# sourceMappingURL=1789000000000-IntegracionSapSchema.js.map