import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { OdooCredencialesService } from '../../../odoo-credenciales.service';
import {
  IOdooCatalogoPort,
  ItemLote,
  ResultadoLote,
  UpsertProductoDto,
  ResultadoUpsert,
  AjusteInventarioDto,
  UbicacionOdoo,
} from '../../application/ports/odoo-catalogo.port';

type CampoTipo = [string, string | boolean];

@Injectable()
export class OdooCatalogoRpcAdapter implements IOdooCatalogoPort {
  private readonly logger = new Logger(OdooCatalogoRpcAdapter.name);
  private uid: number | null = null;
  private campoTipo: CampoTipo | null = null;
  private _categoriaRaizId: number | null = null;
  private readonly cacheCategoria = new Map<string, number>();
  private readonly cacheUbicacion = new Map<string, number | null>();
  private readonly cacheProductos = new Map<string, { productTemplateId: number; productId: number }>();
  private _ubicacionesCache: UbicacionOdoo[] | null = null;

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

  private async rpc(params: any): Promise<any> {
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
    this.uid = await this.rpc({
      service: 'common', method: 'authenticate',
      args: [creds.db, creds.user, creds.password, {}],
    });
    if (!this.uid) throw new Error('Autenticación Odoo fallida — verifica las credenciales en el panel admin');
    return this.uid;
  }

  private async execute(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    const uid = await this.getUid();
    const creds = await this.getCreds();
    return this.rpc({
      service: 'object', method: 'execute_kw',
      args: [creds.db, uid, creds.password, model, method, args, kwargs],
    });
  }

  private async getCampoTipo(): Promise<CampoTipo> {
    if (this.campoTipo) return this.campoTipo;

    const campos = await this.execute('product.template', 'fields_get',
      [['detailed_type', 'type', 'is_storable']],
      { attributes: ['selection', 'type', 'store'] },
    );

    // Orden importante: is_storable primero (Odoo 18 almacenable),
    // luego detailed_type (Odoo 16/17), luego type legacy.
    // En Odoo 18, detailed_type puede existir como campo compute (store=false),
    // no se puede escribir directamente; is_storable sí es escribible.
    const isStorableStorable = campos['is_storable']?.store !== false;
    if (campos['is_storable'] && isStorableStorable) {
      this.logger.log('Odoo campo tipo: is_storable=true (Odoo 18+)');
      this.campoTipo = ['is_storable', true];
    } else if (campos['detailed_type'] && campos['detailed_type']?.store !== false) {
      this.logger.log('Odoo campo tipo: detailed_type=product (Odoo 16/17)');
      this.campoTipo = ['detailed_type', 'product'];
    } else {
      const sel = ((campos['type']?.selection ?? []) as any[][]).map((v) => v[0]);
      if (sel.includes('product')) {
        this.logger.log('Odoo campo tipo: type=product (Odoo ≤15)');
        this.campoTipo = ['type', 'product'];
      } else if (campos['is_storable']) {
        // is_storable existe pero store=false — intentamos de todos modos (comportamiento Odoo 18 varía por versión)
        this.logger.log('Odoo campo tipo: is_storable=true (fallback Odoo 18)');
        this.campoTipo = ['is_storable', true];
      } else {
        this.logger.warn('No se detectó campo almacenable — los productos se crearán como storable via type');
        this.campoTipo = ['type', 'product'];
      }
    }
    return this.campoTipo;
  }

  private async getCategoriaRaizId(): Promise<number> {
    if (this._categoriaRaizId) return this._categoriaRaizId;
    const result = await this.execute('product.category', 'search_read',
      [[['name', '=', 'All'], ['parent_id', '=', false]]],
      { fields: ['id'], limit: 1 },
    );
    this._categoriaRaizId = result?.length
      ? result[0].id
      : await this.execute('product.category', 'create', [{ name: 'All' }]);
    return this._categoriaRaizId;
  }

  async resolverCategoria(nombreCategoria: string): Promise<number> {
    const nombre = (nombreCategoria || 'Sin categoría').trim();
    if (this.cacheCategoria.has(nombre)) return this.cacheCategoria.get(nombre)!;

    const raizId = await this.getCategoriaRaizId();
    const existing = await this.execute('product.category', 'search_read',
      [[['name', '=', nombre], ['parent_id', '=', raizId]]],
      { fields: ['id'], limit: 1 },
    );

    const catId: number = existing?.length
      ? existing[0].id
      : await this.execute('product.category', 'create', [{ name: nombre, parent_id: raizId }]);

    if (!existing?.length) this.logger.log(`Categoría creada en Odoo: '${nombre}' (id=${catId})`);
    this.cacheCategoria.set(nombre, catId);
    return catId;
  }

