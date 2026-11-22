import {
  Controller, Post, Get, Body, Res, Req, UseGuards, HttpCode, HttpStatus, InternalServerErrorException,
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
import { PortalUsuarioOrmEntity } from '../../portal/entities/portal-usuario.orm-entity';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 min
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

  @Post('switch-to-portal')
  @UseGuards(JwtAdminGuard)
  @HttpCode(HttpStatus.OK)
  async switchToPortal(
    @Req() req: Request & { user: JwtAdminPayload },
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = req.user.email.toLowerCase().trim();
    const usuario = await this.portalRepo.findOne({
      where: { odooLogin: email, activo: true },
    });

    if (!usuario) {
      throw new InternalServerErrorException(
        `Tu correo (${email}) no tiene cuenta activa en el portal. Ve a Usuarios → Sincronizar desde Odoo y activa tu cuenta primero.`,
      );
    }

    const portalSecret = process.env.PORTAL_JWT_SECRET || 'changeme-portal';
    const refreshSecret = process.env.PORTAL_REFRESH_SECRET || 'changeme-refresh';

    const accessToken = this.jwtService.sign(
      { sub: usuario.id, odooUid: usuario.odooUid, email: usuario.odooLogin, permisos: usuario.permisos },
      { secret: portalSecret, expiresIn: '4h' },
    );
    const refreshToken = this.jwtService.sign(
      { sub: usuario.id, type: 'refresh' },
      { secret: refreshSecret, expiresIn: '7d' },
    );

    res.cookie('portal_token', accessToken, PORTAL_ACCESS_OPTS);
    res.cookie('portal_refresh', refreshToken, PORTAL_REFRESH_OPTS);
    return { ok: true };
  }
}
