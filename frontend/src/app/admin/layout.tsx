'use client';

import { Notifications } from '@mantine/notifications';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Notifications position="top-right" />
      {children}
    </>
  );
}
