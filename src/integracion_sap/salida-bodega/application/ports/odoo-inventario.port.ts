export const ODOO_INVENTARIO_PORT = Symbol('IOdooInventarioPort');

export type ResultadoPicking =
  | { tipo: 'ok'; pickingId: number; origin: string }
  | { tipo: 'stock_insuficiente'; pickingId?: number; movesNoAsignados: string[] }
  | { tipo: 'ya_existe'; pickingId: number; origin: string };

export interface LineaPickingOdoo {
  productId: number;
  cantidad: number;
  uomId?: number;
  lotes?: string[];
}

export interface CrearPickingDto {
  origin: string;
  pickingTypeId: number;
  locationId: number;
  locationDestId: number;
  lineas: LineaPickingOdoo[];
}

export interface IOdooInventarioPort {
  crearYValidarPicking(dto: CrearPickingDto): Promise<ResultadoPicking>;
  buscarProductoPorCodigo(empresaCodigo: string, itemCode: string): Promise<number | null>;
}
