export type EstadoSincronizacion = 'recibido' | 'resuelto_sap' | 'mapeado' | 'creado_odoo' | 'validado_odoo' | 'error_sap' | 'error_mapeo' | 'error_stock_insuficiente' | 'error_odoo';
export declare const ESTADOS_TERMINALES: EstadoSincronizacion[];
export declare const ESTADOS_REINTENTABLES: EstadoSincronizacion[];
export declare class RegistroSincronizacion {
    id: string;
    empresaCodigo: string;
    sapDocnum: number;
    hashPdf: string;
    documentoArchivoId?: string;
    estado: EstadoSincronizacion;
    odooPickingId?: number;
    odooOrigin?: string;
    ultimoError?: string;
    intentos: number;
    sapDocEntry?: number;
    sapDocDate?: Date;
    createdAt: Date;
    updatedAt: Date;
    esTerminal(): boolean;
    puedeReintentarse(): boolean;
    transicionar(nuevoEstado: EstadoSincronizacion, error?: string): void;
}
