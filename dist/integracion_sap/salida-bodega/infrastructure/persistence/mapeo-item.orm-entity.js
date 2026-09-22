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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapeoBodegaOrmEntity = exports.MapeoItemOrmEntity = void 0;
const typeorm_1 = require("typeorm");
let MapeoItemOrmEntity = class MapeoItemOrmEntity {
};
exports.MapeoItemOrmEntity = MapeoItemOrmEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MapeoItemOrmEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'empresa_codigo', length: 20 }),
    __metadata("design:type", String)
], MapeoItemOrmEntity.prototype, "empresaCodigo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'item_code_sap', length: 50 }),
    __metadata("design:type", String)
], MapeoItemOrmEntity.prototype, "itemCodeSap", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'odoo_product_id', type: 'int' }),
    __metadata("design:type", Number)
], MapeoItemOrmEntity.prototype, "odooProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'factor_uom', type: 'numeric', precision: 10, scale: 4, default: 1 }),
    __metadata("design:type", Number)
], MapeoItemOrmEntity.prototype, "factorUom", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], MapeoItemOrmEntity.prototype, "activo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], MapeoItemOrmEntity.prototype, "notas", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MapeoItemOrmEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], MapeoItemOrmEntity.prototype, "updatedAt", void 0);
exports.MapeoItemOrmEntity = MapeoItemOrmEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'mapeo_item', schema: 'integracion_sap' }),
    (0, typeorm_1.Unique)(['empresaCodigo', 'itemCodeSap'])
], MapeoItemOrmEntity);
let MapeoBodegaOrmEntity = class MapeoBodegaOrmEntity {
};
exports.MapeoBodegaOrmEntity = MapeoBodegaOrmEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MapeoBodegaOrmEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'empresa_codigo', length: 20 }),
    __metadata("design:type", String)
], MapeoBodegaOrmEntity.prototype, "empresaCodigo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'whs_code_sap', length: 20 }),
    __metadata("design:type", String)
], MapeoBodegaOrmEntity.prototype, "whsCodeSap", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'odoo_location_id', type: 'int' }),
    __metadata("design:type", Number)
], MapeoBodegaOrmEntity.prototype, "odooLocationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'odoo_picking_type_id', type: 'int' }),
    __metadata("design:type", Number)
], MapeoBodegaOrmEntity.prototype, "odooPickingTypeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'odoo_location_dest_id', type: 'int' }),
    __metadata("design:type", Number)
], MapeoBodegaOrmEntity.prototype, "odooLocationDestId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], MapeoBodegaOrmEntity.prototype, "activo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], MapeoBodegaOrmEntity.prototype, "notas", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MapeoBodegaOrmEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], MapeoBodegaOrmEntity.prototype, "updatedAt", void 0);
exports.MapeoBodegaOrmEntity = MapeoBodegaOrmEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'mapeo_bodega', schema: 'integracion_sap' }),
    (0, typeorm_1.Unique)(['empresaCodigo', 'whsCodeSap'])
], MapeoBodegaOrmEntity);
//# sourceMappingURL=mapeo-item.orm-entity.js.map