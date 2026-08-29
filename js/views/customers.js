const CustomersView = {
    async render() {
        let customers = [];
        let debtMap = {};
        
        if (db.mode === 'sqlite') {
            const summary = await CustomerAccountService.getCustomersWithBalance();
            if (summary) {
                customers = summary.map(c => ({
                    ...c,
                    balanceCredit: c.balanceCredit || 0
                }));
                summary.forEach(c => {
                    debtMap[c.id] = c.totalDebt || 0;
                });
            } else {
                customers = await Customer.getAll();
            }
        } else {
            customers = await Customer.getAll();
            const pendingSales = await Sale.getPendingSales();
            pendingSales.forEach(sale => {
                if (sale.customerId) {
                    const debt = (parseFloat(sale.total) || 0) - (parseFloat(sale.paidAmount) || 0);
                    if (debt > 0) {
                        debtMap[sale.customerId] = (debtMap[sale.customerId] || 0) + debt;
                    }
                }
            });
        }

        // Cargar límites del semáforo desde ajustes
        let limitMild = 15000;
        let limitHigh = 30000;
        try {
            const rowMild = await db.get('settings', 'debtLimitMild');
            if (rowMild) limitMild = parseInt(rowMild.value) || 15000;
            const rowHigh = await db.get('settings', 'debtLimitHigh');
            if (rowHigh) limitHigh = parseInt(rowHigh.value) || 30000;
        } catch(e) {
            console.warn('Error loading debt limits:', e);
        }

        // Calculate Top Customers (by volume) from last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        let allSales = [];
        try {
            // Limitamos a 30 días para no saturar el navegador si hay miles de ventas
            allSales = await Sale.getByDateRange(thirtyDaysAgo.toISOString(), new Date().toISOString());
            // Si hay demasiadas ventas (> 1000), solo tomamos las últimas para el cálculo
            if (allSales.length > 1000) {
                allSales = allSales.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 1000);
            }
        } catch (e) {
            console.warn('Error fetching sales for top customers:', e);
        }

        const volumeMap = {};
        allSales.forEach(s => {
            if (s.customerId && s.status !== 'cancelled') {
                volumeMap[s.customerId] = (volumeMap[s.customerId] || 0) + (parseFloat(s.total) || 0);
            }
        });

        // C10: PRIORIDAD - Ordenar por DEUDA (Mayor a menor)
        // Si la deuda es igual, ordenar por nombre (A-Z)
        customers.sort((a, b) => {
            const debtA = debtMap[a.id] || 0;
            const debtB = debtMap[b.id] || 0;
            if (debtB !== debtA) return debtB - debtA;
            return (a.name || '').localeCompare(b.name || '');
        });

        // Get Top 3 Customers
        const topCustomers = [...customers]
            .filter(c => volumeMap[c.id] > 0)
            .sort((a, b) => volumeMap[b.id] - volumeMap[a.id])
            .slice(0, 3);

        const isPrivacyActive = localStorage.getItem('customers_privacy_mode') === 'true';

        return `
            <div class="view-header">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h1>Clientes</h1>
                        <p>Gestiona tu base de clientes</p>
                    </div>
                    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="CustomersView.togglePrivacyMode()" id="btnPrivacyMode" title="Modo Incógnito / Ocultar deudas de la pantalla">
                            ${isPrivacyActive ? '👁️‍🗨️ Mostrar Saldos' : '👁️ Ocultar Saldos'}
                        </button>
                        <button class="btn btn-info" onclick="CustomersView.showPaymentsHistoryModal()" title="Ver historial de abonos recibidos por fecha">
                            📅 Historial Pagos
                        </button>
                        ${PermissionService.can('customers.delete') ? `
                        <button class="btn btn-warning" onclick="CustomersView.showDeletedCustomers()" title="Ver clientes desactivados">
                            📋 Desactivados
                        </button>` : ''}
                        ${PermissionService.can('customers.create') ? `
                        <button class="btn btn-primary" onclick="CustomersView.showCustomerForm()">
                            Nuevo Cliente
                        </button>` : ''}
                    </div>
                </div>
            </div>
                   <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                ${topCustomers.map((c, i) => `
                    <div style="background: #ffffff; border: 1.5px solid ${['#fde68a','#e2e8f0','#fecaca'][i]}; border-left: 5px solid ${['#f59e0b','#94a3b8','#f87171'][i]}; border-radius: 1.25rem; padding: 1.5rem; position: relative; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 10px rgba(0,0,0,0.05);" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 28px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 10px rgba(0,0,0,0.05)'">
                        <div style="position: absolute; right: 1rem; top: 0.5rem; font-size: 4rem; opacity: 0.08; font-weight: 900; color: #111827;">${i + 1}</div>
                        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'][i]}</div>
                        <h3 style="margin:0; font-size: 1.05rem; color: #111827; font-weight: 800; text-transform: capitalize;">${safeHTML(c.name)}</h3>
                        <p style="color: ${['#b45309','#475569','#f87171'][i]}; font-weight: 800; font-size: 1.2rem; margin: 0.25rem 0;">${isPrivacyActive ? '$ ••••' : formatCLP(volumeMap[c.id])}</p>
                        <span style="font-size: 0.7rem; color: #6b7280; text-transform: uppercase; font-weight: 700;">Volumen Total Compras</span>
                    </div>
                `).join('')}
                ${topCustomers.length === 0 ? '<div style="background: #f9fafb; border: 1.5px dashed #d1d5db; border-radius: 1.25rem; padding: 2rem; text-align: center; color: #9ca3af; font-style: italic;">No hay actividad de clientes aún</div>' : ''}
            </div>

            <div class="card" style="padding: 1.5rem; background: #fff1f2; border: 3px solid #e11d48; box-shadow: 0 10px 25px rgba(225, 29, 72, 0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                    <h2 style="margin:0; font-size: 1.4rem; font-weight: 800; color: #9f1239;">👥 Listado de Clientes</h2>
                    <div class="search-box" style="width: 100%; max-width: 400px;">
                        <input type="text" id="searchCustomers" class="form-control" placeholder="🔍 Buscar cliente por nombre..." style="border: 2px solid #e11d48; font-size: 1.1rem; height: 50px;">
                    </div>
                </div>
                
                <div id="customersTable" style="background: #ffffff; border-radius: 1rem; padding: 1rem; border: 1.5px solid #fecaca;">
                    ${this.renderCustomersTable(customers, debtMap, {}, limitMild, limitHigh)}
                </div>
            </div>
        `;
    },

    focusSearch() {
        const el = document.getElementById('searchCustomers');
        if (el) { el.focus(); el.select?.(); }
    },

    async init() {
        const searchInput = document.getElementById('searchCustomers');
        if (!searchInput) return;

        setTimeout(() => { searchInput.focus(); }, 100);

        // Autofoco automático: al ingresar o escribir cualquier tecla sin clic, enfocar el buscador
        const customersGlobalKeydown = (e) => {
            if (app.currentView !== 'customers') return;
            const activeElem = document.activeElement;
            const activeTag = activeElem ? activeElem.tagName.toUpperCase() : '';
            const activeModal = document.querySelector('.modal') || document.body.classList.contains('modal-open');
            if (!activeModal && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
                if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (searchInput && activeElem !== searchInput) {
                        searchInput.focus();
                    }
                }
            }
        };
        if (document._customersGlobalKeydown) document.removeEventListener('keydown', document._customersGlobalKeydown);
        document._customersGlobalKeydown = customersGlobalKeydown;
        document.addEventListener('keydown', customersGlobalKeydown);

        searchInput.addEventListener('input', async (e) => {
            const term = e.target.value;
            const customers = term ? await Customer.search(term) : await Customer.getAll();

            const pendingSales = await Sale.getPendingSales();
            const debtMap = {};
            const oldestDebtMap = {};
            
            pendingSales.forEach(sale => {
                if (sale.customerId) {
                    const debt = (parseFloat(sale.total) || 0) - (parseFloat(sale.paidAmount) || 0);
                    if (debt > 0) {
                        debtMap[sale.customerId] = (debtMap[sale.customerId] || 0) + debt;
                        
                        const saleDate = new Date(sale.date);
                        if (!oldestDebtMap[sale.customerId] || saleDate < oldestDebtMap[sale.customerId]) {
                            oldestDebtMap[sale.customerId] = saleDate;
                        }
                    }
                }
            });

            let limitMild = 15000;
            let limitHigh = 30000;
            try {
                const rowMild = await db.get('settings', 'debtLimitMild');
                if (rowMild) limitMild = parseInt(rowMild.value) || 15000;
                const rowHigh = await db.get('settings', 'debtLimitHigh');
                if (rowHigh) limitHigh = parseInt(rowHigh.value) || 30000;
            } catch(e) { /* fallback */ }

            updateDOM(document.getElementById('customersTable'), this.renderCustomersTable(customers, debtMap, oldestDebtMap, limitMild, limitHigh));
        });
    },

    renderCustomersTable(customers, debtMap = {}, oldestDebtMap = {}, limitMild = 15000, limitHigh = 30000) {
        if (customers.length === 0) {
            return '<div class="empty-state"><div class="empty-state-icon">👥</div>No hay clientes</div>';
        }

        const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444'];
        const isPrivacyActive = localStorage.getItem('customers_privacy_mode') === 'true';

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1.5rem; padding: 0.5rem 0;">
                ${customers.map(c => {
            const debt = debtMap[c.id] || 0;
            const credit = (c.balanceCredit != null) ? parseFloat(c.balanceCredit) || 0 : 0;
            const netDebt = Math.max(0, Math.round((debt - credit) * 100) / 100);
            const netCredit = Math.max(0, Math.round((credit - debt) * 100) / 100);

            // Cálculo de Semáforo Personalizado con límites configurables
            let statusColor = '#10b981'; // Verde (Al día)
            let statusLabel = 'Al Día';
            let statusIcon = '🟢';
            
            if (netDebt > 0) {
                if (netDebt > limitHigh) {
                    statusColor = '#a855f7'; // Morado
                    statusLabel = 'Deuda Crítica';
                    statusIcon = '🟣';
                } else if (netDebt >= limitMild) {
                    statusColor = '#ef4444'; // Rojo
                    statusLabel = 'Deuda Alta';
                    statusIcon = '🔴';
                } else {
                    statusColor = '#f59e0b'; // Amarillo
                    statusLabel = 'Deuda Leve';
                    statusIcon = '🟡';
                }
            }

            // Sobrescribir estado si el Modo Incógnito está activo
            if (isPrivacyActive) {
                statusColor = '#64748b'; // Gris neutral
                statusLabel = 'Protegido';
                statusIcon = '🔒';
            }

            // Cálculo de Antigüedad de Deuda (Oculto en modo incógnito)
            let ageHtml = '';
            if (!isPrivacyActive && netDebt > 0 && oldestDebtMap[c.id]) {
                const oldestDate = new Date(oldestDebtMap[c.id]);
                const diffTime = Math.abs(new Date() - oldestDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                ageHtml = `<div style="font-size: 0.7rem; color: #64748b; margin-top: 0.2rem; font-weight: 600;">⏳ Pendiente hace ${diffDays} días</div>`;
            }

            const nameParts = (c.name || 'Sin Nombre').trim().split(' ');
            const initials = ((nameParts[0]?.[0] || '') + (nameParts[1]?.[0] || '')).toUpperCase() || '?';

            let hash = 0;
            for (let i = 0; i < (c.name || '').length; i++) hash = (c.name || '').charCodeAt(i) + ((hash << 5) - hash);
            const bgColor = colors[Math.abs(hash) % colors.length];

            return `
                    <div class="customer-card" style="background: #ffffff; border: 1.5px solid ${netDebt > 0 && !isPrivacyActive ? statusColor + '44' : '#e5e7eb'}; border-radius: 1.25rem; padding: 1.5rem; transition: all 0.25s ease; position: relative; display: flex; flex-direction: column; gap: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); ${netDebt > 0 && !isPrivacyActive ? `border-left: 5px solid ${statusColor};` : ''}"
                         onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 16px 32px rgba(0,0,0,0.1)'; ${!isPrivacyActive ? `this.style.borderColor='${statusColor}';` : ''}"
                         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; this.style.borderColor='${netDebt > 0 && !isPrivacyActive ? statusColor + '44' : '#e5e7eb'}';">
                        
                        <!-- Badge de Estado -->
                        <div style="position: absolute; top: 1rem; right: 1rem; background: ${statusColor}15; color: ${statusColor}; padding: 0.25rem 0.6rem; border-radius: 2rem; font-size: 0.65rem; font-weight: 800; display: flex; align-items: center; gap: 0.3rem; border: 1px solid ${statusColor}33;">
                            ${statusIcon} ${statusLabel}
                        </div>
                        
                        <!-- Cabecera: Inicial + Nombre -->
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="width: 56px; height: 56px; background: ${bgColor}; color: white; border-radius: 1rem; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 800; box-shadow: 0 4px 10px ${bgColor}55; flex-shrink: 0;">
                                ${initials}
                            </div>
                            <div style="overflow: hidden;">
                                <h3 style="margin: 0; font-size: 1.2rem; color: #111827; line-height: 1.1; font-weight: 800; text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeHTML(c.name)}</h3>
                                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem;">
                                    ${c.rut ? `<span style="font-size: 0.7rem; color: #475569; background: #f1f5f9; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-weight: 700;">🆔 ${safeHTML(c.rut)}</span>` : ''}
                                    ${c.phone ? `<span style="font-size: 0.7rem; color: #475569; background: #f1f5f9; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-weight: 700;">📞 ${safeHTML(c.phone)}</span>` : ''}
                                </div>
                                ${ageHtml}
                                ${c.paymentDay && parseInt(c.paymentDay) > 0 ? `
                                    <div style="margin-top: 0.25rem; font-size: 0.65rem; font-weight: 800; color: ${parseInt(c.paymentDay) === new Date().getDate() ? '#dc2626' : '#64748b'};">
                                        🗓️ Paga el día: ${c.paymentDay} ${parseInt(c.paymentDay) === new Date().getDate() ? '<span style="background: #fee2e2; color: #dc2626; padding: 0.1rem 0.3rem; border-radius: 1rem; margin-left: 0.25rem;">¡HOY!</span>' : ''}
                                    </div>
                                ` : ''}
                                ${(() => {
                                    if (!c.promiseDate || netDebt <= 0) return '';
                                    const today = new Date(); today.setHours(0,0,0,0);
                                    const pDate = new Date(c.promiseDate + 'T00:00:00');
                                    const diffDays = Math.round((pDate - today) / (1000 * 60 * 60 * 24));
                                    if (diffDays < 0) return `<div style="margin-top: 0.3rem;"><span style="background: #7e22ce; color: white; padding: 0.2rem 0.6rem; border-radius: 0.5rem; font-size: 0.68rem; font-weight: 800;">🚨 COMPROMISO VENCIDO HACE ${Math.abs(diffDays)} DÍA(S)</span></div>`;
                                    if (diffDays === 0) return `<div style="margin-top: 0.3rem;"><span style="background: #dc2626; color: white; padding: 0.2rem 0.6rem; border-radius: 0.5rem; font-size: 0.68rem; font-weight: 800;">🚨 ¡COBRAR HOY (${pDate.toLocaleDateString('es-CL')})!</span></div>`;
                                    if (diffDays <= 7) return `<div style="margin-top: 0.3rem;"><span style="background: #0284c7; color: white; padding: 0.2rem 0.6rem; border-radius: 0.5rem; font-size: 0.68rem; font-weight: 800;">🗓️ Cobrar en ${diffDays} días (${pDate.toLocaleDateString('es-CL')})</span></div>`;
                                    return '';
                                })()}
                            </div>
                        </div>

                        <!-- Paneles de Dinero (Oculto en modo incógnito) -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                            <div style="background: ${!isPrivacyActive && netDebt > 0 ? '#fef2f2' : '#f9fafb'}; border: 1.5px solid ${!isPrivacyActive && netDebt > 0 ? '#fecaca' : '#e5e7eb'}; padding: 0.875rem; border-radius: 0.875rem; text-align: center;">
                                <div style="font-size: 0.68rem; color: ${!isPrivacyActive && netDebt > 0 ? '#dc2626' : '#9ca3af'}; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 0.4rem;">🚨 DEUDA</div>
                                <div style="font-weight: 900; font-size: 1.3rem; color: ${!isPrivacyActive && netDebt > 0 ? '#dc2626' : '#9ca3af'}; line-height: 1;">
                                    ${isPrivacyActive ? (netDebt > 0 ? '$ ••••' : '$0') : (netDebt > 0 ? formatCLP(netDebt) : '$0')}
                                </div>
                            </div>
                            <div style="background: ${!isPrivacyActive && netCredit > 0 ? '#f0fdf4' : '#f9fafb'}; border: 1.5px solid ${!isPrivacyActive && netCredit > 0 ? '#bbf7d0' : '#e5e7eb'}; padding: 0.875rem; border-radius: 0.875rem; text-align: center;">
                                <div style="font-size: 0.68rem; color: ${!isPrivacyActive && netCredit > 0 ? '#16a34a' : '#9ca3af'}; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 0.4rem;">💰 A FAVOR</div>
                                <div style="font-weight: 900; font-size: 1.3rem; color: ${!isPrivacyActive && netCredit > 0 ? '#16a34a' : '#9ca3af'}; line-height: 1;">
                                    ${isPrivacyActive ? (netCredit > 0 ? '$ ••••' : '$0') : (netCredit > 0 ? formatCLP(netCredit) : '$0')}
                                </div>
                            </div>
                        </div>

                        <!-- Botones de Accón -->
                        <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-top: 0.25rem;">
                            <div style="display: flex; gap: 0.65rem;">
                                <button class="btn" style="flex: 1.5; background: #3b82f6; color: #fff; border-radius: 0.75rem; padding: 0.7rem; font-weight: 700; font-size: 0.875rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; border: none;" 
                                        onclick="CustomersView.showAccountDetails(${c.id})"
                                        onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
                                    <span>💳 Ver Estado</span>
                                </button>
                                <button class="btn" style="flex: 1; background: #10b981; color: #fff; border-radius: 0.75rem; padding: 0.7rem; font-weight: 700; font-size: 0.875rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; border: none;" 
                                        onclick="CustomersView.showUnifiedAbonoModal('${c.id}')"
                                        onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                                    <span>➕ Abono</span>
                                </button>
                            </div>
                            
                            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #f3f4f6;">
                                ${PermissionService.can('customers.edit') ? `
                                <button class="btn btn-sm" style="background: #f9fafb; color: #374151; border: 1.5px solid #e5e7eb; width: 36px; height: 36px; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; padding: 0;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='#f9fafb'" onclick="CustomersView.showCustomerForm('${c.id}')" title="Editar Datos">✏️</button>` : ''}
                                ${PermissionService.can('customers.delete') ? `
                                <button class="btn btn-sm" style="background: #fef2f2; color: #dc2626; border: 1.5px solid #fecaca; width: 36px; height: 36px; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; padding: 0;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'" onclick="CustomersView.deleteCustomer('${c.id}')" title="Desactivar Cliente">🗑️</button>` : ''}
                            </div>
                        </div>
                    </div>
                    `;
        }).join('')}
            </div>
        `;
    },

    async showCustomerForm(id = null) {
        const customer = id ? await Customer.getById(id) : null;

        const content = `
            <form id="customerForm" onsubmit="CustomersView.saveCustomer(event, ${id})">
                <div class="form-row" style="display: flex; gap: 1rem;">
                    <div class="form-group" style="flex: 2;">
                        <label>Nombre *</label>
                        <input type="text" name="name" class="form-control" value="${customer?.name || ''}" required>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>RUT / ID</label>
                        <input type="text" name="rut" class="form-control" value="${customer?.rut || ''}" placeholder="Ej: 12.345.678-9">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Teléfono</label>
                    <input type="text" name="phone" class="form-control" value="${customer?.phone || ''}" inputmode="numeric" pattern="[0-9]*" title="Sólo números" placeholder="Ej: 912345678">
                </div>
                
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email" class="form-control" value="${customer?.email || ''}">
                </div>
                
                <div class="form-group">
                    <label>Límite de crédito (opcional)</label>
                    <input type="number" name="creditLimit" class="form-control" value="${customer?.creditLimit ?? ''}" min="0" step="1" placeholder="Ej: 500000">
                    <small style="color: var(--secondary); display: block; margin-top: 0.25rem;">Si se define, no se podrá fiar por encima de este monto.</small>
                </div>

                <div class="form-group" style="margin-top: 1rem; padding: 1rem; background: #eff6ff; border: 1.5px solid #60a5fa; border-radius: 0.75rem;">
                    <label style="color: #1e40af; font-weight: 800;">🗓️ Fecha Límite / Compromiso de Pago</label>
                    <div style="display: flex; gap: 0.4rem; margin-top: 0.4rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                        <input type="date" id="promiseDateInput" name="promiseDate" class="form-control" value="${customer?.promiseDate || ''}" style="border: 1.5px solid #3b82f6; font-weight: 700; flex: 1.5;">
                        <button type="button" class="btn btn-sm btn-outline-primary" style="font-weight: 700;" onclick="CustomersView.setQuickPromiseDate(3)">+3 Días</button>
                        <button type="button" class="btn btn-sm btn-outline-primary" style="font-weight: 700;" onclick="CustomersView.setQuickPromiseDate(7)">+7 Días (1 Sem)</button>
                        <button type="button" class="btn btn-sm btn-outline-primary" style="font-weight: 700;" onclick="CustomersView.setQuickPromiseDate(15)">+15 Días</button>
                    </div>
                    <small style="color: #1e40af; display: block; font-weight: 600;">
                        Define la fecha exacta o relativa acordada para el cobro. El sistema te mostrará alertas automáticas cuando se venza la fecha.
                    </small>
                </div>

                <div class="form-group" style="margin-top: 0.75rem; padding: 0.85rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.5rem;">
                    <label style="color: #166534; font-weight: 700;">📅 Día Fijo del Mes (Opcional)</label>
                    <input type="number" name="paymentDay" class="form-control" value="${customer?.paymentDay ?? '0'}" min="0" max="31" placeholder="Ej: 15" style="border: 1px solid #166534;">
                    <small style="color: #166534; display: block; margin-top: 0.25rem;">
                        Indica si paga un día fijo todos los meses (1-31). (0 = Sin día fijo)
                    </small>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="document.getElementById('customerForm').requestSubmit()">
                ${id ? 'Actualizar' : 'Crear'}
            </button>
        `;

        window._focusSearchAfterClose = () => CustomersView.focusSearch();
        showModal(content, {
            title: id ? 'Editar Cliente' : 'Nuevo Cliente',
            footer,
            width: '500px'
        });
    },

    async saveCustomer(event, id) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);

        if (id) data.id = id;

        try {
            await CustomerController.saveCustomer(data);
            closeModal();
            await this.refresh();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async showUnifiedAbonoModal(customerId) {
        const balance = await CustomerAccountService.getCustomerBalance(customerId);
        const totalDebt = balance ? (parseFloat(balance.totalDebt) || 0) : 0;
        return this.showPayTotalDebtForm(customerId, totalDebt);
    },

    async showAddCreditForm(customerId) {
        return this.showUnifiedAbonoModal(customerId);
    },

    async deleteCustomer(id) {
        const customer = await Customer.getById(id);
        const name = customer ? customer.name : `#${id}`;
        
        let netDebt = 0;
        try {
            const balance = await Customer.getAccountBalance(id);
            const totalDebt = parseFloat(balance.totalDebt) || 0;
            const totalCredit = parseFloat(balance.balanceCredit) || 0;
            netDebt = Math.max(0, totalDebt - totalCredit);
        } catch(e) { console.warn('Error checking balance for delete:', e); }

        const confirmMsg = netDebt > 0
            ? `⚠️ ADVERTENCIA: El cliente "${name}" aún tiene una DEUDA PENDIENTE de ${formatCLP(netDebt)}.\n\n¿Estás seguro de que deseas desactivarlo de todas formas? Dejará de aparecer en los listados activos.`
            : `¿Desactivar al cliente "${name}"? Dejará de aparecer en listados y ventas nuevas, pero se preserva para reportes históricos. Podrás restaurarlo luego.`;

        showConfirm(confirmMsg, async () => {
            try {
                await CustomerController.deleteCustomer(id);
                await this.refresh();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    },

    /**
     * C1: Mostrar clientes desactivados con opción de restaurar
     */
    async showDeletedCustomers() {
        const deleted = await Customer.getDeleted();

        if (deleted.length === 0) {
            window._focusSearchAfterClose = () => CustomersView.focusSearch();
            showModal(
                '<div class="empty-state"><div class="empty-state-icon">✅</div>No hay clientes desactivados</div>',
                { title: 'Clientes Desactivados', footer: '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>', width: '600px' }
            );
            return;
        }

        const content = `
            <p style="margin-bottom: 1rem; color: var(--secondary);">
                Estos clientes están desactivados. No aparecen en ventas nuevas ni listados, pero se preservan para reportes.
            </p>
            <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Teléfono</th>
                            <th>Desactivado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${deleted.map(c => `
                            <tr style="opacity: 0.8;">
                                <td><strong>${safeHTML(c.name)}</strong></td>
                                <td>${safeHTML(c.phone || '-')}</td>
                                <td>${c.deletedAt ? new Date(c.deletedAt).toLocaleDateString('es-CL') : '-'}</td>
                                <td>
                                    <button class="btn btn-sm btn-success" onclick="CustomersView.restoreCustomer('${c.id}')">
                                        Restaurar
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        window._focusSearchAfterClose = () => CustomersView.focusSearch();
        showModal(content, {
            title: `Clientes Desactivados (${deleted.length})`,
            footer: '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>',
            width: '600px'
        });
    },

    async restoreCustomer(id) {
        try {
            await CustomerController.restoreCustomer(id);
            closeModal();
            await this.refresh();
            await this.showDeletedCustomers();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async refresh() {
        // C10: Limpiar caché para asegurar datos reales en tiempo real (SQLite)
        if (typeof db !== 'undefined' && db.clearCache) {
            db.clearCache('sales');
            db.clearCache('customers');
            db.clearCache('payments');
            db.clearCache('customerCreditDeposits');
            db.clearCache('customerCreditUses');
        }

        const searchInput = document.getElementById('searchCustomers');
        const term = searchInput ? searchInput.value : '';
        const scrollPos = window.scrollY; // Preservar scroll de la página
        
        // Obtener clientes filtrados por el término actual
        const customers = term ? await Customer.search(term) : await Customer.getAll();
        
        const pendingSales = await Sale.getPendingSales();
        const debtMap = {};
        const oldestDebtMap = {};
        
        pendingSales.forEach(sale => {
            if (sale.customerId) {
                const debt = (parseFloat(sale.total) || 0) - (parseFloat(sale.paidAmount) || 0);
                if (debt > 0) {
                    debtMap[sale.customerId] = (debtMap[sale.customerId] || 0) + debt;
                    const saleDate = new Date(sale.date);
                    if (!oldestDebtMap[sale.customerId] || saleDate < oldestDebtMap[sale.customerId]) {
                        oldestDebtMap[sale.customerId] = saleDate;
                    }
                }
            }
        });

        // C10: PRIORIDAD - Ordenar por DEUDA (Mayor a menor)
        // Si la deuda es igual, ordenar por nombre (A-Z)
        customers.sort((a, b) => {
            const debtA = debtMap[a.id] || 0;
            const debtB = debtMap[b.id] || 0;
            if (debtB !== debtA) return debtB - debtA;
            return (a.name || '').localeCompare(b.name || '');
        });

        // Cargar límites del semáforo
        let limitMild = 15000;
        let limitHigh = 30000;
        try {
            const rowMild = await db.get('settings', 'debtLimitMild');
            if (rowMild) limitMild = parseInt(rowMild.value) || 15000;
            const rowHigh = await db.get('settings', 'debtLimitHigh');
            if (rowHigh) limitHigh = parseInt(rowHigh.value) || 30000;
        } catch(e) { /* fallback */ }
        
        const tableContainer = document.getElementById('customersTable');
        if (tableContainer) {
            // Actualizar solo el contenido de la tabla, manteniendo el buscador intacto
            updateDOM(tableContainer, this.renderCustomersTable(customers, debtMap, oldestDebtMap, limitMild, limitHigh));
            
            // Restaurar scroll si es necesario (evita saltos bruscos)
            if (scrollPos > 0) window.scrollTo(0, scrollPos);
        }
    },

    async showAccountDetails(customerId, initialTab = 'tab-resumen', isUpdate = false) {
        let existingModal = null;
        if (isUpdate) {
            const modals = document.querySelectorAll('.modal');
            if (modals.length > 0) existingModal = modals[modals.length - 1];
        }
        if (!existingModal) {
            // CRITICAL: Remove any existing modals to avoid stacking/overlapping
            document.querySelectorAll('.modal').forEach(m => m.remove());
        }
        
        // C10: Autocorrección - Conciliar saldos si tiene deuda y saldo a favor a la vez antes de mostrar
        try {
            if (typeof CustomerAccountService !== 'undefined' && CustomerAccountService.reconcileBalances) {
                await CustomerAccountService.reconcileBalances(customerId);
            }
        } catch (e) { console.warn('Error en reconciliación automática:', e); }

        // CRITICAL: NUCLEAR CACHE CLEAR to ensure fresh data
        if (typeof db !== 'undefined') {
            db.cache = {}; // Clear everything
            if (db.clearCache) db.clearCache();
        }

        let customer, balance, payments = [], creditHistory = [], allSales = [], sessions = [];
        const cashOpen = !!(await CashRegister.getOpen());

        // Obtener todos los datos necesarios
        customer = await Customer.getById(customerId);
        
        // En SQLite usamos la ruta optimizada pero traemos también ventas pagadas para la pestaña de verificación
        if (db.mode === 'sqlite') {
            const fullStatus = await CustomerAccountService.getFullAccountStatus(customerId);
            if (fullStatus) {
                balance = {
                    totalDebt: fullStatus.summary?.totalDebt || 0,
                    balanceCredit: fullStatus.summary?.balanceCredit || 0,
                    displayBalance: (fullStatus.summary?.totalDebt || 0) - (fullStatus.summary?.balanceCredit || 0),
                    pendingSales: (fullStatus.pendingSales || []).map(s => ({
                        ...s,
                        remaining: (parseFloat(s.total) || 0) - (parseFloat(s.paidAmount) || 0)
                    }))
                };
                payments = fullStatus.movements || [];
                creditHistory = fullStatus.creditHistory || [];
            }
            // Traer ventas completadas para la pestaña de verificación
            const allSalesRaw = await Sale.getByCustomer(customerId);
            allSales = allSalesRaw.filter(s => s.status === 'completed' || s.status === 'paid');
            // Traer sesiones de pago de deuda (nueva funcionalidad)
            try {
                const raw = await ApiClient.get(`customers/${customerId}/debt-payment-sessions`);
                sessions = Array.isArray(raw) ? raw : [];
            } catch(e) { sessions = []; }
        } else {
            const rawBalance = await Customer.getAccountBalance(customerId);
            balance = {
                ...rawBalance,
                pendingSales: (rawBalance.pendingSales || []).map(s => ({
                    ...s,
                    remaining: (parseFloat(s.total || s.amount) || 0) - (parseFloat(s.paidAmount || s.paid) || 0)
                }))
            };
            payments = await Customer.getPaymentHistory(customerId);
            const deposits = await CustomerCreditDeposit.getByCustomer(customerId);
            const creditUses = await CustomerCreditUse.getByCustomer(customerId);
            creditHistory = [
                ...deposits.map(d => ({ date: d.date, type: 'deposit', amount: parseFloat(d.amount) || 0, paymentMethod: d.paymentMethod, saleNumber: null })),
                ...creditUses.map(u => ({ date: u.date, type: 'use', amount: parseFloat(u.amount) || 0, paymentMethod: null, saleNumber: u.saleNumber }))
            ];
            const allSalesRaw = await Sale.getByCustomer(customerId);
            allSales = allSalesRaw.filter(s => s.status === 'completed' || s.status === 'paid');
        }

        const displayBalance = balance.displayBalance != null ? parseFloat(balance.displayBalance) : (balance.totalDebt || 0) - (balance.balanceCredit || 0);
        const netDebt = Math.max(0, displayBalance);
        const netCredit = Math.max(0, -displayBalance);
        
        // --- CÁLCULO DE MÉTRICAS DE FIDELIDAD (PONYTAIL) ---
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const allCustomerSales = [...allSales, ...(balance.pendingSales || [])];
        const salesLast30Days = allCustomerSales.filter(s => new Date(s.date) >= thirtyDaysAgo);
        const countLast30Days = salesLast30Days.length;

        let frequencyLabel = 'Cliente Ocasional';
        let frequencyColor = '#64748b';
        if (countLast30Days >= 8) {
            frequencyLabel = 'Cliente Muy Frecuente 🔥';
            frequencyColor = '#ef4444';
        } else if (countLast30Days >= 3) {
            frequencyLabel = 'Cliente Regular 🛍️';
            frequencyColor = '#3b82f6';
        }

        let totalPayDays = 0;
        let countPaidSales = 0;
        payments.forEach(p => {
            if (p.saleId) {
                const sale = allCustomerSales.find(s => (s.id || s.saleId) === p.saleId);
                if (sale && sale.date) {
                    const payDate = new Date(p.date);
                    const saleDate = new Date(sale.date);
                    const diffTime = payDate - saleDate;
                    const diffDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
                    totalPayDays += diffDays;
                    countPaidSales++;
                }
            }
        });

        const avgPayDays = countPaidSales > 0 ? Math.round(totalPayDays / countPaidSales) : null;

        let hasVeryOldDebt = false;
        if (balance.pendingSales && balance.pendingSales.length > 0) {
            balance.pendingSales.forEach(s => {
                const saleDate = new Date(s.date);
                const diffTime = Math.abs(new Date() - saleDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > 15) {
                    hasVeryOldDebt = true;
                }
            });
        }

        const isStarPagador = (avgPayDays !== null && avgPayDays <= 10 && !hasVeryOldDebt) || (countPaidSales >= 2 && !hasVeryOldDebt && avgPayDays <= 10);

        // Calcular Total Histórico Pagado
        const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        // Crear un mapa de totales de venta para identificar pagos totales
        const saleTotals = {};
        [...allSales, ...(balance.pendingSales || [])].forEach(s => {
            saleTotals[s.id || s.saleId] = parseFloat(s.total) || 0;
        });

        // --- Lógica de Agrupación de Abonos (Punto 3 y 4) ---
        const unifiedLedger = [
            ...payments.map(p => {
                const saleTotal = saleTotals[p.saleId] || 0;
                // Es pago total si el monto del pago es igual al total de la venta (margen de 1 peso por redondeo)
                const isTotal = p.saleId && Math.abs((parseFloat(p.amount) || 0) - saleTotal) < 2;

                return {
                    date: p.date,
                    type: 'payment',
                    isTotal: isTotal,
                    title: isTotal ? 'Pago Total Venta' : 'Abono a Deuda',
                    icon: isTotal ? '✅' : '💵',
                    amount: parseFloat(p.amount) || 0,
                    method: this.getPaymentMethodName(p.paymentMethod),
                    reference: p.saleNumber ? `Venta #${p.saleNumber}` : 'Varias ventas',
                    notes: p.notes,
                    color: isTotal ? '#16a34a' : '#10b981'
                };
            }),
            ...creditHistory.map(h => ({
                date: h.date,
                type: h.type === 'deposit' ? 'credit_in' : 'credit_out',
                isTotal: false,
                title: h.type === 'deposit' ? 'Carga de Saldo' : 'Uso de Saldo',
                icon: h.type === 'deposit' ? '💰' : '🛒',
                amount: parseFloat(h.amount) || 0,
                method: h.type === 'deposit' ? this.getPaymentMethodName(h.paymentMethod) : 'Descontado de saldo',
                reference: h.saleNumber ? `Venta #${h.saleNumber}` : '-',
                notes: h.notes,
                color: h.type === 'deposit' ? '#3b82f6' : '#64748b'
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        const groupedLedger = [];
        unifiedLedger.forEach(item => {
            const last = groupedLedger[groupedLedger.length - 1];
            // Agrupar si tienen exactamente la misma fecha (timestamp) y tipo, y no son pagos totales individuales
            if (last && last.type === item.type && last.date === item.date && last.type === 'payment' && !item.isTotal && !last.isTotal) {
                last.amount += item.amount;
                if (!last.references) last.references = [last.reference];
                if (!last.references.includes(item.reference)) last.references.push(item.reference);
                
                // Si agrupa varias ventas, cambiar título a "Pago Consolidado"
                last.title = 'Pago Consolidado';
                last.reference = `${last.references.length} ventas`;
            } else {
                groupedLedger.push({ ...item });
            }
        });

        // Filtrar historial de abonos para mostrar solo abonos o parciales (según petición del usuario)
        const finalAbonosLedger = groupedLedger.filter(m => m.title !== 'Pago Total Venta');

        const content = `
            <style>
                .account-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; }
                .account-tab { padding: 0.75rem 1.25rem; border-radius: 0.75rem; cursor: pointer; font-weight: 700; color: #64748b; transition: all 0.2s; border: none; background: none; font-size: 0.9rem; }
                .account-tab.active { background: #eff6ff; color: #3b82f6; }
                .account-tab:hover:not(.active) { background: #f8fafc; color: #1e293b; }
                .summary-card { padding: 1.25rem; border-radius: 1rem; border: 1.5px solid #e2e8f0; background: white; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .tab-content { display: none; animation: fadeIn 0.3s ease; }
                .tab-content.active { display: block; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                .sale-item-row { padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; background: white; margin-bottom: 0.75rem; transition: all 0.2s; }
                .sale-item-row:hover { border-color: #3b82f6; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08); }
            </style>

            <div style="background: #f8fafc; margin: -1.5rem -1.5rem 1.5rem -1.5rem; padding: 2rem 1.5rem; border-radius: 1rem 1rem 0 0; border-bottom: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 1.25rem;">
                        <div style="width: 64px; height: 64px; background: #3b82f6; color: white; border-radius: 1.25rem; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 800; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);">
                            ${(customer.name?.[0] || 'C').toUpperCase()}
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.5rem; font-weight: 800; color: #1e293b;">${safeHTML(customer.name)}</h2>
                            <div style="display: flex; gap: 0.75rem; margin-top: 0.25rem;">
                                ${customer.phone ? `<span style="font-size: 0.85rem; color: #64748b; display: flex; align-items: center; gap: 0.25rem;">📞 ${safeHTML(customer.phone)}</span>` : ''}
                                <span style="font-size: 0.85rem; padding: 0.1rem 0.6rem; border-radius: 2rem; font-weight: 700; ${netDebt > 0 ? 'background: #fee2e2; color: #dc2626;' : 'background: #dcfce7; color: #16a34a;'}">
                                    ${netDebt > 0 ? 'Con Deuda' : 'Al Día'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        ${customer.phone ? `
                            <button class="btn" onclick="CustomersView.shareAccountStatusViaWhatsApp(${customerId})" style="background: #25d366; color: white; border-radius: 0.75rem; padding: 0.6rem 1rem; font-weight: 700; border: none; display: flex; align-items: center; gap: 0.5rem;">
                                <span>WhatsApp</span>
                            </button>
                        ` : ''}
                        <button class="btn btn-outline-secondary" onclick="window.print()" style="border-radius: 0.75rem; padding: 0.6rem 1rem;">Imprimir</button>
                    </div>
                </div>
            </div>

            <div class="account-tabs">
                <button class="account-tab ${initialTab === 'tab-resumen' ? 'active' : ''}" onclick="CustomersView.switchAccountTab(event, 'tab-resumen')">📊 Resumen</button>
                <button class="account-tab ${initialTab === 'tab-pendientes' ? 'active' : ''}" onclick="CustomersView.switchAccountTab(event, 'tab-pendientes')">📝 Ventas Pendientes (${balance.pendingSales.length})</button>
                <button class="account-tab ${initialTab === 'tab-historial' ? 'active' : ''}" onclick="CustomersView.switchAccountTab(event, 'tab-historial')">🕒 Historial de Abonos</button>
                <button class="account-tab ${initialTab === 'tab-pagos-deuda' ? 'active' : ''}" onclick="CustomersView.switchAccountTab(event, 'tab-pagos-deuda')">💳 Pagos de Deuda (${sessions.length})</button>
            </div>

            <!-- TAB: RESUMEN -->
            <div id="tab-resumen" class="tab-content ${initialTab === 'tab-resumen' ? 'active' : ''}">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
                    <div class="summary-card" style="border-top: 5px solid #ef4444; padding: 1rem;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Deuda Actual</div>
                        <div style="font-size: 1.6rem; font-weight: 900; color: #dc2626; margin: 0.35rem 0;">${formatCLP(netDebt)}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">Total acumulado pendiente</div>
                    </div>
                    <div class="summary-card" style="border-top: 5px solid #10b981; padding: 1rem;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Total Pagado</div>
                        <div style="font-size: 1.6rem; font-weight: 900; color: #16a34a; margin: 0.35rem 0;">${formatCLP(totalPaid)}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">Abonos históricos realizados</div>
                    </div>
                    <div class="summary-card" style="border-top: 5px solid #3b82f6; padding: 1rem;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Saldo a Favor</div>
                        <div style="font-size: 1.6rem; font-weight: 900; color: #2563eb; margin: 0.35rem 0;">${formatCLP(netCredit)}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">Dinero disponible del cliente</div>
                    </div>
                </div>


                <!-- SECCIÓN DE FIDELIDAD Y COMPORTAMIENTO (PONYTAIL) -->
                <div class="card" style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 1rem; padding: 1rem 1.25rem; margin-bottom: 1rem;">
                    <h3 style="margin-top: 0; margin-bottom: 0.75rem; font-size: 0.95rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
                        🏅 Análisis de Fidelidad y Comportamiento
                    </h3>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div style="background: white; border: 1px solid #e2e8f0; padding: 0.75rem 1rem; border-radius: 0.75rem; display: flex; flex-direction: column; gap: 0.2rem;">
                            <span style="font-size: 0.72rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Frecuencia de Compra</span>
                            <strong style="font-size: 1.05rem; color: ${frequencyColor}; font-weight: 800;">${frequencyLabel}</strong>
                            <span style="font-size: 0.72rem; color: #94a3b8;">${countLast30Days} compra${countLast30Days !== 1 ? 's' : ''} en los últimos 30 días.</span>
                        </div>
                        <div style="background: white; border: 1px solid #e2e8f0; padding: 0.75rem 1rem; border-radius: 0.75rem; display: flex; flex-direction: column; gap: 0.2rem;">
                            <span style="font-size: 0.72rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Velocidad de Pago</span>
                            <strong style="font-size: 1.05rem; color: #1e293b; font-weight: 800;">
                                ${avgPayDays !== null ? `Paga en promedio a los ${avgPayDays} día${avgPayDays !== 1 ? 's' : ''}` : 'Sin pagos previos'}
                            </strong>
                            <span style="font-size: 0.72rem; color: #94a3b8;">Días que tarda en saldar desde que se le fía.</span>
                        </div>
                    </div>
                    
                    ${isStarPagador ? `
                        <div style="margin-top: 0.75rem; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 0.75rem; padding: 0.6rem 0.85rem; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 6px -1px rgba(251, 191, 36, 0.05);">
                            <span style="font-size: 1.3rem;">🌟</span>
                            <div>
                                <strong style="font-weight: 800; color: #b45309; font-size: 0.85rem; display: block;">¡Pagador Estrella de Confianza!</strong>
                                <span style="font-size: 0.72rem; color: #d97706;">Este cliente paga rápido (promedio menor a 10 días) y no tiene deudas muy antiguas.</span>
                            </div>
                        </div>
                    ` : ''}
                </div>

                ${cashOpen && netDebt > 0 ? `
                    <div style="background: white; padding: 1rem 1.25rem; border-radius: 1rem; border: 1.5px solid #3b82f622; display: flex; align-items: center; justify-content: space-between; gap: 1rem; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.05);">
                        <div style="flex: 1;">
                            <h4 style="margin: 0; font-weight: 800; color: #1e293b; font-size: 0.95rem;">Acciones de Cobro</h4>
                            <p style="margin: 0; font-size: 0.8rem; color: #64748b;">Registra un nuevo abono a la deuda general.</p>
                        </div>
                        <div style="display: flex; gap: 0.6rem;">
                            <button class="btn btn-sm" style="background: #10b981; color: white; padding: 0.6rem 1.25rem; border-radius: 0.75rem; font-weight: 800; border: none;" onclick="CustomersView.showUnifiedAbonoModal('${customerId}')">
                                ➕ Registrar Abono / Pago
                            </button>
                            <button class="btn btn-sm" style="background: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.75rem; font-weight: 800; border: none;" onclick="CustomersView.showPayTotalDebtForm(${customerId}, ${netDebt})">
                                💰 Saldar Todo (${formatCLP(netDebt)})
                            </button>
                        </div>
                    </div>
                ` : !cashOpen && netDebt > 0 ? `
                    <div style="padding: 1rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 1rem; text-align: center; color: #92400e; font-weight: 700; font-size: 0.85rem;">
                        ⚠️ Abre la caja para registrar pagos de la deuda.
                    </div>
                ` : ''}
            </div>

            <!-- TAB: PENDIENTES -->
            <div id="tab-pendientes" class="tab-content ${initialTab === 'tab-pendientes' ? 'active' : ''}">
                ${balance.pendingSales.length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 450px; overflow-y: auto; padding-right: 0.5rem;">
                        ${balance.pendingSales.map(sale => `
                            <div class="sale-item-row">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                    <div>
                                        <div style="font-weight: 800; color: #1e293b; font-size: 1.05rem;">Venta #${sale.saleNumber || sale.saleId}</div>
                                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.1rem;">📅 ${formatDateTime(sale.date)}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.15rem; font-weight: 900; color: #dc2626;">${formatCLP(sale.remaining)}</div>
                                        <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">Deuda Restante</div>
                                    </div>
                                </div>
                                <div style="margin: 0.75rem 0; height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden;">
                                    <div style="height: 100%; background: #3b82f6; width: ${(sale.paidAmount / sale.total) * 100}%"></div>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                                    <div style="color: #64748b;">
                                        Pagado: <strong style="color: #10b981;">${formatCLP(sale.paidAmount)}</strong> de <strong>${formatCLP(sale.total)}</strong>
                                    </div>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <button class="btn btn-sm btn-outline-primary" style="font-size: 0.75rem; font-weight: 700; border-radius: 0.5rem;" onclick="CustomersView.toggleSaleDetail(this, ${sale.id || sale.saleId})">📦 Ver Productos</button>
                                        ${cashOpen ? `<button class="btn btn-sm btn-success" style="font-size: 0.75rem; font-weight: 700; border-radius: 0.5rem;" onclick="CustomersView.showPaymentForm(${sale.id || sale.saleId}, ${customerId}, ${sale.remaining})">Saldar</button>` : ''}
                                    </div>
                                </div>
                                <div id="detail-${sale.id || sale.saleId}" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1.5px dashed #e2e8f0;">
                                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                                        ${(sale.items || []).map(item => `
                                            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #334155;">
                                                <span>${item.quantity}x ${item.name}</span>
                                                <span style="font-weight: 700;">${formatCLP(item.total)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div style="text-align: center; padding: 3rem; color: #94a3b8;">No hay ventas pendientes de pago.</div>'}
            </div>

            <!-- TAB: HISTORIAL DE ABONOS -->
            <div id="tab-historial" class="tab-content ${initialTab === 'tab-historial' ? 'active' : ''}">
                ${finalAbonosLedger.length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 450px; overflow-y: auto; padding-right: 0.5rem;">
                        ${finalAbonosLedger.map(m => `
                            <div style="background: white; border: 1.5px solid #e2e8f0; border-left: 4px solid ${m.color}; border-radius: 0.875rem; padding: 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; gap: 0.875rem; align-items: center;">
                                        <div style="width: 40px; height: 40px; border-radius: 12px; background: ${m.color}15; color: ${m.color}; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                                            ${m.icon}
                                        </div>
                                        <div>
                                            <div style="font-weight: 800; color: #1e293b; font-size: 0.95rem;">${m.title}</div>
                                            <div style="font-size: 0.8rem; color: #64748b;">
                                                ${formatDateTime(m.date)} • ${m.method}
                                            </div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.1rem; font-weight: 900; color: ${m.type === 'credit_out' ? '#dc2626' : '#10b981'};">
                                            ${m.type === 'credit_out' ? '-' : '+'}${formatCLP(m.amount)}
                                        </div>
                                        <div style="font-size: 0.7rem; color: #94a3b8; font-weight: 700;">Ref: ${m.reference}</div>
                                    </div>
                                </div>
                                ${m.notes ? `<div style="margin-top: 0.5rem; font-size: 0.75rem; color: #475569; background: #f8fafc; padding: 0.4rem; border-radius: 0.4rem; font-style: italic;">📝 ${m.notes}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : '<div style="text-align: center; padding: 3rem; color: #94a3b8;">No se han registrado abonos o cargos parciales.</div>'}
            </div>

            <!-- TAB: PAGOS DE DEUDA -->
            <div id="tab-pagos-deuda" class="tab-content ${initialTab === 'tab-pagos-deuda' ? 'active' : ''}">
                <style>
                    .session-card { background:white; border:1.5px solid #e2e8f0; border-radius:1rem; overflow:hidden; margin-bottom:0.75rem; transition:box-shadow 0.2s; }
                    .session-card:hover { box-shadow:0 4px 14px rgba(0,0,0,0.08); }
                    .session-hdr { display:flex; justify-content:space-between; align-items:center; padding:1rem 1.25rem; cursor:pointer; }
                    .session-hdr:hover { background:#f8fafc; }
                    .session-body { border-top:1.5px solid #f1f5f9; padding:1rem 1.25rem; background:#fafcff; }
                    .ssale-row { border:1px solid #e2e8f0; border-radius:0.5rem; margin-bottom:0.5rem; overflow:hidden; }
                    .ssale-hdr { display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.875rem; cursor:pointer; background:white; font-size:0.88rem; }
                    .ssale-hdr:hover { background:#f8fafc; }
                    .ssale-products { padding:0.5rem 0.875rem 0.75rem; background:#f8fafc; border-top:1px dashed #e2e8f0; }
                </style>
                ${sessions.length > 0 ? `
                    <div style="max-height:500px;overflow-y:auto;padding-right:0.5rem;">
                        ${sessions.map(session => {
                            const methods = session.methods || {};
                            const methodNames = Object.entries(methods)
                                .filter(([_, v]) => v > 0)
                                .map(([m, v]) => {
                                    const icons = {cash:'\uD83D\uDCB5',card:'\uD83D\uDCB3',other:'\uD83C\uDFE6',credit:'\uD83D\uDCB0',qr:'\uD83D\uDCF1',discount:'\uD83C\uDFF7\uFE0F'};
                                    return `${icons[m]||'\uD83D\uDCB3'} ${formatCLP(v)}`;
                                }).join(' + ') || '—';
                            const salesData = session.salesData || [];
                            const cnt = salesData.length;
                            return `
                            <div class="session-card">
                                <div class="session-hdr" onclick="CustomersView.toggleSession('${session.id}')">
                                    <div>
                                        <div style="font-weight:800;color:#1e293b;font-size:1rem;">\uD83D\uDCB3 Pago de Deuda</div>
                                        <div style="font-size:0.8rem;color:#64748b;margin-top:0.15rem;">
                                            \uD83D\uDCC5 ${formatDateTime(session.date)}
                                            &nbsp;&bull;&nbsp; ${cnt} venta${cnt !== 1 ? 's' : ''}
                                            &nbsp;&bull;&nbsp; ${methodNames}
                                        </div>
                                        ${session.discount > 0 ? `<div style="font-size:0.75rem;color:#16a34a;font-weight:700;">\uD83C\uDFF7\uFE0F Descuento: ${formatCLP(session.discount)}</div>` : ''}
                                    </div>
                                    <div style="display:flex;align-items:center;gap:0.875rem;">
                                        <div style="text-align:right;">
                                            <div style="font-size:1.25rem;font-weight:900;color:#16a34a;">${formatCLP(session.totalPaid)}</div>
                                            <div style="font-size:0.65rem;color:#94a3b8;font-weight:700;text-transform:uppercase;">Total Pagado</div>
                                        </div>
                                        <div id="sarrow-${session.id}" style="font-size:1.1rem;color:#94a3b8;transition:transform 0.25s;">\u25BC</div>
                                    </div>
                                </div>
                                <div id="sdetail-${session.id}" style="display:none;">
                                    <div class="session-body">
                                        ${salesData.length === 0
                                            ? '<p style="color:#94a3b8;font-size:0.85rem;">Sin detalle de ventas disponible.</p>'
                                            : salesData.map((sale, si) => {
                                                const items = sale.items || [];
                                                return `
                                                <div class="ssale-row">
                                                    <div class="ssale-hdr" onclick="CustomersView.toggleSessionSale('${session.id}', ${si})">
                                                        <span style="font-weight:700;color:#334155;">
                                                            \uD83D\uDCC4 Venta #${sale.saleNumber || sale.saleId}
                                                            <span style="font-weight:400;color:#94a3b8;"> &mdash; ${formatDateTime(sale.date)}</span>
                                                        </span>
                                                        <span style="font-weight:800;color:#1e293b;white-space:nowrap;">
                                                            ${formatCLP(sale.total)}
                                                            <span id="sarr-${session.id}-${si}" style="color:#94a3b8;margin-left:0.3rem;">\u25BC</span>
                                                        </span>
                                                    </div>
                                                    <div id="sprods-${session.id}-${si}" style="display:none;">
                                                        <div class="ssale-products">
                                                            ${items.length === 0
                                                                ? '<span style="color:#94a3b8;font-size:0.8rem;">Sin productos detallados.</span>'
                                                                : items.map(item => `
                                                                    <div style="display:flex;justify-content:space-between;font-size:0.82rem;color:#334155;padding:0.25rem 0;border-bottom:1px dashed #f1f5f9;">
                                                                        <span>${item.quantity || 1}x ${safeHTML(item.name || '')}</span>
                                                                        <span style="font-weight:700;">${formatCLP(item.total || (item.price * item.quantity) || 0)}</span>
                                                                    </div>
                                                                `).join('')
                                                            }
                                                        </div>
                                                    </div>
                                                </div>`;
                                            }).join('')
                                        }
                                    </div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                ` : `
                    <div style="text-align:center;padding:3rem 1rem;color:#94a3b8;">
                        <div style="font-size:3rem;margin-bottom:1rem;">\uD83D\uDCB3</div>
                        <div style="font-weight:700;color:#64748b;font-size:1rem;">No hay pagos de deuda registrados aún</div>
                        <div style="font-size:0.85rem;margin-top:0.5rem;">Los pagos aparecerán aquí cuando el cliente salde su cuenta</div>
                    </div>
                `}
            </div>
        `;


        const footer = `
            <button class="btn btn-secondary" style="border-radius: 0.75rem; padding: 0.75rem 1.5rem; font-weight: 700;" onclick="closeModal()">Cerrar Ventana</button>
        `;

        window._focusSearchAfterClose = () => CustomersView.focusSearch();
        if (existingModal) {
            existingModal.querySelector('.modal-body').innerHTML = content;
            existingModal.querySelector('.modal-header h3').innerHTML = `Estado de Cuenta: ${safeHTML(customer.name)}`;
        } else {
            showModal(content, {
                title: `Estado de Cuenta: ${safeHTML(customer.name)}`,
                footer,
                width: '1000px'
            });
        }
        
        // Mantener ID para refrescar
        this._lastAccountDetailsId = customerId;
    },

    switchAccountTab(event, tabId) {
        // Desactivar todos los botones de pestaña
        document.querySelectorAll('.account-tab').forEach(btn => btn.classList.remove('active'));
        // Activar el botón clickeado
        event.currentTarget.classList.add('active');
        
        // Ocultar todos los contenidos
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        // Mostrar el contenido seleccionado
        const tab = document.getElementById(tabId);
        if (tab) tab.classList.add('active');
    },

    toggleSaleDetail(btn, saleId) {
        const detail = document.getElementById(`detail-${saleId}`);
        if (detail) {
            const isHidden = detail.style.display === 'none';
            detail.style.display = isHidden ? 'block' : 'none';
            btn.textContent = isHidden ? '🔼 Ocultar' : '📦 Ver Productos';
        }
    },

    async showPaymentForm(saleId, customerId, amount) {
        const sale = await Sale.getById(saleId);

        const content = `
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <div style="font-size: 1.1rem; margin-bottom: 0.5rem;">Pago completo de venta #${sale.saleNumber}</div>
                <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">${formatCLP(amount)}</div>
            </div>
            
            <div class="form-group">
                <label>Método de Pago</label>
                <select id="paymentMethod" class="form-control">
                    <option value="cash">💵 Efectivo</option>
                    <option value="card">💳 Tarjeta</option>
                    <option value="qr">📱 QR</option>
                    <option value="other">➕ Otro</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Notas (opcional)</label>
                <textarea id="paymentNotes" class="form-control" rows="2" placeholder="Observaciones del pago..."></textarea>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="CustomersView.showAccountDetails('${customerId}')">Volver</button>
            <button class="btn btn-success" onclick="CustomersView.processPayment(${saleId}, ${customerId}, ${amount})">
                Confirmar Pago de ${formatCLP(amount)}
            </button>
        `;

        showModal(content, { title: 'Registrar Pago', footer, width: '500px' });
    },

    async showPartialPaymentForm(saleId, customerId, maxAmount) {
        const sale = await Sale.getById(saleId);

        const content = `
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <div style="font-size: 1.1rem; margin-bottom: 0.5rem;">Pago parcial de venta #${sale.saleNumber}</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: var(--danger);">Deuda: ${formatCLP(maxAmount)}</div>
            </div>
            
            <div class="form-group">
                <label>Monto a Pagar *</label>
                <input type="number" id="partialAmount" class="form-control" min="1" max="${maxAmount}" step="10" placeholder="Ingresa el monto" autofocus>
                <small>Máximo: ${formatCLP(maxAmount)}</small>
            </div>
            
            <div class="form-group">
                <label>Método de Pago</label>
                <select id="paymentMethod" class="form-control">
                    <option value="cash">💵 Efectivo</option>
                    <option value="card">💳 Tarjeta</option>
                    <option value="qr">📱 QR</option>
                    <option value="other">➕ Otro</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Notas (opcional)</label>
                <textarea id="paymentNotes" class="form-control" rows="2" placeholder="Observaciones del pago..."></textarea>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="CustomersView.showAccountDetails('${customerId}')">Volver</button>
            <button class="btn btn-success" onclick="CustomersView.processPartialPayment(${saleId}, ${customerId}, ${maxAmount})">
                Confirmar Pago
            </button>
        `;

        showModal(content, { title: 'Registrar Pago Parcial', footer, width: '500px' });
    },

    async processPayment(saleId, customerId, amount) {
        const openCash = await CashRegister.getOpen();
        if (!openCash) {
            showNotification('Abre la caja para registrar pagos de deuda.', 'warning');
            return;
        }

        const paymentMethodSelect = document.getElementById('paymentMethod');
        const notesElement = document.getElementById('paymentNotes');

        if (!paymentMethodSelect) {
            showNotification('Error: No se encontró el selector de método de pago', 'error');
            return;
        }

        const paymentMethod = paymentMethodSelect.value || 'cash';
        const notes = notesElement ? notesElement.value.trim() : '';

        try {
            // Registrar el pago con el método de pago seleccionado
            await Payment.create({
                saleId: saleId,
                customerId: customerId,
                amount: amount,
                paymentMethod: paymentMethod,
                notes: notes
            });

            // NUEVO: Registrar sesión de pago
            try {
                const fullSale = await Sale.getById(saleId);
                const rawItems = fullSale ? (typeof fullSale.items === 'string' ? JSON.parse(fullSale.items || '[]') : (fullSale.items || [])) : [];
                await this.createDebtPaymentSession({
                    customerId,
                    date: new Date().toISOString(),
                    totalPaid: amount,
                    totalDebt: amount,
                    discount: 0,
                    methods: { [paymentMethod]: amount },
                    salesData: [{ saleId, saleNumber: fullSale?.saleNumber || saleId, date: fullSale?.date, total: parseFloat(fullSale?.total) || amount, items: rawItems }],
                    notes: notes || '',
                    cashRegisterId: openCash.id
                });
            } catch(se) { console.warn('[PaymentSession] processPayment:', se); }

            const methodName = this.getPaymentMethodName(paymentMethod);
            showNotification(`Pago de ${formatCLP(amount)} registrado exitosamente (${methodName})`, 'success');
            this.showAccountDetails(customerId, 'tab-resumen', true);
            this.refresh();
        } catch (error) {
            showNotification('Error al registrar el pago: ' + error.message, 'error');
            console.error('Error al registrar pago:', error);
        }
    },

    async processPartialPayment(saleId, customerId, maxAmount) {
        const openCash = await CashRegister.getOpen();
        if (!openCash) {
            showNotification('Abre la caja para registrar pagos de deuda.', 'warning');
            return;
        }

        const amountInput = document.getElementById('partialAmount');
        const paymentMethodSelect = document.getElementById('paymentMethod');
        const notesElement = document.getElementById('paymentNotes');

        if (!amountInput) {
            showNotification('Error: No se encontró el campo de monto', 'error');
            return;
        }

        if (!paymentMethodSelect) {
            showNotification('Error: No se encontró el selector de método de pago', 'error');
            return;
        }

        const amount = parseFloat(amountInput.value);
        const paymentMethod = paymentMethodSelect.value || 'cash';
        const notes = notesElement ? notesElement.value.trim() : '';

        if (!amount || amount <= 0) {
            showNotification('Ingresa un monto válido', 'warning');
            return;
        }

        if (amount > maxAmount) {
            showNotification(`El monto no puede ser mayor a ${formatCLP(maxAmount)}`, 'warning');
            return;
        }

        try {
            // Registrar el pago parcial con el método de pago seleccionado
            await Payment.create({
                saleId: saleId,
                customerId: customerId,
                amount: amount,
                paymentMethod: paymentMethod,
                notes: notes
            });

            const methodName = this.getPaymentMethodName(paymentMethod);
            showNotification(`Pago parcial de ${formatCLP(amount)} registrado exitosamente (${methodName})`, 'success');
            this.showAccountDetails(customerId, 'tab-resumen', true);
            this.refresh();
        } catch (error) {
            showNotification('Error al registrar el pago: ' + error.message, 'error');
            console.error('Error al registrar pago parcial:', error);
        }
    },


    async showPayTotalDebtForm(customerId, totalDebt) {
        const customer = await Customer.getById(customerId);
        const netCredit = parseFloat(customer.balanceCredit) || 0;

        const content = `
            <div class="payment-modal-pro">
                <!-- Columna Izquierda: Métodos de Pago (como POS) -->
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div class="payment-method-card">
                        <div class="payment-icon" style="background: var(--info-bg); color: var(--info-text);">💵</div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted);">EFECTIVO</div>
                                <button class="btn-fill-diff" onclick="CustomersView.fillDebtAmount('pay_cash')">DIFERENCIA</button>
                            </div>
                            <input type="number" id="pay_cash" class="pay-input-pro debt-pay-input" placeholder="0">
                        </div>
                    </div>

                    <div class="payment-method-card">
                        <div class="payment-icon" style="background: var(--success-bg); color: var(--success-text);">💳</div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted);">TARJETA / QR</div>
                                <button class="btn-fill-diff" onclick="CustomersView.fillDebtAmount('pay_card')">DIFERENCIA</button>
                            </div>
                            <input type="number" id="pay_card" class="pay-input-pro debt-pay-input" placeholder="0">
                        </div>
                    </div>

                    <div class="payment-method-card">
                        <div class="payment-icon" style="background: var(--warning-bg); color: var(--warning-text);">🏦</div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted);">TRANSFERENCIA</div>
                                <button class="btn-fill-diff" onclick="CustomersView.fillDebtAmount('pay_other')">DIFERENCIA</button>
                            </div>
                            <input type="number" id="pay_other" class="pay-input-pro debt-pay-input" placeholder="0">
                        </div>
                    </div>

                    ${netCredit > 0 ? `
                    <div class="payment-method-card" style="border-color: var(--success); background: var(--success-bg);">
                        <div class="payment-icon" style="background: white; color: var(--success);">💰</div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-size: 0.75rem; font-weight: 800; color: var(--success-text);">SALDO A FAVOR (${formatCLP(netCredit)})</div>
                                <button class="btn-fill-diff" onclick="CustomersView.fillDebtAmount('pay_credit', ${netCredit})">TODO</button>
                            </div>
                            <input type="number" id="pay_credit" class="pay-input-pro debt-pay-input" placeholder="0" style="color: var(--success-text) !important;">
                        </div>
                    </div>
                    ` : ''}

                    <div class="form-group" style="margin-top: 0.5rem;">
                        <textarea id="paymentNotes" class="form-control" rows="2" placeholder="Notas opcionales..." style="font-size: 0.85rem; border-radius: 0.5rem;"></textarea>
                    </div>
                </div>

                <!-- Columna Derecha: Resumen y Acción -->
                <div class="payment-summary-card">
                    <div>
                        <div class="payment-total-header">
                            <div style="font-size: 0.8rem; font-weight: 800; opacity: 0.9; letter-spacing: 1.5px; margin-bottom: 0.5rem;">DEUDA TOTAL</div>
                            <div id="finalAmountDisplay" style="font-size: 2.5rem; font-weight: 950; line-height: 1; color: var(--success);">${formatCLP(totalDebt)}</div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 1.25rem; padding: 0.5rem;">
                            <div style="text-align: center;">
                                <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Estado del Pago</div>
                                <div id="payment_status_text" style="font-size: 1.2rem; font-weight: 900; color: var(--danger);">PENDIENTE</div>
                            </div>
                            
                            <hr style="border: 0; border-top: 2.5px dashed var(--border); margin: 0.5rem 0;">

                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 700; color: var(--text-muted); font-size: 1rem;">Recibido:</span>
                                <strong id="sum_paid_debt" style="font-size: 1.15rem; font-weight: 900; color: var(--text-main);">$0</strong>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span id="diff_label_debt" style="font-weight: 800; color: var(--text-main); font-size: 1.15rem;">Falta:</span>
                                <strong id="sum_diff_debt" style="font-size: 1.75rem; font-weight: 950; color: var(--danger);">${formatCLP(totalDebt)}</strong>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top: 1.5rem;">
                        <button id="btnConfirmPayTotalDebt" class="btn btn-success pos-total-btn" style="height: 4rem; font-size: 1.25rem; margin-top: 0; font-weight: 900;" disabled>
                            CONFIRMAR PAGO
                        </button>
                    </div>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="CustomersView.showAccountDetails('${customerId}')">Volver</button>
        `;

        showModal(content, { title: '💰 Pago de Deuda / Abono', footer, width: '850px' });

        // Inicialización
        this.currentTotalDebt = parseFloat(totalDebt) || 0;
        this.finalToPay = this.currentTotalDebt;

        const payInputs = document.querySelectorAll('.debt-pay-input');

        const updateAll = () => {
            let totalIn = 0;
            payInputs.forEach(input => totalIn += parseFloat(input.value) || 0);
            const diff = this.finalToPay - totalIn;
            const sumPaidEl = document.getElementById('sum_paid_debt');
            const sumDiffEl = document.getElementById('sum_diff_debt');
            const diffLabelEl = document.getElementById('diff_label_debt');
            const statusText = document.getElementById('payment_status_text');
            const btnActual = document.getElementById('btnConfirmPayTotalDebt');

            sumPaidEl.textContent = formatCLP(totalIn);
            sumDiffEl.textContent = formatCLP(Math.abs(diff));

            if (diff > 0.9) {
                diffLabelEl.textContent = "Falta:";
                sumDiffEl.style.color = "var(--danger)";
                if (statusText) statusText.textContent = "PENDIENTE";
                btnActual.disabled = totalIn <= 0;
                btnActual.textContent = totalIn > 0 ? "REGISTRAR ABONO" : "CONFIRMAR PAGO";
            } else {
                diffLabelEl.textContent = diff < -0.9 ? "Excedente:" : "Saldado:";
                sumDiffEl.style.color = "var(--success)";
                if (statusText) statusText.textContent = diff < -0.9 ? "ENTREGAR VUELTO" : "LISTO";
                btnActual.disabled = false;
                btnActual.textContent = "LIQUIDAR DEUDA";
            }
        };

        payInputs.forEach(input => input.addEventListener('input', updateAll));

        document.getElementById('btnConfirmPayTotalDebt').addEventListener('click', async () => {
            const payments = {
                cash: parseFloat(document.getElementById('pay_cash').value) || 0,
                card: parseFloat(document.getElementById('pay_card').value) || 0,
                other: parseFloat(document.getElementById('pay_other').value) || 0,
                credit: netCredit > 0 ? (parseFloat(document.getElementById('pay_credit').value) || 0) : 0
            };

            const userNotes = (document.getElementById('paymentNotes').value || '').trim();

            let notes = `Pago de deuda | Deuda: ${formatCLP(this.currentTotalDebt)}`;
            if (userNotes) notes += ' | ' + userNotes;

            closeModal();
            CustomersView.payTotalDebtMulti(customerId, payments, notes, null);
        });

        setTimeout(() => {
            const firstInput = document.getElementById('pay_cash');
            if(firstInput) firstInput.focus();
        }, 200);
    },

    fillDebtAmount(targetId, maxVal = Infinity) {
        const inputs = ['pay_cash', 'pay_card', 'pay_other', 'pay_credit'];
        let alreadyIn = 0;
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el && id !== targetId) alreadyIn += parseFloat(el.value) || 0;
        });

        let remaining = Math.max(0, this.finalToPay - alreadyIn);
        if (remaining > maxVal) remaining = maxVal;

        const target = document.getElementById(targetId);
        if (target) {
            target.value = remaining > 0 ? remaining : '';
            const ev = new Event('input');
            target.dispatchEvent(ev);
        }
    },

    async payTotalDebtMulti(customerId, payments, notes, discountInfo) {
        const openCash = await CashRegister.getOpen();
        if (!openCash) {
            showNotification('Abre la caja para registrar pagos.', 'warning');
            return;
        }

        try {
            const balance = await Customer.getAccountBalance(customerId);
            const methods = Object.entries(payments).filter(([_, amt]) => amt > 0);

            // NUEVO: Recopilar datos de ventas para la sesión de pago
            const salesDataForSession = [];
            for (const saleSummary of balance.pendingSales) {
                try {
                    const fullSale = await Sale.getById(saleSummary.saleId);
                    if (fullSale) {
                        const rawItems = typeof fullSale.items === 'string' ? JSON.parse(fullSale.items || '[]') : (fullSale.items || []);
                        salesDataForSession.push({
                            saleId: fullSale.id,
                            saleNumber: fullSale.saleNumber || fullSale.id,
                            date: fullSale.date,
                            total: parseFloat(fullSale.total) || 0,
                            items: rawItems
                        });
                    }
                } catch(e) { /* skip */ }
            }

            // 1. Distribuir pagos reales entre las ventas pendientes
            for (const [method, totalMethodAmount] of methods) {
                let remainingFromMethod = totalMethodAmount;
                
                // Si el método es 'credit', debemos usar el CustomerAccountService.useCreditToPayDebt (si existe) 
                // o manejar la reducción del balance aquí.
                // Dado el diseño atómico buscado, lo distribuiremos manualmente si es IndexedDB o vía Api si es SQLite.
                
                // Buscar ventas que aún tengan deuda
                const updatedBalance = await Customer.getAccountBalance(customerId);
                for (const sale of updatedBalance.pendingSales) {
                    if (remainingFromMethod <= 0) break;
                    
                    const paymentAmount = Math.min(sale.remaining, remainingFromMethod);
                    if (paymentAmount <= 0) continue;

                    if (method === 'credit') {
                        // El método 'credit' es especial: descuenta del saldo a favor del cliente
                        await Customer.useCreditForPayment(customerId, paymentAmount, {
                            saleId: sale.saleId,
                            notes: notes
                        });
                    } else {
                        await Payment.create({
                            saleId: sale.saleId,
                            customerId: customerId,
                            amount: paymentAmount,
                            paymentMethod: method,
                            notes: notes
                        });
                    }

                    remainingFromMethod -= paymentAmount;
                }
            }

            // 2. Aplicar descuentos (perdonar deuda restante SOLO si hay descuento explícito autorizado)
            if (discountInfo && discountInfo.discountAmount > 0) {
                const finalBalance = await Customer.getAccountBalance(customerId);
                const nowISO = new Date().toISOString();
                
                for (const sale of finalBalance.pendingSales) {
                    const fullSale = await Sale.getById(sale.saleId);
                    if (!fullSale) continue;
                    
                    const remaining = parseFloat(fullSale.total) - (parseFloat(fullSale.paidAmount) || 0);
                    if (remaining > 0.9) {
                        await Payment.createPaymentRecord({
                            saleId: sale.saleId,
                            customerId: customerId,
                            amount: Math.round(remaining),
                            paymentMethod: 'discount',
                            date: nowISO,
                            notes: notes || 'Descuento aplicado',
                            cashRegisterId: openCash.id
                        });
                        await Sale.updateSale(sale.saleId, { paidAmount: fullSale.total, status: 'completed' });
                    }
                }
            }

            // 3. Auditoría
            if (discountInfo) {
                try {
                    AuditLogService.log({
                        entity: 'customer', entityId: customerId, action: 'discountPaymentMulti',
                        summary: `Pago mixto con descuento: deuda ${formatCLP(discountInfo.originalDebt)} -> pagó ${formatCLP(discountInfo.finalAmount)}`,
                        metadata: { customerId, ...discountInfo, payments }
                    });
                } catch (_) {}
            }

            // NUEVO: Crear sesión de pago de deuda
            const totalPaidAmount = methods.reduce((s, [_, a]) => s + a, 0);
            try {
                await this.createDebtPaymentSession({
                    customerId,
                    date: new Date().toISOString(),
                    totalPaid:  totalPaidAmount,
                    totalDebt:  (discountInfo ? discountInfo.originalDebt : totalPaidAmount) || totalPaidAmount,
                    discount:   discountInfo ? (discountInfo.discountAmount || 0) : 0,
                    methods:    payments,
                    salesData:  salesDataForSession,
                    notes:      notes || '',
                    cashRegisterId: openCash.id
                });
            } catch(se) { console.warn('[PaymentSession] payTotalDebtMulti:', se); }

            const updatedBalanceAfter = await Customer.getAccountBalance(customerId);
            const remainingDebtAfter = (updatedBalanceAfter.pendingSales || []).reduce((sum, s) => sum + (parseFloat(s.remaining) || 0), 0);

            if (remainingDebtAfter <= 0.9) {
                showNotification('Deuda saldada exitosamente', 'success');
            } else {
                showNotification(`Abono de ${formatCLP(totalPaidAmount)} registrado exitosamente. Deuda restante: ${formatCLP(remainingDebtAfter)}`, 'success');
            }
            this.showAccountDetails(customerId, 'tab-resumen', true);
            this.refresh();
        } catch (error) {
            showNotification('Error al procesar pago: ' + error.message, 'error');
            console.error(error);
        }
    },

    async payTotalDebt(customerId, amountToPay, paymentMethodFromForm = null, notesFromForm = null, discountInfo = null) {
        const openCash = await CashRegister.getOpen();
        if (!openCash) {
            showNotification('Abre la caja para registrar pagos de deuda.', 'warning');
            return;
        }

        let paymentMethod = paymentMethodFromForm;
        let notes = notesFromForm;
        if (paymentMethod == null || notes == null) {
            const paymentMethodSelect = document.getElementById('paymentMethod');
            const notesElement = document.getElementById('paymentNotes');
            if (!paymentMethodSelect) {
                showNotification('Error: No se encontró el selector de método de pago', 'error');
                return;
            }
            paymentMethod = paymentMethodSelect.value || 'cash';
            notes = notesElement ? notesElement.value.trim() : 'Pago de deuda total';
        }
        if (!notes) notes = 'Pago de deuda total';

        try {
            const balance = await Customer.getAccountBalance(customerId);
            let remainingToPay = parseFloat(amountToPay) || 0;
            let totalPaid = 0;

            // NUEVO: Recopilar datos de ventas para la sesión
            const salesDataForSession = [];
            for (const saleSummary of balance.pendingSales) {
                try {
                    const fullSale = await Sale.getById(saleSummary.saleId);
                    if (fullSale) {
                        const rawItems = typeof fullSale.items === 'string' ? JSON.parse(fullSale.items || '[]') : (fullSale.items || []);
                        salesDataForSession.push({
                            saleId: fullSale.id,
                            saleNumber: fullSale.saleNumber || fullSale.id,
                            date: fullSale.date,
                            total: parseFloat(fullSale.total) || 0,
                            items: rawItems
                        });
                    }
                } catch(e) { /* skip */ }
            }

            // Registrar pago por cada venta pendiente hasta cubrir amountToPay (monto con descuento)
            for (const sale of balance.pendingSales) {
                if (remainingToPay <= 0) break;

                const paymentAmount = Math.min(sale.remaining, remainingToPay);

                await Payment.create({
                    saleId: sale.saleId,
                    customerId: customerId,
                    amount: paymentAmount,
                    paymentMethod: paymentMethod,
                    notes: notes || 'Pago de deuda total'
                });

                totalPaid += paymentAmount;
                remainingToPay -= paymentAmount;
            }

            // Saldar completamente: SOLO si hay descuento explícito autorizado
            if (discountInfo && discountInfo.discountAmount > 0) {
                const nowISO = new Date().toISOString();
                for (const sale of balance.pendingSales) {
                    const fullSale = await Sale.getById(sale.saleId);
                    if (!fullSale) continue;
                    const total = parseFloat(fullSale.total) || 0;
                    const paid = parseFloat(fullSale.paidAmount) || 0;
                    if (total > 0 && paid < total - 0.01) {
                        const forgivenAmount = Math.round((total - paid) * 10) / 10;
                        if (forgivenAmount > 0) {
                            // Crear Payment de descuento para que la venta tenga payments.length > 0
                            await Payment.createPaymentRecord({
                                saleId: sale.saleId,
                                customerId: customerId,
                                amount: forgivenAmount,
                                paymentMethod: 'discount',
                                date: nowISO,
                                notes: notes || 'Descuento aplicado',
                                cashRegisterId: openCash.id
                            });
                        }
                        await Sale.updateSale(sale.saleId, { paidAmount: total, status: 'completed' });
                    }
                }
            }

            // C2: Audit log con detalle de descuento si aplica
            if (discountInfo) {
                try {
                    AuditLogService.log({
                        entity: 'customer', entityId: customerId, action: 'discountPayment',
                        summary: `Pago con descuento: deuda ${formatCLP(discountInfo.originalDebt)} → pagó ${formatCLP(totalPaid)} (descuento: ${formatCLP(discountInfo.discountAmount)})`,
                        metadata: {
                            customerId,
                            ...discountInfo,
                            paymentMethod,
                            totalPaid
                        }
                    });
                } catch (_) { /* No bloquear */ }
            }

            const methodName = this.getPaymentMethodName(paymentMethod);
            const updatedBalanceAfter = await Customer.getAccountBalance(customerId);
            const remainingDebtAfter = (updatedBalanceAfter.pendingSales || []).reduce((sum, s) => sum + (parseFloat(s.remaining) || 0), 0);

            if (remainingDebtAfter <= 0.9) {
                const discountMsg = discountInfo ? ` — Descuento: ${formatCLP(discountInfo.discountAmount)}` : '';
                showNotification(`Deuda saldada (${formatCLP(totalPaid)} - ${methodName}${discountMsg})`, 'success');
            } else {
                showNotification(`Abono de ${formatCLP(totalPaid)} registrado (${methodName}). Deuda restante: ${formatCLP(remainingDebtAfter)}`, 'success');
            }
            this.showAccountDetails(customerId);
            this.refresh();
        } catch (error) {
            showNotification('Error al procesar el pago: ' + error.message, 'error');
            console.error('Error al pagar deuda total:', error);
        }
    },

    getPaymentMethodName(method) {
        const names = {
            cash: 'Efectivo',
            card: 'Tarjeta',
            qr: 'QR',
            other: 'Otro',
            pending: 'Anotado',
            discount: 'Descuento',
            debt: 'Anotado',
            creditBalance: 'Saldo Favor'
        };
        return names[method] || method;
    },

    // ---- HELPERS: SESIONES DE PAGO DE DEUDA ----

    /**
     * Crea un registro en debtPaymentSessions en el backend.
     * No-blocking: si falla, no interrumpe el flujo de pago.
     */
    async createDebtPaymentSession(sessionData) {
        if (db.mode !== 'sqlite') return;
        try {
            await ApiClient.post('complex/debt-payment-session', { session: sessionData });
        } catch(e) {
            console.warn('[PaymentSession] Error al crear sesión:', e);
        }
    },

    /** Expande/colapsa el detalle de una sesión de pago */
    toggleSession(sessionId) {
        const detail = document.getElementById(`sdetail-${sessionId}`);
        const arrow  = document.getElementById(`sarrow-${sessionId}`);
        if (!detail) return;
        const open = detail.style.display === 'none';
        detail.style.display = open ? 'block' : 'none';
        if (arrow) arrow.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
    },

    /** Expande/colapsa los productos de una venta dentro de una sesión */
    toggleSessionSale(sessionId, saleIndex) {
        const products = document.getElementById(`sprods-${sessionId}-${saleIndex}`);
        const arrow    = document.getElementById(`sarr-${sessionId}-${saleIndex}`);
        if (!products) return;
        const open = products.style.display === 'none';
        products.style.display = open ? 'block' : 'none';
        if (arrow) arrow.textContent = open ? '\u25B2' : '\u25BC';
    },

    async shareAccountStatusViaWhatsApp(customerId) {
        const customer = await Customer.getById(customerId);
        const balance = await Customer.getAccountBalance(customerId);
        
        const netDebt = balance.totalDebt;
        const netCredit = balance.balanceCredit;
        const finalBalance = Math.max(0, netDebt - netCredit);
        
        const businessName = localStorage.getItem('business_name') || 'nuestro negocio';
        
        let message = `Hola *${customer.name}*, te envío un resumen de tu cuenta en *${businessName}*:\n\n`;
        
        if (netDebt > 0) {
            message += `Deuda pendiente: *${formatCLP(netDebt)}*\n`;
        }
        if (netCredit > 0) {
            message += `Saldo a favor: *${formatCLP(netCredit)}*\n`;
        }
        
        message += `-------------------\n`;
        message += `*Total a pagar: ${formatCLP(finalBalance)}*\n\n`;
        
        if (balance.pendingSales.length > 0) {
            message += `Detalle de deudas:\n`;
            balance.pendingSales.slice(0, 5).forEach(s => {
                message += `- Venta #${s.saleNumber} (${formatDate(s.date)}): ${formatCLP(s.remaining)}\n`;
            });
            if (balance.pendingSales.length > 5) {
                message += `- ... y ${balance.pendingSales.length - 5} más.\n`;
            }
        }
        
        message += `\nQuedamos atentos a cualquier duda. ¡Gracias!`;
        
        const encodedMessage = encodeURIComponent(message);
        const phone = customer.phone.replace(/\D/g, '');
        // Si no tiene código de país, asumir Chile (+56)
        const finalPhone = phone.length === 9 ? `56${phone}` : phone;
        
        const url = `https://wa.me/${finalPhone}?text=${encodedMessage}`;
        window.open(url, '_blank');
    },

    togglePrivacyMode() {
        const isPrivacyActive = localStorage.getItem('customers_privacy_mode') === 'true';
        localStorage.setItem('customers_privacy_mode', !isPrivacyActive);
        
        const btn = document.getElementById('btnPrivacyMode');
        if (btn) {
            btn.textContent = !isPrivacyActive ? '👁️‍🗨️ Mostrar Saldos' : '👁️ Ocultar Saldos';
        }
        this.refresh();
    },

    async showPaymentsHistoryModal() {
        const today = new Date().toISOString().split('T')[0];
        
        const content = `
            <div style="padding: 0.5rem;">
                <div style="display: flex; gap: 1rem; align-items: flex-end; margin-bottom: 1.5rem; flex-wrap: wrap; background: #f8fafc; padding: 1.25rem; border-radius: 1rem; border: 1.5px solid #e2e8f0;">
                    <div class="form-group" style="flex: 1; min-width: 140px; margin: 0;">
                        <label style="font-weight: 700; font-size: 0.85rem; color: #475569;">Fecha Desde:</label>
                        <input type="date" id="history_start_date" class="form-control" value="${today}" style="height: 2.5rem;">
                    </div>
                    <div class="form-group" style="flex: 1; min-width: 140px; margin: 0;">
                        <label style="font-weight: 700; font-size: 0.85rem; color: #475569;">Fecha Hasta:</label>
                        <input type="date" id="history_end_date" class="form-control" value="${today}" style="height: 2.5rem;">
                    </div>
                    <button class="btn btn-primary" onclick="CustomersView.loadPaymentsHistory()" style="height: 2.5rem; padding: 0 1.5rem; font-weight: 700;">
                        🔍 Filtrar Pagos
                    </button>
                </div>
                
                <div id="paymentsHistoryResult" style="max-height: 400px; overflow-y: auto; background: #ffffff; border-radius: 1rem; border: 1.5px solid #e2e8f0; padding: 1rem;">
                    <p style="text-align: center; color: #94a3b8; font-style: italic; margin: 2rem 0;">Selecciona un rango de fechas y haz clic en Filtrar</p>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
        `;

        showModal(content, { title: '📅 Historial de Pagos y Abonos Recibidos', footer, width: '750px' });
        
        setTimeout(() => this.loadPaymentsHistory(), 100);
    },

    async loadPaymentsHistory() {
        const startInput = document.getElementById('history_start_date');
        const endInput = document.getElementById('history_end_date');
        const container = document.getElementById('paymentsHistoryResult');
        
        if (!startInput || !endInput || !container) return;
        
        container.innerHTML = '<p style="text-align: center; color: #64748b; margin: 2rem 0;">⏳ Cargando cobros...</p>';
        
        const start = startInput.value + 'T00:00:00';
        const end = endInput.value + 'T23:59:59';
        
        try {
            const rawPayments = await Payment.getByDateRange(start, end);
            const payments = (rawPayments || []).filter(p => p.paymentMethod !== 'discount');
            
            if (payments.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #94a3b8; font-style: italic; margin: 2rem 0;">No se registraron abonos en este rango de fechas.</p>';
                return;
            }

            const customers = await Customer.getAll();
            const customerMap = {};
            customers.forEach(c => customerMap[c.id] = c.name);

            // Agrupar cobros por sesión (mismo cliente, minuto, método y nota)
            const grouped = {};
            payments.forEach(p => {
                const d = new Date(p.date);
                const minuteKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                const groupKey = `${p.customerId}_${minuteKey}_${p.paymentMethod}_${p.notes}`;
                
                if (!grouped[groupKey]) {
                    grouped[groupKey] = {
                        customerId: p.customerId,
                        date: p.date,
                        paymentMethod: p.paymentMethod,
                        notes: p.notes,
                        amount: 0,
                        items: []
                    };
                }
                grouped[groupKey].amount += parseFloat(p.amount) || 0;
                grouped[groupKey].items.push(p);
            });

            const groupedPayments = Object.values(grouped);
            groupedPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

            const totalRecaudado = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

            let html = `
                <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 0.75rem; padding: 1rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 700; color: #166534;">Total Cobrado en Rango:</span>
                    <strong style="font-size: 1.3rem; color: #166534; font-weight: 900;">${formatCLP(totalRecaudado)}</strong>
                </div>
                <div class="table-container">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; font-size: 0.85rem; color: #64748b;">
                                <th style="padding: 0.75rem 0.5rem;">Fecha y Hora</th>
                                <th style="padding: 0.75rem 0.5rem;">Cliente</th>
                                <th style="padding: 0.75rem 0.5rem;">Método</th>
                                <th style="padding: 0.75rem 0.5rem; text-align: right;">Monto</th>
                                <th style="padding: 0.75rem 0.5rem;">Detalles</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            groupedPayments.forEach((gp, idx) => {
                const clientName = customerMap[gp.customerId] || `Cliente #${gp.customerId}`;
                const method = this.getPaymentMethodName(gp.paymentMethod);
                const hasMultiple = gp.items.length > 1;
                const detailId = `gp-detail-${idx}`;
                
                let detailsHtml = safeHTML(gp.notes || '-');
                if (hasMultiple) {
                    detailsHtml = `
                        <div style="cursor: pointer; color: #2563eb; font-weight: 750;" onclick="const el = document.getElementById('${detailId}'); el.style.display = el.style.display === 'none' ? 'block' : 'none'">
                            ${safeHTML(gp.notes || 'Pago de deuda')} <span style="font-size: 0.75rem; color: #2563eb; background: rgba(37, 99, 235, 0.08); padding: 0.15rem 0.4rem; border-radius: 0.5rem; margin-left: 0.25rem; font-weight: 800;">Ver ${gp.items.length} ventas 👁️</span>
                        </div>
                        <div id="${detailId}" style="display: none; margin-top: 0.5rem; background: #f8fafc; border: 1.5px dashed #cbd5e1; padding: 0.65rem; border-radius: 0.75rem; font-size: 0.75rem; max-width: 320px; box-shadow: var(--shadow-sm);">
                            <ul style="margin: 0; padding-left: 1.1rem; color: #475569; display: flex; flex-direction: column; gap: 0.25rem;">
                                ${gp.items.map(item => `
                                    <li>Venta #${item.saleId || 'N/A'}: <strong>${formatCLP(item.amount)}</strong></li>
                                `).join('')}
                            </ul>
                        </div>
                    `;
                }

                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9; font-size: 0.85rem; color: #334155;">
                        <td style="padding: 0.75rem 0.5rem;">${formatDateTime(gp.date)}</td>
                        <td style="padding: 0.75rem 0.5rem; font-weight: 700; text-transform: capitalize;">${safeHTML(clientName)}</td>
                        <td style="padding: 0.75rem 0.5rem;">${method}</td>
                        <td style="padding: 0.75rem 0.5rem; text-align: right; font-weight: 800; color: #16a34a;">${formatCLP(gp.amount)}</td>
                        <td style="padding: 0.75rem 0.5rem;">${detailsHtml}</td>
                    </tr>
                `;
            });


            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            container.innerHTML = html;
        } catch(e) {
            container.innerHTML = `<p style="text-align: center; color: #ef4444; font-weight: 700; margin: 2rem 0;">Error al cargar cobros: ${e.message}</p>`;
        }
    },

    async sendWhatsAppReminder(customerId) {
        const customer = await Customer.getById(customerId);
        if (!customer || !customer.phone) {
            showNotification('El cliente no tiene teléfono registrado', 'warning');
            return;
        }
        const balance = await CustomerAccountService.getCustomerBalance(customerId);
        const netDebt = Math.max(0, (balance.totalDebt || 0) - (balance.balanceCredit || 0));

        if (netDebt <= 0) {
            showNotification(`El cliente ${customer.name} no registra deuda pendiente al día de hoy.`, 'info');
            return;
        }

        let phone = customer.phone.replace(/[^0-9]/g, '');
        if (phone.length === 9 && phone.startsWith('9')) {
            phone = '56' + phone;
        }

        const bizName = localStorage.getItem('ticketBusinessName') || 'nuestro negocio';
        const text = `Hola ${customer.name}, te saludamos de ${bizName}. Te recordamos amablemente tu saldo pendiente de deudas de ${formatCLP(netDebt)} al día de hoy. Si deseas ver el detalle de tus compras, contáctanos. ¡Muchas gracias por tu preferencia!`;

        const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    },

    async exportAccountStatement(customerId) {
        const customer = await Customer.getById(customerId);
        const balance = await CustomerAccountService.getCustomerBalance(customerId);
        const pendingSales = balance.pendingSales || [];

        const bizName = localStorage.getItem('ticketBusinessName') || 'SISTEMA DE VENTAS';
        const todayStr = new Date().toLocaleDateString('es-CL');

        let textSummary = `====================================\n`;
        textSummary += `ESTADO DE CUENTA DE CLIENTE\n`;
        textSummary += `Establecimiento: ${bizName}\n`;
        textSummary += `Fecha de Emisión: ${todayStr}\n`;
        textSummary += `====================================\n`;
        textSummary += `Cliente: ${customer.name}\n`;
        if (customer.rut) textSummary += `RUT/ID: ${customer.rut}\n`;
        if (customer.phone) textSummary += `Teléfono: ${customer.phone}\n`;
        textSummary += `------------------------------------\n`;
        textSummary += `DETALLE DE VENTAS PENDIENTES:\n`;

        if (pendingSales.length === 0) {
            textSummary += `No registra ventas pendientes. Al día.\n`;
        } else {
            pendingSales.forEach(s => {
                const dateFmt = new Date(s.date).toLocaleDateString('es-CL');
                textSummary += `• Venta #${s.saleNumber || s.saleId} (${dateFmt}): Total ${formatCLP(s.total)} | Resta: ${formatCLP(s.remaining)}\n`;
            });
        }

        textSummary += `------------------------------------\n`;
        textSummary += `RESUMEN FINANCIERO:\n`;
        textSummary += `Deuda Total:     ${formatCLP(balance.totalDebt)}\n`;
        textSummary += `Saldo a Favor:   ${formatCLP(balance.balanceCredit)}\n`;
        const net = Math.max(0, balance.totalDebt - balance.balanceCredit);
        textSummary += `SALDO NETO A PAGAR: ${formatCLP(net)}\n`;
        textSummary += `====================================\n`;

        const content = `
            <div style="font-family: monospace; background: #f8fafc; padding: 1.25rem; border-radius: 0.75rem; border: 1.5px solid #cbd5e1; white-space: pre-wrap; font-size: 0.85rem; max-height: 400px; overflow-y: auto; color: #1e293b;">${safeHTML(textSummary)}</div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
            <button class="btn btn-info" onclick="navigator.clipboard.writeText(\`${safeHTML(textSummary).replace(/`/g, '\\`')}\`); showNotification('Copiado al portapapeles', 'success');">📋 Copiar Texto para WhatsApp</button>
            <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
        `;

        showModal(content, { title: `Estado de Cuenta - ${customer.name}`, footer, width: '550px' });
    },

    setQuickPromiseDate(days) {
        const input = document.getElementById('promiseDateInput');
        if (!input) return;
        const target = new Date();
        target.setDate(target.getDate() + days);
        input.value = target.toISOString().split('T')[0];
    }
};
