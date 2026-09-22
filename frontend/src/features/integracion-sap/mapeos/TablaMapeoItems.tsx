'use client';
import {
  Box, Card, Switch, Badge, Button, TextInput, NumberInput,
  Group, Stack, Modal, Text, Skeleton,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  useGetMapeoItemsQuery,
  useCrearMapeoItemMutation,
  useActualizarMapeoItemMutation,
  MapeoItem,
} from '@/store/api/integracionSapApi';

export function TablaMapeoItems() {
  const { data: items = [], isLoading } = useGetMapeoItemsQuery(undefined);
  const [crearMapeo] = useCrearMapeoItemMutation();
  const [actualizarMapeo] = useActualizarMapeoItemMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    empresaCodigo: 'PT',
    itemCodeSap: '',
    odooProductId: '' as any,
    factorUom: 1 as any,
    notas: '',
  });

  const handleToggle = async (item: MapeoItem) => {
    try {
      await actualizarMapeo({ id: item.id, data: { activo: !item.activo } }).unwrap();
    } catch {
      notifications.show({ title: 'Error', message: 'No se pudo actualizar', color: 'red' });
    }
  };

  const handleCrear = async () => {
    try {
      await crearMapeo({
        ...form,
        odooProductId: Number(form.odooProductId),
        factorUom: Number(form.factorUom),
        activo: true,
      }).unwrap();
      notifications.show({ title: 'Creado', message: 'Mapeo guardado correctamente', color: 'green' });
      setModalOpen(false);
      setForm({ empresaCodigo: 'PT', itemCodeSap: '', odooProductId: '', factorUom: 1, notas: '' });
    } catch {
      notifications.show({ title: 'Error', message: 'No se pudo crear', color: 'red' });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="#71717A">
          {items.length} excepci{items.length !== 1 ? 'ones' : 'ón'} registrada{items.length !== 1 ? 's' : ''}
        </Text>
        <Button leftSection={<IconPlus size={14} />} color="ptRed" size="sm" onClick={() => setModalOpen(true)}>
          Nueva excepción
        </Button>
      </Group>

      <Card withBorder p={0} style={{ background: '#fff', overflow: 'hidden' }}>
        {isLoading ? (
          <Stack p="md" gap="sm">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={40} radius="sm" />)}
          </Stack>
        ) : (
          <table className="pt-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>ItemCode SAP</th>
                <th>Product ID Odoo</th>
                <th>Factor UoM</th>
                <th>Notas</th>
                <th style={{ textAlign: 'center' }}>Activo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><Badge variant="outline" size="xs" color="gray">{item.empresaCodigo}</Badge></td>
                  <td><Text size="sm" fw={600} ff="monospace">{item.itemCodeSap}</Text></td>
                  <td><Text size="sm" c="#3B82F6" fw={500}>#{item.odooProductId}</Text></td>
                  <td><Text size="sm">{item.factorUom}×</Text></td>
                  <td><Text size="xs" c="#71717A">{item.notas ?? '—'}</Text></td>
                  <td style={{ textAlign: 'center' }}>
                    <Switch checked={item.activo} onChange={() => handleToggle(item)} color="ptGreen" size="sm" />
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0' }}>
                    <Text c="#A1A1AA" size="sm">Sin excepciones — todos los items se resuelven por default_code</Text>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Nueva excepción de mapeo" size="md">
        <Stack gap="sm">
          <TextInput
            label="Empresa"
            value={form.empresaCodigo}
            onChange={(e) => setForm(f => ({ ...f, empresaCodigo: e.target.value }))}
            size="sm"
          />
          <TextInput
            label="ItemCode SAP"
            description="Código exacto del item en SAP Business One"
            value={form.itemCodeSap}
            onChange={(e) => setForm(f => ({ ...f, itemCodeSap: e.target.value }))}
            required
            size="sm"
          />
          <NumberInput
            label="Product ID en Odoo"
            description="ID numérico del product.product en Odoo"
            value={form.odooProductId}
            onChange={(v) => setForm(f => ({ ...f, odooProductId: v }))}
            required
            size="sm"
          />
          <NumberInput
            label="Factor UoM"
            description="Multiplicador de cantidad (1 = sin conversión)"
            value={form.factorUom}
            onChange={(v) => setForm(f => ({ ...f, factorUom: v }))}
            decimalScale={4}
            min={0.0001}
            size="sm"
          />
          <TextInput
            label="Notas"
            value={form.notas}
            onChange={(e) => setForm(f => ({ ...f, notas: e.target.value }))}
            placeholder="ej. Kit especial, unidad cambia en v2024"
            size="sm"
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              color="ptRed"
              size="sm"
              onClick={handleCrear}
              disabled={!form.itemCodeSap || !form.odooProductId}
            >
              Guardar excepción
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
