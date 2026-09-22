import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('admin_usuario')
export class AdminUsuarioOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ default: 'ADMIN' })
  rol!: 'ADMIN' | 'SUPERADMIN';

  @Column({ name: 'totp_secret', nullable: true })
  totpSecret!: string | null;

  @Column({ name: 'totp_activo', default: false })
  totpActivo!: boolean;

  @Column({ default: true })
  activo!: boolean;

  @Column({ name: 'ultimo_acceso', nullable: true, type: 'timestamptz' })
  ultimoAcceso!: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}
