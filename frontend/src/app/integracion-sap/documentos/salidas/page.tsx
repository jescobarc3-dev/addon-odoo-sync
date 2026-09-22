import { DocumentoPage } from '@/features/integracion-sap/documentos/DocumentoPage';
import { Box, Text } from '@mantine/core';

export default function SalidasPage() {
  return (
    <>
      <Box mb="lg">
        <Text size="xl" fw={700} c="#18181B">Salidas de mercancía</Text>
        <Text size="sm" c="#71717A">Salidas de inventario SAP → picking validado en Odoo</Text>
      </Box>
      <DocumentoPage
        tipo="SALIDA_BODEGA"
        titulo="Salidas de mercancía"
        descripcion="Salidas de inventario desde SAP (OIGE/IGE1). Crea y valida picking de salida en Odoo. Integrado con costeo de flota (pt_compras_tier_dynamic)."
        colorAccent="#8B1A1A"
        odooObjeto="stock.picking (outgoing)"
      />
    </>
  );
}
