import { Repository } from 'typeorm';
import { OdooConexionOrmEntity } from '../entities/odoo-conexion.orm-entity';
import { CryptoService } from '../crypto/crypto.service';
export interface CreateConexionDto {
    nombre: string;
    odooUrl: string;
    odooDB: string;
    odooUser: string;
    odooPassword: string;
}
export declare class OdooConfigService {
    private readonly repo;
    private readonly crypto;
    private readonly logger;
    constructor(repo: Repository<OdooConexionOrmEntity>, crypto: CryptoService);
    private safeConexion;
    findAll(): Promise<any[]>;
    findOne(id: string): Promise<any>;
    create(dto: CreateConexionDto): Promise<any>;
    update(id: string, dto: Partial<CreateConexionDto>): Promise<any>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
    testConexion(id: string): Promise<{
        ok: boolean;
        version?: string;
        error?: string;
    }>;
}
