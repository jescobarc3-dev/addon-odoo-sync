'use client';
import {
  Card, TextInput, Select, Group, ActionIcon, Tooltip,
  Text, Pagination, Badge, Stack, Skeleton, Box, Anchor,
} from '@mantine/core';
import { IconRefresh, IconSearch, IconExternalLink } from '@tabler/icons-react';
import { useState } from 'react';
import { useGetHistorialTodosQuery } from '@/store/api/integracionSapApi';

const TIPO_OPTS = [
  { label: 'Todos los tipos', value: '' },
  { label: 'Salidas de mercancía', value: 'SALIDA_BODEGA' },
  { label: 'Entradas de mercancía', value: 'ENTRADA_MERCANCIA' },
  { label: 'Inventario inicial', value: 'INVENTARIO_INICIAL' },
  { label: 'Actualización de inventario', value: 'ACTUALIZACION_INVENTARIO' },
];

const ESTADO_OPTS = [
  { label: 'Solo errores', value: 'error' },
  { label: 'Solo completadas', value: 'completado' },
  { label: 'Todos los estados', value: '' },
];

const TIPO_HREF: Record<string, string> = {
  SALIDA_BODEGA: '/integracion-sap/documentos/salidas',
  ENTRADA_MERCANCIA: '/integracion-sap/documentos/entradas',
  INVENTARIO_INICIAL: '/integracion-sap/documentos/inventario-inicial',
  ACTUALIZACION_INVENTARIO: '/integracion-sap/documentos/actualizacion',
};

const TIPO_LABEL: Record<string, string> = {
  SALIDA_BODEGA: 'Salida',
  ENTRADA_MERCANCIA: 'Entrada',
  INVENTARIO_INICIAL: 'Inv. inicial',
  ACTUALIZACION_INVENTARIO: 'Actualización',
};

const TIPO_COLOR: Record<string, string> = {
  SALIDA_BODEGA: 'ptAmber',
  ENTRADA_MERCANCIA: 'ptSlate',
  INVENTARIO_INICIAL: 'teal',
  ACTUALIZACION_INVENTARIO: 'gray',
};

export function ColaSincronizacion() {
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('error');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useGetHistorialTodosQuery(
    { estado: estado || undefined, tipo: tipo || undefined, page, limit: 20 },
    { pollingInterval: 15000 },
  );

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <Stack gap="md">
      <Card withBorder p="md" style={{ background: '#fff' }}>
        <Group gap="sm" wrap="wrap">
          <Select
            data={ESTADO_OPTS}
            value={estado}
            onChange={(v) => { setEstado(v ?? 'error'); setPage(1); }}
            w={220}
            size="sm"
          />
          <Select
            data={TIPO_OPTS}
            value={tipo}
            onChange={(v) => { setTipo(v ?? ''); setPage(1); }}
            w={240}
            size="sm"
          />
          <Tooltip label="Refrescar">
            <ActionIcon variant="subtle" color="gray" onClick={() => refetch()} size="sm">
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          <Text size="sm" c="#71717A" ml="auto">
            {data?.total ?? 0} registro{(data?.total ?? 0) !== 1 ? 's' : ''}
          </Text>
        </Group>
      </Card>

      <Card withBorder p={0} style={{ background: '#fff', overflow: 'hidden' }}>
        {isLoading ? (
          <Stack p="md" gap="sm">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={40} radius="sm" />)}
          </Stack>
        ) : (
          <Box style={{ overflowX: 'auto' }}>
            <table className="pt-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Archivo</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Filas</th>
                  <th style={{ textAlign: 'right' }}>Ajustados</th>
                  <th style={{ textAlign: 'right' }}>Errores</th>
                  <th>Detalle del error</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <Text size="xs" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(h.creadoEn).toLocaleString('es-GT', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    </td>
                    <td>
                      <Badge size="xs" color={TIPO_COLOR[h.tipo] ?? 'gray'} variant="light">
                        {TIPO_LABEL[h.tipo] ?? h.tipo}
                      </Badge>
                    </td>
                    <td>
                      <Text size="xs" c="#52525B" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.nombreArchivo ?? '—'}
                      </Text>
                    </td>
                    <td>
                      <Badge size="xs" color={h.estado === 'completado' ? 'green' : 'red'} variant="light">
                        {h.estado}
                      </Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}><Text size="xs">{h.totalFilas}</Text></td>
                    <td style={{ textAlign: 'right' }}>
                      <Text size="xs" fw={600} c="#166534">{h.ajustados}</Text>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Text size="xs" c={h.errores > 0 ? '#92400E' : '#A1A1AA'}>{h.errores}</Text>
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      {h.errorFatal ? (
                        <Tooltip label={h.errorFatal} multiline w={320} position="top-start">
                          <Text size="xs" c="red" lineClamp={1}>{h.errorFatal}</Text>
                        </Tooltip>
                      ) : h.detalleErrores?.length > 0 ? (
                        <Tooltip label={h.detalleErrores.join('\n')} multiline w={320} position="top-start">
                          <Text size="xs" c="#92400E" lineClamp={1}>{h.detalleErrores[0]}</Text>
                        </Tooltip>
                      ) : (
                        <Text size="xs" c="#D4D4D8">—</Text>
                      )}
                    </td>
                    <td>
                      {TIPO_HREF[h.tipo] && (
                        <Tooltip label="Ir a la sección para reintentar">
                          <Anchor href={TIPO_HREF[h.tipo]} size="xs" c="#1A365D">
                            <IconExternalLink size={13} />
                          </Anchor>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                ))}
                {!data?.items.length && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px 0' }}>
                      <Text c="#A1A1AA" size="sm">
                        {estado === 'error' ? 'Sin cargas con error — todo está limpio.' : 'Sin registros para los filtros seleccionados.'}
                      </Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Box>
        )}
        {totalPages > 1 && (
          <Box style={{ borderTop: '1px solid #F4F4F5', padding: '12px 16px' }}>
            <Group justify="space-between" align="center">
              <Text size="xs" c="#71717A">
                Mostrando {(page - 1) * 20 + 1}–{Math.min(page * 20, data?.total ?? 0)} de {data?.total ?? 0}
              </Text>
              <Pagination total={totalPages} value={page} onChange={setPage} size="sm" color="ptSlate" />
            </Group>
          </Box>
        )}
      </Card>
    </Stack>
  );
}
