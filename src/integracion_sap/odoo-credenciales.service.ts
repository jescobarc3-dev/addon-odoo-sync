import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OdooConexionOrmEntity } from '../admin/entities/odoo-conexion.orm-entity';
import { CryptoService } from '../admin/crypto/crypto.service';

export interface OdooCredenciales {
  url: string;
  db: string;
  user: string;
  password: string;
}

@Injectable()
export class OdooCredencialesService {
  private readonly logger = new Logger(OdooCredencialesService.name);

  constructor(
    @InjectRepository(OdooConexionOrmEntity)
    private readonly repo: Repository<OdooConexionOrmEntity>,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  async getActiva(): Promise<OdooCredenciales> {
    const conexion = await this.repo.findOne({
      where: { activa: true },
      order: { creadoEn: 'ASC' },
    });

    if (conexion) {
      const password = this.crypto.decrypt(conexion.odooPasswordEnc);
      this.logger.debug(`Usando conexión Odoo "${conexion.nombre}" (${conexion.odooUrl})`);
      return { url: conexion.odooUrl, db: conexion.odooDB, user: conexion.odooUser, password };
    }

    // Fallback a variables de entorno si no hay conexión configurada en BD
    const url = this.config.get<string>('ODOO_URL');
    const db = this.config.get<string>('ODOO_DB');
    const user = this.config.get<string>('ODOO_USER');
    const password = this.config.get<string>('ODOO_PASSWORD');

    if (!url || !db || !user || !password) {
      throw new NotFoundException(
        'No hay conexión Odoo configurada. Agrega ODOO_URL, ODOO_DB, ODOO_USER y ODOO_PASSWORD en el .env o configúrala en el panel de administración.',
      );
    }

    this.logger.debug(`Usando conexión Odoo desde .env (${url})`);
    return { url, db, user, password };
  }
}
