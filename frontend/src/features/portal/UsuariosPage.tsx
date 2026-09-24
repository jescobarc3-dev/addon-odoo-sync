'use client';

import {
  Stack, Group, Text, Button, Badge, Switch, Card, Box,
  Modal, MultiSelect, Skeleton, Tooltip, ActionIcon, TextInput, PasswordInput,
} from '@mantine/core';
import { IconEdit, IconUsers, IconPlus, IconKey, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  useGetPortalUsuariosQuery,
  useGetPermisosDisponiblesQuery,
  useSyncOdooUsuariosMutation,
  useCrearUsuarioMutation,
  useActualizarPermisosMutation,
  useCambiarPasswordMutation,
  useToggleActivoUsuarioMutation,
  PortalUsuarioAdmin,
} from '@/store/api/portalApi';

const COLOR_PERMISO: Record<string, string> = {
  'integracion-sap:read': 'ptSlate',
  'integracion-sap:mapear': 'ptAmber',
  'integracion-sap:revisar': 'ptAmber',
  admin: 'ptRed',
};

function FmtFecha({ iso }: { iso: string | null }) {
  if (!iso) return <Text size="xs" c="#71717A">—</Text>;
  return (
    <Text size="xs" c="#71717A">
      {new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
    </Text>
  );
}

export function UsuariosPage() {
  const { data: usuarios = [], isLoading } = useGetPortalUsuariosQuery();
  const { data: permisosData } = useGetPermisosDisponiblesQuery();
  const [syncOdoo, { isLoading: syncing }] = useSyncOdooUsuariosMutation();
  const [crearUsuario, { isLoading: creando }] = useCrearUsuarioMutation();
  const [actualizarPermisos] = useActualizarPermisosMutation();
  const [cambiarPassword] = useCambiarPasswordMutation();
  const [toggleActivo] = useToggleActivoUsuarioMutation();

  const [modalCrear, setModalCrear] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [nuevosPermisos, setNuevosPermisos] = useState<string[]>(['integracion-sap:read']);

  const [editando, setEditando] = useState<PortalUsuarioAdmin | null>(null);
  const [permisosDraft, setPermisosDraft] = useState<string[]>([]);

  const [cambioPassword, setCambioPassword] = useState<PortalUsuarioAdmin | null>(null);
  const [nuevoPasswordCambio, setNuevoPasswordCambio] = useState('');

  const permisosOpts = (permisosData?.permisos ?? []).map((p) => ({ value: p, label: p }));

  const handleSync = async () => {
    try {
      const res = await syncOdoo().unwrap();
      notifications.show({
        title: 'Sincronización completada',
        message: `${res.nuevos} nuevos, ${res.actualizados} actualizados (total Odoo: ${res.total})`,
        color: 'green',
      });
    } catch (e: any) {
      notifications.show({ title: 'Error al sincronizar', message: e?.data?.message ?? 'Error', color: 'red' });
    }
  };

  const handleCrear = async () => {
    if (!nuevoNombre.trim() || !nuevoEmail.trim() || !nuevoPassword.trim()) {
      notifications.show({ title: 'Campos requeridos', message: 'Completa todos los campos', color: 'red' });
      return;
    }
    try {
      await crearUsuario({ nombre: nuevoNombre, email: nuevoEmail, password: nuevoPassword, permisos: nuevosPermisos }).unwrap();
      notifications.show({ title: 'Usuario creado', message: nuevoEmail, color: 'green' });
      setModalCrear(false);
      setNuevoNombre(''); setNuevoEmail(''); setNuevoPassword(''); setNuevosPermisos(['integracion-sap:read']);
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e?.data?.message ?? 'No se pudo crear el usuario', color: 'red' });
    }
  };

  const abrirEditar = (u: PortalUsuarioAdmin) => {
    setEditando(u);
    setPermisosDraft(u.permisos);
  };

  const handleGuardarPermisos = async () => {
    if (!editando) return;
    try {
      await actualizarPermisos({ id: editando.id, permisos: permisosDraft }).unwrap();
      notifications.show({ title: 'Permisos actualizados', message: editando.nombre, color: 'green' });
      setEditando(null);
    } catch {
      notifications.show({ title: 'Error', message: 'No se pudieron guardar los permisos', color: 'red' });
    }
  };

  const handleCambiarPassword = async () => {
    if (!cambioPassword || !nuevoPasswordCambio.trim()) return;
    try {
      await cambiarPassword({ id: cambioPassword.id, password: nuevoPasswordCambio }).unwrap();
      notifications.show({ title: 'Contraseña actualizada', message: cambioPassword.nombre, color: 'green' });
      setCambioPassword(null);
      setNuevoPasswordCambio('');
    } catch {
      notifications.show({ title: 'Error', message: 'No se pudo cambiar la contraseña', color: 'red' });
    }
  };

  const handleToggle = async (u: PortalUsuarioAdmin) => {
    try {
      await toggleActivo({ id: u.id, activo: !u.activo }).unwrap();
    } catch {
      notifications.show({ title: 'Error', message: 'No se pudo actualizar', color: 'red' });
    }
  };

  const activos = usuarios.filter((u) => u.activo).length;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Text fw={700} size="lg" c="#18181B">Usuarios del portal</Text>
          <Text size="sm" c="#71717A">Gestión de acceso y permisos</Text>
        </Box>
        <Group gap="xs">
          <Button leftSection={<IconRefresh size={15} />} loading={syncing} onClick={handleSync} variant="default" size="sm">
            Sincronizar desde Odoo
          </Button>
          <Button leftSection={<IconPlus size={15} />} onClick={() => setModalCrear(true)} color="ptSlate" size="sm">
            Crear usuario
          </Button>
        </Group>
      </Group>

      <Group gap="md">
        <Card withBorder p="md" style={{ background: '#fff', minWidth: 140 }}>
          <Text size="xs" fw={600} tt="uppercase" c="#71717A">Total</Text>
          <Text size="28px" fw={800} c="#18181B" lh={1}>{usuarios.length}</Text>
        </Card>
        <Card withBorder p="md" style={{ background: '#F0FDF4', minWidth: 140 }}>
          <Text size="xs" fw={600} tt="uppercase" c="#71717A">Activos</Text>
          <Text size="28px" fw={800} c="#166534" lh={1}>{activos}</Text>
        </Card>
        <Card withBorder p="md" style={{ background: '#FFF7ED', minWidth: 140 }}>
          <Text size="xs" fw={600} tt="uppercase" c="#71717A">Inactivos</Text>
          <Text size="28px" fw={800} c="#92400E" lh={1}>{usuarios.length - activos}</Text>
        </Card>
      </Group>

      <Card withBorder p={0} style={{ background: '#fff', overflow: 'hidden' }}>
        {isLoading ? (
          <Stack p="md" gap="sm">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={44} radius="sm" />)}
          </Stack>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E4E4E7' }}>
                {['Usuario', 'Correo', 'Permisos', 'Último acceso', 'Activo', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #F4F4F5' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <Group gap={8}>
                      <Box style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: u.activo ? '#1A365D' : '#E4E4E7',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Text size="xs" fw={700} c={u.activo ? 'white' : '#71717A'}>
                          {u.nombre.substring(0, 2).toUpperCase()}
                        </Text>
                      </Box>
                      <Text size="sm" fw={600} c="#18181B">{u.nombre}</Text>
                    </Group>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Text size="xs" c="#71717A" ff="monospace">{u.odooLogin}</Text>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Group gap={4} wrap="wrap">
                      {u.permisos.length === 0
                        ? <Text size="xs" c="#A1A1AA">Sin permisos</Text>
                        : u.permisos.map((p) => (
                          <Badge key={p} size="xs" color={COLOR_PERMISO[p] ?? 'gray'} variant="light">
                            {p.replace('integracion-sap:', '')}
                          </Badge>
                        ))}
                    </Group>
                  </td>
                  <td style={{ padding: '10px 14px' }}><FmtFecha iso={u.ultimoLogin} /></td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <Switch checked={u.activo} onChange={() => handleToggle(u)} color="ptGreen" size="sm" />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Group gap={4}>
                      <Tooltip label="Editar permisos">
                        <ActionIcon variant="subtle" color="gray" onClick={() => abrirEditar(u)}>
                          <IconEdit size={15} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Cambiar contraseña">
                        <ActionIcon variant="subtle" color="gray" onClick={() => { setCambioPassword(u); setNuevoPasswordCambio(''); }}>
                          <IconKey size={15} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0' }}>
                    <Stack align="center" gap="xs">
                      <IconUsers size={32} color="#D4D4D8" />
                      <Text c="#A1A1AA" size="sm">Sin usuarios. Crea el primero con el botón de arriba.</Text>
                    </Stack>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      {/* Modal: crear usuario */}
      <Modal opened={modalCrear} onClose={() => setModalCrear(false)} title="Crear usuario" size="md">
        <Stack gap="md">
          <TextInput label="Nombre" placeholder="Juan Pérez" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.currentTarget.value)} />
          <TextInput label="Correo" placeholder="juan@empresa.com" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.currentTarget.value)} />
          <PasswordInput label="Contraseña" placeholder="Mínimo 8 caracteres" value={nuevoPassword} onChange={(e) => setNuevoPassword(e.currentTarget.value)} />
          <MultiSelect
            label="Permisos"
            data={permisosOpts}
            value={nuevosPermisos}
            onChange={setNuevosPermisos}
            placeholder="Selecciona permisos…"
            size="sm"
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setModalCrear(false)}>Cancelar</Button>
            <Button color="ptSlate" size="sm" loading={creando} onClick={handleCrear}>Crear</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: editar permisos */}
      <Modal opened={!!editando} onClose={() => setEditando(null)} title={`Permisos — ${editando?.nombre}`} size="md">
        <Stack gap="md">
          <MultiSelect
            label="Permisos asignados"
            data={permisosOpts}
            value={permisosDraft}
            onChange={setPermisosDraft}
            placeholder="Selecciona permisos…"
            size="sm"
          />
          <Text size="xs" c="#A1A1AA">
            <strong>read</strong> — ver cola, dashboard y documentos<br />
            <strong>mapear</strong> — crear/editar mapeos de artículos y bodegas<br />
            <strong>revisar</strong> — resolver errores y reprocesar<br />
            <strong>admin</strong> — gestionar usuarios del portal
          </Text>
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button color="ptSlate" size="sm" onClick={handleGuardarPermisos}>Guardar permisos</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: cambiar contraseña */}
      <Modal opened={!!cambioPassword} onClose={() => setCambioPassword(null)} title={`Cambiar contraseña — ${cambioPassword?.nombre}`} size="sm">
        <Stack gap="md">
          <PasswordInput
            label="Nueva contraseña"
            placeholder="Mínimo 8 caracteres"
            value={nuevoPasswordCambio}
            onChange={(e) => setNuevoPasswordCambio(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setCambioPassword(null)}>Cancelar</Button>
            <Button color="ptSlate" size="sm" onClick={handleCambiarPassword}>Guardar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
