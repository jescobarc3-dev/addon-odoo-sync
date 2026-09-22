import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';
import { ISapCatalogoPort, ItemSap } from '../../application/ports/sap-catalogo.port';

@Injectable()
export class SapCatalogoSqlAdapter implements ISapCatalogoPort {
  private readonly logger = new Logger(SapCatalogoSqlAdapter.name);

  constructor(private readonly cfg: ConfigService) {}

  private async getPool(db: string): Promise<mssql.ConnectionPool> {
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

  private nombreBaseDatos(empresaCodigo: string): string {
    const map: Record<string, string> = {
      PT: this.cfg.get('SAP_SQL_DEFAULT_DB', 'SBODemoDB'),
    };
    return map[empresaCodigo] ?? this.cfg.get('SAP_SQL_DEFAULT_DB', 'SBODemoDB');
  }

  async obtenerCatalogoCompleto(empresaCodigo: string): Promise<ItemSap[]> {
    const db = this.nombreBaseDatos(empresaCodigo);
    let pool: mssql.ConnectionPool | null = null;

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

      const cantMap: Record<string, { whsCode: string; onHand: number }[]> = {};
      for (const row of cantResult.recordset) {
        if (!cantMap[row.ItemCode]) cantMap[row.ItemCode] = [];
        cantMap[row.ItemCode].push({ whsCode: row.WhsCode, onHand: parseFloat(row.OnHand) });
      }

      const items: ItemSap[] = itemsResult.recordset.map((row) => ({
        itemCode: row.ItemCode,
        itemName: row.ItemName,
        grupoNombre: row.GrupoNombre,
        cantidadesPorBodega: cantMap[row.ItemCode] ?? [],
      }));

      this.logger.log(`SAP [${db}]: ${items.length} items activos leídos`);
      return items;
    } catch (err) {
      this.logger.error(`Error leyendo catálogo SAP [${db}]: ${err.message}`);
      throw err;
    } finally {
      await pool?.close().catch(() => {});
    }
  }
}