  async upsertProducto(dto: UpsertProductoDto): Promise<ResultadoUpsert> {
    if (this.cacheProductos.has(dto.itemCode)) {
      const cached = this.cacheProductos.get(dto.itemCode)!;
      await this._actualizarTemplate(cached.productTemplateId, dto);
      return { tipo: 'actualizado', ...cached };
    }

    const [campoTipo, valorTipo] = await this.getCampoTipo();
    const catId = dto.categoriaNombre ? await this.resolverCategoria(dto.categoriaNombre) : undefined;

    const existing = await this.execute('product.template', 'search_read',
      [[['default_code', '=', dto.itemCode]]],
      { fields: ['id'], limit: 1 },
    );

    const vals: Record<string, any> = {
      name: dto.nombre,
      default_code: dto.itemCode,
      purchase_ok: true,
      sale_ok: false,
      active: true,
      [campoTipo]: valorTipo,
    };
    if (catId) vals.categ_id = catId;
    if (dto.precioUnitario != null) vals.standard_price = dto.precioUnitario;

    let productTemplateId: number;
    let tipoResultado: 'creado' | 'actualizado';

    if (existing?.length) {
      productTemplateId = existing[0].id;
      await this.execute('product.template', 'write', [[productTemplateId], vals]);
      tipoResultado = 'actualizado';
    } else {
      productTemplateId = await this.execute('product.template', 'create', [vals]);
      tipoResultado = 'creado';
      this.logger.log(`Producto creado en Odoo: ${dto.itemCode} '${dto.nombre}' (template=${productTemplateId})`);
    }

    const variante = await this.execute('product.product', 'search_read',
      [[['product_tmpl_id', '=', productTemplateId], ['active', 'in', [true, false]]]],
      { fields: ['id'], limit: 1 },
    );
    if (!variante?.length) {
      throw new Error(`No se encontró product.product para template id=${productTemplateId} (${dto.itemCode}). Odoo puede no haber creado la variante aún.`);
    }
    const productId: number = variante[0].id;

    this.cacheProductos.set(dto.itemCode, { productTemplateId, productId });
    return { tipo: tipoResultado, productTemplateId, productId };
  }

  private async _actualizarTemplate(productTemplateId: number, dto: UpsertProductoDto): Promise<void> {
    const catId = dto.categoriaNombre ? await this.resolverCategoria(dto.categoriaNombre) : undefined;
    const vals: Record<string, any> = { name: dto.nombre, active: true };
    if (catId) vals.categ_id = catId;
    if (dto.precioUnitario != null) vals.standard_price = dto.precioUnitario;
    await this.execute('product.template', 'write', [[productTemplateId], vals]);
  }

  async ajustarInventario(dto: AjusteInventarioDto): Promise<'ajustado' | 'sin_cambio'> {
    const quants = await this.execute('stock.quant', 'search_read',
      [[
        ['product_id', '=', dto.productId],
        ['location_id', '=', dto.locationId],
        ['location_id.usage', '=', 'internal'],
      ]],
      { fields: ['id', 'quantity'], limit: 1 },
    );

    const cantidadActual: number = quants?.[0]?.quantity ?? 0;
    if (Math.abs(cantidadActual - dto.cantidadSap) < 0.001) {
      this.logger.debug(`sin_cambio product_id=${dto.productId}: actual=${cantidadActual} == sap=${dto.cantidadSap}`);
      return 'sin_cambio';
    }

    this.logger.debug(`ajustando product_id=${dto.productId}: ${cantidadActual} → ${dto.cantidadSap}`);

    if (quants?.length) {
      await this.execute('stock.quant', 'write', [[quants[0].id], { inventory_quantity: dto.cantidadSap, inventory_quantity_set: true }]);
      await this.execute('stock.quant', 'action_apply_inventory', [[quants[0].id]]);
    } else {
      const newQuantId: number = await this.execute('stock.quant', 'create', [{
        product_id: dto.productId,
        location_id: dto.locationId,
        inventory_quantity: dto.cantidadSap,
        inventory_quantity_set: true,
      }]);
      if (!newQuantId) throw new Error(`Odoo no creó el quant para product_id=${dto.productId}`);
      await this.execute('stock.quant', 'action_apply_inventory', [[newQuantId]]);
    }

    return 'ajustado';
  }

