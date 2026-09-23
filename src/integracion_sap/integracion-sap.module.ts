import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module';
import { OdooConexionOrmEntity } from '../admin/entities/odoo-conexion.orm-entity';
import { OdooCredencialesService } from './odoo-credenciales.service';
import { RegistroSincronizacionOrmEntity } from './salida-bodega/infrastructure/persistence/registro-sincronizacion.orm-entity';
import { MapeoItemOrmEntity, MapeoBodegaOrmEntity } from './salida-bodega/infrastructure/persistence/mapeo-item.orm-entity';
import { RegistroSincronizacionTypeormRepository } from './salida-bodega/infrastructure/persistence/registro-sincronizacion.typeorm-repository';
import { MapeoItemTypeormRepository } from './salida-bodega/infrastructure/persistence/mapeo-item.typeorm-repository';
import { SapLectorSqlAdapter } from './salida-bodega/infrastructure/sap/sap-lector-sql.adapter';
import { SapCatalogoSqlAdapter } from './salida-bodega/infrastructure/sap/sap-catalogo-sql.adapter';
import { OdooInventarioRpcAdapter } from './salida-bodega/infrastructure/odoo/odoo-inventario-rpc.adapter';
import { OdooCatalogoRpcAdapter } from './salida-bodega/infrastructure/odoo/odoo-catalogo-rpc.adapter';
import { SalidaBodegaConsumer } from './salida-bodega/infrastructure/messaging/salida-bodega.consumer';
import { ProcesarSalidaBodegaUseCase } from './salida-bodega/application/use-cases/procesar-salida-bodega.use-case';
import { ProcesarInventarioInicialUseCase } from './salida-bodega/application/use-cases/procesar-inventario-inicial.use-case';
import { ProcesarEntradaMercanciaUseCase } from './salida-bodega/application/use-cases/procesar-entrada-mercancia.use-case';
import { IntegracionSapController } from './integracion-sap.controller';
import { DocumentoUploadController } from './documento-parser/documento-upload.controller';
import { ArchivoParserService } from './documento-parser/archivo-parser.service';
import { DocumentoUploadService } from './documento-parser/documento-upload.service';
import { HistorialCargaOrmEntity } from './documento-parser/historial-carga.orm-entity';
import { CatalogoItemOrmEntity } from './documento-parser/catalogo-item.orm-entity';
import { CatalogoItemService } from './documento-parser/catalogo-item.service';
import { REGISTRO_SINCRONIZACION_REPOSITORY } from './salida-bodega/domain/repositories/registro-sincronizacion.repository';
import { MAPEO_ITEM_REPOSITORY } from './salida-bodega/domain/repositories/mapeo-item.repository';
import { SAP_LECTOR_PORT } from './salida-bodega/application/ports/sap-lector.port';
import { SAP_CATALOGO_PORT } from './salida-bodega/application/ports/sap-catalogo.port';
import { ODOO_INVENTARIO_PORT } from './salida-bodega/application/ports/odoo-inventario.port';
import { ODOO_CATALOGO_PORT } from './salida-bodega/application/ports/odoo-catalogo.port';

@Module({
  imports: [
    AdminModule,
    TypeOrmModule.forFeature([
      RegistroSincronizacionOrmEntity,
      MapeoItemOrmEntity,
      MapeoBodegaOrmEntity,
      OdooConexionOrmEntity,
      HistorialCargaOrmEntity,
      CatalogoItemOrmEntity,
    ]),
  ],
  exports: [OdooCredencialesService],
  controllers: [IntegracionSapController, DocumentoUploadController],
  providers: [
    { provide: REGISTRO_SINCRONIZACION_REPOSITORY, useClass: RegistroSincronizacionTypeormRepository },
    { provide: MAPEO_ITEM_REPOSITORY, useClass: MapeoItemTypeormRepository },
    { provide: SAP_LECTOR_PORT, useClass: SapLectorSqlAdapter },
    { provide: SAP_CATALOGO_PORT, useClass: SapCatalogoSqlAdapter },
    { provide: ODOO_INVENTARIO_PORT, useClass: OdooInventarioRpcAdapter },
    { provide: ODOO_CATALOGO_PORT, useClass: OdooCatalogoRpcAdapter },
    ProcesarSalidaBodegaUseCase,
    ProcesarInventarioInicialUseCase,
    ProcesarEntradaMercanciaUseCase,
    SalidaBodegaConsumer,
    OdooCredencialesService,
    ArchivoParserService,
    CatalogoItemService,
    DocumentoUploadService,
  ],
})
export class IntegracionSapModule {}
