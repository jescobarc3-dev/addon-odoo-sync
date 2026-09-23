'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Card, TextInput, PasswordInput, Button, Title, Text, Stack, Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { useLoginMutation } from '@/store/api/portalApi';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/integracion-sap/dashboard';
  const errorParam = searchParams.get('error');

  const [login, { isLoading }] = useLoginMutation();

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (v.includes('@') ? null : 'Ingresa tu correo de Odoo'),
      password: (v) => (v.length >= 1 ? null : 'Contraseña requerida'),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await login(values).unwrap();
      router.push(redirect);
    } catch (err: any) {
      const msg = err?.data?.message ?? '';
      if (msg.includes('contactar')) {
        form.setErrors({ password: 'No se pudo conectar con el servidor. Intenta de nuevo.' });
      } else {
        form.setErrors({ password: 'Credenciales inválidas' });
      }
    }
  };

  return (
    <Box style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Dot grid */}
      <Box style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, #222 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        opacity: 0.5,
      }} />
      {/* Red glow */}
      <Box style={{
        position: 'absolute',
        top: '30%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600, height: 400,
        background: 'radial-gradient(ellipse, rgba(139,26,26,0.18) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <Card style={{
        position: 'relative', zIndex: 1,
        width: 420, padding: 40,
        background: 'rgba(15,15,15,0.92)',
        border: '1px solid rgba(139,26,26,0.35)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 0 60px rgba(139,26,26,0.12)',
      }} radius="md">
        {/* Logo */}
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
            Integración SAP → Odoo
          </Text>
        </Box>

        {errorParam === 'enlace_invalido' && (
          <Alert icon={<IconAlertCircle size={14} />} color="red" mb="md" radius="sm"
            style={{ background: '#1a0000', border: '1px solid #4a0000' }}>
            <Text size="xs" style={{ color: '#f87171' }}>
              El enlace de acceso expiró o es inválido. Inicia sesión manualmente.
            </Text>
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Correo Odoo"
              placeholder="usuario@empresa.com"
              autoComplete="off"
              styles={{
                label: { color: '#888', fontSize: 12 },
                input: { background: '#111', border: '1px solid #2a2a2a', color: '#fff' },
              }}
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Contraseña Odoo"
              placeholder="••••••••"
              autoComplete="new-password"
              styles={{
                label: { color: '#888', fontSize: 12 },
                input: { background: '#111', border: '1px solid #2a2a2a', color: '#fff' },
                innerInput: { color: '#fff' },
              }}
              {...form.getInputProps('password')}
            />

            <Button
              type="submit"
              fullWidth
              loading={isLoading}
              style={{ marginTop: 8, background: '#8B1A1A' }}
            >
              Iniciar sesión
            </Button>

            <Alert color="dark" style={{ background: '#111', border: '1px solid #1e1e1e' }} p="xs">
              <Text size="xs" style={{ color: '#444' }}>
                Usa tus credenciales de Odoo. Máximo 5 intentos por minuto.
              </Text>
            </Alert>
          </Stack>
        </form>
      </Card>
    </Box>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
