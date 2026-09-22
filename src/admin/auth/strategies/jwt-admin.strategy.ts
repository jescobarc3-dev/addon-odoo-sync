import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';

export interface JwtAdminPayload {
  sub: string;
  email: string;
  rol: string;
}

function extractFromCookie(req: Request): string | null {
  return req?.cookies?.admin_token ?? null;
}

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractFromCookie]),
      ignoreExpiration: false,
      secretOrKey: process.env.ADMIN_JWT_SECRET || 'changeme',
    });
  }

  validate(payload: JwtAdminPayload) {
    if (!payload?.sub) throw new UnauthorizedException();
    return payload;
  }
}
