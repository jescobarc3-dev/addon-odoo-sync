import { DocumentoPage } from '@/features/integracion-sap/documentos/DocumentoPage';
import { Box, Text } from '@mantine/core';

export default function InventarioInicialPage() {
  return (
    <>
      <Box mb="lg">
        <Text size="xl" fw={700} c="#18181B">Inventario inicial</Text>
        <Text size="sm" c="#71717A">Carga de stock inicial desde SAP Business One</Text>
      </Box>
      <DocumentoPage
        tipo="INVENTARIO_INICIAL"
        titulo="Inventario inicial"
        descripcion="Carga de stock inicial desde SAP. Crea o actualiza cantidades en Odoo. Si el código SAP no existe en Odoo, se crea el producto automáticamente."
        colorAccent="#3B82F6"
        odooObjeto="stock.quant"
      />
    </>
  );
}
