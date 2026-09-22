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
var OdooCatalogoRpcAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdooCatalogoRpcAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
let OdooCatalogoRpcAdapter = OdooCatalogoRpcAdapter_1 = class OdooCatalogoRpcAdapter {
    constructor(cfg) {
        this.cfg = cfg;
        this.logger = new common_1.Logger(OdooCatalogoRpcAdapter_1.name);
        this.uid = null;
        this.campoTipo = null;
        this._categoriaRaizId = null;
        this.cacheCategoria = new Map();
        this.cacheUbicacion = new Map();
        this.cacheProductos = new Map();
    }
    get baseUrl() { return this.cfg.get('ODOO_URL', 'http://localhost:8069'); }
    async rpc(params) {
        const res = await axios_1.default.post(`${this.baseUrl}/jsonrpc`, { jsonrpc: '2.0', method: 'call', params }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
        if (res.data.error)
            throw new Error(JSON.stringify(res.data.error));
        return res.data.result;
    }
    async getUid() {
        if (this.uid)
            return this.uid;
        this.uid = await this.rpc({
            service: 'common', method: 'authenticate',
            args: [this.cfg.get('ODOO_DB'), this.cfg.get('ODOO_USER'), this.cfg.get('ODOO_PASSWORD'), {}],
        });
        if (!this.uid)
            throw new Error('Autenticación Odoo fallida');
        return this.uid;
    }
    async execute(model, method, args, kwargs = {}) {
        const uid = await this.getUid();
        return this.rpc({
            service: 'object', method: 'execute_kw',
            args: [this.cfg.get('ODOO_DB'), uid, this.cfg.get('ODOO_PASSWORD'), model, method, args, kwargs],
        });
    }
    async getCampoTipo() {
        if (this.campoTipo)
            return this.campoTipo;
        const campos = await this.execute('product.template', 'fields_get', [['detailed_type', 'type', 'is_storable']], { attributes: ['selection', 'type'] });
        if (campos['detailed_type']) {
            this.logger.log('Odoo campo tipo: detailed_type=product (Odoo 16/17)');
            this.campoTipo = ['detailed_type', 'product'];
        }
        else if (campos['is_storable']) {
            this.logger.log('Odoo campo tipo: is_storable=true (Odoo 18+)');
            this.campoTipo = ['is_storable', true];
        }
        else {
            const sel = (campos['type']?.selection ?? []).map((v) => v[0]);
            if (sel.includes('product')) {
                this.logger.log('Odoo campo tipo: type=product (Odoo ≤15)');
                this.campoTipo = ['type', 'product'];
            }
            else {
                this.logger.warn('No se detectó campo almacenable, usando type=consu');
                this.campoTipo = ['type', 'consu'];
            }
        }
        return this.campoTipo;
    }
    async getCategoriaRaizId() {
        if (this._categoriaRaizId)
            return this._categoriaRaizId;
        const result = await this.execute('product.category', 'search_read', [[['name', '=', 'All'], ['parent_id', '=', false]]], { fields: ['id'], limit: 1 });
        this._categoriaRaizId = result?.length
            ? result[0].id
            : await this.execute('product.category', 'create', [{ name: 'All' }]);
        return this._categoriaRaizId;
    }
    async resolverCategoria(nombreCategoria) {
        const nombre = (nombreCategoria || 'Sin categoría').trim();
        if (this.cacheCategoria.has(nombre))
            return this.cacheCategoria.get(nombre);
        const raizId = await this.getCategoriaRaizId();
        const existing = await this.execute('product.category', 'search_read', [[['name', '=', nombre], ['parent_id', '=', raizId]]], { fields: ['id'], limit: 1 });
        const catId = existing?.length
            ? existing[0].id
            : await this.execute('product.category', 'create', [{ name: nombre, parent_id: raizId }]);
        if (!existing?.length)
            this.logger.log(`Categoría creada en Odoo: '${nombre}' (id=${catId})`);
        this.cacheCategoria.set(nombre, catId);
        return catId;
    }
    async upsertProducto(dto) {
        if (this.cacheProductos.has(dto.itemCode)) {
            const cached = this.cacheProductos.get(dto.itemCode);
            await this._actualizarTemplate(cached.productTemplateId, dto);
            return { tipo: 'actualizado', ...cached };
        }
        const [campoTipo, valorTipo] = await this.getCampoTipo();
        const catId = dto.categoriaNombre ? await this.resolverCategoria(dto.categoriaNombre) : undefined;
        const existing = await this.execute('product.template', 'search_read', [[['default_code', '=', dto.itemCode]]], { fields: ['id'], limit: 1 });
        const vals = {
            name: dto.nombre,
            default_code: dto.itemCode,
            purchase_ok: true,
            sale_ok: false,
            active: true,
            [campoTipo]: valorTipo,
        };
        if (catId)
            vals.categ_id = catId;
        let productTemplateId;
        let tipoResultado;
        if (existing?.length) {
            productTemplateId = existing[0].id;
            await this.execute('product.template', 'write', [[productTemplateId], vals]);
            tipoResultado = 'actualizado';
        }
        else {
            productTemplateId = await this.execute('product.template', 'create', [vals]);
            tipoResultado = 'creado';
            this.logger.log(`Producto creado en Odoo: ${dto.itemCode} '${dto.nombre}' (template=${productTemplateId})`);
        }
        const variante = await this.execute('product.product', 'search_read', [[['product_tmpl_id', '=', productTemplateId]]], { fields: ['id'], limit: 1 });
        const productId = variante?.[0]?.id ?? productTemplateId;
        this.cacheProductos.set(dto.itemCode, { productTemplateId, productId });
        return { tipo: tipoResultado, productTemplateId, productId };
    }
    async _actualizarTemplate(productTemplateId, dto) {
        const catId = dto.categoriaNombre ? await this.resolverCategoria(dto.categoriaNombre) : undefined;
        const vals = { name: dto.nombre, active: true };
        if (catId)
            vals.categ_id = catId;
        await this.execute('product.template', 'write', [[productTemplateId], vals]);
    }
    async ajustarInventario(dto) {
        const quants = await this.execute('stock.quant', 'search_read', [[['product_id', '=', dto.productId], ['location_id', '=', dto.locationId]]], { fields: ['id', 'quantity'], limit: 1 });
        const cantidadActual = quants?.[0]?.quantity ?? 0;
        if (Math.abs(cantidadActual - dto.cantidadSap) < 0.001)
            return 'sin_cambio';
        if (quants?.length) {
            await this.execute('stock.quant', 'write', [[quants[0].id], { inventory_quantity: dto.cantidadSap }]);
            await this.execute('stock.quant', 'action_apply_inventory', [[quants[0].id]]);
        }
        else {
            const newQuantId = await this.execute('stock.quant', 'create', [{
                    product_id: dto.productId,
                    location_id: dto.locationId,
                    inventory_quantity: dto.cantidadSap,
                }]);
            await this.execute('stock.quant', 'action_apply_inventory', [[newQuantId]]);
        }
        return 'ajustado';
    }
    async buscarUbicacion(whsCode) {
        if (this.cacheUbicacion.has(whsCode))
            return this.cacheUbicacion.get(whsCode);
        const result = await this.execute('stock.location', 'search_read', [[['usage', '=', 'internal'], ['complete_name', 'ilike', 'WH/Stock'], ['active', '=', true]]], { fields: ['id', 'complete_name'], limit: 1 });
        const locationId = result?.[0]?.id ?? null;
        this.cacheUbicacion.set(whsCode, locationId);
        if (locationId)
            this.logger.log(`WhsCode ${whsCode} → location ${result[0].complete_name} (${locationId})`);
        return locationId;
    }
};
exports.OdooCatalogoRpcAdapter = OdooCatalogoRpcAdapter;
exports.OdooCatalogoRpcAdapter = OdooCatalogoRpcAdapter = OdooCatalogoRpcAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OdooCatalogoRpcAdapter);
//# sourceMappingURL=odoo-catalogo-rpc.adapter.js.map