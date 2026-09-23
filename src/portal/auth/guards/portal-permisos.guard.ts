import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const PERMISO_KEY = 'portal_permiso';
export const RequirePermiso = (permiso: string) => SetMetadata(PERMISO_KEY, permiso);

@Injectable()
export class PortalPermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const permiso = this.reflector.getAllAndOverride<string>(PERMISO_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!permiso) return true;

    const permisos: string[] = ctx.switchToHttp().getRequest().user?.permisos ?? [];
    if (permisos.includes('admin') || permisos.includes(permiso)) return true;

    throw new ForbiddenException(`Se requiere el permiso "${permiso}"`);
  }
}
