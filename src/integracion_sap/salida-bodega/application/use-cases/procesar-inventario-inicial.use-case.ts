import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IRegistroSincronizacionRepository,
  REGISTRO_SINCRONIZACION_REPOSITORY,
} from '../../domain/repositories/registro-sincronizacion.repository';
import { IMapeoItemRepository, MAPEO_ITEM_REPOSITORY } from '../../domain/repositories/mapeo-item.repository';
import { ISapCatalogoPort, SAP_CATALOGO_PORT } from '../ports/sap-catalogo.port';
import { IOdooCatalogoPort, ODOO_CATALOGO_PORT } from '../ports/odoo-catalogo.port';
import { RegistroSincronizacion } from '../../domain/entities/registro-sincronizacion.entity';
import { EventoDocumentoValidado } from './procesar-salida-bodega.use-case';

export interface ResultadoInventario {
  creados: number;
  actualizados: number;
  ajustados: number;
  sinCambio: number;
  errores: string[];
}

@Injectable()
export class ProcesarInventarioInicialUseCase {
  private readonly logger = new Logger(ProcesarInventarioInicialUseCase.name);

  constructor(
    @Inject(REGISTRO_SINCRONIZACION_REPOSITORY)
    private readonly registroRepo: IRegistroSincronizacionRepository,
    @Inject(SAP_CATALOGO_PORT)
    private readonly sapCatalogo: ISapCatalogoPort,
    @Inject(ODOO_CATALOGO_PORT)
    private readonly odooCatalogo: IOdooCatalogoPort,
    @Inject(MAPEO_ITEM_REPOSITORY)
    private readonly mapeoRepo: IMapeoItemRepository,
  ) {}

  async ejecutar(evento: EventoDocumentoValidado): Promise<ResultadoInventario> {
    this.logger.log(`Procesando inventario inicial empresa=${evento.empresaCodigo}`);

    const existente = await this.registroRepo.findByHashPdf(evento.hashPdf);
    if (existente?.estado === 'validado_odoo') {
      this.logger.log(`Inventario ${evento.hashPdf} ya procesado, omitiendo`);
      return { creados: 0, actualizados: 0, ajustados: 0, sinCambio: 0, errores: [] };
    }

    let registro: RegistroSincronizacion = existente ?? Object.assign(new RegistroSincronizacion(), {
      empresaCodigo: evento.empresaCodigo,
      sapDocnum: parseInt(evento.identificador, 10) || 0,
      hashPdf: evento.hashPdf,
      documentoArchivoId: evento.documentoArchivoId,
      estado: 'recibido' as const,
      intentos: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    registro.intentos += 1;
    registro = await this.registroRepo.save(registro);

    const resultado: ResultadoInventario = { creados: 0, actualizados: 0, ajustados: 0, sinCambio: 0, errores: [] };

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

          if (resultUpsert.tipo === 'creado') resultado.creados++;
          else resultado.actualizados++;

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

            if (ajuste === 'ajustado') resultado.ajustados++;
            else resultado.sinCambio++;
          }
        } catch (err) {
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

      this.logger.log(
        `✅ Inventario inicial: ${resultado.creados} creados, ${resultado.actualizados} actualizados, ` +
        `${resultado.ajustados} ajustados, ${resultado.errores.length} errores`,
      );
    } catch (err) {
      registro.transicionar('error_sap', err.message);
      await this.registroRepo.save(registro);
      throw err;
    }

    return resultado;
  }
}
