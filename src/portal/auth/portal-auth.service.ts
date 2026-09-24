import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PortalUsuarioOrmEntity } from '../entities/portal-usuario.orm-entity';

@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);

  constructor(
    @InjectRepository(PortalUsuarioOrmEntity)
    private readonly repo: Repository<PortalUsuarioOrmEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const usuario = await this.repo.findOne({
      where: { odooLogin: email.toLowerCase().trim() },
    });

    // Misma respuesta si no existe el usuario o la contraseña es inválida
    if (!usuario || !usuario.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valid = await bcrypt.compare(password, usuario.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!usuario.activo) {
      this.logger.warn(`Login rechazado: usuario ${email} está desactivado`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.repo.update(usuario.id, { ultimoLogin: new Date() });

    this.logger.log(`Login exitoso: ${email}`);
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

    return {
      id: u.id,
      nombre: u.nombre,
      email: u.odooLogin,
      odooUid: u.odooUid,
      permisos: u.permisos,
      ultimoLogin: u.ultimoLogin,
      odooUrl: null,
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
