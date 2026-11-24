import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { CatalogoUbicacionOrmEntity } from './catalogo-ubicacion.orm-entity';

// ── Tipos de datos ────────────────────────────────────────────────────────────

export interface UbicacionInput {
  puesto: number;
  cliente?: string | null;
  razonSocial?: string | null;
  sucursal?: string | null;
  area?: string | null;
  industria?: string | null;
  departamento?: string | null;
  municipio?: string | null;
  zona?: number | null;
  direccion?: string | null;
  categoria?: string | null;
  encargadoArea?: string | null;
  facturacion?: string | null;
  posiciones?: string[];
}

export interface UbicacionNormalizada extends Required<UbicacionInput> {
  calidadScore: number;
  issues: string[];
}

export interface ResumenCalidadUbicaciones {
  total: number;
  sinProblemas: number;
  conProblemas: number;
  scorePromedio: number;
  correcciones: { campo: string; original: string; normalizado: string; ocurrencias: number }[];
  problemas: { puesto: number; tipo: string; descripcion: string }[];
}

export interface ResultadoParseUbicaciones {
  ubicaciones: UbicacionNormalizada[];
  resumen: ResumenCalidadUbicaciones;
}

// ── Reglas de gobierno de datos ───────────────────────────────────────────────

/**
 * Mapa de correcciones canónicas por campo.
 * Clave: valor normalizado (trim + upper), Valor: forma canónica correcta.
 * Se aplica después de trim+upper, antes de guardar.
 */
const CANONICOS: Record<string, string> = {
  // Industria
  'INSTALACIONES ': 'INSTALACIONES',
  'OPERATIVO ': 'OPERATIVO',
  'OPERATIVO': 'OPERATIVO',
  // Departamentos
  'SAN MARCOS ': 'SAN MARCOS',
  'QUETZALTENANGO ': 'QUETZALTENANGO',
  'SOLOLÁ ': 'SOLOLÁ',
  // Facturación
  'CON COBRO ': 'CON COBRO',
  'SIN COBRO ': 'SIN COBRO',
  // Categorías
  'JEFE DE PROYECTO': 'JEFE DE PROYECTO',
  // Posiciones — typos conocidos
  'CUSPODIA': 'CUSTODIA',
  'CUSTODIO ': 'CUSTODIO',
  'GARITA ': 'GARITA',
  'GARITA  ': 'GARITA',
  'GARITA  02': 'GARITA 02',
  'GARITA  03': 'GARITA 03',
  'DESCANSERO ': 'DESCANSERO',
  'CUSTODIA ': 'CUSTODIA',
  'COLEGIO CAYALA ': 'COLEGIO CAYALA',
  'BODEGA  4 Y 5': 'BODEGA 4 Y 5',
};

function canonicalizar(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const trimmed = valor.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  // Preferir la forma canónica si existe; si no, upper
  return CANONICOS[upper] ?? CANONICOS[trimmed] ?? upper;
}

function canonicalizarTitulo(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const trimmed = valor.trim();
  if (!trimmed) return null;
  // Nombre propio: capitalizar cada palabra para clientes/sucursales (no forzar UPPER)
  return trimmed;
}

function canonicalizarPosicion(pos: string): string {
  const trimmed = pos.trim();
  const upper = trimmed.toUpperCase();
  return CANONICOS[upper] ?? CANONICOS[trimmed] ?? upper;
}

// ── Score de calidad ──────────────────────────────────────────────────────────

const PESOS: { campo: keyof UbicacionNormalizada; peso: number }[] = [
  { campo: 'cliente', peso: 20 },
  { campo: 'sucursal', peso: 15 },
  { campo: 'direccion', peso: 15 },
  { campo: 'departamento', peso: 10 },
  { campo: 'municipio', peso: 10 },
  { campo: 'industria', peso: 10 },
  { campo: 'area', peso: 10 },
  { campo: 'categoria', peso: 5 },
  { campo: 'facturacion', peso: 5 },
];

