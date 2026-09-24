import {
  Controller, Get, Put, Post, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { AdminPortalUsuariosService, PERMISOS_DISPONIBLES } from './admin-portal-usuarios.service';

@Controller('admin/usuarios')
@UseGuards(JwtAdminGuard)
export class AdminUsuariosController {
  constructor(private readonly service: AdminPortalUsuariosService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  @Get('permisos-disponibles')
  permisosDisponibles() {
    return { permisos: [...PERMISOS_DISPONIBLES] };
  }

  @Post('sync-odoo')
  @HttpCode(HttpStatus.OK)
  syncOdoo() {
    return this.service.syncDesdeOdoo();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crearUsuario(@Body() body: { nombre: string; email: string; password: string; permisos: string[] }) {
    return this.service.crearUsuario(body.nombre, body.email, body.password, body.permisos ?? []);
  }

  @Put(':id/permisos')
  actualizarPermisos(@Param('id') id: string, @Body() body: { permisos: string[] }) {
    return this.service.actualizarPermisos(id, body.permisos);
  }

  @Put(':id/activo')
  toggleActivo(@Param('id') id: string, @Body() body: { activo: boolean }) {
    return this.service.toggleActivo(id, body.activo);
  }

  @Put(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  cambiarPassword(@Param('id') id: string, @Body() body: { password: string }) {
    return this.service.cambiarPassword(id, body.password);
  }
}
