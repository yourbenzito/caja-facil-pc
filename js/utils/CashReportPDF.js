/**
 * CashReportPDF.js
 * Genera el Reporte "Z" en PDF para el cierre de caja y lo guarda en la carpeta
 * Escritorio/registros e historial de arqueo de cajas/
 */
const CashReportPDF = {
    /**
     * Genera el Reporte "X" (Lectura parcial informativa del turno en vivo sin cerrar la caja)
     * Falla #27: Distinción formal de Corte X vs Corte Z
     */
    async generateReportX(summary, cashRegister, userStr = 'Cajero') {
        try {
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : null;
            if (!jsPDF) {
                console.error("jsPDF no está cargado.");
                return { success: false, error: "jsPDF no disponible" };
            }

            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const id = cashRegister?.id || Date.now();
            const openDate = cashRegister?.openDate ? (typeof formatDate === 'function' ? formatDate(cashRegister.openDate) : cashRegister.openDate) : 'N/A';
            const now = new Date();
            const nowStr = typeof formatDate === 'function' ? formatDate(now) + ' ' + (typeof formatTime === 'function' ? formatTime(now) : now.toLocaleTimeString()) : now.toLocaleString();
            const formatCLP = typeof formatCurrency === 'function' ? formatCurrency : (v => '$' + Math.round(v || 0).toLocaleString('es-CL'));

            // Encabezado Azul Informativo (Distingue Corte X de Corte Z)
            doc.setFillColor(30, 64, 175); // #1e40af (Azul Corte X)
            doc.rect(0, 0, 595, 70, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text('CORTE X - LECTURA PARCIAL EN VIVO', 40, 42);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Caja #${id} (Turno en curso) | ${nowStr}`, 360, 42);

            let y = 100;
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('📊 ESTADO ACTUAL DEL TURNO (CAJA ABIERTA)', 40, y);

            y += 20;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Responsable: ${userStr}`, 40, y);
            doc.text(`Apertura de Turno: ${openDate}`, 280, y);

            y += 25;
            doc.setDrawColor(203, 213, 225);
            doc.line(40, y, 555, y);

            y += 20;
            const initialAmount = summary?.initialAmount || cashRegister?.initialAmount || 0;
            const expectedCash = summary?.expectedCash || cashRegister?.expectedAmount || 0;
            const cashSales = summary?.paymentSummary?.cash || summary?.cashSales || 0;
            const cardSales = summary?.paymentSummary?.card || summary?.cardSales || 0;
            const transferSales = summary?.paymentSummary?.other || summary?.transferSales || 0;
            const totalSales = cashSales + cardSales + transferSales;

            doc.setFont('helvetica', 'bold');
            doc.text('Concepto', 40, y);
            doc.text('Monto', 500, y, { align: 'right' });

            y += 15;
            doc.setFont('helvetica', 'normal');
            doc.text('Fondo Inicial de Caja:', 40, y);
            doc.text(formatCLP(initialAmount), 500, y, { align: 'right' });

            y += 16;
            doc.text('Ventas en Efectivo:', 40, y);
            doc.text(formatCLP(cashSales), 500, y, { align: 'right' });

            y += 16;
            doc.text('Ventas con Tarjeta:', 40, y);
            doc.text(formatCLP(cardSales), 500, y, { align: 'right' });

            y += 16;
            doc.text('Ventas por Transferencia / QR:', 40, y);
            doc.text(formatCLP(transferSales), 500, y, { align: 'right' });

            y += 20;
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(241, 245, 249);
            doc.rect(40, y - 12, 515, 24, 'F');
            doc.text('TOTAL VENTAS DEL TURNO:', 50, y + 4);
            doc.text(formatCLP(totalSales), 500, y + 4, { align: 'right' });

            y += 30;
            doc.setFillColor(224, 231, 255);
            doc.rect(40, y - 12, 515, 26, 'F');
            doc.setTextColor(30, 58, 138);
            doc.text('EFECTIVO ESPERADO EN GAVETA (EN VIVO):', 50, y + 6);
            doc.text(formatCLP(expectedCash), 500, y + 6, { align: 'right' });

            y += 40;
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.text('* Este documento es una lectura informativa provisional. La caja permanece abierta para seguir operando.', 40, y);

            doc.save(`Corte_X_Caja_${id}_${Date.now()}.pdf`);
            return { success: true };
        } catch (e) {
            console.error('Error generando Corte X:', e);
            return { success: false, error: e.message };
        }
    },
    async generateAndSave(summary, cashRegister, userStr = 'Administrador') {
        try {
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : null;
            if (!jsPDF) {
                console.error("jsPDF no está cargado en el sistema.");
                return { success: false, error: "jsPDF no disponible" };
            }

            const doc = new jsPDF({ unit: 'pt', format: 'a4' });

            const id = cashRegister?.id || Date.now();
            const openDate = cashRegister?.openDate ? formatDate(cashRegister.openDate) + ' ' + formatTime(cashRegister.openDate) : 'N/A';
            const closeDate = cashRegister?.closeDate ? formatDate(cashRegister.closeDate) + ' ' + formatTime(cashRegister.closeDate) : formatDate(new Date());
            
            const initialAmount = summary?.initialAmount || cashRegister?.initialAmount || 0;
            const expectedCash = summary?.expectedCash || cashRegister?.expectedAmount || 0;
            const finalAmount = summary?.finalAmount !== undefined ? summary.finalAmount : (cashRegister?.finalAmount || 0);
            const diff = finalAmount - expectedCash;

            // Encabezado
            doc.setFillColor(15, 23, 42); // #0f172a
            doc.rect(0, 0, 595, 70, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.text('REPORTE Z - CIERRE DE CAJA', 40, 42);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Caja #${id} | Impreso el ${formatDate(new Date())}`, 380, 42);

            // Información General
            let y = 100;
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('📌 Datos de la Sesión', 40, y);

            y += 18;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Apertura: ${openDate}`, 40, y);
            doc.text(`Cierre: ${closeDate}`, 250, y);
            doc.text(`Usuario: ${userStr}`, 450, y);

            y += 25;
            doc.setDrawColor(226, 232, 240);
            doc.line(40, y, 555, y);

            // Resumen de Efectivo y Arqueo
            y += 25;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('💵 Resumen de Efectivo y Arqueo', 40, y);

            y += 20;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Monto Inicial (Sencillo):`, 50, y);
            doc.text(`$${Math.round(initialAmount).toLocaleString('es-CL')}`, 250, y);

            y += 16;
            doc.text(`Ingresos Netos Efectivo:`, 50, y);
            doc.text(`$${Math.round(summary?.cashForDisplay || 0).toLocaleString('es-CL')}`, 250, y);

            y += 16;
            doc.setFont('helvetica', 'bold');
            doc.text(`Efectivo Esperado Real:`, 50, y);
            doc.text(`$${Math.round(expectedCash).toLocaleString('es-CL')}`, 250, y);

            y += 16;
            doc.text(`Efectivo Real Contado:`, 50, y);
            doc.text(`$${Math.round(finalAmount).toLocaleString('es-CL')}`, 250, y);

            y += 18;
            const diffColor = diff === 0 ? [16, 185, 129] : (diff > 0 ? [59, 130, 246] : [239, 68, 68]);
            doc.setTextColor(diffColor[0], diffColor[1], diffColor[2]);
            doc.setFontSize(11);
            const diffLabel = diff === 0 ? 'Cuadró Perfecto ($0)' : (diff > 0 ? `Sobrante: +$${Math.round(diff).toLocaleString('es-CL')}` : `Faltante: -$${Math.round(Math.abs(diff)).toLocaleString('es-CL')}`);
            doc.text(`Resultado de Arqueo: ${diffLabel}`, 50, y);

            y += 25;
            doc.setTextColor(30, 41, 59);
            doc.line(40, y, 555, y);

            // Métodos de Pago
            y += 25;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('💳 Desglose por Medios de Pago', 40, y);

            const card = summary?.paymentSummary?.card || 0;
            const qr = summary?.paymentSummary?.qr || 0;
            const other = summary?.paymentSummary?.other || 0;

            y += 20;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Tarjetas (Débito/Crédito): $${Math.round(card).toLocaleString('es-CL')}`, 50, y);
            doc.text(`Transferencia / QR: $${Math.round(qr).toLocaleString('es-CL')}`, 250, y);
            doc.text(`Otros Medios: $${Math.round(other).toLocaleString('es-CL')}`, 450, y);

            y += 30;
            doc.line(40, y, 555, y);

            // Resumen de Ventas de la Sesión
            y += 25;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('📊 Totales de Ventas del Turno', 40, y);

            y += 20;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Total Vendido: $${Math.round(summary?.totalSalesAmount || 0).toLocaleString('es-CL')}`, 50, y);
            doc.text(`Cantidad de Tickets: ${summary?.totalSales || 0}`, 250, y);

            // Pie de página institucional
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text('Sistema POS Minimarket - Reporte Z generado automáticamente.', 40, 800);

            // Guardar en escritorio si api existe, o fallback a doc.save
            const filename = `cierre_caja_${id}_${Date.now()}.pdf`;

            if (window.api && typeof window.api.saveCashPdfToDesktop === 'function') {
                const base64Data = doc.output('datauristring').split(',')[1];
                const res = await window.api.saveCashPdfToDesktop({ filename, base64Data });
                if (res.ok) {
                    return { success: true, path: res.path, isNative: true };
                }
            }

            // Fallback para navegador web
            doc.save(filename);
            return { success: true, isNative: false };
        } catch (error) {
            console.error('Error generando PDF de Cierre de Caja:', error);
            return { success: false, error: error.message };
        }
    }
};
