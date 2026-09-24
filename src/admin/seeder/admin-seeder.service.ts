import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AdminUsuarioOrmEntity } from '../entities/admin-usuario.orm-entity';

@Injectable()
export class AdminSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(
    @InjectRepository(AdminUsuarioOrmEntity)
    private readonly repo: Repository<AdminUsuarioOrmEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      const email = process.env.ADMIN_INITIAL_EMAIL || 'admin@protecciontotal.com.gt';
      const password = process.env.ADMIN_INITIAL_PASSWORD || 'Admin123!PT';
      const hash = await bcrypt.hash(password, 12);

      const existing = await this.repo.findOne({ where: { email } });
      if (existing) {
        await this.repo.update(existing.id, { passwordHash: hash });
        this.logger.log(`Superadmin sincronizado desde env: ${email}`);
      } else {
        await this.repo.save(
          this.repo.create({ email, passwordHash: hash, rol: 'SUPERADMIN' }),
        );
        this.logger.log(`Superadmin inicial creado: ${email}`);
      }
    } catch (e: any) {
      this.logger.error('No se pudo sincronizar superadmin', e?.message);
    }
  }
}
