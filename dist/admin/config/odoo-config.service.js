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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var OdooConfigService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdooConfigService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const axios_1 = require("axios");
const odoo_conexion_orm_entity_1 = require("../entities/odoo-conexion.orm-entity");
const crypto_service_1 = require("../crypto/crypto.service");
let OdooConfigService = OdooConfigService_1 = class OdooConfigService {
    constructor(repo, crypto) {
        this.repo = repo;
        this.crypto = crypto;
        this.logger = new common_1.Logger(OdooConfigService_1.name);
    }
    safeConexion(c) {
        const { odooPasswordEnc: _omit, ...safe } = c;
        return safe;
    }
    async findAll() {
        const rows = await this.repo.find({ order: { creadoEn: 'ASC' } });
        return rows.map(this.safeConexion);
    }
    async findOne(id) {
        const c = await this.repo.findOne({ where: { id } });
        if (!c)
            throw new common_1.NotFoundException('Conexión no encontrada');
        return this.safeConexion(c);
    }
    async create(dto) {
        if (!dto.odooPassword)
            throw new common_1.BadRequestException('Contraseña requerida');
        const enc = this.crypto.encrypt(dto.odooPassword);
        const c = this.repo.create({
            nombre: dto.nombre,
            odooUrl: dto.odooUrl.replace(/\/$/, ''),
            odooDB: dto.odooDB,
            odooUser: dto.odooUser,
            odooPasswordEnc: enc,
        });
        const saved = await this.repo.save(c);
        return this.safeConexion(saved);
    }
    async update(id, dto) {
        const c = await this.repo.findOne({ where: { id } });
        if (!c)
            throw new common_1.NotFoundException('Conexión no encontrada');
        if (dto.nombre)
            c.nombre = dto.nombre;
        if (dto.odooUrl)
            c.odooUrl = dto.odooUrl.replace(/\/$/, '');
        if (dto.odooDB)
            c.odooDB = dto.odooDB;
        if (dto.odooUser)
            c.odooUser = dto.odooUser;
        if (dto.odooPassword)
            c.odooPasswordEnc = this.crypto.encrypt(dto.odooPassword);
        const saved = await this.repo.save(c);
        return this.safeConexion(saved);
    }
    async remove(id) {
        const c = await this.repo.findOne({ where: { id } });
        if (!c)
            throw new common_1.NotFoundException('Conexión no encontrada');
        await this.repo.remove(c);
        return { ok: true };
    }
    async testConexion(id) {
        const c = await this.repo.findOne({ where: { id } });
        if (!c)
            throw new common_1.NotFoundException('Conexión no encontrada');
        let ok = false;
        let version;
        let error;
        try {
            const pwd = this.crypto.decrypt(c.odooPasswordEnc);
            const resp = await axios_1.default.post(`${c.odooUrl}/jsonrpc`, {
                jsonrpc: '2.0', method: 'call', id: 1,
                params: {
                    service: 'common',
                    method: 'authenticate',
                    args: [c.odooDB, c.odooUser, pwd, {}],
                },
            }, { timeout: 10000 });
            const uid = resp.data?.result;
            if (uid && typeof uid === 'number') {
                ok = true;
                const verResp = await axios_1.default.post(`${c.odooUrl}/jsonrpc`, {
                    jsonrpc: '2.0', method: 'call', id: 2,
                    params: { service: 'common', method: 'version', args: [] },
                }, { timeout: 5000 });
                version = verResp.data?.result?.server_version ?? undefined;
            }
            else {
                error = 'Credenciales incorrectas (Odoo rechazó la autenticación)';
            }
        }
        catch (e) {
            error = e?.message ?? 'Error de conexión';
            this.logger.warn(`Test conexión ${id} falló: ${error}`);
        }
        await this.repo.update(id, {
            ultimoTest: new Date(),
            ultimoTestOk: ok,
            versionOdoo: version ?? c.versionOdoo,
        });
        return { ok, version, error };
    }
};
exports.OdooConfigService = OdooConfigService;
exports.OdooConfigService = OdooConfigService = OdooConfigService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(odoo_conexion_orm_entity_1.OdooConexionOrmEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        crypto_service_1.CryptoService])
], OdooConfigService);
//# sourceMappingURL=odoo-config.service.js.map