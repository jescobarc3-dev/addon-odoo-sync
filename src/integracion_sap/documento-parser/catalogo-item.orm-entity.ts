import { Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'integracion_sap', name: 'catalogo_item' })
@Index(['empresaCodigo', 'itemCode'], { unique: true })
export class CatalogoItemOrmEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'empresa_codigo', length: 20 })
  empresaCodigo: string;

  @Column({ name: 'item_code', length: 50 })
  itemCode: string;

  @Column({ name: 'item_name', length: 255 })
  itemName: string;

  @Column({ name: 'uom_code', length: 20, nullable: true })
  uomCode: string | null;

  @Column({ name: 'precio_unitario', type: 'numeric', precision: 18, scale: 4, nullable: true })
  precioUnitario: number | null;

  @Column({ default: true })
  activo: boolean;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
