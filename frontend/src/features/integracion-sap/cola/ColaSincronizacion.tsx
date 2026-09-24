'use client';
import {
  Card, Select, Group, ActionIcon, Tooltip,
  Text, Pagination, Badge, Stack, Skeleton, Box, Tabs,
} from '@mantine/core';
import { IconRefresh, IconAlertTriangle } from '@tabler/icons-react';
import { useState } from 'react';
import {
  useGetHistorialTodosQuery,
  useGetRegistrosQuery,
  RegistroSincronizacion,
  HistorialEntry,
} from '@/store/api/integracionSapApi';

// ── Cargas manuales (INT) ────────────────────────────────────────────────────

const TIPO_OPTS = [
  { label: 'Todos los tipos', value: '' },
  { label: 'Salidas de mercancía', value: 'SALIDA_BODEGA' },
  { label: 'Entradas de mercancía', value: 'ENTRADA_MERCANCIA' },
  { label: 'Inventario inicial', value: 'INVENTARIO_INICIAL' },
  { label: 'Actualización de inventario', value: 'ACTUALIZACION_INVENTARIO' },
];

const ESTADO_HIST_OPTS = [
  { label: 'Solo errores', value: 'error' },
  { label: 'Solo completadas', value: 'completado' },
  { label: 'Todos los estados', value: '' },
];

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

// ── SAP Sync (EXT) ───────────────────────────────────────────────────────────

const ESTADO_SYNC_OPTS = [
  { label: 'Solo errores', value: 'error' },
  { label: 'Validados', value: 'validado_odoo' },
  { label: 'Todos', value: '' },
];

const ESTADO_SYNC_COLOR: Record<string, string> = {
  recibido: 'gray',
  resuelto_sap: 'blue',
  mapeado: 'blue',
  creado_odoo: 'blue',
  validado_odoo: 'green',
  error_sap: 'red',
  error_mapeo: 'orange',
  error_stock_insuficiente: 'orange',
  error_odoo: 'red',
};

function BadgeOrigen({ origen }: { origen: string }) {
  const esExt = origen === 'EXT';
  return (
    <Badge
      size="xs"
      color={esExt ? 'violet' : 'gray'}
      variant={esExt ? 'filled' : 'outline'}
      title={esExt ? 'Externo — SAP Business One' : 'Interno — carga manual'}
    >
      {origen}
    </Badge>
  );
}

// ── Sección SAP Sync ─────────────────────────────────────────────────────────

function SeccionSapSync() {
  const [estadoSync, setEstadoSync] = useState('error');
  const [pageSync, setPageSync] = useState(1);

  const { data, isLoading, refetch } = useGetRegistrosQuery(
    { estado: estadoSync || undefined, page: pageSync, limit: 20 },
    { pollingInterval: 15000 },
  );

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <Stack gap="md">
      <Card withBorder p="md" style={{ background: '#fff' }}>
        <Group gap="sm" wrap="wrap">
          <Select
            data={ESTADO_SYNC_OPTS}
            value={estadoSync}
            onChange={(v) => { setEstadoSync(v ?? 'error'); setPageSync(1); }}
            w={220}
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
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={40} radius="sm" />)}
          </Stack>
        ) : (
          <Box style={{ overflowX: 'auto' }}>
            <table className="pt-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Fecha</th>
                  <th>Empresa</th>
                  <th>DocNum SAP</th>
                  <th>Estado</th>
                  <th>Picking Odoo</th>
                  <th>Origin Odoo</th>
                  <th style={{ textAlign: 'right' }}>Intentos</th>
                  <th>Último error</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((r: RegistroSincronizacion) => (
                  <tr key={r.id}>
                    <td><BadgeOrigen origen={r.origen ?? 'EXT'} /></td>
                    <td>
                      <Text size="xs" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(r.createdAt).toLocaleString('es-GT', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    </td>
                    <td><Text size="xs" c="#52525B">{r.empresaCodigo}</Text></td>
                    <td><Text size="xs" fw={600}>{r.sapDocnum}</Text></td>
                    <td>
                      <Badge size="xs" color={ESTADO_SYNC_COLOR[r.estado] ?? 'gray'} variant="light">
                        {r.estado.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td>
                      <Text size="xs" c={r.odooPickingId ? '#166534' : '#A1A1AA'}>
                        {r.odooPickingId ?? '—'}
                      </Text>
                    </td>
                    <td>
                      <Text size="xs" ff="monospace" c="#52525B">{r.odooOrigin ?? '—'}</Text>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Text size="xs" c={r.intentos > 1 ? '#92400E' : '#A1A1AA'}>{r.intentos}</Text>
                    </td>
                    <td style={{ maxWidth: 240 }}>
                      {r.ultimoError ? (
                        <Tooltip label={r.ultimoError} multiline w={320} position="top-start">
                          <Text size="xs" c="red" lineClamp={1}>{r.ultimoError}</Text>
                        </Tooltip>
                      ) : (
                        <Text size="xs" c="#D4D4D8">—</Text>
                      )}
                    </td>
                  </tr>
                ))}
                {!data?.items.length && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px 0' }}>
                      <Text c="#A1A1AA" size="sm">
                        {estadoSync === 'error' ? 'Sin sincronizaciones con error.' : 'Sin registros.'}
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
                Mostrando {(pageSync - 1) * 20 + 1}–{Math.min(pageSync * 20, data?.total ?? 0)} de {data?.total ?? 0}
              </Text>
              <Pagination total={totalPages} value={pageSync} onChange={setPageSync} size="sm" color="ptSlate" />
            </Group>
          </Box>
        )}
      </Card>
    </Stack>
  );
}

// ── Sección cargas manuales ──────────────────────────────────────────────────

function SeccionCargasManuales() {
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
            data={ESTADO_HIST_OPTS}
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
                  <th>Origen</th>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Archivo</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Filas</th>
                  <th style={{ textAlign: 'right' }}>Ajustados</th>
                  <th style={{ textAlign: 'right' }}>Errores</th>
                  <th>Detalle del error</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((h: HistorialEntry) => (
                  <tr key={h.id}>
                    <td><BadgeOrigen origen={h.origen ?? 'INT'} /></td>
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
                  </tr>
                ))}
                {!data?.items.length && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px 0' }}>
                      <Text c="#A1A1AA" size="sm">
                        {estado === 'error' ? 'Sin cargas con error — todo está limpio.' : 'Sin registros.'}
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

// ── Componente principal ─────────────────────────────────────────────────────

export function ColaSincronizacion() {
  return (
    <Tabs defaultValue="ext" variant="outline">
      <Tabs.List mb="md">
        <Tabs.Tab value="ext" leftSection={<BadgeOrigen origen="EXT" />}>
          SAP Sincronizador
        </Tabs.Tab>
        <Tabs.Tab value="int" leftSection={<BadgeOrigen origen="INT" />}>
          Cargas manuales
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="ext">
        <SeccionSapSync />
      </Tabs.Panel>
      <Tabs.Panel value="int">
        <SeccionCargasManuales />
      </Tabs.Panel>
    </Tabs>
  );
}
