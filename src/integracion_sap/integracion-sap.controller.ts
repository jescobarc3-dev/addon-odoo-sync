import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, ParseIntPipe, DefaultValuePipe, Inject, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
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
import { CatalogoItemService } from './documento-parser/catalogo-item.service';
import { DocumentoUploadService } from './documento-parser/documento-upload.service';
import { JwtPortalGuard } from '../portal/auth/guards/jwt-portal.guard';
import { PortalPermisosGuard, RequirePermiso } from '../portal/auth/guards/portal-permisos.guard';

@ApiTags('integracion-sap')
@ApiCookieAuth('portal_token')
@UseGuards(JwtPortalGuard, PortalPermisosGuard)
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
    private readonly catalogoService: CatalogoItemService,
    private readonly uploadService: DocumentoUploadService,
  ) {}

  @Get('registros')
  @RequirePermiso('integracion-sap:read')
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
  @RequirePermiso('integracion-sap:read')
  @ApiOperation({ summary: 'Obtener registro por ID' })
  async obtenerRegistro(@Param('id') id: string) {
    return this.registroRepo.findById(id);
  }

  @Post('registros/:id/reprocesar')
  @RequirePermiso('integracion-sap:revisar')
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
  @RequirePermiso('integracion-sap:read')
  @ApiOperation({ summary: 'Listar mapeos de items SAP → Odoo' })
  async listarMapeoItems(@Query('empresa') empresa?: string) {
    return this.mapeoRepo.findAllItems(empresa);
  }

  @Post('mapeos/items')
  @RequirePermiso('integracion-sap:mapear')
  @ApiOperation({ summary: 'Crear excepción de mapeo de item' })
  async crearMapeoItem(@Body() body: any) {
    return this.mapeoRepo.saveItem(body);
  }

  @Put('mapeos/items/:id')
  @RequirePermiso('integracion-sap:mapear')
  @ApiOperation({ summary: 'Actualizar mapeo de item' })
  async actualizarMapeoItem(@Param('id') id: string, @Body() body: any) {
    return this.mapeoRepo.updateItem(id, body);
  }

  @Get('mapeos/bodegas')
  @RequirePermiso('integracion-sap:read')
  @ApiOperation({ summary: 'Listar mapeos de bodegas SAP → Odoo' })
  async listarMapeoBodegas(@Query('empresa') empresa?: string) {
    return this.mapeoRepo.findAllBodegas(empresa);
  }

  @Post('mapeos/bodegas')
  @RequirePermiso('integracion-sap:mapear')
  @ApiOperation({ summary: 'Crear mapeo de bodega SAP → Odoo' })
  async crearMapeoBodega(@Body() body: any) {
    return this.mapeoRepo.saveBodega(body);
  }

  @Put('mapeos/bodegas/:id')
  @RequirePermiso('integracion-sap:mapear')
  @ApiOperation({ summary: 'Actualizar mapeo de bodega' })
  async actualizarMapeoBodega(@Param('id') id: string, @Body() body: any) {
    return this.mapeoRepo.updateBodega(id, body);
  }

  @Delete('mapeos/bodegas/:id')
  @RequirePermiso('integracion-sap:mapear')
  @ApiOperation({ summary: 'Eliminar mapeo de bodega' })
  async eliminarMapeoBodega(@Param('id') id: string) {
    await this.mapeoRepo.deleteBodega(id);
    return { ok: true };
  }

  @Post('inventario/disparar')
  @RequirePermiso('integracion-sap:revisar')
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
  @RequirePermiso('integracion-sap:revisar')
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
  @RequirePermiso('integracion-sap:revisar')
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
  @RequirePermiso('integracion-sap:read')
  @ApiOperation({ summary: 'Listar ubicaciones internas de Odoo (stock.location type=internal)' })
  listarUbicaciones() {
    return this.odooCatalogo.listarUbicacionesInternas();
  }

  @Get('odoo/picking-types')
  @RequirePermiso('integracion-sap:read')
  @ApiOperation({ summary: 'Listar tipos de operación de Odoo (stock.picking.type)' })
  listarPickingTypes() {
    return this.odooCatalogo.listarPickingTypes();
  }

  @Get('historial/resumen')
  @RequirePermiso('integracion-sap:read')
  @ApiOperation({ summary: 'Resumen de métricas de cargas manuales (historial_carga_inventario)' })
  async historialResumen() {
    return this.uploadService.resumenHistorial();
  }

  @Get('historial/todos')
  @RequirePermiso('integracion-sap:read')
  @ApiOperation({ summary: 'Todas las cargas manuales (filtrable por estado/tipo, paginado)' })
  async historialTodos(
    @Query('estado') estado?: string,
    @Query('tipo') tipo?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.uploadService.listarHistorialTodos({ estado, tipo, page, limit });
  }

  @Get('dashboard')
  @RequirePermiso('integracion-sap:read')
  @ApiOperation({ summary: 'Métricas de cargas — alias de historial/resumen' })
  async dashboard() {
    return this.uploadService.resumenHistorial();
  }

  // ── CATÁLOGO LOCAL DE ITEMS ──────────────────────────────────────────────────

  @Get('catalogo/items')
  @RequirePermiso('integracion-sap:read')
  @ApiOperation({ summary: 'Buscar items en el catálogo local (por código o nombre)' })
  async buscarCatalogo(
    @Query('q') q?: string,
    @Query('empresa') empresa = 'DEFAULT',
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    const items = await this.catalogoService.buscar(empresa, q ?? '', limit);
    const total = await this.catalogoService.contarActivos(empresa);
    return { items, total };
  }
}
