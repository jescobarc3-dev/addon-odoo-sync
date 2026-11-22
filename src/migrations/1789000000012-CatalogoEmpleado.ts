import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogoEmpleado1789000000012 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS integracion_sap.catalogo_empleado (
        id SERIAL PRIMARY KEY,
        empresa_codigo VARCHAR(20) NOT NULL,
        empleado_codigo VARCHAR(50) NOT NULL,
        nombre_completo VARCHAR(255) NOT NULL,
        dpi VARCHAR(20) NULL,
        departamento VARCHAR(100) NULL,
        puesto VARCHAR(100) NULL,
        correo_trabajo VARCHAR(150) NULL,
        telefono VARCHAR(30) NULL,
        fecha_ingreso DATE NULL,
        odoo_employee_id INTEGER NULL,
        odoo_sinc_estado VARCHAR(20) NULL,
        odoo_sinc_error TEXT NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_catalogo_empleado_codigo UNIQUE (empresa_codigo, empleado_codigo)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_catalogo_empleado_dpi
        ON integracion_sap.catalogo_empleado (empresa_codigo, dpi)
        WHERE dpi IS NOT NULL;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS integracion_sap.catalogo_empleado`);
  }
}
