export declare class OdooConexionOrmEntity {
    id: string;
    nombre: string;
    odooUrl: string;
    odooDB: string;
    odooUser: string;
    odooPasswordEnc: string;
    activa: boolean;
    versionOdoo: string | null;
    ultimoTest: Date | null;
    ultimoTestOk: boolean | null;
    creadoEn: Date;
    actualizadoEn: Date;
}
