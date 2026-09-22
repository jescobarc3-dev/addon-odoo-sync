export declare class AdminUsuarioOrmEntity {
    id: string;
    email: string;
    passwordHash: string;
    rol: 'ADMIN' | 'SUPERADMIN';
    totpSecret: string | null;
    totpActivo: boolean;
    activo: boolean;
    ultimoAcceso: Date | null;
    creadoEn: Date;
}
