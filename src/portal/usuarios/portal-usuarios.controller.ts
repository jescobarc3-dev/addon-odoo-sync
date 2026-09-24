import {
  Controller, Get, Put, Post, Body, Param, UseGuards, HttpCode, HttpStatus,
  ForbiddenException, Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtPortalGuard } from '../auth/guards/jwt-portal.guard';
import { JwtPortalPayload } from '../auth/strategies/jwt-portal.strategy';
import { PortalUsuariosService, PERMISOS_DISPONIBLES } from './portal-usuarios.service';

@Controller('portal/usuarios')
@UseGuards(JwtPortalGuard)
export class PortalUsuariosController {
  constructor(private readonly service: PortalUsuariosService) {}

  private requireAdmin(req: Request & { user: JwtPortalPayload }) {
    if (!req.user.permisos?.includes('admin')) {
      throw new ForbiddenException('Se requiere permiso admin');
    }
  }

  @Get()
  listar(@Req() req: Request & { user: JwtPortalPayload }) {
    this.requireAdmin(req);
    return this.service.listar();
  }

  @Get('permisos-disponibles')
  permisosDisponibles(@Req() req: Request & { user: JwtPortalPayload }) {
    this.requireAdmin(req);
    return { permisos: [...PERMISOS_DISPONIBLES] };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crearUsuario(
    @Req() req: Request & { user: JwtPortalPayload },
    @Body() body: { nombre: string; email: string; password: string; permisos: string[] },
  ) {
    this.requireAdmin(req);
    return this.service.crearUsuario(body.nombre, body.email, body.password, body.permisos ?? []);
  }

  @Post('sync-odoo')
  @HttpCode(HttpStatus.OK)
  syncOdoo(@Req() req: Request & { user: JwtPortalPayload }) {
    this.requireAdmin(req);
    return this.service.syncDesdeOdoo();
  }

  @Put(':id/permisos')
  actualizarPermisos(
    @Req() req: Request & { user: JwtPortalPayload },
    @Param('id') id: string,
    @Body() body: { permisos: string[] },
  ) {
    this.requireAdmin(req);
    return this.service.actualizarPermisos(id, body.permisos);
  }

  @Put(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  cambiarPassword(
    @Req() req: Request & { user: JwtPortalPayload },
    @Param('id') id: string,
    @Body() body: { password: string },
  ) {
    this.requireAdmin(req);
    return this.service.cambiarPassword(id, body.password);
  }

  @Put(':id/activo')
  toggleActivo(
    @Req() req: Request & { user: JwtPortalPayload },
    @Param('id') id: string,
    @Body() body: { activo: boolean },
  ) {
    this.requireAdmin(req);
    return this.service.toggleActivo(id, body.activo);
  }
}
