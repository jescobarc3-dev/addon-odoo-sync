'use client';
import '@mantine/dropzone/styles.css';
import {
  Box, Text, Card, Badge, Group, ThemeIcon, Stack, Alert,
  Button, Table, ScrollArea, Select, SimpleGrid, Progress,
  Stepper, Loader, Anchor, TextInput, Pagination,
} from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import {
  IconDatabase, IconArrowRight, IconCheck, IconUpload, IconFile,
  IconX, IconAlertTriangle, IconCircleCheck, IconAdjustments, IconBuildingWarehouse,
  IconHistory, IconPackage,
} from '@tabler/icons-react';

import { useState, useEffect } from 'react';
import {
  useSubirDocumentoMutation,
  useProcesarDocumentoMutation,
  useGetUbicacionesOdooQuery,
  useCambiarHojaMutation,
  useGetJobQuery,
  useGetHistorialQuery,
  useGetMapeosBodegasQuery,
} from '@/store/api/integracionSapApi';
import { useGetMeQuery } from '@/store/api/portalApi';
import { IconLock } from '@tabler/icons-react';

interface Props {
  tipo: string;
  titulo: string;
  descripcion: string;
  colorAccent: string;
  odooObjeto: string;
}

interface FilaPreview {
  itemCode: string;
  itemName: string;
  whsCode: string;
  onHand: number;
  uomCode: string;
  precioUnitario: number | null;
  precioTotal: number | null;
  filaOriginal: number;
  advertencias: string[];
}

interface EstadoUpload {
  uploadId: string;
  totalFilas: number;
  advertencias: string[];
  filas: FilaPreview[];
  columnasDetectadas: Record<string, string>;
  headersDisponibles: string[];
  hojas: string[];
  hojaActual: string;
  docNumSap?: string;
}

interface ResultadoProcesamiento {
  procesados: number;
  ajustados: number;
  sinCambio: number;
  errores: number;
  detalleErrores: string[];
  sinMapeo: string[];
  sinBodega: string[];
  conOnHandCero: string[];
  // picking
  pickingId?: number;
  pickingEstado?: 'ok' | 'ok_sin_stock' | 'ya_existe';
  movesNoAsignados?: string[];
}

const ES_PICKING = (tipo: string) => tipo === 'SALIDA_BODEGA' || tipo === 'ENTRADA_MERCANCIA';

const CAMPOS_INVENTARIO = [
  { key: 'itemCode', label: 'Código de artículo', requerido: true },
  { key: 'itemName', label: 'Descripción / Nombre', requerido: false },
  { key: 'whsCode', label: 'Almacén / Bodega', requerido: true },
  { key: 'onHand', label: 'Cantidad en existencia', requerido: true },
  { key: 'precioUnitario', label: 'Precio / Costo unitario', requerido: false },
  { key: 'precioTotal', label: 'Precio total (opcional)', requerido: false },
  { key: 'uomCode', label: 'Unidad de medida', requerido: false },
];

const CAMPOS_PICKING = [
  { key: 'itemCode', label: 'Código de artículo', requerido: true },
  { key: 'itemName', label: 'Descripción / Nombre', requerido: false },
  { key: 'whsCode', label: 'Almacén (WhsCode SAP)', requerido: true },
  { key: 'onHand', label: 'Cantidad a transferir', requerido: true },
  { key: 'uomCode', label: 'Unidad de medida', requerido: false },
];

const PASOS_DOC: Record<string, Array<{ label: string; sub: string }>> = {
  SALIDA_BODEGA: [
    { label: 'Subir archivo', sub: 'Excel / CSV / PDF' },
    { label: 'Confirmar mapeo', sub: 'columnas → campos' },
    { label: 'Validar', sub: 'catálogos locales' },
    { label: 'Crear picking', sub: 'stock.picking' },
    { label: 'Validado', sub: 'state = done' },
  ],
  ENTRADA_MERCANCIA: [
    { label: 'Subir archivo', sub: 'Excel / CSV / PDF' },
    { label: 'Confirmar mapeo', sub: 'columnas → campos' },
    { label: 'Validar', sub: 'catálogos locales' },
    { label: 'Crear recepción', sub: 'stock.picking' },
    { label: 'Validado', sub: 'state = done' },
  ],
  INVENTARIO_INICIAL: [
    { label: 'Subir archivo', sub: 'Excel / CSV / PDF' },
    { label: 'Confirmar mapeo', sub: 'columnas → campos' },
    { label: 'Upsert producto', sub: 'product.template' },
    { label: 'Ajustar stock', sub: 'stock.quant' },
    { label: 'Aplicado', sub: 'inventario actualizado' },
  ],
  ACTUALIZACION_INVENTARIO: [
    { label: 'Subir archivo', sub: 'Excel / CSV / PDF' },
    { label: 'Confirmar mapeo', sub: 'columnas → campos' },
    { label: 'Delta vs Odoo', sub: 'comparación' },
    { label: 'Ajustar stock', sub: 'stock.quant' },
    { label: 'Aplicado', sub: 'inventario actualizado' },
  ],
};

const ACCEPT_TYPES = [
  MIME_TYPES.xlsx, MIME_TYPES.xls, MIME_TYPES.csv, MIME_TYPES.pdf,
  'text/csv', 'application/vnd.ms-excel',
];

const SIN_COLUMNA = '— sin asignar —';

