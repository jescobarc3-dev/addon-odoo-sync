import { ColaSincronizacion } from '@/features/integracion-sap/cola/ColaSincronizacion';
import { Box, Text } from '@mantine/core';

export default function ColaPage() {
  return (
    <>
      <Box mb="lg">
        <Text size="xl" fw={700} c="#18181B">Cola de revisión</Text>
        <Text size="sm" c="#71717A">Registros que requieren intervención manual</Text>
      </Box>
      <ColaSincronizacion />
    </>
  );
}
