'use client';
import {
  Box, Card, Switch, Badge, Button, TextInput, Select,
  Group, Stack, Modal, Text, Skeleton, Tooltip,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  useGetMapeosBodegasQuery,
  useCrearMapeoBodegaMutation,
  useActualizarMapeoBodegaMutation,
  useEliminarMapeoBodegaMutation,
  useGetUbicacionesOdooQuery,
  useGetPickingTypesOdooQuery,
  MapeoBodega,
} from '@/store/api/integracionSapApi';

const TIPO_OPTS = [
  { value: 'SALIDA', label: 'Salida (OUT)' },
  { value: 'ENTRADA', label: 'Entrada (IN)' },
];

const emptyForm = {
  empresaCodigo: 'DEFAULT',
  whsCodeSap: '',
  tipoOperacion: 'SALIDA' as 'SALIDA' | 'ENTRADA',
  odooLocationId: '' as any,
  odooPickingTypeId: '' as any,
  odooLocationDestId: '' as any,
  forzarSinStock: true,
  notas: '',
};

export function TablaMapeoBodegas() {
  const { data: bodegas = [], isLoading } = useGetMapeosBodegasQuery(undefined);
  const { data: ubicaciones = [] } = useGetUbicacionesOdooQuery();
  const { data: pickingTypes = [] } = useGetPickingTypesOdooQuery();
  const [crearBodega] = useCrearMapeoBodegaMutation();
  const [actualizarBodega] = useActualizarMapeoBodegaMutation();
  const [eliminarBodega] = useEliminarMapeoBodegaMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<MapeoBodega | null>(null);
  const [form, setForm] = useState(emptyForm);

  const ubicacionOpts = ubicaciones.map((u) => ({ value: String(u.id), label: u.nombre }));
  const pickingOpts = pickingTypes.map((p) => ({ value: String(p.id), label: `${p.nombre} (${p.codigo})` }));

  const abrirCrear = () => {
    setEditando(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const abrirEditar = (b: MapeoBodega) => {
    setEditando(b);
    setForm({
      empresaCodigo: b.empresaCodigo,
      whsCodeSap: b.whsCodeSap,
      tipoOperacion: b.tipoOperacion,
      odooLocationId: b.odooLocationId,
      odooPickingTypeId: b.odooPickingTypeId,
      odooLocationDestId: b.odooLocationDestId,
      forzarSinStock: b.forzarSinStock ?? true,
      notas: b.notas ?? '',
    });
    setModalOpen(true);
  };

  const handleGuardar = async () => {
    const payload = {
      ...form,
      odooLocationId: Number(form.odooLocationId),
      odooPickingTypeId: Number(form.odooPickingTypeId),
      odooLocationDestId: Number(form.odooLocationDestId),
    };
    try {
      if (editando) {
        await actualizarBodega({ id: editando.id, data: payload }).unwrap();
        notifications.show({ title: 'Actualizado', message: 'Mapeo de bodega actualizado', color: 'green' });
      } else {
        await crearBodega({ ...payload, activo: true }).unwrap();
        notifications.show({ title: 'Creado', message: 'Mapeo de bodega guardado', color: 'green' });
      }
      setModalOpen(false);
    } catch {
      notifications.show({ title: 'Error', message: 'No se pudo guardar el mapeo', color: 'red' });
    }
  };

  const handleToggle = async (b: MapeoBodega) => {
    try {
      await actualizarBodega({ id: b.id, data: { activo: !b.activo } }).unwrap();
    } catch {
      notifications.show({ title: 'Error', message: 'No se pudo actualizar', color: 'red' });
    }
  };

  const handleEliminar = async (b: MapeoBodega) => {
    if (!window.confirm(`¿Eliminar el mapeo de "${b.whsCodeSap}" (${b.tipoOperacion})? Esta acción no se puede deshacer.`)) return;
    try {
      await eliminarBodega(b.id).unwrap();
      notifications.show({ title: 'Eliminado', message: `Mapeo de ${b.whsCodeSap} eliminado`, color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'No se pudo eliminar', color: 'red' });
    }
  };

  const isValid = form.whsCodeSap && form.odooLocationId && form.odooPickingTypeId && form.odooLocationDestId;

  const nombreUbicacion = (id: number) => ubicaciones.find((u) => u.id === id)?.nombre ?? `#${id}`;
  const nombrePicking = (id: number) => {
    const p = pickingTypes.find((p) => p.id === id);
    return p ? `${p.nombre}` : `#${id}`;
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="#71717A">
          {bodegas.length} bodega{bodegas.length !== 1 ? 's' : ''} configurada{bodegas.length !== 1 ? 's' : ''}
        </Text>
        <Button leftSection={<IconPlus size={14} />} color="ptSlate" size="sm" onClick={abrirCrear}>
          Nueva bodega
        </Button>
      </Group>

      <Card withBorder p={0} style={{ background: '#fff', overflow: 'hidden' }}>
        {isLoading ? (
          <Stack p="md" gap="sm">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={40} radius="sm" />)}
          </Stack>
        ) : (
          <table className="pt-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>WhsCode SAP</th>
                <th>Tipo</th>
                <th>Ubicación origen</th>
                <th>Tipo operación Odoo</th>
                <th>Ubicación destino</th>
                <th>Notas</th>
                <th style={{ textAlign: 'center' }}>
                  <Tooltip label="Si está ON: valida el picking aunque no haya stock (inventario queda negativo). Si está OFF: cancela si falta stock." multiline w={260} withArrow>
                    <span style={{ cursor: 'help', borderBottom: '1px dashed #a1a1aa' }}>Forzar sin stock</span>
                  </Tooltip>
                </th>
                <th style={{ textAlign: 'center' }}>Activo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bodegas.map((b) => (
                <tr key={b.id}>
                  <td><Text size="sm" fw={600} ff="monospace">{b.whsCodeSap}</Text></td>
                  <td>
                    <Badge size="sm" color={b.tipoOperacion === 'SALIDA' ? 'ptAmber' : 'ptSlate'}>
                      {b.tipoOperacion}
                    </Badge>
                  </td>
                  <td><Text size="xs" c="#52525B">{nombreUbicacion(b.odooLocationId)}</Text></td>
                  <td><Text size="xs" c="#3B82F6">{nombrePicking(b.odooPickingTypeId)}</Text></td>
                  <td><Text size="xs" c="#52525B">{nombreUbicacion(b.odooLocationDestId)}</Text></td>
                  <td><Text size="xs" c="#71717A">{b.notas ?? '—'}</Text></td>
                  <td style={{ textAlign: 'center' }}>
                    <Tooltip label={b.forzarSinStock ? 'Valida aunque no haya stock (inventario negativo)' : 'Cancela si falta stock'} withArrow>
                      <Switch
                        checked={b.forzarSinStock ?? true}
                        onChange={() => actualizarBodega({ id: b.id, data: { forzarSinStock: !b.forzarSinStock } })}
                        color="ptAmber"
                        size="sm"
                      />
                    </Tooltip>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Switch checked={b.activo} onChange={() => handleToggle(b)} color="ptGreen" size="sm" />
                  </td>
                  <td>
                    <Group gap={8} wrap="nowrap">
                      <Tooltip label="Editar">
                        <Box component="span" style={{ cursor: 'pointer', color: '#71717A' }} onClick={() => abrirEditar(b)}>
                          <IconEdit size={15} />
                        </Box>
                      </Tooltip>
                      <Tooltip label="Eliminar">
                        <Box component="span" style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => handleEliminar(b)}>
                          <IconTrash size={15} />
                        </Box>
                      </Tooltip>
                    </Group>
                  </td>
                </tr>
              ))}
              {bodegas.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 0' }}>
                    <Stack align="center" gap="xs">
                      <Text c="#A1A1AA" size="sm">Sin bodegas configuradas</Text>
                      <Text c="#A1A1AA" size="xs">Crea un mapeo para que el sistema sepa a qué ubicación de Odoo apunta cada almacén de SAP</Text>
                    </Stack>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar mapeo de bodega' : 'Nueva bodega SAP → Odoo'}
        size="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="WhsCode SAP"
            description="Código exacto del almacén en SAP (ej: ALMACEN06)"
            value={form.whsCodeSap}
            onChange={(e) => setForm(f => ({ ...f, whsCodeSap: e.target.value.toUpperCase() }))}
            required
            size="sm"
            disabled={!!editando}
          />

          <Select
            label="Tipo de operación"
            data={TIPO_OPTS}
            value={form.tipoOperacion}
            onChange={(v) => setForm(f => ({ ...f, tipoOperacion: (v ?? 'SALIDA') as any }))}
            size="sm"
          />

          <Select
            label="Tipo de operación en Odoo (picking type)"
            description="Define qué tipo de movimiento crea en Odoo"
            data={pickingOpts}
            value={form.odooPickingTypeId ? String(form.odooPickingTypeId) : null}
            onChange={(v) => setForm(f => ({ ...f, odooPickingTypeId: v ?? '' }))}
            searchable
            required
            size="sm"
            placeholder="Selecciona el tipo de operación…"
          />

          <Select
            label="Ubicación origen"
            description="stock.location de donde salen los productos"
            data={ubicacionOpts}
            value={form.odooLocationId ? String(form.odooLocationId) : null}
            onChange={(v) => setForm(f => ({ ...f, odooLocationId: v ?? '' }))}
            searchable
            required
            size="sm"
            placeholder="Busca por nombre…"
          />

          <Select
            label="Ubicación destino"
            description="stock.location a donde van los productos"
            data={ubicacionOpts}
            value={form.odooLocationDestId ? String(form.odooLocationDestId) : null}
            onChange={(v) => setForm(f => ({ ...f, odooLocationDestId: v ?? '' }))}
            searchable
            required
            size="sm"
            placeholder="Busca por nombre…"
          />

          <Switch
            label="Forzar sin stock"
            description="ON: valida el picking aunque Odoo no tenga stock (el inventario queda negativo hasta que llegue la entrada). OFF: cancela y reporta error si falta stock."
            checked={form.forzarSinStock}
            onChange={(e) => setForm(f => ({ ...f, forzarSinStock: e.currentTarget.checked }))}
            color="ptAmber"
            size="sm"
          />

          <TextInput
            label="Notas"
            value={form.notas}
            onChange={(e) => setForm(f => ({ ...f, notas: e.target.value }))}
            placeholder="ej. Bodega principal de flota"
            size="sm"
          />

          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              color="ptSlate"
              size="sm"
              onClick={handleGuardar}
              disabled={!isValid}
            >
              {editando ? 'Guardar cambios' : 'Crear bodega'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
