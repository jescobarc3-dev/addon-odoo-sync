import { createApi } from '@reduxjs/toolkit/query/react';
import { makeBaseQueryWithReauth } from './baseQueryWithReauth';

export interface PortalUsuarioAdmin {
  id: string;
  odooUid: number | null;
  odooLogin: string;
  nombre: string;
  permisos: string[];
  activo: boolean;
  ultimoLogin: string | null;
  sincronizadoEn: string | null;
  creadoEn: string;
}

export const adminApi = createApi({
  reducerPath: 'adminApi',
  baseQuery: makeBaseQueryWithReauth('/api', '/admin/login'),
  tagTypes: ['AdminPortalUsuario'],
  endpoints: (builder) => ({
    getAdminPortalUsuarios: builder.query<PortalUsuarioAdmin[], void>({
      query: () => '/admin/usuarios',
      providesTags: ['AdminPortalUsuario'],
    }),
    getAdminPermisosDisponibles: builder.query<{ permisos: string[] }, void>({
      query: () => '/admin/usuarios/permisos-disponibles',
    }),
    adminSyncOdooUsuarios: builder.mutation<{ nuevos: number; actualizados: number; total: number }, void>({
      query: () => ({ url: '/admin/usuarios/sync-odoo', method: 'POST' }),
      invalidatesTags: ['AdminPortalUsuario'],
    }),
    adminCrearUsuario: builder.mutation<PortalUsuarioAdmin, { nombre: string; email: string; password: string; permisos: string[] }>({
      query: (body) => ({ url: '/admin/usuarios', method: 'POST', body }),
      invalidatesTags: ['AdminPortalUsuario'],
    }),
    adminActualizarPermisos: builder.mutation<PortalUsuarioAdmin, { id: string; permisos: string[] }>({
      query: ({ id, permisos }) => ({ url: `/admin/usuarios/${id}/permisos`, method: 'PUT', body: { permisos } }),
      invalidatesTags: ['AdminPortalUsuario'],
    }),
    adminCambiarPassword: builder.mutation<void, { id: string; password: string }>({
      query: ({ id, password }) => ({ url: `/admin/usuarios/${id}/password`, method: 'PUT', body: { password } }),
    }),
    adminToggleActivoUsuario: builder.mutation<PortalUsuarioAdmin, { id: string; activo: boolean }>({
      query: ({ id, activo }) => ({ url: `/admin/usuarios/${id}/activo`, method: 'PUT', body: { activo } }),
      invalidatesTags: ['AdminPortalUsuario'],
    }),
  }),
});

export const {
  useGetAdminPortalUsuariosQuery,
  useGetAdminPermisosDisponiblesQuery,
  useAdminSyncOdooUsuariosMutation,
  useAdminCrearUsuarioMutation,
  useAdminActualizarPermisosMutation,
  useAdminCambiarPasswordMutation,
  useAdminToggleActivoUsuarioMutation,
} = adminApi;
