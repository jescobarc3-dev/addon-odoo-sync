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
var ProcesarSalidaBodegaUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcesarSalidaBodegaUseCase = void 0;
const common_1 = require("@nestjs/common");
const registro_sincronizacion_entity_1 = require("../../domain/entities/registro-sincronizacion.entity");
const registro_sincronizacion_repository_1 = require("../../domain/repositories/registro-sincronizacion.repository");
const mapeo_item_repository_1 = require("../../domain/repositories/mapeo-item.repository");
const sap_lector_port_1 = require("../ports/sap-lector.port");
const odoo_inventario_port_1 = require("../ports/odoo-inventario.port");
let ProcesarSalidaBodegaUseCase = ProcesarSalidaBodegaUseCase_1 = class ProcesarSalidaBodegaUseCase {
    constructor(registroRepo, mapeoRepo, sapLector, odooInventario) {
        this.registroRepo = registroRepo;
        this.mapeoRepo = mapeoRepo;
        this.sapLector = sapLector;
        this.odooInventario = odooInventario;
        this.logger = new common_1.Logger(ProcesarSalidaBodegaUseCase_1.name);
    }
    async ejecutar(evento) {
        const docNum = parseInt(evento.identificador, 10);
        if (isNaN(docNum)) {
            this.logger.warn(`DocNum inválido: ${evento.identificador}`);
            return;
        }
        let registro = await this.registroRepo.findByEmpresaDocnum(evento.empresaCodigo, docNum);
        if (registro?.esTerminal()) {
            this.logger.log(`DocNum ${docNum} ya procesado (${registro.estado}), omitiendo`);
            return;
        }
        if (!registro) {
            registro = Object.assign(new registro_sincronizacion_entity_1.RegistroSincronizacion(), {
                empresaCodigo: evento.empresaCodigo,
                sapDocnum: docNum,
                hashPdf: evento.hashPdf,
                documentoArchivoId: evento.documentoArchivoId,
                estado: 'recibido',
                intentos: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            registro = await this.registroRepo.save(registro);
        }
        registro.intentos += 1;
        try {
            const salidaSap = await this.sapLector.obtenerSalidaPorDocnum(evento.empresaCodigo, docNum);
            if (!salidaSap) {
                registro.transicionar('error_sap', `DocNum ${docNum} no encontrado en SAP`);
                await this.registroRepo.save(registro);
                return;
            }
            registro.sapDocEntry = salidaSap.docEntry;
            registro.sapDocDate = salidaSap.docDate;
            registro.transicionar('resuelto_sap');
            await this.registroRepo.save(registro);
            const sinMapeo = [];
            const lineasOdoo = [];
            for (const linea of salidaSap.lineas) {
                const mapeoException = await this.mapeoRepo.findItem(evento.empresaCodigo, linea.itemCode);
                let productId = mapeoException?.odooProductId ?? null;
                if (!productId) {
                    productId = await this.odooInventario.buscarProductoPorCodigo(evento.empresaCodigo, linea.itemCode);
                }
                if (!productId) {
                    sinMapeo.push(linea.itemCode);
                    continue;
                }
                const factor = mapeoException?.factorUom ?? 1;
                lineasOdoo.push({
                    productId,
                    cantidad: linea.cantidad * factor,
                    lotes: linea.lotes,
                });
            }
            if (sinMapeo.length > 0) {
                registro.transicionar('error_mapeo', `Items sin mapeo: ${sinMapeo.join(', ')}`);
                await this.registroRepo.save(registro);
                return;
            }
            const primeraLinea = salidaSap.lineas[0];
            const mapeoBodega = await this.mapeoRepo.findBodega(evento.empresaCodigo, primeraLinea.whsCode);
            if (!mapeoBodega) {
                registro.transicionar('error_mapeo', `Bodega sin mapeo: ${primeraLinea.whsCode}`);
                await this.registroRepo.save(registro);
                return;
            }
            registro.transicionar('mapeado');
            await this.registroRepo.save(registro);
            const origin = `SAP-GI-${salidaSap.docEntry}`;
            registro.odooOrigin = origin;
            const resultado = await this.odooInventario.crearYValidarPicking({
                origin,
                pickingTypeId: mapeoBodega.odooPickingTypeId,
                locationId: mapeoBodega.odooLocationId,
                locationDestId: mapeoBodega.odooLocationDestId,
                lineas: lineasOdoo,
            });
            if (resultado.tipo === 'ya_existe' || resultado.tipo === 'ok') {
                registro.odooPickingId = resultado.pickingId;
                registro.transicionar('creado_odoo');
                await this.registroRepo.save(registro);
            }
            if (resultado.tipo === 'ok') {
                registro.transicionar('validado_odoo');
                this.logger.log(`✅ DocNum ${docNum} → picking ${resultado.pickingId} validado`);
            }
            else if (resultado.tipo === 'ya_existe') {
                registro.transicionar('validado_odoo');
                this.logger.log(`ℹ️ DocNum ${docNum} → picking ${resultado.pickingId} ya existía`);
            }
            else if (resultado.tipo === 'stock_insuficiente') {
                registro.transicionar('error_stock_insuficiente', `Stock insuficiente: ${resultado.movesNoAsignados.join(', ')}`);
                this.logger.warn(`⚠️ DocNum ${docNum} → stock insuficiente`);
            }
            await this.registroRepo.save(registro);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Error procesando DocNum ${docNum}: ${msg}`);
            registro.transicionar('error_odoo', msg);
            await this.registroRepo.save(registro);
        }
    }
};
exports.ProcesarSalidaBodegaUseCase = ProcesarSalidaBodegaUseCase;
exports.ProcesarSalidaBodegaUseCase = ProcesarSalidaBodegaUseCase = ProcesarSalidaBodegaUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(registro_sincronizacion_repository_1.REGISTRO_SINCRONIZACION_REPOSITORY)),
    __param(1, (0, common_1.Inject)(mapeo_item_repository_1.MAPEO_ITEM_REPOSITORY)),
    __param(2, (0, common_1.Inject)(sap_lector_port_1.SAP_LECTOR_PORT)),
    __param(3, (0, common_1.Inject)(odoo_inventario_port_1.ODOO_INVENTARIO_PORT)),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], ProcesarSalidaBodegaUseCase);
//# sourceMappingURL=procesar-salida-bodega.use-case.js.map