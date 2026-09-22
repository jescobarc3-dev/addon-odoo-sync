"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SapCatalogoSqlAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SapCatalogoSqlAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mssql = require("mssql");
let SapCatalogoSqlAdapter = SapCatalogoSqlAdapter_1 = class SapCatalogoSqlAdapter {
    constructor(cfg) {
        this.cfg = cfg;
        this.logger = new common_1.Logger(SapCatalogoSqlAdapter_1.name);
    }
    async getPool(db) {
        return new mssql.ConnectionPool({
            server: this.cfg.get('SAP_SQL_HOST', 'localhost'),
            port: parseInt(this.cfg.get('SAP_SQL_PORT', '1433'), 10),
            user: this.cfg.get('SAP_SQL_USER', ''),
            password: this.cfg.get('SAP_SQL_PASSWORD', ''),
            database: db,
            options: { trustServerCertificate: true, enableArithAbort: true },
            pool: { max: 3, min: 0, idleTimeoutMillis: 30000 },
        }).connect();
    }
    nombreBaseDatos(empresaCodigo) {
        const map = {
            PT: this.cfg.get('SAP_SQL_DEFAULT_DB', 'SBODemoDB'),
        };
        return map[empresaCodigo] ?? this.cfg.get('SAP_SQL_DEFAULT_DB', 'SBODemoDB');
    }
    async obtenerCatalogoCompleto(empresaCodigo) {
        const db = this.nombreBaseDatos(empresaCodigo);
        let pool = null;
        try {
            pool = await this.getPool(db);
            const itemsResult = await pool.request().query(`
        SELECT T0.ItemCode, T0.ItemName, ISNULL(G.ItmsGrpNam, 'Sin categoría') AS GrupoNombre
        FROM [${db}].dbo.OITM T0
        LEFT JOIN [${db}].dbo.OITB G ON T0.ItmsGrpCod = G.ItmsGrpCod
        WHERE T0.Canceled = 'N'
          AND T0.InvntItem = 'Y'
          AND T0.validFor = 'Y'
        ORDER BY T0.ItemCode
      `);
            const cantResult = await pool.request().query(`
        SELECT ItemCode, WhsCode, OnHand
        FROM [${db}].dbo.OITW
        WHERE OnHand > 0
        ORDER BY ItemCode
      `);
            const cantMap = {};
            for (const row of cantResult.recordset) {
                if (!cantMap[row.ItemCode])
                    cantMap[row.ItemCode] = [];
                cantMap[row.ItemCode].push({ whsCode: row.WhsCode, onHand: parseFloat(row.OnHand) });
            }
            const items = itemsResult.recordset.map((row) => ({
                itemCode: row.ItemCode,
                itemName: row.ItemName,
                grupoNombre: row.GrupoNombre,
                cantidadesPorBodega: cantMap[row.ItemCode] ?? [],
            }));
            this.logger.log(`SAP [${db}]: ${items.length} items activos leídos`);
            return items;
        }
        catch (err) {
            this.logger.error(`Error leyendo catálogo SAP [${db}]: ${err.message}`);
            throw err;
        }
        finally {
            await pool?.close().catch(() => { });
        }
    }
};
exports.SapCatalogoSqlAdapter = SapCatalogoSqlAdapter;
exports.SapCatalogoSqlAdapter = SapCatalogoSqlAdapter = SapCatalogoSqlAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SapCatalogoSqlAdapter);
//# sourceMappingURL=sap-catalogo-sql.adapter.js.map