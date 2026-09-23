import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapeoItemOrmEntity, MapeoBodegaOrmEntity } from './mapeo-item.orm-entity';
import { IMapeoItemRepository, MapeoItem, MapeoBodega, TipoOperacionBodega } from '../../domain/repositories/mapeo-item.repository';

@Injectable()
export class MapeoItemTypeormRepository implements IMapeoItemRepository {
  constructor(
    @InjectRepository(MapeoItemOrmEntity)
    private readonly itemRepo: Repository<MapeoItemOrmEntity>,
    @InjectRepository(MapeoBodegaOrmEntity)
    private readonly bodegaRepo: Repository<MapeoBodegaOrmEntity>,
  ) {}

  async findItem(empresaCodigo: string, itemCodeSap: string): Promise<MapeoItem | null> {
    const found = await this.itemRepo.findOne({ where: { empresaCodigo, itemCodeSap, activo: true } });
    return found as any ?? null;
  }

  async findBodega(empresaCodigo: string, whsCodeSap: string, tipo: TipoOperacionBodega = 'SALIDA'): Promise<MapeoBodega | null> {
    // Intenta con la empresa exacta; si no encuentra, cae a 'DEFAULT' como fallback.
    const found = await this.bodegaRepo.findOne({
      where: { empresaCodigo, whsCodeSap, tipoOperacion: tipo, activo: true },
    }) ?? (empresaCodigo !== 'DEFAULT'
      ? await this.bodegaRepo.findOne({ where: { empresaCodigo: 'DEFAULT', whsCodeSap, tipoOperacion: tipo, activo: true } })
      : null);
    return found as any ?? null;
  }

  async saveItem(data: Omit<MapeoItem, 'id'>): Promise<MapeoItem> {
    const saved = await this.itemRepo.save(data as any);
    return saved as any;
  }

  async updateItem(id: string, data: Partial<MapeoItem>): Promise<MapeoItem> {
    await this.itemRepo.update(id, data as any);
    return this.itemRepo.findOne({ where: { id } }) as any;
  }

  async findAllItems(empresaCodigo?: string): Promise<MapeoItem[]> {
    const where = empresaCodigo ? { empresaCodigo } : {};
    return this.itemRepo.find({ where } as any) as any;
  }

  async findAllBodegas(empresaCodigo?: string): Promise<MapeoBodega[]> {
    const where = empresaCodigo ? { empresaCodigo } : {};
    return this.bodegaRepo.find({ where } as any) as any;
  }

  async saveBodega(data: Omit<MapeoBodega, 'id'>): Promise<MapeoBodega> {
    const saved = await this.bodegaRepo.save(data as any);
    return saved as any;
  }

  async updateBodega(id: string, data: Partial<MapeoBodega>): Promise<MapeoBodega> {
    await this.bodegaRepo.update(id, data as any);
    return this.bodegaRepo.findOne({ where: { id } }) as any;
  }

  async deleteBodega(id: string): Promise<void> {
    await this.bodegaRepo.delete(id);
  }
}
