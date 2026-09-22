import { DocumentoPage } from '@/features/integracion-sap/documentos/DocumentoPage';
import { Box, Text } from '@mantine/core';

export default function ActualizacionPage() {
  return (
    <>
      <Box mb="lg">
        <Text size="xl" fw={700} c="#18181B">Actualización de inventario</Text>
        <Text size="sm" c="#71717A">Ajuste de cantidades y creación de nuevos códigos SAP en Odoo</Text>
      </Box>
      <DocumentoPage
        tipo="ACTUALIZACION_INVENTARIO"
        titulo="Actualización de inventario"
        descripcion="Ajuste de cantidades y creación de nuevos códigos SAP en Odoo cuando no existen. Genera ajuste de inventario validado."
        colorAccent="#8B5CF6"
        odooObjeto="stock.inventory"
      />
    </>
  );
}
