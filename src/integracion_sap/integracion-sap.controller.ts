import {
  Controller, Get, Post, Put, Param, Body, Query, ParseIntPipe, DefaultValuePipe, Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  IRegistroSincronizacionRepository,
  REGISTRO_SINCRONIZACION_REPOSITORY,
} from './salida-bodega/domain/repositories/registro-sincronizacion.repository';
import {
  IMapeoItemRepository,
  MAPEO_ITEM_REPOSITORY,
} from './salida-bodega/domain/repositories/mapeo-item.repository';
import { ProcesarSalidaBodegaUseCase } from './salida-bodega/application/use-cases/procesar-salida-bodega.use-case';
import { ProcesarInventarioInicialUseCase } from './salida-bodega/application/use-cases/procesar-inventario-inicial.use-case';
import { ProcesarEntradaMercanciaUseCase } from './salida-bodega/application/use-cases/procesar-entrada-mercancia.use-case';
import { ODOO_CATALOGO_PORT, IOdooCatalogoPort } from './salida-bodega/application/ports/odoo-catalogo.port';

@ApiTags('integracion-sap')
@Controller('integracion-sap')
export class IntegracionSapController {
  constructor(
    @Inject(REGISTRO_SINCRONIZACION_REPOSITORY)
    private readonly registroRepo: IRegistroSincronizacionRepository,
    @Inject(MAPEO_ITEM_REPOSITORY)
    private readonly mapeoRepo: IMapeoItemRepository,
    @Inject(ODOO_CATALOGO_PORT)
    private readonly odooCatalogo: IOdooCatalogoPort,
    private readonly procesarUseCase: ProcesarSalidaBodegaUseCase,
    private readonly procesarInventarioUseCase: ProcesarInventarioInicialUseCase,
    private readonly procesarEntradaUseCase: ProcesarEntradaMercanciaUseCase,
  ) {}

  @Get('registros')
  @ApiOperation({ summary: 'Listar registros de sincronización (filtrable por estado/docnum)' })
  async listarRegistros(
    @Query('estado') estado?: string,
    @Query('docnum') docnum?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.registroRepo.findAll(
      { estado, docnum: docnum ? parseInt(docnum, 10) : undefined },
      page,
      limit,
    );
  }

  @Get('registros/:id')
  @ApiOperation({ summary: 'Obtener registro por ID' })
  async obtenerRegistro(@Param('id') id: string) {
    return this.registroRepo.findById(id);
  }

  @Post('registros/:id/reprocesar')
  @ApiOperation({ summary: 'Reprocesar un registro en estado error' })
  async reprocesar(@Param('id') id: string) {
    const reg = await this.registroRepo.findById(id);
    if (!reg) return { error: 'No encontrado' };
    if (!reg.puedeReintentarse()) return { error: `Estado ${reg.estado} no es reintentable` };

    await this.procesarUseCase.ejecutar({
      tipoDocumento: 'SALIDA_BODEGA',
      empresaCodigo: reg.empresaCodigo,
      hashPdf: reg.hashPdf,
      documentoArchivoId: reg.documentoArchivoId,
      identificador: String(reg.sapDocnum),
    });
    return { ok: true };
  }

  @Get('mapeos/items')
  @ApiOperation({ summary: 'Listar mapeos de items SAP → Odoo' })
  async listarMapeoItems(@Query('empresa') empresa?: string) {
    return this.mapeoRepo.findAllItems(empresa);
  }

  @Post('mapeos/items')
  @ApiOperation({ summary: 'Crear excepción de mapeo de item' })
  async crearMapeoItem(@Body() body: any) {
    return this.mapeoRepo.saveItem(body);
  }

  @Put('mapeos/items/:id')
  @ApiOperation({ summary: 'Actualizar mapeo de item' })
  async actualizarMapeoItem(@Param('id') id: string, @Body() body: any) {
    return this.mapeoRepo.updateItem(id, body);
  }

  @Get('mapeos/bodegas')
  @ApiOperation({ summary: 'Listar mapeos de bodegas SAP → Odoo' })
  async listarMapeoBodegas(@Query('empresa') empresa?: string) {
    return this.mapeoRepo.findAllBodegas(empresa);
  }

  @Post('inventario/disparar')
  @ApiOperation({ summary: 'Disparar inventario inicial/actualización manualmente' })
  async dispararInventario(
    @Body() body: { tipo: 'INVENTARIO_INICIAL' | 'ACTUALIZACION_INVENTARIO' },
  ) {
    const evento = {
      tipoDocumento: body.tipo,
      empresaCodigo: 'DEFAULT',
      hashPdf: `manual-${body.tipo}-${Date.now()}`,
      documentoArchivoId: 'manual',
      identificador: '0',
    };
    return this.procesarInventarioUseCase.ejecutar(evento);
  }

  @Post('salida/disparar')
  @ApiOperation({ summary: 'Procesar una salida de bodega manualmente por DocNum' })
  async dispararSalida(@Body() body: { docNum: number; hashPdf?: string }) {
    const evento = {
      tipoDocumento: 'SALIDA_BODEGA',
      empresaCodigo: 'DEFAULT',
      hashPdf: body.hashPdf ?? `manual-salida-${body.docNum}`,
      documentoArchivoId: 'manual',
      identificador: String(body.docNum),
    };
    await this.procesarUseCase.ejecutar(evento);
    return { ok: true };
  }

  @Post('entrada/disparar')
  @ApiOperation({ summary: 'Procesar una entrada de mercancía manualmente por DocNum' })
  async dispararEntrada(@Body() body: { docNum: number; hashPdf?: string }) {
    const evento = {
      tipoDocumento: 'ENTRADA_MERCANCIA',
      empresaCodigo: 'DEFAULT',
      hashPdf: body.hashPdf ?? `manual-entrada-${body.docNum}`,
      documentoArchivoId: 'manual',
      identificador: String(body.docNum),
    };
    await this.procesarEntradaUseCase.ejecutar(evento);
    return { ok: true };
  }

  @Get('odoo/ubicaciones')
  @ApiOperation({ summary: 'Listar ubicaciones internas de Odoo (stock.location type=internal)' })
  listarUbicaciones() {
    return this.odooCatalogo.listarUbicacionesInternas();
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Métricas de sincronización' })
  async dashboard() {
    const estados = [
      'recibido', 'resuelto_sap', 'mapeado', 'creado_odoo', 'validado_odoo',
      'error_sap', 'error_mapeo', 'error_stock_insuficiente', 'error_odoo',
    ];
    const counts: Record<string, number> = {};
    for (const estado of estados) {
      const { total } = await this.registroRepo.findAll({ estado }, 1, 1);
      counts[estado] = total;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const exitosos = counts['validado_odoo'] ?? 0;
    const errores =
      (counts['error_sap'] ?? 0) +
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
}
