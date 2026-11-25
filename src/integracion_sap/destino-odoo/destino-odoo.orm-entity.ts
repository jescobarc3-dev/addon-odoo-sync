import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany,
} from 'typeorm';
import { DestinoCampoOrmEntity } from './destino-campo.orm-entity';

@Entity({ schema: 'integracion_sap', name: 'destino_odoo' })
export class DestinoOdooOrmEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'empresa_codigo', default: 'DEFAULT' })
  empresaCodigo: string;

  @Column()
  nombre: string;

  @Column()
  catalogo: string;

  @Column({ name: 'odoo_modelo' })
  odooModelo: string;

  @Column({ name: 'campo_clave_local' })
  campoClaveLocal: string;

  @Column({ name: 'campo_clave_odoo' })
  campoClaveOdoo: string;

  @Column({ name: 'auto_sync', default: false })
  autoSync: boolean;

  @Column({ default: true })
  activo: boolean;

  @Column({ name: 'ultima_sync', type: 'timestamptz', nullable: true })
  ultimaSync: Date | null;

  @Column({ name: 'ultimo_error', type: 'text', nullable: true })
  ultimoError: string | null;

  @Column({ name: 'creado_en', type: 'timestamptz', default: () => 'NOW()' })
  creadoEn: Date;

  @OneToMany(() => DestinoCampoOrmEntity, c => c.destino, { cascade: true, eager: true })
  campos: DestinoCampoOrmEntity[];
}
