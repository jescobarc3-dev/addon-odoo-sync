import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as OtpLib from 'otplib';
import * as QRCode from 'qrcode';
const authenticator = (OtpLib as any).authenticator ?? (OtpLib as any).default?.authenticator ?? OtpLib;
import { AdminUsuarioOrmEntity } from '../entities/admin-usuario.orm-entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    @InjectRepository(AdminUsuarioOrmEntity)
    private readonly usuarioRepo: Repository<AdminUsuarioOrmEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<string> {
    const usuario = await this.usuarioRepo.findOne({
      where: { email: dto.email, activo: true },
    });

    if (!usuario) {
      // Constant-time to avoid user enumeration
      await bcrypt.compare(dto.password, '$2a$12$invalid.hash.padding.to.prevent.timing');
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valid = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    if (usuario.totpActivo && usuario.totpSecret) {
      if (!dto.totpCode) {
        throw new UnauthorizedException('Se requiere código TOTP');
      }
      const ok = authenticator.verify({
        token: dto.totpCode,
        secret: usuario.totpSecret,
      });
      if (!ok) throw new UnauthorizedException('Código TOTP inválido');
    }

    await this.usuarioRepo.update(usuario.id, { ultimoAcceso: new Date() });

    const token = this.jwtService.sign({
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    });

    this.logger.log(`Login exitoso: ${usuario.email} (${usuario.rol})`);
    return token;
  }

  async me(userId: string) {
    const u = await this.usuarioRepo.findOne({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    return { id: u.id, email: u.email, rol: u.rol, totpActivo: u.totpActivo, ultimoAcceso: u.ultimoAcceso };
  }

  async setupTotp(userId: string): Promise<{ secret: string; qrCodeDataUrl: string }> {
    const u = await this.usuarioRepo.findOne({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    if (u.totpActivo) throw new BadRequestException('TOTP ya está activo. Desactívalo primero.');

    const secret = authenticator.generateSecret();
    const otpAuthUrl = `otpauth://totp/Addon%20Odoo:${encodeURIComponent(u.email)}?secret=${secret}&issuer=Addon%20Odoo`;
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, { width: 240, margin: 2 });

    // Guardar secret pendiente de confirmación (aún no activo)
    await this.usuarioRepo.update(userId, { totpSecret: secret, totpActivo: false });

    return { secret, qrCodeDataUrl };
  }

  async confirmarTotp(userId: string, code: string): Promise<void> {
    const u = await this.usuarioRepo.findOne({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    if (!u.totpSecret) throw new BadRequestException('Primero ejecuta setup-totp');
    if (u.totpActivo) throw new BadRequestException('TOTP ya está activo');

    const ok = authenticator.verify({ token: code, secret: u.totpSecret });
    if (!ok) throw new BadRequestException('Código inválido');

    await this.usuarioRepo.update(userId, { totpActivo: true });
    this.logger.log(`TOTP activado para usuario ${u.email}`);
  }

  async desactivarTotp(userId: string, code: string): Promise<void> {
    const u = await this.usuarioRepo.findOne({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    if (!u.totpActivo || !u.totpSecret) throw new BadRequestException('TOTP no está activo');

    const ok = authenticator.verify({ token: code, secret: u.totpSecret });
    if (!ok) throw new BadRequestException('Código inválido');

    await this.usuarioRepo.update(userId, { totpSecret: null, totpActivo: false });
    this.logger.log(`TOTP desactivado para usuario ${u.email}`);
  }
}
