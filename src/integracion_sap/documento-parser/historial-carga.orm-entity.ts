import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'historial_carga_inventario', schema: 'integracion_sap' })
export class HistorialCargaOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tipo', length: 60 })
  tipo: string;

  @Column({ name: 'nombre_archivo', length: 255, nullable: true })
  nombreArchivo: string | null;

  @Column({ name: 'total_filas', type: 'int', default: 0 })
  totalFilas: number;

  @Column({ name: 'ajustados', type: 'int', default: 0 })
  ajustados: number;

  @Column({ name: 'sin_cambio', type: 'int', default: 0 })
  sinCambio: number;

  @Column({ name: 'errores', type: 'int', default: 0 })
  errores: number;

  @Column({ name: 'sin_bodega', type: 'int', default: 0 })
  sinBodega: number;

  @Column({ name: 'con_on_hand_cero', type: 'int', default: 0 })
  conOnHandCero: number;

  @Column({ name: 'detalle_errores', type: 'jsonb', default: [] })
  detalleErrores: string[];

  @Column({ name: 'sin_bodega_lista', type: 'jsonb', default: [] })
  sinBodegaLista: string[];

  @Column({ name: 'estado', length: 20, default: 'completado' })
  estado: string;

  @Column({ name: 'error_fatal', type: 'text', nullable: true })
  errorFatal: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
