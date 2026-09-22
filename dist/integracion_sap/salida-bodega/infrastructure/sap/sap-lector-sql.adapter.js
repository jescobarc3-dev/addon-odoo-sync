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
var SapLectorSqlAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SapLectorSqlAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mssql = require("mssql");
let SapLectorSqlAdapter = SapLectorSqlAdapter_1 = class SapLectorSqlAdapter {
    constructor(cfg) {
        this.cfg = cfg;
        this.logger = new common_1.Logger(SapLectorSqlAdapter_1.name);
        this.pool = null;
    }
    async onModuleInit() {
        try {
            this.pool = await new mssql.ConnectionPool({
                server: this.cfg.get('SAP_SQL_HOST', 'localhost'),
                port: parseInt(this.cfg.get('SAP_SQL_PORT', '1433'), 10),
                user: this.cfg.get('SAP_SQL_USER', ''),
                password: this.cfg.get('SAP_SQL_PASSWORD', ''),
                database: this.cfg.get('SAP_SQL_DEFAULT_DB', 'SBODemoDB'),
                options: { trustServerCertificate: true, enableArithAbort: true },
                pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
            }).connect();
            this.logger.log('Conexión SAP SQL Server establecida');
        }
        catch (err) {
            this.logger.warn(`No se pudo conectar a SAP SQL Server: ${err.message}. Continuando sin SAP.`);
            this.pool = null;
        }
    }
    async onModuleDestroy() {
        if (this.pool)
            await this.pool.close();
    }
    nombreBaseDatos(empresaCodigo) {
        const map = {
            PT: this.cfg.get('SAP_SQL_DEFAULT_DB', 'SBODemoDB'),
        };
        return map[empresaCodigo] ?? this.cfg.get('SAP_SQL_DEFAULT_DB', 'SBODemoDB');
    }
    async obtenerSalidaPorDocnum(empresaCodigo, docNum) {
        if (!this.pool) {
            this.logger.warn('Pool SAP no disponible, devolviendo null');
            return null;
        }
        try {
            const db = this.nombreBaseDatos(empresaCodigo);
            const req = this.pool.request().input('docNum', mssql.Int, docNum);
            const cabResult = await req.query(`SELECT TOP 1 DocEntry, DocNum, DocDate FROM [${db}].dbo.OIGE WHERE DocNum = @docNum`);
            if (!cabResult.recordset.length)
                return null;
            const cab = cabResult.recordset[0];
            const req2 = this.pool.request().input('docEntry', mssql.Int, cab.DocEntry);
            const linResult = await req2.query(`SELECT LineNum, ItemCode, Dscription, Quantity, WhsCode, UomCode
         FROM [${db}].dbo.IGE1 WHERE DocEntry = @docEntry ORDER BY LineNum`);
            const req3 = this.pool.request().input('docEntry2', mssql.Int, cab.DocEntry);
            const lotResult = await req3.query(`SELECT BaseLinNum, DistNumber FROM [${db}].dbo.IBT1
         WHERE BaseType = 60 AND BaseEntry = @docEntry2`);
            const lotesPorLinea = {};
            for (const lot of lotResult.recordset) {
                if (!lotesPorLinea[lot.BaseLinNum])
                    lotesPorLinea[lot.BaseLinNum] = [];
                lotesPorLinea[lot.BaseLinNum].push(lot.DistNumber);
            }
            const lineas = linResult.recordset.map((r) => ({
                lineNum: r.LineNum,
                itemCode: r.ItemCode,
                descripcion: r.Dscription,
                cantidad: parseFloat(r.Quantity),
                whsCode: r.WhsCode,
                uomCode: r.UomCode,
                lotes: lotesPorLinea[r.LineNum] ?? [],
            }));
            return { docEntry: cab.DocEntry, docNum: cab.DocNum, docDate: cab.DocDate, lineas };
        }
        catch (err) {
            this.logger.error(`Error leyendo SAP DocNum ${docNum}: ${err.message}`);
            throw err;
        }
    }
};
exports.SapLectorSqlAdapter = SapLectorSqlAdapter;
exports.SapLectorSqlAdapter = SapLectorSqlAdapter = SapLectorSqlAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SapLectorSqlAdapter);
//# sourceMappingURL=sap-lector-sql.adapter.js.map