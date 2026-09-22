# CLAUDE.md — integracion_sap (réplica de salidas SAP → Odoo)

## Sobre este contexto
Bounded context nuevo dentro del monorepo NestJS de `archivo_bodega`. Replica
**salidas de inventario de SAP Business One hacia Odoo 18** como `stock.picking`
validados, para que el addon de flota (`pt_compras_tier_dynamic`, cliente
**Protección Total**) pueda consumir la salida y costear el servicio del vehículo
**sin doble digitación** para el encargado de bodega.

**Idea en una línea:** el OCR de `archivo_bodega` **no reconstruye las líneas** de
la salida — sólo valida el **DocNum**. Con ese número, este contexto **lee las
líneas estructuradas directo de SAP** (SQL de solo lectura), las mapea a Odoo por
`default_code = ItemCode` y crea/valida el picking de forma **idempotente**.
OCR de 1 dato confiable en vez de 20 líneas difusas → confiabilidad ~100%, no 85%.

Contexto relacionado:
- `archivo_bodega/CLAUDE.md` — sistema documental que dispara este flujo (OCR/Meilisearch).
- `pt_compras_tier_dynamic` — addon Odoo que consume el picking (`fleet.vehicle.log.services`).

---

## Stack

| Capa | Tecnología | Versión / notas |
|---|---|---|
| Backend framework | **NestJS** | v10 — mismo monorepo que `archivo_bodega` |
| ORM | **TypeORM** | v0.3 — nunca Prisma |
| Base de datos | **PostgreSQL** | 16 — schema propio `integracion_sap` |
| Cola de mensajes | **RabbitMQ** | `amqplib` — evento `documento.validado` |
| Lectura SAP | **node-mssql** (`mssql`) | conexión SOLO LECTURA a SQL Server de B1 |
| Escritura Odoo | **JSON-RPC** (`/jsonrpc`, `execute_kw`) | mismo estilo que la app Flutter de recuento |
| Frontend framework | **Next.js** | App Router, puerto 4000 (comparte con `archivo_bodega`) |
| UI components | **Mantine** | v8 — cola de revisión del 15% |
| State / data fetching | **RTK Query** (Redux Toolkit) | |
| Autenticación | SSO corporativo + cookies | `@RequirePermissions('integracion-sap:accion')` |

> No se agrega ningún servicio Docker nuevo: corre dentro de `app` (HTTP) y
> `archivo-worker` (consumo). El worker sólo consume si `IS_WORKER=true`.

---

## Comandos

```bash
# Dependencia nueva (amqplib ya está por OCR)
npm i mssql

# Migración del schema integracion_sap (dentro del contenedor Docker)
npm run migration:run
npm run migration:show

# Worker (consume la cola de integración) — requiere IS_WORKER=true
npm run start:worker:archivo-bodega        # reusa el worker existente

# Frontend
cd frontend && npm run dev                 # puerto 4000
```

> **Importante**: todo `npm`/`npx`/migraciones se ejecuta **dentro del contenedor**,
> nunca en el host (misma regla que `archivo_bodega`).

---

## Flujo end-to-end

```
SAP B1 ──imprime PDF de salida──► encargado sube al portal de archivo_bodega
                                       │  OCR valida y extrae el DocNum
                                       ▼
   archivo_bodega emite  documento.validado {tipo, empresa, docnum, hash}
                                       │  RabbitMQ · exchange archivo_bodega.eventos
                                       ▼
   [integracion_sap worker]  filtra tipo = SALIDA_BODEGA
       1. idempotencia         (ledger por docnum / hash_pdf)
       2. resuelve SAP         (SQL read-only OIGE/IGE1 por DocNum)
       3. mapea líneas         (ItemCode→product por default_code; WhsCode→location)
       4. crea + reserva + valida el picking en Odoo → estado 'done'
                                       ▼
   pt_compras_tier_dynamic  el servicio de flota selecciona el picking (state=done)
                            y jala los insumos ya costeados
```

