import {
  Controller, Get, Post, Put, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { OdooConfigService, CreateConexionDto } from './odoo-config.service';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';

@Controller('admin/config/odoo')
@UseGuards(JwtAdminGuard)
export class OdooConfigController {
  constructor(private readonly svc: OdooConfigService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @UseGuards(SuperadminGuard)
  create(@Body() dto: CreateConexionDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @UseGuards(SuperadminGuard)
  update(@Param('id') id: string, @Body() dto: Partial<CreateConexionDto>) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(SuperadminGuard)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post(':id/test')
  testConexion(@Param('id') id: string) {
    return this.svc.testConexion(id);
  }
}
