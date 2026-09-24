import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminUsuarioOrmEntity } from './entities/admin-usuario.orm-entity';
import { OdooConexionOrmEntity } from './entities/odoo-conexion.orm-entity';
import { CryptoService } from './crypto/crypto.service';
import { JwtAdminStrategy } from './auth/strategies/jwt-admin.strategy';
import { JwtAdminGuard } from './auth/guards/jwt-admin.guard';
import { SuperadminGuard } from './auth/guards/superadmin.guard';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminAuthController } from './auth/admin-auth.controller';
import { OdooConfigService } from './config/odoo-config.service';
import { OdooConfigController } from './config/odoo-config.controller';
import { AdminSeederService } from './seeder/admin-seeder.service';
import { AdminUsuariosController } from './usuarios/admin-usuarios.controller';
import { PortalModule } from '../portal/portal.module';

@Module({
  imports: [
    forwardRef(() => PortalModule),
    TypeOrmModule.forFeature([AdminUsuarioOrmEntity, OdooConexionOrmEntity]),
    PassportModule,
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET || 'changeme',
      signOptions: { expiresIn: '15m' },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }]),
  ],
  providers: [
    CryptoService,
    JwtAdminStrategy,
    JwtAdminGuard,
    SuperadminGuard,
    AdminAuthService,
    OdooConfigService,
    AdminSeederService,
  ],
  controllers: [AdminAuthController, OdooConfigController, AdminUsuariosController],
  exports: [CryptoService, OdooConfigService, TypeOrmModule, JwtAdminGuard, SuperadminGuard],
})
export class AdminModule {}
