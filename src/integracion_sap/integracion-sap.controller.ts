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
import { ODOO_RRHH_PORT, IOdooRRHHPort } from './salida-bodega/application/ports/odoo-rrhh.port';
import { CatalogoItemService } from './documento-parser/catalogo-item.service';
import { CatalogoEmpleadoService } from './documento-parser/catalogo-empleado.service';
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
    @Inject(ODOO_RRHH_PORT)
    private readonly odooRRHH: IOdooRRHHPort,
    private readonly procesarUseCase: ProcesarSalidaBodegaUseCase,
    private readonly procesarInventarioUseCase: ProcesarInventarioInicialUseCase,
    private readonly procesarEntradaUseCase: ProcesarEntradaMercanciaUseCase,
    private readonly catalogoService: CatalogoItemService,
    private readonly catalogoEmpleadoService: CatalogoEmpleadoService,
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

  // ── CATÁLOGO DE EMPLEADOS ────────────────────────────────────────────────

  @Get('empleados/comparacion')
  @RequirePermiso('integracion-sap:read')
  @ApiOperation({ summary: 'Catálogo local de empleados vs Odoo HR: comparación lado a lado' })
  async comparacionEmpleados(
    @Query('q') q?: string,
    @Query('empresa') empresa = 'DEFAULT',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    const pageNum = page ?? 1;
    const limitNum = limit ?? 50;
    const offset = (pageNum - 1) * limitNum;

    const { items, total } = await this.catalogoEmpleadoService.buscarPaginado(empresa, q ?? '', limitNum, offset);

    let odooEmpleados: Array<import('./salida-bodega/application/ports/odoo-rrhh.port').EmpleadoOdooResumen> = [];
    try {
      odooEmpleados = await this.odooRRHH.consultarEmpleadosPorCodigos(items.map(e => e.empleadoCodigo));
    } catch {
      // Si Odoo falla, devolvemos datos locales con odoo=null
    }

    const odooMap = new Map(odooEmpleados.map(o => [o.barcode ?? '', o]));

    return {
      total,
      page: pageNum,
      limit: limitNum,
      items: items.map(local => ({
        empleadoCodigo: local.empleadoCodigo,
        nombreCompleto: local.nombreCompleto,
        departamento: local.departamento,
        puesto: local.puesto,
        local: {
          dpi: local.dpi,
          correo: local.correoTrabajo,
          telefono: local.telefono,
          fechaIngreso: local.fechaIngreso,
          odooSincEstado: local.odooSincEstado,
        },
        odoo: odooMap.get(local.empleadoCodigo) ?? null,
      })),
    };
  }

  @Get('catalogo/comparacion')
  @RequirePermiso('integracion-sap:read')
  @ApiOperation({ summary: 'Catálogo completo vs Odoo: items con inventario SAP + items Odoo sin inventario SAP (gris)' })
  async comparacionCatalogo(
    @Query('q') q?: string,
    @Query('empresa') empresa = 'DEFAULT',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    const pageNum = page ?? 1;
    const limitNum = limit ?? 50;
    const qTrim = (q ?? '').trim().toLowerCase();

    // 1. Catálogo local: items que aparecieron en el último Excel SAP (tienen inventario)
    const localItems = await this.catalogoService.buscarTodos(empresa);
    const localMap = new Map(localItems.map(i => [i.itemCode, i]));

    // 2. Todos los productos de Odoo
    let odooItems: Array<{ defaultCode: string; nombre: string; standardPrice: number; qtyAvailable: number }> = [];
    try {
      odooItems = await this.odooCatalogo.listarTodosProductos();
    } catch {
      // Si Odoo falla, mostramos solo los locales
    }
    const odooMap = new Map(odooItems.map(o => [o.defaultCode, o]));

    // 3. Merge: Odoo como base + items locales que no están en Odoo
    type MergedItem = {
      itemCode: string; itemName: string; uomCode?: string | null;
      local: { precio: number | null; cantidad: number | null } | null;
      odoo: { defaultCode: string; nombre: string; standardPrice: number; qtyAvailable: number } | null;
      sinInventarioSap: boolean;
    };

    const merged: MergedItem[] = [];

    for (const odoo of odooItems) {
      const local = localMap.get(odoo.defaultCode) ?? null;
      merged.push({
        itemCode: odoo.defaultCode,
        itemName: local?.itemName ?? odoo.nombre,
        uomCode: local?.uomCode ?? null,
        local: local ? { precio: local.precioUnitario ?? null, cantidad: local.cantidadSap ?? null } : null,
        odoo,
        sinInventarioSap: local === null,
      });
    }

    // Items locales que no existen en Odoo (aún no sincronizados)
    for (const local of localItems) {
      if (!odooMap.has(local.itemCode)) {
        merged.push({
          itemCode: local.itemCode,
          itemName: local.itemName,
          uomCode: local.uomCode ?? null,
          local: { precio: local.precioUnitario ?? null, cantidad: local.cantidadSap ?? null },
          odoo: null,
          sinInventarioSap: false,
        });
      }
    }

    // 4. Filtro de búsqueda en memoria
    const filtered = qTrim.length >= 2
      ? merged.filter(i =>
          i.itemCode.toLowerCase().includes(qTrim) ||
          i.itemName.toLowerCase().includes(qTrim),
        )
      : merged;

    // 5. Orden: items con inventario SAP primero, luego grisitos; dentro de cada grupo por código
    filtered.sort((a, b) => {
      if (a.sinInventarioSap !== b.sinInventarioSap) return a.sinInventarioSap ? 1 : -1;
      return a.itemCode.localeCompare(b.itemCode);
    });

    // 6. Paginación en memoria
    const total = filtered.length;
    const offset = (pageNum - 1) * limitNum;
    const pageItems = filtered.slice(offset, offset + limitNum);

    return { total, page: pageNum, limit: limitNum, items: pageItems };
  }
}
