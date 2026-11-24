import { Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'integracion_sap', name: 'catalogo_ubicacion' })
@Index(['empresaCodigo', 'puesto'], { unique: true })
export class CatalogoUbicacionOrmEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'empresa_codigo', length: 20 })
  empresaCodigo: string;

  @Column({ type: 'int' })
  puesto: number;

  @Column({ length: 255, nullable: true })
  cliente: string | null;

  @Column({ name: 'razon_social', length: 255, nullable: true })
  razonSocial: string | null;

  @Column({ length: 255, nullable: true })
  sucursal: string | null;

  @Column({ length: 100, nullable: true })
  area: string | null;

  @Column({ length: 100, nullable: true })
  industria: string | null;

  @Column({ length: 100, nullable: true })
  departamento: string | null;

  @Column({ length: 100, nullable: true })
  municipio: string | null;

  @Column({ type: 'int', nullable: true })
  zona: number | null;

  @Column({ type: 'text', nullable: true })
  direccion: string | null;

  @Column({ length: 100, nullable: true })
  categoria: string | null;

  @Column({ name: 'encargado_area', length: 255, nullable: true })
  encargadoArea: string | null;

  @Column({ length: 50, nullable: true })
  facturacion: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  posiciones: string[];

  /** 0–100. Penaliza campos vacíos y anomalías detectadas. */
  @Column({ name: 'calidad_score', type: 'smallint', default: 100 })
  calidadScore: number;

  /** Problemas de calidad detectados en el momento de la importación. */
  @Column({ type: 'text', array: true, default: '{}' })
  issues: string[];

  @Column({ default: true })
  activo: boolean;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
