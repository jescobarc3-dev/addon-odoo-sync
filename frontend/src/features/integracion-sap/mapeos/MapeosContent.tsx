'use client';
import { Tabs } from '@mantine/core';
import { TablaMapeoItems } from './TablaMapeoItems';
import { TablaMapeoBodegas } from './TablaMapeoBodegas';

export function MapeosContent() {
  return (
    <Tabs defaultValue="bodegas" color="ptSlate">
      <Tabs.List mb="md">
        <Tabs.Tab value="bodegas">Bodegas / Almacenes</Tabs.Tab>
        <Tabs.Tab value="items">Excepciones de Items</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="bodegas">
        <TablaMapeoBodegas />
      </Tabs.Panel>

      <Tabs.Panel value="items">
        <TablaMapeoItems />
      </Tabs.Panel>
    </Tabs>
  );
}
