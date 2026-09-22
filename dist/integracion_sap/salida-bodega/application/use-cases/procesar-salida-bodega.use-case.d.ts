import { IRegistroSincronizacionRepository } from '../../domain/repositories/registro-sincronizacion.repository';
import { IMapeoItemRepository } from '../../domain/repositories/mapeo-item.repository';
import { ISapLectorPort } from '../ports/sap-lector.port';
import { IOdooInventarioPort } from '../ports/odoo-inventario.port';
export interface EventoDocumentoValidado {
    tipoDocumento: string;
    empresaCodigo: string;
    hashPdf: string;
    documentoArchivoId: string;
    identificador: string;
}
export declare class ProcesarSalidaBodegaUseCase {
    private readonly registroRepo;
    private readonly mapeoRepo;
    private readonly sapLector;
    private readonly odooInventario;
    private readonly logger;
    constructor(registroRepo: IRegistroSincronizacionRepository, mapeoRepo: IMapeoItemRepository, sapLector: ISapLectorPort, odooInventario: IOdooInventarioPort);
    ejecutar(evento: EventoDocumentoValidado): Promise<void>;
}