function calcularCalidad(u: Omit<UbicacionNormalizada, 'calidadScore' | 'issues'>): {
  score: number;
  issues: string[];
} {
  const problemas: string[] = [];
  let penalizacion = 0;

  for (const { campo, peso } of PESOS) {
    const val = u[campo as keyof typeof u];
    if (!val || val === null) {
      problemas.push(`Campo "${campo}" vacío`);
      penalizacion += peso;
    }
  }

  if (!u.zona || u.zona === 0) {
    problemas.push('Zona no especificada (0 o nula)');
    penalizacion += 2;
  }

  if (u.posiciones.length === 0) {
    problemas.push('Sin posiciones definidas');
    penalizacion += 3;
  }

  if (u.facturacion && !['CON COBRO', 'SIN COBRO', 'COSTEADOS', 'NO COSTEADOS'].includes(u.facturacion)) {
    problemas.push(`Facturación no reconocida: "${u.facturacion}"`);
    penalizacion += 2;
  }

  return {
    score: Math.max(0, 100 - penalizacion),
    issues: problemas,
  };
}

// ── Correcciones en lote aplicables en el wizard ─────────────────────────────

export interface CorreccionesLote {
  zona?: number;       // valor por defecto para registros con zona null/0
}

// ── Servicio ──────────────────────────────────────────────────────────────────

interface SesionParseo {
  ubicaciones: UbicacionNormalizada[];
  resumen: ResumenCalidadUbicaciones;
  empresa: string;
  ts: number;
}

@Injectable()
export class CatalogoUbicacionService {
  private readonly logger = new Logger(CatalogoUbicacionService.name);
  private readonly sesiones = new Map<string, SesionParseo>();
  private static readonly SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

  constructor(
    @InjectRepository(CatalogoUbicacionOrmEntity)
    private readonly repo: Repository<CatalogoUbicacionOrmEntity>,
  ) {}

  // ── Sesión de parseo (wizard dos pasos) ──────────────────────────────────

