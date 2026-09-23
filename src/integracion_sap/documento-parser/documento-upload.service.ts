import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ArchivoParserService, ResultadoParse, aplicarMapeo } from './archivo-parser.service';
import { IOdooCatalogoPort, ODOO_CATALOGO_PORT, ItemLote } from '../salida-bodega/application/ports/odoo-catalogo.port';
import { IOdooInventarioPort, ODOO_INVENTARIO_PORT } from '../salida-bodega/application/ports/odoo-inventario.port';
import { IMapeoItemRepository, MAPEO_ITEM_REPOSITORY, TipoOperacionBodega } from '../salida-bodega/domain/repositories/mapeo-item.repository';
import { HistorialCargaOrmEntity } from './historial-carga.orm-entity';
import { CatalogoItemService } from './catalogo-item.service';

export interface SesionUpload {
  id: string;
  tipo: string;
  empresa: string;
  resultado: ResultadoParse;
  creadoEn: Date;
  _buffer?: Buffer;
  _mimetype?: string;
  _originalname?: string;
}

export interface ResultadoProcesamiento {
  procesados: number;
  ajustados: number;
  sinCambio: number;
  errores: number;
  detalleErrores: string[];
  sinMapeo: string[];
  sinBodega: string[];
  conOnHandCero: string[];
  // Picking-specific (opcional — presente para SALIDA_BODEGA y ENTRADA_MERCANCIA)
  pickingId?: number;
  pickingEstado?: 'ok' | 'ok_sin_stock' | 'ya_existe';
  movesNoAsignados?: string[];
}

export interface JobEstado {
  estado: 'procesando' | 'completado' | 'error';
  progreso: number;
  total: number;
  resultado?: ResultadoProcesamiento;
  errorMsg?: string;
  creadoEn: Date;
}

