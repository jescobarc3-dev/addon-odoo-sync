export const ODOO_RRHH_PORT = Symbol('IOdooRRHHPort');

export interface EmpleadoOdooDto {
  nombreCompleto: string;
  empleadoCodigo: string;
  dpi?: string | null;
  departamento?: string | null;
  puesto?: string | null;
  correoTrabajo?: string | null;
  telefono?: string | null;
  fechaIngreso?: string | null;
}

export interface EmpleadoOdooResumen {
  id: number;
  nombre: string;
  barcode: string | null;
  ssnid: string | null;
  departamento: string | null;
  puesto: string | null;
  correoTrabajo: string | null;
  activo: boolean;
}

export interface IOdooRRHHPort {
  buscarEmpleado(empleadoCodigo: string, dpi?: string | null): Promise<number | null>;
  crearEmpleado(dto: EmpleadoOdooDto): Promise<number>;
  actualizarEmpleado(id: number, dto: Partial<EmpleadoOdooDto>): Promise<void>;
  consultarEmpleadosPorCodigos(codigos: string[]): Promise<EmpleadoOdooResumen[]>;
  resolverDepartamento(nombre: string): Promise<number>;
}
