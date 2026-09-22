import { DocumentoPage } from '@/features/integracion-sap/documentos/DocumentoPage';
import { Box, Text } from '@mantine/core';

export default function EntradasPage() {
  return (
    <>
      <Box mb="lg">
        <Text size="xl" fw={700} c="#18181B">Entradas de mercancía</Text>
        <Text size="sm" c="#71717A">Recepción de mercancía desde SAP hacia Odoo</Text>
      </Box>
      <DocumentoPage
        tipo="ENTRADA_MERCANCIA"
        titulo="Entradas de mercancía"
        descripcion="Recepción de mercancía desde SAP (OPDN/PDN1). Crea picking tipo recepción validado en Odoo, actualiza stock disponible."
        colorAccent="#166534"
        odooObjeto="stock.picking (incoming)"
      />
    </>
  );
}
