'use client';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/dropzone/styles.css';
import './globals.css';
import { MantineProvider, Box, Text, Group, Avatar, Divider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { theme } from '@/theme';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  IconLayoutDashboard,
  IconClipboardList,
  IconTag,
  IconChevronRight,
  IconBell,
  IconPackage,
  IconRefresh,
  IconArrowBarDown,
  IconArrowBarUp,
  IconSettings,
  IconBooks,
} from '@tabler/icons-react';
import { DM_Sans } from 'next/font/google';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
});

const NAV_SECTIONS = [
  {
    title: 'Sistema',
    items: [
      { href: '/integracion-sap/dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
      { href: '/integracion-sap/cola', label: 'Cola de revisión', icon: IconClipboardList },
      { href: '/integracion-sap/mapeos', label: 'Mapeos', icon: IconTag },
      { href: '/integracion-sap/catalogo', label: 'Catálogo', icon: IconBooks },
    ],
  },
  {
    title: 'Documentos SAP',
    items: [
      { href: '/integracion-sap/documentos/inventario-inicial', label: 'Inventario inicial', icon: IconPackage },
      { href: '/integracion-sap/documentos/actualizacion', label: 'Actualización inventario', icon: IconRefresh },
      { href: '/integracion-sap/documentos/entradas', label: 'Entradas de mercancía', icon: IconArrowBarDown },
      { href: '/integracion-sap/documentos/salidas', label: 'Salidas de mercancía', icon: IconArrowBarUp },
    ],
  },
];

const PAGE_LABELS: Record<string, string> = {
  '/integracion-sap/dashboard': 'Dashboard',
  '/integracion-sap/cola': 'Cola de revisión',
  '/integracion-sap/mapeos': 'Mapeos',
  '/integracion-sap/catalogo': 'Catálogo de artículos',
  '/integracion-sap/documentos/inventario-inicial': 'Inventario inicial',
  '/integracion-sap/documentos/actualizacion': 'Actualización inventario',
  '/integracion-sap/documentos/entradas': 'Entradas de mercancía',
  '/integracion-sap/documentos/salidas': 'Salidas de mercancía',
};

function PtLogo() {
  return (
    <svg width="150" height="36" viewBox="0 0 210 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="22" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="21" fill="#FFFFFF" letterSpacing="0.5">PR</text>
      <circle cx="54" cy="14" r="10" stroke="#8B1A1A" strokeWidth="2.5" fill="none"/>
      <circle cx="54" cy="14" r="3" fill="#8B1A1A"/>
      <line x1="54" y1="4" x2="54" y2="8" stroke="#8B1A1A" strokeWidth="2" strokeLinecap="round"/>
      <line x1="54" y1="20" x2="54" y2="24" stroke="#8B1A1A" strokeWidth="2" strokeLinecap="round"/>
      <line x1="44" y1="14" x2="48" y2="14" stroke="#8B1A1A" strokeWidth="2" strokeLinecap="round"/>
      <line x1="60" y1="14" x2="64" y2="14" stroke="#8B1A1A" strokeWidth="2" strokeLinecap="round"/>
      <text x="66" y="22" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="21" fill="#FFFFFF" letterSpacing="0.5">TECCIÓN</text>
      <text x="0" y="46" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="21" fill="#FFFFFF" letterSpacing="7">TOTAL</text>
    </svg>
  );
}

function Sidebar() {
  const path = usePathname();
  return (
    <Box
      className="sidebar-root"
      style={{
        width: 240,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        borderRight: '1px solid #1F1F1F',
      }}
    >
      <Box style={{ padding: '20px 16px 18px' }}>
        <PtLogo />
      </Box>
      <div className="logo-divider" />

      <Box style={{ flex: 1, padding: '8px 8px', overflowY: 'auto', position: 'relative' }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="sidebar-nav-section">{section.title}</div>
            {section.items.map((item) => {
              const active = path.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={`sidebar-nav-item${active ? ' active' : ''}`}>
                  <item.icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
        {/* Administración */}
        <div className="sidebar-nav-section" style={{ marginTop: 8 }}>Administración</div>
        <Link href="/admin/configuracion" className="sidebar-nav-item" target="_blank">
          <IconSettings size={15} />
          Configuración
        </Link>

        {/* Crosshair watermark */}
        <div className="sidebar-watermark">
          <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="40" stroke="#8B1A1A" strokeWidth="1.5"/>
            <circle cx="50" cy="50" r="25" stroke="#8B1A1A" strokeWidth="1"/>
            <circle cx="50" cy="50" r="5" fill="#8B1A1A"/>
            <line x1="50" y1="0" x2="50" y2="22" stroke="#8B1A1A" strokeWidth="1.5"/>
            <line x1="50" y1="78" x2="50" y2="100" stroke="#8B1A1A" strokeWidth="1.5"/>
            <line x1="0" y1="50" x2="22" y2="50" stroke="#8B1A1A" strokeWidth="1.5"/>
            <line x1="78" y1="50" x2="100" y2="50" stroke="#8B1A1A" strokeWidth="1.5"/>
            <line x1="50" y1="10" x2="50" y2="20" stroke="#8B1A1A" strokeWidth="1"/>
            <line x1="50" y1="80" x2="50" y2="90" stroke="#8B1A1A" strokeWidth="1"/>
            <line x1="10" y1="50" x2="20" y2="50" stroke="#8B1A1A" strokeWidth="1"/>
            <line x1="80" y1="50" x2="90" y2="50" stroke="#8B1A1A" strokeWidth="1"/>
          </svg>
        </div>
      </Box>

      <Box style={{ padding: '12px 16px', borderTop: '1px solid #1F1F1F' }}>
        <Text size="xs" style={{ color: '#52525B' }}>v0.1.0 · SAP → Odoo</Text>
      </Box>
    </Box>
  );
}

function Header({ path }: { path: string }) {
  const label = Object.entries(PAGE_LABELS).find(([key]) => path.startsWith(key))?.[1] ?? 'Sistema';
  return (
    <Box
      style={{
        height: 56,
        background: '#FFFFFF',
        borderBottom: '1px solid #E4E4E7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'fixed',
        left: 240,
        right: 0,
        top: 0,
        zIndex: 99,
      }}
    >
      <Group gap={6}>
        <Text size="sm" c="#71717A">Integración SAP</Text>
        <IconChevronRight size={14} color="#71717A" />
        <Text size="sm" fw={600} c="#18181B">{label}</Text>
      </Group>
      <Group gap={12}>
        <Box style={{ cursor: 'pointer', color: '#71717A', display: 'flex', alignItems: 'center' }}>
          <IconBell size={18} />
        </Box>
        <Divider orientation="vertical" />
        <Group gap={8}>
          <Avatar size={30} radius="xl" style={{ background: '#8B1A1A' }}>
            <Text size="xs" fw={700} c="white">PT</Text>
          </Avatar>
          <Box>
            <Text size="xs" fw={600} c="#18181B" lh={1.2}>Protección Total</Text>
          </Box>
        </Group>
      </Group>
    </Box>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith('/admin')) return <>{children}</>;
  return (
    <Box style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <Box style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header path={path} />
        <Box className="content-area" style={{ marginTop: 56, padding: '28px' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={dmSans.variable}>
      <body>
        <Provider store={store}>
          <MantineProvider theme={theme}>
            <Notifications position="top-right" />
            <Shell>{children}</Shell>
          </MantineProvider>
        </Provider>
      </body>
    </html>
  );
}
