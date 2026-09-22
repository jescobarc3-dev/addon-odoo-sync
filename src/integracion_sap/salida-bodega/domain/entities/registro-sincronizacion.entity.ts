export type EstadoSincronizacion =
  | 'recibido'
  | 'resuelto_sap'
  | 'mapeado'
  | 'creado_odoo'
  | 'validado_odoo'
  | 'error_sap'
  | 'error_mapeo'
  | 'error_stock_insuficiente'
  | 'error_odoo';

export const ESTADOS_TERMINALES: EstadoSincronizacion[] = ['validado_odoo'];
export const ESTADOS_REINTENTABLES: EstadoSincronizacion[] = [
  'error_sap', 'error_mapeo', 'error_stock_insuficiente', 'error_odoo',
];

export class RegistroSincronizacion {
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

  esTerminal(): boolean {
    return ESTADOS_TERMINALES.includes(this.estado);
  }

  puedeReintentarse(): boolean {
    return ESTADOS_REINTENTABLES.includes(this.estado);
  }

  transicionar(nuevoEstado: EstadoSincronizacion, error?: string): void {
    if (this.esTerminal()) {
      throw new Error(`No se puede transicionar desde estado terminal: ${this.estado}`);
    }
    this.estado = nuevoEstado;
    this.ultimoError = error ?? null;
    this.updatedAt = new Date();
  }
}
