import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { IntegracionSapModule } from './integracion_sap/integracion-sap.module';
import { AdminModule } from './admin/admin.module';
import { PortalModule } from './portal/portal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.get('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: ['dist/migrations/*.js'],
        migrationsRun: true,
        logging: cfg.get('NODE_ENV') !== 'production',
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    IntegracionSapModule,
    AdminModule,
    PortalModule,
  ],
})
export class AppModule {}
