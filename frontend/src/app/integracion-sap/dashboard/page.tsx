import { DashboardIntegracion } from '@/features/integracion-sap/dashboard/DashboardIntegracion';
import { Box, Text } from '@mantine/core';

export default function DashboardPage() {
  return (
    <>
      <Box mb="lg">
        <Text size="xl" fw={700} c="#18181B">Dashboard</Text>
        <Text size="sm" c="#71717A">Métricas de sincronización SAP → Odoo en tiempo real</Text>
      </Box>
      <DashboardIntegracion />
    </>
  );
}
