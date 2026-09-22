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
exports.OdooConexionOrmEntity = void 0;
const typeorm_1 = require("typeorm");
let OdooConexionOrmEntity = class OdooConexionOrmEntity {
};
exports.OdooConexionOrmEntity = OdooConexionOrmEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OdooConexionOrmEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OdooConexionOrmEntity.prototype, "nombre", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'odoo_url' }),
    __metadata("design:type", String)
], OdooConexionOrmEntity.prototype, "odooUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'odoo_db' }),
    __metadata("design:type", String)
], OdooConexionOrmEntity.prototype, "odooDB", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'odoo_user' }),
    __metadata("design:type", String)
], OdooConexionOrmEntity.prototype, "odooUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'odoo_password_enc' }),
    __metadata("design:type", String)
], OdooConexionOrmEntity.prototype, "odooPasswordEnc", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], OdooConexionOrmEntity.prototype, "activa", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'version_odoo', nullable: true }),
    __metadata("design:type", String)
], OdooConexionOrmEntity.prototype, "versionOdoo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ultimo_test', nullable: true, type: 'timestamptz' }),
    __metadata("design:type", Date)
], OdooConexionOrmEntity.prototype, "ultimoTest", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ultimo_test_ok', nullable: true }),
    __metadata("design:type", Boolean)
], OdooConexionOrmEntity.prototype, "ultimoTestOk", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'creado_en', type: 'timestamptz' }),
    __metadata("design:type", Date)
], OdooConexionOrmEntity.prototype, "creadoEn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'actualizado_en', type: 'timestamptz' }),
    __metadata("design:type", Date)
], OdooConexionOrmEntity.prototype, "actualizadoEn", void 0);
exports.OdooConexionOrmEntity = OdooConexionOrmEntity = __decorate([
    (0, typeorm_1.Entity)('odoo_conexion')
], OdooConexionOrmEntity);
//# sourceMappingURL=odoo-conexion.orm-entity.js.map