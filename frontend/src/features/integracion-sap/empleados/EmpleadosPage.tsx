'use client';
import {
  Box, Card, Text, Group, TextInput, Table, Badge,
  Skeleton, Alert, Pagination, SegmentedControl, Select,
  Tooltip, ActionIcon,
} from '@mantine/core';
import {
  IconSearch, IconUsers, IconAlertTriangle, IconDatabase,
  IconArrowUp, IconArrowDown, IconArrowsSort, IconDownload,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { useGetComparacionEmpleadosQuery } from '@/store/api/integracionSapApi';
import { useDebouncedValue } from '@mantine/hooks';

type SortKey = 'empleadoCodigo' | 'nombreCompleto' | 'departamento' | 'puesto' | 'enOdoo' | 'sincEstado';
type SortDir = 'asc' | 'desc' | null;

const COLOR_SINC: Record<string, string> = {
  creado: 'green',
  actualizado: 'blue',
  error: 'red',
};

const LABEL_SINC: Record<string, string> = {
  creado: 'Creado',
  actualizado: 'Actualizado',
  error: 'Error',
};

function SincBadge({ estado }: { estado: string | null }) {
  if (!estado) return <Badge size="xs" color="gray" variant="light">Sin sincronizar</Badge>;
  return (
    <Badge size="xs" color={COLOR_SINC[estado] ?? 'gray'} variant="light">
      {LABEL_SINC[estado] ?? estado}
    </Badge>
  );
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <IconArrowsSort size={12} color="#A1A1AA" />;
  if (sortDir === 'asc') return <IconArrowUp size={12} color="#1A365D" />;
  return <IconArrowDown size={12} color="#1A365D" />;
}

function SortTh({
  col, label, sortKey, sortDir, onSort, style,
}: {
  col: SortKey; label: string; sortKey: SortKey | null; sortDir: SortDir;
  onSort: (col: SortKey) => void; style?: React.CSSProperties;
}) {
  return (
    <Table.Th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
      onClick={() => onSort(col)}>
      <Group gap={4} wrap="nowrap">
        <Text size="xs" fw={600}>{label}</Text>
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </Group>
    </Table.Th>
  );
}

async function descargarExcel(ruta: string, nombre: string) {
  const res = await fetch(ruta, { credentials: 'include' });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export function EmpleadosPage() {
  const [q, setQ] = useState('');
  const [descargando, setDescargando] = useState(false);
  const [debouncedQ] = useDebouncedValue(q, 300);
  const [page, setPage] = useState(1);
  const [filtroOdoo, setFiltroOdoo] = useState('todos');
  const [filtroSinc, setFiltroSinc] = useState('todos');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const { data, isLoading } = useGetComparacionEmpleadosQuery({
    q: debouncedQ || undefined,
    page,
    limit: 50,
  });

  const handleSort = (col: SortKey) => {
    if (sortKey !== col) { setSortKey(col); setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir('desc'); return; }
    setSortKey(null); setSortDir(null);
  };

  const filtered = useMemo(() => {
    if (!data?.items) return [];
    let items = [...data.items];

    if (filtroOdoo === 'en_odoo') items = items.filter(e => e.odoo !== null);
    if (filtroOdoo === 'no_odoo') items = items.filter(e => e.odoo === null);

    if (filtroSinc === 'creados') items = items.filter(e => e.local.odooSincEstado === 'creado');
    if (filtroSinc === 'actualizados') items = items.filter(e => e.local.odooSincEstado === 'actualizado');
    if (filtroSinc === 'error') items = items.filter(e => e.local.odooSincEstado === 'error');
    if (filtroSinc === 'sin_sinc') items = items.filter(e => !e.local.odooSincEstado);

    if (sortKey && sortDir) {
      items.sort((a, b) => {
        let va: any = '';
        let vb: any = '';
        if (sortKey === 'empleadoCodigo') { va = a.empleadoCodigo; vb = b.empleadoCodigo; }
        if (sortKey === 'nombreCompleto') { va = a.nombreCompleto; vb = b.nombreCompleto; }
        if (sortKey === 'departamento') { va = a.departamento ?? ''; vb = b.departamento ?? ''; }
        if (sortKey === 'puesto') { va = a.puesto ?? ''; vb = b.puesto ?? ''; }
        if (sortKey === 'enOdoo') { va = a.odoo ? 1 : 0; vb = b.odoo ? 1 : 0; }
        if (sortKey === 'sincEstado') { va = a.local.odooSincEstado ?? ''; vb = b.local.odooSincEstado ?? ''; }
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : (va - vb);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return items;
  }, [data?.items, filtroOdoo, filtroSinc, sortKey, sortDir]);

  const totalPages = data ? Math.ceil(data.total / 50) : 0;

  return (
    <Box>
      <Group justify="space-between" align="flex-end" mb="lg">
        <Box>
          <Text size="xl" fw={700} c="#18181B">Catálogo de empleados</Text>
          <Text size="sm" c="#71717A">Comparación entre el sistema local y Odoo RR.HH.</Text>
        </Box>
        <Group gap="xs">
          <Box style={{ background: '#EFF6FF', borderRadius: 8, padding: '8px 12px' }}>
            <Group gap={6}>
              <IconUsers size={16} color="#1A365D" />
              <Text size="sm" fw={600} c="#1A365D">
                {isLoading ? '…' : (data?.total ?? 0)} empleados
              </Text>
            </Group>
          </Box>
          <Tooltip label="Descargar catálogo limpio (Excel)">
            <ActionIcon
              variant="light" color="teal" size="lg"
              loading={descargando}
              onClick={async () => {
                setDescargando(true);
                await descargarExcel(
                  '/api/integracion-sap/empleados/descargar',
                  'catalogo-empleados.xlsx',
                );
                setDescargando(false);
              }}
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Card withBorder mb="md" p="md">
        <Group gap="md" wrap="wrap">
          <TextInput
            placeholder="Buscar por nombre, código, DPI o departamento…"
            leftSection={<IconSearch size={14} />}
            value={q}
            onChange={e => { setQ(e.currentTarget.value); setPage(1); }}
            style={{ flex: 1, minWidth: 220 }}
            size="sm"
          />
          <SegmentedControl
            size="xs"
            value={filtroOdoo}
            onChange={v => { setFiltroOdoo(v); setPage(1); }}
            data={[
              { label: 'Todos', value: 'todos' },
              { label: 'En Odoo', value: 'en_odoo' },
              { label: 'No en Odoo', value: 'no_odoo' },
            ]}
          />
          <Select
            size="xs"
            placeholder="Estado sincronización"
            value={filtroSinc}
            onChange={v => { setFiltroSinc(v ?? 'todos'); setPage(1); }}
            data={[
              { label: 'Todos los estados', value: 'todos' },
              { label: 'Creados en Odoo', value: 'creados' },
              { label: 'Actualizados en Odoo', value: 'actualizados' },
              { label: 'Con error', value: 'error' },
              { label: 'Sin sincronizar', value: 'sin_sinc' },
            ]}
            style={{ minWidth: 180 }}
          />
        </Group>
      </Card>

      <Card withBorder p={0}>
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover verticalSpacing="xs" fz="xs">
            <Table.Thead style={{ background: '#F9FAFB' }}>
              <Table.Tr>
                <SortTh col="empleadoCodigo" label="Código" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} style={{ width: 90 }} />
                <SortTh col="nombreCompleto" label="Nombre" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="departamento" label="Departamento" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="puesto" label="Puesto" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Table.Th style={{ width: 110 }}><Text size="xs" fw={600}>DPI</Text></Table.Th>
                <Table.Th><Text size="xs" fw={600}>Correo</Text></Table.Th>
                <Table.Th style={{ width: 100 }}><Text size="xs" fw={600}>Ing. fecha</Text></Table.Th>
                <SortTh col="enOdoo" label="En Odoo" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} style={{ width: 80 }} />
                <SortTh col="sincEstado" label="Estado sinc." sortKey={sortKey} sortDir={sortDir} onSort={handleSort} style={{ width: 120 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => (
                <Table.Tr key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <Table.Td key={j}><Skeleton height={14} radius="sm" /></Table.Td>
                  ))}
                </Table.Tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Box py="xl" ta="center">
                      <IconDatabase size={28} color="#A1A1AA" />
                      <Text size="sm" c="#A1A1AA" mt="xs">
                        {data?.total === 0
                          ? 'No hay empleados cargados. Usa "Cargar archivo" para importar desde nóminas.'
                          : 'Sin resultados para los filtros seleccionados.'}
                      </Text>
                    </Box>
                  </Table.Td>
                </Table.Tr>
              )}
              {!isLoading && filtered.map(emp => (
                <Table.Tr key={emp.empleadoCodigo}>
                  <Table.Td>
                    <Text size="xs" fw={600} ff="monospace">{emp.empleadoCodigo}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" fw={500}>{emp.nombreCompleto}</Text>
                    {emp.odoo && emp.odoo.nombre !== emp.nombreCompleto && (
                      <Text size="10px" c="#71717A">Odoo: {emp.odoo.nombre}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="#374151">{emp.departamento ?? <Text size="xs" c="#A1A1AA" span>—</Text>}</Text>
                    {emp.odoo?.departamento && emp.odoo.departamento !== emp.departamento && (
                      <Text size="10px" c="#71717A">Odoo: {emp.odoo.departamento}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="#374151">{emp.puesto ?? <Text size="xs" c="#A1A1AA" span>—</Text>}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace" c="#52525B">{emp.local.dpi ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="#52525B">{emp.local.correo ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="#52525B">
                      {emp.local.fechaIngreso
                        ? new Date(emp.local.fechaIngreso).toLocaleDateString('es-GT')
                        : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {emp.odoo
                      ? <Badge size="xs" color="green" variant="light">Sí</Badge>
                      : <Badge size="xs" color="gray" variant="light">No</Badge>}
                  </Table.Td>
                  <Table.Td>
                    <SincBadge estado={emp.local.odooSincEstado} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {totalPages > 1 && (
          <Group justify="center" py="md" style={{ borderTop: '1px solid #F4F4F5' }}>
            <Pagination
              total={totalPages}
              value={page}
              onChange={setPage}
              size="sm"
              siblings={1}
            />
          </Group>
        )}
      </Card>
    </Box>
  );
}
