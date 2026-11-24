'use client';

import {
  Stack, Title, Text, FileInput, Button, Alert, Badge, Card,
  SimpleGrid, Progress, Group, Table, ScrollArea, Accordion, ThemeIcon,
} from '@mantine/core';
import {
  IconUpload, IconAlertTriangle, IconCheck, IconInfoCircle,
  IconArrowRight,
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

export default function CargaUbicacionesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResultado(null);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('empresa', 'DEFAULT');

      const res = await fetch('/api/integracion-sap/documentos/ubicaciones/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? 'Error en el servidor');
      }

      const data: ResultadoCarga = await res.json();
      setResultado(data);
      notifications.show({
        message: `${data.cargados} puestos cargados. Score promedio: ${data.resumenCalidad.scorePromedio}/100`,
        color: 'teal',
      });
    } catch (err: any) {
      notifications.show({ message: err.message ?? 'Error inesperado', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="md" maw={800}>
      <Group justify="space-between">
        <Stack gap={2}>
          <Title order={3}>Cargar Catálogo de Ubicaciones</Title>
          <Text size="sm" c="dimmed">
            Excel con columnas: NO., ÁREA, INDUSTRIA, ENCARGADO DE AREA, CLIENTE, FACTURACIÓN,
            DEPARTAMENTO, MUNICIPIO, ZONA, DIRECCIÓN, SUCURSAL, RAZON SOCIAL, CATEGORIA, PUESTO, POSICIÓN
          </Text>
        </Stack>
        <Link href="/integracion-sap/ubicaciones">
          <Button variant="subtle" rightSection={<IconArrowRight size={14} />} size="xs">
            Ver catálogo
          </Button>
        </Link>
      </Group>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" title="Gobierno de datos">
        El sistema normaliza automáticamente los valores (elimina espacios, corrige capitalización,
        aplica correcciones canónicas) y asigna un <strong>score de calidad 0–100</strong> a cada
        registro según completitud de campos críticos.
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
        onClick={handleUpload}
        loading={loading}
        disabled={!file}
        leftSection={<IconUpload size={16} />}
      >
        Cargar y normalizar
      </Button>

      {resultado && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <Card withBorder p="sm">
              <Text size="xl" fw={700}>{resultado.cargados}</Text>
              <Text size="xs" c="dimmed">Puestos cargados</Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xl" fw={700} c={resultado.resumenCalidad.scorePromedio >= 80 ? 'teal' : 'orange'}>
                {resultado.resumenCalidad.scorePromedio}
              </Text>
              <Text size="xs" c="dimmed">Score promedio</Text>
              <Progress
                value={resultado.resumenCalidad.scorePromedio}
                color={resultado.resumenCalidad.scorePromedio >= 80 ? 'teal' : 'orange'}
                size="xs" mt={4}
              />
            </Card>
            <Card withBorder p="sm">
              <Group gap="xs">
                <ThemeIcon color="teal" variant="light" size="sm"><IconCheck size={12} /></ThemeIcon>
                <Text size="xl" fw={700}>{resultado.resumenCalidad.sinProblemas}</Text>
              </Group>
              <Text size="xs" c="dimmed">Sin problemas</Text>
            </Card>
            <Card withBorder p="sm">
              <Group gap="xs">
                <ThemeIcon color="orange" variant="light" size="sm"><IconAlertTriangle size={12} /></ThemeIcon>
                <Text size="xl" fw={700}>{resultado.resumenCalidad.conProblemas}</Text>
              </Group>
              <Text size="xs" c="dimmed">Con issues</Text>
            </Card>
          </SimpleGrid>

          <Accordion variant="contained">
            {resultado.resumenCalidad.correcciones.length > 0 && (
              <Accordion.Item value="correcciones">
                <Accordion.Control icon={<IconCheck size={16} color="teal" />}>
                  Correcciones aplicadas automáticamente ({resultado.resumenCalidad.correcciones.length} tipos)
                </Accordion.Control>
                <Accordion.Panel>
                  <ScrollArea h={240}>
                    <Table fz="xs" withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Campo</Table.Th>
                          <Table.Th>Original</Table.Th>
                          <Table.Th>→ Normalizado</Table.Th>
                          <Table.Th>Ocurrencias</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {resultado.resumenCalidad.correcciones.map((c, i) => (
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

            {resultado.resumenCalidad.problemas.length > 0 && (
              <Accordion.Item value="problemas">
                <Accordion.Control icon={<IconAlertTriangle size={16} color="orange" />}>
                  Issues de calidad pendientes ({resultado.resumenCalidad.problemas.length} en total)
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="xs" c="dimmed" mb="xs">
                    Estos registros tienen campos vacíos o valores no reconocidos. Puedes corregirlos
                    en la fuente y volver a cargar.
                  </Text>
                  <ScrollArea h={280}>
                    <Table fz="xs" withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th w={70}>Puesto</Table.Th>
                          <Table.Th>Issue</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {resultado.resumenCalidad.problemas.map((p, i) => (
                          <Table.Tr key={i}>
                            <Table.Td><Text ff="monospace">{p.puesto}</Text></Table.Td>
                            <Table.Td><Text c="orange" size="xs">{p.descripcion}</Text></Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Accordion.Panel>
              </Accordion.Item>
            )}
          </Accordion>

          <Link href="/integracion-sap/ubicaciones">
            <Button variant="light" rightSection={<IconArrowRight size={14} />}>
              Ver catálogo de ubicaciones
            </Button>
          </Link>
        </Stack>
      )}
    </Stack>
  );
}
