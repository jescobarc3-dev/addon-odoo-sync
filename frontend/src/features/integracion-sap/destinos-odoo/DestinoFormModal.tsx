'use client';

import {
  Modal, Stack, TextInput, Select, Switch, Button, Group, Table,
  ActionIcon, Text, Alert, Badge, Divider, Loader, ScrollArea,
} from '@mantine/core';
import { IconPlus, IconTrash, IconDownload, IconAlertTriangle } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import {
  useCrearDestinoOdooMutation,
  useActualizarDestinoOdooMutation,
  useLazyGetCamposOdooModeloQuery,
  DestinoOdoo,
  DestinoCampo,
  CampoOdooInfo,
} from '@/store/api/integracionSapApi';

const CATALOGOS = [
  { value: 'ubicaciones', label: 'Ubicaciones (puestos)' },
  { value: 'articulos', label: 'Artículos' },
  { value: 'empleados', label: 'Empleados' },
];

const CAMPOS_POR_CATALOGO: Record<string, { value: string; label: string }[]> = {
  ubicaciones: [
    { value: 'puesto', label: 'puesto (N° Puesto)' },
    { value: 'cliente', label: 'cliente (Cliente / Grupo)' },
    { value: 'razonSocial', label: 'razonSocial (Razón Social)' },
    { value: 'sucursal', label: 'sucursal (Sucursal)' },
    { value: 'area', label: 'area (Área / Distrito)' },
    { value: 'industria', label: 'industria (Industria)' },
    { value: 'departamento', label: 'departamento (Departamento)' },
    { value: 'municipio', label: 'municipio (Municipio)' },
    { value: 'zona', label: 'zona (Zona)' },
    { value: 'direccion', label: 'direccion (Dirección)' },
    { value: 'categoria', label: 'categoria (Categoría)' },
    { value: 'encargadoArea', label: 'encargadoArea (Encargado de Área)' },
    { value: 'facturacion', label: 'facturacion (Facturación)' },
  ],
  articulos: [
    { value: 'itemCode', label: 'itemCode (Código SAP)' },
    { value: 'itemName', label: 'itemName (Nombre)' },
    { value: 'uomCode', label: 'uomCode (UdM)' },
    { value: 'precioUnitario', label: 'precioUnitario (Precio)' },
    { value: 'cantidadSap', label: 'cantidadSap (Cantidad SAP)' },
  ],
  empleados: [
    { value: 'empleadoCodigo', label: 'empleadoCodigo (Código)' },
    { value: 'nombreCompleto', label: 'nombreCompleto (Nombre)' },
    { value: 'departamento', label: 'departamento (Departamento)' },
    { value: 'puesto', label: 'puesto (Puesto)' },
  ],
};

const TIPOS_CAMPO = [
  { value: 'char', label: 'Texto' },
  { value: 'integer', label: 'Entero' },
  { value: 'float', label: 'Decimal' },
  { value: 'boolean', label: 'Booleano' },
];

interface Props {
  opened: boolean;
  onClose: () => void;
  destino: DestinoOdoo | null;
  empresa: string;
}

