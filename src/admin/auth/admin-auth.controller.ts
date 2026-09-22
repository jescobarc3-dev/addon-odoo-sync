import {
  Controller, Post, Get, Body, Res, Req, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAdminGuard } from './guards/jwt-admin.guard';
import { JwtAdminPayload } from './strategies/jwt-admin.strategy';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 min
};

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AdminAuthService) {}

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
}
