import { createTheme, MantineColorsTuple } from '@mantine/core';

const ptRed: MantineColorsTuple = [
  '#fdf2f2', '#fbe8e8', '#f5c6c6', '#eda0a0', '#e47f7f',
  '#da6060', '#d04848', '#bb3232', '#8b1a1a', '#6b1212',
];
const ptGreen: MantineColorsTuple = [
  '#f0faf3', '#dcf5e3', '#b5e8c2', '#88d99e', '#62cc7e',
  '#44c267', '#31b856', '#1f9e42', '#166534', '#0d4424',
];
const ptAmber: MantineColorsTuple = [
  '#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24',
  '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f',
];
const ptSlate: MantineColorsTuple = [
  '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8',
  '#64748b', '#475569', '#334155', '#1e293b', '#0f172a',
];

export const theme = createTheme({
  primaryColor: 'ptRed',
  primaryShade: { light: 8, dark: 6 },
  colors: { ptRed, ptGreen, ptAmber, ptSlate },
  fontFamily: 'var(--font-dm-sans), DM Sans, system-ui, sans-serif',
  defaultRadius: 'sm',
  components: {
    Badge: { defaultProps: { radius: 'sm' } },
    Button: { defaultProps: { radius: 'sm' } },
    Card: { defaultProps: { radius: 'sm', shadow: 'xs' } },
  },
});

export const COLOR_ESTADO: Record<string, string> = {
  recibido: 'ptSlate',
  resuelto_sap: 'blue',
  mapeado: 'blue',
  creado_odoo: 'blue',
  validado_odoo: 'ptGreen',
  error_mapeo: 'ptAmber',
  error_stock_insuficiente: 'ptAmber',
  error_sap: 'ptRed',
  error_odoo: 'ptRed',
};

export const LABEL_ESTADO: Record<string, string> = {
  recibido: 'Recibido',
  resuelto_sap: 'Leído SAP',
  mapeado: 'Mapeado',
  creado_odoo: 'Creado Odoo',
  validado_odoo: 'Validado',
  error_mapeo: 'Error mapeo',
  error_stock_insuficiente: 'Stock insuficiente',
  error_sap: 'Error SAP',
  error_odoo: 'Error Odoo',
};
