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
var OdooInventarioRpcAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdooInventarioRpcAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
let OdooInventarioRpcAdapter = OdooInventarioRpcAdapter_1 = class OdooInventarioRpcAdapter {
    constructor(cfg) {
        this.cfg = cfg;
        this.logger = new common_1.Logger(OdooInventarioRpcAdapter_1.name);
        this.uid = null;
    }
    get baseUrl() {
        return this.cfg.get('ODOO_URL', 'http://localhost:8069');
    }
    async rpc(method, params) {
        const res = await axios_1.default.post(`${this.baseUrl}/jsonrpc`, { jsonrpc: '2.0', method: 'call', params }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
        if (res.data.error)
            throw new Error(JSON.stringify(res.data.error));
        return res.data.result;
    }
    async getUid() {
        if (this.uid)
            return this.uid;
        this.uid = await this.rpc('call', {
            service: 'common',
            method: 'authenticate',
            args: [
                this.cfg.get('ODOO_DB'),
                this.cfg.get('ODOO_USER'),
                this.cfg.get('ODOO_PASSWORD'),
                {},
            ],
        });
        if (!this.uid)
            throw new Error('Autenticación Odoo fallida');
        return this.uid;
    }
    async execute(model, method, args, kwargs = {}) {
        const uid = await this.getUid();
        return this.rpc('call', {
            service: 'object',
            method: 'execute_kw',
            args: [
                this.cfg.get('ODOO_DB'),
                uid,
                this.cfg.get('ODOO_PASSWORD'),
                model,
                method,
                args,
                kwargs,
            ],
        });
    }
    async buscarProductoPorCodigo(_empresaCodigo, itemCode) {
        try {
            const ids = await this.execute('product.product', 'search', [[['default_code', '=', itemCode]]], { limit: 1 });
            return ids?.[0] ?? null;
        }
        catch (err) {
            this.logger.warn(`Error buscando producto ${itemCode}: ${err.message}`);
            return null;
        }
    }
    async crearYValidarPicking(dto) {
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
        const noAsignados = moves?.filter((m) => m.state !== 'assigned') ?? [];
        if (noAsignados.length > 0) {
            const nombres = noAsignados.map((m) => m.product_id?.[1] ?? m.id);
            return { tipo: 'stock_insuficiente', pickingId, movesNoAsignados: nombres };
        }
        const moveLines = await this.execute('stock.move.line', 'search_read', [[['picking_id', '=', pickingId]]], {
            fields: ['id'],
        });
        if (moveLines?.length) {
            await this.execute('stock.move.line', 'write', [moveLines.map((ml) => ml.id), { picked: true }]);
        }
        await this.execute('stock.picking', 'button_validate', [[pickingId]], {
            context: { skip_backorder: true },
        });
        return { tipo: 'ok', pickingId, origin: dto.origin };
    }
};
exports.OdooInventarioRpcAdapter = OdooInventarioRpcAdapter;
exports.OdooInventarioRpcAdapter = OdooInventarioRpcAdapter = OdooInventarioRpcAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OdooInventarioRpcAdapter);
//# sourceMappingURL=odoo-inventario-rpc.adapter.js.map