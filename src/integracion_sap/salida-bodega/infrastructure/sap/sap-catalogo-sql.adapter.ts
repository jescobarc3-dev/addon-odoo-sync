import { Injectable, Logger } from '@nestjs/common';
import { ISapCatalogoPort, ItemSap } from '../../application/ports/sap-catalogo.port';

@Injectable()
export class SapCatalogoSqlAdapter implements ISapCatalogoPort {
  private readonly logger = new Logger(SapCatalogoSqlAdapter.name);

  async obtenerCatalogoCompleto(empresaCodigo: string): Promise<ItemSap[]> {
    this.logger.warn(`SAP SQL no configurado — catálogo de ${empresaCodigo} no disponible`);
    return [];
  }
}
