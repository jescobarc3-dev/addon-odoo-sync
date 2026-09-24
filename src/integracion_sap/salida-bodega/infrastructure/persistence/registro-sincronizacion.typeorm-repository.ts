import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistroSincronizacionOrmEntity } from './registro-sincronizacion.orm-entity';
import { IRegistroSincronizacionRepository } from '../../domain/repositories/registro-sincronizacion.repository';
import { RegistroSincronizacion } from '../../domain/entities/registro-sincronizacion.entity';

@Injectable()
export class RegistroSincronizacionTypeormRepository implements IRegistroSincronizacionRepository {
  constructor(
    @InjectRepository(RegistroSincronizacionOrmEntity)
    private readonly repo: Repository<RegistroSincronizacionOrmEntity>,
  ) {}

  private toEntity(orm: RegistroSincronizacionOrmEntity): RegistroSincronizacion {
    return Object.assign(new RegistroSincronizacion(), orm as any);
  }

  async findByEmpresaDocnum(empresaCodigo: string, sapDocnum: number): Promise<RegistroSincronizacion | null> {
    const found = await this.repo.findOne({ where: { empresaCodigo, sapDocnum } });
    return found ? this.toEntity(found) : null;
  }

  async findByHashPdf(hashPdf: string): Promise<RegistroSincronizacion | null> {
    const found = await this.repo.findOne({ where: { hashPdf } });
    return found ? this.toEntity(found) : null;
  }

  async save(registro: RegistroSincronizacion): Promise<RegistroSincronizacion> {
    const saved = await this.repo.save(registro as any);
    return this.toEntity(saved);
  }

  async findByEstado(estado: string, limit = 50): Promise<RegistroSincronizacion[]> {
    const list = await this.repo.find({ where: { estado } as any, take: limit, order: { createdAt: 'DESC' } });
    return list.map((o) => this.toEntity(o));
  }

  async findAll(
    filtros: { estado?: string; docnum?: number } = {},
    page = 1,
    limit = 20,
  ): Promise<{ items: RegistroSincronizacion[]; total: number }> {
    const qb = this.repo.createQueryBuilder('r');
    if (filtros.estado === 'error') {
      qb.andWhere("r.estado LIKE 'error%'");
    } else if (filtros.estado) {
      qb.andWhere('r.estado = :estado', { estado: filtros.estado });
    }
    if (filtros.docnum) qb.andWhere('r.sapDocnum = :docnum', { docnum: filtros.docnum });
    qb.orderBy('r.createdAt', 'DESC').skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items: items.map((o) => this.toEntity(o)), total };
  }

  async findById(id: string): Promise<RegistroSincronizacion | null> {
    const found = await this.repo.findOne({ where: { id } });
    return found ? this.toEntity(found) : null;
  }
}
