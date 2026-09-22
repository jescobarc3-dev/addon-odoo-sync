import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index, Unique,
} from 'typeorm';

@Entity({ name: 'registro_sincronizacion', schema: 'integracion_sap' })
@Unique(['empresaCodigo', 'sapDocnum'])
@Unique(['hashPdf'])
@Index(['estado'])
export class RegistroSincronizacionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'empresa_codigo', length: 20 })
  empresaCodigo: string;

  @Column({ name: 'sap_docnum', type: 'int' })
  sapDocnum: number;

  @Column({ name: 'hash_pdf', length: 64 })
  hashPdf: string;

  @Column({ name: 'documento_archivo_id', length: 36, nullable: true })
  documentoArchivoId: string;

  @Column({ length: 40, default: 'recibido' })
  estado: string;

  @Column({ name: 'odoo_picking_id', type: 'int', nullable: true })
  odooPickingId: number;

  @Column({ name: 'odoo_origin', length: 60, nullable: true })
  odooOrigin: string;

  @Column({ name: 'ultimo_error', type: 'text', nullable: true })
  ultimoError: string;

  @Column({ type: 'smallint', default: 0 })
  intentos: number;

  @Column({ name: 'sap_doc_entry', type: 'int', nullable: true })
  sapDocEntry: number;

  @Column({ name: 'sap_doc_date', type: 'date', nullable: true })
  sapDocDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
