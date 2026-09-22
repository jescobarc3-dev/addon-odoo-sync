import { Repository } from 'typeorm';
import { RegistroSincronizacionOrmEntity } from './registro-sincronizacion.orm-entity';
import { IRegistroSincronizacionRepository } from '../../domain/repositories/registro-sincronizacion.repository';
import { RegistroSincronizacion } from '../../domain/entities/registro-sincronizacion.entity';
export declare class RegistroSincronizacionTypeormRepository implements IRegistroSincronizacionRepository {
    private readonly repo;
    constructor(repo: Repository<RegistroSincronizacionOrmEntity>);
    private toEntity;
    findByEmpresaDocnum(empresaCodigo: string, sapDocnum: number): Promise<RegistroSincronizacion | null>;
    findByHashPdf(hashPdf: string): Promise<RegistroSincronizacion | null>;
    save(registro: RegistroSincronizacion): Promise<RegistroSincronizacion>;
    findByEstado(estado: string, limit?: number): Promise<RegistroSincronizacion[]>;
    findAll(filtros?: {
        estado?: string;
        docnum?: number;
    }, page?: number, limit?: number): Promise<{
        items: RegistroSincronizacion[];
        total: number;
    }>;
    findById(id: string): Promise<RegistroSincronizacion | null>;
}
