'use client';

import {
  Stack, Title, Group, Button, Table, Badge, ActionIcon, Tooltip,
  Text, ScrollArea, Skeleton, ThemeIcon,
} from '@mantine/core';
import {
  IconPlus, IconEdit, IconTrash, IconRefresh, IconAlertTriangle,
  IconCheck, IconPlugConnected, IconClock,
} from '@tabler/icons-react';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  useGetDestinosOdooQuery,
  useEliminarDestinoOdooMutation,
  useSincronizarDestinoMutation,
  DestinoOdoo,
} from '@/store/api/integracionSapApi';
import { DestinoFormModal } from './DestinoFormModal';

const LABEL_CATALOGO: Record<string, string> = {
  ubicaciones: 'Ubicaciones',
  articulos: 'Artículos',
  empleados: 'Empleados',
};

export function DestinosOdooPage() {
  const [empresa] = useState('DEFAULT');
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<DestinoOdoo | null>(null);

  const { data: destinos = [], isLoading, refetch } = useGetDestinosOdooQuery({ empresa });
  const [eliminar] = useEliminarDestinoOdooMutation();
  const [sincronizar, { isLoading: sincronizando }] = useSincronizarDestinoMutation();

  const handleSincronizar = async (id: number, nombre: string) => {
    const res = await sincronizar(id).unwrap();
    if (res.ok) {
      notifications.show({
        message: `${nombre}: ${res.creados} creados, ${res.actualizados} actualizados`,
        color: 'teal',
      });
    } else {
      notifications.show({ message: res.error ?? 'Error en la sincronización', color: 'red' });
    }
  };

  const handleEliminar = async (id: number) => {
    await eliminar(id).unwrap();
    notifications.show({ message: 'Destino eliminado', color: 'gray' });
  };

  const abrirNuevo = () => { setEditando(null); setModalOpen(true); };
  const abrirEditar = (d: DestinoOdoo) => { setEditando(d); setModalOpen(true); };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Stack gap={2}>
          <Title order={3}>Destinos Odoo</Title>
          <Text size="sm" c="dimmed">
            Configura a qué modelo Odoo se empuja cada catálogo y qué campos se mapean — sin tocar código.
          </Text>
        </Stack>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNuevo}>
          Nuevo destino
        </Button>
      </Group>

      {isLoading && <Skeleton height={200} />}

      {!isLoading && destinos.length === 0 && (
        <Stack align="center" py="xl" gap="xs">
          <ThemeIcon size={48} variant="light" color="gray" radius="xl">
            <IconPlugConnected size={24} />
          </ThemeIcon>
          <Text c="dimmed">Sin destinos configurados. Creá uno para empezar a sincronizar catálogos hacia Odoo.</Text>
        </Stack>
      )}

      {destinos.length > 0 && (
        <ScrollArea>
          <Table withTableBorder withColumnBorders highlightOnHover fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th w={110}>Catálogo</Table.Th>
                <Table.Th>Modelo Odoo</Table.Th>
                <Table.Th w={90}>Campos</Table.Th>
                <Table.Th w={160}>Última sync</Table.Th>
                <Table.Th w={110}>Estado</Table.Th>
                <Table.Th w={110}>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {destinos.map((d) => (
                <Table.Tr key={d.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Text fw={500}>{d.nombre}</Text>
                      {d.autoSync && <Badge size="xs" color="blue" variant="light">Auto</Badge>}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="outline">{LABEL_CATALOGO[d.catalogo] ?? d.catalogo}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text ff="monospace" size="xs">{d.odooModelo}</Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Badge size="sm" variant="light">{d.campos?.length ?? 0}</Badge>
                  </Table.Td>
                  <Table.Td>
                    {d.ultimaSync ? (
                      <Group gap={4}>
                        <IconClock size={12} color="gray" />
                        <Text size="xs" c="dimmed">
                          {new Date(d.ultimaSync).toLocaleString('es-GT')}
                        </Text>
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed">Nunca</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {d.activo
                        ? <Badge size="xs" color="teal" leftSection={<IconCheck size={9} />}>Activo</Badge>
                        : <Badge size="xs" color="gray">Inactivo</Badge>}
                      {d.ultimoError && (
                        <Tooltip label={d.ultimoError} multiline maw={300} color="red">
                          <ThemeIcon color="red" variant="light" size="xs" style={{ cursor: 'pointer' }}>
                            <IconAlertTriangle size={10} />
                          </ThemeIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Sincronizar ahora">
                        <ActionIcon
                          variant="light" color="teal" size="sm"
                          loading={sincronizando}
                          onClick={() => handleSincronizar(d.id, d.nombre)}
                        >
                          <IconRefresh size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Editar">
                        <ActionIcon variant="light" size="sm" onClick={() => abrirEditar(d)}>
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Eliminar">
                        <ActionIcon
                          variant="light" color="red" size="sm"
                          onClick={() => handleEliminar(d.id)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      <DestinoFormModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        destino={editando}
        empresa={empresa}
      />
    </Stack>
  );
}
