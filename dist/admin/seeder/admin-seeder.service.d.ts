import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AdminUsuarioOrmEntity } from '../entities/admin-usuario.orm-entity';
export declare class AdminSeederService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly logger;
    constructor(repo: Repository<AdminUsuarioOrmEntity>);
    onApplicationBootstrap(): Promise<void>;
}
