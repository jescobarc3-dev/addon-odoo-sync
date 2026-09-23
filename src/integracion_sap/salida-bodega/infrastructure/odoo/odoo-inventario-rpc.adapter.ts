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
      { headers: { 'Content-Type': 'application/json' }, timeout: 90000 },
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
      const moveVals: Record<string, any> = {
        picking_id: pickingId,
        product_id: linea.productId,
        product_uom_qty: linea.cantidad,
        product_uom: linea.uomId ?? 1,
        name: `Línea SAP`,
        location_id: dto.locationId,
        location_dest_id: dto.locationDestId,
      };
      if (linea.precioUnitario != null && linea.precioUnitario > 0) {
        moveVals.price_unit = linea.precioUnitario;
      }
      await this.execute('stock.move', 'create', [moveVals]);
    }

    await this.execute('stock.picking', 'action_confirm', [[pickingId]]);
    await this.execute('stock.picking', 'action_assign', [[pickingId]]);

    // Obtener todos los moves con su estado y cantidad demandada
    const moves = await this.execute('stock.move', 'search_read', [[['picking_id', '=', pickingId]]], {
      fields: ['id', 'state', 'product_id', 'product_uom_qty', 'product_uom', 'location_id', 'location_dest_id'],
    });

    const noAsignados: string[] = [];

    for (const move of (moves ?? [])) {
      const existingLines = await this.execute('stock.move.line', 'search_read',
        [[['move_id', '=', move.id]]],
        { fields: ['id', 'quantity'] },
      );

      if (move.state === 'assigned' && existingLines?.length) {
        // Stock reservado — en Odoo 17/18 'quantity' ya contiene la cantidad reservada
        const qty = existingLines[0].quantity || move.product_uom_qty;
        await this.execute('stock.move.line', 'write',
          [existingLines.map((ml: any) => ml.id), { quantity: qty, picked: true }],
        );
      } else {
        // Sin stock reservado — immediate transfer: forzar cantidad demandada
        const locationId = Array.isArray(move.location_id) ? move.location_id[0] : move.location_id;
        const locationDestId = Array.isArray(move.location_dest_id) ? move.location_dest_id[0] : move.location_dest_id;
        const productId = Array.isArray(move.product_id) ? move.product_id[0] : move.product_id;
        const uomId = Array.isArray(move.product_uom) ? move.product_uom[0] : (move.product_uom ?? 1);

        if (existingLines?.length) {
          await this.execute('stock.move.line', 'write',
            [existingLines.map((ml: any) => ml.id), { quantity: move.product_uom_qty, picked: true }],
          );
        } else {
          await this.execute('stock.move.line', 'create', [{
            move_id: move.id,
            picking_id: pickingId,
            product_id: productId,
            product_uom_id: uomId,
            location_id: locationId,
            location_dest_id: locationDestId,
            quantity: move.product_uom_qty,
            picked: true,
          }]);
        }
        noAsignados.push(Array.isArray(move.product_id) ? move.product_id[1] : String(move.product_id));
      }
    }

    await this.execute('stock.picking', 'button_validate', [[pickingId]], {
      context: { skip_backorder: true },
    });

    if (noAsignados.length > 0) {
      this.logger.warn(`Picking ${pickingId}: ${noAsignados.length} moves sin stock — validado por immediate transfer`);
      return { tipo: 'ok_sin_stock', pickingId, origin: dto.origin, movesNoAsignados: noAsignados };
    }

    return { tipo: 'ok', pickingId, origin: dto.origin };
  }
}
