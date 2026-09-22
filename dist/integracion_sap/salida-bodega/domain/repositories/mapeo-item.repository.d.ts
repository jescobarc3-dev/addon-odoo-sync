export declare const MAPEO_ITEM_REPOSITORY: unique symbol;
export interface MapeoItem {
    id: string;
    empresaCodigo: string;
    itemCodeSap: string;
    odooProductId: number;
    factorUom: number;
    activo: boolean;
    notas?: string;
}
export interface MapeoBodega {
    id: string;
    empresaCodigo: string;
    whsCodeSap: string;
    odooLocationId: number;
    odooPickingTypeId: number;
    odooLocationDestId: number;
    activo: boolean;
    notas?: string;
}
export interface IMapeoItemRepository {
    findItem(empresaCodigo: string, itemCodeSap: string): Promise<MapeoItem | null>;
    findBodega(empresaCodigo: string, whsCodeSap: string): Promise<MapeoBodega | null>;
    saveItem(item: Omit<MapeoItem, 'id'>): Promise<MapeoItem>;
    updateItem(id: string, data: Partial<MapeoItem>): Promise<MapeoItem>;
    findAllItems(empresaCodigo?: string): Promise<MapeoItem[]>;
    findAllBodegas(empresaCodigo?: string): Promise<MapeoBodega[]>;
}
