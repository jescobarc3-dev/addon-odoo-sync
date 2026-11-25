import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { DestinoOdooOrmEntity } from './destino-odoo.orm-entity';
import { DestinoCampoOrmEntity } from './destino-campo.orm-entity';
import { OdooCredencialesService } from '../odoo-credenciales.service';
import { CatalogoUbicacionService } from '../documento-parser/catalogo-ubicacion.service';

export interface CampoOdooInfo {
  nombre: string;
  tipo: string;
  etiqueta: string;
}

export interface DestinoDto {
  empresaCodigo?: string;
  nombre: string;
  catalogo: string;
  odooModelo: string;
  campoClaveLocal: string;
  campoClaveOdoo: string;
  autoSync?: boolean;
  activo?: boolean;
  campos: { campoLocal: string; campoOdoo: string; tipo: string }[];
}

const TIPOS_ESCRIBIBLES = ['char', 'text', 'integer', 'float', 'boolean', 'date', 'datetime', 'many2one', 'selection'];

@Injectable()
export class DestinoOdooService {
  private readonly logger = new Logger(DestinoOdooService.name);
  private uid: number | null = null;

  constructor(
    @InjectRepository(DestinoOdooOrmEntity)
    private readonly repo: Repository<DestinoOdooOrmEntity>,
    @InjectRepository(DestinoCampoOrmEntity)
    private readonly camposRepo: Repository<DestinoCampoOrmEntity>,
    private readonly credenciales: OdooCredencialesService,
    private readonly ubicacionService: CatalogoUbicacionService,
  ) {}

  // ── RPC helpers ────────────────────────────────────────────────────────────

