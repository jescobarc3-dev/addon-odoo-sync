import { Notifications } from '@mantine/notifications';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Notifications position="top-right" />
      {children}
    </>
  );
}
