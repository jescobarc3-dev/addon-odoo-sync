'use client';
import { Box, Card, SimpleGrid, Text, Group, RingProgress, Center, Alert, Skeleton } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconPackage } from '@tabler/icons-react';
import { BarChart } from '@mantine/charts';
import { useGetDashboardQuery } from '@/store/api/integracionSapApi';

function MetricCard({
  label, value, sub, color, icon: Icon,
}: { label: string; value: string | number; sub?: string; color: string; icon: any }) {
  return (
    <Card withBorder p="lg" style={{ background: '#fff' }}>
      <Group justify="space-between" align="flex-start">
        <Box>
          <Text size="xs" fw={600} c="#71717A" tt="uppercase" style={{ letterSpacing: '0.06em' }}>{label}</Text>
          <Text size="28px" fw={700} c="#18181B" mt={4} lh={1}>{value}</Text>
          {sub && <Text size="xs" c="#71717A" mt={4}>{sub}</Text>}
        </Box>
        <Box style={{ background: `${color}22`, borderRadius: 8, padding: 10 }}>
          <Icon size={20} color={color} />
        </Box>
      </Group>
    </Card>
  );
}

const CHART_COLORS: Record<string, string> = {
  recibido: '#94A3B8',
  resuelto_sap: '#3B82F6',
  mapeado: '#3B82F6',
  creado_odoo: '#3B82F6',
  validado_odoo: '#166534',
  error_mapeo: '#92400E',
  error_stock_insuficiente: '#92400E',
  error_sap: '#8B1A1A',
  error_odoo: '#8B1A1A',
};

export function DashboardIntegracion() {
  const { data, isLoading } = useGetDashboardQuery(undefined, { pollingInterval: 10000 });

  if (isLoading) return <Skeleton height={400} radius="sm" />;
  if (!data) return null;

  const chartData = Object.entries(data.porEstado).map(([estado, count]) => ({
    estado: estado.replace(/_/g, ' '),
    count,
    color: CHART_COLORS[estado] ?? '#94A3B8',
  }));

  return (
    <>
      {data.backlog > 10 && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="ptAmber"
          mb="lg"
          radius="sm"
          style={{ borderLeft: '3px solid #92400E' }}
        >
          <Text size="sm" fw={500}>Backlog alto — {data.backlog} registros pendientes de procesar.</Text>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="lg" spacing="md">
        <MetricCard label="Tasa automática" value={`${data.porcentajeAutomatico}%`} sub="Sin intervención manual" color="#166534" icon={IconCheck} />
        <MetricCard label="Total registros" value={data.total} color="#3B82F6" icon={IconPackage} />
        <MetricCard label="Validados" value={data.exitosos} color="#166534" icon={IconCheck} />
        <MetricCard label="Con errores" value={data.errores} sub="Requieren revisión" color="#8B1A1A" icon={IconAlertTriangle} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Card withBorder p="xl" style={{ background: '#fff' }}>
          <Text fw={600} mb="xl" c="#18181B">Cobertura automática</Text>
          <Center>
            <RingProgress
              size={180}
              thickness={18}
              roundCaps
              sections={[
                { value: data.porcentajeAutomatico || 0, color: '#166534' },
                { value: 100 - (data.porcentajeAutomatico || 0), color: '#F4F4F5' },
              ]}
              label={
                <Center>
                  <Box ta="center">
                    <Text fw={800} size="32px" c="#18181B">{data.porcentajeAutomatico}%</Text>
                    <Text size="xs" c="#71717A">automático</Text>
                  </Box>
                </Center>
              }
            />
          </Center>
        </Card>

        <Card withBorder p="xl" style={{ background: '#fff' }}>
          <Text fw={600} mb="md" c="#18181B">Registros por estado</Text>
          <BarChart
            h={160}
            data={chartData}
            dataKey="estado"
            series={[{ name: 'count', color: 'ptRed.8', label: 'Registros' }]}
            tickLine="x"
            gridAxis="x"
            withTooltip
            withXAxis
            withYAxis
          />
        </Card>
      </SimpleGrid>
    </>
  );
}
