import { RegistroSincronizacion } from '../entities/registro-sincronizacion.entity';
export declare const REGISTRO_SINCRONIZACION_REPOSITORY: unique symbol;
export interface IRegistroSincronizacionRepository {
    findByEmpresaDocnum(empresaCodigo: string, sapDocnum: number): Promise<RegistroSincronizacion | null>;
    findByHashPdf(hashPdf: string): Promise<RegistroSincronizacion | null>;
    save(registro: RegistroSincronizacion): Promise<RegistroSincronizacion>;
    findByEstado(estado: string, limit?: number): Promise<RegistroSincronizacion[]>;
    findAll(filtros?: {
        estado?: string;
        docnum?: number;
    }, page?: number, limit?: number): Promise<{
        items: RegistroSincronizacion[];
        total: number;
    }>;
    findById(id: string): Promise<RegistroSincronizacion | null>;
}
