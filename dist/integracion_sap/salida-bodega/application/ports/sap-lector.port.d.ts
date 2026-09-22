export declare const SAP_LECTOR_PORT: unique symbol;
export interface LineaSalidaSap {
    lineNum: number;
    itemCode: string;
    descripcion: string;
    cantidad: number;
    whsCode: string;
    uomCode: string;
    lotes: string[];
}
export interface SalidaSap {
    docEntry: number;
    docNum: number;
    docDate: Date;
    lineas: LineaSalidaSap[];
}
export interface ISapLectorPort {
    obtenerSalidaPorDocnum(empresaCodigo: string, docNum: number): Promise<SalidaSap | null>;
}
