# Sistema de Markup (Porcentaje de Ganancia) por Producto

## Problema

Al agregar productos al sistema, actualmente se ingresan **precio de costo** y **precio de venta** de forma independiente. Esto genera:
- Errores humanos al calcular mentalmente el porcentaje
- Inconsistencia de márgenes entre productos similares
- No hay forma rápida de aplicar un porcentaje estándar a toda una categoría
- No se registra cuál fue el porcentaje aplicado

## Conceptos Matemáticos Clave

### Markup (Margen sobre costo) — EL QUE USAREMOS

El **markup** es el porcentaje que se suma **sobre el precio de costo** para obtener el precio de venta.

```
Precio Venta = Costo × (1 + markup / 100)
```

| Costo | Markup | Cálculo | Precio Venta | Ganancia |
|-------|--------|---------|--------------|----------|
| $1.000 | 30% | 1.000 × 1.30 | $1.300 | $300 |
| $1.000 | 40% | 1.000 × 1.40 | $1.400 | $400 |
| $1.000 | 50% | 1.000 × 1.50 | $1.500 | $500 |
| $1.000 | 100% | 1.000 × 2.00 | $2.000 | $1.000 |

**Fórmula inversa** (para saber qué markup se aplicó):
```
Markup (%) = ((Precio Venta - Costo) / Costo) × 100
```

### Margen sobre venta (referencia, NO lo usaremos como base)

El **margen** es el porcentaje de ganancia respecto al **precio de venta**.

```
Margen (%) = ((Precio Venta - Costo) / Precio Venta) × 100
```

**Tabla comparativa Markup vs Margen:**

| Markup | Margen equivalente | Ejemplo (costo $1.000) |
|--------|-------------------|----------------------|
| 20% | 16.7% | Venta: $1.200 |
| 30% | 23.1% | Venta: $1.300 |
| 40% | 28.6% | Venta: $1.400 |
| 50% | 33.3% | Venta: $1.500 |
| 60% | 37.5% | Venta: $1.600 |
| 80% | 44.4% | Venta: $1.800 |
| 100% | 50.0% | Venta: $2.000 |

> **Decisión:** Usar **markup sobre costo** porque es más intuitivo para el usuario: "le sumo un 40% al costo".

---

## Manejo del IVA (19%) en el Cálculo de Precios

El IVA afecta directamente cómo se calcula el precio de venta. Hay dos escenarios según cómo el proveedor factura:

### Escenario 1: Compra SIN IVA (costo neto)

El proveedor entrega un precio **neto** (sin impuesto). Tú debes agregar el IVA para conocer tu costo real.

**Fórmula completa:**
```
Paso 1: Agregar IVA al costo neto
   costoConIVA = costoNeto × 1.19

Paso 2: Aplicar markup sobre el costo con IVA
   precioVenta = costoConIVA × (1 + markup / 100)
```

**Ejemplo:** Compras un producto a $1.000 neto, markup 30%:
```
costoNeto        = $1.000
costoConIVA      = $1.000 × 1.19 = $1.190
precioVenta      = $1.190 × 1.30 = $1.547 → redondeado: $1.550
ganancia bruta   = $1.550 - $1.190 = $360
```

**Tabla completa — Costo NETO $1.000:**

| Paso | Valor | Detalle |
|------|-------|---------|
| Costo neto (ingresado) | $1.000 | Lo que dice la factura |
| + IVA 19% | $190 | $1.000 × 0.19 |
| **Costo real** | **$1.190** | Lo que realmente pagas |
| + Markup 30% | $357 | $1.190 × 0.30 |
| **Precio Venta** | **$1.547 → $1.550** | Lo que cobra el sistema |
| Ganancia bruta | $360 | precioVenta - costoConIVA |

### Escenario 2: Compra CON IVA incluido

El proveedor entrega un precio que **ya incluye IVA**. Para aplicar el markup correctamente, primero debes extraer el costo neto.

