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
var ProcesarInventarioInicialUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcesarInventarioInicialUseCase = void 0;
const common_1 = require("@nestjs/common");
const registro_sincronizacion_repository_1 = require("../../domain/repositories/registro-sincronizacion.repository");
const mapeo_item_repository_1 = require("../../domain/repositories/mapeo-item.repository");
const sap_catalogo_port_1 = require("../ports/sap-catalogo.port");
const odoo_catalogo_port_1 = require("../ports/odoo-catalogo.port");
const registro_sincronizacion_entity_1 = require("../../domain/entities/registro-sincronizacion.entity");
let ProcesarInventarioInicialUseCase = ProcesarInventarioInicialUseCase_1 = class ProcesarInventarioInicialUseCase {
    constructor(registroRepo, sapCatalogo, odooCatalogo, mapeoRepo) {
        this.registroRepo = registroRepo;
        this.sapCatalogo = sapCatalogo;
        this.odooCatalogo = odooCatalogo;
        this.mapeoRepo = mapeoRepo;
        this.logger = new common_1.Logger(ProcesarInventarioInicialUseCase_1.name);
    }
    async ejecutar(evento) {
        this.logger.log(`Procesando inventario inicial empresa=${evento.empresaCodigo}`);
        const existente = await this.registroRepo.findByHashPdf(evento.hashPdf);
        if (existente?.estado === 'validado_odoo') {
            this.logger.log(`Inventario ${evento.hashPdf} ya procesado, omitiendo`);
            return { creados: 0, actualizados: 0, ajustados: 0, sinCambio: 0, errores: [] };
        }
        let registro = existente ?? Object.assign(new registro_sincronizacion_entity_1.RegistroSincronizacion(), {
            empresaCodigo: evento.empresaCodigo,
            sapDocnum: parseInt(evento.identificador, 10) || 0,
            hashPdf: evento.hashPdf,
            documentoArchivoId: evento.documentoArchivoId,
            estado: 'recibido',
            intentos: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        registro.intentos += 1;
        registro = await this.registroRepo.save(registro);
        const resultado = { creados: 0, actualizados: 0, ajustados: 0, sinCambio: 0, errores: [] };
        try {
            const items = await this.sapCatalogo.obtenerCatalogoCompleto(evento.empresaCodigo);
            this.logger.log(`SAP devolvió ${items.length} items activos`);
            registro.transicionar('resuelto_sap');
            await this.registroRepo.save(registro);
            for (const item of items) {
                try {
                    const mapeoEx = await this.mapeoRepo.findItem(evento.empresaCodigo, item.itemCode);
                    const resultUpsert = await this.odooCatalogo.upsertProducto({
                        itemCode: item.itemCode,
                        nombre: item.itemName,
                        categoriaNombre: item.grupoNombre,
                    });
                    if (resultUpsert.tipo === 'creado')
                        resultado.creados++;
                    else
                        resultado.actualizados++;
                    for (const { whsCode, onHand } of item.cantidadesPorBodega) {
                        const locationId = await this.odooCatalogo.buscarUbicacion(whsCode);
                        if (!locationId) {
                            this.logger.warn(`WhsCode ${whsCode} sin ubicación Odoo, omitiendo`);
                            continue;
                        }
                        const factor = mapeoEx?.factorUom ?? 1;
                        const ajuste = await this.odooCatalogo.ajustarInventario({
                            productId: resultUpsert.productId,
                            locationId,
                            cantidadSap: onHand * factor,
                        });
                        if (ajuste === 'ajustado')
                            resultado.ajustados++;
                        else
                            resultado.sinCambio++;
                    }
                }
                catch (err) {
                    const msg = `${item.itemCode}: ${err.message}`;
                    resultado.errores.push(msg);
                    this.logger.error(msg);
                }
            }
            registro.transicionar('validado_odoo');
            registro.ultimoError = resultado.errores.length
                ? `${resultado.errores.length} items con error`
                : null;
            await this.registroRepo.save(registro);
            this.logger.log(`✅ Inventario inicial: ${resultado.creados} creados, ${resultado.actualizados} actualizados, ` +
                `${resultado.ajustados} ajustados, ${resultado.errores.length} errores`);
        }
        catch (err) {
            registro.transicionar('error_sap', err.message);
            await this.registroRepo.save(registro);
            throw err;
        }
        return resultado;
    }
};
exports.ProcesarInventarioInicialUseCase = ProcesarInventarioInicialUseCase;
exports.ProcesarInventarioInicialUseCase = ProcesarInventarioInicialUseCase = ProcesarInventarioInicialUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(registro_sincronizacion_repository_1.REGISTRO_SINCRONIZACION_REPOSITORY)),
    __param(1, (0, common_1.Inject)(sap_catalogo_port_1.SAP_CATALOGO_PORT)),
    __param(2, (0, common_1.Inject)(odoo_catalogo_port_1.ODOO_CATALOGO_PORT)),
    __param(3, (0, common_1.Inject)(mapeo_item_repository_1.MAPEO_ITEM_REPOSITORY)),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], ProcesarInventarioInicialUseCase);
//# sourceMappingURL=procesar-inventario-inicial.use-case.js.map