'use client';

import {
  Stack, Title, Group, TextInput, Select, Badge, Table, Text,
  Pagination, Tooltip, Alert, Progress, Skeleton, ActionIcon, Tabs,
  Card, SimpleGrid, ThemeIcon, ScrollArea, Popover,
} from '@mantine/core';
import {
  IconSearch, IconMapPin, IconAlertTriangle, IconCheck,
  IconBuilding, IconFilter, IconInfoCircle, IconUpload,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useGetCatalogoUbicacionesQuery, useGetResumenUbicacionesQuery } from '@/store/api/integracionSapApi';
import Link from 'next/link';

const COLOR_SCORE = (score: number) =>
  score >= 90 ? 'teal' : score >= 70 ? 'yellow' : 'red';

const LABEL_FACTURACION: Record<string, string> = {
  'CON COBRO': 'Con cobro',
  'SIN COBRO': 'Sin cobro',
  'COSTEADOS': 'Costeados',
  'NO COSTEADOS': 'No costeados',
};

export function CatalogoUbicacionesPage() {
  const [empresa] = useState('DEFAULT');
  const [q, setQ] = useState('');
  const [area, setArea] = useState<string | null>(null);
  const [industria, setIndustria] = useState<string | null>(null);
  const [depto, setDepto] = useState<string | null>(null);
  const [facturacion, setFacturacion] = useState<string | null>(null);
  const [soloProblemas, setSoloProblemas] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useGetCatalogoUbicacionesQuery({
    empresa,
    q: q || undefined,
    area: area || undefined,
    industria: industria || undefined,
    departamento: depto || undefined,
    facturacion: facturacion || undefined,
    soloConProblemas: soloProblemas || undefined,
    page,
    limit: 50,
  });

  const { data: resumen } = useGetResumenUbicacionesQuery({ empresa });

  const filtros = data?.filtros;

  const limpiarFiltros = () => {
    setQ(''); setArea(null); setIndustria(null);
    setDepto(null); setFacturacion(null); setSoloProblemas(false);
    setPage(1);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={3}>Catálogo de Ubicaciones</Title>
          <Text size="sm" c="dimmed">Puestos físicos — gobierno de datos activo</Text>
        </Stack>
        <Link href="/integracion-sap/ubicaciones/carga">
          <ActionIcon variant="light" size="lg" title="Cargar Excel">
            <IconUpload size={18} />
          </ActionIcon>
        </Link>
      </Group>

      {/* Resumen de calidad */}
      {resumen && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Card withBorder p="sm" radius="md">
            <Group gap="xs">
              <ThemeIcon color="blue" variant="light" size="md"><IconMapPin size={14} /></ThemeIcon>
              <Stack gap={0}>
                <Text size="xl" fw={700}>{resumen.total}</Text>
                <Text size="xs" c="dimmed">Puestos</Text>
              </Stack>
            </Group>
          </Card>
          <Card withBorder p="sm" radius="md">
            <Group gap="xs">
              <ThemeIcon color={COLOR_SCORE(resumen.scorePromedio)} variant="light" size="md">
                <IconCheck size={14} />
              </ThemeIcon>
              <Stack gap={0}>
                <Text size="xl" fw={700}>{resumen.scorePromedio}</Text>
                <Text size="xs" c="dimmed">Score promedio</Text>
              </Stack>
            </Group>
            <Progress value={resumen.scorePromedio} color={COLOR_SCORE(resumen.scorePromedio)} size="xs" mt={4} />
          </Card>
          <Card withBorder p="sm" radius="md">
            <Group gap="xs">
              <ThemeIcon color="teal" variant="light" size="md"><IconCheck size={14} /></ThemeIcon>
              <Stack gap={0}>
                <Text size="xl" fw={700}>{resumen.total - resumen.conProblemas}</Text>
                <Text size="xs" c="dimmed">Sin problemas</Text>
              </Stack>
            </Group>
          </Card>
          <Card withBorder p="sm" radius="md">
            <Group gap="xs">
              <ThemeIcon color="orange" variant="light" size="md"><IconAlertTriangle size={14} /></ThemeIcon>
              <Stack gap={0}>
                <Text size="xl" fw={700}>{resumen.conProblemas}</Text>
                <Text size="xs" c="dimmed">Con issues</Text>
              </Stack>
            </Group>
          </Card>
        </SimpleGrid>
      )}

      {resumen?.conProblemas > 0 && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="orange"
          title={`${resumen.conProblemas} registros con problemas de calidad`}
        >
          Activa el filtro "Solo con problemas" para revisarlos. Los issues aparecen en la columna de score.
        </Alert>
      )}

      {/* Filtros */}
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Buscar puesto, cliente, sucursal..."
          leftSection={<IconSearch size={14} />}
          value={q}
          onChange={(e) => { setQ(e.currentTarget.value); setPage(1); }}
          w={260}
        />
        <Select
          placeholder="Área / Distrito"
          data={filtros?.areas?.map((a: string) => ({ value: a, label: a })) ?? []}
          value={area}
          onChange={(v) => { setArea(v); setPage(1); }}
          clearable
          w={200}
        />
        <Select
          placeholder="Industria"
          data={filtros?.industrias?.map((i: string) => ({ value: i, label: i })) ?? []}
          value={industria}
          onChange={(v) => { setIndustria(v); setPage(1); }}
          clearable
          w={170}
        />
        <Select
          placeholder="Departamento"
          data={filtros?.departamentos?.map((d: string) => ({ value: d, label: d })) ?? []}
          value={depto}
          onChange={(v) => { setDepto(v); setPage(1); }}
          clearable
          w={190}
        />
        <Select
          placeholder="Facturación"
          data={filtros?.facturaciones?.map((f: string) => ({ value: f, label: LABEL_FACTURACION[f] ?? f })) ?? []}
          value={facturacion}
          onChange={(v) => { setFacturacion(v); setPage(1); }}
          clearable
          w={150}
        />
        <Badge
          variant={soloProblemas ? 'filled' : 'outline'}
          color="orange"
          style={{ cursor: 'pointer' }}
          onClick={() => { setSoloProblemas(p => !p); setPage(1); }}
          leftSection={<IconAlertTriangle size={10} />}
        >
          Solo con issues
        </Badge>
        {(q || area || industria || depto || facturacion || soloProblemas) && (
          <Badge
            variant="outline" color="gray" style={{ cursor: 'pointer' }}
            onClick={limpiarFiltros}
          >
            Limpiar filtros
          </Badge>
        )}
      </Group>

      {data && (
        <Text size="sm" c="dimmed">
          {data.total.toLocaleString()} puestos — página {page} de {Math.max(1, Math.ceil(data.total / 50))}
        </Text>
      )}

      {isLoading && <Skeleton height={400} />}

      {data && (
        <>
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs" miw={900}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={70}>Puesto</Table.Th>
                  <Table.Th>Cliente / Sucursal</Table.Th>
                  <Table.Th w={130}>Área</Table.Th>
                  <Table.Th w={130}>Industria</Table.Th>
                  <Table.Th>Depto / Municipio</Table.Th>
                  <Table.Th>Posiciones</Table.Th>
                  <Table.Th w={90}>Facturación</Table.Th>
                  <Table.Th w={70} ta="center">Calidad</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.items.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Text c="dimmed" ta="center" py="md">Sin resultados</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {data.items.map((u: any) => (
                  <Table.Tr key={u.id}>
                    <Table.Td>
                      <Text ff="monospace" fw={600}>{u.puesto}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="xs" fw={500}>{u.cliente ?? '—'}</Text>
                        {u.sucursal && u.sucursal !== u.cliente && (
                          <Text size="xs" c="dimmed">{u.sucursal}</Text>
                        )}
                        {u.direccion && (
                          <Text size="xs" c="dimmed" lineClamp={1}>{u.direccion}</Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      {u.area ? <Badge size="xs" variant="light" color="blue">{u.area}</Badge> : <Text c="dimmed">—</Text>}
                    </Table.Td>
                    <Table.Td>
                      {u.industria ? <Badge size="xs" variant="outline">{u.industria}</Badge> : <Text c="dimmed">—</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={1}>
                        <Text size="xs">{u.departamento ?? '—'}</Text>
                        {u.municipio && <Text size="xs" c="dimmed">{u.municipio}{u.zona ? ` Z${u.zona}` : ''}</Text>}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="wrap">
                        {u.posiciones?.length > 0
                          ? u.posiciones.slice(0, 3).map((p: string) => (
                              <Badge key={p} size="xs" variant="dot" color="gray">{p}</Badge>
                            ))
                          : <Text c="dimmed" size="xs">—</Text>}
                        {u.posiciones?.length > 3 && (
                          <Tooltip label={u.posiciones.slice(3).join(', ')} multiline maw={300}>
                            <Badge size="xs" variant="outline" color="gray">+{u.posiciones.length - 3}</Badge>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {u.facturacion
                        ? <Badge size="xs" color={u.facturacion === 'CON COBRO' ? 'teal' : u.facturacion === 'SIN COBRO' ? 'gray' : 'blue'}>
                            {LABEL_FACTURACION[u.facturacion] ?? u.facturacion}
                          </Badge>
                        : <Text c="dimmed">—</Text>}
                    </Table.Td>
                    <Table.Td ta="center">
                      {u.issues?.length > 0 ? (
                        <Popover withArrow>
                          <Popover.Target>
                            <Badge
                              size="sm"
                              color={COLOR_SCORE(u.calidadScore)}
                              variant="filled"
                              style={{ cursor: 'pointer' }}
                              leftSection={<IconAlertTriangle size={9} />}
                            >
                              {u.calidadScore}
                            </Badge>
                          </Popover.Target>
                          <Popover.Dropdown>
                            <Stack gap={4}>
                              <Text size="xs" fw={600}>Issues de calidad</Text>
                              {u.issues.map((issue: string, i: number) => (
                                <Text key={i} size="xs" c="orange">• {issue}</Text>
                              ))}
                            </Stack>
                          </Popover.Dropdown>
                        </Popover>
                      ) : (
                        <Badge size="sm" color="teal" variant="light">
                          {u.calidadScore}
                        </Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          <Pagination
            total={Math.ceil(data.total / 50)}
            value={page}
            onChange={setPage}
          />
        </>
      )}
    </Stack>
  );
}
