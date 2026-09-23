import { Injectable, Logger } from '@nestjs/common';
import { ISapLectorPort, SalidaSap, EntradaSap } from '../../application/ports/sap-lector.port';

@Injectable()
export class SapLectorSqlAdapter implements ISapLectorPort {
  private readonly logger = new Logger(SapLectorSqlAdapter.name);

  async obtenerSalidaPorDocnum(_empresaCodigo: string, docNum: number): Promise<SalidaSap | null> {
    this.logger.warn(`SAP SQL no configurado — DocNum ${docNum} no se puede leer`);
    return null;
  }

  async obtenerEntradaPorDocnum(_empresaCodigo: string, docNum: number): Promise<EntradaSap | null> {
    this.logger.warn(`SAP SQL no configurado — entrada DocNum ${docNum} no se puede leer`);
    return null;
  }
}
