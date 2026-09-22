"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegracionSapModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const registro_sincronizacion_orm_entity_1 = require("./salida-bodega/infrastructure/persistence/registro-sincronizacion.orm-entity");
const mapeo_item_orm_entity_1 = require("./salida-bodega/infrastructure/persistence/mapeo-item.orm-entity");
const registro_sincronizacion_typeorm_repository_1 = require("./salida-bodega/infrastructure/persistence/registro-sincronizacion.typeorm-repository");
const mapeo_item_typeorm_repository_1 = require("./salida-bodega/infrastructure/persistence/mapeo-item.typeorm-repository");
const sap_lector_sql_adapter_1 = require("./salida-bodega/infrastructure/sap/sap-lector-sql.adapter");
const sap_catalogo_sql_adapter_1 = require("./salida-bodega/infrastructure/sap/sap-catalogo-sql.adapter");
const odoo_inventario_rpc_adapter_1 = require("./salida-bodega/infrastructure/odoo/odoo-inventario-rpc.adapter");
const odoo_catalogo_rpc_adapter_1 = require("./salida-bodega/infrastructure/odoo/odoo-catalogo-rpc.adapter");
const salida_bodega_consumer_1 = require("./salida-bodega/infrastructure/messaging/salida-bodega.consumer");
const procesar_salida_bodega_use_case_1 = require("./salida-bodega/application/use-cases/procesar-salida-bodega.use-case");
const procesar_inventario_inicial_use_case_1 = require("./salida-bodega/application/use-cases/procesar-inventario-inicial.use-case");
const integracion_sap_controller_1 = require("./integracion-sap.controller");
const registro_sincronizacion_repository_1 = require("./salida-bodega/domain/repositories/registro-sincronizacion.repository");
const mapeo_item_repository_1 = require("./salida-bodega/domain/repositories/mapeo-item.repository");
const sap_lector_port_1 = require("./salida-bodega/application/ports/sap-lector.port");
const sap_catalogo_port_1 = require("./salida-bodega/application/ports/sap-catalogo.port");
const odoo_inventario_port_1 = require("./salida-bodega/application/ports/odoo-inventario.port");
const odoo_catalogo_port_1 = require("./salida-bodega/application/ports/odoo-catalogo.port");
let IntegracionSapModule = class IntegracionSapModule {
};
exports.IntegracionSapModule = IntegracionSapModule;
exports.IntegracionSapModule = IntegracionSapModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                registro_sincronizacion_orm_entity_1.RegistroSincronizacionOrmEntity,
                mapeo_item_orm_entity_1.MapeoItemOrmEntity,
                mapeo_item_orm_entity_1.MapeoBodegaOrmEntity,
            ]),
        ],
        controllers: [integracion_sap_controller_1.IntegracionSapController],
        providers: [
            { provide: registro_sincronizacion_repository_1.REGISTRO_SINCRONIZACION_REPOSITORY, useClass: registro_sincronizacion_typeorm_repository_1.RegistroSincronizacionTypeormRepository },
            { provide: mapeo_item_repository_1.MAPEO_ITEM_REPOSITORY, useClass: mapeo_item_typeorm_repository_1.MapeoItemTypeormRepository },
            { provide: sap_lector_port_1.SAP_LECTOR_PORT, useClass: sap_lector_sql_adapter_1.SapLectorSqlAdapter },
            { provide: sap_catalogo_port_1.SAP_CATALOGO_PORT, useClass: sap_catalogo_sql_adapter_1.SapCatalogoSqlAdapter },
            { provide: odoo_inventario_port_1.ODOO_INVENTARIO_PORT, useClass: odoo_inventario_rpc_adapter_1.OdooInventarioRpcAdapter },
            { provide: odoo_catalogo_port_1.ODOO_CATALOGO_PORT, useClass: odoo_catalogo_rpc_adapter_1.OdooCatalogoRpcAdapter },
            procesar_salida_bodega_use_case_1.ProcesarSalidaBodegaUseCase,
            procesar_inventario_inicial_use_case_1.ProcesarInventarioInicialUseCase,
            salida_bodega_consumer_1.SalidaBodegaConsumer,
        ],
    })
], IntegracionSapModule);
//# sourceMappingURL=integracion-sap.module.js.map