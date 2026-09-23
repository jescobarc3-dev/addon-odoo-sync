'use client';
import {
  Card, SimpleGrid, Text, Group, Box, RingProgress, Center,
  Stack, Skeleton, Badge, ThemeIcon, Progress,
} from '@mantine/core';
import {
  IconCheck, IconAlertTriangle, IconPackage, IconArrowRight,
  IconTrendingUp, IconX,
} from '@tabler/icons-react';
import { useGetDashboardQuery } from '@/store/api/integracionSapApi';

const TIPO_LABEL: Record<string, string> = {
  SALIDA_BODEGA: 'Salidas de mercancía',
  ENTRADA_MERCANCIA: 'Entradas de mercancía',
  INVENTARIO_INICIAL: 'Inventario inicial',
  ACTUALIZACION_INVENTARIO: 'Actualización de inventario',
};

const TIPO_COLOR: Record<string, string> = {
  SALIDA_BODEGA: '#854F0B',
  ENTRADA_MERCANCIA: '#1A365D',
  INVENTARIO_INICIAL: '#0F6E56',
  ACTUALIZACION_INVENTARIO: '#4B5563',
};

const TIPO_HREF: Record<string, string> = {
  SALIDA_BODEGA: '/integracion-sap/documentos/salidas',
  ENTRADA_MERCANCIA: '/integracion-sap/documentos/entradas',
  INVENTARIO_INICIAL: '/integracion-sap/documentos/inventario-inicial',
  ACTUALIZACION_INVENTARIO: '/integracion-sap/documentos/actualizacion',
};

export function DashboardIntegracion() {
  const { data, isLoading } = useGetDashboardQuery(undefined, { pollingInterval: 15000 });

  if (isLoading) return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {[1, 2, 3].map(i => <Skeleton key={i} height={110} radius="sm" />)}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Skeleton height={240} radius="sm" />
        <Skeleton height={240} radius="sm" />
      </SimpleGrid>
    </Stack>
  );

  if (!data) return null;

  const tipos = ['SALIDA_BODEGA', 'ENTRADA_MERCANCIA', 'INVENTARIO_INICIAL', 'ACTUALIZACION_INVENTARIO'];

  return (
    <Stack gap="md">
      {/* KPIs principales */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Card withBorder p="lg" style={{ background: '#fff' }}>
          <Group justify="space-between" align="flex-start">
            <Box>
              <Text size="xs" fw={600} c="#71717A" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
                Total cargas
              </Text>
              <Text size="32px" fw={800} c="#18181B" mt={4} lh={1}>{data.total}</Text>
              <Text size="xs" c="#71717A" mt={4}>todos los tipos</Text>
            </Box>
            <Box style={{ background: '#EFF6FF', borderRadius: 8, padding: 10 }}>
              <IconPackage size={20} color="#1A365D" />
            </Box>
          </Group>
        </Card>

        <Card withBorder p="lg" style={{ background: '#fff' }}>
          <Group justify="space-between" align="flex-start">
            <Box>
              <Text size="xs" fw={600} c="#71717A" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
                Completadas
              </Text>
              <Text size="32px" fw={800} c="#0F6E56" mt={4} lh={1}>{data.exitosos}</Text>
              <Text size="xs" c="#71717A" mt={4}>tasa de éxito {data.porcentajeExito}%</Text>
            </Box>
            <Box style={{ background: '#F0FDF4', borderRadius: 8, padding: 10 }}>
              <IconCheck size={20} color="#0F6E56" />
            </Box>
          </Group>
        </Card>

        <Card withBorder p="lg" style={{ background: '#fff' }}>
          <Group justify="space-between" align="flex-start">
            <Box>
              <Text size="xs" fw={600} c="#71717A" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
                Con error
              </Text>
              <Text size="32px" fw={800} c={data.errores > 0 ? '#A32D2D' : '#A1A1AA'} mt={4} lh={1}>
                {data.errores}
              </Text>
              <Text size="xs" c="#71717A" mt={4}>{data.errores > 0 ? 'revisar en Cola' : 'sin errores'}</Text>
            </Box>
            <Box style={{ background: data.errores > 0 ? '#FEF2F2' : '#F8F8F8', borderRadius: 8, padding: 10 }}>
              {data.errores > 0
                ? <IconAlertTriangle size={20} color="#A32D2D" />
                : <IconCheck size={20} color="#A1A1AA" />
              }
            </Box>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Tasa de éxito + desglose por tipo */}
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Card withBorder p="xl" style={{ background: '#fff' }}>
          <Text fw={600} mb="xl" c="#18181B">Tasa de éxito global</Text>
          <Center>
            <RingProgress
              size={180}
              thickness={18}
              roundCaps
              sections={[
                { value: data.porcentajeExito, color: '#0F6E56' },
                { value: 100 - data.porcentajeExito, color: '#F4F4F5' },
              ]}
              label={
                <Center>
                  <Box ta="center">
                    <Text fw={800} size="32px" c="#18181B">{data.porcentajeExito}%</Text>
                    <Text size="xs" c="#71717A">completado</Text>
                  </Box>
                </Center>
              }
            />
          </Center>
          <Group justify="center" gap="xl" mt="lg">
            <Group gap={6}>
              <Box style={{ width: 10, height: 10, borderRadius: '50%', background: '#0F6E56' }} />
              <Text size="xs" c="#52525B">Completadas ({data.exitosos})</Text>
            </Group>
            <Group gap={6}>
              <Box style={{ width: 10, height: 10, borderRadius: '50%', background: '#F4F4F5', border: '1px solid #E4E4E7' }} />
              <Text size="xs" c="#52525B">Errores / pendientes ({data.errores})</Text>
            </Group>
          </Group>
        </Card>

        <Card withBorder p="xl" style={{ background: '#fff' }}>
          <Text fw={600} mb="lg" c="#18181B">Cargas por tipo de documento</Text>
          <Stack gap="md">
            {tipos.map((tipo) => {
              const stat = data.porTipo[tipo] ?? { total: 0, exitosos: 0, errores: 0 };
              const pct = stat.total > 0 ? Math.round((stat.exitosos / stat.total) * 100) : 0;
              const color = TIPO_COLOR[tipo];
              return (
                <Box key={tipo}>
                  <Group justify="space-between" mb={4}>
                    <Group gap={6}>
                      <Box style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                      <Text size="xs" fw={600} c="#374151">{TIPO_LABEL[tipo]}</Text>
                    </Group>
                    <Group gap="xs">
                      <Badge size="xs" color="gray" variant="light">{stat.total} total</Badge>
                      {stat.errores > 0 && (
                        <Badge size="xs" color="red" variant="light">{stat.errores} error</Badge>
                      )}
                    </Group>
                  </Group>
                  <Progress
                    value={pct}
                    size="sm"
                    radius="xl"
                    color={stat.errores > 0 ? 'orange' : 'teal'}
                  />
                </Box>
              );
            })}
            {data.total === 0 && (
              <Text size="sm" c="#A1A1AA" ta="center" py="lg">
                Sin cargas registradas aún.
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