---

## Estructura de módulos del backend

```
src/integracion_sap/
  integracion-sap.module.ts                 → cablea puertos → adapters
  salida-bodega/
    domain/
      entities/registro-sincronizacion.entity.ts   → ledger + máquina de estados
      repositories/registro-sincronizacion.repository.ts  → interfaz + token
      repositories/mapeo-item.repository.ts               → interfaz + token (item y bodega)
    application/
      ports/sap-lector.port.ts              → ISapLectorPort + DTOs de la salida SAP
      ports/odoo-inventario.port.ts         → IOdooInventarioPort + ResultadoPicking
      use-cases/procesar-salida-bodega.use-case.ts  → EL CEREBRO (orquesta todo)
    infrastructure/
      persistence/  → *.orm-entity.ts + *.typeorm-repository.ts (separar del skeleton)
      sap/sap-lector-sql.adapter.ts         → SQL read-only OIGE/IGE1 + lotes IBT1
      odoo/odoo-inventario-rpc.adapter.ts   → crea/reserva/valida picking por RPC
      messaging/salida-bodega.consumer.ts   → worker: consume documento.validado
  # dentro de archivo_bodega (único toque a ese módulo):
  evento/archivo-evento.publisher.ts        → emite documento.validado (genérico)
```

---

## Convenciones de módulo (arquitectura hexagonal ligera)
Idénticas a `archivo_bodega`: dominio sin decoradores TypeORM, interfaces de
repositorio con token de inyección, casos de uso en `application`, adapters en
`infrastructure`. Nombres en español, `snake_case` en tablas/columnas,
`PascalCase + OrmEntity` en clases ORM, **cero lógica de negocio en `*.orm-entity.ts`**.

---

## Modelos de dominio

### `RegistroSincronizacion` (ledger idempotente)
Un registro por salida a replicar. Clave de negocio: `(empresa_codigo, sap_docnum)`
UNIQUE. Ancla secundaria: `hash_pdf` UNIQUE (reusa el SHA-256 que `archivo_bodega`
ya calcula en el Modo A). Máquina de estados:

```
recibido → resuelto_sap → mapeado → creado_odoo → validado_odoo   (éxito terminal)
   └────────────┴──────────┴─────────────┴─► error_sap | error_mapeo
                                              error_stock_insuficiente | error_odoo
```
`validado_odoo` es terminal: nunca se reprocesa (idempotencia). Los `error_*` son
**accionables** — van a la cola de revisión, no fallan en silencio.
`ESTADOS_REINTENTABLES` define cuáles reintenta el worker automáticamente.

### `MapeoItem` / `MapeoBodega`
Escape para lo que **no** calza por `default_code`. Estrategia primaria: match por
código directo en Odoo. `mapeo_item` es sólo para excepciones (renombres, legacy,
kits) — mantenerla pequeña es señal de salud. `mapeo_bodega` traduce `WhsCode` →
`(location_id, picking_type_id, location_dest_id)` de Odoo.

---

## Puertos y adapters (todo intercambiable sin tocar el caso de uso)

| Puerto (application) | Adapter default | Punto de intercambio |
|---|---|---|
| `ISapLectorPort` | `SapLectorSqlAdapter` (SQL read-only) | Service Layer si migran a B1 10.0 |
| `IOdooInventarioPort` | `OdooInventarioRpcAdapter` (JSON-RPC) | — |
| `IRegistroSincronizacionRepository` | TypeORM | — |
| `IMapeoItemRepository` | TypeORM | — |

---

