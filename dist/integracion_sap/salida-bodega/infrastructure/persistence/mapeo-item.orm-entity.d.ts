export declare class MapeoItemOrmEntity {
    id: string;
    empresaCodigo: string;
    itemCodeSap: string;
    odooProductId: number;
    factorUom: number;
    activo: boolean;
    notas: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class MapeoBodegaOrmEntity {
    id: string;
    empresaCodigo: string;
    whsCodeSap: string;
    odooLocationId: number;
    odooPickingTypeId: number;
    odooLocationDestId: number;
    activo: boolean;
    notas: string;
    createdAt: Date;
    updatedAt: Date;
}
