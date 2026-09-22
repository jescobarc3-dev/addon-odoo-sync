import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { OdooConexionOrmEntity } from '../entities/odoo-conexion.orm-entity';
import { CryptoService } from '../crypto/crypto.service';

export interface CreateConexionDto {
  nombre: string;
  odooUrl: string;
  odooDB: string;
  odooUser: string;
  odooPassword: string;
}

@Injectable()
export class OdooConfigService {
  private readonly logger = new Logger(OdooConfigService.name);

  constructor(
    @InjectRepository(OdooConexionOrmEntity)
    private readonly repo: Repository<OdooConexionOrmEntity>,
    private readonly crypto: CryptoService,
  ) {}

  private safeConexion(c: OdooConexionOrmEntity) {
    const { odooPasswordEnc: _omit, ...safe } = c as any;
    return safe;
  }

  async findAll() {
    const rows = await this.repo.find({ order: { creadoEn: 'ASC' } });
    return rows.map(this.safeConexion);
  }

  async findOne(id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Conexión no encontrada');
    return this.safeConexion(c);
  }

  async create(dto: CreateConexionDto) {
    if (!dto.odooPassword) throw new BadRequestException('Contraseña requerida');
    const enc = this.crypto.encrypt(dto.odooPassword);
    const c = this.repo.create({
      nombre: dto.nombre,
      odooUrl: dto.odooUrl.replace(/\/$/, ''),
      odooDB: dto.odooDB,
      odooUser: dto.odooUser,
      odooPasswordEnc: enc,
    });
    const saved = await this.repo.save(c);
    return this.safeConexion(saved);
  }

  async update(id: string, dto: Partial<CreateConexionDto>) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Conexión no encontrada');
    if (dto.nombre) c.nombre = dto.nombre;
    if (dto.odooUrl) c.odooUrl = dto.odooUrl.replace(/\/$/, '');
    if (dto.odooDB) c.odooDB = dto.odooDB;
    if (dto.odooUser) c.odooUser = dto.odooUser;
    if (dto.odooPassword) c.odooPasswordEnc = this.crypto.encrypt(dto.odooPassword);
    const saved = await this.repo.save(c);
    return this.safeConexion(saved);
  }

  async remove(id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Conexión no encontrada');
    await this.repo.remove(c);
    return { ok: true };
  }

  async testConexion(id: string): Promise<{ ok: boolean; version?: string; error?: string }> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Conexión no encontrada');

    let ok = false;
    let version: string | undefined;
    let error: string | undefined;

    try {
      const pwd = this.crypto.decrypt(c.odooPasswordEnc);
      const resp = await axios.post(
        `${c.odooUrl}/jsonrpc`,
        {
          jsonrpc: '2.0', method: 'call', id: 1,
          params: {
            service: 'common',
            method: 'authenticate',
            args: [c.odooDB, c.odooUser, pwd, {}],
          },
        },
        { timeout: 10000 },
      );
      const uid = resp.data?.result;
      if (uid && typeof uid === 'number') {
        ok = true;
        const verResp = await axios.post(
          `${c.odooUrl}/jsonrpc`,
          {
            jsonrpc: '2.0', method: 'call', id: 2,
            params: { service: 'common', method: 'version', args: [] },
          },
          { timeout: 5000 },
        );
        version = verResp.data?.result?.server_version ?? undefined;
      } else {
        error = 'Credenciales incorrectas (Odoo rechazó la autenticación)';
      }
    } catch (e: any) {
      error = e?.message ?? 'Error de conexión';
      this.logger.warn(`Test conexión ${id} falló: ${error}`);
    }

    await this.repo.update(id, {
      ultimoTest: new Date(),
      ultimoTestOk: ok,
      versionOdoo: version ?? c.versionOdoo,
    });

    return { ok, version, error };
  }
}
