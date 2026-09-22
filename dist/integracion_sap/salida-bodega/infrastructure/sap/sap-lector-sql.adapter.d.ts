import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISapLectorPort, SalidaSap } from '../../application/ports/sap-lector.port';
export declare class SapLectorSqlAdapter implements ISapLectorPort, OnModuleInit, OnModuleDestroy {
    private readonly cfg;
    private readonly logger;
    private pool;
    constructor(cfg: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private nombreBaseDatos;
    obtenerSalidaPorDocnum(empresaCodigo: string, docNum: number): Promise<SalidaSap | null>;
}
