import { IRegistroSincronizacionRepository } from './salida-bodega/domain/repositories/registro-sincronizacion.repository';
import { IMapeoItemRepository } from './salida-bodega/domain/repositories/mapeo-item.repository';
import { ProcesarSalidaBodegaUseCase } from './salida-bodega/application/use-cases/procesar-salida-bodega.use-case';
import { ProcesarInventarioInicialUseCase } from './salida-bodega/application/use-cases/procesar-inventario-inicial.use-case';
export declare class IntegracionSapController {
    private readonly registroRepo;
    private readonly mapeoRepo;
    private readonly procesarUseCase;
    private readonly procesarInventarioUseCase;
    constructor(registroRepo: IRegistroSincronizacionRepository, mapeoRepo: IMapeoItemRepository, procesarUseCase: ProcesarSalidaBodegaUseCase, procesarInventarioUseCase: ProcesarInventarioInicialUseCase);
    listarRegistros(estado?: string, docnum?: string, page?: number, limit?: number): Promise<{
        items: import("./salida-bodega/domain/entities/registro-sincronizacion.entity").RegistroSincronizacion[];
        total: number;
    }>;
    obtenerRegistro(id: string): Promise<import("./salida-bodega/domain/entities/registro-sincronizacion.entity").RegistroSincronizacion>;
    reprocesar(id: string): Promise<{
        error: string;
        ok?: undefined;
    } | {
        ok: boolean;
        error?: undefined;
    }>;
    listarMapeoItems(empresa?: string): Promise<import("./salida-bodega/domain/repositories/mapeo-item.repository").MapeoItem[]>;
    crearMapeoItem(body: any): Promise<import("./salida-bodega/domain/repositories/mapeo-item.repository").MapeoItem>;
    actualizarMapeoItem(id: string, body: any): Promise<import("./salida-bodega/domain/repositories/mapeo-item.repository").MapeoItem>;
    listarMapeoBodegas(empresa?: string): Promise<import("./salida-bodega/domain/repositories/mapeo-item.repository").MapeoBodega[]>;
    dispararInventario(body: {
        empresaCodigo: string;
        tipo: 'INVENTARIO_INICIAL' | 'ACTUALIZACION_INVENTARIO';
        hashPdf?: string;
    }): Promise<import("./salida-bodega/application/use-cases/procesar-inventario-inicial.use-case").ResultadoInventario>;
    dashboard(): Promise<{
        total: number;
        exitosos: number;
        errores: number;
        porcentajeAutomatico: number;
        backlog: number;
        porEstado: Record<string, number>;
    }>;
}
