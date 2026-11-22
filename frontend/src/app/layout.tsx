import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import RootLayoutClient from './RootLayoutClient';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
});

export const metadata: Metadata = {
  title: 'Portal de Gestión',
  description: 'Sistema de gestión de inventario',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={dmSans.variable}>
      <body>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
