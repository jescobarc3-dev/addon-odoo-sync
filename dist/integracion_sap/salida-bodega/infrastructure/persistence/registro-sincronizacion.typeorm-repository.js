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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistroSincronizacionTypeormRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const registro_sincronizacion_orm_entity_1 = require("./registro-sincronizacion.orm-entity");
const registro_sincronizacion_entity_1 = require("../../domain/entities/registro-sincronizacion.entity");
let RegistroSincronizacionTypeormRepository = class RegistroSincronizacionTypeormRepository {
    constructor(repo) {
        this.repo = repo;
    }
    toEntity(orm) {
        return Object.assign(new registro_sincronizacion_entity_1.RegistroSincronizacion(), orm);
    }
    async findByEmpresaDocnum(empresaCodigo, sapDocnum) {
        const found = await this.repo.findOne({ where: { empresaCodigo, sapDocnum } });
        return found ? this.toEntity(found) : null;
    }
    async findByHashPdf(hashPdf) {
        const found = await this.repo.findOne({ where: { hashPdf } });
        return found ? this.toEntity(found) : null;
    }
    async save(registro) {
        const saved = await this.repo.save(registro);
        return this.toEntity(saved);
    }
    async findByEstado(estado, limit = 50) {
        const list = await this.repo.find({ where: { estado }, take: limit, order: { createdAt: 'DESC' } });
        return list.map((o) => this.toEntity(o));
    }
    async findAll(filtros = {}, page = 1, limit = 20) {
        const qb = this.repo.createQueryBuilder('r');
        if (filtros.estado)
            qb.andWhere('r.estado = :estado', { estado: filtros.estado });
        if (filtros.docnum)
            qb.andWhere('r.sapDocnum = :docnum', { docnum: filtros.docnum });
        qb.orderBy('r.createdAt', 'DESC').skip((page - 1) * limit).take(limit);
        const [items, total] = await qb.getManyAndCount();
        return { items: items.map((o) => this.toEntity(o)), total };
    }
    async findById(id) {
        const found = await this.repo.findOne({ where: { id } });
        return found ? this.toEntity(found) : null;
    }
};
exports.RegistroSincronizacionTypeormRepository = RegistroSincronizacionTypeormRepository;
exports.RegistroSincronizacionTypeormRepository = RegistroSincronizacionTypeormRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(registro_sincronizacion_orm_entity_1.RegistroSincronizacionOrmEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], RegistroSincronizacionTypeormRepository);
//# sourceMappingURL=registro-sincronizacion.typeorm-repository.js.map