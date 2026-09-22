"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSchema1789000000001 = void 0;
class AdminSchema1789000000001 {
    async up(qr) {
        await qr.query(`
      CREATE TABLE IF NOT EXISTS admin_usuario (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        email           VARCHAR(255) NOT NULL UNIQUE,
        password_hash   TEXT        NOT NULL,
        rol             VARCHAR(50)  NOT NULL DEFAULT 'ADMIN',
        totp_secret     TEXT,
        totp_activo     BOOLEAN     NOT NULL DEFAULT false,
        activo          BOOLEAN     NOT NULL DEFAULT true,
        ultimo_acceso   TIMESTAMPTZ,
        creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS odoo_conexion (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre              VARCHAR(255) NOT NULL,
        odoo_url            TEXT        NOT NULL,
        odoo_db             TEXT        NOT NULL,
        odoo_user           TEXT        NOT NULL,
        odoo_password_enc   TEXT        NOT NULL,
        activa              BOOLEAN     NOT NULL DEFAULT true,
        version_odoo        TEXT,
        ultimo_test         TIMESTAMPTZ,
        ultimo_test_ok      BOOLEAN,
        creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
        actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    }
    async down(qr) {
        await qr.query(`DROP TABLE IF EXISTS odoo_conexion;`);
        await qr.query(`DROP TABLE IF EXISTS admin_usuario;`);
    }
}
exports.AdminSchema1789000000001 = AdminSchema1789000000001;
//# sourceMappingURL=1789000000001-AdminSchema.js.map