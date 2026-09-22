import { ConfigService } from '@nestjs/config';
import { IOdooInventarioPort, CrearPickingDto, ResultadoPicking } from '../../application/ports/odoo-inventario.port';
export declare class OdooInventarioRpcAdapter implements IOdooInventarioPort {
    private readonly cfg;
    private readonly logger;
    private uid;
    constructor(cfg: ConfigService);
    private get baseUrl();
    private rpc;
    private getUid;
    private execute;
    buscarProductoPorCodigo(_empresaCodigo: string, itemCode: string): Promise<number | null>;
    crearYValidarPicking(dto: CrearPickingDto): Promise<ResultadoPicking>;
}