const TTL_SESION_MS = 30 * 60 * 1000;
const TTL_JOB_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class DocumentoUploadService {
  private readonly logger = new Logger(DocumentoUploadService.name);
  private readonly sesiones = new Map<string, SesionUpload>();
  private readonly jobs = new Map<string, JobEstado>();

  constructor(
    private readonly parser: ArchivoParserService,
    private readonly catalogo: CatalogoItemService,
    @Inject(ODOO_CATALOGO_PORT)
    private readonly odooCatalogo: IOdooCatalogoPort,
    @Inject(ODOO_INVENTARIO_PORT)
    private readonly odooInventario: IOdooInventarioPort,
    @Inject(MAPEO_ITEM_REPOSITORY)
    private readonly mapeoRepo: IMapeoItemRepository,
    @InjectRepository(HistorialCargaOrmEntity)
    private readonly historialRepo: Repository<HistorialCargaOrmEntity>,
  ) {
    setInterval(() => this.limpiar(), 10 * 60 * 1000);
  }

  async subirArchivo(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
    tipo: string,
  ): Promise<{ uploadId: string } & ResultadoParse> {
    const resultado = await this.parser.parsear(buffer, mimetype, originalname, tipo);
    const id = randomUUID();
    const sesion: SesionUpload = {
      id, tipo, empresa: 'DEFAULT', resultado, creadoEn: new Date(),
      _buffer: buffer, _mimetype: mimetype, _originalname: originalname,
    };
    this.sesiones.set(id, sesion);
    return { uploadId: id, ...resultado };
  }

  async cambiarHoja(uploadId: string, hoja: string): Promise<{ uploadId: string } & ResultadoParse> {
    const sesion = this.obtenerSesion(uploadId);
    if (!sesion._buffer || !sesion._originalname) {
      throw new BadRequestException('No se puede cambiar la hoja: buffer original no disponible.');
    }
    const nuevo = await this.parser.parsear(sesion._buffer, sesion._mimetype!, sesion._originalname, sesion.tipo, hoja);
    sesion.resultado = nuevo;
    sesion.creadoEn = new Date();
    return { uploadId, ...nuevo };
  }

  obtenerSesion(uploadId: string): SesionUpload {
    const s = this.sesiones.get(uploadId);
    if (!s) throw new NotFoundException('Sesión de upload no encontrada o expirada. Sube el archivo nuevamente.');
    return s;
  }

  obtenerJob(jobId: string): JobEstado {
    const j = this.jobs.get(jobId);
    if (!j) throw new NotFoundException('Job no encontrado o expirado.');
    return j;
  }

  // ── INVENTARIO (INVENTARIO_INICIAL / ACTUALIZACION_INVENTARIO) ────────────

  iniciarJob(
    uploadId: string,
    mapeoColumnas?: Record<string, string>,
    ubicacionOverrideId?: number,
  ): { jobId: string; total: number } {
    const sesion = this.obtenerSesion(uploadId);
    let filas = sesion.resultado.filas;
    if (mapeoColumnas && Object.keys(mapeoColumnas).length > 0 && sesion.resultado.rawRows.length > 0) {
      filas = aplicarMapeo(sesion.resultado.rawRows, mapeoColumnas);
    }
    const total = filas.filter(f => !!f.itemCode).length;
    const jobId = randomUUID();

    this.jobs.set(jobId, { estado: 'procesando', progreso: 0, total, creadoEn: new Date() });

    const sesionTipo = sesion.tipo;
    const sesionArchivo = sesion._originalname ?? null;
    this._procesarInventarioAsync(jobId, uploadId, mapeoColumnas, ubicacionOverrideId).catch(async err => {
      const msg: string = err?.message ?? 'Error inesperado';
      this.jobs.set(jobId, { estado: 'error', progreso: 0, total, errorMsg: msg, creadoEn: new Date() });
      this.logger.error(`Job ${jobId} falló: ${msg}`);
      await this._guardarHistorial(sesionTipo, sesionArchivo,
        { procesados: 0, ajustados: 0, sinCambio: 0, errores: 1,
          detalleErrores: [msg], sinMapeo: [], sinBodega: [], conOnHandCero: [] }, msg);
    });

    return { jobId, total };
  }

  private async _procesarInventarioAsync(
    jobId: string,
    uploadId: string,
    mapeoColumnas?: Record<string, string>,
    ubicacionOverrideId?: number,
  ): Promise<void> {
    const sesion = this.obtenerSesion(uploadId);
    const { empresa, resultado } = sesion;

    let filas = resultado.filas;
    if (mapeoColumnas && Object.keys(mapeoColumnas).length > 0 && resultado.rawRows.length > 0) {
      filas = aplicarMapeo(resultado.rawRows, mapeoColumnas);
    }

    const job = this.jobs.get(jobId)!;
    const sinBodega: string[] = [];
    const conOnHandCero: string[] = [];
    const detalleErrores: string[] = [];

    this.logger.log(`Job ${jobId}: ${filas.length} filas — modo lote`);

    const filasValidas = filas.filter(f => !!f.itemCode);
    const locationIds = await Promise.all(
      filasValidas.map(async fila => {
        if (ubicacionOverrideId) return { fila, locationId: ubicacionOverrideId };
        const locId = await this.odooCatalogo.buscarUbicacion(fila.whsCode);
        if (!locId) sinBodega.push(`${fila.itemCode} (${fila.whsCode})`);
        return { fila, locationId: locId };
      }),
    );

    const mapeoFactors = await Promise.all(
      filasValidas.map(async fila => {
        const m = await this.mapeoRepo.findItem(empresa, fila.itemCode);
        return { itemCode: fila.itemCode, factor: m?.factorUom ?? 1 };
      }),
    );
    const factorByCode = new Map(mapeoFactors.map(m => [m.itemCode, m.factor]));

    const itemsLote: ItemLote[] = [];
    for (const { fila, locationId } of locationIds) {
      if (!locationId) continue;
      if (fila.onHand === 0) conOnHandCero.push(fila.itemCode);
      const factor = factorByCode.get(fila.itemCode) ?? 1;
      itemsLote.push({
        itemCode: fila.itemCode,
        nombre: fila.itemName,
        precioUnitario: fila.precioUnitario ?? undefined,
        cantidadSap: fila.onHand * factor,
        locationId,
      });
    }

    if (sinBodega.length > 0) {
      this.logger.warn(`Job ${jobId}: ${sinBodega.length} ítems sin bodega resuelta`);
    }

    let loteResult = { ajustados: 0, sinCambio: 0, errores: [] as Array<{ itemCode: string; error: string }> };
    try {
      loteResult = await this.odooCatalogo.procesarLoteInventario(
        itemsLote,
        (n: number) => { job.progreso = n; this.jobs.set(jobId, job); },
      );
    } catch (err: any) {
      this.logger.error(`Job ${jobId} error en lote: ${err.message}`);
      detalleErrores.push(`Error lote: ${err.message}`);
    }

    for (const e of loteResult.errores) {
      detalleErrores.push(`${e.itemCode}: ${e.error}`);
    }

    const resultadoFinal: ResultadoProcesamiento = {
      procesados: loteResult.ajustados + loteResult.sinCambio,
      ajustados: loteResult.ajustados,
      sinCambio: loteResult.sinCambio,
      errores: detalleErrores.length,
      detalleErrores,
      sinMapeo: [],
      sinBodega,
      conOnHandCero,
    };

    job.progreso = job.total;
    job.estado = 'completado';
    job.resultado = resultadoFinal;
    this.jobs.set(jobId, job);
    this.sesiones.delete(uploadId);

    this.logger.log(`Job ${jobId} completado: ${loteResult.ajustados} ajustados, ${loteResult.sinCambio} sin cambio`);
    await this._guardarHistorial(sesion.tipo, sesion._originalname ?? null, resultadoFinal, null);

    // Poblar catálogo local con los items de esta carga (INVENTARIO_INICIAL o ACTUALIZACION_INVENTARIO)
    // Permite al parser PDF validar códigos en cargas futuras sin conectar a SAP ni Odoo.
    this.catalogo.upsertLote(
      empresa,
      filasValidas.map(f => ({
        itemCode: f.itemCode,
        itemName: f.itemName,
        uomCode: f.uomCode || undefined,
        precioUnitario: f.precioUnitario ?? null,
      })),
    ).catch(e => this.logger.warn(`Catalogo upsert falló (no crítico): ${e.message}`));
  }

  // ── PICKING (SALIDA_BODEGA / ENTRADA_MERCANCIA) ───────────────────────────

  iniciarJobPicking(
    uploadId: string,
    tipo: 'SALIDA_BODEGA' | 'ENTRADA_MERCANCIA',
    empresa: string,
    mapeoColumnas?: Record<string, string>,
    referenciaSap?: string,
    whsCodeOverride?: string,
  ): { jobId: string; total: number } {
    const sesion = this.obtenerSesion(uploadId);
    let filas = sesion.resultado.filas;
    if (mapeoColumnas && Object.keys(mapeoColumnas).length > 0 && sesion.resultado.rawRows.length > 0) {
      filas = aplicarMapeo(sesion.resultado.rawRows, mapeoColumnas);
    }
    const total = filas.filter(f => !!f.itemCode).length;
    const jobId = randomUUID();

    this.jobs.set(jobId, { estado: 'procesando', progreso: 0, total, creadoEn: new Date() });

    const sesionArchivo = sesion._originalname ?? null;
    this._procesarPickingAsync(jobId, uploadId, tipo, empresa, mapeoColumnas, referenciaSap, whsCodeOverride).catch(async err => {
      const msg: string = err?.message ?? 'Error inesperado';
      this.jobs.set(jobId, { estado: 'error', progreso: 0, total, errorMsg: msg, creadoEn: new Date() });
      this.logger.error(`Job picking ${jobId} falló: ${msg}`);
      await this._guardarHistorial(tipo, sesionArchivo,
        { procesados: 0, ajustados: 0, sinCambio: 0, errores: 1,
          detalleErrores: [msg], sinMapeo: [], sinBodega: [], conOnHandCero: [] }, msg);
    });

    return { jobId, total };
  }

  private async _procesarPickingAsync(
    jobId: string,
    uploadId: string,
    tipo: 'SALIDA_BODEGA' | 'ENTRADA_MERCANCIA',
    empresa: string,
    mapeoColumnas?: Record<string, string>,
    referenciaSap?: string,
    whsCodeOverride?: string,
  ): Promise<void> {
    const sesion = this.obtenerSesion(uploadId);
    const { resultado } = sesion;
    let filas = resultado.filas;
    if (mapeoColumnas && Object.keys(mapeoColumnas).length > 0 && resultado.rawRows.length > 0) {
      filas = aplicarMapeo(resultado.rawRows, mapeoColumnas);
    }

    const job = this.jobs.get(jobId)!;
    const filasValidas = filas.filter(f => !!f.itemCode);
    const tipoBodega: TipoOperacionBodega = tipo === 'SALIDA_BODEGA' ? 'SALIDA' : 'ENTRADA';
    const detalleErrores: string[] = [];
    const sinBodega: string[] = [];
    const sinMapeo: string[] = [];

    if (filasValidas.length === 0) {
      throw new Error('No hay líneas válidas para crear el picking (sin itemCode).');
    }

    // Usar el override manual si fue proporcionado (el usuario corrigió el almacén detectado),
    // si no, tomar el primer WhsCode real de las filas.
    const whsCode = (whsCodeOverride?.trim())
      || filasValidas.find(f => f.whsCode && f.whsCode !== 'DEFAULT')?.whsCode
      || filasValidas[0].whsCode;

    // Resolver mapeo_bodega → (pickingTypeId, locationId, locationDestId)
    const mapeoBodega = await this.mapeoRepo.findBodega(empresa, whsCode, tipoBodega);
    if (!mapeoBodega) {
      const msg =
        `No existe mapeo de bodega para almacén "${whsCode}" tipo "${tipoBodega}". ` +
        `Configúralo en Mapeos → Bodegas.`;
      sinBodega.push(`${whsCode} (${tipoBodega})`);
      job.estado = 'error';
      job.errorMsg = msg;
      this.jobs.set(jobId, job);
      await this._guardarHistorial(tipo, sesion._originalname ?? null,
        { procesados: 0, ajustados: 0, sinCambio: 0, errores: 1,
          detalleErrores: [msg], sinMapeo: [], sinBodega, conOnHandCero: [] }, msg);
      return;
    }

    // Resolver product_id en Odoo por default_code = itemCode
    const resolvedLines: Array<{ productId: number; cantidad: number } | null> =
      await Promise.all(
        filasValidas.map(async (fila, idx) => {
          const productId = await this.odooInventario.buscarProductoPorCodigo(empresa, fila.itemCode);
          job.progreso = idx + 1;
          this.jobs.set(jobId, job);
          if (!productId) {
            detalleErrores.push(`${fila.itemCode}: producto no encontrado en Odoo (default_code)`);
            sinMapeo.push(fila.itemCode);
            return null;
          }
          return { productId, cantidad: fila.onHand, precioUnitario: fila.precioUnitario ?? undefined };
        }),
      );

    const lineas = resolvedLines.filter((l): l is { productId: number; cantidad: number } => l !== null);

    if (lineas.length === 0) {
      const msg = `Ningún producto encontrado en Odoo. Verifica los códigos: ${sinMapeo.join(', ')}`;
      job.estado = 'error';
      job.errorMsg = msg;
      this.jobs.set(jobId, job);
      await this._guardarHistorial(tipo, sesion._originalname ?? null,
        { procesados: 0, ajustados: 0, sinCambio: 0, errores: detalleErrores.length,
          detalleErrores, sinMapeo, sinBodega, conOnHandCero: [] }, msg);
      return;
    }

    // Crear y validar el picking en Odoo
    const prefix = tipo === 'SALIDA_BODEGA' ? 'GI' : 'GR';
    const refSap = referenciaSap?.trim();
    // Origin = solo el DocNum (para reportería en Odoo); fallback a timestamp si no hay ref.
    const origin = refSap ?? `MANUAL-${prefix}-${Date.now()}`;

    const pickingResult = await this.odooInventario.crearYValidarPicking({
      origin,
      pickingTypeId: mapeoBodega.odooPickingTypeId,
      locationId: mapeoBodega.odooLocationId,
      locationDestId: mapeoBodega.odooLocationDestId,
      lineas,
      forzarSinStock: mapeoBodega.forzarSinStock,
    });

    if (pickingResult.tipo === 'stock_insuficiente') {
      const msg = `Stock insuficiente en Odoo para: ${pickingResult.movesNoAsignados.join(', ')}. El picking fue cancelado (bodega configurada para no forzar).`;
      job.progreso = job.total;
      job.estado = 'error';
      job.errorMsg = msg;
      this.jobs.set(jobId, job);
      this.sesiones.delete(uploadId);
      await this._guardarHistorial(tipo, sesion._originalname ?? null,
        { procesados: filasValidas.length, ajustados: 0, sinCambio: 0, errores: 1,
          detalleErrores: [msg], sinMapeo, sinBodega, conOnHandCero: [] }, msg);
      return;
    }

    const resultadoFinal: ResultadoProcesamiento = {
      procesados: filasValidas.length,
      ajustados: pickingResult.tipo === 'ok' || pickingResult.tipo === 'ok_sin_stock' ? 1 : 0,
      sinCambio: pickingResult.tipo === 'ya_existe' ? 1 : 0,
      errores: detalleErrores.length,
      detalleErrores,
      sinMapeo,
      sinBodega,
      conOnHandCero: [],
      pickingId: 'pickingId' in pickingResult ? pickingResult.pickingId : undefined,
      pickingEstado: pickingResult.tipo,
      movesNoAsignados: pickingResult.tipo === 'ok_sin_stock'
        ? pickingResult.movesNoAsignados : [],
    };

    job.progreso = job.total;
    job.estado = 'completado';
    job.resultado = resultadoFinal;
    this.jobs.set(jobId, job);
    this.sesiones.delete(uploadId);

    this.logger.log(
      `Job picking ${jobId}: ${pickingResult.tipo}, ` +
      `pickingId=${(pickingResult as any).pickingId ?? 'n/a'}, ` +
      `lineas=${lineas.length}`,
    );
    await this._guardarHistorial(tipo, sesion._originalname ?? null, resultadoFinal,
      pickingResult.tipo === 'ok_sin_stock'
        ? `Validado sin stock reservado: ${pickingResult.movesNoAsignados.join(', ')}`
        : null,
    );
  }

  // ── Historial ─────────────────────────────────────────────────────────────

  private async _guardarHistorial(
    tipo: string,
    nombreArchivo: string | null,
    resultado: ResultadoProcesamiento,
    errorFatal: string | null,
  ): Promise<void> {
    try {
      await this.historialRepo.save(
        this.historialRepo.create({
          tipo,
          nombreArchivo,
          totalFilas: resultado.procesados + resultado.sinCambio + resultado.errores,
          ajustados: resultado.ajustados,
          sinCambio: resultado.sinCambio,
          errores: resultado.errores,
          sinBodega: resultado.sinBodega.length,
          conOnHandCero: resultado.conOnHandCero.length,
          detalleErrores: resultado.detalleErrores,
          sinBodegaLista: resultado.sinBodega,
          estado: errorFatal ? 'error' : 'completado',
          errorFatal,
        }),
      );
    } catch (err: any) {
      this.logger.warn(`No se pudo guardar historial: ${err.message}`);
    }
  }

  async listarHistorial(tipo: string, limit = 20): Promise<HistorialCargaOrmEntity[]> {
    return this.historialRepo.find({
      where: { tipo },
      order: { creadoEn: 'DESC' },
      take: limit,
    });
  }

  async listarHistorialTodos(opts: {
    estado?: string; tipo?: string; page?: number; limit?: number;
  }): Promise<{ items: HistorialCargaOrmEntity[]; total: number }> {
    const qb = this.historialRepo.createQueryBuilder('h');
    if (opts.estado) qb.andWhere('h.estado = :estado', { estado: opts.estado });
    if (opts.tipo) qb.andWhere('h.tipo = :tipo', { tipo: opts.tipo });
    qb.orderBy('h.creado_en', 'DESC');
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async resumenHistorial(): Promise<{
    total: number; exitosos: number; errores: number; porcentajeExito: number;
    porTipo: Record<string, { total: number; exitosos: number; errores: number }>;
  }> {
    const tipos = ['SALIDA_BODEGA', 'ENTRADA_MERCANCIA', 'INVENTARIO_INICIAL', 'ACTUALIZACION_INVENTARIO'];
    const total = await this.historialRepo.count();
    const exitosos = await this.historialRepo.count({ where: { estado: 'completado' } });
    const errores = await this.historialRepo.count({ where: { estado: 'error' } });
    const porTipo: Record<string, { total: number; exitosos: number; errores: number }> = {};
    for (const tipo of tipos) {
      const t = await this.historialRepo.count({ where: { tipo } });
      const e = await this.historialRepo.count({ where: { tipo, estado: 'completado' } });
      const err = await this.historialRepo.count({ where: { tipo, estado: 'error' } });
      porTipo[tipo] = { total: t, exitosos: e, errores: err };
    }
    return { total, exitosos, errores, porcentajeExito: total > 0 ? Math.round((exitosos / total) * 100) : 0, porTipo };
  }

  private limpiar() {
    const now = Date.now();
    for (const [id, sesion] of this.sesiones.entries()) {
      if (now - sesion.creadoEn.getTime() > TTL_SESION_MS) this.sesiones.delete(id);
    }
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.creadoEn.getTime() > TTL_JOB_MS) this.jobs.delete(id);
    }
  }
}
