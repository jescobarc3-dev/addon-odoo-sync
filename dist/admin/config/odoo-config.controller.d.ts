import { OdooConfigService, CreateConexionDto } from './odoo-config.service';
export declare class OdooConfigController {
    private readonly svc;
    constructor(svc: OdooConfigService);
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
