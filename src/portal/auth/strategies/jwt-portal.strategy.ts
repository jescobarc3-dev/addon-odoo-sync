import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';

export interface JwtPortalPayload {
  sub: string;
  odooUid: number;
  email: string;
  permisos: string[];
}

@Injectable()
export class JwtPortalStrategy extends PassportStrategy(Strategy, 'jwt-portal') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['portal_token'] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.PORTAL_JWT_SECRET || 'changeme-portal',
    });
  }

  validate(payload: JwtPortalPayload) {
    if (!payload?.sub) throw new UnauthorizedException();
    return payload;
  }
}
