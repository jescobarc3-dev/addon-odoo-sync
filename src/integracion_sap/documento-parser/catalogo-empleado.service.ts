import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogoEmpleadoOrmEntity } from './catalogo-empleado.orm-entity';

export interface EmpleadoCatalogo {
  empleadoCodigo: string;
  nombreCompleto: string;
  dpi?: string | null;
  departamento?: string | null;
  puesto?: string | null;
  correoTrabajo?: string | null;
  telefono?: string | null;
  fechaIngreso?: string | null;
  odooEmployeeId?: number | null;
  odooSincEstado?: string | null;
  odooSincError?: string | null;
}

@Injectable()
export class CatalogoEmpleadoService {
  private readonly logger = new Logger(CatalogoEmpleadoService.name);

  constructor(
    @InjectRepository(CatalogoEmpleadoOrmEntity)
    private readonly repo: Repository<CatalogoEmpleadoOrmEntity>,
  ) {}

  async upsertLote(empresa: string, empleados: EmpleadoCatalogo[]): Promise<void> {
    if (empleados.length === 0) return;

    const CHUNK = 200;
    for (let i = 0; i < empleados.length; i += CHUNK) {
      const chunk = empleados.slice(i, i + CHUNK);
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(CatalogoEmpleadoOrmEntity)
        .values(
          chunk.map(e => ({
            empresaCodigo: empresa,
            empleadoCodigo: e.empleadoCodigo,
            nombreCompleto: e.nombreCompleto,
            dpi: e.dpi ?? null,
            departamento: e.departamento ?? null,
            puesto: e.puesto ?? null,
            correoTrabajo: e.correoTrabajo ?? null,
            telefono: e.telefono ?? null,
            fechaIngreso: e.fechaIngreso ?? null,
            odooEmployeeId: e.odooEmployeeId ?? null,
            odooSincEstado: e.odooSincEstado ?? null,
            odooSincError: e.odooSincError ?? null,
            activo: true,
          })),
        )
        .orUpdate(
          [
            'nombre_completo', 'dpi', 'departamento', 'puesto',
            'correo_trabajo', 'telefono', 'fecha_ingreso',
            'odoo_employee_id', 'odoo_sinc_estado', 'odoo_sinc_error',
            'activo', 'actualizado_en',
          ],
          ['empresa_codigo', 'empleado_codigo'],
          { skipUpdateIfNoValuesChanged: true },
        )
        .execute();
    }

    this.logger.log(`Catálogo empleados upsert: ${empleados.length} registros empresa=${empresa}`);
  }

  async buscarPaginado(
    empresa: string,
    q: string,
    limit: number,
    offset: number,
  ): Promise<{ items: EmpleadoCatalogo[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.empresa_codigo = :emp', { emp: empresa })
      .andWhere('e.activo = true');

    if (q && q.trim().length >= 2) {
      qb.andWhere(
        '(e.nombre_completo ILIKE :q OR e.empleado_codigo ILIKE :q OR e.dpi ILIKE :q OR e.departamento ILIKE :q)',
        { q: `%${q.trim()}%` },
      );
    }

    const [rows, total] = await qb
      .orderBy('e.nombre_completo', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      items: rows.map(r => ({
        empleadoCodigo: r.empleadoCodigo,
        nombreCompleto: r.nombreCompleto,
        dpi: r.dpi,
        departamento: r.departamento,
        puesto: r.puesto,
        correoTrabajo: r.correoTrabajo,
        telefono: r.telefono,
        fechaIngreso: r.fechaIngreso,
        odooEmployeeId: r.odooEmployeeId,
        odooSincEstado: r.odooSincEstado,
        odooSincError: r.odooSincError,
      })),
      total,
    };
  }

  async contarActivos(empresa: string): Promise<number> {
    return this.repo.count({ where: { empresaCodigo: empresa, activo: true } });
  }
}
