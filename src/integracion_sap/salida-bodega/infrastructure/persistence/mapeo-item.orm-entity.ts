import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Unique,
} from 'typeorm';

@Entity({ name: 'mapeo_item', schema: 'integracion_sap' })
@Unique(['empresaCodigo', 'itemCodeSap'])
export class MapeoItemOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'empresa_codigo', length: 20 })
  empresaCodigo: string;

  @Column({ name: 'item_code_sap', length: 50 })
  itemCodeSap: string;

  @Column({ name: 'odoo_product_id', type: 'int' })
  odooProductId: number;

  @Column({ name: 'factor_uom', type: 'numeric', precision: 10, scale: 4, default: 1 })
  factorUom: number;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'text', nullable: true })
  notas: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ name: 'mapeo_bodega', schema: 'integracion_sap' })
@Unique('UQ_mapeo_bodega_empresa_whs_tipo', ['empresaCodigo', 'whsCodeSap', 'tipoOperacion'])
export class MapeoBodegaOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'empresa_codigo', length: 20 })
  empresaCodigo: string;

  @Column({ name: 'whs_code_sap', length: 20 })
  whsCodeSap: string;

  @Column({ name: 'tipo_operacion', length: 20, default: 'SALIDA' })
  tipoOperacion: string;

  @Column({ name: 'odoo_location_id', type: 'int' })
  odooLocationId: number;

  @Column({ name: 'odoo_picking_type_id', type: 'int' })
  odooPickingTypeId: number;

  @Column({ name: 'odoo_location_dest_id', type: 'int' })
  odooLocationDestId: number;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'text', nullable: true })
  notas: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
