import { MigrationInterface, QueryRunner } from 'typeorm';

export class HistorialCargaInventario1789000000003 implements MigrationInterface {
  name = 'HistorialCargaInventario1789000000003';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS integracion_sap.historial_carga_inventario (
        id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tipo             VARCHAR(60)  NOT NULL,
        nombre_archivo   VARCHAR(255),
        total_filas      INT          NOT NULL DEFAULT 0,
        ajustados        INT          NOT NULL DEFAULT 0,
        sin_cambio       INT          NOT NULL DEFAULT 0,
        errores          INT          NOT NULL DEFAULT 0,
        sin_bodega       INT          NOT NULL DEFAULT 0,
        con_on_hand_cero INT          NOT NULL DEFAULT 0,
        detalle_errores  JSONB        NOT NULL DEFAULT '[]',
        sin_bodega_lista JSONB        NOT NULL DEFAULT '[]',
        estado           VARCHAR(20)  NOT NULL DEFAULT 'completado',
        error_fatal      TEXT,
        creado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_historial_tipo_fecha
        ON integracion_sap.historial_carga_inventario (tipo, creado_en DESC)
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS integracion_sap.historial_carga_inventario`);
  }
}
