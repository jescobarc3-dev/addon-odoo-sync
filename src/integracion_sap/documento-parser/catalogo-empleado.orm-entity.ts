import { Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'integracion_sap', name: 'catalogo_empleado' })
@Index(['empresaCodigo', 'empleadoCodigo'], { unique: true })
@Index(['empresaCodigo', 'dpi'], { unique: true, where: 'dpi IS NOT NULL' })
export class CatalogoEmpleadoOrmEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'empresa_codigo', length: 20 })
  empresaCodigo: string;

  @Column({ name: 'empleado_codigo', length: 50 })
  empleadoCodigo: string;

  @Column({ name: 'nombre_completo', length: 255 })
  nombreCompleto: string;

  @Column({ name: 'dpi', length: 20, nullable: true })
  dpi: string | null;

  @Column({ name: 'departamento', length: 100, nullable: true })
  departamento: string | null;

  @Column({ name: 'puesto', length: 100, nullable: true })
  puesto: string | null;

  @Column({ name: 'correo_trabajo', length: 150, nullable: true })
  correoTrabajo: string | null;

  @Column({ name: 'telefono', length: 30, nullable: true })
  telefono: string | null;

  @Column({ name: 'fecha_ingreso', type: 'date', nullable: true })
  fechaIngreso: string | null;

  @Column({ name: 'odoo_employee_id', nullable: true })
  odooEmployeeId: number | null;

  @Column({ name: 'odoo_sinc_estado', length: 20, nullable: true })
  odooSincEstado: string | null;

  @Column({ name: 'odoo_sinc_error', type: 'text', nullable: true })
  odooSincError: string | null;

  @Column({ default: true })
  activo: boolean;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