  private async rpc(params: any): Promise<any> {
    const creds = await this.credenciales.getActiva();
    const res = await axios.post(
      `${creds.url}/jsonrpc`,
      { jsonrpc: '2.0', method: 'call', params },
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 },
    );
    if (res.data.error) throw new Error(JSON.stringify(res.data.error));
    return res.data.result;
  }

  private async getUid(): Promise<number> {
    if (this.uid) return this.uid;
    const creds = await this.credenciales.getActiva();
    this.uid = await this.rpc({
      service: 'common', method: 'authenticate',
      args: [creds.db, creds.user, creds.password, {}],
    });
    if (!this.uid) throw new Error('Autenticación Odoo fallida');
    return this.uid;
  }

  private async execute(modelo: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    const uid = await this.getUid();
    const creds = await this.credenciales.getActiva();
    return this.rpc({
      service: 'object', method: 'execute_kw',
      args: [creds.db, uid, creds.password, modelo, method, args, kwargs],
    });
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async listar(empresa: string): Promise<DestinoOdooOrmEntity[]> {
    return this.repo.find({
      where: { empresaCodigo: empresa },
      order: { creadoEn: 'ASC' },
    });
  }

  async crear(dto: DestinoDto): Promise<DestinoOdooOrmEntity> {
    const entity = this.repo.create({
      empresaCodigo: dto.empresaCodigo ?? 'DEFAULT',
      nombre: dto.nombre,
      catalogo: dto.catalogo,
      odooModelo: dto.odooModelo,
      campoClaveLocal: dto.campoClaveLocal,
      campoClaveOdoo: dto.campoClaveOdoo,
      autoSync: dto.autoSync ?? false,
      activo: dto.activo ?? true,
      campos: dto.campos.map(c => this.camposRepo.create(c)),
    });
    return this.repo.save(entity);
  }

  async actualizar(id: number, dto: DestinoDto): Promise<DestinoOdooOrmEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`Destino ${id} no encontrado`);

    // Reemplazar campos por completo
    await this.camposRepo.delete({ destino: { id } });

    Object.assign(entity, {
      nombre: dto.nombre,
      catalogo: dto.catalogo,
      odooModelo: dto.odooModelo,
      campoClaveLocal: dto.campoClaveLocal,
      campoClaveOdoo: dto.campoClaveOdoo,
      autoSync: dto.autoSync ?? entity.autoSync,
      activo: dto.activo ?? entity.activo,
      campos: dto.campos.map(c => this.camposRepo.create(c)),
    });
    return this.repo.save(entity);
  }

  async eliminar(id: number): Promise<void> {
    await this.repo.delete(id);
  }

  // ── Buscar modelos Odoo (ir.model) ─────────────────────────────────────────

  async buscarModelosOdoo(q: string): Promise<{ modelo: string; nombre: string }[]> {
    const domain = q?.trim()
      ? ['|', ['model', 'ilike', q.trim()], ['name', 'ilike', q.trim()]]
      : [];
    const rows: { model: string; name: string }[] = await this.execute(
      'ir.model', 'search_read',
      [domain],
      { fields: ['model', 'name'], limit: 30, order: 'model asc' },
    );
    return rows.map(r => ({ modelo: r.model, nombre: r.name }));
  }

  // ── Descubrir campos de modelo Odoo ────────────────────────────────────────

  async obtenerCamposOdoo(modelo: string): Promise<CampoOdooInfo[]> {
    const fields: Record<string, { type: string; string: string; readonly?: boolean; store?: boolean }> =
      await this.execute(modelo, 'fields_get', [], { attributes: ['string', 'type', 'readonly', 'store'] });

    return Object.entries(fields)
      .filter(([, f]) => TIPOS_ESCRIBIBLES.includes(f.type) && f.readonly !== true)
      .map(([nombre, f]) => ({ nombre, tipo: f.type, etiqueta: f.string }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  // ── Motor de sincronización ────────────────────────────────────────────────

  async sincronizar(destinoId: number): Promise<{ ok: boolean; creados: number; actualizados: number; error?: string }> {
    const destino = await this.repo.findOne({ where: { id: destinoId } });
    if (!destino) throw new NotFoundException(`Destino ${destinoId} no encontrado`);

    try {
      const registros = await this._cargarRegistrosCatalogo(destino.empresaCodigo, destino.catalogo);
      if (registros.length === 0) {
        return { ok: true, creados: 0, actualizados: 0 };
      }

      // Buscar existentes en Odoo por campo clave
      const claves = registros.map(r => this._castValue(r[destino.campoClaveLocal], 'integer'));
      const existentes: { id: number; [k: string]: any }[] = await this.execute(
        destino.odooModelo, 'search_read',
        [[[destino.campoClaveOdoo, 'in', claves]]],
        { fields: [destino.campoClaveOdoo] },
      );
      const mapaExistentes = new Map(existentes.map(e => [String(e[destino.campoClaveOdoo]), e.id]));

      const toCreate: Record<string, any>[] = [];
      const toUpdate: { id: number; vals: Record<string, any> }[] = [];

      for (const reg of registros) {
        const payload = this._buildPayload(reg, destino.campos);
        const claveVal = String(this._castValue(reg[destino.campoClaveLocal], 'integer'));
        const odooId = mapaExistentes.get(claveVal);
        if (odooId) {
          toUpdate.push({ id: odooId, vals: payload });
        } else {
          payload[destino.campoClaveOdoo] = this._castValue(reg[destino.campoClaveLocal], 'integer');
          toCreate.push(payload);
        }
      }

      // Batch writes (50 por llamada)
      let actualizados = 0;
      const BATCH = 50;
      for (let i = 0; i < toUpdate.length; i += BATCH) {
        const chunk = toUpdate.slice(i, i + BATCH);
        for (const { id, vals } of chunk) {
          await this.execute(destino.odooModelo, 'write', [[id], vals]);
        }
        actualizados += chunk.length;
      }

      // Batch creates
      let creados = 0;
      for (let i = 0; i < toCreate.length; i += BATCH) {
        const chunk = toCreate.slice(i, i + BATCH);
        await this.execute(destino.odooModelo, 'create', [chunk]);
        creados += chunk.length;
      }

      await this.repo.update(destinoId, { ultimaSync: new Date(), ultimoError: null });
      this.logger.log(`Destino ${destinoId} sincronizado: ${creados} creados, ${actualizados} actualizados`);
      return { ok: true, creados, actualizados };

    } catch (err: any) {
      const msg = err?.message ?? String(err);
      await this.repo.update(destinoId, { ultimoError: msg });
      this.logger.error(`Error sync destino ${destinoId}: ${msg}`);
      return { ok: false, creados: 0, actualizados: 0, error: msg };
    }
  }

  private async _cargarRegistrosCatalogo(empresa: string, catalogo: string): Promise<Record<string, any>[]> {
    if (catalogo === 'ubicaciones') {
      const rows = await this.ubicacionService.buscarTodos(empresa);
      return rows.map(r => ({
        puesto: r.puesto,
        cliente: r.cliente,
        razonSocial: r.razonSocial,
        sucursal: r.sucursal,
        area: r.area,
        industria: r.industria,
        departamento: r.departamento,
        municipio: r.municipio,
        zona: r.zona,
        direccion: r.direccion,
        categoria: r.categoria,
        encargadoArea: r.encargadoArea,
        facturacion: r.facturacion,
      }));
    }
    // Otros catálogos se pueden agregar aquí en el futuro
    return [];
  }

  private _buildPayload(reg: Record<string, any>, campos: DestinoCampoOrmEntity[]): Record<string, any> {
    const payload: Record<string, any> = {};
    for (const campo of campos) {
      const val = reg[campo.campoLocal];
      if (val !== undefined && val !== null) {
        payload[campo.campoOdoo] = this._castValue(val, campo.tipo);
      }
    }
    return payload;
  }

  private _castValue(val: any, tipo: string): any {
    if (val === null || val === undefined) return false;
    switch (tipo) {
      case 'integer': return parseInt(String(val), 10) || 0;
      case 'float': return parseFloat(String(val)) || 0;
      case 'boolean': return Boolean(val);
      default: return String(val ?? '');
    }
  }
}
