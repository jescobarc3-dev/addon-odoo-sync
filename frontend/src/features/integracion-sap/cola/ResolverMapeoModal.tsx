'use client';
import { Modal, TextInput, NumberInput, Button, Stack, Group } from '@mantine/core';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useCrearMapeoItemMutation, useReprocesarMutation } from '@/store/api/integracionSapApi';

interface Props {
  registroId: string | null;
  onClose: () => void;
}

export function ResolverMapeoModal({ registroId, onClose }: Props) {
  const [itemCode, setItemCode] = useState('');
  const [productId, setProductId] = useState<number | string>('');
  const [empresa, setEmpresa] = useState('PT');
  const [factor, setFactor] = useState<number | string>(1);

  const [crearMapeo, { isLoading: creando }] = useCrearMapeoItemMutation();
  const [reprocesar, { isLoading: reprocesando }] = useReprocesarMutation();

  const handleGuardar = async () => {
    try {
      await crearMapeo({
        empresaCodigo: empresa,
        itemCodeSap: itemCode,
        odooProductId: Number(productId),
        factorUom: Number(factor),
        activo: true,
      }).unwrap();

      if (registroId) {
        await reprocesar(registroId).unwrap();
      }

      notifications.show({ title: 'Guardado', message: 'Mapeo creado y registro reprocesado', color: 'ptGreen' });
      onClose();
    } catch {
      notifications.show({ title: 'Error', message: 'No se pudo guardar el mapeo', color: 'ptRed' });
    }
  };

  return (
    <Modal opened={!!registroId} onClose={onClose} title="Resolver mapeo de item" size="md">
      <Stack>
        <TextInput label="Empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
        <TextInput
          label="ItemCode SAP"
          placeholder="ej. ITEM-001"
          value={itemCode}
          onChange={(e) => setItemCode(e.target.value)}
          required
        />
        <NumberInput
          label="ID Producto Odoo"
          placeholder="ej. 42"
          value={productId}
          onChange={setProductId}
          required
        />
        <NumberInput
          label="Factor UoM"
          value={factor}
          onChange={setFactor}
          decimalScale={4}
          min={0.0001}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button
            color="ptNavy"
            loading={creando || reprocesando}
            onClick={handleGuardar}
            disabled={!itemCode || !productId}
          >
            Guardar y reprocesar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
