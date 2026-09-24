import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { PortalUsuarioOrmEntity } from '../entities/portal-usuario.orm-entity';
import { OdooCredencialesService } from '../../integracion_sap/odoo-credenciales.service';

const PERMISOS_DEFAULT = ['integracion-sap:read'];

@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);

  constructor(
    @InjectRepository(PortalUsuarioOrmEntity)
    private readonly repo: Repository<PortalUsuarioOrmEntity>,
    private readonly jwtService: JwtService,
    private readonly odooCreds: OdooCredencialesService,
  ) {}

  async login(email: string, password: string) {
    const creds = await this.odooCreds.getActiva();

    let uid: number | null = null;
    try {
      const res = await axios.post(`${creds.url}/jsonrpc`, {
        jsonrpc: '2.0', method: 'call',
        params: { service: 'common', method: 'authenticate', args: [creds.db, email, password, {}] },
      }, { timeout: 10000 });
      const result = res.data?.result;
      uid = typeof result === 'number' ? result : null;
    } catch (e: any) {
      this.logger.warn(`Error conectando a Odoo para login de ${email}: ${e.message}`);
      throw new UnauthorizedException('No se pudo contactar con Odoo');
    }

    if (!uid) throw new UnauthorizedException('Credenciales inválidas');

    // Obtener nombre del usuario en Odoo
    let odooNombre: string | null = null;
    try {
      const res = await axios.post(`${creds.url}/jsonrpc`, {
        jsonrpc: '2.0', method: 'call',
        params: {
          service: 'object', method: 'execute_kw',
          args: [creds.db, uid, password, 'res.users', 'read', [[uid]], { fields: ['name', 'login'] }],
        },
      }, { timeout: 10000 });
      odooNombre = res.data?.result?.[0]?.name ?? null;
    } catch {
      // No crítico — usamos email como fallback
    }

    let usuario = await this.repo.findOne({ where: { odooUid: uid } });

    if (!usuario) {
      // Primer usuario en el sistema → admin automático
      const total = await this.repo.count();
      const permisos = total === 0 ? ['integracion-sap:read', 'integracion-sap:cargar', 'integracion-sap:mapear', 'integracion-sap:revisar', 'admin'] : PERMISOS_DEFAULT;

      usuario = this.repo.create({
        odooUid: uid,
        odooLogin: email.toLowerCase().trim(),
        nombre: odooNombre ?? email,
        permisos,
        activo: true,
        sincronizadoEn: new Date(),
      });
      await this.repo.save(usuario);
      this.logger.log(`Nuevo usuario portal: ${email} (Odoo UID ${uid})${total === 0 ? ' — asignado como admin' : ''}`);
    } else if (!usuario.activo) {
      this.logger.warn(`Login rechazado: usuario ${email} está desactivado`);
      throw new UnauthorizedException('Credenciales inválidas');
    } else {
      await this.repo.update(usuario.id, {
        nombre: odooNombre ?? usuario.nombre,
        ultimoLogin: new Date(),
      });
    }

    return this._emitirTokens(usuario);
  }

  async refresh(refreshToken: string): Promise<string> {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.PORTAL_REFRESH_SECRET || 'changeme-refresh',
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException();

    const usuario = await this.repo.findOne({ where: { id: payload.sub, activo: true } });
    if (!usuario) throw new UnauthorizedException();

    return this.jwtService.sign(this._accessPayload(usuario));
  }

  async me(userId: string) {
    const u = await this.repo.findOne({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();

    const creds = await this.odooCreds.getActiva().catch(() => null);
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.odooLogin,
      odooUid: u.odooUid,
      permisos: u.permisos,
      ultimoLogin: u.ultimoLogin,
      odooUrl: creds?.url ?? null,
    };
  }

  async generarMagicToken(userId: string): Promise<string> {
    const u = await this.repo.findOne({ where: { id: userId, activo: true } });
    if (!u) throw new UnauthorizedException();
    return this.jwtService.sign(
      { sub: u.id, type: 'magic', odooUid: u.odooUid, email: u.odooLogin, permisos: u.permisos },
      { expiresIn: '2m', secret: process.env.PORTAL_JWT_SECRET || 'changeme-portal' },
    );
  }

  async validarMagicToken(token: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: process.env.PORTAL_JWT_SECRET || 'changeme-portal',
      });
    } catch {
      throw new UnauthorizedException('Enlace inválido o expirado');
    }
    if (payload.type !== 'magic') throw new UnauthorizedException('Token no es de tipo magic');

    const usuario = await this.repo.findOne({ where: { id: payload.sub, activo: true } });
    if (!usuario) throw new UnauthorizedException();

    await this.repo.update(usuario.id, { ultimoLogin: new Date() });
    return this._emitirTokens(usuario);
  }

  private _accessPayload(u: PortalUsuarioOrmEntity) {
    return { sub: u.id, odooUid: u.odooUid, email: u.odooLogin, permisos: u.permisos };
  }

  private _emitirTokens(u: PortalUsuarioOrmEntity) {
    const accessToken = this.jwtService.sign(this._accessPayload(u));
    const refreshToken = this.jwtService.sign(
      { sub: u.id, type: 'refresh' },
      { expiresIn: '7d', secret: process.env.PORTAL_REFRESH_SECRET || 'changeme-refresh' },
    );
    return { accessToken, refreshToken };
  }
}
