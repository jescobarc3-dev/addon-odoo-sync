import {
  Controller, Post, Get, Param, Body, UploadedFile,
  UseInterceptors, BadRequestException, UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DocumentoUploadService } from './documento-upload.service';
import { memoryStorage } from 'multer';
import { JwtPortalGuard } from '../../portal/auth/guards/jwt-portal.guard';
import { PortalPermisosGuard, RequirePermiso } from '../../portal/auth/guards/portal-permisos.guard';

const TIPO_VALIDOS = ['INVENTARIO_INICIAL', 'ACTUALIZACION_INVENTARIO', 'SALIDA_BODEGA', 'ENTRADA_MERCANCIA'];
const MAX_SIZE_MB = 20;

@ApiTags('documento-upload')
@Controller('integracion-sap/documentos')
@UseGuards(JwtPortalGuard, PortalPermisosGuard)
export class DocumentoUploadController {
  constructor(private readonly uploadService: DocumentoUploadService) {}

  @Post(':tipo/upload')
  @RequirePermiso('integracion-sap:cargar')
  @ApiOperation({ summary: 'Subir archivo Excel/CSV/PDF y obtener preview de las filas' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async upload(
    @Param('tipo') tipo: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!TIPO_VALIDOS.includes(tipo)) {
      throw new BadRequestException(`Tipo "${tipo}" no válido. Use: ${TIPO_VALIDOS.join(', ')}`);
    }
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      throw new BadRequestException(`El archivo supera el límite de ${MAX_SIZE_MB} MB`);
    }
    return this.uploadService.subirArchivo(file.buffer, file.mimetype, file.originalname, tipo);
  }

  @Get(':tipo/sesion/:uploadId')
  @ApiOperation({ summary: 'Recuperar preview de un upload previo' })
  obtenerSesion(@Param('uploadId') uploadId: string) {
    const s = this.uploadService.obtenerSesion(uploadId);
    return { uploadId: s.id, tipo: s.tipo, empresa: s.empresa, ...s.resultado };
  }

  @Post(':tipo/sesion/:uploadId/hoja')
  @RequirePermiso('integracion-sap:cargar')
  @ApiOperation({ summary: 'Cambiar hoja activa del Excel sin re-subir el archivo' })
  async cambiarHoja(
    @Param('uploadId') uploadId: string,
    @Body() body: { hoja: string },
  ) {
    if (!body?.hoja) throw new BadRequestException('Se requiere el nombre de la hoja.');
    return this.uploadService.cambiarHoja(uploadId, body.hoja);
  }

  @Post(':tipo/procesar/:uploadId')
  @RequirePermiso('integracion-sap:cargar')
  @ApiOperation({ summary: 'Iniciar procesamiento async — retorna jobId inmediatamente' })
  async procesar(
    @Param('tipo') tipo: string,
    @Param('uploadId') uploadId: string,
    @Body() body: { mapeoColumnas?: Record<string, string>; ubicacionOverrideId?: number; empresa?: string; referenciaSap?: string; whsCodeOverride?: string },
  ) {
    if (tipo === 'INVENTARIO_INICIAL' || tipo === 'ACTUALIZACION_INVENTARIO') {
      return this.uploadService.iniciarJob(uploadId, body.mapeoColumnas, body.ubicacionOverrideId);
    }
    if (tipo === 'SALIDA_BODEGA' || tipo === 'ENTRADA_MERCANCIA') {
      return this.uploadService.iniciarJobPicking(
        uploadId,
        tipo,
        body.empresa ?? 'DEFAULT',
        body.mapeoColumnas,
        body.referenciaSap,
        body.whsCodeOverride,
      );
    }
    throw new BadRequestException(`Tipo "${tipo}" no soportado aún en este endpoint.`);
  }

  @Get(':tipo/job/:jobId')
  @ApiOperation({ summary: 'Consultar estado de un job de procesamiento' })
  obtenerJob(@Param('jobId') jobId: string) {
    return this.uploadService.obtenerJob(jobId);
  }

  @Get(':tipo/historial')
  @ApiOperation({ summary: 'Últimas cargas de inventario para este tipo de documento' })
  async historial(@Param('tipo') tipo: string) {
    return this.uploadService.listarHistorial(tipo, 20);
  }
}
