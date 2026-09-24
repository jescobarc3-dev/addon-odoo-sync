import { createApi } from '@reduxjs/toolkit/query/react';
import { makeBaseQueryWithReauth } from './baseQueryWithReauth';

export interface RegistroSincronizacion {
  id: string;
  empresaCodigo: string;
  sapDocnum: number;
  hashPdf: string;
  estado: string;
  origen: string;
  odooPickingId?: number;
  odooOrigin?: string;
  ultimoError?: string;
  intentos: number;
  sapDocEntry?: number;
  sapDocDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapeoItem {
  id: string;
  empresaCodigo: string;
  itemCodeSap: string;
  odooProductId: number;
  factorUom: number;
  activo: boolean;
  notas?: string;
}

export interface MapeoBodega {
  id: string;
  empresaCodigo: string;
  whsCodeSap: string;
  tipoOperacion: 'SALIDA' | 'ENTRADA';
  odooLocationId: number;
  odooPickingTypeId: number;
  odooLocationDestId: number;
  forzarSinStock: boolean;
  activo: boolean;
  notas?: string;
}

export interface PickingTypeOdoo {
  id: number;
  nombre: string;
  codigo: string;
}

export interface Dashboard {
  total: number;
  exitosos: number;
  errores: number;
  porcentajeExito: number;
  porTipo: Record<string, { total: number; exitosos: number; errores: number }>;
}

export interface HistorialEntry {
  id: string;
  tipo: string;
  nombreArchivo: string | null;
  totalFilas: number;
  ajustados: number;
  sinCambio: number;
  errores: number;
  sinBodega: number;
  detalleErrores: string[];
  sinBodegaLista: string[];
  estado: string;
  origen: string;
  errorFatal: string | null;
  creadoEn: string;
}

export const integracionSapApi = createApi({
  reducerPath: 'integracionSapApi',
  baseQuery: makeBaseQueryWithReauth('/api/integracion-sap'),
  tagTypes: ['Registro', 'MapeoItem', 'MapeoBodega', 'Catalogo', 'Historial'],
  endpoints: (builder) => ({
    getRegistros: builder.query<
      { items: RegistroSincronizacion[]; total: number },
      { estado?: string; docnum?: string; page?: number; limit?: number }
    >({
      query: (params) => ({ url: '/registros', params }),
      providesTags: ['Registro'],
    }),
    getRegistro: builder.query<RegistroSincronizacion, string>({
      query: (id) => `/registros/${id}`,
    }),
    reprocesar: builder.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/registros/${id}/reprocesar`, method: 'POST' }),
      invalidatesTags: ['Registro'],
    }),
    getMapeoItems: builder.query<MapeoItem[], string | undefined>({
      query: (empresa) => ({ url: '/mapeos/items', params: empresa ? { empresa } : {} }),
      providesTags: ['MapeoItem'],
    }),
    crearMapeoItem: builder.mutation<MapeoItem, Partial<MapeoItem>>({
      query: (body) => ({ url: '/mapeos/items', method: 'POST', body }),
      invalidatesTags: ['MapeoItem'],
    }),
    actualizarMapeoItem: builder.mutation<MapeoItem, { id: string; data: Partial<MapeoItem> }>({
      query: ({ id, data }) => ({ url: `/mapeos/items/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['MapeoItem'],
    }),
    getDashboard: builder.query<Dashboard, void>({
      query: () => '/historial/resumen',
    }),
    getHistorialTodos: builder.query<
      { items: HistorialEntry[]; total: number },
      { estado?: string; tipo?: string; page?: number; limit?: number }
    >({
      query: (params) => ({ url: '/historial/todos', params }),
      keepUnusedDataFor: 0,
    }),
    dispararSalida: builder.mutation<{ ok: boolean }, { docNum: number }>({
      query: (body) => ({ url: '/salida/disparar', method: 'POST', body }),
      invalidatesTags: ['Registro'],
    }),
    dispararEntrada: builder.mutation<{ ok: boolean }, { docNum: number }>({
      query: (body) => ({ url: '/entrada/disparar', method: 'POST', body }),
      invalidatesTags: ['Registro'],
    }),
    dispararInventario: builder.mutation<void, { tipo: string }>({
      query: (body) => ({ url: '/inventario/disparar', method: 'POST', body }),
    }),
    subirDocumento: builder.mutation<
      {
        uploadId: string;
        totalFilas: number;
        advertencias: string[];
        filas: any[];
        columnasDetectadas: Record<string, string>;
        headersDisponibles: string[];
      },
      { tipo: string; file: File }
    >({
      query: ({ tipo, file }) => {
        const form = new FormData();
        form.append('file', file);
        return { url: `/documentos/${tipo}/upload`, method: 'POST', body: form };
      },
    }),
    procesarDocumento: builder.mutation<
      { jobId: string; total: number },
      { tipo: string; uploadId: string; mapeoColumnas?: Record<string, string>; ubicacionOverrideId?: number; referenciaSap?: string; whsCodeOverride?: string }
    >({
      query: ({ tipo, uploadId, mapeoColumnas, ubicacionOverrideId, referenciaSap, whsCodeOverride }) => ({
        url: `/documentos/${tipo}/procesar/${uploadId}`,
        method: 'POST',
        body: { mapeoColumnas, ubicacionOverrideId, referenciaSap, whsCodeOverride },
      }),
      invalidatesTags: ['Registro'],
    }),
    getMapeosBodegas: builder.query<MapeoBodega[], string | undefined>({
      query: (empresa) => ({ url: '/mapeos/bodegas', params: empresa ? { empresa } : {} }),
      providesTags: ['MapeoBodega'],
    }),
    crearMapeoBodega: builder.mutation<MapeoBodega, Partial<MapeoBodega>>({
      query: (body) => ({ url: '/mapeos/bodegas', method: 'POST', body }),
      invalidatesTags: ['MapeoBodega'],
    }),
    actualizarMapeoBodega: builder.mutation<MapeoBodega, { id: string; data: Partial<MapeoBodega> }>({
      query: ({ id, data }) => ({ url: `/mapeos/bodegas/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['MapeoBodega'],
    }),
    eliminarMapeoBodega: builder.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/mapeos/bodegas/${id}`, method: 'DELETE' }),
      invalidatesTags: ['MapeoBodega'],
    }),
    getUbicacionesOdoo: builder.query<{ id: number; nombre: string }[], void>({
      query: () => '/odoo/ubicaciones',
    }),
    getPickingTypesOdoo: builder.query<PickingTypeOdoo[], void>({
      query: () => '/odoo/picking-types',
    }),
    getJob: builder.query<
      {
        estado: 'procesando' | 'completado' | 'error';
        progreso: number;
        total: number;
        resultado?: {
          procesados: number; ajustados: number; sinCambio: number; errores: number;
          detalleErrores: string[]; sinMapeo: string[]; sinBodega: string[]; conOnHandCero: string[];
        };
        errorMsg?: string;
      },
      { tipo: string; jobId: string }
    >({
      query: ({ tipo, jobId }) => `/documentos/${tipo}/job/${jobId}`,
    }),
    getHistorial: builder.query<
      Array<{
        id: string; tipo: string; nombreArchivo: string | null;
        totalFilas: number; ajustados: number; sinCambio: number;
        errores: number; sinBodega: number; conOnHandCero: number;
        detalleErrores: string[]; sinBodegaLista: string[];
        estado: string; errorFatal: string | null; creadoEn: string;
      }>,
      string
    >({
      query: (tipo) => `/documentos/${tipo}/historial`,
      providesTags: ['Historial'],
      keepUnusedDataFor: 0,
    }),
    cambiarHoja: builder.mutation<
      {
        uploadId: string;
        totalFilas: number;
        advertencias: string[];
        filas: any[];
        columnasDetectadas: Record<string, string>;
        headersDisponibles: string[];
        hojas: string[];
        hojaActual: string;
      },
      { tipo: string; uploadId: string; hoja: string }
    >({
      query: ({ tipo, uploadId, hoja }) => ({
        url: `/documentos/${tipo}/sesion/${uploadId}/hoja`,
        method: 'POST',
        body: { hoja },
      }),
    }),
    getCatalogo: builder.query<
      { items: Array<{ itemCode: string; itemName: string; uomCode?: string; precioUnitario?: number | null }>; total: number },
      { q?: string; empresa?: string; limit?: number }
    >({
      query: (params) => ({ url: '/catalogo/items', params }),
      providesTags: ['Catalogo'],
    }),
  }),
});

export const {
  useGetRegistrosQuery,
  useReprocesarMutation,
  useGetHistorialTodosQuery,
  useGetMapeoItemsQuery,
  useCrearMapeoItemMutation,
  useActualizarMapeoItemMutation,
  useGetMapeosBodegasQuery,
  useCrearMapeoBodegaMutation,
  useActualizarMapeoBodegaMutation,
  useEliminarMapeoBodegaMutation,
  useGetDashboardQuery,
  useGetUbicacionesOdooQuery,
  useGetPickingTypesOdooQuery,
  useDispararSalidaMutation,
  useDispararEntradaMutation,
  useDispararInventarioMutation,
  useSubirDocumentoMutation,
  useProcesarDocumentoMutation,
  useGetJobQuery,
  useGetHistorialQuery,
  useCambiarHojaMutation,
  useGetCatalogoQuery,
} = integracionSapApi;
