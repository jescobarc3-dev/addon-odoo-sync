'use client';

import {
  Stack, Title, Text, FileInput, Button, Alert, Badge, Card,
  SimpleGrid, Progress, Group, Table, ScrollArea, Accordion, ThemeIcon,
  NumberInput, Divider, Box,
} from '@mantine/core';
import {
  IconUpload, IconAlertTriangle, IconCheck, IconInfoCircle,
  IconArrowRight, IconWand, IconDeviceFloppy,
} from '@tabler/icons-react';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';

interface ResumenCalidad {
  total: number;
  sinProblemas: number;
  conProblemas: number;
  scorePromedio: number;
  correcciones: { campo: string; original: string; normalizado: string; ocurrencias: number }[];
  problemas: { puesto: number; tipo: string; descripcion: string }[];
}

interface ResultadoCarga {
  empresa: string;
  cargados: number;
  resumenCalidad: ResumenCalidad;
}

type Paso = 'upload' | 'corregir' | 'completado';

export default function CargaUbicacionesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState<Paso>('upload');
  const [sesionId, setSesionId] = useState<string | null>(null);
  const [resumenParseo, setResumenParseo] = useState<ResumenCalidad | null>(null);
  const [zonaDefault, setZonaDefault] = useState<number | string>('');
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);

  // Paso 1: parsear Excel sin guardar
  const handleAnalizar = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('empresa', 'DEFAULT');

      const res = await fetch('/api/integracion-sap/documentos/ubicaciones/upload', {
        method: 'POST', credentials: 'include', body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? 'Error en el servidor');
      }
      const data: { sesionId: string; resumenCalidad: ResumenCalidad } = await res.json();
      setSesionId(data.sesionId);
      setResumenParseo(data.resumenCalidad);
      setPaso('corregir');
    } catch (err: any) {
      notifications.show({ message: err.message ?? 'Error inesperado', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: confirmar con correcciones opcionales
  const handleConfirmar = async () => {
    if (!sesionId) return;
    setLoading(true);
    try {
      const correcciones: Record<string, number> = {};
      if (zonaDefault !== '' && zonaDefault !== null) {
        correcciones.zona = Number(zonaDefault);
      }

      const res = await fetch(`/api/integracion-sap/documentos/ubicaciones/confirmar/${sesionId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correcciones }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? 'Error en el servidor');
      }
      const data: ResultadoCarga = await res.json();
      setResultado(data);
      setPaso('completado');
      notifications.show({
        message: `${data.cargados} puestos guardados. Score promedio: ${data.resumenCalidad.scorePromedio}/100`,
        color: 'teal',
      });
    } catch (err: any) {
      notifications.show({ message: err.message ?? 'Error inesperado', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null); setSesionId(null); setResumenParseo(null);
    setZonaDefault(''); setResultado(null); setPaso('upload');
  };

  // Agrupar issues por descripción para mostrar conteo
  const issuesAgrupados = resumenParseo
    ? Object.entries(
        resumenParseo.problemas.reduce<Record<string, number>>((acc, p) => {
          acc[p.descripcion] = (acc[p.descripcion] ?? 0) + 1;
          return acc;
        }, {}),
      ).sort((a, b) => b[1] - a[1])
    : [];

  const zonaIssues = issuesAgrupados.filter(([desc]) => desc.includes('Zona no especificada'));

  return (
    <Stack gap="md" maw={800}>
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={3}>Cargar Catálogo de Ubicaciones</Title>
          <Text size="sm" c="dimmed">
            Excel con columnas: NO., ÁREA, INDUSTRIA, ENCARGADO DE AREA, CLIENTE, FACTURACIÓN,
            DEPARTAMENTO, MUNICIPIO, ZONA, DIRECCIÓN, SUCURSAL, RAZON SOCIAL, CATEGORIA, PUESTO, POSICIÓN
          </Text>
        </Stack>
        <Link href="/integracion-sap/ubicaciones">
          <Button variant="subtle" rightSection={<IconArrowRight size={14} />} size="xs">Ver catálogo</Button>
        </Link>
      </Group>

      {/* ── PASO 1: SUBIR ARCHIVO ─────────────────────────────────────────── */}
      {paso === 'upload' && (
        <Stack gap="md">
          <Alert icon={<IconInfoCircle size={16} />} color="blue" title="Gobierno de datos">
            El sistema normaliza automáticamente los valores y asigna un <strong>score de calidad 0–100</strong>.
            Antes de guardar podrás aplicar correcciones en lote a los issues detectados.
          </Alert>
          <FileInput
            label="Archivo Excel (.xlsx)"
            placeholder="Selecciona el listado oficial de puestos"
            accept=".xlsx,.xls"
            value={file}
            onChange={setFile}
            leftSection={<IconUpload size={14} />}
          />
          <Button
            onClick={handleAnalizar}
            loading={loading}
            disabled={!file}
            leftSection={<IconWand size={16} />}
          >
            Analizar archivo
          </Button>
        </Stack>
      )}

      {/* ── PASO 2: REVISAR Y CORREGIR ───────────────────────────────────── */}
      {paso === 'corregir' && resumenParseo && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <Card withBorder p="sm">
              <Text size="xl" fw={700}>{resumenParseo.total}</Text>
              <Text size="xs" c="dimmed">Puestos encontrados</Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xl" fw={700} c={resumenParseo.scorePromedio >= 80 ? 'teal' : 'orange'}>
                {resumenParseo.scorePromedio}
              </Text>
              <Text size="xs" c="dimmed">Score promedio</Text>
              <Progress value={resumenParseo.scorePromedio}
                color={resumenParseo.scorePromedio >= 80 ? 'teal' : 'orange'} size="xs" mt={4} />
            </Card>
            <Card withBorder p="sm">
              <Group gap="xs">
                <ThemeIcon color="teal" variant="light" size="sm"><IconCheck size={12} /></ThemeIcon>
                <Text size="xl" fw={700}>{resumenParseo.sinProblemas}</Text>
              </Group>
              <Text size="xs" c="dimmed">Sin problemas</Text>
            </Card>
            <Card withBorder p="sm">
              <Group gap="xs">
                <ThemeIcon color="orange" variant="light" size="sm"><IconAlertTriangle size={12} /></ThemeIcon>
                <Text size="xl" fw={700}>{resumenParseo.conProblemas}</Text>
              </Group>
              <Text size="xs" c="dimmed">Con issues</Text>
            </Card>
          </SimpleGrid>

          <Accordion variant="contained">
            {resumenParseo.correcciones.length > 0 && (
              <Accordion.Item value="correcciones">
                <Accordion.Control icon={<IconCheck size={16} color="teal" />}>
                  Correcciones aplicadas automáticamente ({resumenParseo.correcciones.length} tipos)
                </Accordion.Control>
                <Accordion.Panel>
                  <ScrollArea h={200}>
                    <Table fz="xs" withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Campo</Table.Th>
                          <Table.Th>Original</Table.Th>
                          <Table.Th>→ Normalizado</Table.Th>
                          <Table.Th>Veces</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {resumenParseo.correcciones.map((c, i) => (
                          <Table.Tr key={i}>
                            <Table.Td><Badge size="xs" variant="outline">{c.campo}</Badge></Table.Td>
                            <Table.Td><Text c="red" ff="monospace" size="xs">"{c.original}"</Text></Table.Td>
                            <Table.Td><Text c="teal" ff="monospace" size="xs">"{c.normalizado}"</Text></Table.Td>
                            <Table.Td>{c.ocurrencias}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Accordion.Panel>
              </Accordion.Item>
            )}

            {issuesAgrupados.length > 0 && (
              <Accordion.Item value="issues">
                <Accordion.Control icon={<IconAlertTriangle size={16} color="orange" />}>
                  Issues de calidad ({resumenParseo.conProblemas} registros afectados)
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {issuesAgrupados.map(([desc, count]) => (
                      <Group key={desc} justify="space-between" px={4}>
                        <Text size="xs" c="orange">{desc}</Text>
                        <Badge size="xs" color="orange" variant="light">{count} registros</Badge>
                      </Group>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            )}
          </Accordion>

          {/* Correcciones en lote */}
          {issuesAgrupados.length > 0 && (
            <Box>
              <Divider label="Correcciones en lote (opcional)" labelPosition="left" mb="sm" />
              <Stack gap="sm">
                {zonaIssues.length > 0 && (
                  <Group align="flex-end" gap="sm">
                    <NumberInput
                      label={`Zona por defecto para ${zonaIssues[0][1]} registros sin zona`}
                      description="Se aplicará a todos los puestos con zona vacía o 0"
                      placeholder="Ej: 0"
                      value={zonaDefault}
                      onChange={setZonaDefault}
                      min={0}
                      w={300}
                    />
                    {zonaDefault !== '' && (
                      <Badge color="teal" variant="light" mb={6}>
                        Se asignará zona {zonaDefault} a {zonaIssues[0][1]} puestos
                      </Badge>
                    )}
                  </Group>
                )}
              </Stack>
            </Box>
          )}

          <Group mt="sm">
            <Button
              onClick={handleConfirmar}
              loading={loading}
              leftSection={<IconDeviceFloppy size={16} />}
            >
              Confirmar y guardar
            </Button>
            <Button variant="subtle" color="gray" onClick={handleReset} disabled={loading}>
              Volver a subir
            </Button>
          </Group>
        </Stack>
      )}

      {/* ── COMPLETADO ───────────────────────────────────────────────────── */}
      {paso === 'completado' && resultado && (
        <Stack gap="md">
          <Alert icon={<IconCheck size={16} />} color="teal" title="Catálogo guardado correctamente">
            {resultado.cargados} puestos cargados. Score promedio: {resultado.resumenCalidad.scorePromedio}/100.
          </Alert>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <Card withBorder p="sm">
              <Text size="xl" fw={700}>{resultado.cargados}</Text>
              <Text size="xs" c="dimmed">Puestos guardados</Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xl" fw={700} c={resultado.resumenCalidad.scorePromedio >= 80 ? 'teal' : 'orange'}>
                {resultado.resumenCalidad.scorePromedio}
              </Text>
              <Text size="xs" c="dimmed">Score promedio</Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xl" fw={700} c="teal">{resultado.resumenCalidad.sinProblemas}</Text>
              <Text size="xs" c="dimmed">Sin problemas</Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xl" fw={700} c="orange">{resultado.resumenCalidad.conProblemas}</Text>
              <Text size="xs" c="dimmed">Con issues</Text>
            </Card>
          </SimpleGrid>
          <Group>
            <Link href="/integracion-sap/ubicaciones">
              <Button rightSection={<IconArrowRight size={14} />}>Ver catálogo de ubicaciones</Button>
            </Link>
            <Button variant="subtle" onClick={handleReset}>Cargar otro archivo</Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
