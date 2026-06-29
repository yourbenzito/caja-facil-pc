const CreditNotesView = {
    limit: 50,
    offset: 0,
    hasMore: true,
    isLoadingMore: false,
    allReturns: [],

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

    async render() {
        if (this.offset === 0 && this.allReturns.length === 0) {
            await this.loadInitialReturns();
        }

        const cardsHtml = this.renderReturnCards(this.allReturns);

        return `
            <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
                <div>
                    <h1 style="margin: 0; font-size: 1.75rem; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 0.5rem;">
                        ↩️ Notas de Crédito
                    </h1>
                    <p style="margin: 0.35rem 0 0 0; color: #64748b; font-size: 0.95rem;">Registro oficial de devoluciones de productos y reembolsos a clientes</p>
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

                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: auto;">
                        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Total Devuelto:</span>
                        <span style="font-size: 1.3rem; font-weight: 900; color: #dc2626;">
                            ${formatCLP(total)}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
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
