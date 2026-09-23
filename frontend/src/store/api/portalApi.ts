import { createApi } from '@reduxjs/toolkit/query/react';
import { makeBaseQueryWithReauth } from './baseQueryWithReauth';

export interface PortalUser {
  id: string;
  nombre: string;
  email: string;
  odooUid: number;
  permisos: string[];
  ultimoLogin: string | null;
  odooUrl: string | null;
}

export interface PortalUsuarioAdmin {
  id: string;
  odooUid: number;
  odooLogin: string;
  nombre: string;
  permisos: string[];
  activo: boolean;
  ultimoLogin: string | null;
  sincronizadoEn: string | null;
  creadoEn: string;
}

export const portalApi = createApi({
  reducerPath: 'portalApi',
  baseQuery: makeBaseQueryWithReauth('/api'),
  tagTypes: ['Me', 'PortalUsuario'],
  endpoints: (builder) => ({
    // Auth
    login: builder.mutation<{ ok: boolean }, { email: string; password: string }>({
      query: (body) => ({ url: '/portal/auth/login', method: 'POST', body }),
      invalidatesTags: ['Me'],
    }),
    logout: builder.mutation<{ ok: boolean }, void>({
      query: () => ({ url: '/portal/auth/logout', method: 'POST' }),
      invalidatesTags: ['Me'],
    }),
    getMe: builder.query<PortalUser, void>({
      query: () => '/portal/auth/me',
      providesTags: ['Me'],
    }),
    refresh: builder.mutation<{ ok: boolean }, void>({
      query: () => ({ url: '/portal/auth/refresh', method: 'POST' }),
      invalidatesTags: ['Me'],
    }),
    generarEnlace: builder.mutation<{ url: string; expiresEnSegundos: number }, void>({
      query: () => ({ url: '/portal/auth/generar-enlace', method: 'POST' }),
    }),

    // Admin: gestión de usuarios del portal
    getPortalUsuarios: builder.query<PortalUsuarioAdmin[], void>({
      query: () => '/portal/usuarios',
      providesTags: ['PortalUsuario'],
    }),
    getPermisosDisponibles: builder.query<{ permisos: string[] }, void>({
      query: () => '/portal/usuarios/permisos-disponibles',
    }),
    syncOdooUsuarios: builder.mutation<{ nuevos: number; actualizados: number; total: number }, void>({
      query: () => ({ url: '/portal/usuarios/sync-odoo', method: 'POST' }),
      invalidatesTags: ['PortalUsuario'],
    }),
    actualizarPermisos: builder.mutation<PortalUsuarioAdmin, { id: string; permisos: string[] }>({
      query: ({ id, permisos }) => ({
        url: `/portal/usuarios/${id}/permisos`,
        method: 'PUT',
        body: { permisos },
      }),
      invalidatesTags: ['PortalUsuario'],
    }),
    toggleActivoUsuario: builder.mutation<PortalUsuarioAdmin, { id: string; activo: boolean }>({
      query: ({ id, activo }) => ({
        url: `/portal/usuarios/${id}/activo`,
        method: 'PUT',
        body: { activo },
      }),
      invalidatesTags: ['PortalUsuario'],
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetMeQuery,
  useRefreshMutation,
  useGenerarEnlaceMutation,
  useGetPortalUsuariosQuery,
  useGetPermisosDisponiblesQuery,
  useSyncOdooUsuariosMutation,
  useActualizarPermisosMutation,
  useToggleActivoUsuarioMutation,
} = portalApi;
