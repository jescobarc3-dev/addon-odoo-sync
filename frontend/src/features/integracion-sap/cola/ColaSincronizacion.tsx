'use client';
import {
  Box, Card, TextInput, Select, Group, ActionIcon, Tooltip,
  Text, Pagination, Badge, Stack, Skeleton,
} from '@mantine/core';
import { IconRefresh, IconTool, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useGetRegistrosQuery, useReprocesarMutation } from '@/store/api/integracionSapApi';
import { COLOR_ESTADO, LABEL_ESTADO } from '@/theme';
import { ResolverMapeoModal } from './ResolverMapeoModal';

const ESTADO_OPTIONS = [
  { label: 'Todos los estados', value: '' },
  { label: 'Validados', value: 'validado_odoo' },
  { label: 'Error mapeo', value: 'error_mapeo' },
  { label: 'Stock insuficiente', value: 'error_stock_insuficiente' },
  { label: 'Error SAP', value: 'error_sap' },
  { label: 'Error Odoo', value: 'error_odoo' },
  { label: 'Recibido', value: 'recibido' },
];

function StatusBadge({ estado }: { estado: string }) {
  const color = COLOR_ESTADO[estado] ?? 'gray';
  const label = LABEL_ESTADO[estado] ?? estado;
  return (
    <Badge color={color} size="sm" radius="sm" variant="light" fw={600}>
      {label}
    </Badge>
  );
}

export function ColaSincronizacion() {
  const [estado, setEstado] = useState('');
  const [docnum, setDocnum] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading, refetch } = useGetRegistrosQuery(
    { estado: estado || undefined, docnum: docnum || undefined, page, limit: 20 },
    { pollingInterval: 15000 },
  );
  const [reprocesar] = useReprocesarMutation();

  const handleReprocesar = async (id: string, sapDocnum: number) => {
    try {
      await reprocesar(id).unwrap();
      notifications.show({ title: 'Reprocesando', message: `DocNum ${sapDocnum} en cola`, color: 'blue' });
    } catch {
      notifications.show({ title: 'Error', message: 'No se pudo reprocesar', color: 'red' });
    }
  };

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <Stack gap="md">
      <Card withBorder p="md" style={{ background: '#fff' }}>
        <Group gap="sm">
          <TextInput
            placeholder="Buscar DocNum..."
            leftSection={<IconSearch size={14} />}
            value={docnum}
            onChange={(e) => { setDocnum(e.target.value); setPage(1); }}
            w={200}
            size="sm"
          />
          <Select
            data={ESTADO_OPTIONS}
            value={estado}
            onChange={(v) => { setEstado(v ?? ''); setPage(1); }}
            w={220}
            size="sm"
            placeholder="Filtrar por estado"
          />
          <ActionIcon variant="subtle" color="gray" onClick={() => refetch()} size="sm">
            <IconRefresh size={16} />
          </ActionIcon>
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
                  <th>DocNum</th>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th>Picking Odoo</th>
                  <th>Intentos</th>
                  <th>Último error</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((r) => (
                  <tr key={r.id}>
                    <td><Text size="sm" fw={700} c="#18181B">#{r.sapDocnum}</Text></td>
                    <td><Badge variant="outline" size="xs" color="gray">{r.empresaCodigo}</Badge></td>
                    <td><StatusBadge estado={r.estado} /></td>
                    <td>
                      {r.odooPickingId
                        ? <Text size="sm" c="#3B82F6" fw={500}>#{r.odooPickingId}</Text>
                        : <Text size="sm" c="#A1A1AA">—</Text>}
                    </td>
                    <td>
                      <Text size="sm" c={r.intentos > 2 ? '#8B1A1A' : '#71717A'}>{r.intentos}</Text>
                    </td>
                    <td style={{ maxWidth: 240 }}>
                      {r.ultimoError ? (
                        <Tooltip label={r.ultimoError} multiline w={320} position="top-start">
                          <Text
                            size="xs" c="#71717A"
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220, display: 'block' }}
                          >
                            {r.ultimoError}
                          </Text>
                        </Tooltip>
                      ) : <Text size="xs" c="#D4D4D8">—</Text>}
                    </td>
                    <td>
                      <Text size="xs" c="#71717A">{new Date(r.createdAt).toLocaleDateString('es-GT')}</Text>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Group gap={4} justify="flex-end">
                        {r.estado === 'error_mapeo' && (
                          <Tooltip label="Resolver mapeo">
                            <ActionIcon size="sm" variant="light" color="yellow" onClick={() => setSelected(r.id)}>
                              <IconTool size={13} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {r.estado.startsWith('error_') && (
                          <Tooltip label="Reprocesar">
                            <ActionIcon size="sm" variant="light" color="blue" onClick={() => handleReprocesar(r.id, r.sapDocnum)}>
                              <IconRefresh size={13} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </td>
                  </tr>
                ))}
                {!data?.items.length && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0' }}>
                      <Text c="#A1A1AA" size="sm">Sin registros para los filtros seleccionados</Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Box>
        )}
        {totalPages > 1 && (
          <Box style={{ borderTop: '1px solid #F4F4F5', padding: '12px 16px' }}>
            <Pagination total={totalPages} value={page} onChange={setPage} size="sm" color="ptRed" />
          </Box>
        )}
      </Card>

      <ResolverMapeoModal registroId={selected} onClose={() => setSelected(null)} />
    </Stack>
  );
}
