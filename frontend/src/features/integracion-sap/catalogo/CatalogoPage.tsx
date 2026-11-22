'use client';
import {
  Box, Card, Text, Group, TextInput, Table, Badge,
  Skeleton, Alert, ThemeIcon, NumberFormatter, Pagination,
  Tooltip, ActionIcon, SegmentedControl, Select,
} from '@mantine/core';
import {
  IconSearch, IconPackage, IconAlertTriangle, IconDatabase,
  IconRefresh, IconCheck, IconX, IconArrowUp, IconArrowDown, IconArrowsSort,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { useGetComparacionCatalogoQuery } from '@/store/api/integracionSapApi';
import { useDebouncedValue } from '@mantine/hooks';

type SortKey = 'itemCode' | 'itemName' | 'localPrecio' | 'odooPrecio' | 'odooStock';
type SortDir = 'asc' | 'desc' | null;

function toNum(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function PrecioCell({ valor, label }: { valor: any; label?: string }) {
  const n = toNum(valor);
  if (valor == null) return <Text size="xs" c="#A1A1AA">—</Text>;
  return (
    <Text size="xs" fw={500} c={label === 'odoo' ? '#1A365D' : '#166534'}>
      Q <NumberFormatter value={n} thousandSeparator="," decimalSeparator="." decimalScale={2} fixedDecimalScale />
    </Text>
  );
}

function difPct(localPrecio: any, odooPrecio: any): number | null {
  const lp = toNum(localPrecio);
  const op = toNum(odooPrecio);
  if (lp === 0 && op === 0) return 0;
  if (lp === 0) return Infinity;
  return Math.abs((op - lp) / lp);
}

function DifBadge({ localPrecio, odooPrecio }: { localPrecio: any; odooPrecio: any }) {
  if (localPrecio == null || odooPrecio == null) return null;
  const dif = difPct(localPrecio, odooPrecio);
  if (dif === null) return null;
  if (dif === 0) return <Badge size="xs" color="green" variant="light">Igual</Badge>;
  if (dif === Infinity) return <Badge size="xs" color="orange" variant="light">Addon Q0</Badge>;
  if (dif < 0.05) return <Badge size="xs" color="yellow" variant="light">&lt;5%</Badge>;
  return <Badge size="xs" color="red" variant="light">{(dif * 100).toFixed(0)}% dif</Badge>;
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
  onSort: (c: SortKey) => void; style?: React.CSSProperties;
}) {
  return (
    <Table.Th
      style={{ cursor: 'pointer', userSelect: 'none', ...style }}
      onClick={() => onSort(col)}
    >
      <Group gap={4} justify={style?.textAlign === 'right' ? 'flex-end' : 'flex-start'} wrap="nowrap">
        <Text size="xs" fw={600} inherit>{label}</Text>
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </Group>
    </Table.Th>
  );
}

type FiltroOdoo = 'todos' | 'en_odoo' | 'no_odoo';
type FiltroDif = 'todos' | 'igual' | 'con_dif' | 'addon_cero' | 'sin_precio';

export function CatalogoPage() {
  const [q, setQ] = useState('');
  const [debouncedQ] = useDebouncedValue(q, 350);
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filtroOdoo, setFiltroOdoo] = useState<FiltroOdoo>('todos');
  const [filtroDif, setFiltroDif] = useState<FiltroDif>('todos');

  const { data, isLoading, isError, isFetching, refetch } = useGetComparacionCatalogoQuery(
    { q: debouncedQ, page, limit: LIMIT },
    { refetchOnMountOrArgChange: true },
  );

  const rawItems = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const handleSearch = (v: string) => { setQ(v); setPage(1); };

  const handleSort = (col: SortKey) => {
    if (sortKey === col) {
      if (sortDir === 'asc') { setSortDir('desc'); }
      else if (sortDir === 'desc') { setSortKey(null); setSortDir(null); }
      else { setSortDir('asc'); }
    } else {
      setSortKey(col);
      setSortDir('asc');
    }
  };

  const items = useMemo(() => {
    let arr = [...rawItems];

    // Filtro "En Odoo"
    if (filtroOdoo === 'en_odoo') arr = arr.filter(i => i.odoo !== null);
    if (filtroOdoo === 'no_odoo') arr = arr.filter(i => i.odoo === null);

    // Filtro "Dif. precio"
    if (filtroDif === 'igual') {
      arr = arr.filter(i => i.odoo && difPct(i.local.precio, i.odoo.standardPrice) === 0);
    } else if (filtroDif === 'con_dif') {
      arr = arr.filter(i => {
        if (!i.odoo) return false;
        const d = difPct(i.local.precio, i.odoo.standardPrice);
        return d !== null && d > 0 && d !== Infinity;
      });
    } else if (filtroDif === 'addon_cero') {
      arr = arr.filter(i => i.local.precio != null && toNum(i.local.precio) === 0);
    } else if (filtroDif === 'sin_precio') {
      arr = arr.filter(i => i.local.precio == null);
    }

    // Sort
    if (sortKey && sortDir) {
      arr.sort((a, b) => {
        let va: number | string = 0;
        let vb: number | string = 0;
        if (sortKey === 'itemCode') { va = a.itemCode; vb = b.itemCode; }
        else if (sortKey === 'itemName') { va = a.itemName; vb = b.itemName; }
        else if (sortKey === 'localPrecio') { va = toNum(a.local.precio); vb = toNum(b.local.precio); }
        else if (sortKey === 'odooPrecio') { va = toNum(a.odoo?.standardPrice); vb = toNum(b.odoo?.standardPrice); }
        else if (sortKey === 'odooStock') { va = toNum(a.odoo?.qtyAvailable); vb = toNum(b.odoo?.qtyAvailable); }

        if (typeof va === 'string') {
          return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
        }
        return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
      });
    }

    return arr;
  }, [rawItems, filtroOdoo, filtroDif, sortKey, sortDir]);

  return (
    <Box>
      {/* Header */}
      <Card withBorder p="lg" mb="md" style={{ background: '#fff', borderLeft: '4px solid #1A365D' }}>
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <ThemeIcon size={44} radius="sm" style={{ background: '#1A365D15' }}>
              <IconDatabase size={22} color="#1A365D" />
            </ThemeIcon>
            <Box>
              <Group gap="sm" align="center">
                <Text fw={700} size="lg" c="#18181B">Catálogo de artículos</Text>
                {total > 0 && (
                  <Badge variant="light" color="blue" size="sm">
                    <NumberFormatter value={total} thousandSeparator="," /> artículos
                  </Badge>
                )}
              </Group>
              <Text size="sm" c="#71717A" mt={4}>
                Comparación entre los datos del addon (Excel cargado) y el estado actual en Odoo.
              </Text>
            </Box>
          </Group>
          <Tooltip label="Recargar datos de Odoo">
            <ActionIcon variant="light" color="blue" size="lg" loading={isFetching} onClick={() => refetch()}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Card>

      {/* Filtros + búsqueda */}
      <Card withBorder p="md" mb="md" style={{ background: '#fff' }}>
        <Group gap="md" wrap="wrap">
          <TextInput
            placeholder="Buscar por código o nombre…"
            leftSection={<IconSearch size={16} color="#71717A" />}
            value={q}
            onChange={(e) => handleSearch(e.currentTarget.value)}
            size="sm"
            style={{ flex: 1, minWidth: 220 }}
          />
          <SegmentedControl
            size="xs"
            value={filtroOdoo}
            onChange={v => setFiltroOdoo(v as FiltroOdoo)}
            data={[
              { label: 'Todos', value: 'todos' },
              { label: 'En Odoo', value: 'en_odoo' },
              { label: 'No en Odoo', value: 'no_odoo' },
            ]}
          />
          <Select
            size="xs"
            placeholder="Filtrar por diferencia"
            value={filtroDif}
            onChange={v => setFiltroDif((v ?? 'todos') as FiltroDif)}
            style={{ width: 190 }}
            data={[
              { label: 'Todas las diferencias', value: 'todos' },
              { label: 'Precio igual', value: 'igual' },
              { label: 'Con diferencia', value: 'con_dif' },
              { label: 'Precio addon Q0', value: 'addon_cero' },
              { label: 'Sin precio en addon', value: 'sin_precio' },
            ]}
          />
        </Group>
      </Card>

      {/* Leyenda */}
      <Card withBorder p="sm" mb="md" style={{ background: '#F8FAFC' }}>
        <Group gap="lg" wrap="wrap">
          <Group gap={4}><IconCheck size={13} color="#166534" /><Text size="xs" c="#71717A">Precio coincide</Text></Group>
          <Group gap={4}><Badge size="xs" color="yellow" variant="light">&lt;5%</Badge><Text size="xs" c="#71717A">Dif &lt; 5%</Text></Group>
          <Group gap={4}><Badge size="xs" color="red" variant="light">X%</Badge><Text size="xs" c="#71717A">Dif significativa</Text></Group>
          <Group gap={4}><Badge size="xs" color="orange" variant="light">Addon Q0</Badge><Text size="xs" c="#71717A">El addon tiene Q0 (sin costo cargado)</Text></Group>
          <Group gap={4}><IconX size={13} color="#A32D2D" /><Text size="xs" c="#71717A">No existe en Odoo</Text></Group>
        </Group>
      </Card>

      {/* Estado vacío */}
      {!isLoading && total === 0 && (
        <Card withBorder p="xl" style={{ background: '#fff', textAlign: 'center' }}>
          <ThemeIcon size={56} radius="xl" style={{ background: '#F1F5F9', margin: '0 auto 16px' }}>
            <IconPackage size={28} color="#94A3B8" />
          </ThemeIcon>
          <Text fw={600} c="#18181B" mb={6}>
            {debouncedQ ? `Sin resultados para "${debouncedQ}"` : 'Catálogo vacío'}
          </Text>
          <Text size="sm" c="#71717A" style={{ maxWidth: 400, margin: '0 auto' }}>
            El catálogo se llena con cada carga de <strong>Inventario inicial</strong> o <strong>Actualización de inventario</strong>.
          </Text>
        </Card>
      )}

      {/* Error */}
      {isError && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" mb="md">
          No se pudo cargar el catálogo. Verifica que el backend esté activo.
        </Alert>
      )}

      {/* Tabla */}
      {(isLoading || rawItems.length > 0) && (
        <Card withBorder p={0} style={{ background: '#fff' }}>
          <Box p="md" style={{ borderBottom: '1px solid #E4E4E7' }}>
            <Group justify="space-between">
              <Text fw={600} size="sm" c="#18181B">
                {debouncedQ ? 'Resultados' : 'Todos los artículos'}
                {!isLoading && ` (${total}${items.length !== rawItems.length ? `, mostrando ${items.length} con filtros` : ''})`}
              </Text>
              {totalPages > 1 && (
                <Text size="xs" c="#71717A">Página {page} de {totalPages}</Text>
              )}
            </Group>
          </Box>

          <Table.ScrollContainer minWidth={860}>
            <Table striped highlightOnHover withColumnBorders fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <SortTh col="itemCode" label="Código SAP" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} style={{ width: 130 }} />
                  <SortTh col="itemName" label="Nombre / Descripción" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <Table.Th style={{ width: 60 }}>UM</Table.Th>
                  <SortTh col="localPrecio" label="Precio Addon" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
                    style={{ width: 115, textAlign: 'right', background: '#F0FDF4' }} />
                  <SortTh col="odooPrecio" label="Precio Odoo" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
                    style={{ width: 115, textAlign: 'right', background: '#EFF6FF' }} />
                  <SortTh col="odooStock" label="Stock Odoo" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
                    style={{ width: 100, textAlign: 'right', background: '#EFF6FF' }} />
                  <Table.Th style={{ width: 95, textAlign: 'center' }}>Dif. precio</Table.Th>
                  <Table.Th style={{ width: 85, textAlign: 'center' }}>En Odoo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoading
                  ? Array.from({ length: 15 }).map((_, i) => (
                      <Table.Tr key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <Table.Td key={j}><Skeleton height={14} radius="sm" /></Table.Td>
                        ))}
                      </Table.Tr>
                    ))
                  : items.map((item) => (
                      <Table.Tr key={item.itemCode}>
                        <Table.Td>
                          <Text size="xs" fw={600} style={{ fontFamily: 'monospace', color: '#1A365D' }}>
                            {item.itemCode}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="#18181B">{item.itemName}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="#71717A">{item.uomCode ?? '—'}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', background: '#F0FDF420' }}>
                          <PrecioCell valor={item.local.precio} label="addon" />
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', background: '#EFF6FF50' }}>
                          {item.odoo
                            ? <PrecioCell valor={item.odoo.standardPrice} label="odoo" />
                            : <Text size="xs" c="#A1A1AA">—</Text>}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', background: '#EFF6FF50' }}>
                          {item.odoo != null
                            ? <Text size="xs" fw={500} c={toNum(item.odoo.qtyAvailable) > 0 ? '#1A365D' : '#A1A1AA'}>
                                <NumberFormatter value={toNum(item.odoo.qtyAvailable)} decimalScale={2} fixedDecimalScale />
                              </Text>
                            : <Text size="xs" c="#A1A1AA">—</Text>}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <DifBadge localPrecio={item.local.precio} odooPrecio={item.odoo?.standardPrice ?? null} />
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          {item.odoo
                            ? <ThemeIcon size={18} radius="xl" color="green" variant="light">
                                <IconCheck size={11} />
                              </ThemeIcon>
                            : <Tooltip label="No encontrado en Odoo (default_code sin match)">
                                <ThemeIcon size={18} radius="xl" color="red" variant="light">
                                  <IconX size={11} />
                                </ThemeIcon>
                              </Tooltip>}
                        </Table.Td>
                      </Table.Tr>
                    ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          {items.length === 0 && !isLoading && rawItems.length > 0 && (
            <Box p="lg" style={{ textAlign: 'center' }}>
              <Text size="sm" c="#71717A">Ningún artículo de esta página coincide con los filtros activos.</Text>
            </Box>
          )}

          {totalPages > 1 && (
            <Box p="md" style={{ borderTop: '1px solid #E4E4E7', display: 'flex', justifyContent: 'center' }}>
              <Pagination total={totalPages} value={page} onChange={setPage} size="sm" color="blue" />
            </Box>
          )}
        </Card>
      )}
    </Box>
  );
}
