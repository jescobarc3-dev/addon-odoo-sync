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
exports.RegistroSincronizacionOrmEntity = void 0;
const typeorm_1 = require("typeorm");
let RegistroSincronizacionOrmEntity = class RegistroSincronizacionOrmEntity {
};
exports.RegistroSincronizacionOrmEntity = RegistroSincronizacionOrmEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RegistroSincronizacionOrmEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'empresa_codigo', length: 20 }),
    __metadata("design:type", String)
], RegistroSincronizacionOrmEntity.prototype, "empresaCodigo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sap_docnum', type: 'int' }),
    __metadata("design:type", Number)
], RegistroSincronizacionOrmEntity.prototype, "sapDocnum", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hash_pdf', length: 64 }),
    __metadata("design:type", String)
], RegistroSincronizacionOrmEntity.prototype, "hashPdf", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'documento_archivo_id', length: 36, nullable: true }),
    __metadata("design:type", String)
], RegistroSincronizacionOrmEntity.prototype, "documentoArchivoId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 40, default: 'recibido' }),
    __metadata("design:type", String)
], RegistroSincronizacionOrmEntity.prototype, "estado", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'odoo_picking_id', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], RegistroSincronizacionOrmEntity.prototype, "odooPickingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'odoo_origin', length: 60, nullable: true }),
    __metadata("design:type", String)
], RegistroSincronizacionOrmEntity.prototype, "odooOrigin", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ultimo_error', type: 'text', nullable: true }),
    __metadata("design:type", String)
], RegistroSincronizacionOrmEntity.prototype, "ultimoError", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'smallint', default: 0 }),
    __metadata("design:type", Number)
], RegistroSincronizacionOrmEntity.prototype, "intentos", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sap_doc_entry', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], RegistroSincronizacionOrmEntity.prototype, "sapDocEntry", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sap_doc_date', type: 'date', nullable: true }),
    __metadata("design:type", Date)
], RegistroSincronizacionOrmEntity.prototype, "sapDocDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], RegistroSincronizacionOrmEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], RegistroSincronizacionOrmEntity.prototype, "updatedAt", void 0);
exports.RegistroSincronizacionOrmEntity = RegistroSincronizacionOrmEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'registro_sincronizacion', schema: 'integracion_sap' }),
    (0, typeorm_1.Unique)(['empresaCodigo', 'sapDocnum']),
    (0, typeorm_1.Unique)(['hashPdf']),
    (0, typeorm_1.Index)(['estado'])
], RegistroSincronizacionOrmEntity);
//# sourceMappingURL=registro-sincronizacion.orm-entity.js.map