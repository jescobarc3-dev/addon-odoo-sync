import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async getActiva(): Promise<OdooCredenciales> {
    const conexion = await this.repo.findOne({
      where: { activa: true },
      order: { creadoEn: 'ASC' },
    });

    if (!conexion) {
      throw new NotFoundException(
        'No hay conexión Odoo configurada. Configúrala en el panel de administración.',
      );
    }

    const password = this.crypto.decrypt(conexion.odooPasswordEnc);
    this.logger.debug(`Usando conexión Odoo "${conexion.nombre}" (${conexion.odooUrl})`);

    return {
      url: conexion.odooUrl,
      db: conexion.odooDB,
      user: conexion.odooUser,
      password,
    };
  }
}
