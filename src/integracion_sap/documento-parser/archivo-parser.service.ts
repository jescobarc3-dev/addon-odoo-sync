import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface FilaInventario {
  itemCode: string;
  itemName: string;
  whsCode: string;
  onHand: number;
  uomCode: string;
  precioUnitario: number | null;
  precioTotal: number | null;
  filaOriginal: number;
  advertencias: string[];
}

export interface ResultadoParse {
  filas: FilaInventario[];
  rawRows: Record<string, any>[];
  columnasDetectadas: Record<string, string>;
  headersDisponibles: string[];
  advertencias: string[];
  totalFilas: number;
  hojas: string[];
  hojaActual: string;
}

export function parseNumero(val: any): number {
  if (typeof val === 'number') return val;
  if (val == null || val === '') return NaN;
  const s = String(val).trim();
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma > lastDot) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = s.replace(/,/g, '');
  }
  return parseFloat(normalized.replace(/[^\d.-]/g, ''));
}

export function aplicarMapeo(
  rawRows: Record<string, any>[],
  mapa: Record<string, string>,
): FilaInventario[] {
  const getStr = (row: Record<string, any>, campo: string): string => {
    const col = mapa[campo];
    if (!col) return '';
    const val = row[col];
    return val != null ? String(val).trim() : '';
  };
  const getNum = (row: Record<string, any>, campo: string): number => {
    const col = mapa[campo];
    if (!col) return NaN;
    return parseNumero(row[col]);
  };

  const filas: FilaInventario[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const itemCode = getStr(row, 'itemCode');
    const onHand = getNum(row, 'onHand');
    const precioUnitario = getNum(row, 'precioUnitario');
    const precioTotal = getNum(row, 'precioTotal');
    if (!itemCode && isNaN(onHand)) continue;

    const advertencias: string[] = [];
    if (!itemCode) advertencias.push('Sin código de artículo');
    if (isNaN(onHand)) advertencias.push(`Cantidad inválida: "${row[mapa['onHand']]}"`);

    filas.push({
      itemCode,
      itemName: getStr(row, 'itemName') || itemCode,
      whsCode: getStr(row, 'whsCode') || 'DEFAULT',
      onHand: isNaN(onHand) ? 0 : onHand,
      uomCode: getStr(row, 'uomCode') || 'UND',
      precioUnitario: isNaN(precioUnitario) ? null : precioUnitario,
      precioTotal: isNaN(precioTotal) ? null : precioTotal,
      filaOriginal: i + 2,
      advertencias,
    });
  }
  return filas;
}

const KEYWORDS: Record<string, string[]> = {
  itemCode: [
    'itemcode', 'item code', 'item no', 'item no.',
    'número de artículo', 'numero de articulo', 'núm. artículo', 'num. articulo',
    'número artículo', 'numero articulo', 'cód. artículo', 'cod. articulo',
    'código de artículo', 'codigo de articulo', 'código artículo', 'codigo articulo',
    'código', 'codigo', 'referencia', 'sku', 'artículo', 'articulo',
  ],
  itemName: [
    'itemname', 'item name', 'item description',
    'descripción del artículo', 'descripcion del articulo',
    'descripción de artículo', 'descripcion de articulo',
    'descripción artículo', 'descripcion articulo',
    'descripción', 'descripcion', 'nombre del artículo', 'nombre de artículo',
    'nombre artículo', 'nombre articulo', 'nombre', 'detalle',
  ],
  whsCode: [
    'whscode', 'whs code', 'warehouse',
    'código de almacén', 'codigo de almacen', 'cód. almacén', 'cod. almacen',
    'almacén', 'almacen', 'bodega', 'sucursal', 'ubicación', 'ubicacion',
  ],
  onHand: [
    'onhand', 'on hand', 'qty in stock',
    'cantidad en existencia', 'existencia', 'existencias', 'en existencia',
    'cantidad disponible', 'disponible', 'saldo', 'stock', 'cantidad',
    'qty', 'quantity',
  ],
  uomCode: [
    'uomcode', 'uom code', 'unit of measurement',
    'unidad de medida', 'unidad', 'u.m.', 'uom', 'um',
  ],
  precioUnitario: [
    'precio unitario', 'precio unit', 'costo unitario', 'costo unit',
    'unit price', 'unit cost', 'precio', 'costo', 'price', 'cost',
    'valor unitario', 'p.u.', 'p. unitario',
  ],
  precioTotal: [
    'precio total', 'costo total', 'total price', 'total cost',
    'valor total', 'importe', 'importe total', 'total',
  ],
};

