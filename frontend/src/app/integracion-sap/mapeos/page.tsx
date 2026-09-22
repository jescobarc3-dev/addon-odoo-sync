import { TablaMapeoItems } from '@/features/integracion-sap/mapeos/TablaMapeoItems';
import { Box, Text } from '@mantine/core';

export default function MapeosPage() {
  return (
    <>
      <Box mb="lg">
        <Text size="xl" fw={700} c="#18181B">Mapeos SAP → Odoo</Text>
        <Text size="sm" c="#71717A">Excepciones de ItemCode cuando el default_code no coincide</Text>
      </Box>
      <TablaMapeoItems />
    </>
  );
}