**Fórmula completa:**
```
Paso 1: Extraer el costo neto (quitar IVA)
   costoNeto = costoConIVA / 1.19

Paso 2: El costo con IVA ya lo tienes (es el que ingresaste)
   costoConIVA = (valor ingresado)

Paso 3: Aplicar markup sobre el costo con IVA
   precioVenta = costoConIVA × (1 + markup / 100)
```

**Ejemplo:** Compras un producto a $1.190 con IVA incluido, markup 30%:
```
costoConIVA      = $1.190 (ingresado)
costoNeto        = $1.190 / 1.19 = $1.000
precioVenta      = $1.190 × 1.30 = $1.547 → redondeado: $1.550
ganancia bruta   = $1.550 - $1.190 = $360
```

**Tabla completa — Costo CON IVA $1.190:**

| Paso | Valor | Detalle |
|------|-------|---------|
| Costo con IVA (ingresado) | $1.190 | Lo que dice el ticket/boleta |
| Costo neto (extraído) | $1.000 | $1.190 / 1.19 |
| IVA contenido | $190 | $1.190 - $1.000 |
| **Costo real** | **$1.190** | Mismo valor ingresado |
| + Markup 30% | $357 | $1.190 × 0.30 |
| **Precio Venta** | **$1.547 → $1.550** | Lo que cobra el sistema |
| Ganancia bruta | $360 | precioVenta - costoConIVA |

### Escenario 3: Producto EXENTO de IVA

Algunos productos no llevan IVA (ej: ciertos productos agrícolas no procesados). En este caso:

```
costoNeto = costoIngresado (no hay IVA)
precioVenta = costoNeto × (1 + markup / 100)
```

### Equivalencia Matemática

Ambos escenarios llegan al **mismo resultado** si el costo neto es el mismo:

```
Escenario 1: $1.000 neto → ×1.19 → $1.190 → ×1.30 → $1.547
Escenario 2: $1.190 con IVA → /1.19 = $1.000 neto → ×1.19 → $1.190 → ×1.30 → $1.547
```

Esto se debe a que la multiplicación es conmutativa:
```
costoNeto × 1.19 × (1 + markup/100) = costoNeto × (1 + markup/100) × 1.19
```

> **Conclusión:** No importa en qué orden apliques IVA y markup, el resultado es idéntico. Lo que importa es que el sistema identifique correctamente el **costo neto** como base de cálculo.

### Sobre la Ganancia Real

La ganancia **real** del negocio es sobre el valor **neto**, porque:
- El IVA que pagas al proveedor lo recuperas como **crédito fiscal**
- El IVA que cobras al cliente lo entregas al **SII** (débito fiscal)
- El IVA **no es ganancia ni pérdida**, es un flujo de impuesto

```
Ganancia neta = costoNeto × (markup / 100)
   Ejemplo: $1.000 × 0.30 = $300

Ganancia bruta (lo que ves en caja) = precioVenta - costoConIVA
   Ejemplo: $1.550 - $1.190 = $360
   (incluye IVA sobre la ganancia, que después entregas al SII)
```

### Ejemplo Comparativo Completo

Un mismo producto comprado a dos proveedores distintos:

| Concepto | Proveedor A (sin IVA) | Proveedor B (con IVA) |
|----------|----------------------|----------------------|
| Precio factura | $1.000 | $1.190 |
| Tipo IVA | Sin IVA | Con IVA incluido |
| **Costo neto** | **$1.000** | **$1.000** ($1.190 / 1.19) |
| **Costo real (con IVA)** | **$1.190** ($1.000 × 1.19) | **$1.190** |
| Markup elegido | 40% | 40% |
| **Precio Venta** | **$1.666 → $1.670** | **$1.666 → $1.670** |
| Ganancia bruta | $480 | $480 |
| Ganancia neta (sin IVA) | $400 | $400 |

> Mismo producto, mismo costo real, mismo markup = **mismo precio de venta**. El sistema se encarga de la conversión automáticamente.

---

## Diseño de la Solución

### 1. Perfiles de Markup por Categoría

