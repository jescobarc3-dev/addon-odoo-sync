export const ODOO_CATALOGO_PORT = Symbol('IOdooCatalogoPort');

export interface UpsertProductoDto {
  itemCode: string;
  nombre: string;
  categoriaOdooId?: number;
  categoriaNombre?: string;
  precioUnitario?: number;
}

export interface ResultadoUpsert {
  tipo: 'creado' | 'actualizado';
  productTemplateId: number;
  productId: number;
}

export interface AjusteInventarioDto {
  productId: number;
  locationId: number;
  cantidadSap: number;
}

export interface ItemLote {
  itemCode: string;
  nombre: string;
  precioUnitario?: number;
  cantidadSap: number;
  locationId: number;
}

export interface ResultadoLote {
  ajustados: number;
  sinCambio: number;
  errores: Array<{ itemCode: string; error: string }>;
}

export interface UbicacionOdoo {
  id: number;
  nombre: string;
}

export interface IOdooCatalogoPort {
  upsertProducto(dto: UpsertProductoDto): Promise<ResultadoUpsert>;
  resolverCategoria(nombreCategoria: string): Promise<number>;
  ajustarInventario(dto: AjusteInventarioDto): Promise<'ajustado' | 'sin_cambio'>;
  procesarLoteInventario(items: ItemLote[], onProgreso?: (n: number) => void): Promise<ResultadoLote>;
  buscarUbicacion(whsCode: string): Promise<number | null>;
  listarUbicacionesInternas(): Promise<UbicacionOdoo[]>;
}