function normalizar(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

@Injectable()
export class ArchivoParserService {
  private readonly logger = new Logger(ArchivoParserService.name);

  async parsear(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
    tipo: string,
    hoja?: string,
  ): Promise<ResultadoParse> {
    const ext = originalname.toLowerCase().split('.').pop();

    if (ext === 'pdf') {
      return this.parsearPdf(buffer);
    }
    if (ext === 'csv') {
      return this.parsearExcel(buffer, true, hoja);
    }
    if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
      return this.parsearExcel(buffer, false, hoja);
    }
    throw new BadRequestException(
      `Formato "${ext}" no soportado. Use .xlsx, .xls, .csv o .pdf`,
    );
  }

  private parsearExcel(buffer: Buffer, esCsv: boolean, hojaSeleccionada?: string): ResultadoParse {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const hojas = wb.SheetNames;

    const hojaActual = hojaSeleccionada && hojas.includes(hojaSeleccionada)
      ? hojaSeleccionada
      : hojas[0];

    const ws = wb.Sheets[hojaActual];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
      defval: '',
      raw: true,
    });

    if (rawRows.length === 0) {
      return {
        filas: [], rawRows: [], columnasDetectadas: {}, headersDisponibles: [],
        advertencias: [`La hoja "${hojaActual}" está vacía o sin filas de datos.`],
        totalFilas: 0, hojas, hojaActual,
      };
    }

    const headers = Object.keys(rawRows[0]).map(h => h.trim());
    const mapa = this.detectarColumnas(headers);
    const advertencias: string[] = [];

    if (hojas.length > 1) {
      advertencias.push(`El archivo tiene ${hojas.length} hojas. Procesando: "${hojaActual}".`);
    }

    for (const campo of ['itemCode', 'onHand'] as const) {
      if (!mapa[campo]) {
        advertencias.push(`No se detectó la columna para "${campo}". Selecciónala en el mapeo.`);
      }
    }

    const filas = aplicarMapeo(rawRows, mapa);
    this.logger.log(`Excel parseado: hoja="${hojaActual}", ${filas.length} filas`);

    return { filas, rawRows, columnasDetectadas: mapa, headersDisponibles: headers, advertencias, totalFilas: filas.length, hojas, hojaActual };
  }

  // ── PDF parser con pdfjs-dist (extracción posicional) ─────────────────────
  private async parsearPdf(buffer: Buffer): Promise<ResultadoParse> {
    try {
      return await this.parsearPdfConPdfjs(buffer);
    } catch (e: any) {
      this.logger.warn(`pdfjs-dist falló (${e.message}), usando pdf-parse`);
      return this.parsearPdfBasico(buffer);
    }
  }

  private async parsearPdfConPdfjs(buffer: Buffer): Promise<ResultadoParse> {
    // pdfjs-dist 4.x usa ESM — importar dinámicamente desde CJS de Node.js
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const workerPath: string = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs' as string);
    pdfjs.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

    type TxtItem = { x: number; y: number; text: string };

    const pdfDoc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      verbosity: 0,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    // ── 1. Recolectar todos los ítems de texto con posición ──────────────────
    const allItems: TxtItem[] = [];
    let pageOffsetY = 0;

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent({ includeMarkedContent: false });

      for (const item of content.items as any[]) {
        if (!item.str?.trim()) continue;
        const x = item.transform[4];
        // PDF Y es bottom-up; invertir y sumar offset de página
        const y = pageOffsetY + (viewport.height - item.transform[5]);
        allItems.push({ x: Math.round(x), y: Math.round(y), text: item.str.trim() });
      }

      pageOffsetY += viewport.height + 20;
    }

    // ── 2. Agrupar ítems por fila (tolerancia 4pt en Y) ──────────────────────
    const YTOL = 4;
    const rows: Array<{ y: number; items: TxtItem[] }> = [];

    for (const item of allItems) {
      const row = rows.find(r => Math.abs(r.y - item.y) <= YTOL);
      if (row) {
        row.items.push(item);
      } else {
        rows.push({ y: item.y, items: [item] });
      }
    }

    rows.sort((a, b) => a.y - b.y);
    for (const row of rows) row.items.sort((a, b) => a.x - b.x);

    // ── 3. Detectar fila de cabecera ─────────────────────────────────────────
    // Palabras clave para cabeceras de tablas SAP Guatemala
    const HEADER_KEYS: Record<string, string[]> = {
      itemCode: ['codigo', 'articulo', 'cod', 'item', 'referencia', 'sku'],
      itemName: ['descripcion', 'nombre', 'detalle'],
      onHand: ['cantidad', 'ctd', 'qty', 'existencia'],
      uomCode: ['u.m', 'um ', 'uom', 'unidad', 'medida'],
      whsCode: ['almacen', 'bodega', 'deposito', 'warehouse'],
      precioUnitario: ['precio', 'costo', 'p.u', 'valor unit'],
    };

    let headerIdx = -1;
    const colX: Record<string, number> = {};

    for (let i = 0; i < rows.length; i++) {
      const rowText = rows[i].items.map(it => normalizar(it.text)).join(' ');
      let hits = 0;

      for (const [field, kws] of Object.entries(HEADER_KEYS)) {
        for (const kw of kws) {
          if (rowText.includes(kw)) {
            if (!colX[field]) {
              const hit = rows[i].items.find(it => normalizar(it.text).includes(kw));
              if (hit) colX[field] = hit.x;
            }
            hits++;
            break;
          }
        }
      }

      if (hits >= 2) {
        headerIdx = i;
        break;
      }
    }

    const advertencias: string[] = [];

    if (headerIdx < 0) {
      advertencias.push(
        'No se detectó la cabecera de la tabla en el PDF. ' +
        'Verifica que sea un reporte de SAP (Salida/Entrada de Inventario) con texto, no escaneado.',
      );
      return { filas: [], rawRows: [], columnasDetectadas: {}, headersDisponibles: [], advertencias, totalFilas: 0, hojas: ['PDF'], hojaActual: 'PDF' };
    }

    // ── 4. Parsear filas de datos ─────────────────────────────────────────────
    const COL_TOL = 70; // tolerancia en px para asignar ítem a columna

    const getCol = (row: typeof rows[0], field: string): string => {
      const cx = colX[field];
      if (cx === undefined) return '';
      const candidates = row.items
        .filter(it => Math.abs(it.x - cx) <= COL_TOL)
        .sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx));
      return candidates[0]?.text ?? '';
    };

    const filas: FilaInventario[] = [];

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.items.length < 2) continue; // saltar filas dispersas (pie de página, etc.)

      const itemCode = getCol(row, 'itemCode');
      // Código de artículo SAP: alfanumérico, mínimo 2 chars
      if (!itemCode || !/^[A-Z0-9\-_.]{2,}/i.test(itemCode)) continue;

      const cantStr = getCol(row, 'onHand').replace(/\s/g, '');
      const onHand = parseNumero(cantStr);
      if (isNaN(onHand)) continue;

      const precioStr = getCol(row, 'precioUnitario');
      const precio = precioStr ? parseNumero(precioStr) : NaN;

      filas.push({
        itemCode: itemCode.trim().toUpperCase(),
        itemName: getCol(row, 'itemName').trim() || itemCode,
        whsCode: getCol(row, 'whsCode').trim() || 'DEFAULT',
        onHand,
        uomCode: getCol(row, 'uomCode').trim() || 'UND',
        precioUnitario: isNaN(precio) ? null : precio,
        precioTotal: null,
        filaOriginal: i - headerIdx,
        advertencias: [],
      });
    }

    if (filas.length === 0) {
      advertencias.push(
        'PDF procesado pero sin líneas de detalle. ' +
        'Verifica que el formato sea el reporte estándar de SAP.',
      );
    } else {
      advertencias.push(
        `PDF extraído con posicionamiento (pdfjs-dist): ${filas.length} líneas. ` +
        'Revisa la vista previa y corrige el mapeo si es necesario.',
      );
    }

    this.logger.log(`PDF pdfjs: ${filas.length} filas extraídas, headerIdx=${headerIdx}`);

    return {
      filas, rawRows: [],
      columnasDetectadas: Object.fromEntries(Object.entries(colX).map(([k, x]) => [k, `pos_x=${x}`])),
      headersDisponibles: [],
      advertencias,
      totalFilas: filas.length,
      hojas: ['PDF'],
      hojaActual: 'PDF',
    };
  }

  // ── Fallback: pdf-parse (sin datos de posición) ───────────────────────────
  private async parsearPdfBasico(buffer: Buffer): Promise<ResultadoParse> {
    let pdfParse: any;
    try {
      pdfParse = require('pdf-parse');
    } catch {
      throw new BadRequestException('Ninguna librería PDF disponible. Use Excel o CSV.');
    }

    const data = await pdfParse(buffer);
    const texto = data.text as string;
    const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    const filas: FilaInventario[] = [];

    const reLinea = /^([A-Z0-9\-_.]{2,})\s+(.+?)\s+([\d.,]+)\s*$/i;

    for (let i = 0; i < lineas.length; i++) {
      const m = lineas[i].match(reLinea);
      if (!m) continue;
      const [, itemCode, resto, cantStr] = m;
      const onHand = parseNumero(cantStr);
      if (isNaN(onHand)) continue;

      filas.push({
        itemCode: itemCode.toUpperCase(),
        itemName: resto.trim(),
        whsCode: 'DEFAULT',
        onHand,
        uomCode: 'UND',
        precioUnitario: null,
        precioTotal: null,
        filaOriginal: i + 1,
        advertencias: ['Extraído con método básico'],
      });
    }

    this.logger.log(`PDF básico (pdf-parse): ${filas.length} filas`);

    return {
      filas, rawRows: [], columnasDetectadas: {}, headersDisponibles: [],
      advertencias: [
        'Extracción básica de PDF (pdfjs-dist no disponible). ' +
        'Para mejor precisión, exporta a Excel desde SAP.',
      ],
      totalFilas: filas.length,
      hojas: ['PDF'],
      hojaActual: 'PDF',
    };
  }

  private detectarColumnas(headers: string[]): Record<string, string> {
    const resultado: Record<string, string> = {};
    const usado = new Set<string>();

    for (const [campo, keywords] of Object.entries(KEYWORDS)) {
      let encontrado = headers.find(h => {
        const n = normalizar(h);
        return keywords.some(k => normalizar(k) === n);
      });

      if (!encontrado) {
        encontrado = headers.find(h => {
          if (usado.has(h)) return false;
          const hn = normalizar(h);
          return keywords.some(k => {
            const kn = normalizar(k);
            return hn.includes(kn) || kn.includes(hn);
          });
        });
      }

      if (encontrado && !usado.has(encontrado)) {
        resultado[campo] = encontrado;
        usado.add(encontrado);
      }
    }

    return resultado;
  }
}
