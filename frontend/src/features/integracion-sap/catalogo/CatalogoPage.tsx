'use client';
import {
  Box, Card, Text, Group, TextInput, Table, Badge,
  Skeleton, Alert, ThemeIcon, NumberFormatter, Pagination,
  Tooltip, ActionIcon,
} from '@mantine/core';
import {
  IconSearch, IconPackage, IconAlertTriangle, IconDatabase,
  IconRefresh, IconCheck, IconX, IconMinus,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useGetComparacionCatalogoQuery } from '@/store/api/integracionSapApi';
import { useDebouncedValue } from '@mantine/hooks';

function PrecioCell({ valor, label }: { valor: number | null | undefined; label?: string }) {
  if (valor == null) return <Text size="xs" c="#A1A1AA">—</Text>;
  return (
    <Text size="xs" fw={500} c={label === 'odoo' ? '#1A365D' : '#166534'}>
      Q <NumberFormatter value={valor} thousandSeparator="," decimalSeparator="." decimalScale={2} fixedDecimalScale />
    </Text>
  );
}

function DifBadge({ localPrecio, odooPrecio }: { localPrecio: number | null; odooPrecio: number | null }) {
  if (localPrecio == null || odooPrecio == null) return null;
  const dif = Math.abs((odooPrecio - localPrecio) / (localPrecio || 1));
  if (dif < 0.001) return <Badge size="xs" color="green" variant="light">Igual</Badge>;
  if (dif < 0.05) return <Badge size="xs" color="yellow" variant="light">&lt;5%</Badge>;
  return <Badge size="xs" color="red" variant="light">{(dif * 100).toFixed(0)}% dif</Badge>;
}

export function CatalogoPage() {
  const [q, setQ] = useState('');
  const [debouncedQ] = useDebouncedValue(q, 350);
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const { data, isLoading, isError, isFetching, refetch } = useGetComparacionCatalogoQuery(
    { q: debouncedQ, page, limit: LIMIT },
    { refetchOnMountOrArgChange: true },
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const handleSearch = (v: string) => { setQ(v); setPage(1); };

  return (
    <Box>
      {/* Header */}
      <Card withBorder p="lg" mb="lg" style={{ background: '#fff', borderLeft: '4px solid #1A365D' }}>
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

      {/* Leyenda */}
      <Card withBorder p="sm" mb="md" style={{ background: '#F8FAFC' }}>
        <Group gap="lg">
          <Group gap={4}>
            <IconCheck size={14} color="#166534" />
            <Text size="xs" c="#71717A">Precio coincide</Text>
          </Group>
          <Group gap={4}>
            <Badge size="xs" color="yellow" variant="light">&lt;5%</Badge>
            <Text size="xs" c="#71717A">Diferencia menor al 5%</Text>
          </Group>
          <Group gap={4}>
            <Badge size="xs" color="red" variant="light">X%</Badge>
            <Text size="xs" c="#71717A">Diferencia significativa</Text>
          </Group>
          <Group gap={4}>
            <IconX size={14} color="#A32D2D" />
            <Text size="xs" c="#71717A">No existe en Odoo</Text>
          </Group>
          <Group gap={4}>
            <IconMinus size={14} color="#A1A1AA" />
            <Text size="xs" c="#71717A">Sin precio registrado</Text>
          </Group>
        </Group>
      </Card>

      {/* Búsqueda */}
      <Card withBorder p="md" mb="md" style={{ background: '#fff' }}>
        <TextInput
          placeholder="Buscar por código o nombre…"
          leftSection={<IconSearch size={16} color="#71717A" />}
          value={q}
          onChange={(e) => handleSearch(e.currentTarget.value)}
          size="sm"
          style={{ maxWidth: 420 }}
        />
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
      {(isLoading || items.length > 0) && (
        <Card withBorder p={0} style={{ background: '#fff' }}>
          <Box p="md" style={{ borderBottom: '1px solid #E4E4E7' }}>
            <Group justify="space-between">
              <Text fw={600} size="sm" c="#18181B">
                {debouncedQ ? 'Resultados' : 'Todos los artículos'}
                {!isLoading && ` (${total})`}
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
                  <Table.Th style={{ width: 130 }}>Código SAP</Table.Th>
                  <Table.Th>Nombre / Descripción</Table.Th>
                  <Table.Th style={{ width: 60 }}>UM</Table.Th>
                  {/* Addon */}
                  <Table.Th style={{ width: 110, textAlign: 'right', background: '#F0FDF4' }}>
                    <Text size="xs" c="#166534" fw={600}>Precio Addon</Text>
                  </Table.Th>
                  {/* Odoo */}
                  <Table.Th style={{ width: 110, textAlign: 'right', background: '#EFF6FF' }}>
                    <Text size="xs" c="#1A365D" fw={600}>Precio Odoo</Text>
                  </Table.Th>
                  <Table.Th style={{ width: 100, textAlign: 'right', background: '#EFF6FF' }}>
                    <Text size="xs" c="#1A365D" fw={600}>Stock Odoo</Text>
                  </Table.Th>
                  <Table.Th style={{ width: 90, textAlign: 'center' }}>Dif. precio</Table.Th>
                  <Table.Th style={{ width: 90, textAlign: 'center' }}>En Odoo</Table.Th>
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
                        {/* Precio Addon */}
                        <Table.Td style={{ textAlign: 'right', background: '#F0FDF420' }}>
                          <PrecioCell valor={item.local.precio} label="addon" />
                        </Table.Td>
                        {/* Precio Odoo */}
                        <Table.Td style={{ textAlign: 'right', background: '#EFF6FF50' }}>
                          {item.odoo
                            ? <PrecioCell valor={item.odoo.standardPrice} label="odoo" />
                            : <Text size="xs" c="#A1A1AA">—</Text>}
                        </Table.Td>
                        {/* Stock Odoo */}
                        <Table.Td style={{ textAlign: 'right', background: '#EFF6FF50' }}>
                          {item.odoo != null
                            ? <Text size="xs" fw={500} c={item.odoo.qtyAvailable > 0 ? '#1A365D' : '#A1A1AA'}>
                                <NumberFormatter value={item.odoo.qtyAvailable} decimalScale={2} fixedDecimalScale />
                              </Text>
                            : <Text size="xs" c="#A1A1AA">—</Text>}
                        </Table.Td>
                        {/* Diferencia de precio */}
                        <Table.Td style={{ textAlign: 'center' }}>
                          <DifBadge localPrecio={item.local.precio} odooPrecio={item.odoo?.standardPrice ?? null} />
                        </Table.Td>
                        {/* En Odoo */}
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
