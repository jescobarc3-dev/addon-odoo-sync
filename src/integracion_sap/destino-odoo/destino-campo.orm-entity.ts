import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
} from 'typeorm';
import { DestinoOdooOrmEntity } from './destino-odoo.orm-entity';

@Entity({ schema: 'integracion_sap', name: 'destino_odoo_campo' })
export class DestinoCampoOrmEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DestinoOdooOrmEntity, d => d.campos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destino_id' })
  destino: DestinoOdooOrmEntity;

  @Column({ name: 'campo_local' })
  campoLocal: string;

  @Column({ name: 'campo_odoo' })
  campoOdoo: string;

  @Column({ default: 'char' })
  tipo: string;
}
