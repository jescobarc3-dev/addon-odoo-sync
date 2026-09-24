import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PortalUsuarioOrmEntity } from './entities/portal-usuario.orm-entity';
import { PortalAuthController } from './auth/portal-auth.controller';
import { PortalAuthService } from './auth/portal-auth.service';
import { JwtPortalStrategy } from './auth/strategies/jwt-portal.strategy';
import { JwtPortalGuard } from './auth/guards/jwt-portal.guard';
import { PortalPermisosGuard } from './auth/guards/portal-permisos.guard';
import { PortalUsuariosController } from './usuarios/portal-usuarios.controller';
import { PortalUsuariosService } from './usuarios/portal-usuarios.service';
import { AdminModule } from '../admin/admin.module';
import { IntegracionSapModule } from '../integracion_sap/integracion-sap.module';

@Module({
  imports: [
    AdminModule,
    IntegracionSapModule,
    TypeOrmModule.forFeature([PortalUsuarioOrmEntity]),
    PassportModule,
    JwtModule.register({
      secret: process.env.PORTAL_JWT_SECRET || 'changeme-portal',
      signOptions: { expiresIn: '4h' },
    }),
  ],
  providers: [
    JwtPortalStrategy,
    JwtPortalGuard,
    PortalPermisosGuard,
    PortalAuthService,
    PortalUsuariosService,
  ],
  controllers: [PortalAuthController, PortalUsuariosController],
  exports: [JwtPortalGuard, PortalPermisosGuard, PortalAuthService],
})
export class PortalModule {}