  guardarSesion(empresa: string, ubicaciones: UbicacionNormalizada[], resumen: ResumenCalidadUbicaciones): string {
    this._limpiarSesionesViejas();
    const id = `ub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sesiones.set(id, { ubicaciones, resumen, empresa, ts: Date.now() });
    return id;
  }

  obtenerSesion(sesionId: string): SesionParseo {
    const s = this.sesiones.get(sesionId);
    if (!s) throw new Error('Sesión expirada o no existe. Vuelve a subir el archivo.');
    return s;
  }

  eliminarSesion(sesionId: string): void {
    this.sesiones.delete(sesionId);
  }

  aplicarCorrecciones(ubicaciones: UbicacionNormalizada[], correcciones: CorreccionesLote): UbicacionNormalizada[] {
    return ubicaciones.map(u => {
      const patch: Partial<UbicacionNormalizada> = {};
      if (correcciones.zona !== undefined && (!u.zona || u.zona === 0)) {
        patch.zona = correcciones.zona;
      }
      if (Object.keys(patch).length === 0) return u;
      const draft = { ...u, ...patch };
      const { score, issues } = calcularCalidad(draft);
      return { ...draft, calidadScore: score, issues };
    });
  }

  private _limpiarSesionesViejas(): void {
    const ahora = Date.now();
    for (const [k, v] of this.sesiones) {
      if (ahora - v.ts > CatalogoUbicacionService.SESSION_TTL_MS) this.sesiones.delete(k);
    }
  }

  /**
   * Parsea un Excel con el formato estándar de listado de puestos.
   * Aplica normalización y gobernanza de datos, agrupa por PUESTO,
   * acumula POSICIÓN en array deduplicado.
   */
  parsearExcel(buffer: Buffer): ResultadoParseUbicaciones {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: null });

    if (rawRows.length === 0) {
      return {
        ubicaciones: [],
        resumen: {
          total: 0, sinProblemas: 0, conProblemas: 0, scorePromedio: 0,
          correcciones: [], problemas: [],
        },
      };
    }

    // Detectar nombres de columnas con tolerancia a espacios y mayúsculas
    const headers = Object.keys(rawRows[0]);
    const col = (candidatos: string[]): string | null => {
      for (const c of candidatos) {
        const found = headers.find(h => h.trim().toUpperCase() === c.toUpperCase());
        if (found) return found;
      }
      return null;
    };

    const COL_PUESTO = col(['PUESTO']);
    const COL_POSICION = col(['POSICIÓN', 'POSICION', 'POSICION ']);
    const COL_CLIENTE = col(['CLIENTE']);
    const COL_RAZON = col(['RAZON SOCIAL', 'RAZÓN SOCIAL']);
    const COL_SUCURSAL = col(['SUCURSAL']);
    const COL_AREA = col(['ÁREA', 'AREA']);
    const COL_INDUSTRIA = col(['INDUSTRIA']);
    const COL_DEPTO = col(['DEPARTAMENTO']);
    const COL_MUNICIPIO = col(['MUNICIPIO']);
    const COL_ZONA = col(['ZONA']);
    const COL_DIR = col(['DIRECCION', 'DIRECCIÓN', 'DIRECCION ']);
    const COL_CAT = col(['CATEGORIA', 'CATEGORÍA']);
    const COL_ENCARGADO = col(['ENCARGADO DE AREA', 'ENCARGADO DE ÁREA']);
    const COL_FACT = col(['FACTURACIÓN', 'FACTURACION']);

    if (!COL_PUESTO) {
      throw new Error('No se encontró la columna PUESTO en el archivo. Verifica el formato.');
    }

    const getString = (row: Record<string, any>, col: string | null): string | null => {
      if (!col) return null;
      const v = row[col];
      return v != null ? String(v).trim() || null : null;
    };

    const getInt = (row: Record<string, any>, col: string | null): number | null => {
      if (!col) return null;
      const v = row[col];
      if (v == null) return null;
      const n = parseInt(String(v), 10);
      return isNaN(n) || n === 0 ? null : n;
    };

    // Mapa para registrar correcciones aplicadas
    const correcciones = new Map<string, { original: string; normalizado: string; ocurrencias: number }>();
    const registrarCorreccion = (campo: string, original: string, normalizado: string) => {
      if (original === normalizado) return;
      const key = `${campo}::${original}`;
      const prev = correcciones.get(key);
      if (prev) prev.ocurrencias++;
      else correcciones.set(key, { original, normalizado, ocurrencias: 1 });
    };

    const normalizar = (campo: string, valor: string | null): string | null => {
      if (!valor) return null;
      const normalizado = canonicalizar(valor);
      if (normalizado) registrarCorreccion(campo, valor.trim(), normalizado);
      return normalizado;
    };

    // Agrupar por PUESTO
    const puestosMap = new Map<number, {
      base: Omit<UbicacionNormalizada, 'calidadScore' | 'issues'>;
      posicionesSet: Set<string>;
    }>();

    for (const row of rawRows) {
      const puestoRaw = row[COL_PUESTO];
      if (puestoRaw == null) continue;
      const puesto = parseInt(String(puestoRaw), 10);
      if (isNaN(puesto)) continue;

      if (!puestosMap.has(puesto)) {
        const zonaRaw = getInt(row, COL_ZONA);
        const clienteRaw = getString(row, COL_CLIENTE);
        const razonRaw = getString(row, COL_RAZON);
        const sucursalRaw = getString(row, COL_SUCURSAL);
        const areaRaw = getString(row, COL_AREA);
        const industriaRaw = getString(row, COL_INDUSTRIA);
        const deptoRaw = getString(row, COL_DEPTO);
        const municipioRaw = getString(row, COL_MUNICIPIO);
        const dirRaw = getString(row, COL_DIR);
        const catRaw = getString(row, COL_CAT);
        const encargadoRaw = getString(row, COL_ENCARGADO);
        const factRaw = getString(row, COL_FACT);

        puestosMap.set(puesto, {
          base: {
            puesto,
            cliente: canonicalizarTitulo(clienteRaw),
            razonSocial: canonicalizarTitulo(razonRaw),
            sucursal: canonicalizarTitulo(sucursalRaw),
            area: normalizar('area', areaRaw),
            industria: normalizar('industria', industriaRaw),
            departamento: normalizar('departamento', deptoRaw),
            municipio: normalizar('municipio', municipioRaw),
            zona: zonaRaw,
            direccion: dirRaw?.trim() || null,
            categoria: normalizar('categoria', catRaw),
            encargadoArea: canonicalizarTitulo(encargadoRaw),
            facturacion: normalizar('facturacion', factRaw),
            posiciones: [],
          },
          posicionesSet: new Set(),
        });
      }

      // Acumular posición
      if (COL_POSICION) {
        const posRaw = getString(row, COL_POSICION);
        if (posRaw) {
          const posNorm = canonicalizarPosicion(posRaw);
          if (posRaw.trim().toUpperCase() !== posNorm) {
            registrarCorreccion('posicion', posRaw.trim(), posNorm);
          }
          puestosMap.get(puesto)!.posicionesSet.add(posNorm);
        }
      }
    }

    // Construir lista final con score de calidad
    const ubicaciones: UbicacionNormalizada[] = [];
    const problemasList: { puesto: number; tipo: string; descripcion: string }[] = [];

    for (const [puesto, { base, posicionesSet }] of puestosMap.entries()) {
      const posiciones = Array.from(posicionesSet).sort();
      const draft = { ...base, posiciones };
      const { score, issues } = calcularCalidad(draft);

      if (issues.length > 0) {
        for (const issue of issues) {
          problemasList.push({ puesto, tipo: 'CALIDAD', descripcion: issue });
        }
      }

      ubicaciones.push({ ...draft, calidadScore: score, issues });
    }

    const scorePromedio = ubicaciones.length > 0
      ? Math.round(ubicaciones.reduce((s, u) => s + u.calidadScore, 0) / ubicaciones.length)
      : 0;

    const resumen: ResumenCalidadUbicaciones = {
      total: ubicaciones.length,
      sinProblemas: ubicaciones.filter(u => u.issues.length === 0).length,
      conProblemas: ubicaciones.filter(u => u.issues.length > 0).length,
      scorePromedio,
      correcciones: Array.from(correcciones.entries()).map(([, v]) => ({
        campo: v.original.split('::')[0] ?? '',
        original: v.original,
        normalizado: v.normalizado,
        ocurrencias: v.ocurrencias,
      })),
      problemas: problemasList,
    };

    this.logger.log(
      `Parse ubicaciones: ${ubicaciones.length} puestos únicos, ` +
      `score promedio ${scorePromedio}, ` +
      `${correcciones.size} tipos de corrección aplicados, ` +
      `${problemasList.length} issues de calidad`,
    );

    return { ubicaciones, resumen };
  }

  async desactivarTodos(empresa: string): Promise<void> {
    await this.repo.update({ empresaCodigo: empresa, activo: true }, { activo: false });
  }

  async upsertLote(empresa: string, ubicaciones: UbicacionNormalizada[]): Promise<void> {
    if (ubicaciones.length === 0) return;

    const CHUNK = 200;
    for (let i = 0; i < ubicaciones.length; i += CHUNK) {
      const chunk = ubicaciones.slice(i, i + CHUNK);
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(CatalogoUbicacionOrmEntity)
        .values(
          chunk.map(u => ({
            empresaCodigo: empresa,
            puesto: u.puesto,
            cliente: u.cliente,
            razonSocial: u.razonSocial,
            sucursal: u.sucursal,
            area: u.area,
            industria: u.industria,
            departamento: u.departamento,
            municipio: u.municipio,
            zona: u.zona,
            direccion: u.direccion,
            categoria: u.categoria,
            encargadoArea: u.encargadoArea,
            facturacion: u.facturacion,
            posiciones: u.posiciones,
            calidadScore: u.calidadScore,
            issues: u.issues,
            activo: true,
          })),
        )
        .orUpdate(
          [
            'cliente', 'razon_social', 'sucursal', 'area', 'industria',
            'departamento', 'municipio', 'zona', 'direccion', 'categoria',
            'encargado_area', 'facturacion', 'posiciones',
            'calidad_score', 'issues', 'activo',
          ],
          ['empresa_codigo', 'puesto'],
        )
        .execute();
    }

    this.logger.log(`Upsert ubicaciones: ${ubicaciones.length} puestos empresa=${empresa}`);
  }

  async buscarPaginado(
    empresa: string,
    opts: {
      q?: string;
      area?: string;
      industria?: string;
      departamento?: string;
      facturacion?: string;
      soloConProblemas?: boolean;
      page?: number;
      limit?: number;
    },
  ): Promise<{ items: CatalogoUbicacionOrmEntity[]; total: number; filtros: Record<string, string[]> }> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 50;

    const qb = this.repo
      .createQueryBuilder('u')
      .where('u.empresa_codigo = :empresa', { empresa })
      .andWhere('u.activo = true');

    if (opts.q?.trim()) {
      const q = `%${opts.q.trim()}%`;
      qb.andWhere(
        '(CAST(u.puesto AS VARCHAR) ILIKE :q OR u.cliente ILIKE :q OR u.sucursal ILIKE :q OR u.razon_social ILIKE :q OR u.direccion ILIKE :q)',
        { q },
      );
    }
    if (opts.area) qb.andWhere('u.area = :area', { area: opts.area });
    if (opts.industria) qb.andWhere('u.industria = :industria', { industria: opts.industria });
    if (opts.departamento) qb.andWhere('u.departamento = :departamento', { departamento: opts.departamento });
    if (opts.facturacion) qb.andWhere('u.facturacion = :facturacion', { facturacion: opts.facturacion });
    if (opts.soloConProblemas) qb.andWhere('array_length(u.issues, 1) > 0');

    const [items, total] = await qb
      .orderBy('u.calidad_score', 'ASC')
      .addOrderBy('u.puesto', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Valores únicos para filtros dinámicos (solo los activos)
    const filtros = await this._getFiltros(empresa);

    return { items, total, filtros };
  }

  private async _getFiltros(empresa: string): Promise<Record<string, string[]>> {
    const rows = await this.repo
      .createQueryBuilder('u')
      .select(['u.area', 'u.industria', 'u.departamento', 'u.facturacion'])
      .where('u.empresa_codigo = :empresa AND u.activo = true', { empresa })
      .distinct(true)
      .getRawMany();

    const areas = [...new Set(rows.map(r => r.u_area).filter(Boolean))].sort();
    const industrias = [...new Set(rows.map(r => r.u_industria).filter(Boolean))].sort();
    const departamentos = [...new Set(rows.map(r => r.u_departamento).filter(Boolean))].sort();
    const facturaciones = [...new Set(rows.map(r => r.u_facturacion).filter(Boolean))].sort();

    return { areas, industrias, departamentos, facturaciones };
  }

  async contarActivos(empresa: string): Promise<{ total: number; conProblemas: number; scorePromedio: number }> {
    const rows = await this.repo
      .createQueryBuilder('u')
      .select(['COUNT(*) as total', 'AVG(u.calidad_score) as avg_score',
        'SUM(CASE WHEN array_length(u.issues, 1) > 0 THEN 1 ELSE 0 END) as con_problemas'])
      .where('u.empresa_codigo = :empresa AND u.activo = true', { empresa })
      .getRawOne();

    return {
      total: parseInt(rows.total ?? '0', 10),
      conProblemas: parseInt(rows.con_problemas ?? '0', 10),
      scorePromedio: Math.round(parseFloat(rows.avg_score ?? '0')),
    };
  }
}
