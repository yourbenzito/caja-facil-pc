/**
 * ponytail: Base de datos centralizada de explicaciones contables didácticas.
 * Evita sobrecargar los archivos de vistas y mantiene las explicaciones en un solo lugar.
 */
const ReportsExplanations = {
    // 1. Dinero para Impuestos (IVA Débito)
    ivaDebito: {
        title: "📉 Dinero para Impuestos (IVA Débito)",
        description: "Es el impuesto (19%) que el Estado te obliga a cobrarle a tus clientes en cada venta con boleta. Este dinero no te pertenece; eres un intermediario que debe guardarlo para entregárselo al SII en tu declaración mensual (Formulario 29).",
        formula: "IVA = Total de la Venta - (Total de la Venta ÷ 1.19)",
        example: `
            <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 0.75rem; font-size: 0.85rem;">
                <strong>Ejemplo Real (1 Bebida vendida a $1.190):</strong><br>
                1. El cliente te paga <strong>$1.190</strong> en caja.<br>
                2. El valor neto (sin impuesto) es: $1.190 ÷ 1.19 = <strong>$1.000</strong>.<br>
                3. El IVA resultante es: $1.190 - $1.000 = <strong>$190</strong>.<br>
                <span style="color: #60a5fa;">💡 Debes reservar esos $190 para el pago mensual de impuestos.</span>
            </div>
        `
    },

    // 2. IVA a mi Favor (IVA Crédito)
    ivaCredito: {
        title: "📈 IVA a mi Favor (IVA Crédito)",
        description: "Es el IVA (19%) que tú ya pagaste al comprarle mercadería o insumos a tus proveedores mediante <strong>Facturas de Compra</strong>. Este valor actúa como un 'descuento' o saldo a tu favor que reduce directamente el monto de IVA que debes pagarle al SII.",
        formula: "IVA a Favor = Suma de todo el IVA detallado en tus facturas de compra del mes.",
        example: `
            <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 0.75rem; font-size: 0.85rem;">
                <strong>Ejemplo Real (Factura de distribuidora por $11.900):</strong><br>
                1. Le compraste mercadería a tu distribuidor por un total de <strong>$11.900</strong>.<br>
                2. El valor neto de los productos era de $10.000.<br>
                3. Pagaste <strong>$1.900</strong> de IVA en esa factura.<br>
                <span style="color: #34d399;">💡 Tienes $1.900 de saldo a tu favor para descontar de tus impuestos.</span>
            </div>
        `
    },

    // 3. Venta Limpia (Neto de Ventas)
    ventaLimpia: {
        title: "💰 Venta Limpia (Sin IVA)",
        description: "Es la suma de todo lo que has vendido, pero quitándole el 19% del impuesto del IVA. Este es el ingreso real de tu negocio sobre el cual se calculan tus márgenes de ganancia verdaderos.",
        formula: "Venta Limpia = Total Vendido ÷ 1.19",
        example: `
            <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 0.75rem; font-size: 0.85rem;">
                <strong>Ejemplo Real (Venta diaria total de $119.000):</strong><br>
                1. La caja del día cerró con <strong>$119.000</strong> ingresados.<br>
                2. Para saber tu ingreso limpio de impuestos: $119.000 ÷ 1.19 = <strong>$100.000</strong>.<br>
                3. Los otros $19.000 son el IVA que debes reservar.<br>
                <span style="color: #60a5fa;">💡 Tu base de ingresos reales del día fue de $100.000.</span>
            </div>
        `
    },

    // 4. Mi Ganancia Real (Bolsillo - Utilidad Neta)
    realProfit: {
        title: "💎 Mi Ganancia Real (Bolsillo)",
        description: "Es tu ganancia de bolsillo líquida y real. Representa el dinero libre que te queda tras descontar el impuesto del IVA (que es del fisco), recuperar la inversión que hiciste para reponer los productos vendidos (costo de compra) y restar los gastos de caja que hiciste en el día.",
        formula: "Ganancia Real = Venta Limpia - Costo Neto de Productos - Gastos Operacionales Netos",
        example: `
            <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 0.75rem; font-size: 0.85rem;">
                <strong>Ejemplo Real (Boleta de $3.868 con Bebida y Queso):</strong><br>
                • Recibiste en caja: $3.868 (con IVA).<br>
                • <strong>Venta Limpia (Sin IVA):</strong> $3.250.<br>
                • <strong>Costo Neto (Reposición):</strong> $1.750 ($500 de la bebida + $1.250 de los 250g de queso).<br>
                • <strong>Gastos de Caja:</strong> $0.<br>
                • <strong>Cálculo:</strong> $3.250 - $1.750 - $0 = <strong>$1.500</strong>.<br>
                <span style="color: #34d399;">💡 Te quedan exactamente $1.500 libres en el bolsillo.</span>
            </div>
        `
    },

    // 5. Cierres de Caja (Ganancias y Utilidad por Turno)
    cierres: {
        title: "🔒 Ganancia Neta del Turno",
        description: "Es el rendimiento neto que dejó la caja durante un turno específico de trabajo de un cajero. Muestra lo vendido restando los gastos directos entregados en caja (ej: pago a proveedores) y recuperando el costo neto de los artículos que salieron de bodega.",
        formula: "Ganancia Neta Turno = Ventas Netas del Turno - Gastos del Turno - Costo Neto de Productos Vendidos",
        example: `
            <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 0.75rem; font-size: 0.85rem;">
                <strong>Ejemplo Real (Turno de tarde de un cajero):</strong><br>
                1. Ventas Netas del turno: <strong>$100.000</strong>.<br>
                2. Pagos o Gastos realizados en caja: <strong>$10.000</strong> (ej: pago de panadería).<br>
                3. Costo neto de los productos vendidos: <strong>$60.000</strong>.<br>
                4. <strong>Ganancia Neta:</strong> $100.000 - $10.000 - $60.000 = <strong>$30.000</strong>.<br>
                <span style="color: #10b981;">💡 El cajero entrega su caja cuadrada y el negocio obtuvo $30.000 de utilidad real en ese turno.</span>
            </div>
        `
    },

    // 6. Costo de Compra de Productos
    costTotal: {
        title: "📦 Costo de Adquisición de Productos",
        description: "Es la suma de lo que a ti te costó comprar a tus distribuidores los productos que has vendido. Sirve para saber cuánto dinero de la venta total debes reservar exclusivamente para reponer stock y no descapitalizar tu local.",
        formula: "Costo Total = Cantidad Vendida × Costo de Compra Neto Unitario",
        example: `
            <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 0.75rem; font-size: 0.85rem;">
                <strong>Ejemplo Real (Venta de 10 paquetes de fideos):</strong><br>
                • Vendes 10 paquetes de fideos.<br>
                • A ti te cuesta $600 neto comprar cada paquete al distribuidor.<br>
                • <strong>Costo Total:</strong> 10 unidades × $600 = <strong>$6.000</strong>.<br>
                <span style="color: #60a5fa;">💡 Debes resguardar esos $6.000 para volver a comprar la misma cantidad de fideos al proveedor.</span>
            </div>
        `
    },

    // 7. Margen de Ganancia Porcentual
    margen: {
        title: "💎 Margen de Ganancia Porcentual",
        description: "Es el porcentaje que representa tu ganancia sobre el precio neto de venta de un producto. Indica qué tan rentable es vender ese artículo y qué porcentaje de cada venta queda libre de costo.",
        formula: "Margen % = (Ganancia ÷ Venta Neta) × 100",
        example: `
            <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 0.75rem; font-size: 0.85rem;">
                <strong>Ejemplo Real (Producto unitario o por peso):</strong><br>
                • Vendes una bebida a $1.000 neto (costó $500 neto). Ganancia = $500.<br>
                • <strong>Margen %:</strong> ($500 ÷ $1.000) × 100 = <strong>50%</strong>.<br><br>
                • Vendes 250g de queso a $2.250 neto (costó $1.250 neto). Ganancia = $1.000.<br>
                • <strong>Margen %:</strong> ($1.000 ÷ $2.250) × 100 = <strong>44.4%</strong>.<br>
                <span style="color: #34d399;">💡 A mayor porcentaje, el producto te deja más ganancia limpia por cada peso vendido.</span>
            </div>
        `
    },

    // Función para renderizar e inyectar el Modal Didáctico en la página
    showModal(key) {
        const item = this[key];
        if (!item) return;

        // Remover modal previo si existe
        const prev = document.getElementById('report-info-modal');
        if (prev) prev.remove();

        const modalHTML = `
            <div id="report-info-modal" style="
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(15, 23, 42, 0.6);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                font-family: 'Outfit', sans-serif;
                animation: modalFadeIn 0.25s ease-out;
            ">
                <div style="
                    background: linear-gradient(135deg, #1e293b, #0f172a);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 1.5rem;
                    padding: 2rem;
                    width: min(90%, 550px);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    position: relative;
                ">
                    <button onclick="document.getElementById('report-info-modal').remove()" style="
                        position: absolute;
                        top: 1rem; right: 1rem;
                        background: rgba(255,255,255,0.05);
                        border: none;
                        color: #94a3b8;
                        width: 2.2rem; height: 2.2rem;
                        border-radius: 50%;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 1rem;
                        font-weight: bold;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">✕</button>

                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
                        <h3 style="margin: 0; font-size: 1.4rem; font-weight: 800; color: #f8fafc;">${item.title}</h3>
                    </div>

                    <p style="color: #94a3b8; line-height: 1.6; font-size: 0.925rem; margin-bottom: 1.5rem; font-weight: 500;">
                        ${item.description}
                    </p>

                    <div style="background: rgba(99, 102, 241, 0.08); border: 1px dashed rgba(99, 102, 241, 0.3); padding: 1rem; border-radius: 0.75rem; margin-bottom: 1.5rem;">
                        <span style="font-size: 0.7rem; color: #818cf8; text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 0.25rem; letter-spacing: 0.5px;">🧮 Fórmula Contable del Sistema</span>
                        <code style="font-family: monospace; font-size: 1rem; color: #a5b4fc; font-weight: 700; display: block; word-break: break-all;">${item.formula}</code>
                    </div>

                    <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.25rem;">
                        <span style="font-size: 0.7rem; color: #34d399; text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 0.5rem; letter-spacing: 0.5px;">💡 Ejemplo de tu Negocio</span>
                        ${item.example}
                    </div>

                    <button onclick="document.getElementById('report-info-modal').remove()" style="
                        width: 100%;
                        background: #6366f1;
                        color: white;
                        border: none;
                        border-radius: 0.75rem;
                        padding: 0.85rem;
                        font-weight: 700;
                        font-size: 0.95rem;
                        cursor: pointer;
                        margin-top: 1.5rem;
                        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#4f46e5'" onmouseout="this.style.background='#6366f1'">
                        Entendido, cerrar
                    </button>
                </div>
            </div>

            <style>
                @keyframes modalFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
};

window.ReportsExplanations = ReportsExplanations;
