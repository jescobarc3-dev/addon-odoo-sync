import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { OdooCredencialesService } from '../../../odoo-credenciales.service';
import {
  IOdooRRHHPort,
  EmpleadoOdooDto,
  EmpleadoOdooResumen,
} from '../../application/ports/odoo-rrhh.port';

@Injectable()
export class OdooRRHHRpcAdapter implements IOdooRRHHPort {
  private readonly logger = new Logger(OdooRRHHRpcAdapter.name);
  private uid: number | null = null;
  private readonly cacheDepartamento = new Map<string, number>();

  private cachedCreds: any = null;
  private credsCachedAt = 0;
  private readonly CREDS_TTL_MS = 5 * 60 * 1000;

  constructor(private readonly credenciales: OdooCredencialesService) {}

  private async getCreds() {
    if (this.cachedCreds && Date.now() - this.credsCachedAt < this.CREDS_TTL_MS) {
      return this.cachedCreds;
    }
    this.cachedCreds = await this.credenciales.getActiva();
    this.credsCachedAt = Date.now();
    return this.cachedCreds;
  }

  private async rpc(params: any): Promise<any> {
    const creds = await this.getCreds();
    const res = await axios.post(
      `${creds.url}/jsonrpc`,
      { jsonrpc: '2.0', method: 'call', params },
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 },
    );
    if (res.data.error) throw new Error(JSON.stringify(res.data.error));
    return res.data.result;
  }

  private async getUid(): Promise<number> {
    if (this.uid) return this.uid;
    const creds = await this.getCreds();
    this.uid = await this.rpc({
      service: 'common', method: 'authenticate',
      args: [creds.db, creds.user, creds.password, {}],
    });
    if (!this.uid) throw new Error('Autenticación Odoo fallida — verifica las credenciales en el panel admin');
    return this.uid;
  }

  private async execute(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    const uid = await this.getUid();
    const creds = await this.getCreds();
    return this.rpc({
      service: 'object', method: 'execute_kw',
      args: [creds.db, uid, creds.password, model, method, args, kwargs],
    });
  }

  async resolverDepartamento(nombre: string): Promise<number> {
    const key = nombre.toLowerCase().trim();
    if (this.cacheDepartamento.has(key)) return this.cacheDepartamento.get(key)!;

    const existing = await this.execute('hr.department', 'search_read',
      [[['name', 'ilike', nombre]]],
      { fields: ['id', 'name'], limit: 1 },
    );

    let deptId: number;
    if (existing?.length) {
      deptId = existing[0].id;
    } else {
      deptId = await this.execute('hr.department', 'create', [{ name: nombre }]);
      this.logger.log(`Departamento creado en Odoo: '${nombre}' (id=${deptId})`);
    }

    this.cacheDepartamento.set(key, deptId);
    return deptId;
  }

  async buscarEmpleado(empleadoCodigo: string, dpi?: string | null): Promise<number | null> {
    const domain: any[] = [['barcode', '=', empleadoCodigo], ['active', 'in', [true, false]]];
    const byCode = await this.execute('hr.employee', 'search_read',
      [domain],
      { fields: ['id'], limit: 1 },
    );
    if (byCode?.length) return byCode[0].id;

    if (dpi) {
      const byDpi = await this.execute('hr.employee', 'search_read',
        [[['ssnid', '=', dpi], ['active', 'in', [true, false]]]],
        { fields: ['id'], limit: 1 },
      );
      if (byDpi?.length) return byDpi[0].id;
    }

    return null;
  }

  async crearEmpleado(dto: EmpleadoOdooDto): Promise<number> {
    const vals: Record<string, any> = {
      name: dto.nombreCompleto,
      barcode: dto.empleadoCodigo,
      active: true,
    };
    if (dto.dpi) vals.ssnid = dto.dpi;
    if (dto.puesto) vals.job_title = dto.puesto;
    if (dto.correoTrabajo) vals.work_email = dto.correoTrabajo;
    if (dto.telefono) vals.mobile_phone = dto.telefono;
    if (dto.departamento) {
      vals.department_id = await this.resolverDepartamento(dto.departamento);
    }

    const id: number = await this.execute('hr.employee', 'create', [vals]);
    this.logger.log(`Empleado creado en Odoo: '${dto.nombreCompleto}' codigo=${dto.empleadoCodigo} (id=${id})`);
    return id;
  }

  async actualizarEmpleado(id: number, dto: Partial<EmpleadoOdooDto>): Promise<void> {
    const vals: Record<string, any> = {};
    if (dto.nombreCompleto) vals.name = dto.nombreCompleto;
    if (dto.empleadoCodigo) vals.barcode = dto.empleadoCodigo;
    if (dto.dpi != null) vals.ssnid = dto.dpi;
    if (dto.puesto != null) vals.job_title = dto.puesto;
    if (dto.correoTrabajo != null) vals.work_email = dto.correoTrabajo;
    if (dto.telefono != null) vals.mobile_phone = dto.telefono;
    if (dto.departamento) {
      vals.department_id = await this.resolverDepartamento(dto.departamento);
    }
    if (Object.keys(vals).length === 0) return;
    await this.execute('hr.employee', 'write', [[id], vals]);
  }

  async consultarEmpleadosPorCodigos(codigos: string[]): Promise<EmpleadoOdooResumen[]> {
    if (codigos.length === 0) return [];
    const result = await this.execute(
      'hr.employee',
      'search_read',
      [[['barcode', 'in', codigos], ['active', 'in', [true, false]]]],
      {
        fields: ['id', 'name', 'barcode', 'ssnid', 'department_id', 'job_title', 'work_email', 'active'],
        limit: codigos.length + 10,
      },
    );
    return (result ?? []).map((r: any) => ({
      id: r.id,
      nombre: r.name,
      barcode: r.barcode || null,
      ssnid: r.ssnid || null,
      departamento: Array.isArray(r.department_id) ? r.department_id[1] : null,
      puesto: r.job_title || null,
      correoTrabajo: r.work_email || null,
      activo: r.active ?? true,
    }));
  }
}
