import {
  Controller, Post, Get, Body, Res, Req, UseGuards,
  HttpCode, HttpStatus, Query, UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { PortalAuthService } from './portal-auth.service';
import { JwtPortalGuard } from './guards/jwt-portal.guard';
import { JwtPortalPayload } from './strategies/jwt-portal.strategy';

const ACCESS_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
  maxAge: 4 * 60 * 60 * 1000,
};

const REFRESH_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/api/portal/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller('portal/auth')
export class PortalAuthController {
  constructor(private readonly authService: PortalAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(body.email, body.password);
    res.cookie('portal_token', accessToken, ACCESS_OPTS);
    res.cookie('portal_refresh', refreshToken, REFRESH_OPTS);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('portal_token', { path: '/' });
    res.clearCookie('portal_refresh', { path: '/api/portal/auth/refresh' });
    return { ok: true };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['portal_refresh'];
    if (!token) throw new UnauthorizedException('No refresh token');
    const accessToken = await this.authService.refresh(token);
    res.cookie('portal_token', accessToken, ACCESS_OPTS);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtPortalGuard)
  me(@Req() req: Request & { user: JwtPortalPayload }) {
    return this.authService.me(req.user.sub);
  }

  @Post('generar-enlace')
  @UseGuards(JwtPortalGuard)
  @HttpCode(HttpStatus.OK)
  async generarEnlace(@Req() req: Request & { user: JwtPortalPayload }) {
    const token = await this.authService.generarMagicToken(req.user.sub);
    const base = (process.env.FRONTEND_URL || 'http://localhost:4000').replace(/\/$/, '');
    return { url: `${base}/portal/magic?t=${token}`, expiresEnSegundos: 120 };
  }

  // El backend maneja el magic link directamente — setea cookies y redirige
  @Get('magic')
  async magic(@Query('t') token: string, @Res() res: Response) {
    try {
      const { accessToken, refreshToken } = await this.authService.validarMagicToken(token);
      res.cookie('portal_token', accessToken, ACCESS_OPTS);
      res.cookie('portal_refresh', refreshToken, REFRESH_OPTS);
      return res.redirect('/integracion-sap/dashboard');
    } catch {
      return res.redirect('/portal/login?error=enlace_invalido');
    }
  }
}
