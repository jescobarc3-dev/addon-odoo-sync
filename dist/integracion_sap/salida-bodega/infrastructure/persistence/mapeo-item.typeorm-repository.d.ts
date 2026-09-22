import { Repository } from 'typeorm';
import { MapeoItemOrmEntity, MapeoBodegaOrmEntity } from './mapeo-item.orm-entity';
import { IMapeoItemRepository, MapeoItem, MapeoBodega } from '../../domain/repositories/mapeo-item.repository';
export declare class MapeoItemTypeormRepository implements IMapeoItemRepository {
    private readonly itemRepo;
    private readonly bodegaRepo;
    constructor(itemRepo: Repository<MapeoItemOrmEntity>, bodegaRepo: Repository<MapeoBodegaOrmEntity>);
    findItem(empresaCodigo: string, itemCodeSap: string): Promise<MapeoItem | null>;
    findBodega(empresaCodigo: string, whsCodeSap: string): Promise<MapeoBodega | null>;
    saveItem(data: Omit<MapeoItem, 'id'>): Promise<MapeoItem>;
    updateItem(id: string, data: Partial<MapeoItem>): Promise<MapeoItem>;
    findAllItems(empresaCodigo?: string): Promise<MapeoItem[]>;
    findAllBodegas(empresaCodigo?: string): Promise<MapeoBodega[]>;
}