export function DestinoFormModal({ opened, onClose, destino, empresa }: Props) {
  const esEdicion = !!destino;

  const [nombre, setNombre] = useState('');
  const [catalogo, setCatalogo] = useState<string | null>(null);
  const [modelo, setModelo] = useState('');
  const [claveLocal, setClaveLocal] = useState<string | null>(null);
  const [claveOdoo, setClaveOdoo] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [campos, setCampos] = useState<DestinoCampo[]>([]);
  const [camposOdoo, setCamposOdoo] = useState<CampoOdooInfo[]>([]);
  const [errorCampos, setErrorCampos] = useState<string | null>(null);

  const [crear, { isLoading: creando }] = useCrearDestinoOdooMutation();
  const [actualizar, { isLoading: actualizando }] = useActualizarDestinoOdooMutation();
  const [fetchCampos, { isFetching: cargandoCampos }] = useLazyGetCamposOdooModeloQuery();

  useEffect(() => {
    if (opened && destino) {
      setNombre(destino.nombre);
      setCatalogo(destino.catalogo);
      setModelo(destino.odooModelo);
      setClaveLocal(destino.campoClaveLocal);
      setClaveOdoo(destino.campoClaveOdoo);
      setAutoSync(destino.autoSync);
      setCampos(destino.campos ?? []);
      setCamposOdoo([]);
    } else if (opened && !destino) {
      setNombre(''); setCatalogo(null); setModelo(''); setClaveLocal(null);
      setClaveOdoo(null); setAutoSync(false); setCampos([]); setCamposOdoo([]);
    }
    setErrorCampos(null);
  }, [opened, destino]);

  const handleCargarCampos = async () => {
    if (!modelo.trim()) return;
    setErrorCampos(null);
    try {
      const res = await fetchCampos({ modelo: modelo.trim() }).unwrap();
      setCamposOdoo(res);
      if (res.length === 0) setErrorCampos('El modelo no tiene campos escribibles o no existe.');
    } catch {
      setErrorCampos('No se pudo conectar a Odoo o el modelo no existe.');
    }
  };

  const agregarCampo = () => {
    setCampos(prev => [...prev, { campoLocal: '', campoOdoo: '', tipo: 'char' }]);
  };

  const actualizarCampo = (i: number, field: keyof DestinoCampo, value: string) => {
    setCampos(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const eliminarCampo = (i: number) => {
    setCampos(prev => prev.filter((_, idx) => idx !== i));
  };

  const camposOdooSelect = camposOdoo.map(c => ({
    value: c.nombre,
    label: `${c.nombre} (${c.etiqueta}) — ${c.tipo}`,
  }));

  const camposLocalesSelect = catalogo ? CAMPOS_POR_CATALOGO[catalogo] ?? [] : [];

  const handleGuardar = async () => {
    if (!nombre || !catalogo || !modelo || !claveLocal || !claveOdoo) {
      notifications.show({ message: 'Completa todos los campos requeridos', color: 'red' });
      return;
    }
    const payload = {
      empresaCodigo: empresa,
      nombre,
      catalogo,
      odooModelo: modelo,
      campoClaveLocal: claveLocal,
      campoClaveOdoo: claveOdoo,
      autoSync,
      campos: campos.filter(c => c.campoLocal && c.campoOdoo),
    };
    try {
      if (esEdicion) {
        await actualizar({ id: destino!.id, data: payload }).unwrap();
        notifications.show({ message: 'Destino actualizado', color: 'teal' });
      } else {
        await crear(payload).unwrap();
        notifications.show({ message: 'Destino creado', color: 'teal' });
      }
      onClose();
    } catch (err: any) {
      notifications.show({ message: err?.data?.message ?? 'Error al guardar', color: 'red' });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={esEdicion ? 'Editar destino Odoo' : 'Nuevo destino Odoo'}
      size="xl"
    >
      <Stack gap="sm">
        <TextInput
          label="Nombre"
          placeholder="Ej: Puestos en Odoo"
          value={nombre}
          onChange={e => setNombre(e.currentTarget.value)}
          required
        />

        <Select
          label="Catálogo origen"
          placeholder="¿Qué catálogo se envía?"
          data={CATALOGOS}
          value={catalogo}
          onChange={setCatalogo}
          required
        />

        <Group align="flex-end" gap="sm">
          <TextInput
            label="Modelo Odoo (técnico)"
            placeholder="Ej: pt.ubicacion.puesto"
            value={modelo}
            onChange={e => setModelo(e.currentTarget.value)}
            style={{ flex: 1 }}
            required
          />
          <Button
            variant="light"
            leftSection={cargandoCampos ? <Loader size={14} /> : <IconDownload size={14} />}
            disabled={!modelo.trim() || cargandoCampos}
            onClick={handleCargarCampos}
            mb={1}
          >
            Cargar campos
          </Button>
        </Group>

        {errorCampos && (
          <Alert icon={<IconAlertTriangle size={14} />} color="red">{errorCampos}</Alert>
        )}

        {camposOdoo.length > 0 && (
          <Alert color="teal" p="xs">
            {camposOdoo.length} campos escribibles encontrados en <Text span ff="monospace" size="xs">{modelo}</Text>
          </Alert>
        )}

        <Divider label="Campo clave (para upsert)" labelPosition="left" />

        <Group gap="sm">
          <Select
            label="Campo clave — local"
            placeholder="Campo del catálogo"
            data={camposLocalesSelect}
            value={claveLocal}
            onChange={setClaveLocal}
            style={{ flex: 1 }}
            required
          />
          <Select
            label="Campo clave — Odoo"
            placeholder={camposOdoo.length > 0 ? 'Campo en Odoo' : 'Carga campos primero'}
            data={camposOdooSelect}
            value={claveOdoo}
            onChange={setClaveOdoo}
            style={{ flex: 1 }}
            searchable
            disabled={camposOdoo.length === 0}
            required
          />
        </Group>

        <Divider label={`Mapeo de campos (${campos.length})`} labelPosition="left" />

        {campos.length > 0 && (
          <ScrollArea h={220}>
            <Table fz="xs" withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Campo local</Table.Th>
                  <Table.Th>→ Campo Odoo</Table.Th>
                  <Table.Th w={110}>Tipo</Table.Th>
                  <Table.Th w={40}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {campos.map((c, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <Select
                        data={camposLocalesSelect}
                        value={c.campoLocal || null}
                        onChange={v => actualizarCampo(i, 'campoLocal', v ?? '')}
                        size="xs"
                        placeholder="Local"
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        data={camposOdooSelect}
                        value={c.campoOdoo || null}
                        onChange={v => actualizarCampo(i, 'campoOdoo', v ?? '')}
                        size="xs"
                        placeholder={camposOdoo.length > 0 ? 'Odoo' : 'Escribe el nombre'}
                        searchable
                        disabled={camposOdoo.length === 0}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        data={TIPOS_CAMPO}
                        value={c.tipo}
                        onChange={v => actualizarCampo(i, 'tipo', v ?? 'char')}
                        size="xs"
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon color="red" variant="subtle" size="sm" onClick={() => eliminarCampo(i)}>
                        <IconTrash size={12} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconPlus size={12} />}
          onClick={agregarCampo}
          disabled={!catalogo}
        >
          Agregar campo
        </Button>

        <Switch
          label="Sincronizar automáticamente al cargar el catálogo"
          checked={autoSync}
          onChange={e => setAutoSync(e.currentTarget.checked)}
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleGuardar}
            loading={creando || actualizando}
          >
            {esEdicion ? 'Guardar cambios' : 'Crear destino'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
