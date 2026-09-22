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
exports.IntegracionSapController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const registro_sincronizacion_repository_1 = require("./salida-bodega/domain/repositories/registro-sincronizacion.repository");
const mapeo_item_repository_1 = require("./salida-bodega/domain/repositories/mapeo-item.repository");
const procesar_salida_bodega_use_case_1 = require("./salida-bodega/application/use-cases/procesar-salida-bodega.use-case");
const procesar_inventario_inicial_use_case_1 = require("./salida-bodega/application/use-cases/procesar-inventario-inicial.use-case");
let IntegracionSapController = class IntegracionSapController {
    constructor(registroRepo, mapeoRepo, procesarUseCase, procesarInventarioUseCase) {
        this.registroRepo = registroRepo;
        this.mapeoRepo = mapeoRepo;
        this.procesarUseCase = procesarUseCase;
        this.procesarInventarioUseCase = procesarInventarioUseCase;
    }
    async listarRegistros(estado, docnum, page, limit) {
        return this.registroRepo.findAll({ estado, docnum: docnum ? parseInt(docnum, 10) : undefined }, page, limit);
    }
    async obtenerRegistro(id) {
        return this.registroRepo.findById(id);
    }
    async reprocesar(id) {
        const reg = await this.registroRepo.findById(id);
        if (!reg)
            return { error: 'No encontrado' };
        if (!reg.puedeReintentarse())
            return { error: `Estado ${reg.estado} no es reintentable` };
        await this.procesarUseCase.ejecutar({
            tipoDocumento: 'SALIDA_BODEGA',
            empresaCodigo: reg.empresaCodigo,
            hashPdf: reg.hashPdf,
            documentoArchivoId: reg.documentoArchivoId,
            identificador: String(reg.sapDocnum),
        });
        return { ok: true };
    }
    async listarMapeoItems(empresa) {
        return this.mapeoRepo.findAllItems(empresa);
    }
    async crearMapeoItem(body) {
        return this.mapeoRepo.saveItem(body);
    }
    async actualizarMapeoItem(id, body) {
        return this.mapeoRepo.updateItem(id, body);
    }
    async listarMapeoBodegas(empresa) {
        return this.mapeoRepo.findAllBodegas(empresa);
    }
    async dispararInventario(body) {
        const evento = {
            tipoDocumento: body.tipo,
            empresaCodigo: body.empresaCodigo,
            hashPdf: body.hashPdf ?? `manual-${body.empresaCodigo}-${body.tipo}`,
            documentoArchivoId: 'manual',
            identificador: '0',
        };
        return this.procesarInventarioUseCase.ejecutar(evento);
    }
    async dashboard() {
        const estados = [
            'recibido', 'resuelto_sap', 'mapeado', 'creado_odoo', 'validado_odoo',
            'error_sap', 'error_mapeo', 'error_stock_insuficiente', 'error_odoo',
        ];
        const counts = {};
        for (const estado of estados) {
            const { total } = await this.registroRepo.findAll({ estado }, 1, 1);
            counts[estado] = total;
        }
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        const exitosos = counts['validado_odoo'] ?? 0;
        const errores = (counts['error_sap'] ?? 0) +
            (counts['error_mapeo'] ?? 0) +
            (counts['error_stock_insuficiente'] ?? 0) +
            (counts['error_odoo'] ?? 0);
        return {
            total,
            exitosos,
            errores,
            porcentajeAutomatico: total > 0 ? Math.round((exitosos / total) * 100) : 0,
            backlog: (counts['recibido'] ?? 0) + (counts['resuelto_sap'] ?? 0) + (counts['mapeado'] ?? 0),
            porEstado: counts,
        };
    }
};
exports.IntegracionSapController = IntegracionSapController;
__decorate([
    (0, common_1.Get)('registros'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar registros de sincronización (filtrable por estado/docnum)' }),
    __param(0, (0, common_1.Query)('estado')),
    __param(1, (0, common_1.Query)('docnum')),
    __param(2, (0, common_1.Query)('page', new common_1.DefaultValuePipe(1), common_1.ParseIntPipe)),
    __param(3, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(20), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], IntegracionSapController.prototype, "listarRegistros", null);
__decorate([
    (0, common_1.Get)('registros/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener registro por ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], IntegracionSapController.prototype, "obtenerRegistro", null);
__decorate([
    (0, common_1.Post)('registros/:id/reprocesar'),
    (0, swagger_1.ApiOperation)({ summary: 'Reprocesar un registro en estado error' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], IntegracionSapController.prototype, "reprocesar", null);
__decorate([
    (0, common_1.Get)('mapeos/items'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar mapeos de items SAP → Odoo' }),
    __param(0, (0, common_1.Query)('empresa')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], IntegracionSapController.prototype, "listarMapeoItems", null);
__decorate([
    (0, common_1.Post)('mapeos/items'),
    (0, swagger_1.ApiOperation)({ summary: 'Crear excepción de mapeo de item' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntegracionSapController.prototype, "crearMapeoItem", null);
__decorate([
    (0, common_1.Put)('mapeos/items/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar mapeo de item' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], IntegracionSapController.prototype, "actualizarMapeoItem", null);
__decorate([
    (0, common_1.Get)('mapeos/bodegas'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar mapeos de bodegas SAP → Odoo' }),
    __param(0, (0, common_1.Query)('empresa')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], IntegracionSapController.prototype, "listarMapeoBodegas", null);
__decorate([
    (0, common_1.Post)('inventario/disparar'),
    (0, swagger_1.ApiOperation)({ summary: 'Disparar sincronización de inventario inicial/actualización manualmente' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntegracionSapController.prototype, "dispararInventario", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, swagger_1.ApiOperation)({ summary: 'Métricas de sincronización' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], IntegracionSapController.prototype, "dashboard", null);
exports.IntegracionSapController = IntegracionSapController = __decorate([
    (0, swagger_1.ApiTags)('integracion-sap'),
    (0, common_1.Controller)('integracion-sap'),
    __param(0, (0, common_1.Inject)(registro_sincronizacion_repository_1.REGISTRO_SINCRONIZACION_REPOSITORY)),
    __param(1, (0, common_1.Inject)(mapeo_item_repository_1.MAPEO_ITEM_REPOSITORY)),
    __metadata("design:paramtypes", [Object, Object, procesar_salida_bodega_use_case_1.ProcesarSalidaBodegaUseCase,
        procesar_inventario_inicial_use_case_1.ProcesarInventarioInicialUseCase])
], IntegracionSapController);
//# sourceMappingURL=integracion-sap.controller.js.map