export function DocumentoPage({ tipo, titulo, descripcion, colorAccent, odooObjeto }: Props) {
  const esPicking = ES_PICKING(tipo);
  const mostrarPrecio = !esPicking || tipo === 'ENTRADA_MERCANCIA';
  const CAMPOS_REQUERIDOS = esPicking ? CAMPOS_PICKING : CAMPOS_INVENTARIO;

  const { data: me } = useGetMeQuery();
  const puedeCargar = me?.permisos?.includes('integracion-sap:cargar') || me?.permisos?.includes('admin');

  const [uploadState, setUploadState] = useState<EstadoUpload | null>(null);
  const [mapeoActual, setMapeoActual] = useState<Record<string, string>>({});
  const [referenciaSap, setReferenciaSap] = useState<string>('');
  const [ubicacionOverrideId, setUbicacionOverrideId] = useState<number | null>(null);
  const [whsCodeOverride, setWhsCodeOverride] = useState<string>('');
  const [isPdf, setIsPdf] = useState(false);
  const [cargarUbicaciones, setCargarUbicaciones] = useState(false);
  const [resultado, setResultado] = useState<ResultadoProcesamiento | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pasoActivo, setPasoActivo] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobTotal, setJobTotal] = useState(0);
  const [paginaHistorial, setPaginaHistorial] = useState(1);

  const [subirDocumento, { isLoading: subiendo }] = useSubirDocumentoMutation();
  const [procesarDocumento, { isLoading: iniciando }] = useProcesarDocumentoMutation();
  const [cambiarHoja, { isLoading: cambiandoHoja }] = useCambiarHojaMutation();

  const { data: historial, refetch: refetchHistorial } = useGetHistorialQuery(tipo);

  const { data: job } = useGetJobQuery(
    { tipo, jobId: jobId! },
    { skip: !jobId, pollingInterval: 2000 },
  );

  useEffect(() => {
    if (!job) return;
    if (job.estado === 'completado' && job.resultado) {
      setResultado(job.resultado as ResultadoProcesamiento);
      setPasoActivo(3);
      setJobId(null);
      setUploadState(null);
      refetchHistorial();
    } else if (job.estado === 'error') {
      // Si hay resultado (ej: ok_sin_stock con pickingId), mostrarlo
      if (job.resultado) {
        setResultado(job.resultado as ResultadoProcesamiento);
        setPasoActivo(3);
        setUploadState(null);
        refetchHistorial();
      } else {
        setErrorMsg(job.errorMsg ?? 'Error procesando en el servidor.');
        setUploadState(null);
        setPasoActivo(0);
        refetchHistorial();
      }
      setJobId(null);
    }
  }, [job]);

  const { data: ubicaciones, isFetching: cargandoUbicaciones } = useGetUbicacionesOdooQuery(
    undefined,
    { skip: !cargarUbicaciones || esPicking },
  );

  const tipoOperacionBodega = tipo === 'SALIDA_BODEGA' ? 'SALIDA' : 'ENTRADA';
  const { data: mapeosBodegas = [] } = useGetMapeosBodegasQuery(undefined, { skip: !esPicking });
  const bodegasDelTipo = mapeosBodegas.filter(b => b.activo && b.tipoOperacion === tipoOperacionBodega);
  const opcionesBodega = bodegasDelTipo.map(b => ({ value: b.whsCodeSap, label: b.whsCodeSap }));

  const LS_KEY = `pref_bodega_${tipo}`;

  const leerPreferencia = (opciones: typeof opcionesBodega): string => {
    const guardado = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    if (guardado && opciones.some(o => o.value === guardado)) return guardado;
    if (opciones.length === 1) return opciones[0].value;
    return '';
  };

  const guardarPreferencia = (val: string) => {
    if (typeof window !== 'undefined' && val) localStorage.setItem(LS_KEY, val);
  };

  const pasos = PASOS_DOC[tipo] ?? PASOS_DOC['INVENTARIO_INICIAL'];

  async function onDrop(files: File[]) {
    setErrorMsg(null);
    setResultado(null);
    setUploadState(null);
    setPasoActivo(0);
    const filePdf = files[0].type === 'application/pdf' || files[0].name.toLowerCase().endsWith('.pdf');
    setIsPdf(filePdf);
    try {
      const res = await subirDocumento({ tipo, file: files[0] }).unwrap();
      const resTyped = res as EstadoUpload;
      setUploadState(resTyped);
      setMapeoActual({ ...res.columnasDetectadas });
      if (resTyped.docNumSap) setReferenciaSap(resTyped.docNumSap);
      if (filePdf && esPicking) {
        const opciones = mapeosBodegas
          .filter(b => b.activo && b.tipoOperacion === tipoOperacionBodega)
          .map(b => ({ value: b.whsCodeSap, label: b.whsCodeSap }));
        setWhsCodeOverride(leerPreferencia(opciones));
      }
      setPasoActivo(1);
    } catch (e: any) {
      const msg = e?.data?.message ?? 'Error al procesar el archivo.';
      setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  async function confirmar() {
    if (!uploadState || jobId) return;
    setErrorMsg(null);
    if (esPicking && isPdf && whsCodeOverride) guardarPreferencia(whsCodeOverride);
    try {
      const res = await procesarDocumento({
        tipo,
        uploadId: uploadState.uploadId,
        mapeoColumnas: mapeoActual,
        ubicacionOverrideId: ubicacionOverrideId ?? undefined,
        referenciaSap: esPicking && referenciaSap.trim() ? referenciaSap.trim() : undefined,
        whsCodeOverride: esPicking && isPdf && whsCodeOverride.trim() ? whsCodeOverride.trim() : undefined,
      }).unwrap();
      setJobId(res.jobId);
      setJobTotal(res.total);
      setPasoActivo(2);
    } catch (e: any) {
      const msg = e?.data?.message ?? 'Error al enviar a Odoo.';
      setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  async function onCambiarHoja(hoja: string) {
    if (!uploadState || hoja === uploadState.hojaActual) return;
    try {
      const res = await cambiarHoja({ tipo, uploadId: uploadState.uploadId, hoja }).unwrap();
      setUploadState(res as EstadoUpload);
      setMapeoActual({ ...res.columnasDetectadas });
    } catch (e: any) {
      const msg = e?.data?.message ?? 'Error al cambiar la hoja.';
      setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  function reiniciar() {
    setUploadState(null);
    setResultado(null);
    setErrorMsg(null);
    setMapeoActual({});
    setReferenciaSap('');
    setUbicacionOverrideId(null);
    setWhsCodeOverride('');
    setCargarUbicaciones(false);
    setIsPdf(false);
    setPasoActivo(0);
    setJobId(null);
    setJobTotal(0);
  }

  const whsMapeado = !!mapeoActual['whsCode'];
  const mapeoIncompleto = isPdf
    ? []
    : CAMPOS_REQUERIDOS
        .filter(c => {
          if (c.key === 'whsCode') return !whsMapeado && (esPicking ? true : !ubicacionOverrideId);
          return c.requerido && !mapeoActual[c.key];
        })
        .map(c => c.label);

  const opciones = uploadState
    ? [SIN_COLUMNA, ...(uploadState.headersDisponibles ?? [])]
    : [];

  const filasPreview = uploadState?.filas ?? [];
  const filasConAdv = filasPreview.filter(f => f.advertencias.length > 0).length;
  const pct = filasPreview.length > 0
    ? Math.round(((filasPreview.length - filasConAdv) / filasPreview.length) * 100)
    : 0;

  const labelCantidad = esPicking ? 'Cantidad' : 'Cantidad / Existencia';
  const labelBoton = esPicking
    ? `Crear picking en Odoo (${uploadState?.totalFilas ?? 0} líneas)`
    : `Confirmar mapeo y enviar a Odoo (${uploadState?.totalFilas ?? 0} filas)`;

  return (
    <Stack gap="lg">
      {/* Header */}
      <Card withBorder p="lg" style={{ background: '#fff', borderLeft: `4px solid ${colorAccent}` }}>
        <Group align="flex-start" gap="md">
          <ThemeIcon size={44} radius="sm" style={{ background: `${colorAccent}15` }}>
            <IconDatabase size={22} color={colorAccent} />
          </ThemeIcon>
          <Box style={{ flex: 1 }}>
            <Text fw={700} size="lg" c="#18181B">{titulo}</Text>
            <Text size="sm" c="#71717A" mt={4}>{descripcion}</Text>
            <Group gap={6} mt={10}>
              <Badge variant="outline" size="xs" color="gray">Excel / CSV / PDF</Badge>
              <IconArrowRight size={12} color="#A1A1AA" />
              <Badge variant="outline" size="xs" color="blue">{odooObjeto}</Badge>
            </Group>
          </Box>
        </Group>
      </Card>

      {/* Stepper — flujo de procesamiento */}
      <Card withBorder p="md" style={{ background: '#fff' }}>
        <Stepper active={pasoActivo} color={colorAccent} size="sm"
          styles={{ stepLabel: { fontSize: 13, fontWeight: 600 }, stepDescription: { fontSize: 11 } }}
        >
          <Stepper.Step label="Subir archivo" description="Excel / CSV / PDF" loading={subiendo} icon={<IconUpload size={16} />} />
          <Stepper.Step label="Confirmar mapeo" description="columnas → campos" icon={<IconAdjustments size={16} />} />
          <Stepper.Step
            label={esPicking ? 'Crear picking' : 'Enviar a Odoo'}
            description={pasoActivo === 2 ? `${job?.progreso ?? 0}/${jobTotal}…` : pasos[2]?.sub ?? 'procesando'}
            loading={pasoActivo === 2 && !!jobId}
            icon={<IconDatabase size={16} />}
          />
          <Stepper.Step
            label="Completado"
            description={resultado
              ? esPicking
                ? `picking #${resultado.pickingId ?? '—'}`
                : `${resultado.procesados} procesados`
              : esPicking ? 'picking validado' : 'inventario actualizado'
            }
            icon={<IconCheck size={16} />}
          />
        </Stepper>
      </Card>

      {/* Permiso: cargar */}
      {!puedeCargar && (
        <Alert icon={<IconLock size={16} />} color="yellow" title="Sin permiso de carga" mb="md">
          Tu cuenta no tiene el permiso <strong>integracion-sap:cargar</strong>. Pide a un administrador que te lo asigne en la sección Usuarios.
        </Alert>
      )}

      {/* Paso 1: Dropzone */}
      {puedeCargar && !uploadState && !resultado && (
        <Card withBorder p="lg" style={{ background: '#fff' }}>
          <Text fw={600} mb={8} c="#18181B">Subir archivo exportado de SAP</Text>
          <Dropzone
            onDrop={onDrop}
            onReject={() => setErrorMsg('Archivo rechazado. Usa .xlsx, .xls, .csv o .pdf, máximo 20 MB.')}
            accept={ACCEPT_TYPES}
            maxSize={20 * 1024 * 1024}
            loading={subiendo}
            style={{ borderColor: colorAccent + '60', borderRadius: 8, cursor: 'pointer' }}
          >
            <Group justify="center" gap="xl" style={{ minHeight: 120, pointerEvents: 'none' }}>
              <Dropzone.Accept><IconUpload size={40} color={colorAccent} /></Dropzone.Accept>
              <Dropzone.Reject><IconX size={40} color="#A32D2D" /></Dropzone.Reject>
              <Dropzone.Idle><IconFile size={40} color="#A1A1AA" /></Dropzone.Idle>
              <Box>
                <Text size="sm" fw={600} c="#18181B">
                  Arrastra el archivo aquí o haz clic para seleccionar
                </Text>
                <Text size="xs" c="#71717A" mt={4}>
                  Formatos: .xlsx · .xls · .csv · .pdf · Máximo 20 MB
                </Text>
              </Box>
            </Group>
          </Dropzone>
          {errorMsg && (
            <Alert icon={<IconAlertTriangle size={16} />} color="red" mt="md" radius="sm">
              {errorMsg}
            </Alert>
          )}
        </Card>
      )}

      {/* Paso 2: Mapeo + preview */}
      {uploadState && !resultado && (
        <>
          {/* Card de mapeo de columnas — solo para Excel/CSV */}
          {!isPdf && (
            <Card withBorder p="lg" style={{ background: '#fff' }}>
              <Group align="center" gap="xs" mb="xs">
                <IconAdjustments size={18} color={colorAccent} />
                <Text fw={600} c="#18181B">Confirmar mapeo de columnas</Text>
              </Group>
              <Text size="sm" c="#71717A" mb="md">
                El sistema detectó automáticamente las columnas. Verifica y corrige si es necesario.
              </Text>

              {/* Selector de hoja */}
              {(uploadState.hojas?.length ?? 0) > 1 && (
                <Box mb="md" p="sm" style={{ background: '#F1F5F9', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <Group align="center" gap="sm">
                    <IconBuildingWarehouse size={16} color="#1A365D" />
                    <Text size="sm" fw={600} c="#1A365D">
                      {uploadState.hojas.length} hojas — elige cuál procesar:
                    </Text>
                  </Group>
                  <Select
                    mt="xs" size="sm"
                    data={uploadState.hojas}
                    value={uploadState.hojaActual}
                    onChange={(val) => val && onCambiarHoja(val)}
                    disabled={cambiandoHoja}
                    leftSection={cambiandoHoja ? <Loader size={14} /> : undefined}
                    styles={{ input: { fontWeight: 600 } }}
                  />
                </Box>
              )}

              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                {CAMPOS_REQUERIDOS.map(campo => (
                  <Box key={campo.key}>
                    <Text size="xs" fw={600} c="#52525B" mb={4}>
                      {campo.label}
                      {campo.requerido && <Text span c="red"> *</Text>}
                    </Text>
                    <Select
                      data={opciones}
                      value={mapeoActual[campo.key] ?? SIN_COLUMNA}
                      onChange={(val) =>
                        setMapeoActual(prev => ({
                          ...prev,
                          [campo.key]: val === SIN_COLUMNA ? '' : (val ?? ''),
                        }))
                      }
                      size="sm"
                      styles={{
                        input: {
                          borderColor: campo.requerido && !mapeoActual[campo.key] ? '#A32D2D' : undefined,
                        },
                      }}
                    />
                    {mapeoActual[campo.key] && mapeoActual[campo.key] !== SIN_COLUMNA && (
                      <Text size="10px" c="#0F6E56" mt={2}>
                        ✓ &quot;{mapeoActual[campo.key]}&quot;
                      </Text>
                    )}
                  </Box>
                ))}
              </SimpleGrid>

              {mapeoIncompleto.length > 0 && (
                <Alert icon={<IconAlertTriangle size={14} />} color="red" mt="md" radius="sm">
                  <Text size="sm">Faltan campos requeridos: <strong>{mapeoIncompleto.join(', ')}</strong></Text>
                </Alert>
              )}

              {uploadState.advertencias.length > 0 && (
                <Alert icon={<IconAlertTriangle size={14} />} color="yellow" mt="sm" radius="sm">
                  {uploadState.advertencias.map((a, i) => <Text key={i} size="xs">{a}</Text>)}
                </Alert>
              )}

              {/* Selector de almacén — sólo para inventario (no para picking) */}
              {!esPicking && (
                <Box mt="md" style={{ borderTop: '1px solid #E4E4E7', paddingTop: 16 }}>
                  <Group align="center" gap="xs" mb={6}>
                    <IconBuildingWarehouse size={16} color={!whsMapeado && !ubicacionOverrideId ? '#A32D2D' : '#A1A1AA'} />
                    <Text size="sm" fw={600} c={!whsMapeado && !ubicacionOverrideId ? '#A32D2D' : '#52525B'}>
                      Almacén de destino
                      {!whsMapeado && !ubicacionOverrideId && <Text span c="red"> *</Text>}
                    </Text>
                  </Group>

                  {whsMapeado && !ubicacionOverrideId && (
                    <Text size="xs" c="#71717A" mb={6}>
                      Columna detectada: &quot;{mapeoActual['whsCode']}&quot;. Selecciona un almacén de Odoo para aplicarlo a todas las filas.
                    </Text>
                  )}

                  {!whsMapeado && !ubicacionOverrideId && (
                    <Text size="xs" c="#71717A" mb={8}>
                      Sin columna de almacén. Selecciona uno de Odoo para todas las filas.
                    </Text>
                  )}

                  {!cargarUbicaciones ? (
                    <Button
                      variant="outline" size="xs"
                      leftSection={<IconBuildingWarehouse size={14} />}
                      onClick={() => setCargarUbicaciones(true)}
                    >
                      Cargar almacenes de Odoo
                    </Button>
                  ) : (
                    <Select
                      placeholder={cargandoUbicaciones ? 'Cargando...' : 'Selecciona un almacén...'}
                      data={(ubicaciones ?? []).map(u => ({ value: String(u.id), label: u.nombre }))}
                      value={ubicacionOverrideId ? String(ubicacionOverrideId) : null}
                      onChange={(val) => setUbicacionOverrideId(val ? Number(val) : null)}
                      searchable disabled={cargandoUbicaciones} size="sm"
                      style={{ maxWidth: 400 }}
                    />
                  )}
                  {ubicacionOverrideId && ubicaciones && (
                    <Text size="xs" c="#0F6E56" mt={4}>
                      ✓ Todas las filas irán a: <strong>{ubicaciones.find(u => u.id === ubicacionOverrideId)?.nombre}</strong>
                    </Text>
                  )}
                </Box>
              )}

              {/* Picking: nota sobre mapeo_bodega */}
              {esPicking && whsMapeado && (
                <Box mt="md" p="sm" style={{ background: '#F0F9FF', borderRadius: 8, border: '1px solid #BAE6FD' }}>
                  <Text size="xs" c="#0369A1" fw={600}>
                    El almacén &quot;{mapeoActual['whsCode']}&quot; se resolverá automáticamente
                    via Mapeos → Bodegas para obtener el tipo de operación y las ubicaciones de Odoo.
                  </Text>
                </Box>
              )}

              {/* Referencia SAP — solo para picking en Excel/CSV */}
              {esPicking && (
                <Box mt="md" style={{ borderTop: '1px solid #E4E4E7', paddingTop: 16 }}>
                  <TextInput
                    label="N° de operación SAP"
                    description="Número de documento SAP. Se usará como referencia en el picking de Odoo."
                    placeholder="Ej: 12345"
                    value={referenciaSap}
                    onChange={(e) => setReferenciaSap(e.currentTarget.value)}
                    size="sm"
                    style={{ maxWidth: 320 }}
                    styles={{ input: { fontWeight: 600, letterSpacing: 1 }, label: { fontWeight: 600 } }}
                  />
                  {referenciaSap.trim() && (
                    <Text size="xs" c="#0F6E56" mt={4}>
                      ✓ Origin: <strong>SAP-{tipo === 'SALIDA_BODEGA' ? 'GI' : 'GR'}-{referenciaSap.trim()}</strong>
                    </Text>
                  )}
                </Box>
              )}
            </Card>
          )}

          {/* Preview de filas */}
          <Card withBorder p="lg" style={{ background: '#fff' }}>
            {/* Para PDF: resumen compacto + campo SAP reference */}
            {isPdf && (
              <Box mb="md" p="sm" style={{ background: '#F0F9FF', borderRadius: 8, border: '1px solid #BAE6FD' }}>
                <Group gap="xs" align="center" mb={esPicking ? 12 : 6}>
                  <IconCheck size={14} color="#0369A1" />
                  <Text size="sm" fw={600} c="#0369A1">
                    PDF procesado automáticamente — {uploadState.totalFilas} líneas
                  </Text>
                </Group>
                {esPicking && (
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt={4}>
                    <Box>
                      <Select
                        label="Almacén SAP"
                        description={
                          opcionesBodega.length === 0
                            ? 'Sin bodegas configuradas — ve a Mapeos → Bodegas'
                            : 'Selecciona el almacén de origen de esta salida'
                        }
                        placeholder="Selecciona un almacén..."
                        data={opcionesBodega}
                        value={whsCodeOverride || null}
                        onChange={(v) => { setWhsCodeOverride(v ?? ''); guardarPreferencia(v ?? ''); }}
                        size="sm"
                        required
                        leftSection={<IconBuildingWarehouse size={14} />}
                        styles={{ input: { fontWeight: 600, fontFamily: 'monospace' }, label: { fontWeight: 600 } }}
                        disabled={opcionesBodega.length === 0}
                        error={!whsCodeOverride ? 'Requerido' : undefined}
                      />
                      {whsCodeOverride && (
                        <Text size="xs" c="#0369A1" mt={3}>
                          ✓ Usará el mapeo configurado para <strong>{whsCodeOverride}</strong>
                        </Text>
                      )}
                    </Box>
                    <Box>
                      <TextInput
                        label="N° de operación SAP"
                        description={uploadState.docNumSap ? 'Detectado del PDF — puedes corregirlo' : 'N° documento SAP para la referencia'}
                        placeholder="Ej: 1018167"
                        value={referenciaSap}
                        onChange={(e) => setReferenciaSap(e.currentTarget.value)}
                        size="sm"
                        styles={{ input: { fontWeight: 600, letterSpacing: 1 }, label: { fontWeight: 600 } }}
                      />
                      {referenciaSap.trim() && (
                        <Text size="xs" c="#0F6E56" mt={3}>
                          ✓ Origin: <strong>SAP-{tipo === 'SALIDA_BODEGA' ? 'GI' : 'GR'}-{referenciaSap.trim()}</strong>
                        </Text>
                      )}
                    </Box>
                  </SimpleGrid>
                )}
              </Box>
            )}

            <Group align="center" justify="space-between" mb="sm">
              <Text fw={600} c="#18181B">
                Vista previa — {uploadState.totalFilas} líneas detectadas
              </Text>
              <Badge color={pct >= 90 ? 'green' : pct >= 70 ? 'yellow' : 'red'}>
                {pct}% sin advertencias
              </Badge>
            </Group>

            <Progress value={pct} color={pct >= 90 ? 'green' : pct >= 70 ? 'yellow' : 'red'} size="xs" mb="md" />

            <ScrollArea style={{ height: 260 }}>
              <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Línea</Table.Th>
                    <Table.Th>Código SAP</Table.Th>
                    <Table.Th>Descripción</Table.Th>
                    <Table.Th>Almacén</Table.Th>
                    <Table.Th>{labelCantidad}</Table.Th>
                    {mostrarPrecio && <Table.Th>{tipo === 'ENTRADA_MERCANCIA' ? 'Precio' : 'Costo unit.'}</Table.Th>}
                    <Table.Th>UM</Table.Th>
                    <Table.Th>Advertencias</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filasPreview.slice(0, 200).map((fila, i) => (
                    <Table.Tr key={i} style={fila.advertencias.length > 0 ? { background: '#FFF7ED' } : {}}>
                      <Table.Td><Text size="xs" c="#71717A">{fila.filaOriginal}</Text></Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={600}>
                          {fila.itemCode || <Text span c="red">—</Text>}
                        </Text>
                      </Table.Td>
                      <Table.Td><Text size="xs">{fila.itemName}</Text></Table.Td>
                      <Table.Td><Text size="xs">{fila.whsCode}</Text></Table.Td>
                      <Table.Td><Text size="xs" fw={600}>{fila.onHand.toLocaleString('es-GT')}</Text></Table.Td>
                      {mostrarPrecio && (
                        <Table.Td>
                          <Text size="xs" c={fila.precioUnitario ? '#166534' : '#A1A1AA'}>
                            {fila.precioUnitario != null
                              ? `Q ${fila.precioUnitario.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </Text>
                        </Table.Td>
                      )}
                      <Table.Td><Text size="xs">{fila.uomCode}</Text></Table.Td>
                      <Table.Td><Text size="xs" c="orange">{fila.advertencias.join('; ')}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {uploadState.totalFilas > 200 && (
              <Text size="xs" c="#71717A" mt="xs">
                Mostrando primeras 200 de {uploadState.totalFilas}. Se procesarán todas.
              </Text>
            )}
          </Card>

          {/* Acciones */}
          {!jobId && (
            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" color="gray" onClick={reiniciar} disabled={iniciando}>
                Cancelar y subir otro archivo
              </Button>
              <Button
                style={{ background: colorAccent }}
                loading={iniciando}
                disabled={mapeoIncompleto.length > 0 || iniciando}
                onClick={confirmar}
                leftSection={esPicking ? <IconPackage size={16} /> : <IconCheck size={16} />}
              >
                {labelBoton}
              </Button>
            </Group>
          )}
        </>
      )}

      {/* Progreso del job */}
      {pasoActivo === 2 && jobId && (
        <Card withBorder p="xl" style={{ background: '#fff', borderLeft: `4px solid ${colorAccent}` }}>
          <Group align="center" gap="md" mb="lg">
            <Loader size="md" color={colorAccent} />
            <Box>
              <Text fw={700} size="lg" c="#18181B">
                {esPicking ? 'Creando picking en Odoo…' : 'Enviando a Odoo…'}
              </Text>
              <Text size="sm" c="#71717A">No cierres esta ventana.</Text>
            </Box>
          </Group>
          <Progress
            value={jobTotal > 0 ? ((job?.progreso ?? 0) / jobTotal) * 100 : 0}
            animated size="xl" radius="md" color={colorAccent} mb="sm"
          />
          <Group justify="space-between">
            <Text size="sm" c="#71717A">
              {job?.progreso ?? 0} de {jobTotal} {esPicking ? 'productos resueltos' : 'procesados'}
            </Text>
            <Text size="sm" fw={600} c={colorAccent}>
              {jobTotal > 0 ? Math.round(((job?.progreso ?? 0) / jobTotal) * 100) : 0}%
            </Text>
          </Group>
        </Card>
      )}

      {/* Resultado — picking */}
      {resultado && esPicking && (
        <Card withBorder p="lg" style={{
          background: '#fff',
          borderLeft: `4px solid ${resultado.pickingEstado === 'ok' ? '#0F6E56' : resultado.pickingEstado === 'ok_sin_stock' ? '#854F0B' : resultado.pickingEstado === 'ya_existe' ? '#1A365D' : '#A32D2D'}`,
        }}>
          <Group align="center" gap="sm" mb="md">
            <ThemeIcon size={36} radius="xl" style={{
              background: resultado.pickingEstado === 'ok' ? '#0F6E5615' : resultado.pickingEstado === 'ok_sin_stock' ? '#854F0B15' : '#A32D2D15',
            }}>
              {resultado.pickingEstado === 'ok' || resultado.pickingEstado === 'ya_existe'
                ? <IconCircleCheck size={20} color={resultado.pickingEstado === 'ok' ? '#0F6E56' : '#1A365D'} />
                : resultado.pickingEstado === 'ok_sin_stock'
                  ? <IconCircleCheck size={20} color="#854F0B" />
                  : <IconAlertTriangle size={20} color="#A32D2D" />
              }
            </ThemeIcon>
            <Box>
              <Text fw={700} c="#18181B">
                {resultado.pickingEstado === 'ok' && 'Picking creado y validado'}
                {resultado.pickingEstado === 'ok_sin_stock' && 'Picking validado (sin existencias previas)'}
                {resultado.pickingEstado === 'ya_existe' && 'Picking ya existía (sin duplicar)'}
              </Text>
              {resultado.pickingId && (
                <Text size="sm" c="#71717A">
                  Picking ID en Odoo:{' '}
                  <Text span fw={700} c="#1A365D">#{resultado.pickingId}</Text>
                </Text>
              )}
              {referenciaSap.trim() && (
                <Text size="xs" c="#71717A" mt={2}>
                  Referencia SAP:{' '}
                  <Text span fw={600} c="#1A365D" style={{ fontFamily: 'monospace' }}>
                    {referenciaSap.trim()}
                  </Text>
                </Text>
              )}
            </Box>
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md" mb="md">
            <Card withBorder p="sm" style={{ background: '#F0FDF4' }}>
              <Text size="xs" fw={600} tt="uppercase" c="#71717A">Líneas totales</Text>
              <Text size="28px" fw={800} c="#166534" lh={1}>{resultado.procesados}</Text>
            </Card>
            <Card withBorder p="sm" style={{ background: resultado.sinMapeo?.length ? '#FFF7ED' : '#F8F8F8' }}>
              <Text size="xs" fw={600} tt="uppercase" c="#71717A">Sin mapeo</Text>
              <Text size="28px" fw={800} c={resultado.sinMapeo?.length ? '#92400E' : '#A1A1AA'} lh={1}>
                {resultado.sinMapeo?.length ?? 0}
              </Text>
              <Text size="10px" c="#A1A1AA">productos no encontrados en Odoo</Text>
            </Card>
            <Card withBorder p="sm" style={{ background: resultado.sinBodega?.length ? '#FFF7ED' : '#F8F8F8' }}>
              <Text size="xs" fw={600} tt="uppercase" c="#71717A">Sin bodega</Text>
              <Text size="28px" fw={800} c={resultado.sinBodega?.length ? '#92400E' : '#A1A1AA'} lh={1}>
                {resultado.sinBodega?.length ?? 0}
              </Text>
              <Text size="10px" c="#A1A1AA">WhsCode sin mapeo_bodega</Text>
            </Card>
          </SimpleGrid>

          {resultado.pickingEstado === 'ok_sin_stock' && (
            <Alert icon={<IconAlertTriangle size={14} />} color="yellow" mb="sm" radius="sm">
              <Text size="sm" fw={600}>Validado sin existencias en Odoo — cantidades forzadas desde SAP</Text>
              <Text size="xs" c="#71717A" mt={4}>
                Productos sin reserva previa: {resultado.movesNoAsignados?.join(', ')}
              </Text>
              <Text size="xs" c="#71717A" mt={4}>
                El picking está DONE en Odoo. Las existencias quedan negativas hasta que se reciba el ingreso correspondiente.
              </Text>
            </Alert>
          )}

          {resultado.sinMapeo && resultado.sinMapeo.length > 0 && (
            <Alert icon={<IconAlertTriangle size={14} />} color="yellow" mb="sm" radius="sm">
              <Text size="sm" fw={600}>Productos no encontrados en Odoo (default_code):</Text>
              <Text size="xs" c="#71717A">{resultado.sinMapeo.slice(0, 10).join(', ')}</Text>
              <Text size="xs" c="#71717A" mt={4}>Revisa que el código SAP exista como &quot;Referencia interna&quot; en Odoo.</Text>
            </Alert>
          )}

          {resultado.sinBodega && resultado.sinBodega.length > 0 && (
            <Alert icon={<IconAlertTriangle size={14} />} color="orange" mb="sm" radius="sm">
              <Text size="sm" fw={600}>Almacén sin mapeo:</Text>
              <Text size="xs" c="#71717A">{resultado.sinBodega.join(', ')}</Text>
              <Text size="xs" c="#71717A" mt={4}>
                Configura en <strong>Mapeos → Bodegas</strong> con el tipo de operación correcto.
              </Text>
            </Alert>
          )}

          <Button variant="subtle" onClick={reiniciar} leftSection={<IconUpload size={14} />}>
            Subir otro archivo
          </Button>
        </Card>
      )}

      {/* Resultado — inventario */}
      {resultado && !esPicking && (
        <Card withBorder p="lg" style={{ background: '#fff', borderLeft: '4px solid #0F6E56' }}>
          <Group align="center" gap="sm" mb="md">
            <ThemeIcon size={36} radius="xl" style={{ background: '#0F6E5615' }}>
              <IconCircleCheck size={20} color="#0F6E56" />
            </ThemeIcon>
            <Text fw={700} c="#18181B">Procesamiento completado</Text>
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="md">
            <Card withBorder p="sm" style={{ background: '#F0FDF4' }}>
              <Text size="xs" fw={600} tt="uppercase" c="#71717A">Ajustados</Text>
              <Text size="28px" fw={800} c="#166534" lh={1}>{resultado.ajustados ?? resultado.procesados}</Text>
            </Card>
            <Card withBorder p="sm" style={{ background: '#F8F8F8' }}>
              <Text size="xs" fw={600} tt="uppercase" c="#71717A">Sin cambio</Text>
              <Text size="28px" fw={800} c="#A1A1AA" lh={1}>{resultado.sinCambio ?? 0}</Text>
              <Text size="10px" c="#A1A1AA">ya tenían la cantidad correcta</Text>
            </Card>
            <Card withBorder p="sm" style={{ background: resultado.errores > 0 ? '#FFF7ED' : '#F8F8F8' }}>
              <Text size="xs" fw={600} tt="uppercase" c="#71717A">Con errores</Text>
              <Text size="28px" fw={800} c={resultado.errores > 0 ? '#92400E' : '#A1A1AA'} lh={1}>
                {resultado.errores}
              </Text>
            </Card>
            <Card withBorder p="sm" style={{ background: resultado.sinBodega.length > 0 ? '#FFF7ED' : '#F8F8F8' }}>
              <Text size="xs" fw={600} tt="uppercase" c="#71717A">Sin almacén</Text>
              <Text size="28px" fw={800} c={resultado.sinBodega.length > 0 ? '#92400E' : '#A1A1AA'} lh={1}>
                {resultado.sinBodega.length}
              </Text>
            </Card>
          </SimpleGrid>

          {(resultado.conOnHandCero?.length ?? 0) > 0 && (
            <Alert icon={<IconAlertTriangle size={14} />} color="blue" mb="sm" radius="sm">
              <Text size="sm" fw={600}>{resultado.conOnHandCero.length} productos con cantidad 0 en el archivo</Text>
              <Text size="xs" c="#71717A">Ajustados a 0 en Odoo.</Text>
            </Alert>
          )}

          {resultado.sinBodega.length > 0 && (
            <Alert icon={<IconAlertTriangle size={14} />} color="yellow" mb="sm" radius="sm">
              <Text size="sm" fw={600}>Almacenes sin mapear:</Text>
              <Text size="xs" c="#71717A">{resultado.sinBodega.slice(0, 10).join(', ')}</Text>
              <Text size="xs" c="#71717A" mt={4}>Ve a <strong>Mapeos → Bodegas</strong> para configurarlos.</Text>
            </Alert>
          )}

          {resultado.detalleErrores.length > 0 && (
            <Alert icon={<IconAlertTriangle size={14} />} color="red" mb="sm" radius="sm">
              <Text size="sm" fw={600}>Errores:</Text>
              {resultado.detalleErrores.slice(0, 5).map((e, i) => (
                <Text key={i} size="xs" c="#71717A">{e}</Text>
              ))}
              {resultado.detalleErrores.length > 5 && (
                <Text size="xs" c="#71717A">…y {resultado.detalleErrores.length - 5} más.</Text>
              )}
            </Alert>
          )}

          <Button variant="subtle" onClick={reiniciar} leftSection={<IconUpload size={14} />}>
            Subir otro archivo
          </Button>
        </Card>
      )}

      {/* Historial de ejecuciones */}
      {(historial?.length ?? 0) > 0 && (() => {
        const PAGE_SIZE = 10;
        const totalPaginas = Math.ceil(historial!.length / PAGE_SIZE);
        const pagina = Math.min(paginaHistorial, totalPaginas);
        const filasPagina = historial!.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);
        return (
          <Card withBorder p="lg" style={{ background: '#fff' }}>
            <Group align="center" gap="xs" mb="md">
              <IconHistory size={18} color="#52525B" />
              <Text fw={600} c="#18181B">Historial de ejecuciones</Text>
              <Badge variant="light" color="gray" size="sm">{historial!.length} registros</Badge>
            </Group>
            <ScrollArea>
              <Table striped withTableBorder withColumnBorders fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Fecha</Table.Th>
                    <Table.Th>Origen</Table.Th>
                    <Table.Th>Archivo</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Filas</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Ajustados</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Errores</Table.Th>
                    <Table.Th>Detalle</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filasPagina.map((h) => (
                    <Table.Tr key={h.id}>
                      <Table.Td>
                        <Text size="xs" style={{ whiteSpace: 'nowrap' }}>
                          {new Date(h.creadoEn).toLocaleString('es-GT', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          color={(h as any).origen === 'EXT' ? 'violet' : 'gray'}
                          variant={(h as any).origen === 'EXT' ? 'filled' : 'outline'}
                          title={(h as any).origen === 'EXT' ? 'Externo — SAP Business One' : 'Interno — carga manual'}
                        >
                          {(h as any).origen ?? 'INT'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="#52525B" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h.nombreArchivo ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={h.estado === 'completado' ? 'green' : 'red'} variant="light">
                          {h.estado}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}><Text size="xs">{h.totalFilas}</Text></Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="xs" fw={600} c="#166534">{h.ajustados}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="xs" c={h.errores > 0 ? '#92400E' : '#A1A1AA'}>{h.errores}</Text>
                      </Table.Td>
                      <Table.Td>
                        {h.errorFatal ? (
                          <Text size="xs" c="red" lineClamp={1}>{h.errorFatal}</Text>
                        ) : h.detalleErrores.length > 0 ? (
                          <Text size="xs" c="#92400E" lineClamp={1}>{h.detalleErrores[0]}</Text>
                        ) : (
                          <Text size="xs" c="#A1A1AA">—</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            {totalPaginas > 1 && (
              <Group justify="space-between" align="center" mt="md">
                <Text size="xs" c="#71717A">
                  Mostrando {(pagina - 1) * PAGE_SIZE + 1}–{Math.min(pagina * PAGE_SIZE, historial!.length)} de {historial!.length}
                </Text>
                <Pagination
                  total={totalPaginas}
                  value={pagina}
                  onChange={setPaginaHistorial}
                  size="sm"
                  color="ptSlate"
                />
              </Group>
            )}
          </Card>
        );
      })()}
    </Stack>
  );
}
