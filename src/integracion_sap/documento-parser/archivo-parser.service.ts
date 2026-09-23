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
  /** Número de documento SAP extraído del encabezado del PDF (ej: "12345") */
  docNumSap?: string;
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
    // pdfjs-dist 4.x: solo .mjs — importar dinámicamente desde Node.js CJS
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

    // ── 1. Recolectar ítems con posición ─────────────────────────────────────
    const allItems: TxtItem[] = [];
    let pageOffsetY = 0;

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent({ includeMarkedContent: false });

      for (const item of content.items as any[]) {
        if (!item.str?.trim()) continue;
        const x = item.transform[4];
        // PDF origin es bottom-left → invertir Y para tener top-down (Y=0 = tope)
        const y = pageOffsetY + (viewport.height - item.transform[5]);
        allItems.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, text: item.str.trim() });
      }
      pageOffsetY += viewport.height + 20;
    }

    // ── 2. Agrupar por fila (4pt tolerancia Y) — sort ASCENDENTE = top→bottom ─
    const YTOL = 4;
    const rows: Array<{ y: number; items: TxtItem[] }> = [];

    for (const item of allItems) {
      const row = rows.find(r => Math.abs(r.y - item.y) <= YTOL);
      if (row) row.items.push(item);
      else rows.push({ y: item.y, items: [item] });
    }

    // a.y - b.y = ascendente = los items del encabezado quedan PRIMERO
    rows.sort((a, b) => a.y - b.y);
    for (const row of rows) row.items.sort((a, b) => a.x - b.x);

    // ── 3. Extraer DocNum del encabezado ─────────────────────────────────────
    // Cubre: "Entrega No. 1018167", "Nota de entrega compras 1012831", etc.
    const RE_DOCNUM = /(?:n[oºO°]\.?\s*|compras\s+|salida\s+|entrega\s+)(\d{4,9})/i;
    let docNumSap: string | undefined;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const txt = rows[i].items.map(it => it.text).join(' ');
      const m = txt.match(RE_DOCNUM);
      if (m) { docNumSap = m[1]; break; }
    }
    if (docNumSap) this.logger.log(`PDF DocNum SAP: ${docNumSap}`);

    // ── 4. Detectar fila de cabecera ─────────────────────────────────────────
    const HEADER_KEYS: Record<string, string[]> = {
      itemCode: ['codigo', 'articulo', 'cod', 'item', 'referencia', 'sku', 'numero', 'nro', 'n°'],
      itemName: ['descripcion', 'nombre', 'detalle'],
      onHand:   ['cantidad', 'qty', 'existencia'],
      uomCode:  ['u.m', 'uom', 'unidad', 'medida'],
      whsCode:  ['almacen', 'bodega', 'deposito', 'warehouse'],
      precioUnitario: ['precio', 'costo', 'p.u', 'valor unit'],
    };

    let headerIdx = -1;
    // Posición X de cada columna según el texto del HEADER (puede estar centrado)
    const headerColX: Array<{ field: string; x: number }> = [];
    // Posición X de la columna de numeración "#" (a excluir de datos)
    let lineNumColX: number | null = null;

    for (let i = 0; i < rows.length; i++) {
      const rowNorm = rows[i].items.map(it => ({ x: it.x, n: normalizar(it.text), raw: it.text }));
      let hits = 0;
      const detected: Array<{ field: string; x: number }> = [];
      const usedItemIndices = new Set<number>();

      // Detectar columna "#" de numeración
      const hashIdx = rowNorm.findIndex(it => it.raw.trim() === '#');
      if (hashIdx >= 0) lineNumColX = rowNorm[hashIdx].x;

      for (const [field, kws] of Object.entries(HEADER_KEYS)) {
        for (const kw of kws) {
          const idx = rowNorm.findIndex((it, j) => {
            if (usedItemIndices.has(j)) return false;
            // Descartar ítems largos (>40 chars) o con patrón "label: valor" — son metadatos del reporte, no columnas de tabla
            if (it.raw.length > 40 || it.raw.includes(': ') || it.raw.includes(':')) return false;
            return it.n.includes(kw);
          });
          if (idx >= 0) {
            usedItemIndices.add(idx);
            detected.push({ field, x: rowNorm[idx].x });
            hits++;
            break;
          }
        }
      }

      if (hits >= 2) {
        headerIdx = i;
        headerColX.push(...detected);
        break;
      }
    }

    // ── 4b. Cabecera multi-fila ────────────────────────────────────────────────
    // SAP Crystal Reports parte el texto del encabezado en filas muy cercanas (≤25px).
    // Continuar si falta itemCode, itemName, o si el "#" de líneas no fue detectado.
    if (headerIdx >= 0 && headerIdx + 1 < rows.length) {
      const missingFields = Object.keys(HEADER_KEYS).filter(f => !headerColX.find(h => h.field === f));
      if (missingFields.includes('itemCode') || missingFields.includes('itemName') || lineNumColX === null) {
        const hY = rows[headerIdx].y;
        const nextRow = rows[headerIdx + 1];
        if (nextRow.y - hY < 25) {
          for (const item of nextRow.items) {
            const n = normalizar(item.text);
            // Detectar "#" de numeración en fila de continuación
            if (item.text.trim() === '#') { lineNumColX = item.x; continue; }
            for (const field of missingFields) {
              if (HEADER_KEYS[field].some(kw => n.includes(kw))) {
                if (!headerColX.find(h => h.field === field)) {
                  headerColX.push({ field, x: item.x });
                }
                break;
              }
            }
          }
          // La fila de continuación es parte del encabezado — los datos empiezan después
          this.logger.log(`PDF header multi-fila: continuación en fila ${headerIdx + 1}`);
          headerIdx = headerIdx + 1;
        }
      }
    }

    const advertencias: string[] = [];

    if (headerIdx < 0) {
      advertencias.push('No se detectó la cabecera de la tabla en el PDF. Verifica que sea un reporte SAP con texto, no escaneado.');
      return { filas: [], rawRows: [], columnasDetectadas: {}, headersDisponibles: [], advertencias, totalFilas: 0, hojas: ['PDF'], hojaActual: 'PDF', docNumSap };
    }

    this.logger.log(`PDF header fila ${headerIdx}: ${rows[headerIdx].items.map(it => `"${it.text}"@x${it.x}`).join(' | ')}`);

    // ── 5. Construir bandas de columna ────────────────────────────────────────
    // Cada banda ocupa desde el x del PROPIO header hasta el x del header SIGUIENTE
    // (exclusivo). Esto captura datos numéricos desplazados a la derecha del header
    // (Crystal Reports alinea números a la derecha dentro de la columna).
    headerColX.sort((a, b) => a.x - b.x);

    const bands: Array<{ field: string; minX: number; maxX: number }> = headerColX.map((col, i) => ({
      field: col.field,
      minX: i === 0 ? -Infinity : col.x,
      maxX: i === headerColX.length - 1 ? Infinity : headerColX[i + 1].x,
    }));

    const assignBand = (item: TxtItem): string | null => {
      for (const b of bands) {
        if (item.x >= b.minX && item.x < b.maxX) return b.field;
      }
      return null;
    };

    this.logger.log(`PDF bandas iniciales: ${bands.map(b => `${b.field}[${Math.round(b.minX)},${Math.round(b.maxX)})`).join(' | ')}`);

    // ── 5b. Recalibrar banda itemCode/itemName con la primera fila de datos ────
    // Crystal Reports CENTRA los headers sobre columnas anchas (ej: DESCRIPCION a
    // x=224 aunque los datos arranquen en x=84). El midpoint calculado queda muy a
    // la derecha y arrastra texto de descripción a la banda de itemCode.
    // Solución: buscar en las primeras filas de datos dónde empieza realmente el
    // texto alfabético largo (descripción) y reajustar la frontera de banda.
    {
      const itemCodeBand = bands.find(b => b.field === 'itemCode');
      const itemNameBand = bands.find(b => b.field === 'itemName');
      if (itemCodeBand && itemNameBand) {
        for (let i = headerIdx + 1; i < Math.min(rows.length, headerIdx + 6); i++) {
          const dr = rows[i];
          if (dr.items.length <= 1) continue;
          const descCandidates = dr.items.filter(it =>
            /[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}/.test(it.text) &&
            it.text.length > 3 &&
            it.x >= (itemCodeBand.minX === -Infinity ? -99999 : itemCodeBand.minX) &&
            it.x < itemNameBand.maxX,
          );
          if (descCandidates.length > 0) {
            descCandidates.sort((a, b) => a.x - b.x);
            const actualDescStartX = descCandidates[0].x - 0.5;
            if (actualDescStartX < itemCodeBand.maxX) {
              this.logger.log(`PDF recalibración itemCode.maxX: ${itemCodeBand.maxX.toFixed(1)} → ${actualDescStartX.toFixed(1)}`);
              itemCodeBand.maxX = actualDescStartX;
              itemNameBand.minX = actualDescStartX;
            }
            break;
          }
        }
      }
      this.logger.log(`PDF bandas finales: ${bands.map(b => `${b.field}[${Math.round(b.minX)},${Math.round(b.maxX)})`).join(' | ')}`);
    }

    // ── 6. Parsear filas de datos ─────────────────────────────────────────────
    const filas: FilaInventario[] = [];
    // En reportes SAP GT el almacén puede aparecer como fila solitaria (ej: ALMACEN06)
    // después de las líneas de detalle, no como columna. Se captura y se aplica a todo.
    let whsGlobal = 'DEFAULT';

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];

      // Fila solitaria: puede ser código de almacén (ALMACEN06, BODEGA01…)
      if (row.items.length === 1) {
        const txt = row.items[0].text;
        if (/^(?:ALMACEN|BODEGA|WHS|WAREHOUSE)\d*/i.test(txt) || /^[A-Z]{2,}\d+$/i.test(txt)) {
          whsGlobal = txt.toUpperCase();
        }
        continue;
      }

      // Asignar ítems a columnas por banda
      const cells: Record<string, string[]> = {};
      for (const item of row.items) {
        // Ignorar columna de numeración de líneas (#): número entero pequeño en la columna del "#"
        const isLineNum = /^\d{1,3}$/.test(item.text.trim()) &&
          (lineNumColX !== null ? Math.abs(item.x - lineNumColX) < 15 : item.x < 20);
        if (isLineNum) continue;

        const field = assignBand(item);
        if (field) {
          if (!cells[field]) cells[field] = [];
          cells[field].push(item.text);
        }
      }

      const itemCode = (cells['itemCode'] ?? []).join('').trim().toUpperCase();
      // SAP item codes: alfanumérico con guiones/puntos, mínimo 2 chars
      if (!itemCode || !/^[A-Z0-9][A-Z0-9\-_.]{1,}/i.test(itemCode)) continue;

      // Cantidad: primer valor sin prefijo de moneda (en Crystal Reports precio y qty
      // pueden caer en la misma banda cuando datos están desplazados vs. encabezado).
      const RE_MONEDA = /^[A-Z]{2,3}\s+[\d.,]/i;
      const onHandCells = cells['onHand'] ?? [];
      const onHand = onHandCells
        .filter(s => !RE_MONEDA.test(s.trim()))
        .map(s => parseNumero(s))
        .find(n => !isNaN(n)) ?? NaN;
      if (isNaN(onHand)) continue;

      // Precio unitario: primer valor con prefijo de moneda en las bandas onHand+precio
      const precioCandidatos = [...onHandCells, ...(cells['precioUnitario'] ?? [])];
      const precioRaw = precioCandidatos.find(s => RE_MONEDA.test(s.trim())) ?? '';
      const precio = precioRaw ? parseNumero(precioRaw) : NaN;

      filas.push({
        itemCode,
        itemName: (cells['itemName'] ?? []).join(' ').trim() || itemCode,
        whsCode: (cells['whsCode'] ?? []).join('').trim() || whsGlobal,
        onHand,
        uomCode: (cells['uomCode'] ?? []).join('').trim() || 'UND',
        precioUnitario: isNaN(precio) ? null : precio,
        precioTotal: null,
        filaOriginal: i - headerIdx,
        advertencias: [],
      });
    }

    // Aplicar almacén global a filas que quedaron con DEFAULT
    for (const f of filas) {
      if (f.whsCode === 'DEFAULT') f.whsCode = whsGlobal;
    }

    this.logger.log(`PDF pdfjs: ${filas.length} filas extraídas, headerIdx=${headerIdx}, almacén=${whsGlobal}`);

    if (filas.length === 0) {
      advertencias.push('PDF procesado pero sin líneas de detalle. Verifica que sea el reporte estándar de SAP.');
    } else {
      advertencias.push(`PDF extraído (pdfjs-dist): ${filas.length} líneas. Almacén: ${whsGlobal}.`);
    }

    return {
      filas, rawRows: [],
      columnasDetectadas: Object.fromEntries(headerColX.map(c => [c.field, `pos_x=${c.x}`])),
      headersDisponibles: [],
      advertencias,
      totalFilas: filas.length,
      hojas: ['PDF'],
      hojaActual: 'PDF',
      docNumSap,
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
