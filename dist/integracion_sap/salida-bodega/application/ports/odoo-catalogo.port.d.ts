export declare const ODOO_CATALOGO_PORT: unique symbol;
export interface UpsertProductoDto {
    itemCode: string;
    nombre: string;
    categoriaOdooId?: number;
    categoriaNombre?: string;
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
export interface IOdooCatalogoPort {
    upsertProducto(dto: UpsertProductoDto): Promise<ResultadoUpsert>;
    resolverCategoria(nombreCategoria: string): Promise<number>;
    ajustarInventario(dto: AjusteInventarioDto): Promise<'ajustado' | 'sin_cambio'>;
    buscarUbicacion(whsCode: string): Promise<number | null>;
}
