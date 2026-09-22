import { ConfigService } from '@nestjs/config';
import { ISapCatalogoPort, ItemSap } from '../../application/ports/sap-catalogo.port';
export declare class SapCatalogoSqlAdapter implements ISapCatalogoPort {
    private readonly cfg;
    private readonly logger;
    constructor(cfg: ConfigService);
    private getPool;
    private nombreBaseDatos;
    obtenerCatalogoCompleto(empresaCodigo: string): Promise<ItemSap[]>;
}