Definir porcentajes predeterminados por tipo/categoría de producto. El usuario los configuraría una vez y luego se aplican automáticamente al seleccionar la categoría.

**Ejemplo de perfiles sugeridos:**

| Categoría | Markup Sugerido | Lógica |
|-----------|----------------|--------|
| Abarrotes / Despensa | 25% – 35% | Productos de alta rotación, margen bajo |
| Bebidas | 30% – 40% | Rotación media-alta |
| Lácteos / Frescos | 20% – 30% | Perecibles, margen moderado |
| Dulces / Snacks | 40% – 60% | Alta rotación, margen alto |
| Limpieza / Hogar | 30% – 50% | Rotación media |
| Cigarros / Tabaco | 10% – 15% | Márgenes regulados/bajos |
| Licores | 30% – 50% | Margen variable |
| Verduras / Frutas | 40% – 80% | Perecibles, alto desperdicio |
| Electrónica / Accesorios | 50% – 100% | Baja rotación, margen alto |
| General | 30% | Valor por defecto |

> **Nota:** Estos son valores de referencia. El usuario debe poder definir el markup por defecto de cada categoría según su realidad de negocio.

### 2. Campos Nuevos en el Producto

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `markupPercent` | number \| null | Porcentaje de markup aplicado. `null` si el precio fue ingresado manualmente |
| `ivaType` | string | `'excluded'` = costo sin IVA, `'included'` = costo con IVA, `'exempt'` = exento de IVA |
| `costNeto` | number | Costo neto (sin IVA), calculado automáticamente. Es la base real del markup |

- `cost` (campo existente) seguirá almacenando el **costo real con IVA** (lo que efectivamente se paga)
- `costNeto` se calcula según el `ivaType`:
  - `excluded`: `costNeto = cost / 1.19` → NO, mejor: `costNeto = valorIngresado`, `cost = valorIngresado × 1.19`
  - `included`: `costNeto = valorIngresado / 1.19`, `cost = valorIngresado`
  - `exempt`: `costNeto = valorIngresado`, `cost = valorIngresado` (no hay IVA)

### 3. Configuración Global de Markups por Categoría

Almacenar en la base de datos (o en localStorage como configuración):

```
categoryMarkups = {
    "Abarrotes": 30,
    "Bebidas": 35,
    "Lácteos": 25,
    "Dulces": 50,
    "Limpieza": 40,
    "General": 30
}
```

El usuario puede editar estos valores desde **Configuración** o desde la vista de **Productos**.

---

## Flujo de Usuario (UI/UX)

### A. Al CREAR un producto nuevo

```
┌──────────────────────────────────────────────────────────────┐
│ NUEVO PRODUCTO                                                │
│                                                                │
│ Nombre: [________________________]                             │
│ Categoría: [Bebidas        ▼]                                  │
│                                                                │
│ ┌─── COSTO E IVA ──────────────────────────────────────────┐  │
│ │                                                            │  │
│ │ Tipo de costo:  (●) Sin IVA (neto)                         │  │
│ │                 ( ) Con IVA incluido                        │  │
│ │                 ( ) Exento de IVA                           │  │
│ │                                                            │  │
│ │ Costo ingresado (CLP)*:  [1.000]                           │  │
│ │                                                            │  │
│ │  ┌─ Desglose automático ──────────────────────────────┐    │  │
│ │  │  Costo neto:       $1.000                          │    │  │
│ │  │  IVA (19%):       +$190                            │    │  │
│ │  │  Costo real:       $1.190  ← base para el markup   │    │  │
│ │  └────────────────────────────────────────────────────┘    │  │
│ │                                                            │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                │
│ ┌─── MARKUP Y PRECIO DE VENTA ─────────────────────────────┐  │
│ │                                                            │  │
│ │ Markup (%):    [35] ← default de "Bebidas"                 │  │
│ │                                                            │  │
│ │ [Botones rápidos: 20% | 30% | 40% | 50% | 60%]           │  │
│ │                                                            │  │
│ │ Precio Venta:  [$1.610] ← calculado automático             │  │
│ │                  (editable: si lo cambias, el % se ajusta) │  │
│ │                                                            │  │
│ │  ┌─ Resumen de ganancia ──────────────────────────────┐    │  │
│ │  │  Ganancia bruta:    $420 por unidad                │    │  │
│ │  │  Ganancia neta:     $350 (sin IVA de la ganancia)  │    │  │
│ │  │  Margen s/venta:    26.1%                          │    │  │
│ │  └────────────────────────────────────────────────────┘    │  │
│ │                                                            │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                │
│ Stock: [___]  Stock Mín: [___]                                 │
│                                                                │
│                          [Cancelar] [Crear]                    │
└──────────────────────────────────────────────────────────────┘
```