## Contrato de evento — el único toque a `archivo_bodega`
`archivo_bodega` emite un evento **genérico** de dominio; no sabe nada de SAP ni de
Odoo (respeta su boundary declarado *"No construir matching ni endpoints de
vinculación con SAP"*). `ArchivoEventoPublisher.documentoValidado()` se llama desde
`OcrConsumerService` justo después de guardar en `validaciones_ocr` cuando el estado
resultante es `validado`.

```ts
// exchange topic: archivo_bodega.eventos  ·  routing key: documento.validado
interface EventoDocumentoValidado {
  tipoDocumento: string;      // 'SALIDA_BODEGA'
  empresaCodigo: string;
  hashPdf: string;
  documentoArchivoId: string;
  identificador: string;      // el DocNum de SAP (campo es_clave_ocr del tipo)
}
```
El `identificador` es el valor del campo marcado `es_clave_ocr` que el
`NamingService` ya usa como identificador principal del tipo `SALIDA_BODEGA`.

---

## Lectura de SAP (`sap-lector-sql.adapter.ts`)
Documento objetivo: **Salida de inventario** (Inventory Goods Issue) → `OIGE`/`IGE1`.

```sql
SELECT TOP 1 DocEntry, DocNum, DocDate FROM OIGE WHERE DocNum = @docNum;
SELECT LineNum, ItemCode, Dscription, Quantity, WhsCode, UomCode
  FROM IGE1 WHERE DocEntry = @docEntry ORDER BY LineNum;
-- Lotes asignados (BaseType 60 = Inventory Goods Issue):
SELECT BaseLinNum, DistNumber FROM IBT1 WHERE BaseType = 60 AND BaseEntry = @docEntry;
```

**Punto de intercambio:** si bodega imprime una **Entrega** en vez de salida de
inventario, cambiar `OIGE/IGE1` → `ODLN/DLN1` y `BaseType 60` → `15`. Nada más cambia.

**Multi-company:** cada empresa es una BD distinta en el mismo servidor SQL — mapear
`empresaCodigo → nombre de BD` en `nombreBaseDatos()`. El usuario SQL es **solo
SELECT**; este flujo jamás escribe a SAP.

---

## Creación del picking en Odoo (`odoo-inventario-rpc.adapter.ts`)
Secuencia: `create picking` → `create stock.move` por línea → `action_confirm` →
`action_assign` (reserva) → verifica que **todos** los moves queden `assigned` →
asienta `picked` → `button_validate` (`context.skip_backorder`) → confirma `state='done'`.

- **Idempotencia por `origin`**: `SAP-GI-<docEntry>`. Si ya existe un picking con ese
  origin y está `done`, se devuelve sin duplicar.
- **Rama crítica de reserva**: si algún move **no** queda `assigned`, **NO se valida**
  → devuelve `stock_insuficiente` y el ledger queda en `error_stock_insuficiente`.
  Nunca se fuerza un picking a medias (rompería el costeo de flota).
- **Semántica Odoo 17/18**: en `stock.move.line` la cantidad hecha es `quantity`
  (ya no `qty_done`) y existe `picked`. Para Odoo ≤16 cambiar a `qty_done` y quitar `picked`.
- **TODO abierto (decisión de negocio) — lote exacto**: `action_assign` reserva por
  FIFO y puede elegir un lote distinto al de SAP. Para trazabilidad 1:1 hay que fijar
  `move_line.lot_id` con el lote de SAP antes de validar; si ese lote **no existe** en
  Odoo, decidir crearlo o mandarlo a revisión.

---

## Schema de base de datos (`integracion_sap`)

| Tabla | Descripción |
|---|---|
| `registro_sincronizacion` | Ledger. UNIQUE `(empresa_codigo, sap_docnum)` y UNIQUE `hash_pdf`. Índice por `estado` para la cola. |
| `mapeo_item` | Excepciones ItemCode → `odoo_product_id` (+ `factor_uom`). UNIQUE `(empresa_codigo, item_code_sap)`. |
| `mapeo_bodega` | WhsCode → `odoo_location_id`, `odoo_picking_type_id`, `odoo_location_dest_id`. |

Migración: `1789000000000-IntegracionSapSchema` (crea schema + 3 tablas).

---

## Frontend — cola de revisión del 15% (Next.js App Router + Mantine v8)

Vive junto al frontend de `archivo_bodega`. Resuelve lo que el flujo automático no
pudo (`error_mapeo`, `error_stock_insuficiente`, `error_sap`). **No** reusa la
revisión documental de `archivo_bodega` — aquí la revisión es de **mapeo/sincronización**.

```
frontend/src/
  app/integracion-sap/
    cola/page.tsx            → registros en estado error_* (a resolver)
    mapeos/page.tsx          → ABM de mapeo_item / mapeo_bodega
    dashboard/page.tsx       → % automático, backlog, errores por tipo
  features/integracion-sap/
    cola/ColaSincronizacion.tsx
    cola/ResolverMapeoModal.tsx     → asignar product a un ItemCode huérfano
    mapeos/TablaMapeoItems.tsx
    dashboard/DashboardIntegracion.tsx
  store/api/integracionSapApi.ts    → RTK Query
```

### Endpoints a exponer en el backend (aún no implementados)
```
GET  /integracion-sap/registros?estado=      → cola filtrable
GET  /integracion-sap/registros/:id
POST /integracion-sap/registros/:id/reprocesar
GET  /integracion-sap/mapeos/items | bodegas
POST /integracion-sap/mapeos/items           → crear excepción de mapeo
PUT  /integracion-sap/mapeos/items/:id
GET  /integracion-sap/dashboard              → cobertura y % automático
```

### Componentes Mantine por pantalla
- **Cola** (`ColaSincronizacion`): `Table` dentro de `ScrollArea`, `Badge` de estado,
  `Pagination`, filtros con `SegmentedControl` (por estado) + `TextInput` (DocNum),
  fila con `Group` de `ActionIcon` (ver / reprocesar) y `Tooltip` con `ultimo_error`.
- **Resolver mapeo** (`ResolverMapeoModal`): `Modal` con `Autocomplete`/`Select`
  (buscar `product` de Odoo), `NumberInput` (factor UoM), `Button` primario;
  `Notification` de éxito. Al guardar → crea `mapeo_item` y dispara reprocesar.
- **Mapeos** (`TablaMapeoItems`): `Table` editable, `Switch` (`activo`), `Badge`.
- **Dashboard**: `Card` + `RingProgress` (% automático), `SimpleGrid` de métricas,
  `BarChart` de `@mantine/charts` (errores por tipo). `Alert` si el backlog crece.
- Transversales: `AppShell` (ya existe), `LoadingOverlay`, `Skeleton` mientras carga.

---

## Sistema de diseño — Protección Total (theme de Mantine v8)

Tokens anclados en la **paleta de la app de armamento de PT**, para consistencia
entre las herramientas del cliente. Si PT entrega un manual de marca con hex
oficiales, se cambian **sólo aquí**.

| Token | Hex ancla | Uso |
|---|---|---|
| Navy (primario / marca) | `#1A365D` | AppShell header, botones primarios |
| Verde (éxito) | `#0F6E56` | estado `validado_odoo`, confirmar |
| Ámbar (advertencia) | `#854F0B` | estados `error_mapeo` / `error_stock_insuficiente` (accionables) |
| Rojo (peligro) | `#A32D2D` | estados `error_sap` / `error_odoo`, destructivo |
| Fondo | `#F5F5F5` | `body` |
| Texto | `#2C2C2A` | texto principal |

```ts
// frontend/src/theme.ts
import { createTheme, MantineColorsTuple } from '@mantine/core';

const ptNavy: MantineColorsTuple = [
  '#f1f4fa', '#dde5f1', '#b6c8e4', '#8ca9d7', '#6a90cc',
  '#5480c5', '#4877c2', '#3a5f9f', '#1a365d', '#112846', // shade 8 = marca
];
// ptGreen (#0F6E56), ptAmber (#854F0B), ptRed (#A32D2D): generar la tupla de 10
// tonos desde cada ancla con https://mantine.dev/colors-generator/ y pegarlas aquí.

export const theme = createTheme({
  primaryColor: 'ptNavy',
  primaryShade: { light: 8, dark: 6 }, // filled usa el navy de marca en light
  colors: { ptNavy /*, ptGreen, ptAmber, ptRed */ },
  fontFamily: 'Inter, system-ui, sans-serif',
  defaultRadius: 'md',
});
// <MantineProvider theme={theme}> en el layout raíz.
```

### Mapeo estado del ledger → color de `Badge`
```ts
const COLOR_ESTADO: Record<string, string> = {
  recibido: 'gray',
  resuelto_sap: 'ptNavy', mapeado: 'ptNavy', creado_odoo: 'ptNavy', // en proceso
  validado_odoo: 'ptGreen',                                          // éxito
  error_mapeo: 'ptAmber', error_stock_insuficiente: 'ptAmber',       // accionable
  error_sap: 'ptRed', error_odoo: 'ptRed',                           // error
};
// <Badge color={COLOR_ESTADO[registro.estado]}>{registro.estado}</Badge>
```

---

## Permisos

| Permiso | Quién / para qué |
|---|---|
| `integracion-sap:read` | Ver cola, registros y dashboard |
| `integracion-sap:mapear` | Crear/editar `mapeo_item` y `mapeo_bodega` |
| `integracion-sap:revisar` | Resolver registros en error y reprocesar |

Usuario RPC de Odoo con permiso **mínimo** (sólo stock). Usuario SQL de SAP **solo SELECT**.

---

## Variables de entorno

```
SAP_SQL_HOST=       SAP_SQL_PORT=1433   SAP_SQL_USER=   SAP_SQL_PASSWORD=   # SOLO SELECT
ODOO_URL=https://bodega.adsa.com.gt   ODOO_DB=bodega_pt   ODOO_USER=   ODOO_PASSWORD=
RABBITMQ_URL=amqp://...
IS_WORKER=true      # sólo en el contenedor worker
```

---

## Casos borde

| Caso | Comportamiento |
|---|---|
| DocNum mal leído por OCR / inexistente en SAP | `obtenerSalidaPorDocnum` devuelve null → `error_sap`. |
| ItemCode sin `product` en Odoo | acumula en `sinMapeo` → `error_mapeo` con la lista → cola de revisión. |
| WhsCode sin `mapeo_bodega` | `error_mapeo` antes de tocar Odoo. |
| Odoo no puede reservar (stock < SAP) | NO valida → `error_stock_insuficiente`, picking queda en borrador. |
| Reproceso del mismo PDF/DocNum | idempotencia por `(empresa, docnum)` + `hash_pdf` + `origin` en Odoo → no duplica. |
| Producto con lote pero lote de SAP ausente en Odoo | ver TODO de lote — decisión de negocio pendiente. |
| Mensaje de RabbitMQ corrupto / DocNum no numérico | `nack` a DLQ `integracion_sap.salida_bodega.dlq`, sin reintento ciego. |

---

## Qué NO hacer

- **No** meter matching ni lógica de SAP/Odoo dentro de `archivo_bodega` — ese
  contexto sólo emite `documento.validado` genérico.
- **No** escribir a SAP por SQL (ni por ningún medio en este flujo). Es one-way SAP→Odoo.
  Si algún día hay escritura a SAP: sólo DI API / Service Layer, jamás INSERT directo.
- **No** reconstruir las líneas de la salida desde el texto OCR — leerlas de SAP por DocNum.
- **No** validar un picking a medias por “forzar” la salida — usar la rama de revisión.
- **No** dejar que Odoo elija el lote por FIFO cuando SAP reportó un lote específico.
- **No** vender esto como “sincronización total de inventario”: es réplica de **salidas**.
  Entradas, traslados y ajustes NO cruzan; SAP sigue siendo el maestro de existencias.
- **No** procesar mensajes de la cola en el contenedor `app` — sólo en el worker (`IS_WORKER=true`).
- **No** consultar SAP sin `TOP`/índice por `DocEntry` — evita full scans en la BD productiva.
```
