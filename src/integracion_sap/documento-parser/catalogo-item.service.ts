import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogoItemOrmEntity } from './catalogo-item.orm-entity';

export interface ItemCatalogo {
  itemCode: string;
  itemName: string;
  uomCode?: string;
  precioUnitario?: number | null;
}

@Injectable()
export class CatalogoItemService {
  private readonly logger = new Logger(CatalogoItemService.name);

  constructor(
    @InjectRepository(CatalogoItemOrmEntity)
    private readonly repo: Repository<CatalogoItemOrmEntity>,
  ) {}

  /**
   * UPSERT masivo desde un job de inventario.
   * Solo actualiza si el nombre o precio cambió para no pisar actualizado_en innecesariamente.
   */
  async upsertLote(empresa: string, items: ItemCatalogo[]): Promise<void> {
    if (items.length === 0) return;

    const CHUNK = 500;
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(CatalogoItemOrmEntity)
        .values(
          chunk.map(it => ({
            empresaCodigo: empresa,
            itemCode: it.itemCode,
            itemName: it.itemName,
            uomCode: it.uomCode ?? null,
            precioUnitario: it.precioUnitario ?? null,
            activo: true,
          })),
        )
        .orUpdate(
          ['item_name', 'uom_code', 'precio_unitario', 'activo', 'actualizado_en'],
          ['empresa_codigo', 'item_code'],
          { skipUpdateIfNoValuesChanged: true },
        )
        .execute();
    }

    this.logger.log(`Catálogo upsert: ${items.length} items empresa=${empresa}`);
  }

  /** Búsqueda exacta por código — para validar/corregir el parser. */
  async buscarPorCodigo(empresa: string, code: string): Promise<ItemCatalogo | null> {
    const row = await this.repo.findOne({
      where: { empresaCodigo: empresa, itemCode: code, activo: true },
      select: ['itemCode', 'itemName', 'uomCode', 'precioUnitario'],
    });
    if (!row) return null;
    return { itemCode: row.itemCode, itemName: row.itemName, uomCode: row.uomCode ?? undefined, precioUnitario: row.precioUnitario };
  }

  /**
   * Búsqueda de texto libre — full-text PostgreSQL + fallback ILIKE.
   * Devuelve hasta `limit` resultados. Usado para autocompletar en el frontend.
   */
  async buscar(empresa: string, q: string, limit = 20): Promise<ItemCatalogo[]> {
    if (!q || q.trim().length < 2) {
      const rows = await this.repo.find({
        where: { empresaCodigo: empresa, activo: true },
        select: ['itemCode', 'itemName', 'uomCode', 'precioUnitario'],
        order: { itemCode: 'ASC' },
        take: limit,
      });
      return rows.map(r => ({ itemCode: r.itemCode, itemName: r.itemName, uomCode: r.uomCode ?? undefined, precioUnitario: r.precioUnitario }));
    }

    const normalized = q.trim();

    // Intento exact/prefix match por código primero (más rápido y preciso)
    const byCode = await this.repo
      .createQueryBuilder('c')
      .where('c.empresa_codigo = :emp', { emp: empresa })
      .andWhere('c.activo = true')
      .andWhere('c.item_code ILIKE :code', { code: `${normalized}%` })
      .orderBy('c.item_code', 'ASC')
      .limit(limit)
      .getMany();

    if (byCode.length > 0) return byCode.map(r => ({ itemCode: r.itemCode, itemName: r.itemName, uomCode: r.uomCode ?? undefined }));

    // Full-text search por nombre
    const rows = await this.repo
      .createQueryBuilder('c')
      .where('c.empresa_codigo = :emp', { emp: empresa })
      .andWhere('c.activo = true')
      .andWhere(
        `to_tsvector('simple', c.item_name || ' ' || c.item_code) @@ plainto_tsquery('simple', :q)`,
        { q: normalized },
      )
      .orderBy('c.item_code', 'ASC')
      .limit(limit)
      .getMany();

    if (rows.length > 0) return rows.map(r => ({ itemCode: r.itemCode, itemName: r.itemName, uomCode: r.uomCode ?? undefined }));

    // Fallback ILIKE para términos muy cortos o con caracteres especiales
    const fallback = await this.repo
      .createQueryBuilder('c')
      .where('c.empresa_codigo = :emp', { emp: empresa })
      .andWhere('c.activo = true')
      .andWhere('(c.item_name ILIKE :q OR c.item_code ILIKE :q)', { q: `%${normalized}%` })
      .orderBy('c.item_code', 'ASC')
      .limit(limit)
      .getMany();

    return fallback.map(r => ({ itemCode: r.itemCode, itemName: r.itemName, uomCode: r.uomCode ?? undefined }));
  }

  /** Total de items en el catálogo — para el dashboard. */
  async contarActivos(empresa: string): Promise<number> {
    return this.repo.count({ where: { empresaCodigo: empresa, activo: true } });
  }
}
