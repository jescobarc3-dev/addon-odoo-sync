import {
  Controller, Post, Get, Put, Body, Res, Req, UseGuards, HttpCode, HttpStatus, NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AdminAuthService } from './admin-auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAdminGuard } from './guards/jwt-admin.guard';
import { JwtAdminPayload } from './strategies/jwt-admin.strategy';
import { AdminUsuarioOrmEntity } from '../entities/admin-usuario.orm-entity';
import { PortalUsuarioOrmEntity } from '../../portal/entities/portal-usuario.orm-entity';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
  maxAge: 15 * 60 * 1000,
};

const PORTAL_ACCESS_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
  maxAge: 4 * 60 * 60 * 1000,
};

const PORTAL_REFRESH_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/api/portal/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly authService: AdminAuthService,
    private readonly jwtService: JwtService,
    @InjectRepository(AdminUsuarioOrmEntity)
    private readonly adminRepo: Repository<AdminUsuarioOrmEntity>,
    @InjectRepository(PortalUsuarioOrmEntity)
    private readonly portalRepo: Repository<PortalUsuarioOrmEntity>,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const token = await this.authService.login(dto);
    res.cookie('admin_token', token, COOKIE_OPTS);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('admin_token', { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAdminGuard)
  me(@Req() req: Request & { user: JwtAdminPayload }) {
    return this.authService.me(req.user.sub);
  }

  // Cada admin vincula solo su propia cuenta Odoo — el sub del JWT garantiza que es su registro.
  @Put('odoo-login')
  @UseGuards(JwtAdminGuard)
  @HttpCode(HttpStatus.OK)
  async setOdooLogin(
    @Req() req: Request & { user: JwtAdminPayload },
    @Body() body: { odooLogin: string | null },
  ) {
    await this.authService.setOdooLogin(req.user.sub, body.odooLogin ?? null);
    return { ok: true };
  }

  @Post('switch-to-portal')
  @UseGuards(JwtAdminGuard)
  @HttpCode(HttpStatus.OK)
  async switchToPortal(
    @Req() req: Request & { user: JwtAdminPayload },
    @Res({ passthrough: true }) res: Response,
  ) {
    // Leer odoo_login del propio registro admin — solo accesible con el JWT de este usuario.
    const adminUser = await this.adminRepo.findOne({ where: { id: req.user.sub } });
    const emailBusqueda = (adminUser?.odooLogin ?? req.user.email).toLowerCase().trim();

    const portalUser = await this.portalRepo.findOne({
      where: { odooLogin: emailBusqueda, activo: true },
    });

    if (!portalUser) {
      throw new NotFoundException(
        adminUser?.odooLogin
          ? `El correo vinculado (${emailBusqueda}) no tiene cuenta activa en el portal.`
          : `Tu correo (${emailBusqueda}) no tiene cuenta activa. Configura tu correo Odoo en "Mi cuenta".`,
      );
    }

    const portalSecret = process.env.PORTAL_JWT_SECRET || 'changeme-portal';
    const refreshSecret = process.env.PORTAL_REFRESH_SECRET || 'changeme-refresh';

    const accessToken = this.jwtService.sign(
      { sub: portalUser.id, odooUid: portalUser.odooUid, email: portalUser.odooLogin, permisos: portalUser.permisos },
      { secret: portalSecret, expiresIn: '4h' },
    );
    const refreshToken = this.jwtService.sign(
      { sub: portalUser.id, type: 'refresh' },
      { secret: refreshSecret, expiresIn: '7d' },
    );

    res.cookie('portal_token', accessToken, PORTAL_ACCESS_OPTS);
    res.cookie('portal_refresh', refreshToken, PORTAL_REFRESH_OPTS);
    return { ok: true };
  }

  @Post('setup-totp')
  @UseGuards(JwtAdminGuard)
  @HttpCode(HttpStatus.OK)
  setupTotp(@Req() req: Request & { user: JwtAdminPayload }) {
    return this.authService.setupTotp(req.user.sub);
  }

  @Post('confirmar-totp')
  @UseGuards(JwtAdminGuard)
  @HttpCode(HttpStatus.OK)
  async confirmarTotp(
    @Req() req: Request & { user: JwtAdminPayload },
    @Body() body: { code: string },
  ) {
    await this.authService.confirmarTotp(req.user.sub, body.code);
    return { ok: true };
  }

  @Post('desactivar-totp')
  @UseGuards(JwtAdminGuard)
  @HttpCode(HttpStatus.OK)
  async desactivarTotp(
    @Req() req: Request & { user: JwtAdminPayload },
    @Body() body: { code: string },
  ) {
    await this.authService.desactivarTotp(req.user.sub, body.code);
    return { ok: true };
  }
}
