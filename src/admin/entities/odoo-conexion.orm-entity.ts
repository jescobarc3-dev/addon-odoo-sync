import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('odoo_conexion')
export class OdooConexionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  nombre!: string;

  @Column({ name: 'odoo_url' })
  odooUrl!: string;

  @Column({ name: 'odoo_db' })
  odooDB!: string;

  @Column({ name: 'odoo_user' })
  odooUser!: string;

  @Column({ name: 'odoo_password_enc' })
  odooPasswordEnc!: string;

  @Column({ default: true })
  activa!: boolean;

  @Column({ name: 'version_odoo', nullable: true })
  versionOdoo!: string | null;

  @Column({ name: 'ultimo_test', nullable: true, type: 'timestamptz' })
  ultimoTest!: Date | null;

  @Column({ name: 'ultimo_test_ok', nullable: true })
  ultimoTestOk!: boolean | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
