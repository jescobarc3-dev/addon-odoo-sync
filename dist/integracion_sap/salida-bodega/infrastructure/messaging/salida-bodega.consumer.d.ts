import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProcesarSalidaBodegaUseCase } from '../../application/use-cases/procesar-salida-bodega.use-case';
import { ProcesarInventarioInicialUseCase } from '../../application/use-cases/procesar-inventario-inicial.use-case';
export declare class SalidaBodegaConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly cfg;
    private readonly procesarSalidaUseCase;
    private readonly procesarInventarioUseCase;
    private readonly logger;
    private connection;
    private channel;
    constructor(cfg: ConfigService, procesarSalidaUseCase: ProcesarSalidaBodegaUseCase, procesarInventarioUseCase: ProcesarInventarioInicialUseCase);
    onModuleInit(): Promise<void>;
    private connect;
    private despachar;
    onModuleDestroy(): Promise<void>;
}