### B. Comportamiento interactivo

**Regla fundamental: El usuario siempre tiene la última palabra.**

| Acción del usuario | Resultado |
|--------------------|-----------|
| Cambia el **Tipo de costo** (sin/con IVA) | Se recalcula el desglose (neto, IVA, costo real) y el Precio Venta |
| Cambia el **Costo ingresado** | Se recalcula el desglose y el Precio Venta usando el markup actual |
| Cambia el **Markup %** | Se recalcula el Precio Venta |
| Cambia el **Precio Venta manualmente** | Se recalcula el Markup % (inverso). Se marca como "ajuste manual" |
| Cambia la **Categoría** | Se carga el markup default de esa categoría SOLO si el markup no fue editado manualmente |
| Clic en botón rápido (20%, 30%, etc.) | Se aplica ese markup y recalcula precio |

### C. Fórmulas en tiempo real

**Paso 1: Determinar el costo real (con IVA) según el tipo de costo**

```
Si tipo = "Sin IVA" (neto):
   costoNeto  = valorIngresado
   ivaAmount  = costoNeto × 0.19
   costoReal  = costoNeto × 1.19

Si tipo = "Con IVA incluido":
   costoReal  = valorIngresado
   costoNeto  = valorIngresado / 1.19
   ivaAmount  = costoReal - costoNeto

Si tipo = "Exento de IVA":
   costoNeto  = valorIngresado
   costoReal  = valorIngresado
   ivaAmount  = 0
```

**Paso 2: Calcular precio de venta (al cambiar costo o markup)**

```
precioVenta    = redondear(costoReal × (1 + markup / 100))
gananciaBruta  = precioVenta - costoReal
gananciaNeta   = costoNeto × (markup / 100)
margenVenta    = ((precioVenta - costoReal) / precioVenta) × 100
```

**Paso 3: Recálculo inverso (al cambiar precio de venta manualmente)**

```
markup         = ((precioVenta - costoReal) / costoReal) × 100
gananciaBruta  = precioVenta - costoReal
gananciaNeta   = costoNeto × (markup / 100)
margenVenta    = ((precioVenta - costoReal) / precioVenta) × 100
```

**Flujo visual del cálculo:**

```
  [Costo ingresado]
        │
        ▼
  ¿Tipo de IVA?
   /     |      \
Sin IVA  Con IVA  Exento
  │        │        │
  ×1.19    (ya)     (=)
  │        │        │
  ▼        ▼        ▼
  [Costo Real]  ← base del cálculo
        │
        × (1 + markup/100)
        │
        ▼
  [Precio Venta] ← editable por el usuario
        │              (si lo edita, el markup se recalcula)
        ▼
  [Ganancia + Margen]
```

### D. Redondeo

Los precios deben redondearse a la **decena más cercana** (o al entero, según la configuración del negocio):

| Costo | Markup 35% | Exacto | Redondeado (decena) |
|-------|-----------|--------|-------------------|
| $1.000 | 35% | $1.350 | $1.350 |
| $750 | 35% | $1.012,5 | $1.010 |
| $420 | 40% | $588 | $590 |
| $3.200 | 30% | $4.160 | $4.160 |

> **Sugerencia:** Redondear a la decena superior ($590 en vez de $588) para no perder margen.

---

## Flujo al EDITAR un producto existente

Al abrir un producto existente:

