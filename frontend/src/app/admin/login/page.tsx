'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Card, TextInput, PasswordInput, Button, Title, Text,
  PinInput, Collapse, Alert, Stack,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

const API = '';

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [needTotp, setNeedTotp] = useState(false);
  const [totp, setTotp] = useState('');

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Email inválido'),
      password: (v) => (v.length >= 8 ? null : 'Mínimo 8 caracteres'),
    },
  });

  async function handleSubmit(values: typeof form.values) {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          ...(needTotp && totp.length === 6 ? { totpCode: totp } : {}),
        }),
      });

      if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        if (body?.message?.includes('TOTP')) {
          setNeedTotp(true);
          notifications.show({
            color: 'yellow',
            title: 'Verificación 2FA requerida',
            message: 'Ingresa el código de tu aplicación autenticadora',
          });
          setLoading(false);
          return;
        }
        form.setErrors({ password: 'Credenciales inválidas' });
        setLoading(false);
        return;
      }

      if (res.status === 429) {
        notifications.show({
          color: 'red',
          title: 'Demasiados intentos',
          message: 'Espera 60 segundos antes de intentar de nuevo',
        });
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error('Error inesperado');

      router.push('/admin/configuracion');
    } catch {
      notifications.show({ color: 'red', title: 'Error', message: 'No se pudo conectar al servidor' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: '#0A0A0A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Dot grid background */}
      <Box
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, #222 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.5,
        }}
      />
      {/* Red glow */}
      <Box
        style={{
          position: 'absolute',
          top: '30%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 400,
          background: 'radial-gradient(ellipse, rgba(139,26,26,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Card
        style={{
          position: 'relative', zIndex: 1,
          width: 400, padding: 40,
          background: 'rgba(15,15,15,0.92)',
          border: '1px solid rgba(139,26,26,0.35)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 0 60px rgba(139,26,26,0.12)',
        }}
        radius="md"
      >
        {/* PT Logo placeholder */}
        <Box style={{ textAlign: 'center', marginBottom: 28 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="#8B1A1A" strokeWidth="2" />
            <line x1="24" y1="2" x2="24" y2="46" stroke="#8B1A1A" strokeWidth="1.5" />
            <line x1="2" y1="24" x2="46" y2="24" stroke="#8B1A1A" strokeWidth="1.5" />
            <circle cx="24" cy="24" r="4" fill="#8B1A1A" />
          </svg>
          <Title order={2} style={{ color: '#fff', marginTop: 12, fontSize: 18, letterSpacing: 1 }}>
            PROTECCIÓN TOTAL
          </Title>
          <Text size="xs" style={{ color: '#555', marginTop: 4, textTransform: 'uppercase', letterSpacing: 2 }}>
            Panel de Administración
          </Text>
        </Box>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Email"
              placeholder="admin@protecciontotal.com.gt"
              styles={{
                label: { color: '#888', fontSize: 12 },
                input: { background: '#111', border: '1px solid #2a2a2a', color: '#fff' },
              }}
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Contraseña"
              placeholder="••••••••"
              styles={{
                label: { color: '#888', fontSize: 12 },
                input: { background: '#111', border: '1px solid #2a2a2a', color: '#fff' },
              }}
              {...form.getInputProps('password')}
            />

            <Collapse in={needTotp}>
              <Stack gap="xs">
                <Text size="xs" style={{ color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Código 2FA (TOTP)
                </Text>
                <PinInput
                  length={6}
                  value={totp}
                  onChange={setTotp}
                  type="number"
                  size="md"
                  styles={{
                    input: { background: '#111', border: '1px solid rgba(139,26,26,0.4)', color: '#fff' },
                  }}
                />
              </Stack>
            </Collapse>

            <Button
              type="submit"
              fullWidth
              loading={loading}
              style={{ marginTop: 8, background: '#8B1A1A' }}
            >
              Iniciar sesión
            </Button>

            <Alert
              color="dark"
              style={{ background: '#111', border: '1px solid #1e1e1e' }}
              p="xs"
            >
              <Text size="xs" style={{ color: '#444' }}>
                Máximo 5 intentos por minuto. Acceso restringido a personal autorizado.
              </Text>
            </Alert>
          </Stack>
        </form>
      </Card>
    </Box>
  );
}
