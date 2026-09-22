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
import { EventoDocumentoValidado } from './procesar-salida-bodega.use-case';

@Injectable()
export class ProcesarEntradaMercanciaUseCase {
  private readonly logger = new Logger(ProcesarEntradaMercanciaUseCase.name);

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
      this.logger.warn(`DocNum inválido para entrada: ${evento.identificador}`);
      return;
    }

    // 1. Idempotencia — clave: (empresa, docnum) único por tipo → se usa el mismo ledger
    let registro = await this.registroRepo.findByEmpresaDocnum(evento.empresaCodigo, docNum);
    if (registro?.esTerminal()) {
      this.logger.log(`Entrada DocNum ${docNum} ya procesada (${registro.estado}), omitiendo`);
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
      // 2. Leer SAP — OPDN/PDN1
      const entradaSap = await this.sapLector.obtenerEntradaPorDocnum(evento.empresaCodigo, docNum);
      if (!entradaSap) {
        registro.transicionar('error_sap', `Entrada DocNum ${docNum} no encontrada en SAP (OPDN)`);
        await this.registroRepo.save(registro);
        return;
      }

      registro.sapDocEntry = entradaSap.docEntry;
      registro.sapDocDate = entradaSap.docDate;
      registro.transicionar('resuelto_sap');
      await this.registroRepo.save(registro);

      // 3. Mapear líneas
      const sinMapeo: string[] = [];
      const lineasOdoo = [];

      for (const linea of entradaSap.lineas) {
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
        registro.transicionar('error_mapeo', `Items sin mapeo en entrada: ${sinMapeo.join(', ')}`);
        await this.registroRepo.save(registro);
        return;
      }

      // Mapeo de bodega — tipo ENTRADA (location_id=supplier, location_dest_id=almacén)
      const primeraLinea = entradaSap.lineas[0];
      const mapeoBodega = await this.mapeoRepo.findBodega(evento.empresaCodigo, primeraLinea.whsCode, 'ENTRADA');
      if (!mapeoBodega) {
        registro.transicionar(
          'error_mapeo',
          `Bodega sin mapeo de tipo ENTRADA: ${primeraLinea.whsCode}`,
        );
        await this.registroRepo.save(registro);
        return;
      }

      registro.transicionar('mapeado');
      await this.registroRepo.save(registro);

      // 4. Crear y validar recibo en Odoo — origin SAP-GR-{docEntry}
      const origin = `SAP-GR-${entradaSap.docEntry}`;
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
        this.logger.log(`✅ Entrada DocNum ${docNum} → recibo ${resultado.pickingId} validado`);
      } else if (resultado.tipo === 'ya_existe') {
        registro.transicionar('validado_odoo');
        this.logger.log(`ℹ️ Entrada DocNum ${docNum} → recibo ${resultado.pickingId} ya existía`);
      } else if (resultado.tipo === 'stock_insuficiente') {
        // En recepciones esto no debería ocurrir, pero lo capturamos por si Odoo lo reporta
        registro.transicionar(
          'error_odoo',
          `Recibo no se pudo asignar: ${resultado.movesNoAsignados.join(', ')}`,
        );
        this.logger.warn(`⚠️ Entrada DocNum ${docNum} → problema de asignación en recibo`);
      }

      await this.registroRepo.save(registro);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error procesando entrada DocNum ${docNum}: ${msg}`);
      registro.transicionar('error_odoo', msg);
      await this.registroRepo.save(registro);
    }
  }
}
