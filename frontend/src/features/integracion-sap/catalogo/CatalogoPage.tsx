'use client';
import {
  Box, Card, Text, Group, TextInput, Table, Badge,
  Skeleton, Alert, ThemeIcon, NumberFormatter,
} from '@mantine/core';
import { IconSearch, IconPackage, IconAlertTriangle, IconDatabase } from '@tabler/icons-react';
import { useState } from 'react';
import { useGetCatalogoQuery } from '@/store/api/integracionSapApi';
import { useDebouncedValue } from '@mantine/hooks';

export function CatalogoPage() {
  const [q, setQ] = useState('');
  const [debouncedQ] = useDebouncedValue(q, 300);

  const { data, isLoading, isError } = useGetCatalogoQuery(
    { q: debouncedQ, limit: 100 },
    { refetchOnMountOrArgChange: true },
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <Box>
      {/* Header */}
      <Card withBorder p="lg" mb="lg" style={{ background: '#fff', borderLeft: '4px solid #1A365D' }}>
        <Group align="flex-start" gap="md">
          <ThemeIcon size={44} radius="sm" style={{ background: '#1A365D15' }}>
            <IconDatabase size={22} color="#1A365D" />
          </ThemeIcon>
          <Box style={{ flex: 1 }}>
            <Group gap="sm" align="center">
              <Text fw={700} size="lg" c="#18181B">Catálogo de artículos</Text>
              {total > 0 && (
                <Badge variant="light" color="blue" size="sm">
                  <NumberFormatter value={total} thousandSeparator="," /> artículos
                </Badge>
              )}
            </Group>
            <Text size="sm" c="#71717A" mt={4}>
              Índice local de artículos SAP — se actualiza automáticamente con cada carga de Inventario inicial o Actualización.
            </Text>
          </Box>
        </Group>
      </Card>

      {/* Búsqueda */}
      <Card withBorder p="lg" mb="lg" style={{ background: '#fff' }}>
        <TextInput
          placeholder="Buscar por código o nombre…"
          leftSection={<IconSearch size={16} color="#71717A" />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          size="md"
          style={{ maxWidth: 480 }}
        />
        {debouncedQ && (
          <Text size="xs" c="#71717A" mt={6}>
            {isLoading ? 'Buscando…' : `${items.length} resultado${items.length !== 1 ? 's' : ''} para "${debouncedQ}"`}
          </Text>
        )}
      </Card>

      {/* Estado vacío */}
      {!isLoading && total === 0 && (
        <Card withBorder p="xl" style={{ background: '#fff', textAlign: 'center' }}>
          <ThemeIcon size={56} radius="xl" style={{ background: '#F1F5F9', margin: '0 auto 16px' }}>
            <IconPackage size={28} color="#94A3B8" />
          </ThemeIcon>
          <Text fw={600} c="#18181B" mb={6}>Catálogo vacío</Text>
          <Text size="sm" c="#71717A" style={{ maxWidth: 400, margin: '0 auto' }}>
            El catálogo se llena automáticamente cuando procesas un archivo de
            <strong> Inventario inicial</strong> o <strong>Actualización de inventario</strong>.
            Ve a esa sección, sube el Excel de SAP y el sistema indexará todos los artículos.
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
            <Text fw={600} size="sm" c="#18181B">
              {debouncedQ ? `Resultados` : `Todos los artículos`}
              {!isLoading && ` (${items.length}${!debouncedQ && total > 100 ? ` de ${total}` : ''})`}
            </Text>
          </Box>
          <Table.ScrollContainer minWidth={600}>
            <Table striped highlightOnHover withColumnBorders fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 140 }}>Código SAP</Table.Th>
                  <Table.Th>Nombre / Descripción</Table.Th>
                  <Table.Th style={{ width: 80 }}>UM</Table.Th>
                  <Table.Th style={{ width: 120, textAlign: 'right' }}>Precio unit.</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoading
                  ? Array.from({ length: 12 }).map((_, i) => (
                      <Table.Tr key={i}>
                        <Table.Td><Skeleton height={16} radius="sm" /></Table.Td>
                        <Table.Td><Skeleton height={16} radius="sm" /></Table.Td>
                        <Table.Td><Skeleton height={16} radius="sm" /></Table.Td>
                        <Table.Td><Skeleton height={16} radius="sm" /></Table.Td>
                      </Table.Tr>
                    ))
                  : items.map((item) => (
                      <Table.Tr key={item.itemCode}>
                        <Table.Td>
                          <Text size="sm" fw={600} style={{ fontFamily: 'monospace', color: '#1A365D' }}>
                            {item.itemCode}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="#18181B">{item.itemName}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="#71717A">{item.uomCode ?? '—'}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {item.precioUnitario != null ? (
                            <Text size="sm" fw={500} c="#166534">
                              Q <NumberFormatter
                                value={item.precioUnitario}
                                thousandSeparator=","
                                decimalSeparator="."
                                decimalScale={2}
                                fixedDecimalScale
                              />
                            </Text>
                          ) : (
                            <Text size="sm" c="#A1A1AA">—</Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {!isLoading && !debouncedQ && total > 100 && (
            <Box p="sm" style={{ borderTop: '1px solid #E4E4E7' }}>
              <Text size="xs" c="#71717A">
                Mostrando los primeros 100 de {total}. Usa el buscador para filtrar.
              </Text>
            </Box>
          )}
        </Card>
      )}
    </Box>
  );
}
