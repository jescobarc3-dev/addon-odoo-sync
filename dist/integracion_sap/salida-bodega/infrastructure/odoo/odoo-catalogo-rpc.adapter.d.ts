import { ConfigService } from '@nestjs/config';
import { IOdooCatalogoPort, UpsertProductoDto, ResultadoUpsert, AjusteInventarioDto } from '../../application/ports/odoo-catalogo.port';
export declare class OdooCatalogoRpcAdapter implements IOdooCatalogoPort {
    private readonly cfg;
    private readonly logger;
    private uid;
    private campoTipo;
    private _categoriaRaizId;
    private readonly cacheCategoria;
    private readonly cacheUbicacion;
    private readonly cacheProductos;
    constructor(cfg: ConfigService);
    private get baseUrl();
    private rpc;
    private getUid;
    private execute;
    private getCampoTipo;
    private getCategoriaRaizId;
    resolverCategoria(nombreCategoria: string): Promise<number>;
    upsertProducto(dto: UpsertProductoDto): Promise<ResultadoUpsert>;
    private _actualizarTemplate;
    ajustarInventario(dto: AjusteInventarioDto): Promise<'ajustado' | 'sin_cambio'>;
    buscarUbicacion(whsCode: string): Promise<number | null>;
}
