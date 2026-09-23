import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { PortalUsuarioOrmEntity } from '../entities/portal-usuario.orm-entity';
import { OdooCredencialesService } from '../../integracion_sap/odoo-credenciales.service';

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
    private readonly odooCreds: OdooCredencialesService,
  ) {}

  async listar() {
    return this.repo.find({ order: { creadoEn: 'ASC' } });
  }

  async buscarPorId(id: string) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
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

  async syncDesdeOdoo(): Promise<{ nuevos: number; actualizados: number; total: number }> {
    const creds = await this.odooCreds.getActiva();

    // Autenticar como usuario de servicio
    const authRes = await axios.post(`${creds.url}/jsonrpc`, {
      jsonrpc: '2.0', method: 'call',
      params: { service: 'common', method: 'authenticate', args: [creds.db, creds.user, creds.password, {}] },
    }, { timeout: 10000 });

    const uid = authRes.data?.result;
    if (!uid) throw new Error('No se pudo autenticar en Odoo');

    const execute = async (model: string, method: string, args: any[], kwargs: any = {}) => {
      const res = await axios.post(`${creds.url}/jsonrpc`, {
        jsonrpc: '2.0', method: 'call',
        params: {
          service: 'object', method: 'execute_kw',
          args: [creds.db, uid, creds.password, model, method, args, kwargs],
        },
      }, { timeout: 15000 });
      if (res.data?.error) throw new Error(JSON.stringify(res.data.error));
      return res.data?.result;
    };

    // Traer usuarios internos activos (no usuarios de portal/public de Odoo)
    const odooUsers: Array<{ id: number; name: string; login: string }> = await execute(
      'res.users', 'search_read',
      [[['active', '=', true], ['share', '=', false]]],
      { fields: ['id', 'name', 'login'], order: 'name asc' },
    );

    let nuevos = 0, actualizados = 0;

    for (const ou of (odooUsers ?? [])) {
      const existing = await this.repo.findOne({ where: { odooUid: ou.id } });
      if (existing) {
        await this.repo.update(existing.id, {
          nombre: ou.name,
          odooLogin: ou.login,
          sincronizadoEn: new Date(),
        });
        actualizados++;
      } else {
        await this.repo.save(this.repo.create({
          odooUid: ou.id,
          odooLogin: ou.login,
          nombre: ou.name,
          permisos: ['integracion-sap:read'],
          activo: false, // Inactivos por defecto — el admin los activa
          sincronizadoEn: new Date(),
        }));
        nuevos++;
      }
    }

    this.logger.log(`Sync Odoo: ${nuevos} nuevos, ${actualizados} actualizados (total Odoo: ${(odooUsers ?? []).length})`);
    return { nuevos, actualizados, total: (odooUsers ?? []).length };
  }
}
