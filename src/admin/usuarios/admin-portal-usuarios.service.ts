import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import axios from 'axios';
import { PortalUsuarioOrmEntity } from '../../portal/entities/portal-usuario.orm-entity';
import { OdooConexionOrmEntity } from '../entities/odoo-conexion.orm-entity';
import { CryptoService } from '../crypto/crypto.service';

export const PERMISOS_DISPONIBLES = [
  'integracion-sap:read',
  'integracion-sap:cargar',
  'integracion-sap:mapear',
  'integracion-sap:revisar',
  'admin',
] as const;

@Injectable()
export class AdminPortalUsuariosService {
  private readonly logger = new Logger(AdminPortalUsuariosService.name);

  constructor(
    @InjectRepository(PortalUsuarioOrmEntity)
    private readonly repo: Repository<PortalUsuarioOrmEntity>,
    @InjectRepository(OdooConexionOrmEntity)
    private readonly conexionRepo: Repository<OdooConexionOrmEntity>,
    private readonly crypto: CryptoService,
  ) {}

  private async getOdooCreds() {
    const conexion = await this.conexionRepo.findOne({ where: { activa: true }, order: { creadoEn: 'ASC' } });
    if (conexion) {
      return {
        url: conexion.odooUrl,
        db: conexion.odooDB,
        user: conexion.odooUser,
        password: this.crypto.decrypt(conexion.odooPasswordEnc),
      };
    }
    const url = process.env.ODOO_URL;
    const db = process.env.ODOO_DB;
    const user = process.env.ODOO_USER;
    const password = process.env.ODOO_PASSWORD;
    if (!url || !db || !user || !password) throw new Error('No hay conexión Odoo configurada');
    return { url, db, user, password };
  }

  listar() {
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
    return usuario;
  }

  async cambiarPassword(id: string, password: string) {
    const u = await this.buscarPorId(id);
    await this.repo.update(u.id, { passwordHash: await bcrypt.hash(password, 12) });
  }

  async actualizarPermisos(id: string, permisos: string[]) {
    await this.buscarPorId(id);
    await this.repo.update(id, { permisos });
    return this.repo.findOne({ where: { id } });
  }

  async toggleActivo(id: string, activo: boolean) {
    await this.buscarPorId(id);
    await this.repo.update(id, { activo });
    return this.repo.findOne({ where: { id } });
  }

  async syncDesdeOdoo() {
    const creds = await this.getOdooCreds();

    const authRes = await axios.post(`${creds.url}/jsonrpc`, {
      jsonrpc: '2.0', method: 'call',
      params: { service: 'common', method: 'authenticate', args: [creds.db, creds.user, creds.password, {}] },
    }, { timeout: 10000 });

    const uid = authRes.data?.result;
    if (!uid) throw new Error('No se pudo autenticar en Odoo');

    const res = await axios.post(`${creds.url}/jsonrpc`, {
      jsonrpc: '2.0', method: 'call',
      params: {
        service: 'object', method: 'execute_kw',
        args: [creds.db, uid, creds.password, 'res.users', 'search_read',
          [[['active', '=', true], ['share', '=', false]]],
          { fields: ['id', 'name', 'login'], order: 'name asc' }],
      },
    }, { timeout: 15000 });

    const odooUsers: Array<{ id: number; name: string; login: string }> = res.data?.result ?? [];
    let nuevos = 0, actualizados = 0;

    for (const ou of odooUsers) {
      const existing = await this.repo.findOne({ where: { odooUid: ou.id } });
      if (existing) {
        await this.repo.update(existing.id, { nombre: ou.name, odooLogin: ou.login, sincronizadoEn: new Date() });
        actualizados++;
      } else {
        await this.repo.save(this.repo.create({
          odooUid: ou.id,
          odooLogin: ou.login,
          nombre: ou.name,
          permisos: ['integracion-sap:read'],
          activo: false,
          sincronizadoEn: new Date(),
        }));
        nuevos++;
      }
    }

    this.logger.log(`Sync Odoo: ${nuevos} nuevos, ${actualizados} actualizados`);
    return { nuevos, actualizados, total: odooUsers.length };
  }
}
