import { Inject, Injectable, Logger } from '@nestjs/common';
import { RegistroSincronizacion } from '../../domain/entities/registro-sincronizacion.entity';
import {
  IRegistroSincronizacionRepository,
  REGISTRO_SINCRONIZACION_REPOSITORY,
} from '../../domain/repositories/registro-sincronizacion.repository';
import {
  IMapeoItemRepository,
  MAPEO_ITEM_REPOSITORY,
} from '../../domain/repositories/mapeo-item.repository';
import { ISapLectorPort, SAP_LECTOR_PORT } from '../ports/sap-lector.port';
import { IOdooInventarioPort, ODOO_INVENTARIO_PORT } from '../ports/odoo-inventario.port';

export interface EventoDocumentoValidado {
  tipoDocumento: string;
  empresaCodigo: string;
  hashPdf: string;
  documentoArchivoId: string;
  identificador: string;
}

@Injectable()
export class ProcesarSalidaBodegaUseCase {
  private readonly logger = new Logger(ProcesarSalidaBodegaUseCase.name);

  constructor(
    @Inject(REGISTRO_SINCRONIZACION_REPOSITORY)
    private readonly registroRepo: IRegistroSincronizacionRepository,
    @Inject(MAPEO_ITEM_REPOSITORY)
    private readonly mapeoRepo: IMapeoItemRepository,
    @Inject(SAP_LECTOR_PORT)
    private readonly sapLector: ISapLectorPort,
    @Inject(ODOO_INVENTARIO_PORT)
    private readonly odooInventario: IOdooInventarioPort,
  ) {}

  async ejecutar(evento: EventoDocumentoValidado): Promise<void> {
    const docNum = parseInt(evento.identificador, 10);
    if (isNaN(docNum)) {
      this.logger.warn(`DocNum inválido: ${evento.identificador}`);
      return;
    }

    // 1. Idempotencia
    let registro = await this.registroRepo.findByEmpresaDocnum(evento.empresaCodigo, docNum);
    if (registro?.esTerminal()) {
      this.logger.log(`DocNum ${docNum} ya procesado (${registro.estado}), omitiendo`);
      return;
    }

    if (!registro) {
      registro = Object.assign(new RegistroSincronizacion(), {
        empresaCodigo: evento.empresaCodigo,
        sapDocnum: docNum,
        hashPdf: evento.hashPdf,
        documentoArchivoId: evento.documentoArchivoId,
        estado: 'recibido' as const,
        intentos: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      registro = await this.registroRepo.save(registro);
    }

    registro.intentos += 1;

    try {
      // 2. Leer SAP
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

      // 3. Mapear líneas
      const sinMapeo: string[] = [];
      const lineasOdoo = [];

      for (const linea of salidaSap.lineas) {
        const mapeoException = await this.mapeoRepo.findItem(evento.empresaCodigo, linea.itemCode);
        let productId: number | null = mapeoException?.odooProductId ?? null;

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

      // Validar mapeo de bodega
      const primeraLinea = salidaSap.lineas[0];
      const mapeoBodega = await this.mapeoRepo.findBodega(evento.empresaCodigo, primeraLinea.whsCode);
      if (!mapeoBodega) {
        registro.transicionar('error_mapeo', `Bodega sin mapeo: ${primeraLinea.whsCode}`);
        await this.registroRepo.save(registro);
        return;
      }

      registro.transicionar('mapeado');
      await this.registroRepo.save(registro);

      // 4. Crear y validar picking en Odoo
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
      } else if (resultado.tipo === 'ya_existe') {
        registro.transicionar('validado_odoo');
        this.logger.log(`ℹ️ DocNum ${docNum} → picking ${resultado.pickingId} ya existía`);
      } else if (resultado.tipo === 'stock_insuficiente') {
        registro.transicionar(
          'error_stock_insuficiente',
          `Stock insuficiente: ${resultado.movesNoAsignados.join(', ')}`,
        );
        this.logger.warn(`⚠️ DocNum ${docNum} → stock insuficiente`);
      }

      await this.registroRepo.save(registro);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error procesando DocNum ${docNum}: ${msg}`);
      registro.transicionar('error_odoo', msg);
      await this.registroRepo.save(registro);
    }
  }
}
