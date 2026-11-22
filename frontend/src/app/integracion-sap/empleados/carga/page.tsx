import { DocumentoPage } from '@/features/integracion-sap/documentos/DocumentoPage';
import { Box, Text } from '@mantine/core';

export default function CargaEmpleadosPage() {
  return (
    <>
      <Box mb="lg">
        <Text size="xl" fw={700} c="#18181B">Carga de empleados</Text>
        <Text size="sm" c="#71717A">Importar base de datos de empleados desde nóminas y sincronizar con Odoo RR.HH.</Text>
      </Box>
      <DocumentoPage
        tipo="CARGA_EMPLEADOS"
        titulo="Carga de empleados"
        descripcion="Importa el Excel exportado del sistema de nóminas. Los empleados se crean o actualizan en Odoo HR automáticamente por código de empleado y DPI."
        colorAccent="#1A365D"
        odooObjeto="hr.employee"
      />
    </>
  );
}
