export const SAP_LECTOR_PORT = Symbol('ISapLectorPort');

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

export interface LineaEntradaSap {
  lineNum: number;
  itemCode: string;
  descripcion: string;
  cantidad: number;
  whsCode: string;
  uomCode: string;
  lotes: string[];
}

export interface EntradaSap {
  docEntry: number;
  docNum: number;
  docDate: Date;
  lineas: LineaEntradaSap[];
}

export interface ISapLectorPort {
  obtenerSalidaPorDocnum(empresaCodigo: string, docNum: number): Promise<SalidaSap | null>;
  obtenerEntradaPorDocnum(empresaCodigo: string, docNum: number): Promise<EntradaSap | null>;
}
