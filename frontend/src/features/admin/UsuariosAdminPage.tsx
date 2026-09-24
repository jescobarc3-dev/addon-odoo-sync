'use client';

import {
  Stack, Group, Text, Button, Badge, Switch, Card, Box,
  Modal, MultiSelect, Skeleton, Tooltip, ActionIcon, TextInput, PasswordInput,
  Title,
} from '@mantine/core';
import { IconEdit, IconUsers, IconPlus, IconKey, IconRefresh } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { notifications } from '@mantine/notifications';
import {
  useGetAdminPortalUsuariosQuery,
  useGetAdminPermisosDisponiblesQuery,
  useAdminSyncOdooUsuariosMutation,
  useAdminCrearUsuarioMutation,
  useAdminActualizarPermisosMutation,
  useAdminCambiarPasswordMutation,
  useAdminToggleActivoUsuarioMutation,
  PortalUsuarioAdmin,
} from '@/store/api/adminApi';

const COLOR_PERMISO: Record<string, string> = {
  'integracion-sap:read': 'blue',
  'integracion-sap:cargar': 'cyan',
  'integracion-sap:mapear': 'yellow',
  'integracion-sap:revisar': 'orange',
  admin: 'red',
};

function FmtFecha({ iso }: { iso: string | null }) {
  if (!iso) return <Text size="xs" c="#71717A">—</Text>;
  return (
    <Text size="xs" c="#71717A">
      {new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
    </Text>
  );
}

export function UsuariosAdminPage() {
  const router = useRouter();
  const { data: usuarios = [], isLoading } = useGetAdminPortalUsuariosQuery();
  const { data: permisosData } = useGetAdminPermisosDisponiblesQuery();
  const [syncOdoo, { isLoading: syncing }] = useAdminSyncOdooUsuariosMutation();
  const [crearUsuario, { isLoading: creando }] = useAdminCrearUsuarioMutation();
  const [actualizarPermisos] = useAdminActualizarPermisosMutation();
  const [cambiarPassword] = useAdminCambiarPasswordMutation();
  const [toggleActivo] = useAdminToggleActivoUsuarioMutation();

  const [user, setUser] = useState<{ email: string; rol: string } | null>(null);

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

  useEffect(() => {
    fetch('/api/admin/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setUser)
      .catch(() => router.push('/admin/login'));
  }, [router]);

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/admin/login');
  }

  const handleSync = async () => {
    try {
      const res = await syncOdoo().unwrap();
      notifications.show({
        title: 'Sincronización completada',
        message: `${res.nuevos} nuevos, ${res.actualizados} actualizados de ${res.total} en Odoo`,
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
    <Box style={{ minHeight: '100vh', background: '#0A0A0A' }}>
      {/* Header */}
      <Box style={{ background: '#0A0A0A', borderBottom: '1px solid #1e1e1e', padding: '16px 32px' }}>
        <Group justify="space-between">
          <Group gap="sm">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="#8B1A1A" strokeWidth="2" />
              <line x1="24" y1="2" x2="24" y2="46" stroke="#8B1A1A" strokeWidth="1.5" />
              <line x1="2" y1="24" x2="46" y2="24" stroke="#8B1A1A" strokeWidth="1.5" />
              <circle cx="24" cy="24" r="4" fill="#8B1A1A" />
            </svg>
            <Box>
              <Title order={3} style={{ color: '#fff', fontSize: 15, letterSpacing: 0.5 }}>
                Protección Total — Usuarios del portal
              </Title>
              <Text size="xs" style={{ color: '#555' }}>
                {user ? `${user.email} · ${user.rol}` : 'Cargando...'}
              </Text>
            </Box>
          </Group>
          <Group gap="xs">
            <Link href="/admin/configuracion">
              <Button variant="subtle" color="gray" size="xs">Configuración</Button>
            </Link>
            <Link href="/portal/login">
              <Button variant="subtle" color="gray" size="xs">Ir al portal →</Button>
            </Link>
            <Button variant="subtle" color="gray" size="xs" onClick={logout}>
              Cerrar sesión
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Contenido */}
      <Box p={32}>
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start">
            <Box>
              <Text fw={700} size="lg" style={{ color: '#fff' }}>Usuarios del portal</Text>
              <Text size="sm" style={{ color: '#666' }}>Sincroniza desde Odoo, activa cuentas y asigna permisos</Text>
            </Box>
            <Group gap="xs">
              <Button
                leftSection={<IconRefresh size={15} />}
                loading={syncing}
                onClick={handleSync}
                variant="outline"
                color="gray"
                size="sm"
              >
                Sincronizar desde Odoo
              </Button>
              <Button
                leftSection={<IconPlus size={15} />}
                onClick={() => setModalCrear(true)}
                style={{ background: '#8B1A1A' }}
                size="sm"
              >
                Crear usuario
              </Button>
            </Group>
          </Group>

          <Group gap="md">
            {[
              { label: 'Total', value: usuarios.length, color: '#fff', bg: '#111' },
              { label: 'Activos', value: activos, color: '#22c55e', bg: '#0d1f0d' },
              { label: 'Inactivos', value: usuarios.length - activos, color: '#f59e0b', bg: '#1a1500' },
            ].map(({ label, value, color, bg }) => (
              <Card key={label} withBorder={false} p="md" style={{ background: bg, border: '1px solid #1e1e1e', minWidth: 120 }}>
                <Text size="xs" fw={600} tt="uppercase" style={{ color: '#555', letterSpacing: 1 }}>{label}</Text>
                <Text size="28px" fw={800} style={{ color, lineHeight: 1, marginTop: 4 }}>{value}</Text>
              </Card>
            ))}
          </Group>

          <Card p={0} style={{ background: '#111', border: '1px solid #1e1e1e', overflow: 'hidden' }}>
            {isLoading ? (
              <Stack p="md" gap="sm">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={44} radius="sm" style={{ opacity: 0.3 }} />)}
              </Stack>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0a0a0a', borderBottom: '1px solid #1e1e1e' }}>
                    {['Usuario', 'Correo', 'Permisos', 'Último acceso', 'Activo', ''].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <Group gap={8}>
                          <Box style={{
                            width: 30, height: 30, borderRadius: '50%',
                            background: u.activo ? '#8B1A1A' : '#2a2a2a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <Text size="xs" fw={700} style={{ color: u.activo ? '#fff' : '#555' }}>
                              {u.nombre.substring(0, 2).toUpperCase()}
                            </Text>
                          </Box>
                          <Text size="sm" fw={600} style={{ color: '#e5e5e5' }}>{u.nombre}</Text>
                        </Group>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <Text size="xs" style={{ color: '#555', fontFamily: 'monospace' }}>{u.odooLogin}</Text>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <Group gap={4} wrap="wrap">
                          {u.permisos.length === 0
                            ? <Text size="xs" style={{ color: '#333' }}>Sin permisos</Text>
                            : u.permisos.map((p) => (
                              <Badge key={p} size="xs" color={COLOR_PERMISO[p] ?? 'gray'} variant="light">
                                {p.replace('integracion-sap:', '')}
                              </Badge>
                            ))}
                        </Group>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <FmtFecha iso={u.ultimoLogin} />
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <Switch
                          checked={u.activo}
                          onChange={() => handleToggle(u)}
                          size="sm"
                          color="red"
                        />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <Group gap={4}>
                          <Tooltip label="Editar permisos">
                            <ActionIcon variant="subtle" color="gray" onClick={() => { setEditando(u); setPermisosDraft(u.permisos); }}>
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
                          <IconUsers size={32} color="#333" />
                          <Text style={{ color: '#555' }} size="sm">
                            Sin usuarios. Usa "Sincronizar desde Odoo" para importarlos.
                          </Text>
                        </Stack>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </Card>
        </Stack>
      </Box>

      {/* Modales */}
      <Modal opened={modalCrear} onClose={() => setModalCrear(false)} title="Crear usuario" size="md"
        styles={{ content: { background: '#111', border: '1px solid #2a2a2a' }, header: { background: '#111' }, title: { color: '#fff' }, close: { color: '#555' } }}>
        <Stack gap="md">
          <TextInput label="Nombre" placeholder="Juan Pérez" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.currentTarget.value)}
            styles={{ label: { color: '#888' }, input: { background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#fff' } }} />
          <TextInput label="Correo" placeholder="juan@empresa.com" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.currentTarget.value)}
            styles={{ label: { color: '#888' }, input: { background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#fff' } }} />
          <PasswordInput label="Contraseña" placeholder="Mínimo 8 caracteres" value={nuevoPassword} onChange={(e) => setNuevoPassword(e.currentTarget.value)}
            styles={{ label: { color: '#888' }, input: { background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#fff' } }} />
          <MultiSelect label="Permisos" data={permisosOpts} value={nuevosPermisos} onChange={setNuevosPermisos} size="sm"
            styles={{ label: { color: '#888' }, input: { background: '#0a0a0a', border: '1px solid #2a2a2a' } }} />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" size="sm" onClick={() => setModalCrear(false)}>Cancelar</Button>
            <Button style={{ background: '#8B1A1A' }} size="sm" loading={creando} onClick={handleCrear}>Crear</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={!!editando} onClose={() => setEditando(null)} title={`Permisos — ${editando?.nombre}`} size="md"
        styles={{ content: { background: '#111', border: '1px solid #2a2a2a' }, header: { background: '#111' }, title: { color: '#fff' }, close: { color: '#555' } }}>
        <Stack gap="md">
          <MultiSelect label="Permisos asignados" data={permisosOpts} value={permisosDraft} onChange={setPermisosDraft} size="sm"
            styles={{ label: { color: '#888' }, input: { background: '#0a0a0a', border: '1px solid #2a2a2a' } }} />
          <Text size="xs" style={{ color: '#555' }}>
            <strong style={{ color: '#888' }}>read</strong> — ver cola, dashboard y documentos<br />
            <strong style={{ color: '#888' }}>cargar</strong> — subir documentos<br />
            <strong style={{ color: '#888' }}>mapear</strong> — crear/editar mapeos de artículos y bodegas<br />
            <strong style={{ color: '#888' }}>revisar</strong> — resolver errores y reprocesar<br />
            <strong style={{ color: '#888' }}>admin</strong> — gestionar usuarios del portal
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" size="sm" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button style={{ background: '#8B1A1A' }} size="sm" onClick={handleGuardarPermisos}>Guardar</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={!!cambioPassword} onClose={() => setCambioPassword(null)} title={`Cambiar contraseña — ${cambioPassword?.nombre}`} size="sm"
        styles={{ content: { background: '#111', border: '1px solid #2a2a2a' }, header: { background: '#111' }, title: { color: '#fff' }, close: { color: '#555' } }}>
        <Stack gap="md">
          <PasswordInput label="Nueva contraseña" placeholder="Mínimo 8 caracteres" value={nuevoPasswordCambio} onChange={(e) => setNuevoPasswordCambio(e.currentTarget.value)}
            styles={{ label: { color: '#888' }, input: { background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#fff' } }} />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" size="sm" onClick={() => setCambioPassword(null)}>Cancelar</Button>
            <Button style={{ background: '#8B1A1A' }} size="sm" onClick={handleCambiarPassword}>Guardar</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