1. **Si tiene `markupPercent` guardado:** Mostrar ese valor en el campo de markup
2. **Si NO tiene `markupPercent`:** Calcular el markup actual a partir de `cost` y `price`:
   ```
   markup = ((price - cost) / cost) × 100
   ```
   Si `cost = 0`: mostrar markup como vacío (no se puede calcular)

3. El usuario puede cambiar cualquier valor. Las mismas reglas de recálculo aplican.

---

## Casos Especiales

### Costo = 0
- No se puede calcular markup
- Mostrar mensaje: "Ingresa el costo para calcular el markup automáticamente"
- Permitir ingresar precio de venta manualmente sin markup

### Precio < Costo (venta a pérdida)
- El markup sería **negativo**
- Mostrar advertencia visual: "⚠️ Estás vendiendo por debajo del costo (-15%)"
- Color rojo en el campo de markup
- NO bloquear la acción (puede ser intencional: liquidación, promoción)

### Markup = 0%
- Precio venta = Costo
- Válido (venta al costo, por ejemplo para empleados o promociones)
- Mostrar indicador: "Sin ganancia"

### Productos importados con precio fijo
- El usuario puede ignorar el markup y escribir el precio de venta directamente
- El markup se calcula inversamente y se muestra como referencia
- Se guarda `markupPercent = null` para indicar que fue precio manual

### Cambio de tipo de IVA en un producto existente
- Si el usuario cambia de "Sin IVA" a "Con IVA" (o viceversa), el sistema debe preguntar:
  - "¿El valor del costo sigue siendo el mismo? El desglose cambiará."
- Recalcular neto, IVA y costo real según el nuevo tipo
- Recalcular precio de venta con el markup existente

### IVA y redondeo
- El costo neto puede tener decimales (ej: $1.190 / 1.19 = $1.000,00 exacto, pero $890 / 1.19 = $747,90)
- Internamente guardar con precisión; en la UI mostrar redondeado al entero
- El precio de venta final siempre se redondea a la decena

---

## Ejemplo Práctico Completo

**Escenario:** Tienda de abarrotes que compra al por mayor y vende al detalle.

### Compra al por mayor — Factura SIN IVA (proveedor mayorista):

| Producto | Costo neto (factura) | IVA 19% | Costo real | Markup | Precio Venta | Ganancia bruta |
|----------|---------------------|---------|------------|--------|-------------|---------------|
| Coca-Cola 1.5L | $850 | $162 | $1.012 | 35% | $1.370 | $358 |
| Arroz 1kg | $680 | $129 | $809 | 30% | $1.050 | $241 |
| Detergente 1L | $1.200 | $228 | $1.428 | 40% | $2.000 | $572 |

**Detalle paso a paso — Coca-Cola:**
```
Ingresa:  $850 (sin IVA)
Neto:     $850
IVA:      $850 × 0.19 = $161.5 → $162
Real:     $850 × 1.19 = $1.011.5 → $1.012
Markup:   35%
Venta:    $1.012 × 1.35 = $1.366 → redondeado: $1.370
Ganancia: $1.370 - $1.012 = $358
```

### Compra — Boleta CON IVA incluido (proveedor minorista):

| Producto | Costo con IVA (boleta) | Costo neto (extraído) | IVA contenido | Markup | Precio Venta | Ganancia bruta |
|----------|----------------------|----------------------|---------------|--------|-------------|---------------|
| Chicle unidad | $180 | $151 | $29 | 50% | $270 | $90 |
| Palta unidad | $600 | $504 | $96 | 60% | $960 | $360 |
| Jabón barra | $890 | $748 | $142 | 40% | $1.250 | $360 |

**Detalle paso a paso — Chicle:**
```
Ingresa:  $180 (con IVA)
Neto:     $180 / 1.19 = $151.26 → $151
IVA:      $180 - $151 = $29
Real:     $180 (ya es el costo real)
Markup:   50%
Venta:    $180 × 1.50 = $270
Ganancia: $270 - $180 = $90
```

### Compra — Producto EXENTO de IVA:

