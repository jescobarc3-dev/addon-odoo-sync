import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { PortalUsuarioOrmEntity } from '../entities/portal-usuario.orm-entity';

export const PERMISOS_DISPONIBLES = [
  'integracion-sap:read',
  'integracion-sap:cargar',
  'integracion-sap:mapear',
  'integracion-sap:revisar',
  'admin',
] as const;

@Injectable()
export class PortalUsuariosService {
  private readonly logger = new Logger(PortalUsuariosService.name);

  constructor(
    @InjectRepository(PortalUsuarioOrmEntity)
    private readonly repo: Repository<PortalUsuarioOrmEntity>,
  ) {}

  async listar() {
    return this.repo.find({ order: { creadoEn: 'ASC' } });
  }

  async buscarPorId(id: string) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  async crearUsuario(nombre: string, email: string, password: string, permisos: string[]) {
    const existing = await this.repo.findOne({ where: { odooLogin: email.toLowerCase().trim() } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese correo');

    const passwordHash = await bcrypt.hash(password, 12);
    const usuario = this.repo.create({
      odooLogin: email.toLowerCase().trim(),
      nombre,
      passwordHash,
      permisos: permisos.length > 0 ? permisos : ['integracion-sap:read'],
      activo: true,
      odooUid: null,
    });
    await this.repo.save(usuario);
    this.logger.log(`Usuario creado: ${email}`);
    return usuario;
  }

  async cambiarPassword(id: string, password: string) {
    const u = await this.buscarPorId(id);
    const passwordHash = await bcrypt.hash(password, 12);
    await this.repo.update(u.id, { passwordHash });
    this.logger.log(`Contraseña actualizada para usuario ${u.odooLogin}`);
  }

  async actualizarPermisos(id: string, permisos: string[]) {
    const u = await this.buscarPorId(id);
    await this.repo.update(u.id, { permisos });
    return this.repo.findOne({ where: { id } });
  }

  async toggleActivo(id: string, activo: boolean) {
    const u = await this.buscarPorId(id);
    await this.repo.update(u.id, { activo });
    return this.repo.findOne({ where: { id } });
  }
}
