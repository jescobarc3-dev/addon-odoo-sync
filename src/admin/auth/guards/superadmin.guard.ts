import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest();
    if (request.user?.rol !== 'SUPERADMIN') {
      throw new ForbiddenException('Se requiere rol SUPERADMIN');
    }
    return true;
  }
}
