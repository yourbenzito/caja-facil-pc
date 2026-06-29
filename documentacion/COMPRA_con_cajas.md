# Lógica para Ingreso de Compras por Caja

Este documento describe la idea para implementar una calculadora automática de costos unitarios cuando los productos se compran en formatos de caja o display.

## El Problema
En las facturas de proveedores, a menudo los precios vienen expresados por el total de la caja ($K$) y no por unidad. Además, el cálculo del costo unitario neto depende de si la factura es **Neto** (sin IVA) o **Bruta** (con IVA).

## La Idea: "Calculadora de Caja"
Integrar un asistente dentro del Paso 2 de "Nueva Compra" que realice el siguiente cálculo automático:

### 1. Variables de entrada:
- **Unidades por Caja:** Cantidad de productos dentro de una caja (ej. 12, 24).
- **Costo por Caja:** Valor $K$ que aparece en la factura por la caja completa.
- **Cantidad de Cajas:** Cuántas cajas se están comprando.

### 2. Algoritmo de Cálculo:
- **Cantidad Total de Unidades:** `Unidades por Caja * Cantidad de Cajas`.
- **Copa Unitario (Modo Neto):** `Costo por Caja / Unidades por Caja`.
- **Copa Unitario (Modo Bruto):** `(Costo por Caja / Unidades por Caja) / 1.19`.

## Beneficios Esperados
- **Precisión:** Elimina errores manuales al desglosar el IVA.
- **Velocidad:** Evita el uso de calculadoras externas.
- **Trazabilidad:** Permite ver el margen de ganancia real basado en el costo unitario exacto antes de confirmar.

---
*Idea propuesta para futura implementación en sistema de ventas.*
