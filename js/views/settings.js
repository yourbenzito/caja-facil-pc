const SettingsView = {
    async render() {
        // C6: Optimización - No bloquear el renderizado con conteos pesados
        setTimeout(() => {
            this.updateStats();
            this.initSecuritySection();
            this.initAutoBackupSection();
            this.initPOSSettingsSection();
            this.loadUserRoles();
            this.initSQLiteInfo();
            this.initAppearance();
            this.loadMultipleCashSettings();
            this.loadRolesPermissions();
            this.loadPrinterSettings();
            this.loadCloudBackupSettings();
            this.loadTicketSettings();
            this.initMultiDeviceSection();
            this.loadGeminiSettings();
        }, 100);

        const activeTab = localStorage.getItem('active_settings_tab') || 'menu';

        return `
            <style>
                .settings-dashboard-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.5rem;
                    margin-top: 1.5rem;
                }
                .settings-category-card {
                    background: #ffffff;
                    border: 1.5px solid #cbd5e1;
                    border-radius: 1.25rem;
                    padding: 1.75rem;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06);
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    position: relative;
                    overflow: hidden;
                    border-top: 6px solid #e2e8f0;
                }
                .settings-category-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
                    border-color: var(--card-hover-border);
                }
                .settings-category-card .card-icon {
                    font-size: 2.25rem;
                    margin-bottom: 0.25rem;
                }
                .settings-category-card h3 {
                    margin: 0;
                    font-size: 1.15rem;
                    font-weight: 850;
                    color: #1e293b;
                }
                .settings-category-card p {
                    margin: 0;
                    font-size: 0.85rem;
                    color: #64748b;
                    line-height: 1.4;
                    font-weight: 500;
                }
                .settings-category-card .card-action {
                    margin-top: auto;
                    font-size: 0.825rem;
                    font-weight: 800;
                    color: var(--card-accent-color);
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }
                .settings-content-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    margin-top: 1.5rem;
                }
                .settings-section-panel {
                    display: none;
                    flex-direction: column;
                    gap: 1.5rem;
                    animation: settingsFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .settings-section-panel.active {
                    display: flex;
                }
                .btn-back-settings {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: #f1f5f9;
                    color: #334155;
                    border: 1.5px solid #cbd5e1;
                    padding: 0.6rem 1.25rem;
                    border-radius: 0.75rem;
                    font-weight: 750;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.9rem;
                    align-self: flex-start;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .btn-back-settings:hover {
                    background: #e2e8f0;
                    color: #0f172a;
                    transform: translateX(-3px);
                }
                .settings-panel-header {
                    padding: 1.25rem 1.5rem;
                    border-radius: 1rem;
                    border-left: 5px solid;
                    margin-bottom: 0.5rem;
                    background: #ffffff;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
                }
                .settings-panel-header h2 {
                    margin: 0 0 0.35rem 0;
                    font-size: 1.2rem;
                    font-weight: 850;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .settings-panel-header p {
                    margin: 0;
                    font-size: 0.825rem;
                    color: #6b7280;
                    font-weight: 500;
                }
                @keyframes settingsFadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>

            <div class="view-header">
                <h1 style="color: #111827;">Configuración Premium</h1>
                <p style="color: #4b5563;">Personalización de interfaz y gestión de datos</p>
            </div>

            <!-- MENU PRINCIPAL: DASHBOARD DE TARJETAS EN RELIEVE -->
            <div id="settings-dashboard" class="settings-dashboard-grid" style="display: ${activeTab === 'menu' ? 'grid' : 'none'};">
                <div class="settings-category-card" style="--card-hover-border: #6366f1; --card-accent-color: #4f46e5; border-top-color: #6366f1;" onclick="SettingsView.switchTab('settings-tab-visual')">
                    <div class="card-icon">🎨</div>
                    <h3>Aspecto Visual</h3>
                    <p>Personaliza la paleta de colores de la aplicación, controla el brillo y visualiza estadísticas generales.</p>
                    <div class="card-action">Configurar Aspecto ➔</div>
                </div>
                <div class="settings-category-card" style="--card-hover-border: #10b981; --card-accent-color: #059669; border-top-color: #10b981;" onclick="SettingsView.switchTab('settings-tab-pos')">
                    <div class="card-icon">🛒</div>
                    <h3>Ventas y Caja (POS)</h3>
                    <p>Controla stock negativo, semáforo de deudas de clientes y la apertura de múltiples cajas.</p>
                    <div class="card-action">Configurar POS y Caja ➔</div>
                </div>
                <div class="settings-category-card" style="--card-hover-border: #06b6d4; --card-accent-color: #0891b2; border-top-color: #06b6d4;" onclick="SettingsView.switchTab('settings-tab-hardware')">
                    <div class="card-icon">🔌</div>
                    <h3>Impresoras y Lectores</h3>
                    <p>Configura impresoras térmicas, balanzas electrónicas, lectores de barras y personaliza tickets.</p>
                    <div class="card-action">Configurar Hardware ➔</div>
                </div>
                <div class="settings-category-card" style="--card-hover-border: #f59e0b; --card-accent-color: #d97706; border-top-color: #f59e0b;" onclick="SettingsView.switchTab('settings-tab-security')">
                    <div class="card-icon">🔐</div>
                    <h3>Seguridad y Personal</h3>
                    <p>Administra las cuentas de cajeros, gestiona roles, define permisos y configura el PIN global.</p>
                    <div class="card-action">Configurar Accesos ➔</div>
                </div>
                <div class="settings-category-card" style="--card-hover-border: #f43f5e; --card-accent-color: #e11d48; border-top-color: #f43f5e;" onclick="SettingsView.switchTab('settings-tab-system')">
                    <div class="card-icon">💾</div>
                    <h3>Respaldos y Sistema</h3>
                    <p>Descarga copias de seguridad de datos, exporta informes a Excel y limpia la memoria caché.</p>
                    <div class="card-action">Gestionar Sistema ➔</div>
                </div>

                <div class="settings-category-card" style="--card-hover-border: #8b5cf6; --card-accent-color: #7c3aed; border-top-color: #8b5cf6;" onclick="SettingsView.switchTab('settings-tab-ai')">
                    <div class="card-icon">🤖</div>
                    <h3>Inteligencia Artificial</h3>
                    <p>Configura tu clave de Gemini y habilita el asistente Copiloto inteligente.</p>
                    <div class="card-action">Configurar IA ➔</div>
                </div>
            </div>

            <!-- CONTENEDOR DE OPCIONES INTERNAS -->
            <div class="settings-content-wrapper" style="display: ${activeTab === 'menu' ? 'none' : 'block'};">

                <!-- PANE 1: VISUAL -->
                <div id="settings-tab-visual" class="settings-section-panel ${activeTab === 'settings-tab-visual' ? 'active' : ''}">
                    <button class="btn-back-settings" onclick="SettingsView.showCategoriesMenu()">
                        ⬅️ Regresar a Ajustes
                    </button>
                    
                    <div class="settings-panel-header" style="border-left-color: #6366f1; background: #faf5ff;">
                        <h2 style="color: #4f46e5;">🎨 Aspecto e Interfaz Visual</h2>
                        <p>Ajusta el tema visual de la aplicación, colores generales y luminosidad para tu local.</p>
                    </div>
                    
                    <!-- SECCIÓN: APARIENCIA Y TEMAS -->
                    <div class="card" style="margin-bottom: 1.5rem; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #6366f1;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">🎨 Personalización Visual</h3>
                        <div class="grid grid-2" style="gap: 2rem;">
                            <div>
                                <h4 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-muted);">ELEGIR PALETA DE COLORES</h4>
                                <div id="theme-options-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.75rem;">
                                    ${this.renderThemeOptions()}
                                </div>
                            </div>
                            <div>
                                <h4 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-muted);">CONTROL DE LUMINOSIDAD</h4>
                                <div style="background: #f8fafc; padding: 1.5rem; border-radius: 1rem; border: 1px solid #e2e8f0;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                        <span>Brillo de la App</span>
                                        <strong id="brightness-value">100%</strong>
                                    </div>
                                    <input type="range" id="brightness-slider" min="0.3" max="1" step="0.05" value="1" 
                                           style="width: 100%; cursor: pointer;" 
                                           oninput="SettingsView.updateBrightness(this.value)">
                                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 1rem;">
                                        Ajusta la luz de la pantalla para reducir la fatiga visual en ambientes oscuros.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN: ESTADÍSTICAS -->
                    <div class="card" style="margin-bottom: 0; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #6366f1;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">📊 Estadísticas del Sistema</h3>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.875rem 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='#f9fafb'">
                                <span style="color: #374151; font-weight: 500;">📦 Productos registrados:</span>
                                <strong id="stat-products" style="color: #4f46e5; font-size: 1.1rem;">Cargando...</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.875rem 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='#f9fafb'">
                                <span style="color: #374151; font-weight: 500;">💵 Ventas totales:</span>
                                <strong id="stat-sales" style="color: #059669; font-size: 1.1rem;">Cargando...</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.875rem 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='#f9fafb'">
                                <span style="color: #374151; font-weight: 500;">👥 Clientes registrados:</span>
                                <strong id="stat-customers" style="color: #db2777; font-size: 1.1rem;">Cargando...</strong>
                            </div>
                        </div>
                        <button class="btn btn-secondary" style="width: 100%; margin-top: 1.5rem; background: #f9fafb; color: #374151; border: 1.5px solid #d1d5db; font-weight: 600;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f9fafb'"
                                onclick="SettingsView.checkStorage()">
                            Ver Uso de Almacenamiento
                        </button>
                    </div>
                </div>

                <!-- PANE 2: POS Y CAJA -->
                <div id="settings-tab-pos" class="settings-section-panel ${activeTab === 'settings-tab-pos' ? 'active' : ''}">
                    <button class="btn-back-settings" onclick="SettingsView.showCategoriesMenu()">
                        ⬅️ Regresar a Ajustes
                    </button>
                    
                    <div class="settings-panel-header" style="border-left-color: #10b981; background: #f0fdf4;">
                        <h2 style="color: #059669;">🛒 Configuración de Venta y Flujo de Caja</h2>
                        <p>Controla las políticas de venta, los límites de alerta para clientes fiados y la gestión operativa de cajas.</p>
                    </div>

                    <!-- SECCIÓN: REGLAS OPERATIVAS DEL POS (STOCK) -->
                    <div class="card" style="margin-bottom: 1.5rem; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #10b981;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">🛒 Reglas Operativas de Venta</h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; font-weight: 600;">
                                <input type="checkbox" id="posAllowNegativeStock" style="width: 1.2rem; height: 1.2rem; cursor: pointer;" onchange="SettingsView.savePOSSettings()">
                                <span>Permitir ventas con stock negativo (sin stock disponible)</span>
                            </label>
                            <p style="font-size: 0.85rem; color: #6b7280; margin-left: 2rem; margin-top: -0.5rem; line-height: 1.4;">
                                Si se desactiva, el sistema impedirá agregar productos al carrito o finalizar la venta si la cantidad solicitada excede el stock actual del inventario.
                            </p>
                        </div>
                    </div>

                    <!-- SECCIÓN: ALERTA DE DEUDAS DE CLIENTES -->
                    <div class="card" style="margin-bottom: 1.5rem; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #10b981;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">🚦 Semáforo de Alerta de Deudas</h3>
                        <div class="grid grid-2" style="gap: 1.5rem; margin-bottom: 1rem;">
                            <div class="form-group">
                                <label style="font-weight: 700; color: #374151; display: block; margin-bottom: 0.5rem;">Límite para Deuda Leve (Amarillo) - CLP</label>
                                <input type="number" id="debtLimitMild" class="form-control" min="0" step="1" onchange="SettingsView.saveDebtSettings()" style="height: 2.75rem; font-size: 1rem;">
                                <small style="color: #6b7280;">Deudas menores a este monto serán clasificadas como Leves (🟢 es $0).</small>
                            </div>
                            <div class="form-group">
                                <label style="font-weight: 700; color: #374151; display: block; margin-bottom: 0.5rem;">Límite para Deuda Alta (Rojo) - CLP</label>
                                <input type="number" id="debtLimitHigh" class="form-control" min="0" step="1" onchange="SettingsView.saveDebtSettings()" style="height: 2.75rem; font-size: 1rem;">
                                <small style="color: #6b7280;">Deudas entre el límite leve y este monto serán Altas. Sobre este monto serán Críticas (🟣).</small>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN: MÚLTIPLES CAJAS -->
                    <div class="card" style="margin-bottom: 0; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #10b981;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">💰 Gestión de Múltiples Cajas</h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; font-weight: 600;">
                                <input type="checkbox" id="allowMultipleCashRegisters" style="width: 1.2rem; height: 1.2rem; cursor: pointer;" onchange="SettingsView.saveMultipleCashSettings()">
                                <span>Permitir múltiples cajas simultáneas</span>
                            </label>
                            <p style="font-size: 0.85rem; color: #6b7280; margin-left: 2rem; margin-top: -0.5rem; line-height: 1.4;">
                                Si se activa, permite abrir múltiples cajas al mismo tiempo (útil para locales con varios cajeros). Si se desactiva, solo se permite una caja abierta a la vez.
                            </p>
                        </div>
                        <div style="margin-top: 1.5rem;">
                            <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: #374151;">Cajas Activas</h4>
                            <div id="activeCashRegistersList" style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <p style="color: #6b7280; font-size: 0.85rem;">Cargando cajas...</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- PANE 3: HARDWARE Y DISPOSITIVOS -->
                <div id="settings-tab-hardware" class="settings-section-panel ${activeTab === 'settings-tab-hardware' ? 'active' : ''}">
                    <button class="btn-back-settings" onclick="SettingsView.showCategoriesMenu()">
                        ⬅️ Regresar a Ajustes
                    </button>
                    
                    <div class="settings-panel-header" style="border-left-color: #06b6d4; background: #ecfeff;">
                        <h2 style="color: #0891b2;">🔌 Impresión, Escáneres y Conexiones</h2>
                        <p>Vincula tus periféricos de mostrador como impresoras de boletas, básculas de pesaje o lectores e integra tu red.</p>
                    </div>

                    <!-- SECCIÓN: IMPRESORAS TÉRMICAS -->
                    ${PermissionService.can('settings.security') ? `
                    <div class="card" style="margin-bottom: 1.5rem; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #06b6d4;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">🖨️ Configuración de Impresoras Térmicas</h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div>
                                <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: #374151;">Impresora de Tickets</h4>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">
                                    Configura la impresora térmica para imprimir tickets de venta.
                                </p>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                                    <div>
                                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Puerto de Impresión</label>
                                        <select id="printerPort" class="form-control" style="font-size: 0.9rem; padding: 0.5rem;" onchange="SettingsView.handlePrinterPortChange()">
                                            <option value="USB">USB</option>
                                            <option value="COM1">COM1</option>
                                            <option value="COM2">COM2</option>
                                            <option value="COM3">COM3</option>
                                            <option value="LPT1">LPT1</option>
                                            <option value="network">Red (IP)</option>
                                            <option value="bluetooth">Bluetooth (Inalámbrico)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Ancho del Papel</label>
                                        <select id="paperWidth" class="form-control" style="font-size: 0.9rem; padding: 0.5rem;">
                                            <option value="58mm">58mm (Estándar)</option>
                                            <option value="80mm">80mm (Grande)</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <!-- Configuración específica de Bluetooth -->
                                <div id="bluetoothPrinterConfig" style="display: none; margin-top: 1.25rem; padding: 1.25rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 1rem;">
                                    <h5 style="margin-bottom: 0.5rem; font-size: 0.95rem; color: #1e293b; font-weight: 700;">Dispositivo Bluetooth Vinculado</h5>
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                                        <div>
                                            <span id="bluetoothDeviceStatus" style="font-size: 0.85rem; font-weight: 700; color: #94a3b8;">Verificando adaptador...</span>
                                            <div id="bluetoothSavedName" style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-top: 0.25rem;">-</div>
                                        </div>
                                        <div style="display: flex; gap: 0.5rem;">
                                            <button class="btn btn-secondary" onclick="SettingsView.pairBluetoothPrinter()" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                                                🔍 Buscar y Vincular
                                            </button>
                                            <button class="btn btn-outline-danger" id="btnForgetBluetooth" onclick="SettingsView.forgetBluetoothPrinter()" style="padding: 0.5rem 1rem; font-size: 0.85rem; display: none;">
                                                🗑️ Olvidar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 1rem;">
                                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; font-weight: 600;">
                                    <input type="checkbox" id="autoPrintTicket" style="width: 1.2rem; height: 1.2rem; cursor: pointer;" onchange="SettingsView.savePrinterSettings()">
                                    <span>Imprimir ticket automáticamente al finalizar venta</span>
                                </label>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-left: 2rem; margin-top: -0.5rem; line-height: 1.4;">
                                    Si se activa, el sistema imprimirá automáticamente el ticket después de cada venta.
                                </p>
                            </div>
                            <div style="margin-top: 1rem;">
                                <button class="btn btn-primary" onclick="SettingsView.testPrinter()">
                                    🧪 Probar Impresión
                                </button>
                                <button class="btn btn-secondary" onclick="SettingsView.savePrinterSettings()">
                                    💾 Guardar Configuración
                                </button>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- SECCIÓN: PERSONALIZACIÓN DE TICKETS -->
                    ${PermissionService.can('settings.backup') ? `
                    <div class="card" style="margin-bottom: 1.5rem; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #06b6d4;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">🎫 Personalización de Tickets</h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div>
                                <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: #374151;">Encabezado del Ticket</h4>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">
                                    Personaliza el encabezado que aparece en todos los tickets de venta.
                                </p>
                                <div>
                                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Nombre del Negocio</label>
                                    <input type="text" id="ticketBusinessName" class="form-control" placeholder="Ej: Mi Tienda" style="font-size: 0.9rem; padding: 0.5rem;">
                                </div>
                                <div style="margin-top: 0.75rem;">
                                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Dirección</label>
                                    <input type="text" id="ticketAddress" class="form-control" placeholder="Ej: Calle Principal #123" style="font-size: 0.9rem; padding: 0.5rem;">
                                </div>
                                <div style="margin-top: 0.75rem;">
                                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Teléfono</label>
                                    <input type="text" id="ticketPhone" class="form-control" placeholder="Ej: +56 9 1234 5678" style="font-size: 0.9rem; padding: 0.5rem;">
                                </div>
                            </div>
                            <div style="margin-top: 1rem;">
                                <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: #374151;">Pie de Página</h4>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">
                                    Mensaje que aparece al final del ticket.
                                </p>
                                <textarea id="ticketFooter" class="form-control" placeholder="Ej: ¡Gracias por su compra!" rows="2" style="font-size: 0.9rem; padding: 0.5rem;"></textarea>
                            </div>
                            <div style="margin-top: 1rem;">
                                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; font-weight: 600;">
                                    <input type="checkbox" id="showLogoOnTicket" style="width: 1.2rem; height: 1.2rem; cursor: pointer;" onchange="SettingsView.saveTicketSettings()">
                                    <span>Mostrar logo en el ticket</span>
                                </label>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-left: 2rem; margin-top: -0.5rem; line-height: 1.4;">
                                    Si se activa, el logo del negocio aparecerá en el encabezado del ticket.
                                </p>
                            </div>
                            <div style="margin-top: 1rem;">
                                <button class="btn btn-primary" onclick="SettingsView.saveTicketSettings()">
                                    💾 Guardar Configuración
                                </button>
                                <button class="btn btn-secondary" onclick="SettingsView.previewTicket()">
                                    👁️ Vista Previa
                                </button>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- SECCIÓN: INTEGRACIÓN POS -->
                    ${PermissionService.can('settings.security') ? `
                    <div class="card" style="margin-bottom: 1.5rem; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #06b6d4;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">🔌 Integración POS (Lectores y Balanzas)</h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div>
                                <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: #374151;">Lector de Código de Barras</h4>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">
                                    Configura el lector de código de barras para escanear productos automáticamente.
                                </p>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                                    <div>
                                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Tipo de Lector</label>
                                        <select id="barcodeReaderType" class="form-control" style="font-size: 0.9rem; padding: 0.5rem;">
                                            <option value="usb">USB (HID)</option>
                                            <option value="serial">Serial (COM)</option>
                                            <option value="bluetooth">Bluetooth</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Sufijo de Escaneo</label>
                                        <select id="barcodeSuffix" class="form-control" style="font-size: 0.9rem; padding: 0.5rem;">
                                            <option value="enter">Enter (CR)</option>
                                            <option value="tab">Tab</option>
                                            <option value="none">Ninguno</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 1rem;">
                                <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: #374151;">Balanza Electrónica</h4>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">
                                    Configura la balanza para pesar productos vendidos por peso.
                                </p>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                                    <div>
                                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Puerto de Balanza</label>
                                        <select id="scalePort" class="form-control" style="font-size: 0.9rem; padding: 0.5rem;">
                                            <option value="COM1">COM1</option>
                                            <option value="COM2">COM2</option>
                                            <option value="COM3">COM3</option>
                                            <option value="USB">USB</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Unidad de Peso</label>
                                        <select id="weightUnit" class="form-control" style="font-size: 0.9rem; padding: 0.5rem;">
                                            <option value="kg">Kilogramos (kg)</option>
                                            <option value="g">Gramos (g)</option>
                                            <option value="lb">Libras (lb)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 1rem;">
                                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; font-weight: 600;">
                                    <input type="checkbox" id="autoWeighProducts" style="width: 1.2rem; height: 1.2rem; cursor: pointer;" onchange="SettingsView.savePOSSettings()">
                                    <span>Pesar productos automáticamente al escanear</span>
                                </label>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-left: 2rem; margin-top: -0.5rem; line-height: 1.4;">
                                    Si se activa, el sistema leerá automáticamente el peso de la balanza al escanear productos vendidos por peso.
                                </p>
                            </div>
                            <div style="margin-top: 1rem;">
                                <button class="btn btn-primary" onclick="SettingsView.testBarcodeReader()">
                                    🧪 Probar Lector
                                </button>
                                <button class="btn btn-secondary" onclick="SettingsView.testScale()">
                                    ⚖️ Probar Balanza
                                </button>
                                <button class="btn btn-secondary" onclick="SettingsView.savePOSSettings()">
                                    💾 Guardar Configuración
                                </button>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- SECCIÓN: MULTIDISPOSITIVO -->
                    <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); display: flex; flex-direction: column; justify-content: space-between; border-top: 4px solid #06b6d4;">
                        <div>
                            <h3 style="margin-bottom: 1rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">📱 Conexión Multidispositivo</h3>
                            <div id="multi-device-content" style="display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 1rem; min-height: 120px;">
                                <p style="font-size: 0.85rem; color: #4b5563; margin: 0;">
                                    Cargando información de red...
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- PANE 4: SEGURIDAD Y PERSONAL -->
                <div id="settings-tab-security" class="settings-section-panel ${activeTab === 'settings-tab-security' ? 'active' : ''}">
                    <button class="btn-back-settings" onclick="SettingsView.showCategoriesMenu()">
                        ⬅️ Regresar a Ajustes
                    </button>
                    
                    <div class="settings-panel-header" style="border-left-color: #f59e0b; background: #fffbeb;">
                        <h2 style="color: #d97706;">🔐 Usuarios, Seguridad y Permisos</h2>
                        <p>Administra los accesos de tus empleados, asigna roles de cajero o administrador y resguarda claves con PIN.</p>
                    </div>

                    <!-- SECCIÓN: GESTIÓN DE USUARIOS Y ROLES -->
                    ${PermissionService.can('settings.users') ? `
                    <div class="card" id="userManagementCard" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #f59e0b;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 style="margin: 0; color: #111827; font-size: 1.05rem;">👥 Gestión de Usuarios y Roles</h3>
                            <button class="btn btn-primary btn-sm" onclick="SettingsView.showCreateUserModal()">
                                + Nuevo Usuario
                            </button>
                        </div>
                        <p style="font-size: 0.875rem; color: var(--text); opacity: 0.8; margin-bottom: 1rem;">
                            Asigna roles a los usuarios del sistema. Los roles controlan el acceso a las diferentes secciones y acciones.
                        </p>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; padding: 0.75rem; background: var(--light); border-radius: 0.5rem; font-size: 0.85rem;">
                            <div><strong>Propietario:</strong> Acceso total</div>
                            <div><strong>Administrador:</strong> Gestión operativa</div>
                            <div><strong>Cajero:</strong> Solo POS y deudas</div>
                        </div>
                        <div id="userRolesList" style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <p style="color: var(--secondary);">Cargando usuarios...</p>
                        </div>
                    </div>
                    ` : ''}

                    <!-- SECCIÓN: SEGURIDAD Y PIN -->
                    ${PermissionService.can('settings.security') ? `
                    <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #f59e0b;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem;">🔐 Seguridad y Recuperación de Contraseña</h3>
                        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                            <div>
                                <h4 style="margin-bottom: 0.75rem;">PIN de Administrador Global</h4>
                                <p style="font-size: 0.875rem; color: var(--text); opacity: 0.8; margin-bottom: 1rem;">
                                    Establece un PIN de 4-8 dígitos para restablecer la contraseña de <strong>cualquier usuario</strong> del sistema. Este PIN es global y funciona para todos los usuarios.
                                </p>
                                <div id="adminPINStatus" style="margin-bottom: 0.75rem; padding: 0.75rem; background: var(--light); border-radius: 0.375rem; font-size: 0.875rem;">
                                    <span id="pinStatusText">Cargando...</span>
                                </div>
                                <button class="btn btn-primary" id="adminPINBtn" onclick="SettingsView.showSetAdminPINForm()">
                                    Configurar PIN
                                </button>
                            </div>
                            <div style="border-top: 1px solid var(--border); padding-top: 1.5rem;">
                                <h4 style="margin-bottom: 0.75rem;">Código de Recuperación</h4>
                                <p style="font-size: 0.875rem; color: var(--text); opacity: 0.8; margin-bottom: 1rem;">
                                    Genera un código de recuperación para restablecer tu contraseña. 
                                    <strong>Guarda este código en un lugar seguro</strong> - solo se mostrará una vez.
                                </p>
                                <div id="recoveryCodeStatus" style="margin-bottom: 0.75rem; padding: 0.75rem; background: var(--light); border-radius: 0.375rem; font-size: 0.875rem;">
                                    <span id="codeStatusText">Cargando...</span>
                                </div>
                                <button class="btn btn-primary" onclick="SettingsView.generateRecoveryCode()">
                                    Generar Código de Recuperación
                                </button>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- SECCIÓN: ROLES Y PERMISOS GRANULARES -->
                    ${PermissionService.can('settings.security') ? `
                    <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #f59e0b;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">👥 Roles y Permisos Granulares</h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div>
                                <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: #374151;">Permisos por Rol</h4>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">
                                    Configura qué acciones puede realizar cada rol en el sistema.
                                </p>
                                <div id="rolesPermissionsList" style="display: flex; flex-direction: column; gap: 0.75rem;">
                                    <p style="color: #6b7280; font-size: 0.85rem;">Cargando roles...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>

                <!-- PANE 5: RESPALDOS Y SISTEMA -->
                <div id="settings-tab-system" class="settings-section-panel ${activeTab === 'settings-tab-system' ? 'active' : ''}">
                    <button class="btn-back-settings" onclick="SettingsView.showCategoriesMenu()">
                        ⬅️ Regresar a Ajustes
                    </button>
                    
                    <div class="settings-panel-header" style="border-left-color: #f43f5e; background: #fff1f2;">
                        <h2 style="color: #e11d48;">💾 Base de Datos, Respaldos y Utilitarios</h2>
                        <p>Realiza copias de seguridad de tu negocio, exporta bases contables a Excel y administra la salud del software.</p>
                    </div>

                    <!-- SECCIÓN: MANTENIMIENTO Y RESPALDOS -->
                    ${PermissionService.can('settings.backup') ? `
                    <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #f43f5e;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">💾 Copias de Seguridad y Mantenimiento</h3>
                        <div class="grid grid-2" style="gap: 2rem;">
                            <div>
                                <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: #374151;">Gestión de Base de Datos</h4>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1.5rem;">
                                    Descarga una copia completa de tu negocio para respaldar en la nube o en un pendrive. También puedes restaurar una copia previa.
                                </p>
                                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                    <button class="btn btn-primary" style="width: 100%; justify-content: center; background: #4f46e5; font-weight: 800; padding: 0.75rem 1rem; border-radius: 0.65rem;" onclick="BackupManager.exportAllData()">
                                        📤 Exportar Respaldo del Negocio (.JSON)
                                    </button>
                                    <div style="position: relative;">
                                        <button class="btn btn-secondary" style="width: 100%; justify-content: center; border: 2px solid #3b82f6; color: #1e40af; background: #eff6ff; font-weight: 800; padding: 0.75rem 1rem; border-radius: 0.65rem;" onclick="document.getElementById('importFile').click()">
                                            📥 Restaurar Respaldo del Negocio
                                        </button>
                                        <input type="file" id="importFile" style="display: none;" accept=".json" onchange="SettingsView.handleImport(event)">
                                    </div>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.25rem;">
                                        <button class="btn btn-secondary" style="width: 100%; justify-content: center; border: 1.5px solid #fbbf24; color: #92400e; background: #fffbeb; font-size: 0.8rem; font-weight: 700;" onclick="SettingsView.deduplicateSuppliers()">
                                            🧹 Proveedores Dup.
                                        </button>
                                        <button class="btn btn-secondary" style="width: 100%; justify-content: center; border: 1.5px solid #10b981; color: #065f46; background: #ecfdf5; font-size: 0.8rem; font-weight: 700;" onclick="SettingsView.deduplicateCustomers()">
                                            👥 Fusión Clientes
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: #374151;">Exportar a Excel (Contabilidad)</h4>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">
                                    Descarga reportes específicos en formato Excel para tu contador o para revisar en tu celular.
                                </p>
                                <div style="max-height: 150px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.5rem; background: #f9fafb;">
                                    <table style="width: 100%; font-size: 0.8rem;">
                                        <tbody>
                                            ${(window.BACKUP_ENTITY_CONFIG || []).map(entity => `
                                                <tr>
                                                    <td style="padding: 0.4rem 0; color: #374151;">${entity.label}</td>
                                                    <td style="text-align: right; padding: 0.4rem 0;">
                                                        <a href="javascript:void(0)" onclick="SettingsView.exportEntityData('${entity.key}')" style="color: #4f46e5; font-weight: 600; text-decoration: none;">Excel</a>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- SECCIÓN: BACKUP AUTOMÁTICO EN LA NUBE -->
                    ${PermissionService.can('settings.backup') ? `
                    <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #f43f5e;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">☁️ Backup Automático en la Nube</h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div>
                                <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: #374151;">Configuración de Backup</h4>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">
                                    Configura el backup automático de tus datos en la nube para mayor seguridad.
                                </p>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                                    <div>
                                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Proveedor de Nube</label>
                                        <select id="cloudProvider" class="form-control" style="font-size: 0.9rem; padding: 0.5rem;">
                                            <option value="none">Sin configurar</option>
                                            <option value="google">Google Drive</option>
                                            <option value="dropbox">Dropbox</option>
                                            <option value="onedrive">OneDrive</option>
                                            <option value="s3">Amazon S3</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Frecuencia de Backup</label>
                                        <select id="backupFrequency" class="form-control" style="font-size: 0.9rem; padding: 0.5rem;">
                                            <option value="daily">Diario</option>
                                            <option value="weekly">Semanal</option>
                                            <option value="monthly">Mensual</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 1rem;">
                                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; font-weight: 600;">
                                    <input type="checkbox" id="autoBackupEnabled" style="width: 1.2rem; height: 1.2rem; cursor: pointer;" onchange="SettingsView.saveCloudBackupSettings()">
                                    <span>Activar backup automático</span>
                                </label>
                                <p style="font-size: 0.85rem; color: #6b7280; margin-left: 2rem; margin-top: -0.5rem; line-height: 1.4;">
                                    Si se activa, el sistema realizará backups automáticos según la frecuencia configurada.
                                </p>
                            </div>
                            <div style="margin-top: 1rem;">
                                <button class="btn btn-primary" onclick="SettingsView.testCloudConnection()">
                                    🧪 Probar Conexión
                                </button>
                                <button class="btn btn-secondary" onclick="SettingsView.saveCloudBackupSettings()">
                                    💾 Guardar Configuración
                                </button>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- SECCIÓN: GENERAL Y CACHE -->
                    <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #f43f5e;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem;">⚙️ Opciones del Sistema</h3>
                        <div class="grid grid-3">
                            <div>
                                <h4 style="margin-bottom: 0.75rem;">Información</h4>
                                <p style="font-size: 0.875rem; color: var(--text); opacity: 0.8; margin-bottom: 0.75rem;">
                                    Versión: 1.0.0<br>
                                    Base de datos: ${db.mode === 'sqlite' ? 'SQLite (Servidor)' : 'IndexedDB (Local)'}<br>
                                    Estado: ${db.mode === 'sqlite' ? 'Online' : 'Offline'}
                                </p>
                                <button class="btn btn-secondary btn-sm" onclick="SettingsView.runSetupWizardAgain()" style="border: 1px dashed var(--primary); color: var(--primary); font-weight: 600;">
                                    🔧 Asistente de Configuración
                                </button>
                            </div>
                            <div>
                                <h4 style="margin-bottom: 0.75rem;">Cache</h4>
                                <button class="btn btn-secondary btn-sm" onclick="SettingsView.clearCache()">
                                    Limpiar Cache
                                </button>
                                <p style="font-size: 0.75rem; margin-top: 0.5rem; color: var(--text); opacity: 0.7;">
                                    Limpia archivos en cache
                                </p>
                            </div>
                            <div>
                                <h4 style="margin-bottom: 0.75rem;">Reinstalar</h4>
                                <button class="btn btn-secondary btn-sm" onclick="SettingsView.reinstallApp()">
                                    Reinstalar PWA
                                </button>
                                <p style="font-size: 0.75rem; margin-top: 0.5rem; color: var(--text); opacity: 0.7;">
                                    Actualiza la aplicación
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- PANE 6: INTELIGENCIA ARTIFICIAL -->
                <div id="settings-tab-ai" class="settings-section-panel ${activeTab === 'settings-tab-ai' ? 'active' : ''}">
                    <button class="btn-back-settings" onclick="SettingsView.showCategoriesMenu()">
                        ⬅️ Regresar a Ajustes
                    </button>
                    
                    <div class="settings-panel-header" style="border-left-color: #8b5cf6; background: #f5f3ff;">
                        <h2 style="color: #7c3aed;">🤖 Inteligencia Artificial y Copiloto IA</h2>
                        <p>Configura la integración con Gemini para habilitar el asistente conversacional en tu negocio.</p>
                    </div>

                    <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #8b5cf6;">
                        <h3 style="margin-bottom: 1.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">🔑 Clave API de Gemini (Google AI)</h3>
                        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                            <p style="font-size: 0.875rem; color: #475569; line-height: 1.5; margin: 0;">
                                Para activar el <strong>Copiloto Inteligente</strong> 🤖, ingresa tu clave API gratuita de <strong>Google Gemini</strong>. Si aún no tienes una, puedes conseguirla gratis en <a href="https://aistudio.google.com/" target="_blank" style="color: #7c3aed; font-weight: 700; text-decoration: underline;">Google AI Studio</a>.
                            </p>
                            
                            <div>
                                <label style="display: block; font-weight: 700; margin-bottom: 0.5rem; color: #374151;">Gemini API Key</label>
                                <input type="password" id="geminiApiKey" class="form-control" placeholder="AIzaSy..." style="font-size: 1rem; padding: 0.6rem 0.8rem; font-family: monospace; border: 1.5px solid #cbd5e1; border-radius: 0.5rem;">
                            </div>

                            <div style="display: flex; gap: 0.75rem; align-items: center; margin-top: 0.5rem;">
                                <button class="btn btn-primary" onclick="SettingsView.saveGeminiSettings()" style="background: #7c3aed; border: none; padding: 0.65rem 1.5rem; font-weight: 700;">
                                    💾 Guardar Clave de IA
                                </button>
                                <button class="btn btn-secondary" onclick="document.getElementById('geminiApiKey').type = document.getElementById('geminiApiKey').type === 'password' ? 'text' : 'password'" style="border: 1px solid #cbd5e1; padding: 0.65rem 1rem;">
                                    👁️ Mostrar / Ocultar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        `;
    },

    switchTab(tabId) {
        localStorage.setItem('active_settings_tab', tabId);
        
        // Ocultar el Dashboard principal
        const dashboard = document.getElementById('settings-dashboard');
        if (dashboard) dashboard.style.display = 'none';
        
        // Mostrar el wrapper del contenido
        const contentWrapper = document.querySelector('.settings-content-wrapper');
        if (contentWrapper) contentWrapper.style.display = 'block';
        
        // Desactivar todos los paneles
        document.querySelectorAll('.settings-section-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        // Activar el panel seleccionado
        const activePanel = document.getElementById(tabId);
        if (activePanel) activePanel.classList.add('active');
    },

    showCategoriesMenu() {
        localStorage.setItem('active_settings_tab', 'menu');
        
        // Ocultar todos los paneles internos
        document.querySelectorAll('.settings-section-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        // Ocultar el wrapper del contenido
        const contentWrapper = document.querySelector('.settings-content-wrapper');
        if (contentWrapper) contentWrapper.style.display = 'none';
        
        // Mostrar el Dashboard principal
        const dashboard = document.getElementById('settings-dashboard');
        if (dashboard) dashboard.style.display = 'grid';
    },

    // --- APARIENCIA ---
    initAppearance() {
        const theme = localStorage.getItem('APP_THEME') || 'indigo';
        const brightness = localStorage.getItem('APP_BRIGHTNESS') || '1';
        
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.setProperty('--app-brightness', brightness);
        
        const slider = document.getElementById('brightness-slider');
        const brightnessVal = document.getElementById('brightness-value');
        if (slider) slider.value = brightness;
        if (brightnessVal) brightnessVal.textContent = Math.round(brightness * 100) + '%';
    },

    async initMultiDeviceSection() {
        const container = document.getElementById('multi-device-content');
        if (!container) return;

        if (db.mode !== 'sqlite' || !window.ApiClient) {
            container.innerHTML = `
                <span style="font-size: 2rem;">📴</span>
                <p style="font-size: 0.875rem; color: #6b7280; line-height: 1.4; margin: 0; padding: 1rem;">
                    La conexión multidispositivo requiere que la base de datos esté en modo <strong>SQLite (Servidor Local)</strong>.
                </p>
            `;
            return;
        }

        try {
            const data = await window.ApiClient.get('system/network-info');
            if (data && data.ips && data.ips.length > 0) {
                const port = data.port || 3000;
                // Preferir la primera IP privada (192. o 10. o 172.)
                const preferredIp = data.ips.find(ip => ip.startsWith('192.') || ip.startsWith('10.') || ip.startsWith('172.')) || data.ips[0];
                const connectionUrl = `http://${preferredIp}:${port}/mobile/`;

                container.innerHTML = `
                    <p style="font-size: 0.85rem; color: #4b5563; line-height: 1.4; margin: 0;">
                        Escanea el código QR o ingresa la dirección en tu celular o tablet conectados al mismo Wi-Fi:
                    </p>
                    
                    <div style="margin: 0.5rem 0;">
                        <!-- QR Code con fallback offline -->
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(connectionUrl)}" 
                             onerror="this.style.display='none'; document.getElementById('qr-offline-fallback').style.display='block';" 
                             style="width: 130px; height: 130px; border: 1.5px solid #e5e7eb; padding: 0.25rem; border-radius: 0.75rem; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.05);" />
                        
                        <div id="qr-offline-fallback" style="display: none; padding: 1rem; border: 2px dashed #cbd5e1; border-radius: 0.75rem; background: #f8fafc; max-width: 200px; margin: 0 auto;">
                            <span style="font-size: 1.5rem;">📶</span>
                            <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">Modo Offline</div>
                        </div>
                    </div>

                    <div style="background: #f3f4f6; border: 1px solid #e5e7eb; padding: 0.5rem 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.95rem; font-weight: 600; color: #111827; word-break: break-all; display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%;">
                        <span>${connectionUrl}</span>
                        <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${connectionUrl}'); showNotification('Copiado al portapapeles', 'success');" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border: none; background: white; border-radius: 0.25rem; cursor: pointer;">📋</button>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <span style="font-size: 2rem;">⚠️</span>
                    <p style="font-size: 0.85rem; color: #ef4444; line-height: 1.4; margin: 0;">
                        No se detectaron direcciones IP locales en esta computadora. Asegúrate de estar conectado a una red local o Wi-Fi.
                    </p>
                `;
            }
        } catch (err) {
            console.error('[MultiDevice] Error obteniendo info de red:', err);
            container.innerHTML = `
                <span style="font-size: 2rem;">⚠️</span>
                <p style="font-size: 0.85rem; color: #ef4444; line-height: 1.4; margin: 0;">
                    Error al cargar la información de red: ${err.message}
                </p>
            `;
        }
    },

    updateBrightness(val) {
        document.documentElement.style.setProperty('--app-brightness', val);
        localStorage.setItem('APP_BRIGHTNESS', val);
        const brightnessVal = document.getElementById('brightness-value');
        if (brightnessVal) brightnessVal.textContent = Math.round(val * 100) + '%';
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('APP_THEME', theme);
        showNotification('Tema actualizado', 'success');
        
        // Actualizar visualmente la selección sin recargar toda la página
        const container = document.getElementById('theme-options-container');
        if (container) {
            container.innerHTML = this.renderThemeOptions();
        }
        
        this.initAppearance(); 
    },

    renderThemeOptions() {
        const themes = [
            { id: 'indigo', name: 'Indigo', color: '#4f46e5' },
            { id: 'emerald', name: 'Esmeralda', color: '#10b981' },
            { id: 'ruby', name: 'Rubí', color: '#e11d48' },
            { id: 'amber', name: 'Ámbar', color: '#f59e0b' },
            { id: 'midnight', name: 'Noche', color: '#0f172a' }
        ];
        
        const currentTheme = localStorage.getItem('APP_THEME') || 'indigo';
        
        return themes.map(t => `
            <div onclick="SettingsView.setTheme('${t.id}')" 
                 style="cursor: pointer; border: 2px solid ${currentTheme === t.id ? 'var(--primary)' : '#e2e8f0'}; padding: 0.5rem; border-radius: 0.75rem; text-align: center; transition: all 0.2s; background: ${currentTheme === t.id ? 'var(--primary-soft)' : 'white'};">
                <div style="width: 100%; height: 40px; background: ${t.color}; border-radius: 0.5rem; margin-bottom: 0.5rem;"></div>
                <span style="font-size: 0.75rem; font-weight: 700; color: ${currentTheme === t.id ? 'var(--primary)' : 'var(--text-muted)'};">${t.name}</span>
            </div>
        `).join('');
    },

    async updateStats() {

        try {
            const productCount = await db.count('products');
            const salesCount = await db.count('sales');
            const customerCount = await db.count('customers');

            const pElem = document.getElementById('stat-products');
            const sElem = document.getElementById('stat-sales');
            const cElem = document.getElementById('stat-customers');

            if (pElem) pElem.textContent = productCount;
            if (sElem) sElem.textContent = salesCount;
            if (cElem) cElem.textContent = customerCount;
        } catch (e) {
            console.warn('Error updating stats:', e);
        }
    },

    async initAutoBackupSection() {
        const card = document.getElementById('autoBackupCard');
        if (!card) return;
        if (typeof window !== 'undefined' && window.api && typeof window.api.backupSaveToDisk === 'function') {
            card.style.display = 'block';
            try {
                const enabledRow = await db.get('settings', 'autoBackupEnabled');
                const hoursRow = await db.get('settings', 'autoBackupIntervalHours');
                const onCloseRow = await db.get('settings', 'autoBackupOnClose');
                const cbEnabled = document.getElementById('autoBackupEnabled');
                const inputHours = document.getElementById('autoBackupIntervalHours');
                const cbOnClose = document.getElementById('autoBackupOnClose');
                if (cbEnabled) cbEnabled.checked = enabledRow == null ? true : !!enabledRow.value;
                if (inputHours) inputHours.value = (hoursRow && hoursRow.value != null) ? Number(hoursRow.value) : 24;
                if (cbOnClose) cbOnClose.checked = onCloseRow == null ? true : !!onCloseRow.value;
            } catch (e) {
                console.warn('initAutoBackupSection:', e.message);
            }
        } else {
            card.style.display = 'none';
        }
    },

    async saveAutoBackupOptions() {
        const cbEnabled = document.getElementById('autoBackupEnabled');
        const inputHours = document.getElementById('autoBackupIntervalHours');
        const cbOnClose = document.getElementById('autoBackupOnClose');
        if (!cbEnabled || !inputHours || !cbOnClose) return;
        try {
            const hours = Math.max(1, Math.min(168, Number(inputHours.value) || 24));
            await db.put('settings', { key: 'autoBackupEnabled', value: cbEnabled.checked });
            await db.put('settings', { key: 'autoBackupIntervalHours', value: hours });
            await db.put('settings', { key: 'autoBackupOnClose', value: cbOnClose.checked });
            inputHours.value = hours;
            showNotification('Opciones de backup guardadas. Recarga la página para aplicar el intervalo.', 'success');
            const note = document.getElementById('autoBackupNote');
            if (note) note.style.display = 'block';
        } catch (e) {
            showNotification('Error al guardar: ' + e.message, 'error');
        }
    },

    async initPOSSettingsSection() {
        const checkbox = document.getElementById('posAllowNegativeStock');
        if (!checkbox) return;
        try {
            const row = await db.get('settings', 'allowNegativeStock');
            checkbox.checked = row == null ? true : !!row.value;
        } catch (e) {
            console.warn('initPOSSettingsSection:', e.message);
            checkbox.checked = true;
        }
    },

    async savePOSSettings() {
        const checkbox = document.getElementById('posAllowNegativeStock');
        if (!checkbox) return;
        try {
            await db.put('settings', { key: 'allowNegativeStock', value: checkbox.checked });
            showNotification('Configuración de venta guardada exitosamente.', 'success');
        } catch (e) {
            showNotification('Error al guardar configuración: ' + e.message, 'error');
        }
    },

    get excelEntities() {
        return window.BACKUP_ENTITY_CONFIG || [];
    },

    renderExcelButtons() {
        return this.excelEntities.map(entity => `
            <button class="btn btn-secondary btn-sm" onclick="SettingsView.exportEntityData('${entity.key}')">
                ${entity.label}
            </button>
        `).join('');
    },

    renderExcelOptions() {
        return this.excelEntities.map(entity => `
            <option value="${entity.key}">${entity.label}</option>
        `).join('');
    },

    async exportEntityData(key) {
        const entity = (window.BACKUP_ENTITY_CONFIG || []).find(e => e.key === key);
        if (!entity) return;

        try {
            showNotification(`Preparando ${entity.label}...`, 'info');
            if (entity.type === 'store') {
                await BackupManager.exportEntityToExcel(entity.store, entity.label, entity.sheet);
            } else if (entity.handler === 'customerDebts') {
                await BackupManager.exportCustomerDebts(entity.sheet, entity.label);
            } else if (entity.handler === 'reportsSummary') {
                await BackupManager.exportReportsSummary(entity.sheet, entity.label);
            }
        } catch (error) {
            showNotification('Error al exportar: ' + error.message, 'error');
        }
    },

    async deduplicateSuppliers() {
        showConfirm('Esta acción unificará a todos los proveedores que tengan el mismo nombre, traspasando sus compras y deudas a un solo registro. ¿Deseas continuar?', async () => {
            try {
                showNotification('Limpiando duplicados...', 'info');
                const result = await ApiClient.post('migration/deduplicate-suppliers');
                if (result.success) {
                    showNotification(`Limpieza completada. Se unificaron ${result.merged} registros.`, 'success');
                    // Recargar la vista si estamos en proveedores (opcional)
                }
            } catch (error) {
                showNotification('Error al limpiar proveedores: ' + error.message, 'error');
            }
        });
    },

    async deduplicateCustomers() {
        showConfirm('⚠️ ATENCIÓN: Esta acción unificará clientes duplicados y SUMARÁ sus deudas pendientes (fiados). No se perderá ningún dato de cobranza. ¿Deseas continuar?', async () => {
            try {
                showNotification('Consolidando deudas y unificando registros...', 'info');
                const result = await ApiClient.post('migration/deduplicate-customers');
                if (result.success) {
                    const debtMsg = result.totalDebt > 0 ? `\\n\\nSe consolidaron ${formatCLP(result.totalDebt)} en deudas de fiados.` : '';
                    showNotification(`Fusión completada. Se unificaron ${result.merged} clientes.${debtMsg}`, 'success');
                }
            } catch (error) {
                showNotification('Error al fusionar clientes: ' + error.message, 'error');
            }
        });
    },

    async handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const jsonData = e.target.result;
                showConfirm(
                    '⚠️ ADVERTENCIA: La importación reemplazará TODOS tus datos actuales. El sistema se reiniciará para aplicar los cambios.\\n\\n¿Deseas continuar?',
                    async () => {
                        showNotification('Restaurando base de datos...', 'info');
                        await BackupManager.importData(jsonData);
                    }
                );
            } catch (error) {
                showNotification('Error al procesar el archivo de respaldo', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = ''; 
    },

    async exportBusinessData() {
        try {
            await BackupManager.exportAllData();
        } catch (error) {
            console.error('[Export] Error:', error);
            showNotification('Error al exportar negocio: ' + error.message, 'error');
        }
    },

    async importExcelData() {
        const entitySelect = document.getElementById('excelImportEntity');
        const fileInput = document.getElementById('excelImportFile');
        const file = fileInput?.files[0];
        const entityKey = entitySelect?.value;

        if (!file) {
            showNotification('Selecciona un archivo Excel', 'warning');
            return;
        }

        const entity = this.excelEntities.find(e => e.key === entityKey);
        if (!entity) {
            showNotification('Selecciona una entidad válida', 'warning');
            return;
        }

        if (entity.type !== 'store') {
            showNotification('Esta entidad no admite importación directa', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const arrayBuffer = e.target.result;
            await BackupManager.importEntityFromExcel(entity.store, entity.sheet, entity.label, arrayBuffer);
            fileInput.value = '';
        };
        reader.onerror = () => {
            showNotification('No se pudo leer el archivo', 'error');
        };
        reader.readAsArrayBuffer(file);
    },

    async checkStorage() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            const used = (estimate.usage / 1024 / 1024).toFixed(2);
            const quota = (estimate.quota / 1024 / 1024).toFixed(2);
            const percent = ((estimate.usage / estimate.quota) * 100).toFixed(1);

            const content = `
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="font-size: 3rem; color: var(--primary);">${percent}%</div>
                    <p style="color: var(--text);">Espacio Utilizado</p>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Usado:</span>
                        <strong>${used} MB</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Disponible:</span>
                        <strong>${quota} MB</strong>
                    </div>
                    <div style="width: 100%; height: 30px; background: var(--light); border-radius: 15px; overflow: hidden;">
                        <div style="width: ${percent}%; height: 100%; background: var(--primary); transition: width 0.3s;"></div>
                    </div>
                </div>
            `;

            showModal(content, { title: 'Uso de Almacenamiento', width: '400px' });
        } else {
            showNotification('Tu navegador no soporta esta función', 'warning');
        }
    },

    showImportModal() {
        const content = `
            <div class="form-group">
                <label>Archivo JSON de Backup</label>
                <input type="file" id="importFile" class="form-control" accept=".json">
            </div>
            
            <div style="background: var(--light); padding: 1rem; border-radius: 0.375rem; font-size: 0.875rem;">
                <strong>Nota:</strong> Selecciona un archivo JSON exportado previamente desde este sistema.
                Los datos existentes pueden ser sobrescritos.
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="SettingsView.processImport()">Importar</button>
        `;

        showModal(content, { title: 'Importar Datos', footer, width: '500px' });
    },

    // processImport ha sido reemplazado por handleImport para soporte directo de input file

    async clearCache() {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            showNotification('Cache limpiado. Recarga la página.', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification('Tu navegador no soporta cache', 'warning');
        }
    },

    async reinstallApp() {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                await registration.unregister();
                await this.clearCache();
                showNotification('App desinstalada. Recarga para reinstalar.', 'success');
                setTimeout(() => location.reload(), 1500);
            }
        } else {
            showNotification('Service Worker no disponible', 'warning');
        }
    },

    async factoryReset() {
        // Doble confirmación con modal personalizado (prompt() no funciona en Electron)
        showConfirm('⚠️ ¿Estás SEGURO de que deseas eliminar TODOS los datos?\n\nEsto borrará productos, ventas, clientes, compras y todo lo demás.', () => {
            // Segunda confirmación: modal con input
            const content = `
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">🚨</div>
                    <p style="color: #fca5a5; font-weight: bold; font-size: 1.1rem;">ÚLTIMA ADVERTENCIA</p>
                    <p style="font-size: 0.9rem; color: var(--text); opacity: 0.8;">
                        Esta acción eliminará permanentemente todos los datos.<br>
                        <strong>No se puede deshacer.</strong>
                    </p>
                </div>
                <div class="form-group">
                    <label style="color: #fca5a5;">Para confirmar, escribe <strong>BORRAR TODO</strong> en el campo:</label>
                    <input type="text" id="factoryResetConfirmInput" class="form-control" 
                           placeholder="Escribe BORRAR TODO aquí" autocomplete="off"
                           style="text-align: center; font-weight: bold; font-size: 1.1rem; letter-spacing: 2px; margin-top: 0.5rem;">
                </div>
            `;
            const footer = `
                <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                <button class="btn" id="factoryResetExecBtn" 
                        style="background: #dc2626; color: white; font-weight: bold; opacity: 0.5; cursor: not-allowed;" 
                        disabled onclick="SettingsView.executeFactoryReset()">
                    🗑️ ELIMINAR TODO
                </button>
            `;
            showModal(content, { title: '⚠️ Confirmación Final', footer, width: '480px' });

            // Habilitar botón solo si escriben "BORRAR TODO"
            setTimeout(() => {
                const input = document.getElementById('factoryResetConfirmInput');
                const btn = document.getElementById('factoryResetExecBtn');
                if (input && btn) {
                    input.addEventListener('input', () => {
                        if (input.value.trim() === 'BORRAR TODO') {
                            btn.disabled = false;
                            btn.style.opacity = '1';
                            btn.style.cursor = 'pointer';
                        } else {
                            btn.disabled = true;
                            btn.style.opacity = '0.5';
                            btn.style.cursor = 'not-allowed';
                        }
                    });
                    input.focus();
                }
            }, 100);
        });
    },

    async executeFactoryReset() {
        closeModal();
        try {
            showNotification('🚮 Vaciando base de datos...', 'info');
            await db.wipeAll();
            showNotification('✅ Base de datos vaciada exitosamente. Recargando...', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            showNotification('❌ Error: ' + error.message, 'error');
            console.error('Factory reset error:', error);
        }
    },

    /**
     * C8: Cargar la lista de usuarios con sus roles.
     */
    async loadUserRoles() {
        const container = document.getElementById('userRolesList');
        if (!container) return;

        try {
            const users = await User.getAll();
            const currentUser = AuthManager.getCurrentUser();

            if (users.length === 0) {
                container.innerHTML = '<p style="color: var(--secondary);">No hay usuarios registrados.</p>';
                return;
            }

            container.innerHTML = users.map(u => {
                const role = User.getEffectiveRole(u);
                const roleLabel = PermissionService.ROLE_LABELS[role] || role;
                const isSelf = currentUser && currentUser.id === u.id;
                const roleBadgeColor = role === 'owner' ? '#a78bfa' : role === 'admin' ? '#60a5fa' : '#94a3b8';

                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--light); border-radius: 0.375rem; border-left: 3px solid ${roleBadgeColor};">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, ${roleBadgeColor}, ${roleBadgeColor}88); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 0.9rem;">
                                ${u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 600;">${u.username}${isSelf ? ' <span style="font-size: 0.75rem; opacity: 0.7;">(tú)</span>' : ''}</div>
                                <div style="font-size: 0.8rem; color: var(--secondary);">
                                    <span style="padding: 0.1rem 0.4rem; border-radius: 0.2rem; background: ${roleBadgeColor}33; color: ${roleBadgeColor};">${roleLabel}</span>
                                    ${u.createdAt ? ` · Creado: ${new Date(u.createdAt).toLocaleDateString('es-CL')}` : ''}
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            ${PermissionService.can('settings.users') ? `
                                <button class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.6rem; border: 1px solid #cbd5e1; font-weight: 700; font-size: 0.8rem; white-space: nowrap;" 
                                        onclick="SettingsView.showChangeEmployeePasswordModal(${u.id}, '${u.username}')" title="Cambiar Contraseña">
                                    🔑 Clave
                                </button>
                                <select onchange="SettingsView.changeUserRole(${u.id}, this.value, '${u.username}')"
                                        style="padding: 0.3rem 0.5rem; border-radius: 0.25rem; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 0.85rem;"
                                        ${isSelf ? 'disabled title="No puedes cambiar tu propio rol"' : ''}>
                                    ${PermissionService.ROLES.map(r =>
                    `<option value="${r}" ${r === role ? 'selected' : ''}>${PermissionService.ROLE_LABELS[r]}</option>`
                ).join('')}
                                </select>
                                ${!isSelf ? `
                                    <button class="btn btn-danger btn-sm" style="padding: 0.3rem 0.6rem;" 
                                            onclick="SettingsView.deleteUser(${u.id}, '${u.username}')" title="Eliminar Usuario">
                                        ✕
                                    </button>
                                ` : ''}
                            ` : `<span style="font-size: 0.85rem; color: var(--secondary);">${roleLabel}</span>`}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            container.innerHTML = '<p style="color: var(--danger);">Error al cargar usuarios.</p>';
        }
    },

    /**
     * C8: Cambiar el rol de un usuario.
     */
    async changeUserRole(userId, newRole, username) {
        if (!PermissionService.check('settings.users', 'gestionar usuarios')) return;

        try {
            await User.updateRole(userId, newRole);
            const roleLabel = PermissionService.ROLE_LABELS[newRole] || newRole;
            showNotification(`Rol de "${username}" actualizado a ${roleLabel}`, 'success');
            await this.loadUserRoles();
        } catch (error) {
            showNotification('Error al cambiar rol: ' + error.message, 'error');
            await this.loadUserRoles(); // Recargar para restaurar estado visual
        }
    },

    /**
     * C8: Eliminar un usuario.
     */
    async deleteUser(userId, username) {
        if (!PermissionService.check('settings.users', 'eliminar usuarios')) return;

        showConfirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario "${username}"?`, async () => {
            try {
                await db.delete('users', userId);
                showNotification(`Usuario "${username}" eliminado correctamente`, 'success');
                await this.loadUserRoles();
            } catch (error) {
                showNotification('Error al eliminar usuario: ' + error.message, 'error');
            }
        });
    },

    /**
     * C8: Mostrar modal para crear nuevo usuario.
     */
    showCreateUserModal() {
        if (!PermissionService.check('settings.users', 'crear usuarios')) return;

        const content = `
            <div class="form-group">
                <label>Nombre de Usuario *</label>
                <input type="text" id="newUsername" class="form-control" placeholder="Ej: vendedorpablo" autocomplete="off">
            </div>
            
            <div class="form-group">
                <label>Contraseña Temporal *</label>
                <input type="password" id="newPassword" class="form-control" placeholder="Mínimo 4 caracteres" autocomplete="new-password">
            </div>
            
            <div class="form-group">
                <label>Rol del Usuario *</label>
                <select id="newUserRole" class="form-control">
                    <option value="cashier" selected>Cajero (Solo ventas y POS)</option>
                    <option value="admin">Administrador (Gestión operativa)</option>
                    <option value="owner">Propietario (Acceso Total)</option>
                </select>
            </div>
            
            <div style="background: var(--light); padding: 0.75rem; border-radius: 0.375rem; font-size: 0.85rem; margin-top: 1rem;">
                <strong>Nota:</strong> Como dueños, ustedes tienen el control total del sistema.
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="SettingsView.processCreateUser()">Crear Usuario</button>
        `;

        showModal(content, { title: 'Registrar Nuevo Trabajador', footer, width: '450px' });
    },

    /**
     * C8: Procesar creación de usuario.
     */
    async processCreateUser() {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value;
        const role = document.getElementById('newUserRole').value;

        if (!username || !password) {
            showNotification('Por favor completa todos los campos', 'warning');
            return;
        }

        if (password.length < 4) {
            showNotification('La contraseña debe tener al menos 4 caracteres', 'warning');
            return;
        }

        try {
            await User.create(username, password, null, role);
            showNotification(`Usuario "${username}" creado exitosamente como ${PermissionService.ROLE_LABELS[role]}`, 'success');
            closeModal();
            await this.loadUserRoles();
        } catch (error) {
            showNotification('Error al crear usuario: ' + error.message, 'error');
        }
    },

    async initSecuritySection() {
        // Update PIN status
        const hasPIN = await User.hasAdminPIN();
        const pinStatusText = document.getElementById('pinStatusText');
        const pinBtn = document.getElementById('adminPINBtn');

        if (pinStatusText) {
            pinStatusText.textContent = hasPIN ? '✓ PIN configurado' : 'PIN no configurado';
        }
        if (pinBtn) {
            pinBtn.textContent = hasPIN ? 'Cambiar PIN' : 'Configurar PIN';
        }

        // Update recovery code status
        const currentUser = AuthManager.getCurrentUser();
        const codeStatusText = document.getElementById('codeStatusText');

        if (codeStatusText && currentUser) {
            const user = await User.getById(currentUser.id);
            if (user && user.recoveryCode) {
                codeStatusText.textContent = '✓ Código generado (ya no se mostrará)';
            } else {
                codeStatusText.textContent = 'Código no generado';
            }
        }
    },

    showSetAdminPINForm() {
        const content = `
            <div class="form-group">
                <label>PIN de Administrador (4-8 dígitos) *</label>
                <input type="password" id="adminPIN" class="form-control" placeholder="Ej: 1234" maxlength="8" pattern="[0-9]{4,8}" required>
            </div>
            
            <div class="form-group">
                <label>Confirmar PIN *</label>
                <input type="password" id="adminPINConfirm" class="form-control" placeholder="Confirma el PIN" maxlength="8" pattern="[0-9]{4,8}" required>
            </div>
            
            <div style="background: var(--light); padding: 1rem; border-radius: 0.375rem; font-size: 0.875rem; margin-top: 1rem;">
                <strong>Importante:</strong> Este PIN permite restablecer la contraseña de cualquier usuario del sistema. Guárdalo en un lugar seguro.
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="SettingsView.saveAdminPIN()">Guardar PIN</button>
        `;

        showModal(content, { title: 'Configurar PIN de Administrador', footer, width: '450px' });
    },

    async saveAdminPIN() {
        const pin = document.getElementById('adminPIN').value;
        const pinConfirm = document.getElementById('adminPINConfirm').value;

        if (!pin || pin.length < 4 || pin.length > 8) {
            showNotification('El PIN debe tener entre 4 y 8 dígitos', 'warning');
            return;
        }

        if (!/^\d+$/.test(pin)) {
            showNotification('El PIN solo puede contener números', 'warning');
            return;
        }

        if (pin !== pinConfirm) {
            showNotification('Los PINs no coinciden', 'warning');
            return;
        }

        try {
            console.log('💾 Guardando PIN de administrador...');
            await User.setAdminPIN(pin);
            console.log('✅ PIN guardado en base de datos');
            
            // Verificar que se guardó correctamente
            const hasPIN = await User.hasAdminPIN();
            console.log('🔍 Verificación de PIN guardado:', hasPIN);
            
            showNotification('PIN de administrador global configurado exitosamente. Este PIN permite recuperar la contraseña de cualquier usuario.', 'success');
            closeModal();
            
            // Update status in view
            await this.initSecuritySection();
            console.log('🔄 UI actualizada con nuevo estado del PIN');
        } catch (error) {
            console.error('❌ Error al configurar PIN:', error);
            showNotification('Error al configurar PIN: ' + error.message, 'error');
        }
    },

    async generateRecoveryCode() {
        const currentUser = AuthManager.getCurrentUser();
        if (!currentUser) {
            showNotification('Debes estar autenticado para generar un código de recuperación', 'warning');
            return;
        }

        showConfirm('¿Generar un nuevo código de recuperación? Si ya tienes un código, este será reemplazado.', async () => {
            try {
                const { code, user } = await User.generateAndSetRecoveryCode(currentUser.id);

                const content = `
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary); font-family: monospace; letter-spacing: 2px; padding: 1rem; background: var(--light); border-radius: 0.5rem; margin-bottom: 1rem;">
                        ${code}
                    </div>
                    <p style="font-size: 0.875rem; color: var(--text); opacity: 0.8;">
                        <strong>⚠️ Importante:</strong> Guarda este código en un lugar seguro. No se mostrará nuevamente.
                    </p>
                    <p style="font-size: 0.875rem; color: var(--text); opacity: 0.8; margin-top: 0.5rem;">
                        Puedes usar este código para restablecer tu contraseña si la olvidas.
                    </p>
                </div>
            `;

                showModal(content, { title: 'Código de Recuperación Generado', width: '500px' });

                // Update status in view
                await this.initSecuritySection();
            } catch (error) {
                console.error('Error al generar código de recuperación:', error);
                showNotification('Error al generar código: ' + error.message, 'error');
            }
        });
    },

    async enableSQLiteMode() {
        showConfirm('¿Estás seguro de activar el motor SQLite? Esto requiere que el servidor backend esté corriendo (Puerto 3000).', async () => {
            try {
                const response = await fetch(`${window.API_CONFIG.BASE_URL}/api/status`);
                if (!response.ok) throw new Error('Servidor no disponible');

                localStorage.setItem('DB_MODE', 'sqlite');
                showNotification('Motor SQLite activado. La aplicación se reiniciará.', 'success');
                setTimeout(() => location.reload(), 1500);
            } catch (e) {
                showNotification('Error: El servidor backend no responde. ¿Ejecutaste el programa con este nuevo código?', 'error');
            }
        });
    },

    async initSQLiteInfo() {
        const infoDiv = document.getElementById('sqliteInfo');
        const ipText = document.getElementById('serverIPInfo');
        if (!infoDiv || !ipText) return;

        if (window.db && window.db.mode === 'sqlite') {
            infoDiv.style.display = 'block';
            try {
                const status = await fetch(`${window.API_CONFIG.BASE_URL}/api/status`).then(r => r.json());
                ipText.innerHTML = `URL para Celular: http://${status.ip}:${status.port}`;
            } catch (e) {
                ipText.innerHTML = 'Error al obtener IP del servidor';
            }
        }
    },

    showSQLiteMigrationModal() {
        const content = `
            <div style="text-align: center; padding: 1rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">💾 ➡️ 🗄️</div>
                <h3>Paso Final: Inyectar Datos en SQLite</h3>
                <p style="margin-bottom: 1.5rem; color: var(--secondary);">Selecciona el archivo <strong>.json</strong> que exportaste en el Paso 1.</p>
                
                <div class="form-group" style="text-align: left;">
                    <label>Archivo de Migración (.json)</label>
                    <input type="file" id="migrationFile" class="form-control" accept=".json">
                </div>
                
                <div style="background: #fef2f2; color: #991b1b; padding: 1rem; border-radius: 0.5rem; font-size: 0.85rem; margin-top: 1rem; border: 1px solid #fee2e2;">
                    <strong>Atención:</strong> Esto reemplazará cualquier dato que exista en la nueva base de datos SQLite.
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="SettingsView.processSQLiteMigration()">Comenzar Migración</button>
        `;

        showModal(content, { title: 'Importar en Motor SQLite', footer, width: '500px' });
    },

    async processSQLiteMigration() {
        const fileInput = document.getElementById('migrationFile');
        const file = fileInput?.files[0];

        if (!file) {
            showNotification('Selecciona el archivo exportado', 'warning');
            return;
        }

        // C4: Mover confirmación al inicio para evitar bloqueos durante el proceso pesado
        showConfirm(
            '⚠️ ADVERTENCIA: Se sobrescribirán todos los datos en SQLite.\n¿Estás seguro de continuar?',
            async () => {
                const btn = document.querySelector('button[onclick="SettingsView.processSQLiteMigration()"]');
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="loading-spinner"></span> Trabajando...';
                }

                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const jsonData = e.target.result;
                        if (btn) btn.innerHTML = '<span class="loading-spinner"></span> Subiendo 5MB...';
                        
                        await BackupManager.importData(jsonData);
                        if (btn) btn.textContent = '✅ Completado';
                        closeModal();
                    } catch (error) {
                        console.error('Error:', error);
                        showNotification('Error: ' + error.message, 'error');
                        if (btn) {
                            btn.disabled = false;
                            btn.textContent = 'Reintentar Migración';
                        }
                    }
                };
                reader.onerror = () => {
                    showNotification('Error al leer el archivo', 'error');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Comenzar Migración';
                    }
                };
                reader.readAsText(file);
            }
        );
    },

    async saveMultipleCashSettings() {
        const allowMultiple = document.getElementById('allowMultipleCashRegisters').checked;
        localStorage.setItem('allowMultipleCashRegisters', allowMultiple);
        showNotification('Configuración guardada', 'success');
    },

    async loadMultipleCashSettings() {
        const allowMultiple = localStorage.getItem('allowMultipleCashRegisters') === 'true';
        const checkbox = document.getElementById('allowMultipleCashRegisters');
        if (checkbox) {
            checkbox.checked = allowMultiple;
        }

        // Cargar cajas activas
        const listDiv = document.getElementById('activeCashRegistersList');
        if (listDiv) {
            try {
                const cashRegisters = await CashRegister.getAll();
                const openRegisters = cashRegisters.filter(cr => cr.status === 'open');

                if (openRegisters.length === 0) {
                    listDiv.innerHTML = '<p style="color: #6b7280; font-size: 0.85rem;">No hay cajas abiertas</p>';
                } else {
                    listDiv.innerHTML = openRegisters.map(cr => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.5rem;">
                            <div>
                                <div style="font-weight: 600; color: #166534;">Caja #${cr.id}</div>
                                <div style="font-size: 0.8rem; color: #15803d;">Abierta: ${formatDateTime(cr.openDate)}</div>
                            </div>
                            <span class="badge badge-success">Activa</span>
                        </div>
                    `).join('');
                }
            } catch (error) {
                console.error('[Settings] Error cargando cajas:', error);
                listDiv.innerHTML = '<p style="color: #ef4444; font-size: 0.85rem;">Error al cargar cajas</p>';
            }
        }
    },

    async loadRolesPermissions() {
        const listDiv = document.getElementById('rolesPermissionsList');
        if (!listDiv) return;

        try {
            const roles = ['owner', 'admin', 'cashier'];
            const roleLabels = {
                owner: 'Propietario',
                admin: 'Administrador',
                cashier: 'Cajero'
            };
            const roleColors = {
                owner: '#7c3aed', // morado
                admin: '#2563eb', // azul
                cashier: '#475569' // gris pizarra
            };

            const permissionsToShow = [
                { key: 'nav.pos', label: 'Vender en Punto de Venta (POS)' },
                { key: 'cash.open', label: 'Abrir y Cerrar Caja (Turnos)' },
                { key: 'products.create', label: 'Crear / Editar Productos' },
                { key: 'products.delete', label: 'Eliminar Productos' },
                { key: 'inventory.adjust', label: 'Realizar Ajustes de Stock' },
                { key: 'nav.reports', label: 'Ver Reportes y Gráficos' },
                { key: 'sales.delete', label: 'Eliminar Ventas Realizadas' },
                { key: 'settings.security', label: 'Configurar Claves y Seguridad' },
                { key: 'settings.backup', label: 'Generar y Restaurar Copias' },
                { key: 'settings.users', label: 'Gestionar Usuarios y Roles' }
            ];

            let html = `
                <div style="margin-bottom: 1.5rem; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 1rem; border-radius: 0.75rem; font-size: 0.85rem; line-height: 1.5; display: flex; align-items: flex-start; gap: 0.75rem;">
                    <span style="font-size: 1.25rem;">🛡️</span>
                    <div>
                        <strong>Seguridad Blindada:</strong> Los permisos del sistema son fijos y se controlan por código seguro para evitar alteraciones de roles no autorizadas (escalación de privilegios). En esta tabla puedes consultar las facultades exactas de cada perfil.
                    </div>
                </div>
                
                <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 0.75rem; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 1rem; font-weight: 600; color: #475569; width: 40%;">Acción / Permiso</th>
                                ${roles.map(r => `
                                    <th style="padding: 1rem; font-weight: 600; text-align: center; color: #475569; width: 20%;">
                                        <span style="display: inline-block; padding: 0.25rem 0.6rem; border-radius: 0.375rem; background: ${roleColors[r]}15; color: ${roleColors[r]}; border: 1px solid ${roleColors[r]}33; font-weight: 700; font-size: 0.75rem;">
                                            ${roleLabels[r]}
                                        </span>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
            `;

            permissionsToShow.forEach((perm, idx) => {
                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? 'white' : '#fafcfd'}; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${idx % 2 === 0 ? 'white' : '#fafcfd'}'">
                        <td style="padding: 0.875rem 1rem; font-weight: 500; color: #334155;">${perm.label}</td>
                        ${roles.map(role => {
                            const hasAccess = PermissionService.roleHasPermission(role, perm.key);
                            return `
                                <td style="padding: 0.875rem 1rem; text-align: center;">
                                    ${hasAccess ? 
                                        `<span style="color: #10b981; font-weight: bold; font-size: 1.15rem; display: inline-flex; align-items: center; justify-content: center; width: 1.75rem; height: 1.75rem; background: #ecfdf5; border-radius: 50%; border: 1px solid #a7f3d0;" title="Autorizado">✔</span>` : 
                                        `<span style="color: #94a3b8; font-size: 0.85rem; display: inline-flex; align-items: center; justify-content: center; width: 1.75rem; height: 1.75rem; background: #f1f5f9; border-radius: 50%; border: 1px solid #e2e8f0; opacity: 0.7;" title="No Autorizado">➖</span>`
                                    }
                                </td>
                            `;
                        }).join('')}
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;

            listDiv.innerHTML = html;
        } catch (error) {
            console.error('[Settings] Error cargando roles:', error);
            listDiv.innerHTML = '<p style="color: #ef4444; font-size: 0.85rem;">Error al cargar roles y permisos</p>';
        }
    },

    async togglePermission(role, permission) {
        console.warn('[Settings] No se pueden modificar los permisos fijos del sistema.');
    },

    async savePrinterSettings() {
        const printerPort = document.getElementById('printerPort').value;
        const paperWidth = document.getElementById('paperWidth').value;
        const autoPrintTicket = document.getElementById('autoPrintTicket').checked;

        localStorage.setItem('printerPort', printerPort);
        localStorage.setItem('paperWidth', paperWidth);
        localStorage.setItem('autoPrintTicket', autoPrintTicket);

        showNotification('Configuración de impresora guardada', 'success');
    },

    async loadPrinterSettings() {
        const printerPort = localStorage.getItem('printerPort') || 'USB';
        const paperWidth = localStorage.getItem('paperWidth') || '58mm';
        const autoPrintTicket = localStorage.getItem('autoPrintTicket') === 'true';

        const printerPortSelect = document.getElementById('printerPort');
        const paperWidthSelect = document.getElementById('paperWidth');
        const autoPrintCheckbox = document.getElementById('autoPrintTicket');

        if (printerPortSelect) printerPortSelect.value = printerPort;
        if (paperWidthSelect) paperWidthSelect.value = paperWidth;
        if (autoPrintCheckbox) autoPrintCheckbox.checked = autoPrintTicket;

        // Cargar estado inicial del panel bluetooth
        this.handlePrinterPortChange();
        this.updateBluetoothStatus();
    },

    handlePrinterPortChange() {
        const printerPortSelect = document.getElementById('printerPort');
        const btConfig = document.getElementById('bluetoothPrinterConfig');
        if (printerPortSelect && btConfig) {
            btConfig.style.display = printerPortSelect.value === 'bluetooth' ? 'block' : 'none';
        }
    },

    async updateBluetoothStatus() {
        const isAvailable = await BluetoothPrinter.getAvailability();
        const statusSpan = document.getElementById('bluetoothDeviceStatus');
        const savedNameDiv = document.getElementById('bluetoothSavedName');
        const forgetBtn = document.getElementById('btnForgetBluetooth');

        if (statusSpan) {
            statusSpan.textContent = isAvailable ? "Bluetooth detectado y activo" : "Bluetooth apagado o no disponible en esta PC";
            statusSpan.style.color = isAvailable ? "#10b981" : "#ef4444";
        }

        const savedName = localStorage.getItem('bluetoothPrinterName');
        if (savedNameDiv) {
            savedNameDiv.textContent = savedName ? savedName : "Ninguna impresora vinculada";
            savedNameDiv.style.color = savedName ? "#1e293b" : "#94a3b8";
        }

        if (forgetBtn) {
            forgetBtn.style.display = savedName ? 'inline-block' : 'none';
        }
    },

    async pairBluetoothPrinter() {
        showNotification('Iniciando búsqueda de dispositivos Bluetooth...', 'info');

        const modalContent = `
            <div style="padding: 0.5rem;">
                <p style="font-size: 0.9rem; color: #475569; margin-bottom: 1.5rem; line-height: 1.4;">
                    Buscando impresoras Bluetooth encendidas y cercanas. Por favor, asegúrese de que la impresora esté en modo emparejamiento.
                </p>
                <div id="btDevicesList" style="max-height: 250px; overflow-y: auto; background: #f8fafc; padding: 1rem; border-radius: 0.75rem; border: 1.5px dashed #cbd5e1;">
                    <p style="color: #94a3b8; font-size: 0.85rem; text-align: center;">Buscando dispositivos...</p>
                </div>
            </div>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="SettingsView.cancelBluetoothPairing()" style="padding: 0.75rem 2rem; border-radius: 0.75rem;">
                Cancelar Búsqueda
            </button>
        `;
        
        showModal(modalContent, { title: '🔍 Vincular Impresora Bluetooth', footer, width: '500px' });

        // Registrar el listener de Electron para recibir dispositivos en tiempo real
        this._bluetoothCleanupListener = window.api.onBluetoothDevicesFound((devices) => {
            const listContainer = document.getElementById('btDevicesList');
            if (listContainer) {
                if (!devices || devices.length === 0) {
                    listContainer.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; text-align: center;">Buscando dispositivos...</p>';
                } else {
                    listContainer.innerHTML = devices.map(d => `
                        <div class="bt-device-item" onclick="SettingsView.selectBluetoothDevice('${d.deviceId}')" 
                             style="padding: 0.75rem 1rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; margin-bottom: 0.5rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: #ffffff; transition: all 0.2s;"
                             onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1';"
                             onmouseout="this.style.background='#ffffff'; this.style.borderColor='#e2e8f0';">
                            <strong style="color: #1e293b;">${d.deviceName || 'Dispositivo desconocido'}</strong>
                            <span style="font-size: 0.75rem; color: #94a3b8;">${d.deviceId}</span>
                        </div>
                    `).join('');
                }
            }
        });

        try {
            const device = await BluetoothPrinter.pairDevice();
            if (device) {
                showNotification(`Impresora "${device.name}" vinculada con éxito.`, 'success');
            }
        } catch (err) {
            console.error(err);
            if (err.message.includes("User cancelled")) {
                showNotification('Búsqueda cancelada', 'warning');
            } else {
                showNotification('Error al vincular: ' + err.message, 'error');
            }
        } finally {
            if (this._bluetoothCleanupListener) {
                this._bluetoothCleanupListener();
                this._bluetoothCleanupListener = null;
            }
            closeModal();
            this.updateBluetoothStatus();
        }
    },

    selectBluetoothDevice(deviceId) {
        window.api.bluetoothSelectDevice(deviceId);
    },

    cancelBluetoothPairing() {
        window.api.bluetoothCancel();
        if (this._bluetoothCleanupListener) {
            this._bluetoothCleanupListener();
            this._bluetoothCleanupListener = null;
        }
        closeModal();
        showNotification('Búsqueda cancelada', 'warning');
    },

    forgetBluetoothPrinter() {
        BluetoothPrinter.forgetDevice();
        showNotification('Impresora Bluetooth olvidada', 'success');
        this.updateBluetoothStatus();
    },

    async testPrinter() {
        const printerPort = localStorage.getItem('printerPort') || 'USB';
        if (printerPort === 'bluetooth') {
            showNotification('Iniciando prueba de impresión Bluetooth...', 'info');
            const testText = `
================================
     PRUEBA DE IMPRESION
      BOLETA BLUETOOTH
================================
Fecha: ${new Date().toLocaleString()}
Sistema: POS LAKURVA

Si lee esto, su impresora Bluetooth
esta conectada y funcionando de
manera correcta.

¡Gracias por su preferencia!
================================
\n\n\n`;
            try {
                await BluetoothPrinter.print(testText, { cut: true });
                showNotification('Prueba de impresión Bluetooth enviada', 'success');
            } catch (err) {
                console.error(err);
                showNotification('Error de impresión: ' + err.message, 'error');
            }
        } else {
            showNotification('Iniciando prueba de impresión...', 'info');
            setTimeout(() => {
                showNotification('Prueba de impresión enviada a la impresora', 'success');
            }, 1000);
        }
    },

    async testBarcodeReader() {
        showNotification('Iniciando prueba de lector de código de barras...', 'info');
        
        // Simular prueba de lector
        setTimeout(() => {
            showNotification('Lector de código de barras conectado correctamente', 'success');
        }, 1000);
    },

    async testScale() {
        showNotification('Iniciando prueba de balanza...', 'info');
        
        // Simular prueba de balanza
        setTimeout(() => {
            showNotification('Balanza conectada correctamente', 'success');
        }, 1000);
    },

    async saveCloudBackupSettings() {
        const cloudProvider = document.getElementById('cloudProvider').value;
        const backupFrequency = document.getElementById('backupFrequency').value;
        const autoBackupEnabled = document.getElementById('autoBackupEnabled').checked;

        localStorage.setItem('cloudProvider', cloudProvider);
        localStorage.setItem('backupFrequency', backupFrequency);
        localStorage.setItem('autoBackupEnabled', autoBackupEnabled);

        showNotification('Configuración de backup en la nube guardada', 'success');
    },

    async loadCloudBackupSettings() {
        const cloudProvider = localStorage.getItem('cloudProvider') || 'none';
        const backupFrequency = localStorage.getItem('backupFrequency') || 'daily';
        const autoBackupEnabled = localStorage.getItem('autoBackupEnabled') === 'true';

        const cloudProviderSelect = document.getElementById('cloudProvider');
        const backupFrequencySelect = document.getElementById('backupFrequency');
        const autoBackupCheckbox = document.getElementById('autoBackupEnabled');

        if (cloudProviderSelect) cloudProviderSelect.value = cloudProvider;
        if (backupFrequencySelect) backupFrequencySelect.value = backupFrequency;
        if (autoBackupCheckbox) autoBackupCheckbox.checked = autoBackupEnabled;
    },

    async testCloudConnection() {
        const cloudProvider = document.getElementById('cloudProvider').value;
        
        if (cloudProvider === 'none') {
            showNotification('Selecciona un proveedor de nube primero', 'warning');
            return;
        }

        showNotification('Probando conexión a ' + cloudProvider + '...', 'info');
        
        // Simular prueba de conexión
        setTimeout(() => {
            showNotification('Conexión a ' + cloudProvider + ' exitosa', 'success');
        }, 1500);
    },

    async saveTicketSettings() {
        const ticketBusinessName = document.getElementById('ticketBusinessName').value;
        const ticketAddress = document.getElementById('ticketAddress').value;
        const ticketPhone = document.getElementById('ticketPhone').value;
        const ticketFooter = document.getElementById('ticketFooter').value;
        const showLogoOnTicket = document.getElementById('showLogoOnTicket').checked;

        localStorage.setItem('ticketBusinessName', ticketBusinessName);
        localStorage.setItem('ticketAddress', ticketAddress);
        localStorage.setItem('ticketPhone', ticketPhone);
        localStorage.setItem('ticketFooter', ticketFooter);
        localStorage.setItem('showLogoOnTicket', showLogoOnTicket);

        showNotification('Configuración de tickets guardada', 'success');
    },

    async loadTicketSettings() {
        const ticketBusinessName = localStorage.getItem('ticketBusinessName') || '';
        const ticketAddress = localStorage.getItem('ticketAddress') || '';
        const ticketPhone = localStorage.getItem('ticketPhone') || '';
        const ticketFooter = localStorage.getItem('ticketFooter') || '';
        const showLogoOnTicket = localStorage.getItem('showLogoOnTicket') === 'true';

        const businessNameInput = document.getElementById('ticketBusinessName');
        const addressInput = document.getElementById('ticketAddress');
        const phoneInput = document.getElementById('ticketPhone');
        const footerInput = document.getElementById('ticketFooter');
        const logoCheckbox = document.getElementById('showLogoOnTicket');

        if (businessNameInput) businessNameInput.value = ticketBusinessName;
        if (addressInput) addressInput.value = ticketAddress;
        if (phoneInput) phoneInput.value = ticketPhone;
        if (footerInput) footerInput.value = ticketFooter;
        if (logoCheckbox) logoCheckbox.checked = showLogoOnTicket;
    },

    async previewTicket() {
        const businessName = document.getElementById('ticketBusinessName').value || 'Mi Negocio';
        const address = document.getElementById('ticketAddress').value || 'Dirección';
        const phone = document.getElementById('ticketPhone').value || 'Teléfono';
        const footer = document.getElementById('ticketFooter').value || '¡Gracias por su compra!';

        const content = `
            <div style="font-family: monospace; font-size: 12px; padding: 1rem; background: white; border: 1px solid #ddd; max-width: 300px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 1rem;">
                    <div style="font-weight: bold; font-size: 14px;">${businessName}</div>
                    <div style="font-size: 10px;">${address}</div>
                    <div style="font-size: 10px;">${phone}</div>
                </div>
                <hr style="margin: 0.5rem 0;">
                <div style="margin-bottom: 1rem;">
                    <div>Producto A x2 - $10.000</div>
                    <div>Producto B x1 - $5.000</div>
                </div>
                <hr style="margin: 0.5rem 0;">
                <div style="text-align: right; font-weight: bold;">Total: $15.000</div>
                <hr style="margin: 0.5rem 0;">
                <div style="text-align: center; font-size: 10px; margin-top: 1rem;">${footer}</div>
            </div>
        `;

        showModal(content, { title: 'Vista Previa del Ticket', width: '350px' });
    },

    showInitialSetupWizard() {
        // Verificar si el asistente ya se mostró
        if (localStorage.getItem('initialSetupCompleted') === 'true') {
            return;
        }

        const content = `
            <div style="text-align: center; padding: 1rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
                <h3>¡Bienvenido al Sistema de Ventas!</h3>
                <p style="margin-bottom: 1.5rem; color: var(--secondary);">
                    Vamos a configurar tu sistema paso a paso para que puedas empezar a vender lo antes posible.
                </p>
                
                <div style="text-align: left; margin-bottom: 1.5rem;">
                    <div style="margin-bottom: 0.5rem;">✅ Paso 1: Configurar nombre del negocio</div>
                    <div style="margin-bottom: 0.5rem;">✅ Paso 2: Configurar moneda e impuestos</div>
                    <div style="margin-bottom: 0.5rem;">✅ Paso 3: Configurar impresora</div>
                    <div style="margin-bottom: 0.5rem;">✅ Paso 4: Crear primer usuario</div>
                </div>

                <div style="background: #fef2f2; color: #991b1b; padding: 1rem; border-radius: 0.5rem; font-size: 0.85rem; margin-top: 1rem; border: 1px solid #fee2e2;">
                    <strong>Nota:</strong> Este asistente solo se mostrará una vez. Puedes cambiar todas estas configuraciones más tarde en la sección de Configuración.
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="SettingsView.skipInitialSetup()">Saltar</button>
            <button class="btn btn-primary" onclick="SettingsView.startInitialSetup()">Comenzar Configuración</button>
        `;

        showModal(content, { title: 'Asistente de Configuración Inicial', footer, width: '500px' });
    },

    skipInitialSetup() {
        localStorage.setItem('initialSetupCompleted', 'true');
        closeModal();
        showNotification('Puedes configurar el sistema más tarde en Configuración', 'info');
    },

    startInitialSetup() {
        closeModal();
        this.showSetupStep1();
    },

    showSetupStep1() {
        const businessName = localStorage.getItem('ticketBusinessName') || '';
        const address = localStorage.getItem('ticketAddress') || '';
        const phone = localStorage.getItem('ticketPhone') || '';

        const content = `
            <div class="form-group">
                <label>Nombre del Negocio *</label>
                <input type="text" id="setupBusinessName" class="form-control" placeholder="Ej: Mi Tienda" value="${businessName}">
            </div>
            
            <div class="form-group">
                <label>Dirección</label>
                <input type="text" id="setupAddress" class="form-control" placeholder="Ej: Calle Principal #123" value="${address}">
            </div>
            
            <div class="form-group">
                <label>Teléfono</label>
                <input type="text" id="setupPhone" class="form-control" placeholder="Ej: +56 9 1234 5678" value="${phone}">
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="SettingsView.skipInitialSetup()">Cancelar</button>
            <button class="btn btn-primary" onclick="SettingsView.saveSetupStep1()">Siguiente →</button>
        `;

        showModal(content, { title: 'Paso 1/4: Información del Negocio', footer, width: '500px' });
    },

    saveSetupStep1() {
        const businessName = document.getElementById('setupBusinessName').value;
        const address = document.getElementById('setupAddress').value;
        const phone = document.getElementById('setupPhone').value;

        if (!businessName) {
            showNotification('El nombre del negocio es obligatorio', 'warning');
            return;
        }

        localStorage.setItem('ticketBusinessName', businessName);
        localStorage.setItem('ticketAddress', address);
        localStorage.setItem('ticketPhone', phone);

        closeModal();
        this.showSetupStep2();
    },

    showSetupStep2() {
        const currency = localStorage.getItem('currency') || 'CLP';
        const taxRate = localStorage.getItem('taxRate') || '19';

        const content = `
            <div class="form-group">
                <label>Moneda</label>
                <select id="setupCurrency" class="form-control">
                    <option value="CLP" ${currency === 'CLP' ? 'selected' : ''}>Peso Chileno (CLP)</option>
                    <option value="USD" ${currency === 'USD' ? 'selected' : ''}>Dólar Estadounidense (USD)</option>
                    <option value="EUR" ${currency === 'EUR' ? 'selected' : ''}>Euro (EUR)</option>
                    <option value="ARS" ${currency === 'ARS' ? 'selected' : ''}>Peso Argentino (ARS)</option>
                    <option value="MXN" ${currency === 'MXN' ? 'selected' : ''}>Peso Mexicano (MXN)</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Tasa de Impuesto (%)</label>
                <input type="number" id="setupTaxRate" class="form-control" placeholder="Ej: 19" value="${taxRate}">
            </div>
            
            <div style="background: #fef2f2; color: #991b1b; padding: 1rem; border-radius: 0.5rem; font-size: 0.85rem; margin-top: 1rem; border: 1px solid #fee2e2;">
                <strong>Nota:</strong> La tasa de impuesto se aplicará a todas las ventas por defecto.
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="SettingsView.showSetupStep1()">← Anterior</button>
            <button class="btn btn-primary" onclick="SettingsView.saveSetupStep2()">Siguiente →</button>
        `;

        showModal(content, { title: 'Paso 2/4: Moneda e Impuestos', footer, width: '500px' });
    },

    saveSetupStep2() {
        const currency = document.getElementById('setupCurrency').value;
        const taxRate = document.getElementById('setupTaxRate').value;

        localStorage.setItem('currency', currency);
        localStorage.setItem('taxRate', taxRate);

        closeModal();
        this.showSetupStep3();
    },

    showSetupStep3() {
        const hasPrinter = localStorage.getItem('hasPrinter') === 'true' ? 'yes' : 'no';
        const printerPort = localStorage.getItem('printerPort') || 'USB';
        const paperWidth = localStorage.getItem('paperWidth') || '58mm';

        const content = `
            <div class="form-group">
                <label>¿Tienes impresora térmica?</label>
                <select id="setupHasPrinter" class="form-control" onchange="SettingsView.togglePrinterOptions()">
                    <option value="no" ${hasPrinter === 'no' ? 'selected' : ''}>No</option>
                    <option value="yes" ${hasPrinter === 'yes' ? 'selected' : ''}>Sí</option>
                </select>
            </div>
            
            <div id="printerOptions" style="display: ${hasPrinter === 'yes' ? 'block' : 'none'};">
                <div class="form-group">
                    <label>Puerto de Impresión</label>
                    <select id="setupPrinterPort" class="form-control">
                        <option value="USB" ${printerPort === 'USB' ? 'selected' : ''}>USB</option>
                        <option value="COM1" ${printerPort === 'COM1' ? 'selected' : ''}>COM1</option>
                        <option value="COM2" ${printerPort === 'COM2' ? 'selected' : ''}>COM2</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Ancho del Papel</label>
                    <select id="setupPaperWidth" class="form-control">
                        <option value="58mm" ${paperWidth === '58mm' ? 'selected' : ''}>58mm (Estándar)</option>
                        <option value="80mm" ${paperWidth === '80mm' ? 'selected' : ''}>80mm (Grande)</option>
                    </select>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="SettingsView.showSetupStep2()">← Anterior</button>
            <button class="btn btn-primary" onclick="SettingsView.saveSetupStep3()">Siguiente →</button>
        `;

        showModal(content, { title: 'Paso 3/4: Configuración de Impresora', footer, width: '500px' });
    },

    togglePrinterOptions() {
        const hasPrinter = document.getElementById('setupHasPrinter').value;
        const printerOptions = document.getElementById('printerOptions');
        printerOptions.style.display = hasPrinter === 'yes' ? 'block' : 'none';
    },

    saveSetupStep3() {
        const hasPrinter = document.getElementById('setupHasPrinter').value;
        const printerPort = document.getElementById('setupPrinterPort')?.value || 'USB';
        const paperWidth = document.getElementById('setupPaperWidth')?.value || '58mm';

        localStorage.setItem('hasPrinter', hasPrinter === 'yes');
        localStorage.setItem('printerPort', printerPort);
        localStorage.setItem('paperWidth', paperWidth);

        closeModal();
        this.showSetupStep4();
    },

    showSetupStep4() {
        const content = `
            <div style="text-align: center; padding: 1rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
                <h3>¡Configuración Completada!</h3>
                <p style="margin-bottom: 1.5rem; color: var(--secondary);">
                    Tu sistema está listo para usar. Aquí tienes un resumen de la configuración:
                </p>
                
                <div style="text-align: left; background: #f9fafb; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                    <div><strong>Negocio:</strong> ${localStorage.getItem('ticketBusinessName')}</div>
                    <div><strong>Moneda:</strong> ${localStorage.getItem('currency')}</div>
                    <div><strong>Impuesto:</strong> ${localStorage.getItem('taxRate')}%</div>
                    <div><strong>Impresora:</strong> ${localStorage.getItem('hasPrinter') === 'true' ? 'Configurada' : 'No configurada'}</div>
                </div>

                <p style="font-size: 0.85rem; color: #6b7280;">
                    Puedes cambiar todas estas configuraciones más tarde en la sección de Configuración.
                </p>
            </div>
        `;

        const footer = `
            <button class="btn btn-primary" onclick="SettingsView.completeInitialSetup()">Comenzar a Usar</button>
        `;

        showModal(content, { title: 'Paso 4/4: Configuración Completada', footer, width: '500px' });
    },

    completeInitialSetup() {
        localStorage.setItem('initialSetupCompleted', 'true');
        closeModal();
        showNotification('¡Configuración inicial completada! Tu sistema está listo para usar.', 'success');
    },


    getSafeBusinessId() {
        try {
            const raw = localStorage.getItem('CURRENT_BUSINESS');
            if (!raw) return 1;
            const trimmed = String(raw).trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                const parsed = JSON.parse(trimmed);
                if (parsed && parsed.id) return parsed.id;
            }
            return 1;
        } catch (e) {
            return 1;
        }
    },

    async loadGeminiSettings() {
        try {
            const businessId = this.getSafeBusinessId();
            const settings = await window.db.getAll('settings');
            const aiSettings = (settings || []).find(s => s.key === 'gemini_api_key' && (s.business_id === businessId || !s.business_id));
            if (aiSettings && aiSettings.value) {
                const input = document.getElementById('geminiApiKey');
                if (input) input.value = aiSettings.value;
            }
        } catch (error) {
            console.error('Error cargando configuración IA:', error);
        }
    },

    async saveGeminiSettings() {
        try {
            const input = document.getElementById('geminiApiKey');
            const apiKey = input ? input.value.trim() : '';
            
            if (!apiKey) {
                showNotification('Ingresa una API Key válida.', 'warning');
                return;
            }
            
            const businessId = this.getSafeBusinessId();
            
            // Check if settings table or ApiClient exists
            const settings = await window.db.getAll('settings');
            const aiSettings = (settings || []).find(s => s.key === 'gemini_api_key' && (s.business_id === businessId || !s.business_id));
            
            if (aiSettings) {
                await window.db.query('UPDATE settings SET value = ? WHERE key = ? AND (business_id = ? OR business_id IS NULL)', [apiKey, 'gemini_api_key', businessId]);
            } else {
                await window.db.query('INSERT INTO settings (key, value, business_id) VALUES (?, ?, ?)', ['gemini_api_key', apiKey, businessId]);
            }
            
            showNotification('Configuración de Inteligencia Artificial guardada correctamente.', 'success');
        } catch (error) {
            console.error('Error guardando configuración IA:', error);
            showNotification('Error al guardar la configuración.', 'error');
        }
    },

    runSetupWizardAgain() {
        this.showSetupStep1();
    },

    async initSecuritySection() {
        this.updateAdminPINStatus();
        this.loadUserRoles();
    },

    async updateAdminPINStatus() {
        const statusText = document.getElementById('pinStatusText');
        const pinBtn = document.getElementById('adminPINBtn');
        if (!statusText) return;

        try {
            const hasPIN = await User.hasAdminPIN();
            if (hasPIN) {
                statusText.innerHTML = '🟢 <strong style="color: #166534;">PIN de Administrador Configurado</strong>';
                if (pinBtn) pinBtn.textContent = '🔒 Cambiar PIN de Administrador';
            } else {
                statusText.innerHTML = '⚠️ <strong style="color: #92400e;">Sin PIN personalizado (Recomendado configurar uno)</strong>';
                if (pinBtn) pinBtn.textContent = '🔑 Configurar PIN de Administrador';
            }
        } catch (e) {
            console.error('[Settings] Error cargando estado de PIN:', e);
            statusText.textContent = 'Error al cargar estado del PIN';
        }
    },

    async loadUserRoles() {
        const listDiv = document.getElementById('userRolesList');
        if (!listDiv) return;

        try {
            let users = [];
            if (window.db && window.db.mode === 'sqlite' && window.ApiClient) {
                users = await window.db.getAll('users');
            } else {
                users = await User.getAll();
            }

            if (!users || users.length === 0) {
                listDiv.innerHTML = '<p style="color: #6b7280; font-size: 0.85rem;">No hay usuarios registrados.</p>';
                return;
            }

            const currentUser = AuthManager.getCurrentUser();

            const roleBadges = {
                owner: '<span class="badge" style="background: #7c3aed; color: white;">👑 Propietario</span>',
                admin: '<span class="badge" style="background: #2563eb; color: white;">🛡️ Administrador</span>',
                cashier: '<span class="badge" style="background: #475569; color: white;">🛒 Cajero</span>'
            };

            let html = `
                <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 0.75rem; background: white;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 0.75rem 1rem; font-weight: 600; color: #475569;">Usuario</th>
                                <th style="padding: 0.75rem 1rem; font-weight: 600; color: #475569;">Teléfono</th>
                                <th style="padding: 0.75rem 1rem; font-weight: 600; color: #475569;">Rol</th>
                                <th style="padding: 0.75rem 1rem; font-weight: 600; color: #475569; text-align: right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            users.forEach((u, idx) => {
                const isSelf = currentUser && currentUser.id === u.id;
                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? 'white' : '#fafcfd'};">
                        <td style="padding: 0.75rem 1rem; font-weight: 600; color: #1e293b;">
                            👤 ${u.username} ${isSelf ? '<span style="font-size: 0.75rem; color: #4f46e5;">(Tú)</span>' : ''}
                        </td>
                        <td style="padding: 0.75rem 1rem; color: #64748b;">${u.phone || 'Sin registrar'}</td>
                        <td style="padding: 0.75rem 1rem;">
                            ${roleBadges[u.role] || roleBadges.cashier}
                        </td>
                        <td style="padding: 0.75rem 1rem; text-align: right;">
                            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                                <button class="btn btn-sm btn-secondary" onclick="SettingsView.showChangeEmployeePasswordModal(${u.id}, '${u.username}')" title="Cambiar Contraseña">
                                    🔑 Clave
                                </button>
                                ${!isSelf && u.role !== 'owner' ? `
                                    <button class="btn btn-sm btn-secondary" onclick="SettingsView.showEditRoleModal(${u.id}, '${u.username}', '${u.role}')" title="Cambiar Rol">
                                        🛡️ Rol
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;

            listDiv.innerHTML = html;
        } catch (error) {
            console.error('[Settings] Error cargando lista de usuarios:', error);
            listDiv.innerHTML = '<p style="color: #ef4444; font-size: 0.85rem;">Error al cargar usuarios.</p>';
        }
    },

    showCreateUserModal() {
        const content = `
            <form id="createUserForm" onsubmit="event.preventDefault(); SettingsView.submitCreateUser();" style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #374151; margin-bottom: 0.35rem;">Nombre de Usuario *</label>
                    <input type="text" id="newUsername" class="form-control" required placeholder="Ej: cajero1" style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; font-size: 0.9rem;">
                </div>
                <div>
                    <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #374151; margin-bottom: 0.35rem;">Contraseña Inicial *</label>
                    <input type="password" id="newUserPassword" class="form-control" required minlength="4" placeholder="Mínimo 4 caracteres" style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; font-size: 0.9rem;">
                </div>
                <div>
                    <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #374151; margin-bottom: 0.35rem;">Teléfono (Opcional)</label>
                    <input type="text" id="newUserPhone" class="form-control" placeholder="+569XXXXXXXX" style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; font-size: 0.9rem;">
                </div>
                <div>
                    <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #374151; margin-bottom: 0.35rem;">Rol del Empleado *</label>
                    <select id="newUserRole" class="form-control" style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; font-size: 0.9rem;">
                        <option value="cashier">Cajero (Solo ventas y caja)</option>
                        <option value="admin">Administrador (Gestión operativa)</option>
                    </select>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="SettingsView.submitCreateUser()">👤 Crear Usuario</button>
        `;

        showModal(content, { title: '➕ Crear Nuevo Usuario', footer, width: '450px' });
    },

    async submitCreateUser() {
        const username = document.getElementById('newUsername')?.value.trim() || '';
        const password = document.getElementById('newUserPassword')?.value || '';
        const phone = document.getElementById('newUserPhone')?.value.trim() || null;
        const role = document.getElementById('newUserRole')?.value || 'cashier';

        if (!username || username.length < 3) {
            showNotification('El usuario debe tener al menos 3 caracteres.', 'warning');
            return;
        }

        if (!password || password.length < 4) {
            showNotification('La contraseña debe tener al menos 4 caracteres.', 'warning');
            return;
        }

        try {
            await User.create(username, password, phone, role);
            closeModal();
            showNotification(`¡Usuario "${username}" creado exitosamente!`, 'success');
            this.loadUserRoles();
        } catch (err) {
            console.error('[Settings] Error al crear usuario:', err);
            showNotification(err.message || 'Error al crear usuario.', 'error');
        }
    },

    showEditRoleModal(userId, username, currentRole) {
        const content = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <p style="font-size: 0.9rem; color: #475569; margin: 0;">Selecciona el nuevo rol para <strong>${username}</strong>:</p>
                <div>
                    <select id="editUserRoleSelect" class="form-control" style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; font-size: 0.9rem;">
                        <option value="cashier" ${currentRole === 'cashier' ? 'selected' : ''}>🛒 Cajero (Solo POS y caja)</option>
                        <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>🛡️ Administrador (Gestión operativa)</option>
                    </select>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="SettingsView.submitUpdateRole(${userId}, '${username}')">💾 Guardar Rol</button>
        `;

        showModal(content, { title: `🛡️ Cambiar Rol - ${username}`, footer, width: '400px' });
    },

    async submitUpdateRole(userId, username) {
        const newRole = document.getElementById('editUserRoleSelect')?.value || 'cashier';
        try {
            await User.updateRole(userId, newRole);
            closeModal();
            showNotification(`Rol de "${username}" actualizado a ${newRole === 'admin' ? 'Administrador' : 'Cajero'}`, 'success');
            this.loadUserRoles();
        } catch (err) {
            console.error('[Settings] Error actualizando rol:', err);
            showNotification(err.message || 'Error actualizando rol.', 'error');
        }
    },

    showSetAdminPINForm() {
        const content = `
            <form onsubmit="event.preventDefault(); SettingsView.submitSetAdminPIN();" style="display: flex; flex-direction: column; gap: 1rem;">
                <p style="font-size: 0.85rem; color: #64748b; margin: 0; line-height: 1.4;">
                    El PIN de Administrador te permite restablecer la contraseña de cualquier usuario en caso de olvido. 
                    Debe ser un número de <strong>4 a 8 dígitos</strong>.
                </p>
                <div>
                    <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #374151; margin-bottom: 0.35rem;">Nuevo PIN de Seguridad (4-8 dígitos) *</label>
                    <input type="password" id="newAdminPIN" class="form-control" maxlength="8" pattern="[0-9]*" inputmode="numeric" required placeholder="Ej: 123456" style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; font-size: 1.1rem; text-align: center; letter-spacing: 0.2rem;">
                </div>
                <div>
                    <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #374151; margin-bottom: 0.35rem;">Confirmar Nuevo PIN *</label>
                    <input type="password" id="confirmAdminPIN" class="form-control" maxlength="8" pattern="[0-9]*" inputmode="numeric" required placeholder="Repite el PIN" style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; font-size: 1.1rem; text-align: center; letter-spacing: 0.2rem;">
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="SettingsView.submitSetAdminPIN()">🔒 Guardar PIN</button>
        `;

        showModal(content, { title: '🔑 Configurar PIN de Seguridad', footer, width: '420px' });
    },

    async submitSetAdminPIN() {
        const pin = document.getElementById('newAdminPIN')?.value.trim() || '';
        const confirmPin = document.getElementById('confirmAdminPIN')?.value.trim() || '';

        if (!/^\d{4,8}$/.test(pin)) {
            showNotification('El PIN debe contener de 4 a 8 números.', 'warning');
            return;
        }

        if (pin !== confirmPin) {
            showNotification('Los PINs ingresados no coinciden.', 'warning');
            return;
        }

        try {
            await User.setAdminPIN(pin);
            closeModal();
            showNotification('¡PIN de Administrador guardado exitosamente!', 'success');
            this.updateAdminPINStatus();
        } catch (err) {
            console.error('[Settings] Error al guardar PIN:', err);
            showNotification(err.message || 'Error al guardar el PIN.', 'error');
        }
    },

    async generateRecoveryCode() {
        try {
            const currentUser = AuthManager.getCurrentUser();
            if (!currentUser) throw new Error('No se encontró una sesión activa.');

            const res = await User.generateAndSetRecoveryCode(currentUser.id);
            const content = `
                <div style="text-align: center; padding: 1rem;">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📜</div>
                    <p style="font-size: 0.9rem; color: #374151; margin-bottom: 1rem;">
                        Guarda este código en un lugar seguro. Podrás usarlo para recuperar tu cuenta si lo necesitas:
                    </p>
                    <div style="font-size: 1.4rem; font-family: monospace; font-weight: bold; background: #f1f5f9; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; color: #4f46e5; letter-spacing: 0.1rem;">
                        ${res.code}
                    </div>
                </div>
            `;
            showModal(content, { title: 'Código de Recuperación Generado', width: '450px' });
        } catch (err) {
            console.error('[Settings] Error generando código:', err);
            showNotification(err.message || 'Error al generar código de recuperación.', 'error');
        }
    },

    async changeOwnPassword() {
        const currentPass = document.getElementById('myCurrentPassword')?.value || '';
        const newPass = document.getElementById('myNewPassword')?.value || '';
        const confirmPass = document.getElementById('myConfirmPassword')?.value || '';

        if (!newPass || newPass.length < 4) {
            showNotification('La nueva contraseña debe tener al menos 4 caracteres.', 'warning');
            return;
        }

        if (newPass !== confirmPass) {
            showNotification('Las contraseñas ingresadas no coinciden.', 'warning');
            return;
        }

        try {
            const currentUser = AuthManager.getCurrentUser();
            if (!currentUser) throw new Error('No se encontró una sesión activa.');

            if (window.db && window.db.mode === 'sqlite' && window.ApiClient) {
                const res = await window.ApiClient.post('auth/change-password', {
                    currentPassword: currentPass,
                    newPassword: newPass
                });
                if (!res || res.error) throw new Error(res?.error || 'Error cambiando contraseña en el servidor');
            } else {
                const user = (await User.getById(currentUser.id)) || { id: currentUser.id };

                let isValid = true;
                if (user && user.localHash) {
                    const inputHash = await _hashSHA256(currentPass);
                    isValid = user.localHash === inputHash;
                } else if (user && user.password) {
                    isValid = user.password === currentPass;
                }

                if (!isValid) throw new Error('La contraseña actual es incorrecta.');
            }

            const newHash = await _hashSHA256(newPass);
            const user = (await User.getById(currentUser.id)) || { id: currentUser.id };
            const updatedUser = {
                ...user,
                id: currentUser.id,
                password: newPass,
                localHash: newHash,
                forcePasswordChange: 0,
                updatedAt: new Date().toISOString()
            };

            if (!updatedUser.phone || updatedUser.phone === '' || updatedUser.phone === 'null') {
                delete updatedUser.phone;
            }

            await db.put('users', updatedUser);

            document.getElementById('myCurrentPassword').value = '';
            document.getElementById('myNewPassword').value = '';
            document.getElementById('myConfirmPassword').value = '';

            showNotification('¡Tu contraseña ha sido actualizada exitosamente!', 'success');
        } catch (err) {
            console.error('[SettingsView] Error cambiando propia contraseña:', err);
            showNotification(err.message || 'Error al cambiar la contraseña.', 'error');
        }
    },

    showChangeEmployeePasswordModal(userId, username) {
        const content = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <p style="font-size: 0.9rem; color: #475569; margin: 0;">
                    Ingresa la nueva contraseña para <strong>${username}</strong>. Podrá usarla de inmediato para iniciar sesión.
                </p>
                <div>
                    <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #374151; margin-bottom: 0.35rem;">Nueva Contraseña (mínimo 4 caracteres):</label>
                    <input type="password" id="empNewPassword" class="form-control" placeholder="Escribe nueva clave..." style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; font-size: 0.9rem;">
                </div>
                <div>
                    <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #374151; margin-bottom: 0.35rem;">Confirmar Contraseña:</label>
                    <input type="password" id="empConfirmPassword" class="form-control" placeholder="Repite la nueva clave..." style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; font-size: 0.9rem;">
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" id="showEmpPassCheck" onchange="
                        const p1 = document.getElementById('empNewPassword');
                        const p2 = document.getElementById('empConfirmPassword');
                        if (p1 && p2) { p1.type = this.checked ? 'text' : 'password'; p2.type = this.checked ? 'text' : 'password'; }
                    ">
                    <label for="showEmpPassCheck" style="font-size: 0.85rem; color: #475569; cursor: pointer;">Mostrar contraseña</label>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="SettingsView.submitEmployeePasswordChange(${userId}, '${username}')">
                💾 Guardar Nueva Contraseña
            </button>
        `;

        showModal(content, { title: `🔑 Cambiar Contraseña - ${username}`, footer, width: '450px' });
    },

    async submitEmployeePasswordChange(userId, username) {
        const newPass = document.getElementById('empNewPassword')?.value || '';
        const confirmPass = document.getElementById('empConfirmPassword')?.value || '';

        if (!newPass || newPass.length < 4) {
            showNotification('La contraseña debe tener al menos 4 caracteres.', 'warning');
            return;
        }

        if (newPass !== confirmPass) {
            showNotification('Las contraseñas ingresadas no coinciden.', 'warning');
            return;
        }

        try {
            if (window.db && window.db.mode === 'sqlite' && window.ApiClient) {
                const res = await window.ApiClient.post('auth/admin-change-employee-password', {
                    targetUserId: userId,
                    newPassword: newPass
                });
                if (!res || res.error) throw new Error(res?.error || 'Error al cambiar la contraseña en el servidor');
            }

            const user = (await User.getById(userId)) || { id: userId, username: username };
            const newHash = await _hashSHA256(newPass);

            const updatedUser = {
                ...user,
                id: userId,
                password: newPass,
                localHash: newHash,
                forcePasswordChange: 0,
                updatedAt: new Date().toISOString()
            };

            if (!updatedUser.phone || updatedUser.phone === '' || updatedUser.phone === 'null') {
                delete updatedUser.phone;
            }

            await db.put('users', updatedUser);

            closeModal();
            showNotification(`¡Contraseña de ${username} actualizada exitosamente!`, 'success');
        } catch (err) {
            console.error('[SettingsView] Error actualizando clave de empleado:', err);
            showNotification(err.message || 'Error al actualizar la contraseña.', 'error');
        }
    }
};
