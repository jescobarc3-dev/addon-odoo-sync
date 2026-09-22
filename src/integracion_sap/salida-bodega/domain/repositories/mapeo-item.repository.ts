export const MAPEO_ITEM_REPOSITORY = Symbol('IMapeoItemRepository');

export interface MapeoItem {
  id: string;
  empresaCodigo: string;
  itemCodeSap: string;
  odooProductId: number;
  factorUom: number;
  activo: boolean;
  notas?: string;
}

export type TipoOperacionBodega = 'SALIDA' | 'ENTRADA';

export interface MapeoBodega {
  id: string;
  empresaCodigo: string;
  whsCodeSap: string;
  tipoOperacion: TipoOperacionBodega;
  odooLocationId: number;
  odooPickingTypeId: number;
  odooLocationDestId: number;
  activo: boolean;
  notas?: string;
}

export interface IMapeoItemRepository {
  findItem(empresaCodigo: string, itemCodeSap: string): Promise<MapeoItem | null>;
  findBodega(empresaCodigo: string, whsCodeSap: string, tipo?: TipoOperacionBodega): Promise<MapeoBodega | null>;
  saveItem(item: Omit<MapeoItem, 'id'>): Promise<MapeoItem>;
  updateItem(id: string, data: Partial<MapeoItem>): Promise<MapeoItem>;
  findAllItems(empresaCodigo?: string): Promise<MapeoItem[]>;
  findAllBodegas(empresaCodigo?: string): Promise<MapeoBodega[]>;
}
