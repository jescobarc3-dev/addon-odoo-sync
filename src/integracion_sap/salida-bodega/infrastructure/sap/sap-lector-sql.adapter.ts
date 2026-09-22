import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';
import { ISapLectorPort, SalidaSap, LineaSalidaSap, EntradaSap, LineaEntradaSap } from '../../application/ports/sap-lector.port';

@Injectable()
export class SapLectorSqlAdapter implements ISapLectorPort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SapLectorSqlAdapter.name);
  private pool: mssql.ConnectionPool | null = null;

  constructor(private readonly cfg: ConfigService) {}

  async onModuleInit(): Promise<void> {
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
    } catch (err) {
      this.logger.warn(`No se pudo conectar a SAP SQL Server: ${err.message}. Continuando sin SAP.`);
      this.pool = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) await this.pool.close();
  }

  private nombreBaseDatos(empresaCodigo: string): string {
    const map: Record<string, string> = {
      PT: this.cfg.get('SAP_SQL_DEFAULT_DB', 'SBODemoDB'),
    };
    return map[empresaCodigo] ?? this.cfg.get('SAP_SQL_DEFAULT_DB', 'SBODemoDB');
  }

  async obtenerSalidaPorDocnum(empresaCodigo: string, docNum: number): Promise<SalidaSap | null> {
    if (!this.pool) {
      this.logger.warn('Pool SAP no disponible, devolviendo null');
      return null;
    }

    try {
      const db = this.nombreBaseDatos(empresaCodigo);
      const req = this.pool.request().input('docNum', mssql.Int, docNum);

      const cabResult = await req.query(
        `SELECT TOP 1 DocEntry, DocNum, DocDate FROM [${db}].dbo.OIGE WHERE DocNum = @docNum`,
      );

      if (!cabResult.recordset.length) return null;

      const cab = cabResult.recordset[0];
      const req2 = this.pool.request().input('docEntry', mssql.Int, cab.DocEntry);

      const linResult = await req2.query(
        `SELECT LineNum, ItemCode, Dscription, Quantity, WhsCode, UomCode
         FROM [${db}].dbo.IGE1 WHERE DocEntry = @docEntry ORDER BY LineNum`,
      );

      const req3 = this.pool.request().input('docEntry2', mssql.Int, cab.DocEntry);
      const lotResult = await req3.query(
        `SELECT BaseLinNum, DistNumber FROM [${db}].dbo.IBT1
         WHERE BaseType = 60 AND BaseEntry = @docEntry2`,
      );

      const lotesPorLinea: Record<number, string[]> = {};
      for (const lot of lotResult.recordset) {
        if (!lotesPorLinea[lot.BaseLinNum]) lotesPorLinea[lot.BaseLinNum] = [];
        lotesPorLinea[lot.BaseLinNum].push(lot.DistNumber);
      }

      const lineas: LineaSalidaSap[] = linResult.recordset.map((r) => ({
        lineNum: r.LineNum,
        itemCode: r.ItemCode,
        descripcion: r.Dscription,
        cantidad: parseFloat(r.Quantity),
        whsCode: r.WhsCode,
        uomCode: r.UomCode,
        lotes: lotesPorLinea[r.LineNum] ?? [],
      }));

      return { docEntry: cab.DocEntry, docNum: cab.DocNum, docDate: cab.DocDate, lineas };
    } catch (err) {
      this.logger.error(`Error leyendo SAP salida DocNum ${docNum}: ${err.message}`);
      throw err;
    }
  }

  async obtenerEntradaPorDocnum(empresaCodigo: string, docNum: number): Promise<EntradaSap | null> {
    if (!this.pool) {
      this.logger.warn('Pool SAP no disponible, devolviendo null');
      return null;
    }

    try {
      const db = this.nombreBaseDatos(empresaCodigo);
      const req = this.pool.request().input('docNum', mssql.Int, docNum);

      // OPDN = Goods Receipt PO (Recepción de mercancía contra OC)
      const cabResult = await req.query(
        `SELECT TOP 1 DocEntry, DocNum, DocDate FROM [${db}].dbo.OPDN WHERE DocNum = @docNum`,
      );

      if (!cabResult.recordset.length) return null;

      const cab = cabResult.recordset[0];
      const req2 = this.pool.request().input('docEntry', mssql.Int, cab.DocEntry);

      // PDN1 = líneas de Goods Receipt PO
      const linResult = await req2.query(
        `SELECT LineNum, ItemCode, Dscription, Quantity, WhsCode, UomCode
         FROM [${db}].dbo.PDN1 WHERE DocEntry = @docEntry ORDER BY LineNum`,
      );

      const req3 = this.pool.request().input('docEntry2', mssql.Int, cab.DocEntry);
      // BaseType 20 = Goods Receipt PO (OPDN)
      const lotResult = await req3.query(
        `SELECT BaseLinNum, DistNumber FROM [${db}].dbo.IBT1
         WHERE BaseType = 20 AND BaseEntry = @docEntry2`,
      );

      const lotesPorLinea: Record<number, string[]> = {};
      for (const lot of lotResult.recordset) {
        if (!lotesPorLinea[lot.BaseLinNum]) lotesPorLinea[lot.BaseLinNum] = [];
        lotesPorLinea[lot.BaseLinNum].push(lot.DistNumber);
      }

      const lineas: LineaEntradaSap[] = linResult.recordset.map((r) => ({
        lineNum: r.LineNum,
        itemCode: r.ItemCode,
        descripcion: r.Dscription,
        cantidad: parseFloat(r.Quantity),
        whsCode: r.WhsCode,
        uomCode: r.UomCode,
        lotes: lotesPorLinea[r.LineNum] ?? [],
      }));

      return { docEntry: cab.DocEntry, docNum: cab.DocNum, docDate: cab.DocDate, lineas };
    } catch (err) {
      this.logger.error(`Error leyendo SAP entrada DocNum ${docNum}: ${err.message}`);
      throw err;
    }
  }
}
