import { MapeosContent } from '@/features/integracion-sap/mapeos/MapeosContent';
import { Box, Text } from '@mantine/core';

export default function MapeosPage() {
  return (
    <>
      <Box mb="lg">
        <Text size="xl" fw={700} c="#18181B">Mapeos SAP → Odoo</Text>
        <Text size="sm" c="#71717A">Configura la correspondencia entre almacenes e items de SAP y sus equivalentes en Odoo</Text>
      </Box>
      <MapeosContent />
    </>
  );
}