  async procesarLoteInventario(items: ItemLote[], onProgreso?: (n: number) => void): Promise<ResultadoLote> {
    const total = items.length;
    const report = (n: number) => onProgreso?.(Math.min(Math.floor(n), total));
    if (total === 0) return { ajustados: 0, sinCambio: 0, errores: [] };

    const [campoTipo, valorTipo] = await this.getCampoTipo();
    report(total * 0.05);

    // ── 1. Batch fetch existing templates ──────────────────────────────────
    const itemCodes = items.map(i => i.itemCode);
    const existingTemplates: Array<{ id: number; default_code: string }> =
      (await this.execute('product.template', 'search_read',
        [[['default_code', 'in', itemCodes]]],
        { fields: ['id', 'default_code'], limit: 0 },
      )) ?? [];

    const templateByCode = new Map<string, number>(
      existingTemplates.map(t => [t.default_code, t.id]),
    );
    report(total * 0.15);

    // ── 2. Create missing templates (parallel chunks of 20) ────────────────
    const toCreate = items.filter(i => !templateByCode.has(i.itemCode));
    const CREATE_CHUNK = 20;
    for (let i = 0; i < toCreate.length; i += CREATE_CHUNK) {
      const chunk = toCreate.slice(i, i + CREATE_CHUNK);
      await Promise.all(chunk.map(async item => {
        const vals: Record<string, any> = {
          name: item.nombre,
          default_code: item.itemCode,
          purchase_ok: true,
          sale_ok: false,
          active: true,
          [campoTipo]: valorTipo,
        };
        if (item.precioUnitario != null) vals.standard_price = item.precioUnitario;
        const tmplId: number = await this.execute('product.template', 'create', [vals]);
        templateByCode.set(item.itemCode, tmplId);
        this.logger.log(`Producto creado en Odoo: ${item.itemCode} '${item.nombre}' (template=${tmplId})`);
      }));
      report(total * 0.15 + (i / Math.max(toCreate.length, 1)) * total * 0.1);
    }

    // ── 3. Update existing templates (name / price) in parallel ───────────
    const toUpdate = items.filter(i => existingTemplates.some(t => t.default_code === i.itemCode));
    const UPDATE_CHUNK = 20;
    for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK) {
      const chunk = toUpdate.slice(i, i + UPDATE_CHUNK);
      await Promise.all(chunk.map(item => {
        const vals: Record<string, any> = { name: item.nombre };
        if (item.precioUnitario != null) vals.standard_price = item.precioUnitario;
        return this.execute('product.template', 'write', [[templateByCode.get(item.itemCode)!], vals]);
      }));
    }
    report(total * 0.35);

    // ── 4. Batch fetch all variants ────────────────────────────────────────
    const allTemplateIds = [...templateByCode.values()];
    const variants: Array<{ id: number; product_tmpl_id: [number, string] | number }> =
      (await this.execute('product.product', 'search_read',
        [[['product_tmpl_id', 'in', allTemplateIds], ['active', 'in', [true, false]]]],
        { fields: ['id', 'product_tmpl_id'], limit: 0 },
      )) ?? [];

    const variantByTemplateId = new Map<number, number>();
    for (const v of variants) {
      const tmplId = Array.isArray(v.product_tmpl_id) ? v.product_tmpl_id[0] : v.product_tmpl_id;
      if (!variantByTemplateId.has(tmplId)) variantByTemplateId.set(tmplId, v.id);
    }
    report(total * 0.5);

    // ── 5. Batch fetch ALL internal quants for these products (no location filter) ──
    // We fetch across ALL internal locations so we can zero-out stale quants that
    // ended up at a different location from a previous run.
    const targetLocationIds = new Set(items.map(i => i.locationId));
    const productIds = [...variantByTemplateId.values()];

    const allQuants: Array<{
      id: number;
      product_id: [number, string] | number;
      location_id: [number, string] | number;
      quantity: number;
    }> = productIds.length > 0
      ? (await this.execute('stock.quant', 'search_read',
          [[
            ['product_id', 'in', productIds],
            ['location_id.usage', '=', 'internal'],
          ]],
          { fields: ['id', 'product_id', 'location_id', 'quantity'], limit: 0 },
        )) ?? []
      : [];

    // Map keyed by `productId:locationId` — covers ALL internal locations
    const quantMap = new Map<string, { id: number; quantity: number }>();
    // Track quants at non-target locations that have qty > 0 (stale from prior runs)
    const staleQuants: number[] = [];
    for (const q of allQuants) {
      const pId = Array.isArray(q.product_id) ? q.product_id[0] : q.product_id;
      const lId = Array.isArray(q.location_id) ? q.location_id[0] : q.location_id;
      quantMap.set(`${pId}:${lId}`, { id: q.id, quantity: q.quantity });
      if (!targetLocationIds.has(lId) && q.quantity > 0.001) {
        staleQuants.push(q.id);
      }
    }
    report(total * 0.6);

    // ── 6. Classify ────────────────────────────────────────────────────────
    const quantsToUpdate: Array<{ id: number; qty: number }> = [];
    const quantsToCreate: Array<{ product_id: number; location_id: number; inventory_quantity: number; inventory_quantity_set: boolean }> = [];
    const ajustados: string[] = [];
    const sinCambio: string[] = [];
    const errores: Array<{ itemCode: string; error: string }> = [];

