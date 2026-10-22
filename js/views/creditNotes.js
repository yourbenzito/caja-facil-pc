const CreditNotesView = {
    limit: 50,
    offset: 0,
    hasMore: true,
    isLoadingMore: false,
    allReturns: [],
    searchQuery: '',

    async loadInitialReturns() {
        try {
            if (db.mode === 'sqlite') {
                this.allReturns = await ApiClient.get('sale-returns/list/latest', {
                    limit: this.limit,
                    offset: 0
                });
            } else {
                // Fallback IndexedDB si aplica
                this.allReturns = await db.getAll('saleReturns');
                // Ordenar por fecha desc
                this.allReturns.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
            }
            this.hasMore = this.allReturns.length === this.limit;
            this.offset = 0;
        } catch (e) {
            console.error('Error al cargar notas de crédito:', e);
            showNotification('Error al cargar notas de crédito: ' + e.message, 'error');
            this.allReturns = [];
            this.hasMore = false;
        }
    },

    getFilteredReturns() {
        if (!this.searchQuery) return this.allReturns;
        const q = this.searchQuery.toLowerCase();
        return this.allReturns.filter(ret => {
            const idMatch = String(ret.id || '').includes(q);
            const saleMatch = String(ret.saleNumber || ret.saleId || '').includes(q);
            const clientMatch = String(ret.clientName || '').toLowerCase().includes(q);
            const reasonMatch = String(ret.reason || '').toLowerCase().includes(q);
            const itemMatch = (ret.items || []).some(it => String(it.name || '').toLowerCase().includes(q));
            return idMatch || saleMatch || clientMatch || reasonMatch || itemMatch;
        });
    },

    handleSearch(query) {
        this.searchQuery = (query || '').trim();
        const grid = document.getElementById('creditNotesGrid');
        if (grid) {
            grid.innerHTML = this.renderReturnCards(this.getFilteredReturns());
        }
    },

    async render() {
        if (this.offset === 0 && this.allReturns.length === 0) {
            await this.loadInitialReturns();
        }

        const filtered = this.getFilteredReturns();
        const cardsHtml = this.renderReturnCards(filtered);
        const totalRefunded = this.allReturns.reduce((acc, r) => acc + (parseFloat(r.totalReturned) || 0), 0);

        return `
            <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <h1 style="margin: 0; font-size: 1.75rem; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 0.5rem;">
                        ↩️ Notas de Crédito y Devoluciones
                    </h1>
                    <p style="margin: 0.35rem 0 0 0; color: #64748b; font-size: 0.95rem;">Registro oficial de devoluciones de productos y reembolsos a clientes</p>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <button type="button" class="btn btn-sm" onclick="CreditNotesView.exportReturnsPDF()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 800; background: #fef2f2; border: 1.5px solid #fecaca; color: #dc2626; border-radius: 0.5rem; padding: 0.5rem 0.9rem; cursor: pointer; transition: all 0.2s;" title="Descargar resumen de devoluciones en PDF">
                        <span>📄</span> <span>Resumen PDF</span>
                    </button>
                    <button type="button" class="btn btn-sm" onclick="CreditNotesView.exportReturnsExcel()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 800; background: #ecfdf5; border: 1.5px solid #a7f3d0; color: #047857; border-radius: 0.5rem; padding: 0.5rem 0.9rem; cursor: pointer; transition: all 0.2s;" title="Exportar devoluciones a planilla Excel">
                        <span>📊</span> <span>Exportar Excel</span>
                    </button>
                </div>
            </div>

            <!-- Resumen & Filtro Rápido -->
            <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.5rem; background: #ffffff; padding: 0.85rem 1.25rem; border-radius: 1rem; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div style="flex: 1; min-width: 250px;">
                    <input type="text" id="searchCreditNotes" class="form-control" placeholder="🔍 Buscar por N° Nota, N° Venta, cliente o producto..."
                           value="${safeHTML(this.searchQuery)}"
                           oninput="CreditNotesView.handleSearch(this.value)"
                           style="height: 42px; font-size: 0.9rem; border-radius: 0.5rem; border: 1.5px solid #cbd5e1; width: 100%;">
                </div>
                <div style="display: flex; gap: 0.75rem; align-items: center; padding: 0.35rem 0.85rem; background: #fef2f2; border-radius: 0.65rem; border: 1.5px solid #fecaca;">
                    <span style="font-size: 0.8rem; font-weight: 800; color: #991b1b; text-transform: uppercase;">Total Reembolsado:</span>
                    <strong id="creditNotesTotalRefunded" style="font-size: 1.15rem; font-weight: 950; color: #dc2626;">${formatCLP(totalRefunded)}</strong>
                    <span style="font-size: 0.75rem; color: #991b1b; font-weight: 600;">(${this.allReturns.length} registros)</span>
                </div>
            </div>

            <div class="credit-notes-container" style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div id="creditNotesGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem;">
                    ${cardsHtml}
                </div>
                
                ${this.hasMore ? `
                <div class="sales-load-more" style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin-top: 1.5rem;">
                    <button id="btnLoadMoreReturns" class="btn btn-secondary" onclick="CreditNotesView.loadMore()">
                        Cargar más
                    </button>
                    <span style="font-size: 0.85rem; color: var(--text-muted);">${this.allReturns.length} notas de crédito registradas</span>
                </div>
                ` : ''}
            </div>
        `;
    },

    renderReturnCards(returns) {
        if (!returns || returns.length === 0) {
            return `
                <div class="card" style="grid-column: 1 / -1; padding: 4rem 2rem; text-align: center; background: #fff; border: 2px dashed var(--border); border-radius: 1.5rem;">
                    <div style="font-size: 4rem; margin-bottom: 1.5rem; opacity: 0.3;">↩️</div>
                    <h3 style="color: var(--text-main); font-weight: 800; margin: 0 0 0.5rem 0;">No hay Notas de Crédito</h3>
                    <p style="color: var(--text-muted); margin: 0;">Las devoluciones de ventas que realices aparecerán listadas aquí.</p>
                </div>
            `;
        }

        return returns.map(ret => {
            const dateStr = ret.date || ret.createdAt || '';
            const items = ret.items || [];
            const clientName = ret.clientName || 'Público General';
            const total = parseFloat(ret.totalReturned) || 0;

            return `
                <div class="white-panel" style="display: flex; flex-direction: column; gap: 1rem; position: relative; transition: all 0.2s; border: 1px solid var(--border); box-shadow: var(--shadow-md); border-radius: 1rem; padding: 1.25rem; background: #ffffff;" onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='var(--primary)';" onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='var(--border)';">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
                        <div>
                            <div style="font-size: 0.8rem; color: var(--secondary); margin-bottom: 0.25rem; font-weight: 700;">
                                ${formatDateTime(dateStr)}
                            </div>
                            <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-main); font-weight: 800;">
                                Nota de Crédito #${ret.id}
                            </h3>
                            <div style="font-size: 0.85rem; color: var(--primary); font-weight: 600; margin-top: 0.25rem;">
                                📄 Venta de Origen: #${ret.saleNumber || ret.saleId}
                            </div>
                        </div>
                        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
                            <span style="background: rgba(239, 68, 68, 0.1); 
                                         color: #ef4444; 
                                         padding: 0.4rem 0.8rem; 
                                         border-radius: 0.75rem; 
                                         font-size: 0.85rem; 
                                         font-weight: 800; 
                                         border: 1px solid rgba(239,68,68,0.2);
                                         display: flex; 
                                         align-items: center; 
                                         gap: 0.25rem;">
                                ↩️ DEVOLUCIÓN
                            </span>
                            <div style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 0.25rem;">
                                👤 ${safeHTML(clientName)}
                            </div>
                        </div>
                    </div>

                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                            Productos Devueltos (${items.length})
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 0.35rem; max-height: 120px; overflow-y: auto; padding-right: 0.25rem;">
                            ${items.map(i => `
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; background: #f8fafc; padding: 0.35rem 0.5rem; border-radius: 0.375rem; border: 1px solid #f1f5f9;">
                                    <span style="font-weight: 600; color: #334155;">${safeHTML(i.name || `Producto #${i.productId}`)}</span>
                                    <span style="font-weight: 700; color: #64748b;">x${i.quantity}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    ${ret.reason ? `
                    <div style="font-size: 0.85rem; color: #475569; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 0.5rem; padding: 0.5rem 0.75rem;">
                        <strong>💡 Motivo:</strong> ${safeHTML(ret.reason)}
                    </div>
                    ` : ''}

                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: auto; flex-wrap: wrap; gap: 0.5rem;">
                        <div>
                            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; display: block;">Total Devuelto:</span>
                            <span style="font-size: 1.25rem; font-weight: 950; color: #dc2626;">
                                ${formatCLP(total)}
                            </span>
                        </div>
                        <div style="display: flex; gap: 0.4rem; align-items: center;">
                            <button type="button" class="btn btn-sm" onclick="CreditNotesView.printReturnTicket(${ret.id})" style="display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 800; border-radius: 0.5rem; padding: 0.35rem 0.65rem; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #334155; cursor: pointer; font-size: 0.8rem;" title="Imprimir vale de devolución térmico">
                                <span>🖨️</span> <span>Vale</span>
                            </button>
                            <button type="button" class="btn btn-sm" onclick="CreditNotesView.downloadReturnPDF(${ret.id})" style="display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 800; border-radius: 0.5rem; padding: 0.35rem 0.65rem; border: 1.5px solid #fecaca; background: #fef2f2; color: #dc2626; cursor: pointer; font-size: 0.8rem;" title="Descargar Nota de Crédito en PDF">
                                <span>📄</span> <span>PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    async printReturnTicket(returnId) {
        const ret = this.allReturns.find(r => r.id === returnId || Number(r.id) === Number(returnId));
        if (!ret) {
            showNotification('Devolución no encontrada', 'error');
            return;
        }

        const bizName = localStorage.getItem('BUSINESS_NAME') || 'Mi Negocio';
        const bizRut = localStorage.getItem('BUSINESS_RUT') || '';
        const bizAddress = localStorage.getItem('BUSINESS_ADDRESS') || '';
        const total = parseFloat(ret.totalReturned) || 0;
        const dateStr = formatDateTime(ret.date || ret.createdAt || new Date());
        const clientName = ret.clientName || 'Público General';
        const items = ret.items || [];

        const content = `
            <div id="printReturnSection" style="max-width: 340px; margin: 0 auto; font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #000; background: #fff; padding: 1.25rem; border-radius: 0.75rem; border: 1px dashed #cbd5e1;">
                <div style="text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
                    <h2 style="font-size: 1.15rem; font-weight: 900; margin: 0; text-transform: uppercase;">${bizName}</h2>
                    ${bizRut ? `<div style="font-size: 0.85rem;">RUT: ${bizRut}</div>` : ''}
                    ${bizAddress ? `<div style="font-size: 0.8rem; color: #475569;">${bizAddress}</div>` : ''}
                    <div style="margin-top: 0.5rem; font-weight: 800; font-size: 0.95rem; text-transform: uppercase; background: #fee2e2; color: #991b1b; padding: 0.25rem; border-radius: 4px;">
                        VALE DE DEVOLUCIÓN / NOTA CRÉDITO
                    </div>
                </div>

                <div style="margin-bottom: 0.75rem; font-size: 0.85rem; line-height: 1.4;">
                    <div><strong>Nota de Crédito:</strong> #${ret.id}</div>
                    <div><strong>Venta Origen:</strong> #${ret.saleNumber || ret.saleId}</div>
                    <div><strong>Fecha:</strong> ${dateStr}</div>
                    <div><strong>Cliente:</strong> ${clientName}</div>
                    ${ret.reason ? `<div><strong>Motivo:</strong> ${ret.reason}</div>` : ''}
                </div>

                <div style="border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 0.5rem 0; margin-bottom: 0.75rem;">
                    <div style="font-weight: 800; font-size: 0.8rem; margin-bottom: 0.35rem; text-transform: uppercase;">Productos Devueltos al Stock:</div>
                    ${items.map(it => `
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.2rem;">
                            <span>${it.name || `Prod #${it.productId}`}</span>
                            <span>x${it.quantity}</span>
                        </div>
                    `).join('')}
                </div>

                <div style="text-align: center; margin-bottom: 1.25rem; border: 2px solid #ef4444; background: #fef2f2; border-radius: 8px; padding: 0.75rem;">
                    <div style="font-size: 0.8rem; font-weight: 700; color: #991b1b; text-transform: uppercase;">Total Reembolsado / Reintegrado</div>
                    <div style="font-size: 1.5rem; font-weight: 950; color: #dc2626; margin-top: 0.25rem;">${formatCLP(total)}</div>
                </div>

                <div style="margin-top: 2rem; border-top: 1px dashed #94a3b8; padding-top: 0.5rem; text-align: center; font-size: 0.8rem; color: #64748b;">
                    <div>Firma Conformidad del Cliente</div>
                    <div style="margin-top: 2.5rem; border-bottom: 1px solid #000; width: 70%; margin-left: auto; margin-right: auto;"></div>
                    <div style="margin-top: 0.35rem; font-size: 0.75rem;">RUT / Nombre</div>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">✕ Cerrar</button>
            <button class="btn btn-primary" onclick="CreditNotesView.printReturnElement()" style="font-weight: 900; background: linear-gradient(135deg, #ef4444, #dc2626); border: none; padding: 0.6rem 1.5rem;">
                🖨️ Mandar a Imprimir
            </button>
        `;

        showModal(content, { title: `🖨️ Vale de Devolución #${ret.id}`, footer, width: '400px' });
    },

    printReturnElement() {
        const printContent = document.getElementById('printReturnSection');
        if (!printContent) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
                <head>
                    <title>Vale de Devolución</title>
                    <style>
                        @page { margin: 0; size: 80mm auto; }
                        body { margin: 10px; font-family: 'Courier New', monospace; font-size: 13px; color: #000; background: #fff; }
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                </body>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 1000);
        }, 300);
    },

    async downloadReturnPDF(returnId) {
        try {
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : null;
            if (!jsPDF) {
                showNotification('Módulo PDF no disponible', 'warning');
                return;
            }

            const ret = this.allReturns.find(r => r.id === returnId || Number(r.id) === Number(returnId));
            if (!ret) {
                showNotification('Devolución no encontrada', 'error');
                return;
            }

            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const bizName = localStorage.getItem('BUSINESS_NAME') || 'Mi Negocio';
            const bizRut = localStorage.getItem('BUSINESS_RUT') || '';
            const bizAddress = localStorage.getItem('BUSINESS_ADDRESS') || '';
            const bizPhone = localStorage.getItem('BUSINESS_PHONE') || '';
            const total = parseFloat(ret.totalReturned) || 0;

            // Header Banner
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, 595, 70, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(bizName.toUpperCase(), 40, 36);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const subTitle = [bizRut ? `RUT: ${bizRut}` : null, bizAddress, bizPhone].filter(Boolean).join(' | ');
            if (subTitle) doc.text(subTitle, 40, 52);

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`NOTA DE CRÉDITO`, 435, 32);
            doc.setFontSize(13);
            doc.setTextColor(239, 68, 68);
            doc.text(`#${ret.id}`, 435, 50);

            // Metadata Box
            let y = 90;
            doc.setFillColor(248, 250, 252);
            doc.rect(40, y, 515, 52, 'F');
            doc.setDrawColor(203, 213, 225);
            doc.rect(40, y, 515, 52, 'D');

            doc.setTextColor(30, 41, 59);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`Fecha Emisión:`, 50, y + 18);
            doc.setFont('helvetica', 'normal');
            doc.text(formatDateTime(ret.date || ret.createdAt || new Date()), 130, y + 18);

            doc.setFont('helvetica', 'bold');
            doc.text(`Venta de Origen:`, 50, y + 36);
            doc.setFont('helvetica', 'normal');
            doc.text(`#${ret.saleNumber || ret.saleId}`, 130, y + 36);

            doc.setFont('helvetica', 'bold');
            doc.text(`Cliente:`, 310, y + 18);
            doc.setFont('helvetica', 'normal');
            doc.text(ret.clientName || 'Público General', 360, y + 18);

            doc.setFont('helvetica', 'bold');
            doc.text(`Motivo:`, 310, y + 36);
            doc.setFont('helvetica', 'normal');
            doc.text(ret.reason || 'Devolución de productos', 360, y + 36);

            // Table of items
            const items = ret.items || [];
            const rows = items.map(it => [
                it.productId ? `#${it.productId}` : '—',
                it.name || 'Producto',
                it.quantity || 1,
                'Reincorporado al inventario'
            ]);

            if (doc.autoTable) {
                doc.autoTable({
                    startY: y + 65,
                    head: [['Código', 'Producto Devuelto', 'Cantidad', 'Destino del Stock']],
                    body: rows,
                    theme: 'striped',
                    headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                    bodyStyles: { fontSize: 8.5, textColor: [15, 23, 42] },
                    margin: { left: 40, right: 40 }
                });
                y = doc.lastAutoTable.finalY + 20;
            } else {
                y += 120;
            }

            // Total Refund Box
            doc.setFillColor(254, 242, 242);
            doc.rect(340, y, 215, 45, 'F');
            doc.setDrawColor(254, 202, 202);
            doc.rect(340, y, 215, 45, 'D');

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(185, 28, 28);
            doc.text(`TOTAL REEMBOLSADO:`, 355, y + 26);
            doc.setFontSize(13);
            doc.text(formatCLP(total), 535, y + 26, { align: 'right' });

            // Signature
            y += 90;
            doc.setDrawColor(148, 163, 184);
            doc.line(160, y, 435, y);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text('Firma de Conformidad del Cliente / Receptor de Fondos', 297, y + 15, { align: 'center' });

            const fileName = `nota_credito_${ret.id}.pdf`;
            doc.save(fileName);
            showNotification('Nota de Crédito PDF descargada con éxito', 'success');
        } catch (e) {
            console.error('Error al exportar nota de crédito a PDF:', e);
            showNotification('Error al generar PDF de la nota de crédito', 'error');
        }
    },

    async exportReturnsPDF() {
        try {
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : null;
            if (!jsPDF) {
                showNotification('Módulo PDF no disponible', 'warning');
                return;
            }

            const returns = this.getFilteredReturns();
            if (returns.length === 0) {
                showNotification('No hay notas de crédito para exportar', 'warning');
                return;
            }

            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const bizName = localStorage.getItem('BUSINESS_NAME') || 'Mi Negocio';
            const bizRut = localStorage.getItem('BUSINESS_RUT') || '';
            const now = new Date();
            const total = returns.reduce((acc, r) => acc + (parseFloat(r.totalReturned) || 0), 0);

            // Banner superior
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, 595, 65, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(bizName.toUpperCase(), 40, 38);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('INFORME DE NOTAS DE CRÉDITO Y DEVOLUCIONES', 295, 38);

            // Subheader
            let y = 90;
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(9);
            if (bizRut) { doc.text(`RUT Comercio: ${bizRut}`, 40, y); y += 13; }
            doc.text(`Registros: ${returns.length}  |  Emisión: ${now.toLocaleDateString('es-CL')} ${now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`, 40, y);

            // Box Total
            y += 18;
            doc.setFillColor(254, 242, 242);
            doc.rect(40, y, 515, 32, 'F');
            doc.setDrawColor(254, 202, 202);
            doc.rect(40, y, 515, 32, 'D');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(185, 28, 28);
            doc.text(`TOTAL REEMBOLSADO EN DEVOLUCIONES: ${formatCLP(total)}`, 50, y + 20);

            // Table with autoTable
            const rows = returns.map(r => {
                const dateStr = formatDateTime(r.date || r.createdAt || '');
                const client = r.clientName || 'General';
                const itemsCount = (r.items || []).length;
                return [
                    `#${r.id}`,
                    `#${r.saleNumber || r.saleId}`,
                    dateStr,
                    client,
                    r.reason || 'Devolución',
                    `${itemsCount} prod.`,
                    formatCLP(r.totalReturned || 0)
                ];
            });

            if (doc.autoTable) {
                doc.autoTable({
                    startY: y + 45,
                    head: [['N° Nota', 'Venta Origen', 'Fecha', 'Cliente', 'Motivo', 'Items', 'Total Devuelto']],
                    body: rows,
                    theme: 'striped',
                    headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                    bodyStyles: { fontSize: 8.5, textColor: [15, 23, 42] },
                    margin: { left: 40, right: 40 }
                });
            }

            const fileName = `informe_devoluciones_${now.toISOString().slice(0, 10)}.pdf`;
            doc.save(fileName);
            showNotification('Resumen de devoluciones PDF generado con éxito', 'success');
        } catch (e) {
            console.error('Error al exportar devoluciones en PDF:', e);
            showNotification('Error al exportar devoluciones en PDF', 'error');
        }
    },

    async exportReturnsExcel() {
        try {
            if (typeof XLSX === 'undefined') {
                showNotification('Librería Excel no disponible', 'warning');
                return;
            }

            const returns = this.getFilteredReturns();
            if (returns.length === 0) {
                showNotification('No hay notas de crédito para exportar', 'warning');
                return;
            }

            const data = returns.map(r => {
                const itemsStr = (r.items || []).map(i => `${i.name || i.productId} (x${i.quantity})`).join(', ');
                return {
                    'N° Nota Crédito': r.id,
                    'Venta Origen': r.saleNumber || r.saleId,
                    'Fecha': formatDateTime(r.date || r.createdAt || ''),
                    'Cliente': r.clientName || 'Público General',
                    'Motivo': r.reason || '',
                    'Total Devuelto ($)': parseFloat(r.totalReturned) || 0,
                    'Productos Devueltos': itemsStr
                };
            });

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Notas de Crédito');
            const fileName = `devoluciones_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);
            showNotification('Planilla Excel de devoluciones exportada con éxito', 'success');
        } catch (e) {
            console.error('Error al exportar devoluciones a Excel:', e);
            showNotification('Error al exportar Excel de devoluciones', 'error');
        }
    },

    async loadMore() {
        if (this.isLoadingMore) return;
        this.isLoadingMore = true;

        const btn = document.getElementById('btnLoadMoreReturns');
        if (btn) btn.innerHTML = '<span class="spinner-inline"></span> Cargando...';

        this.offset += this.limit;
        let newReturns = [];

        try {
            if (db.mode === 'sqlite') {
                newReturns = await ApiClient.get('sale-returns/list/latest', {
                    limit: this.limit,
                    offset: this.offset
                });
            } else {
                newReturns = [];
            }

            if (newReturns.length < this.limit) {
                this.hasMore = false;
            }

            this.allReturns = [...this.allReturns, ...newReturns];
            this.isLoadingMore = false;
            await this.refresh();
        } catch (e) {
            console.error('Error al cargar más notas de crédito:', e);
            showNotification('Error al cargar más: ' + e.message, 'error');
            this.isLoadingMore = false;
            if (btn) btn.textContent = 'Cargar más';
        }
    },

    async refresh() {
        const content = await this.render();
        const container = document.getElementById('view-container');
        if (container) container.innerHTML = content;
    },

    async init() {
        // No init actions needed
    }
};
