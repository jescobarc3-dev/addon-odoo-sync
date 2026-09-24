'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Box, Card, Title, Text, Button, Badge, Group, Stack, Modal,
  TextInput, PasswordInput, Loader, Tooltip, PinInput,
  SimpleGrid, Divider, Image,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

const API = '';

interface Conexion {
  id: string;
  nombre: string;
  odooUrl: string;
  odooDB: string;
  odooUser: string;
  activa: boolean;
  versionOdoo: string | null;
  ultimoTest: string | null;
  ultimoTestOk: boolean | null;
}

function EstadoBadge({ ok }: { ok: boolean | null }) {
  if (ok === null) return <Badge color="gray">Sin probar</Badge>;
  return ok ? (
    <Badge color="green" leftSection={<span className="pulse-dot-green" />}>Conectado</Badge>
  ) : (
    <Badge color="red">Error</Badge>
  );
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `HTTP ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export default function ConfiguracionPage() {
  const router = useRouter();
  const [conexiones, setConexiones] = useState<Conexion[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string; rol: string; totpActivo: boolean } | null>(null);

  // Estado TOTP
  const [totpModal, { open: openTotp, close: closeTotp }] = useDisclosure(false);
  const [totpDesactivarModal, { open: openDesactivar, close: closeDesactivar }] = useDisclosure(false);
  const [totpQr, setTotpQr] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpDesactivarCode, setTotpDesactivarCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

  const form = useForm({
    initialValues: { nombre: '', odooUrl: '', odooDB: '', odooUser: '', odooPassword: '' },
    validate: {
      nombre: (v) => (v.length > 0 ? null : 'Requerido'),
      odooUrl: (v) => (v.startsWith('http') ? null : 'URL inválida'),
      odooDB: (v) => (v.length > 0 ? null : 'Requerido'),
      odooUser: (v) => (v.length > 0 ? null : 'Requerido'),
      odooPassword: (v, vals) => (!editando && v.length < 1 ? 'Requerido al crear' : null),
    },
  });

  const cargarConexiones = useCallback(async () => {
    try {
      const data = await apiFetch('/admin/config/odoo');
      setConexiones(data);
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') router.push('/admin/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    apiFetch('/admin/auth/me')
      .then(setUser)
      .catch(() => router.push('/admin/login'));
    cargarConexiones();
    const interval = setInterval(cargarConexiones, 30000);
    return () => clearInterval(interval);
  }, [cargarConexiones, router]);

  async function logout() {
    await fetch(`${API}/api/admin/auth/logout`, { method: 'POST', credentials: 'include' });
    router.push('/admin/login');
  }

  async function iniciarSetupTotp() {
    setTotpLoading(true);
    setTotpCode('');
    setTotpQr(null);
    try {
      const data = await apiFetch('/admin/auth/setup-totp', { method: 'POST' });
      setTotpQr(data);
      openTotp();
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Error', message: e.message });
    } finally {
      setTotpLoading(false);
    }
  }

  async function confirmarTotp() {
    if (totpCode.length !== 6) return;
    setTotpLoading(true);
    try {
      await apiFetch('/admin/auth/confirmar-totp', {
        method: 'POST',
        body: JSON.stringify({ code: totpCode }),
      });
      notifications.show({ color: 'green', title: '2FA activado', message: 'El doble factor quedó habilitado en tu cuenta' });
      closeTotp();
      setTotpQr(null);
      setTotpCode('');
      const me = await apiFetch('/admin/auth/me');
      setUser(me);
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Código incorrecto', message: e.message });
    } finally {
      setTotpLoading(false);
    }
  }

  async function desactivarTotp() {
    if (totpDesactivarCode.length !== 6) return;
    setTotpLoading(true);
    try {
      await apiFetch('/admin/auth/desactivar-totp', {
        method: 'POST',
        body: JSON.stringify({ code: totpDesactivarCode }),
      });
      notifications.show({ color: 'yellow', message: '2FA desactivado' });
      closeDesactivar();
      setTotpDesactivarCode('');
      const me = await apiFetch('/admin/auth/me');
      setUser(me);
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Error', message: e.message });
    } finally {
      setTotpLoading(false);
    }
  }

  async function testConexion(id: string) {
    setTestingId(id);
    try {
      const res = await apiFetch(`/admin/config/odoo/${id}/test`, { method: 'POST' });
      if (res.ok) {
        notifications.show({ color: 'green', title: 'Conexión exitosa', message: `Odoo ${res.version || ''}` });
      } else {
        notifications.show({ color: 'red', title: 'Error de conexión', message: res.error });
      }
      await cargarConexiones();
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Error', message: e.message });
    } finally {
      setTestingId(null);
    }
  }

  async function eliminarConexion(id: string) {
    if (!confirm('¿Eliminar esta conexión?')) return;
    try {
      await apiFetch(`/admin/config/odoo/${id}`, { method: 'DELETE' });
      notifications.show({ color: 'green', message: 'Conexión eliminada' });
      await cargarConexiones();
    } catch (e: any) {
      notifications.show({ color: 'red', message: e.message });
    }
  }

  async function handleSubmit(values: typeof form.values) {
    try {
      if (editando) {
        await apiFetch(`/admin/config/odoo/${editando}`, {
          method: 'PUT',
          body: JSON.stringify(values),
        });
        notifications.show({ color: 'green', message: 'Conexión actualizada' });
      } else {
        await apiFetch('/admin/config/odoo', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        notifications.show({ color: 'green', message: 'Conexión creada con cifrado AES-256-GCM' });
      }
      close();
      form.reset();
      setEditando(null);
      await cargarConexiones();
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Error', message: e.message });
    }
  }

  function abrirNueva() {
    setEditando(null);
    form.reset();
    open();
  }

  const conectadas = conexiones.filter((c) => c.ultimoTestOk === true).length;
  const conError = conexiones.filter((c) => c.ultimoTestOk === false).length;

  return (
    <Box style={{ minHeight: '100vh', background: '#0A0A0A', padding: 32 }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .pulse-green { display:inline-block;width:8px;height:8px;borderRadius:50%;background:#22c55e;animation:pulse 2s infinite;marginRight:6px; }
      `}</style>

      {/* Header */}
      <Group justify="space-between" mb={32}>
        <Group gap="sm">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="#8B1A1A" strokeWidth="2" />
            <line x1="24" y1="2" x2="24" y2="46" stroke="#8B1A1A" strokeWidth="1.5" />
            <line x1="2" y1="24" x2="46" y2="24" stroke="#8B1A1A" strokeWidth="1.5" />
            <circle cx="24" cy="24" r="4" fill="#8B1A1A" />
          </svg>
          <Box>
            <Title order={3} style={{ color: '#fff', fontSize: 16, letterSpacing: 0.5 }}>
              Protección Total — Panel Seguro
            </Title>
            <Text size="xs" style={{ color: '#555' }}>
              {user ? `${user.email} · ${user.rol}` : 'Cargando...'}
            </Text>
          </Box>
        </Group>
        <Group gap="xs">
          <Link href="/admin/usuarios">
            <Button variant="subtle" color="gray" size="xs">
              Usuarios
            </Button>
          </Link>
          <Link href="/portal/login">
            <Button variant="subtle" color="gray" size="xs">
              Ir al portal →
            </Button>
          </Link>
          <Button variant="subtle" color="gray" size="xs" onClick={logout}>
            Cerrar sesión
          </Button>
        </Group>
      </Group>

      {/* Guía de primer acceso */}
      <Card style={{ background: '#111', border: '1px solid #8B1A1A33', marginBottom: 24 }} p="md" radius="sm">
        <Text size="xs" style={{ color: '#8B1A1A', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 12 }}>
          Guía de primer acceso
        </Text>
        <Stack gap={8}>
          {[
            { n: '1', txt: 'Configura la conexión de Odoo aquí abajo y pruébala.' },
            { n: '2', txt: 'Ve a "Usuarios" (nav arriba) → "Sincronizar desde Odoo" para importar todas las cuentas.' },
            { n: '3', txt: 'Encuéntrate en la lista → activa tu cuenta → edita permisos y agrégale "admin" (y los demás que necesites).' },
            { n: '4', txt: 'Haz clic en "Ir al portal →" e ingresa con tus credenciales de Odoo. Eso es todo.' },
          ].map(({ n, txt }) => (
            <Group key={n} gap={10} wrap="nowrap">
              <Box style={{ width: 22, height: 22, borderRadius: '50%', background: '#8B1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text size="xs" style={{ color: '#fff', fontWeight: 700, lineHeight: 1 }}>{n}</Text>
              </Box>
              <Text size="xs" style={{ color: '#aaa' }}>{txt}</Text>
            </Group>
          ))}
        </Stack>
      </Card>

      {/* Métricas rápidas */}
      <SimpleGrid cols={3} mb={24}>
        <Card style={{ background: '#111', border: '1px solid #1e1e1e' }} p="md" radius="sm">
          <Text size="xs" style={{ color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
            Total conexiones
          </Text>
          <Title order={2} style={{ color: '#fff', marginTop: 4 }}>{conexiones.length}</Title>
        </Card>
        <Card style={{ background: '#111', border: '1px solid #1a3a1a' }} p="md" radius="sm">
          <Text size="xs" style={{ color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
            Conectadas
          </Text>
          <Title order={2} style={{ color: '#22c55e', marginTop: 4 }}>{conectadas}</Title>
        </Card>
        <Card style={{ background: '#111', border: '1px solid #3a1a1a' }} p="md" radius="sm">
          <Text size="xs" style={{ color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
            Con error
          </Text>
          <Title order={2} style={{ color: conError > 0 ? '#ef4444' : '#555', marginTop: 4 }}>
            {conError}
          </Title>
        </Card>
      </SimpleGrid>

      {/* Encabezado sección */}
      <Group justify="space-between" mb={16}>
        <Title order={4} style={{ color: '#ccc', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
          Conexiones Odoo
        </Title>
        {user?.rol === 'SUPERADMIN' && (
          <Button
            size="xs"
            style={{ background: '#8B1A1A' }}
            onClick={abrirNueva}
          >
            + Nueva conexión
          </Button>
        )}
      </Group>

      {/* Lista de conexiones */}
      {loading ? (
        <Box style={{ textAlign: 'center', paddingTop: 60 }}>
          <Loader color="#8B1A1A" size="sm" />
        </Box>
      ) : conexiones.length === 0 ? (
        <Card style={{ background: '#111', border: '1px solid #1e1e1e', textAlign: 'center' }} p={40}>
          <Text style={{ color: '#444' }}>No hay conexiones configuradas.</Text>
          {user?.rol === 'SUPERADMIN' && (
            <Button size="xs" style={{ background: '#8B1A1A', marginTop: 16 }} onClick={abrirNueva}>
              Configurar primera conexión
            </Button>
          )}
        </Card>
      ) : (
        <Stack gap="sm">
          {conexiones.map((c) => (
            <Card
              key={c.id}
              style={{ background: '#111', border: '1px solid #1e1e1e' }}
              p="md"
              radius="sm"
            >
              <Group justify="space-between" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs" mb={4}>
                    <Text style={{ color: '#fff', fontWeight: 600 }}>{c.nombre}</Text>
                    <EstadoBadge ok={c.ultimoTestOk} />
                    {c.versionOdoo && (
                      <Badge variant="outline" color="gray" size="xs">
                        Odoo {c.versionOdoo}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" style={{ color: '#555' }}>
                    {c.odooUrl} · DB: {c.odooDB} · Usuario: {c.odooUser}
                  </Text>
                  {c.ultimoTest && (
                    <Text size="xs" style={{ color: '#333', marginTop: 2 }}>
                      Último test: {new Date(c.ultimoTest).toLocaleString('es-GT')}
                    </Text>
                  )}
                </Box>
                <Group gap="xs">
                  <Tooltip label="Probar conexión">
                    <Button
                      size="xs"
                      variant="outline"
                      color="gray"
                      loading={testingId === c.id}
                      onClick={() => testConexion(c.id)}
                    >
                      Probar
                    </Button>
                  </Tooltip>
                  {user?.rol === 'SUPERADMIN' && (
                    <>
                      <Tooltip label="Editar">
                        <Button
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={() => {
                            setEditando(c.id);
                            form.setValues({
                              nombre: c.nombre,
                              odooUrl: c.odooUrl,
                              odooDB: c.odooDB,
                              odooUser: c.odooUser,
                              odooPassword: '',
                            });
                            open();
                          }}
                        >
                          Editar
                        </Button>
                      </Tooltip>
                      <Tooltip label="Eliminar">
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => eliminarConexion(c.id)}
                        >
                          Eliminar
                        </Button>
                      </Tooltip>
                    </>
                  )}
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {/* Sección 2FA */}
      <Title order={4} style={{ color: '#ccc', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, marginTop: 40, marginBottom: 16 }}>
        Seguridad de cuenta
      </Title>
      <Card style={{ background: '#111', border: '1px solid #1e1e1e' }} p="md" radius="sm">
        <Group justify="space-between" wrap="nowrap">
          <Box>
            <Group gap="xs" mb={4}>
              <Text style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
                Autenticación de dos factores (TOTP)
              </Text>
              {user?.totpActivo ? (
                <Badge color="green" size="sm">Activo</Badge>
              ) : (
                <Badge color="gray" size="sm">Inactivo</Badge>
              )}
            </Group>
            <Text size="xs" style={{ color: '#555' }}>
              {user?.totpActivo
                ? 'Tu cuenta requiere un código de 6 dígitos al iniciar sesión.'
                : 'Agrega una capa extra de seguridad con Google Authenticator o Authy.'}
            </Text>
          </Box>
          <Group gap="xs">
            {user?.totpActivo ? (
              <Button size="xs" variant="outline" color="red" onClick={openDesactivar}>
                Desactivar 2FA
              </Button>
            ) : (
              <Button
                size="xs"
                style={{ background: '#8B1A1A' }}
                loading={totpLoading}
                onClick={iniciarSetupTotp}
              >
                Configurar 2FA
              </Button>
            )}
          </Group>
        </Group>
      </Card>

      {/* Nota de seguridad */}
      <Card
        style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', marginTop: 32 }}
        p="sm"
        radius="sm"
      >
        <Group gap="xs">
          <Text size="xs" style={{ color: '#333' }}>
            Las contraseñas se almacenan cifradas con AES-256-GCM.
            Nunca se transmiten en texto plano ni se muestran en la UI.
            Sesión JWT httpOnly · 15 min de expiración · Rate limit 5/min.
          </Text>
        </Group>
      </Card>

      {/* Modal setup TOTP */}
      <Modal
        opened={totpModal}
        onClose={() => { closeTotp(); setTotpQr(null); setTotpCode(''); }}
        title={
          <Group gap="xs">
            <Text style={{ color: '#fff', fontWeight: 600 }}>Configurar autenticación 2FA</Text>
            <Badge size="xs" color="red">TOTP</Badge>
          </Group>
        }
        styles={{
          content: { background: '#111', border: '1px solid rgba(139,26,26,0.3)' },
          header: { background: '#111', borderBottom: '1px solid #1e1e1e' },
          title: { color: '#fff' },
          close: { color: '#555' },
        }}
      >
        <Stack gap="md" mt="xs">
          <Text size="sm" style={{ color: '#aaa' }}>
            Escanea el código QR con Google Authenticator, Authy o cualquier app TOTP compatible.
          </Text>
          {totpQr && (
            <Box style={{ textAlign: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={totpQr.qrCodeDataUrl}
                alt="QR TOTP"
                style={{ display: 'inline-block', borderRadius: 8, background: '#fff', padding: 8 }}
              />
            </Box>
          )}
          {totpQr && (
            <Box style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px' }}>
              <Text size="xs" style={{ color: '#555', marginBottom: 4 }}>Clave secreta (backup manual)</Text>
              <Text size="xs" style={{ color: '#888', fontFamily: 'monospace', letterSpacing: 2, wordBreak: 'break-all' }}>
                {totpQr.secret}
              </Text>
            </Box>
          )}
          <Divider style={{ borderColor: '#1e1e1e' }} />
          <Text size="xs" style={{ color: '#888' }}>
            Ingresa el código de 6 dígitos que muestra tu app para confirmar la configuración:
          </Text>
          <Box style={{ display: 'flex', justifyContent: 'center' }}>
            <PinInput
              length={6}
              value={totpCode}
              onChange={setTotpCode}
              type="number"
              size="md"
              styles={{
                input: { background: '#0a0a0a', border: '1px solid rgba(139,26,26,0.4)', color: '#fff' },
              }}
            />
          </Box>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => { closeTotp(); setTotpQr(null); setTotpCode(''); }}>
              Cancelar
            </Button>
            <Button
              style={{ background: '#8B1A1A' }}
              disabled={totpCode.length !== 6}
              loading={totpLoading}
              onClick={confirmarTotp}
            >
              Confirmar y activar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal desactivar TOTP */}
      <Modal
        opened={totpDesactivarModal}
        onClose={() => { closeDesactivar(); setTotpDesactivarCode(''); }}
        title={<Text style={{ color: '#fff', fontWeight: 600 }}>Desactivar autenticación 2FA</Text>}
        styles={{
          content: { background: '#111', border: '1px solid rgba(139,26,26,0.3)' },
          header: { background: '#111', borderBottom: '1px solid #1e1e1e' },
          title: { color: '#fff' },
          close: { color: '#555' },
        }}
      >
        <Stack gap="md" mt="xs">
          <Text size="sm" style={{ color: '#aaa' }}>
            Para desactivar el 2FA debes confirmar con un código actual de tu app autenticadora.
          </Text>
          <Box style={{ display: 'flex', justifyContent: 'center' }}>
            <PinInput
              length={6}
              value={totpDesactivarCode}
              onChange={setTotpDesactivarCode}
              type="number"
              size="md"
              styles={{
                input: { background: '#0a0a0a', border: '1px solid rgba(139,26,26,0.4)', color: '#fff' },
              }}
            />
          </Box>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => { closeDesactivar(); setTotpDesactivarCode(''); }}>
              Cancelar
            </Button>
            <Button
              color="red"
              disabled={totpDesactivarCode.length !== 6}
              loading={totpLoading}
              onClick={desactivarTotp}
            >
              Desactivar 2FA
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal nueva/editar conexión */}
      <Modal
        opened={opened}
        onClose={() => { close(); form.reset(); setEditando(null); }}
        title={
          <Group gap="xs">
            <Text style={{ color: '#fff', fontWeight: 600 }}>
              {editando ? 'Editar conexión Odoo' : 'Nueva conexión Odoo'}
            </Text>
            <Badge size="xs" color="red">AES-256-GCM</Badge>
          </Group>
        }
        styles={{
          root: {},
          content: { background: '#111', border: '1px solid rgba(139,26,26,0.3)' },
          header: { background: '#111', borderBottom: '1px solid #1e1e1e' },
          title: { color: '#fff' },
          close: { color: '#555' },
        }}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md" mt="xs">
            <TextInput
              label="Nombre de referencia"
              placeholder="Bodega Principal PT"
              styles={{ label: { color: '#888', fontSize: 12 }, input: { background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#fff' } }}
              {...form.getInputProps('nombre')}
            />
            <TextInput
              label="URL de Odoo"
              placeholder="https://odoo.empresa.com"
              styles={{ label: { color: '#888', fontSize: 12 }, input: { background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#fff' } }}
              {...form.getInputProps('odooUrl')}
            />
            <SimpleGrid cols={2}>
              <TextInput
                label="Base de datos"
                placeholder="bodega_pt"
                styles={{ label: { color: '#888', fontSize: 12 }, input: { background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#fff' } }}
                {...form.getInputProps('odooDB')}
              />
              <TextInput
                label="Usuario"
                placeholder="admin"
                styles={{ label: { color: '#888', fontSize: 12 }, input: { background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#fff' } }}
                {...form.getInputProps('odooUser')}
              />
            </SimpleGrid>
            <PasswordInput
              label={editando ? 'Nueva contraseña (vacío = sin cambiar)' : 'Contraseña'}
              placeholder="••••••••"
              styles={{ label: { color: '#888', fontSize: 12 }, input: { background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#fff' } }}
              {...form.getInputProps('odooPassword')}
            />
            <Text size="xs" style={{ color: '#333' }}>
              La contraseña se cifra con AES-256-GCM antes de guardarse en base de datos.
            </Text>
            <Group justify="flex-end" mt="xs">
              <Button variant="subtle" color="gray" onClick={() => { close(); form.reset(); setEditando(null); }}>
                Cancelar
              </Button>
              <Button type="submit" style={{ background: '#8B1A1A' }}>
                {editando ? 'Guardar cambios' : 'Crear conexión'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Box>
  );
}