    for (const item of items) {
      const templateId = templateByCode.get(item.itemCode);
      if (!templateId) { errores.push({ itemCode: item.itemCode, error: 'Template no resuelto' }); continue; }
      const productId = variantByTemplateId.get(templateId);
      if (!productId) {
        errores.push({ itemCode: item.itemCode, error: `Variante no encontrada (template=${templateId})` });
        continue;
      }
      const existing = quantMap.get(`${productId}:${item.locationId}`);
      if (existing) {
        if (Math.abs(existing.quantity - item.cantidadSap) < 0.001) {
          sinCambio.push(item.itemCode);
        } else {
          quantsToUpdate.push({ id: existing.id, qty: item.cantidadSap });
          ajustados.push(item.itemCode);
        }
      } else {
        // No quant at this location → on-hand is 0 here.
        // Only create a quant if we need a non-zero quantity.
        if (Math.abs(item.cantidadSap) < 0.001) {
          sinCambio.push(item.itemCode);
        } else {
          quantsToCreate.push({ product_id: productId, location_id: item.locationId, inventory_quantity: item.cantidadSap, inventory_quantity_set: true });
          ajustados.push(item.itemCode);
        }
      }
    }

    if (staleQuants.length > 0) {
      this.logger.log(`Zeroing ${staleQuants.length} stale quants at non-target locations`);
    }
    report(total * 0.65);

    // ── 7. Write inventory_quantity + inventory_quantity_set ──────────────────
    // inventory_quantity_set must be explicitly True so action_apply_inventory
    // processes the quant even when the target qty is 0.
    const allQuantIdsToApply: number[] = [];
    const allToWrite = [
      ...quantsToUpdate.map(q => ({ id: q.id, qty: q.qty })),
      ...staleQuants.map(id => ({ id, qty: 0 })),
    ];
    const WRITE_CHUNK = 10;
    for (let i = 0; i < allToWrite.length; i += WRITE_CHUNK) {
      const chunk = allToWrite.slice(i, i + WRITE_CHUNK);
      await Promise.all(chunk.map(q =>
        this.execute('stock.quant', 'write', [[q.id], { inventory_quantity: q.qty, inventory_quantity_set: true }]),
      ));
      allQuantIdsToApply.push(...chunk.map(q => q.id));
      report(total * 0.65 + (i / Math.max(allToWrite.length, 1)) * total * 0.2);
    }

    // ── 8. Batch create new quants (only non-zero quantities reach here) ───
    if (quantsToCreate.length > 0) {
      const newIds: number | number[] = await this.execute('stock.quant', 'create', [quantsToCreate]);
      allQuantIdsToApply.push(...(Array.isArray(newIds) ? newIds : [newIds]));
    }
    report(total * 0.9);

    // ── 9. Apply inventory — ONE call for all changed quants ───────────────
    if (allQuantIdsToApply.length > 0) {
      await this.execute('stock.quant', 'action_apply_inventory', [allQuantIdsToApply]);
    }
    report(total);

    this.logger.log(
      `procesarLoteInventario completado: ${ajustados.length} ajustados, ` +
      `${sinCambio.length} sin cambio, ${errores.length} errores`,
    );
    return { ajustados: ajustados.length, sinCambio: sinCambio.length, errores };
  }

  async buscarUbicacion(whsCode: string): Promise<number | null> {
    if (this.cacheUbicacion.has(whsCode)) return this.cacheUbicacion.get(whsCode)!;

    const result = await this.execute('stock.location', 'search_read',
      [[['usage', '=', 'internal'], ['complete_name', 'ilike', 'WH/Stock'], ['active', '=', true]]],
      { fields: ['id', 'complete_name'], limit: 1 },
    );

    const locationId: number | null = result?.[0]?.id ?? null;
    this.cacheUbicacion.set(whsCode, locationId);
    if (locationId) this.logger.log(`WhsCode ${whsCode} → location ${result[0].complete_name} (${locationId})`);
    return locationId;
  }

  async listarUbicacionesInternas(): Promise<UbicacionOdoo[]> {
    if (this._ubicacionesCache) return this._ubicacionesCache;
    const result = await this.execute(
      'stock.location',
      'search_read',
      [[['usage', '=', 'internal'], ['active', '=', true]]],
      { fields: ['id', 'complete_name'], order: 'complete_name asc', limit: 200 },
    );
    this._ubicacionesCache = (result ?? []).map((r: any) => ({ id: r.id, nombre: r.complete_name }));
    return this._ubicacionesCache;
  }
}
