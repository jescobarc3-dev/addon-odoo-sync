import { IRegistroSincronizacionRepository } from '../../domain/repositories/registro-sincronizacion.repository';
import { IMapeoItemRepository } from '../../domain/repositories/mapeo-item.repository';
import { ISapCatalogoPort } from '../ports/sap-catalogo.port';
import { IOdooCatalogoPort } from '../ports/odoo-catalogo.port';
import { EventoDocumentoValidado } from './procesar-salida-bodega.use-case';
export interface ResultadoInventario {
    creados: number;
    actualizados: number;
    ajustados: number;
    sinCambio: number;
    errores: string[];
}
export declare class ProcesarInventarioInicialUseCase {
    private readonly registroRepo;
    private readonly sapCatalogo;
    private readonly odooCatalogo;
    private readonly mapeoRepo;
    private readonly logger;
    constructor(registroRepo: IRegistroSincronizacionRepository, sapCatalogo: ISapCatalogoPort, odooCatalogo: IOdooCatalogoPort, mapeoRepo: IMapeoItemRepository);
    ejecutar(evento: EventoDocumentoValidado): Promise<ResultadoInventario>;
}