| Producto | Costo (exento) | IVA | Costo real | Markup | Precio Venta | Ganancia |
|----------|---------------|-----|------------|--------|-------------|----------|
| Pan amasado (kg) | $1.200 | $0 | $1.200 | 40% | $1.680 | $480 |

### Ajuste manual del precio de venta:

El usuario decide que la Coca-Cola debe venderse a $1.500 (no $1.370):
```
Escribe $1.500 en Precio Venta
El sistema recalcula:
   markup = ($1.500 - $1.012) / $1.012 × 100 = 48.2%
   ganancia bruta = $1.500 - $1.012 = $488
   ganancia neta  = $850 × 0.482 = $410
```
El porcentaje se ajusta automáticamente al nuevo precio. El usuario ve 48.2% en el campo de markup.

---

## Aplicación Masiva (Futuro)

Una funcionalidad futura sería poder aplicar un markup a **todos los productos de una categoría** de una sola vez:

```
"Aplicar 35% a todos los productos de Bebidas"
→ Recalcula precio de venta para todos los productos de esa categoría
→ Registra cada cambio en el historial de precios (C7)
→ Muestra preview antes de confirmar:

  Coca-Cola 1.5L: $1.000 → $1.350 (+$350)
  Sprite 1.5L:     $850 → $1.150 (+$300)
  Agua mineral:     $400 → $540 (+$140)
  
  [Cancelar] [Confirmar cambios (3 productos)]
```

---

## Resumen de Campos Afectados

### Producto (modelo)
- **Nuevo campo:** `markupPercent` (number | null) — porcentaje de markup aplicado
- **Nuevo campo:** `ivaType` (string: `'excluded'` | `'included'` | `'exempt'`) — tipo de IVA del costo
- **Nuevo campo:** `costNeto` (number) — costo sin IVA (base real del markup)
- **Campo existente `cost`:** Pasa a almacenar siempre el **costo real con IVA** (o sin IVA si es exento)
- **Campo existente `price`:** Sin cambios (precio de venta final)
- **Campo existente `category`:** Sin cambios

### Configuración (nuevo)
- **Nuevo almacenamiento:** `categoryMarkups` — objeto con porcentaje por defecto por categoría
- **Editable desde:** Configuración o vista de Productos

### UI del formulario de producto
- **Nuevo selector:** Tipo de costo (Sin IVA / Con IVA / Exento)
- **Nuevo campo:** Input de Markup (%)
- **Nuevo bloque:** Desglose de costo (neto, IVA, costo real) — solo lectura, calculado
- **Nuevo bloque:** Resumen de ganancia (bruta, neta, margen) — solo lectura, calculado
- **Nuevos elementos:** Botones rápidos de porcentaje
- **Comportamiento:** Recálculo bidireccional en tiempo real

### Sin cambios en:
- Lógica de ventas (sigue usando `price` como precio de venta)
- Cálculo de rentabilidad (sigue usando `cost` como costo real)
- Reportes
- Historial de precios (ya registra cambios automáticamente)

---

## Prioridad de Implementación

| Paso | Descripción | Complejidad |
|------|-------------|-------------|
| 1 | Agregar campos `markupPercent`, `ivaType`, `costNeto` al modelo Product | Baja |
| 2 | Agregar selector de tipo IVA (Sin/Con/Exento) al formulario de producto | Baja |
| 3 | Implementar desglose de costo (neto, IVA, real) con cálculo en tiempo real | Media |
| 4 | Agregar input de Markup (%) con recálculo bidireccional del precio de venta | Media |
| 5 | Botones rápidos de porcentaje en el formulario | Baja |
| 6 | Configuración de markups por categoría (defaults) | Media |
| 7 | Auto-cargar markup default al seleccionar categoría | Baja |
| 8 | Mostrar indicadores (ganancia bruta/neta, margen, advertencias) | Baja |
| 9 | Aplicación masiva por categoría (futuro) | Alta |

---

*Documento de diseño — Sin cambios al código. Listo para implementación cuando se apruebe.*
