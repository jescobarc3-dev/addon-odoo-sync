export const SAP_CATALOGO_PORT = Symbol('ISapCatalogoPort');

export interface ItemSap {
  itemCode: string;
  itemName: string;
  grupoNombre: string;
  cantidadesPorBodega: { whsCode: string; onHand: number }[];
}

export interface ISapCatalogoPort {
  obtenerCatalogoCompleto(empresaCodigo: string): Promise<ItemSap[]>;
}
