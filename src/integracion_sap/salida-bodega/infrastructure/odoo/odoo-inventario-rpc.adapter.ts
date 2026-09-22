import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { IOdooInventarioPort, CrearPickingDto, ResultadoPicking } from '../../application/ports/odoo-inventario.port';
import { OdooCredencialesService } from '../../../odoo-credenciales.service';

@Injectable()
export class OdooInventarioRpcAdapter implements IOdooInventarioPort {
  private readonly logger = new Logger(OdooInventarioRpcAdapter.name);
  private uid: number | null = null;

  private cachedCreds: any = null;
  private credsCachedAt = 0;
  private readonly CREDS_TTL_MS = 5 * 60 * 1000;

  constructor(private readonly credenciales: OdooCredencialesService) {}

  private async getCreds() {
    if (this.cachedCreds && Date.now() - this.credsCachedAt < this.CREDS_TTL_MS) {
      return this.cachedCreds;
    }
    this.cachedCreds = await this.credenciales.getActiva();
    this.credsCachedAt = Date.now();
    return this.cachedCreds;
  }

  private async rpc(method: string, params: any): Promise<any> {
    const creds = await this.getCreds();
    const res = await axios.post(
      `${creds.url}/jsonrpc`,
      { jsonrpc: '2.0', method: 'call', params },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 },
    );
    if (res.data.error) throw new Error(JSON.stringify(res.data.error));
    return res.data.result;
  }

  private async getUid(): Promise<number> {
    if (this.uid) return this.uid;
    const creds = await this.getCreds();
    this.uid = await this.rpc('call', {
      service: 'common',
      method: 'authenticate',
      args: [creds.db, creds.user, creds.password, {}],
    });
    if (!this.uid) throw new Error('Autenticación Odoo fallida — verifica las credenciales en el panel admin');
    return this.uid;
  }

  private async execute(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    const uid = await this.getUid();
    const creds = await this.getCreds();
    return this.rpc('call', {
      service: 'object',
      method: 'execute_kw',
      args: [creds.db, uid, creds.password, model, method, args, kwargs],
    });
  }

  async buscarProductoPorCodigo(_empresaCodigo: string, itemCode: string): Promise<number | null> {
    try {
      const ids = await this.execute('product.product', 'search', [[['default_code', '=', itemCode]]], { limit: 1 });
      return ids?.[0] ?? null;
    } catch (err) {
      this.logger.warn(`Error buscando producto ${itemCode}: ${err.message}`);
      return null;
    }
  }

  async crearYValidarPicking(dto: CrearPickingDto): Promise<ResultadoPicking> {
    const existentes = await this.execute('stock.picking', 'search_read', [[['origin', '=', dto.origin]]], {
      fields: ['id', 'state', 'origin'],
      limit: 1,
    });

    if (existentes?.length) {
      const p = existentes[0];
      if (p.state === 'done') {
        return { tipo: 'ya_existe', pickingId: p.id, origin: p.origin };
      }
    }

    const pickingId = await this.execute('stock.picking', 'create', [{
      origin: dto.origin,
      picking_type_id: dto.pickingTypeId,
      location_id: dto.locationId,
      location_dest_id: dto.locationDestId,
    }]);

    for (const linea of dto.lineas) {
      await this.execute('stock.move', 'create', [{
        picking_id: pickingId,
        product_id: linea.productId,
        product_uom_qty: linea.cantidad,
        product_uom: linea.uomId ?? 1,
        name: `Línea SAP`,
        location_id: dto.locationId,
        location_dest_id: dto.locationDestId,
      }]);
    }

    await this.execute('stock.picking', 'action_confirm', [[pickingId]]);
    await this.execute('stock.picking', 'action_assign', [[pickingId]]);

    const moves = await this.execute('stock.move', 'search_read', [[['picking_id', '=', pickingId]]], {
      fields: ['id', 'state', 'product_id'],
    });

    const noAsignados = moves?.filter((m: any) => m.state !== 'assigned') ?? [];
    if (noAsignados.length > 0) {
      const nombres = noAsignados.map((m: any) => m.product_id?.[1] ?? m.id);
      return { tipo: 'stock_insuficiente', pickingId, movesNoAsignados: nombres };
    }

    const moveLines = await this.execute('stock.move.line', 'search_read', [[['picking_id', '=', pickingId]]], {
      fields: ['id'],
    });
    if (moveLines?.length) {
      await this.execute('stock.move.line', 'write', [moveLines.map((ml: any) => ml.id), { picked: true }]);
    }

    await this.execute('stock.picking', 'button_validate', [[pickingId]], {
      context: { skip_backorder: true },
    });

    return { tipo: 'ok', pickingId, origin: dto.origin };
  }
}
