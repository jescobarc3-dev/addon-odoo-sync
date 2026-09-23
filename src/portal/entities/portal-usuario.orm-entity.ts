import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('portal_usuario')
export class PortalUsuarioOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'odoo_uid', type: 'int', unique: true })
  odooUid!: number;

  @Column({ name: 'odoo_login', unique: true })
  odooLogin!: string;

  @Column()
  nombre!: string;

  @Column('text', { name: 'permisos', array: true, default: '{}' })
  permisos!: string[];

  @Column({ default: true })
  activo!: boolean;

  @Column({ name: 'ultimo_login', nullable: true, type: 'timestamptz' })
  ultimoLogin!: Date | null;

  @Column({ name: 'sincronizado_en', nullable: true, type: 'timestamptz' })
  sincronizadoEn!: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
