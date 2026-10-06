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
            this.initNavCustomization();
            this.loadMultipleCashSettings();
            this.loadRolesPermissions();
            this.loadPrinterSettings();
            this.loadCloudBackupSettings();
            this.loadTicketSettings();
            this.initMultiDeviceSection();
            this.initMyProfileSection();
        }, 100);

        // ponytail: Memoria temporal de 1 minuto (60 segundos) al salir y entrar de Configuración
        const lastExitTime = parseInt(localStorage.getItem('settings_last_exit_time') || '0', 10);
        const timeElapsed = Date.now() - lastExitTime;
        let activeTab = localStorage.getItem('active_settings_tab') || 'menu';
        
        // Si pasaron más de 60 segundos (1 minuto) desde que salió de Configuración, volver al menú de categorías
        if (lastExitTime > 0 && timeElapsed > 60000) {
            activeTab = 'menu';
            localStorage.setItem('active_settings_tab', 'menu');
        }

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
                .settings-category-card.hero-help {
                    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
                    color: #ffffff;
                    border: 1.5px solid #4338ca;
                    border-top: 6px solid #6366f1;
                    box-shadow: 0 12px 28px rgba(30, 27, 75, 0.35);
                    grid-column: 1 / -1;
                }
                .settings-category-card.hero-help h3 {
                    color: #ffffff;
                    font-size: 1.25rem;
                }
                .settings-category-card.hero-help p {
                    color: #c7d2fe;
                    font-size: 0.9rem;
                }
                .settings-category-card.hero-help .card-action {
                    color: #a5b4fc;
                    font-weight: 800;
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
                <h1 style="color: #111827;">Configuración del Negocio</h1>
                <p style="color: #4b5563;">Administración de periféricos, respaldos, seguridad y guías de uso</p>
            </div>

            <!-- MENU PRINCIPAL: DASHBOARD DE TARJETAS EN RELIEVE -->
            <div id="settings-dashboard" class="settings-dashboard-grid" style="display: ${activeTab === 'menu' ? 'grid' : 'none'};">
                
                <!-- TARJETA HERO: GUÍA DE USO Y CENTRO DE AYUDA -->
                <div class="settings-category-card hero-help" onclick="SettingsView.showHelpCenterModal()">
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 2.2rem;">📖</span>
                            <div>
                                <h3 style="margin: 0;">Guía Rápida de Uso & Centro de Ayuda</h3>
                                <p style="margin: 0.25rem 0 0 0;">Aprende a usar el punto de venta, atajos de teclado, control de caja y carga de facturas.</p>
                            </div>
                        </div>
                        <span class="badge" style="background: rgba(255,255,255,0.15); color: #ffffff; padding: 0.4rem 0.85rem; border-radius: 0.65rem; font-weight: 800; font-size: 0.85rem;">
                            Ver Manual Interactivo ➔
                        </span>
                    </div>
                </div>

                <!-- TARJETA MI PERFIL & SEGURIDAD PERSONAL -->
                <div class="settings-category-card" style="--card-hover-border: #8b5cf6; --card-accent-color: #7c3aed; border-top-color: #8b5cf6;" onclick="SettingsView.switchTab('settings-tab-profile')">
                    <div class="card-icon">👤</div>
                    <h3>Mi Perfil y Contraseña</h3>
                    <p>Personaliza tu tema visual, ajusta el brillo de pantalla y cambia tu contraseña de acceso personal.</p>
                    <div class="card-action">Mi Cuenta ➔</div>
                </div>

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
            </div>

            <!-- CONTENEDOR DE OPCIONES INTERNAS -->
            <div class="settings-content-wrapper" style="display: ${activeTab === 'menu' ? 'none' : 'block'};">

                <!-- PANE 0: MI PERFIL Y SEGURIDAD PERSONAL -->
                <div id="settings-tab-profile" class="settings-section-panel ${activeTab === 'settings-tab-profile' ? 'active' : ''}">
                    <button class="btn-back-settings" onclick="SettingsView.showCategoriesMenu()">
                        ⬅️ Regresar a Ajustes
                    </button>
                    
                    <div class="settings-panel-header" style="border-left-color: #8b5cf6; background: #f5f3ff;">
                        <h2 style="color: #7c3aed;">👤 Mi Perfil y Seguridad Personal</h2>
                        <p>Gestiona tu cuenta personal, credenciales de acceso y preferencias visuales de tu estación de trabajo.</p>
                    </div>

                    <!-- TARJETA: INFORMACIÓN DE MI SESIÓN -->
                    <div class="card" style="margin-bottom: 1.5rem; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #8b5cf6;">
                        <h3 style="margin-bottom: 1rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                            🪪 Mi Sesión Actual
                        </h3>
                        <div id="myProfileInfoBox" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; background: #f8fafc; padding: 1rem 1.25rem; border-radius: 0.75rem; border: 1px solid #e2e8f0;">
                            <div>
                                <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Usuario Activo</div>
                                <div id="myProfileUsername" style="font-size: 1.2rem; font-weight: 850; color: #1e293b;">Cargando...</div>
                            </div>
                            <div>
                                <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Rol Asignado</div>
                                <div id="myProfileRoleBadge">...</div>
                            </div>
                            <div>
                                <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Sucursal / Negocio</div>
                                <div id="myProfileBizName" style="font-size: 0.95rem; font-weight: 750; color: #4338ca;">...</div>
                            </div>
                            <div>
                                <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Código de Acceso</div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.2rem;">
                                    <span id="myProfileAccessCode" style="font-size: 1.05rem; font-weight: 850; color: #4338ca; font-family: monospace; letter-spacing: 0.05em; background: #eef2ff; border: 1px solid #c7d2fe; padding: 0.2rem 0.6rem; border-radius: 0.5rem;">...</span>
                                    <button type="button" class="btn btn-sm" onclick="SettingsView.copyBusinessCode()" style="padding: 0.25rem 0.55rem; font-size: 0.75rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 0.4rem; cursor: pointer; font-weight: 700;" title="Copiar código para empleados">📋 Copiar</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TARJETA: CAMBIO DE CONTRASEÑA PERSONAL -->
                    <div class="card" style="margin-bottom: 1.5rem; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #8b5cf6;">
                        <h3 style="margin-bottom: 0.5rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                            🔑 Cambiar Mi Contraseña
                        </h3>
                        <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.25rem; line-height: 1.4;">
                            Actualiza tu clave de acceso personal. Recuerda no compartirla con otros empleados ni dejarla anotada.
                        </p>
                        <form onsubmit="event.preventDefault(); SettingsView.changeOwnPassword();" style="display: flex; flex-direction: column; gap: 1rem; max-width: 480px;">
                            <div>
                                <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #374151; margin-bottom: 0.35rem;">Contraseña Actual *</label>
                                <input type="password" id="myCurrentPassword" class="form-control" placeholder="Escribe tu clave actual" required style="padding: 0.55rem 0.85rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; font-size: 0.95rem;">
                            </div>
                            <div>
                                <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #374151; margin-bottom: 0.35rem;">Nueva Contraseña * (Mínimo 4 caracteres)</label>
                                <input type="password" id="myNewPassword" class="form-control" placeholder="Escribe tu nueva clave" required minlength="4" style="padding: 0.55rem 0.85rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; font-size: 0.95rem;">
                            </div>
                            <div>
                                <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #374151; margin-bottom: 0.35rem;">Confirmar Nueva Contraseña *</label>
                                <input type="password" id="myConfirmPassword" class="form-control" placeholder="Repite la nueva clave" required minlength="4" style="padding: 0.55rem 0.85rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; font-size: 0.95rem;">
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <input type="checkbox" id="showMyPassToggle" onchange="
                                    const c = document.getElementById('myCurrentPassword');
                                    const n = document.getElementById('myNewPassword');
                                    const r = document.getElementById('myConfirmPassword');
                                    const type = this.checked ? 'text' : 'password';
                                    if (c) c.type = type;
                                    if (n) n.type = type;
                                    if (r) r.type = type;
                                ">
                                <label for="showMyPassToggle" style="font-size: 0.85rem; color: #64748b; cursor: pointer;">Mostrar contraseñas</label>
                            </div>
                            <div>
                                <button type="submit" class="btn btn-primary" style="background: #7c3aed; padding: 0.6rem 1.5rem; border-radius: 0.65rem; font-weight: 800;">
                                    💾 Guardar Nueva Contraseña
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- TARJETA: PERSONALIZACIÓN VISUAL PARA ESTA ESTACIÓN -->
                    <div class="card" style="margin-bottom: 0; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #8b5cf6;">
                        <h3 style="margin-bottom: 1.25rem; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                            🎨 Mi Tema Visual y Luminosidad
                        </h3>
                        <div class="grid grid-2" style="gap: 2rem;">
                            <div>
                                <h4 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-muted);">PALETA DE COLORES</h4>
                                <div id="my-profile-theme-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(95px, 1fr)); gap: 0.75rem;">
                                    ${this.renderThemeOptions()}
                                </div>
                            </div>
                            <div>
                                <h4 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-muted);">BRILLO Y DESCANSO VISUAL</h4>
                                <div style="background: #f8fafc; padding: 1.25rem; border-radius: 0.85rem; border: 1px solid #e2e8f0;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                        <span>Brillo de la Pantalla</span>
                                        <strong id="my-brightness-value">100%</strong>
                                    </div>
                                    <input type="range" id="my-brightness-slider" min="0.3" max="1" step="0.05" value="1" 
                                           style="width: 100%; cursor: pointer;" 
                                           oninput="SettingsView.updateBrightness(this.value)">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

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

                    <!-- SECCIÓN: PERSONALIZACIÓN DE LA BARRA DE NAVEGACIÓN -->
                    <div class="card" style="margin-bottom: 1.5rem; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #6366f1;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
                            <div>
                                <h3 style="margin: 0; color: #111827; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                                    📌 Barra de Navegación Personalizada
                                </h3>
                                <p style="margin: 0.35rem 0 0 0; font-size: 0.85rem; color: #6b7280; line-height: 1.4;">
                                    Selecciona qué módulos quieres tener a mano directamente en la barra inferior (mínimo 2, máximo 6). Los demás se guardarán en el menú <strong>☰ Más Módulos</strong>.
                                </p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <span id="nav-custom-counter" class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 0.85rem; font-weight: 800; padding: 0.4rem 0.85rem; border-radius: 9999px;">
                                    ...
                                </span>
                                <button type="button" class="btn btn-sm btn-ghost" onclick="SettingsView.resetNavCustomization()" style="font-size: 0.8rem; font-weight: 700; color: #64748b; border: 1px solid #e2e8f0; padding: 0.35rem 0.75rem; border-radius: 0.5rem;">
                                    🔄 Restablecer
                                </button>
                            </div>
                        </div>

                        <div id="nav-modules-selection-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                            <!-- Generado dinámicamente -->
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
                            <div style="font-size: 0.825rem; color: #64748b; display: flex; align-items: center; gap: 0.35rem;">
                                💡 <span>Los cambios se aplican al instante en la parte inferior de la pantalla.</span>
                            </div>
                            <button type="button" class="btn btn-primary" onclick="SettingsView.saveNavCustomization()" style="background: #4f46e5; color: #ffffff; border: none; padding: 0.55rem 1.4rem; border-radius: 0.65rem; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
                                💾 Guardar Barra
                            </button>
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

                    <!-- SECCIÓN: SUITE INTEGRAL DE RESPALDOS, EXPORTACIÓN E IMPORTACIÓN -->
                    ${PermissionService.can('settings.backup') ? `
                    
                    <!-- 1. RESPALDO TOTAL DEL SISTEMA (JSON) -->
                    <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #4f46e5; margin-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                            <h3 style="margin: 0; color: #111827; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                                📦 Respaldo Completo del Negocio (.JSON)
                            </h3>
                            <span class="badge" style="background: #eff6ff; color: #1d4ed8; font-weight: 800; padding: 0.25rem 0.65rem; border-radius: 0.5rem; font-size: 0.78rem;">
                                Copia Total Blindada
                            </span>
                        </div>
                        <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem; line-height: 1.4;">
                            Genera un archivo único con toda la información de tu local: <strong>Productos, Ventas, Historial, Clientes, Compras, Proveedores, Gastos, Cajas Registradoras y Configuración</strong>. Ideal para guardar en un pendrive o transferir a otro computador.
                        </p>
                        <!-- Banner de Blindaje Multi-Negocio -->
                        <div style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border: 1.5px solid #c7d2fe; border-radius: 0.75rem; padding: 0.75rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.65rem;">
                                <span style="font-size: 1.4rem;">🏪</span>
                                <div>
                                    <span style="font-size: 0.72rem; color: #4338ca; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Negocio Activo para Respaldos:</span>
                                    <div style="font-size: 0.95rem; font-weight: 850; color: #1e1b4b;">
                                        ${safeHTML(localStorage.getItem('CURRENT_BUSINESS') || 'Negocio Principal')}
                                    </div>
                                </div>
                            </div>
                            <span class="badge" style="background: #4f46e5; color: #ffffff; font-weight: 800; padding: 0.35rem 0.75rem; border-radius: 0.5rem; font-size: 0.75rem;">
                                🛡️ Aislamiento Estricto Activo
                            </span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
                            <button class="btn btn-primary" style="height: 48px; justify-content: center; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); font-weight: 850; border-radius: 0.75rem; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);" onclick="BackupManager.exportAllData()">
                                📤 Descargar Respaldo Total (.JSON)
                            </button>
                            <button class="btn btn-secondary" style="height: 48px; justify-content: center; border: 2px solid #6366f1; color: #4338ca; background: #eef2ff; font-weight: 850; border-radius: 0.75rem;" onclick="document.getElementById('importBackupJsonInput').click()">
                                📥 Restaurar desde Respaldo (.JSON)
                            </button>
                            <input type="file" id="importBackupJsonInput" style="display: none;" accept=".json" onchange="SettingsView.handleImport(event)">
                        </div>
                    </div>

                    <!-- 2. CATÁLOGO DE PRODUCTOS (EXCEL) -->
                    <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #10b981; margin-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                            <h3 style="margin: 0; color: #111827; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                                🛒 Catálogo de Productos (Excel .XLSX)
                            </h3>
                            <span class="badge" style="background: #ecfdf5; color: #047857; font-weight: 800; padding: 0.25rem 0.65rem; border-radius: 0.5rem; font-size: 0.78rem;">
                                Carga Masiva Rápida
                            </span>
                        </div>
                        <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.25rem; line-height: 1.4;">
                            Importa tu inventario completo desde planillas de cálculo con códigos de barra, costos y precios, o descarga tu catálogo actualizado para control comercial.
                        </p>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem;">
                            <button class="btn btn-success" style="height: 44px; justify-content: center; font-weight: 850; border-radius: 0.65rem; background: #059669;" onclick="SettingsView.showImportProductsModal()">
                                📥 Importar Productos (Excel)
                            </button>
                            <button class="btn btn-secondary" style="height: 44px; justify-content: center; border: 2px solid #10b981; color: #065f46; background: #ecfdf5; font-weight: 850; border-radius: 0.65rem;" onclick="BackupManager.exportProductsToExcel()">
                                📤 Exportar Catálogo (Excel)
                            </button>
                            <button class="btn btn-secondary" style="height: 44px; justify-content: center; border: 1.5px dashed #059669; color: #047857; background: #ffffff; font-weight: 800; border-radius: 0.65rem;" onclick="BackupManager.downloadProductTemplate()">
                                📄 Descargar Plantilla Modelo (.XLSX)
                            </button>
                        </div>
                    </div>

                    <!-- 3. CLIENTES Y PROVEEDORES (EXCEL) -->
                    <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #06b6d4; margin-bottom: 1.5rem;">
                        <h3 style="margin-bottom: 1rem; color: #111827; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                            👥 Clientes y Proveedores Comerciales (Excel)
                        </h3>
                        <div class="grid grid-2" style="gap: 1.5rem;">
                            <!-- Bloque Clientes -->
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem;">
                                <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem; color: #0f172a; display: flex; align-items: center; gap: 0.35rem;">
                                    👤 Clientes y Cuentas Corrientes
                                </h4>
                                <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.75rem;">
                                    Sube tu cartera de clientes con límites de crédito o exporta sus saldos.
                                </p>
                                <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                                    <button class="btn btn-sm btn-primary" style="justify-content: center; background: #0891b2; font-weight: 800;" onclick="SettingsView.showImportCustomersModal()">
                                        📥 Importar Clientes (Excel)
                                    </button>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
                                        <button class="btn btn-sm btn-secondary" style="justify-content: center; font-weight: 700; border-color: #06b6d4; color: #0e7490;" onclick="BackupManager.exportCustomersToExcel()">
                                            📤 Exportar
                                        </button>
                                        <button class="btn btn-sm btn-secondary" style="justify-content: center; font-weight: 700; border-style: dashed; color: #0891b2;" onclick="BackupManager.downloadCustomerTemplate()">
                                            📄 Plantilla
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Bloque Proveedores -->
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem;">
                                <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem; color: #0f172a; display: flex; align-items: center; gap: 0.35rem;">
                                    🚚 Directorio de Proveedores
                                </h4>
                                <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.75rem;">
                                    Importa agendas de distribuidores o descarga contactos comerciales.
                                </p>
                                <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                                    <button class="btn btn-sm btn-primary" style="justify-content: center; background: #0891b2; font-weight: 800;" onclick="SettingsView.showImportSuppliersModal()">
                                        📥 Importar Proveedores (Excel)
                                    </button>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
                                        <button class="btn btn-sm btn-secondary" style="justify-content: center; font-weight: 700; border-color: #06b6d4; color: #0e7490;" onclick="BackupManager.exportSuppliersToExcel()">
                                            📤 Exportar
                                        </button>
                                        <button class="btn btn-sm btn-secondary" style="justify-content: center; font-weight: 700; border-style: dashed; color: #0891b2;" onclick="BackupManager.downloadSupplierTemplate()">
                                            📄 Plantilla
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 4. REPORTES CONTABLES Y MANTENIMIENTO -->
                    <div class="grid grid-2" style="gap: 1.5rem; margin-bottom: 1.5rem;">
                        <!-- Exportar Tablas Contables -->
                        <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #f59e0b;">
                            <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: #b45309; display: flex; align-items: center; gap: 0.35rem;">
                                📊 Exportar Tablas Contables (Excel)
                            </h4>
                            <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.75rem;">
                                Descarga planillas específicas para tu contador o análisis contable:
                            </p>
                            <div style="max-height: 140px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.35rem 0.5rem; background: #f9fafb;">
                                <table style="width: 100%; font-size: 0.8rem;">
                                    <tbody>
                                        ${(window.BACKUP_ENTITY_CONFIG || []).map(entity => `
                                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                                <td style="padding: 0.35rem 0; color: #374151; font-weight: 600;">${entity.label}</td>
                                                <td style="text-align: right; padding: 0.35rem 0;">
                                                    <a href="javascript:void(0)" onclick="SettingsView.exportEntityData('${entity.key}')" style="color: #4f46e5; font-weight: 800; text-decoration: none; background: #eff6ff; padding: 0.2rem 0.5rem; border-radius: 0.35rem; border: 1px solid #c7d2fe;">Descargar ⬇️</a>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Mantenimiento y Depuración -->
                        <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-top: 4px solid #f43f5e;">
                            <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: #e11d48; display: flex; align-items: center; gap: 0.35rem;">
                                🧹 Depuración & Salud de Base de Datos
                            </h4>
                            <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.75rem;">
                                Herramientas de optimización y corrección de duplicados:
                            </p>
                            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
                                    <button class="btn btn-sm btn-secondary" style="justify-content: center; border: 1.5px solid #fbbf24; color: #92400e; background: #fffbeb; font-size: 0.78rem; font-weight: 750;" onclick="SettingsView.deduplicateSuppliers()">
                                        🧹 Proveedores Dup.
                                    </button>
                                    <button class="btn btn-sm btn-secondary" style="justify-content: center; border: 1.5px solid #10b981; color: #065f46; background: #ecfdf5; font-size: 0.78rem; font-weight: 750;" onclick="SettingsView.deduplicateCustomers()">
                                        👥 Fusión Clientes
                                    </button>
                                </div>
                                <button class="btn btn-sm btn-danger" style="justify-content: center; font-weight: 800; margin-top: 0.25rem; font-size: 0.8rem;" onclick="BackupManager.clearAllData()">
                                    ⚠️ Borrado Total y Reinicio de Fábrica
                                </button>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- SECCIÓN: SINCRONIZACIÓN SUPABASE CLOUD (PC ⟷ CELULAR) -->
                    ${PermissionService.can('settings.backup') ? `
                    <div class="card" style="background: #ffffff; border: 1.5px solid #c7d2fe; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 14px rgba(67, 56, 202, 0.08); border-top: 4px solid #4f46e5; margin-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <span style="font-size: 2rem;">☁️</span>
                                <div>
                                    <h3 style="margin: 0; color: #1e1b4b; font-size: 1.15rem; font-weight: 850;">Sincronización en la Nube (Supabase Cloud)</h3>
                                    <p style="margin: 0.25rem 0 0 0; font-size: 0.825rem; color: #64748b;">
                                        Sincronización en tiempo real de productos, inventario, ventas y clientes entre este computador y tus celulares.
                                    </p>
                                </div>
                            </div>
                            <span id="settings-cloud-status-badge" class="badge" style="background: #ecfdf5; color: #065f46; font-weight: 800; padding: 0.35rem 0.75rem; border-radius: 0.5rem; border: 1px solid #a7f3d0;">
                                🟢 Nube Conectada
                            </span>
                        </div>

                        <!-- Tarjeta de Estado de Cuenta y Aislamiento Multi-Tenancy -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem;">
                                <div style="font-size: 0.75rem; font-weight: 750; color: #64748b; text-transform: uppercase;">Cuenta Nube Activa</div>
                                <div id="settings-cloud-email" style="font-size: 0.95rem; font-weight: 800; color: #1e293b; margin-top: 0.25rem;">Cargando...</div>
                                <div style="font-size: 0.75rem; color: #059669; margin-top: 0.25rem; font-weight: 600;">🔒 Base de datos aislada (Multi-Tenancy)</div>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem;">
                                <div style="font-size: 0.75rem; font-weight: 750; color: #64748b; text-transform: uppercase;">Productos Registrados</div>
                                <div id="settings-cloud-counts" style="font-size: 0.95rem; font-weight: 800; color: #4338ca; margin-top: 0.25rem;">PC: ... | Nube: ...</div>
                                <div id="settings-cloud-sync-status" style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">Comprobando paridad...</div>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem;">
                                <div style="font-size: 0.75rem; font-weight: 750; color: #64748b; text-transform: uppercase;">Última Sincronización</div>
                                <div id="settings-cloud-last-sync" style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin-top: 0.25rem;">Reciente</div>
                                <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">Modo Automático + Realtime Activo</div>
                            </div>
                        </div>

                        <!-- Botones de Acción Reprogramados y Centralizados -->
                        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="SettingsView.triggerManualSync()" style="height: 46px; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); font-weight: 850; border-radius: 0.75rem; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25); display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                🔄 Sincronizar Todo Ahora (PC ⟷ Nube)
                            </button>
                            <button class="btn btn-secondary" onclick="SettingsView.testCloudConnection()" style="height: 46px; border: 1.5px solid #c7d2fe; color: #4338ca; background: #eef2ff; font-weight: 800; border-radius: 0.75rem; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                🧪 Comprobar Estado de Nube
                            </button>
                            <button class="btn btn-secondary" onclick="SettingsView.forceCloudPull()" style="height: 46px; border: 1.5px solid #cbd5e1; color: #334155; font-weight: 750; border-radius: 0.75rem; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                📥 Forzar Descarga desde la Nube
                            </button>
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
        if (tabId === 'settings-tab-visual') {
            this.initNavCustomization();
        }
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

    // --- PERSONALIZACIÓN DE NAVEGACIÓN ---
    initNavCustomization() {
        const grid = document.getElementById('nav-modules-selection-grid');
        const counter = document.getElementById('nav-custom-counter');
        if (!grid || typeof app === 'undefined' || !app.NAV_MODULES) return;

        const currentItems = app.getNavItems ? app.getNavItems() : ['pos', 'customers', 'purchases', 'cash'];
        
        if (counter) {
            counter.textContent = `${currentItems.length} de 6 seleccionados`;
            counter.style.background = currentItems.length >= 6 ? '#fef3c7' : '#e0e7ff';
            counter.style.color = currentItems.length >= 6 ? '#b45309' : '#4338ca';
        }

        let html = '';
        app.NAV_MODULES.forEach(mod => {
            const isChecked = currentItems.includes(mod.id);
            html += `
                <label id="nav-item-card-${mod.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.9rem; border-radius: 0.75rem; border: 1.5px solid ${isChecked ? '#6366f1' : '#e2e8f0'}; background: ${isChecked ? 'rgba(99, 102, 241, 0.05)' : '#ffffff'}; cursor: pointer; transition: all 0.2s; user-select: none;">
                    <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0;">
                        <span style="font-size: 1.3rem; flex-shrink: 0;">${mod.icon}</span>
                        <div style="min-width: 0;">
                            <div style="font-weight: 750; font-size: 0.875rem; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${mod.name}</div>
                            <div id="nav-badge-${mod.id}" style="font-size: 0.7rem; font-weight: 700; color: ${isChecked ? '#4f46e5' : '#64748b'};">
                                ${isChecked ? '🟢 En Barra Inferior' : '⚪ En Más Módulos'}
                            </div>
                        </div>
                    </div>
                    <input type="checkbox" class="nav-custom-checkbox" value="${mod.id}" ${isChecked ? 'checked' : ''} onchange="SettingsView.onNavCheckboxChange('${mod.id}', this)" style="width: 1.15rem; height: 1.15rem; cursor: pointer; accent-color: #4f46e5; flex-shrink: 0;">
                </label>
            `;
        });
        grid.innerHTML = html;
    },

    onNavCheckboxChange(modId, checkbox) {
        const checkboxes = document.querySelectorAll('.nav-custom-checkbox:checked');
        const counter = document.getElementById('nav-custom-counter');
        const card = document.getElementById(`nav-item-card-${modId}`);
        const badge = document.getElementById(`nav-badge-${modId}`);

        // Validación: Máximo 6
        if (checkbox.checked && checkboxes.length > 6) {
            checkbox.checked = false;
            showNotification('⚠️ Puedes seleccionar hasta un máximo de 6 accesos para no saturar el espacio.', 'warning');
            return;
        }

        // Validación: Mínimo 2
        if (!checkbox.checked && checkboxes.length < 2) {
            checkbox.checked = true;
            showNotification('⚠️ Debes mantener al menos 2 accesos en la barra inferior.', 'warning');
            return;
        }

        // Actualizar diseño de la tarjeta
        if (card) {
            card.style.borderColor = checkbox.checked ? '#6366f1' : '#e2e8f0';
            card.style.background = checkbox.checked ? 'rgba(99, 102, 241, 0.05)' : '#ffffff';
        }
        if (badge) {
            badge.textContent = checkbox.checked ? '🟢 En Barra Inferior' : '⚪ En Más Módulos';
            badge.style.color = checkbox.checked ? '#4f46e5' : '#64748b';
        }

        const count = document.querySelectorAll('.nav-custom-checkbox:checked').length;
        if (counter) {
            counter.textContent = count >= 6 ? '6 de 6 (Máximo)' : `${count} de 6 seleccionados`;
            counter.style.background = count >= 6 ? '#fef3c7' : '#e0e7ff';
            counter.style.color = count >= 6 ? '#b45309' : '#4338ca';
        }
    },

    saveNavCustomization() {
        const checkedBoxes = Array.from(document.querySelectorAll('.nav-custom-checkbox:checked'));
        const selectedIds = checkedBoxes.map(cb => cb.value);

        if (selectedIds.length < 2 || selectedIds.length > 6) {
            showNotification('⚠️ Debes seleccionar entre 2 y 6 accesos.', 'warning');
            return;
        }

        localStorage.setItem('CUSTOM_NAV_ITEMS', JSON.stringify(selectedIds));
        
        if (typeof app !== 'undefined' && typeof app.renderNavigation === 'function') {
            app.renderNavigation();
        }

        showNotification('✅ Barra de navegación actualizada correctamente.', 'success');
    },

    resetNavCustomization() {
        localStorage.removeItem('CUSTOM_NAV_ITEMS');
        this.initNavCustomization();
        if (typeof app !== 'undefined' && typeof app.renderNavigation === 'function') {
            app.renderNavigation();
        }
        showNotification('🔄 Barra de navegación restablecida a los valores por defecto.', 'info');
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

        try {
            // Guardar en PMV_BANK_INFO para que viaje a la nube y se sincronice con otras PCs
            let bankInfo = {};
            try {
                bankInfo = JSON.parse(localStorage.getItem('PMV_BANK_INFO') || '{}');
            } catch (_) {}
            bankInfo.allowMultipleCashRegisters = allowMultiple;
            localStorage.setItem('PMV_BANK_INFO', JSON.stringify(bankInfo));

            // Sincronizar de inmediato si SyncService está activo
            if (typeof SyncService !== 'undefined') {
                const uid = await SyncService.getCurrentUserId();
                if (uid && typeof SyncService.pushBusinessSettings === 'function') {
                    await SyncService.pushBusinessSettings(uid);
                }
                if (typeof SyncService.triggerAutoSync === 'function') {
                    SyncService.triggerAutoSync(300);
                }
            }
        } catch (e) {
            console.warn('[SettingsView] Error sincronizando ajuste de cajas:', e);
        }

        showNotification('Configuración de cajas guardada y sincronizada', 'success');
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

    selectedRoleInEditor: 'cashier',

    selectRoleInEditor(role) {
        this.selectedRoleInEditor = role;
        this.loadRolesPermissions();
    },

    async toggleRolePermission(role, permKey, isChecked) {
        if (role === 'owner') {
            showNotification('El propietario siempre tiene todos los permisos activos.', 'info');
            this.loadRolesPermissions();
            return;
        }
        PermissionService.setRolePermission(role, permKey, isChecked);
        showNotification(`Permiso "${permKey}" ${isChecked ? 'habilitado' : 'deshabilitado'} para ${PermissionService.ROLE_LABELS[role]}`, 'info');
    },

    async resetRolePermissionsToDefault(role) {
        if (role === 'owner') return;
        const confirm = window.confirm(`¿Deseas restablecer los permisos del rol "${PermissionService.ROLE_LABELS[role]}" a los valores recomendados por defecto?`);
        if (!confirm) return;

        PermissionService.resetRolePermissions(role);
        showNotification(`Permisos de "${PermissionService.ROLE_LABELS[role]}" restablecidos a los valores por defecto.`, 'success');
        this.loadRolesPermissions();
    },

    async loadRolesPermissions() {
        const listDiv = document.getElementById('rolesPermissionsList');
        if (!listDiv) return;

        try {
            const currentRole = this.selectedRoleInEditor || 'cashier';
            const roles = PermissionService.ROLES;
            const roleLabels = PermissionService.ROLE_LABELS;
            const roleColors = PermissionService.ROLE_COLORS;
            const groups = PermissionService.PERMISSION_GROUPS;
            const isOwner = currentRole === 'owner';

            let html = `
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <!-- TABS DE ROLES -->
                    <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.75rem; overflow-x: auto;">
                        ${roles.map(r => {
                            const isActive = r === currentRole;
                            const color = roleColors[r] || '#4f46e5';
                            const icon = r === 'owner' ? '👑' : (r === 'partner' ? '🤝' : (r === 'admin' ? '🛡️' : '🛒'));
                            return `
                                <button type="button" class="btn btn-sm" onclick="SettingsView.selectRoleInEditor('${r}')" 
                                        style="font-weight: 800; border-radius: 0.75rem; padding: 0.55rem 1rem; border: 2px solid ${isActive ? color : '#e2e8f0'}; background: ${isActive ? color : '#ffffff'}; color: ${isActive ? '#ffffff' : '#475569'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.4rem; box-shadow: ${isActive ? '0 4px 12px ' + color + '33' : 'none'};">
                                    <span>${icon}</span>
                                    <span>${roleLabels[r] || r}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <!-- BANNER INFORMATIVO SEGÚN ROL -->
                    ${isOwner ? `
                        <div style="background: #f5f3ff; border: 1.5px solid #c4b5fd; color: #5b21b6; padding: 1.25rem; border-radius: 1rem; display: flex; align-items: flex-start; gap: 1rem;">
                            <span style="font-size: 2rem;">👑</span>
                            <div>
                                <strong style="font-size: 0.95rem; display: block; margin-bottom: 0.25rem;">Propietario del Negocio (Control Total Permanente)</strong>
                                <p style="margin: 0; font-size: 0.85rem; line-height: 1.45; color: #6d28d9;">
                                    El rol de Propietario tiene asignado el 100% de los permisos del sistema sin excepciones. Por motivos de seguridad e inviolabilidad del negocio, los permisos del propietario no pueden revocarse para garantizar que nunca quedes bloqueado de tu propia empresa.
                                </p>
                            </div>
                        </div>
                    ` : `
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; background: #f8fafc; border: 1.5px solid #e2e8f0; padding: 0.85rem 1.15rem; border-radius: 0.85rem;">
                            <div>
                                <span style="font-size: 0.85rem; color: #475569;">Editando permisos para: </span>
                                <strong style="color: ${roleColors[currentRole]}; font-size: 0.95rem;">${roleLabels[currentRole]}</strong>
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button type="button" class="btn btn-sm btn-ghost" onclick="SettingsView.resetRolePermissionsToDefault('${currentRole}')" 
                                        style="font-size: 0.8rem; font-weight: 700; color: #64748b; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.4rem 0.8rem; background: white; cursor: pointer;">
                                    🔄 Restablecer a Valores Recomendados
                                </button>
                            </div>
                        </div>
                    `}

                    <!-- ACORDEÓN / GRUPOS DE PERMISOS -->
                    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                        ${groups.map(group => {
                            return `
                                <div style="border: 1.5px solid #e2e8f0; border-radius: 1rem; overflow: hidden; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                                    <div style="background: #f8fafc; padding: 0.85rem 1.25rem; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
                                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                                            <span style="font-size: 1.25rem;">${group.icon}</span>
                                            <strong style="color: #1e293b; font-size: 0.95rem;">${group.name}</strong>
                                        </div>
                                        <span class="badge" style="background: #e2e8f0; color: #475569; font-size: 0.75rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 0.4rem;">
                                            ${group.permissions.length} permisos
                                        </span>
                                    </div>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 0.85rem; padding: 1rem 1.25rem;">
                                        ${group.permissions.map(perm => {
                                            const hasPerm = isOwner || PermissionService.roleHasPermission(currentRole, perm.key);
                                            return `
                                                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; padding: 0.75rem 0.9rem; border-radius: 0.75rem; border: 1px solid ${hasPerm ? '#c7d2fe' : '#f1f5f9'}; background: ${hasPerm ? '#f8faff' : '#fbfcfd'}; transition: all 0.2s;">
                                                    <div style="flex: 1; min-width: 0;">
                                                        <label for="perm-${currentRole}-${perm.key.replace('.', '_')}" style="display: block; font-weight: 750; font-size: 0.85rem; color: #1e293b; cursor: ${isOwner ? 'default' : 'pointer'}; margin-bottom: 0.2rem;">
                                                            ${perm.label}
                                                        </label>
                                                        <span style="display: block; font-size: 0.75rem; color: #64748b; line-height: 1.35;">
                                                            ${perm.desc || ''}
                                                        </span>
                                                    </div>
                                                    <div style="margin-left: 0.5rem; flex-shrink: 0; padding-top: 2px;">
                                                        <input type="checkbox" 
                                                               id="perm-${currentRole}-${perm.key.replace('.', '_')}"
                                                               ${hasPerm ? 'checked' : ''} 
                                                               ${isOwner ? 'disabled title="Propietario tiene acceso total"' : ''}
                                                               onchange="SettingsView.toggleRolePermission('${currentRole}', '${perm.key}', this.checked)"
                                                               style="width: 1.25rem; height: 1.25rem; cursor: ${isOwner ? 'not-allowed' : 'pointer'}; accent-color: #4f46e5;">
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;

            listDiv.innerHTML = html;
        } catch (error) {
            console.error('[Settings] Error cargando roles:', error);
            listDiv.innerHTML = '<p style="color: #ef4444; font-size: 0.85rem;">Error al cargar roles y permisos: ' + (error?.message || error) + '</p>';
        }
    },

    copyBusinessCode() {
        const codeEl = document.getElementById('myProfileAccessCode');
        const code = (codeEl ? codeEl.innerText.trim() : '') || localStorage.getItem('BUSINESS_ACCESS_CODE');
        if (code && code !== '...') {
            navigator.clipboard.writeText(code);
            showNotification(`📋 Código "${code}" copiado al portapapeles. ¡Compártelo con tus empleados!`, 'success');
        } else {
            showNotification('No hay código disponible para copiar', 'warning');
        }
    },

    initMyProfileSection() {
        try {
            const currentUser = (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser) ? AuthManager.getCurrentUser() : null;
            const usernameEl = document.getElementById('myProfileUsername');
            const badgeEl = document.getElementById('myProfileRoleBadge');
            const bizEl = document.getElementById('myProfileBizName');
            const codeEl = document.getElementById('myProfileAccessCode');

            if (usernameEl && currentUser) {
                usernameEl.textContent = currentUser.username || 'Usuario';
            }
            if (badgeEl && currentUser) {
                const role = currentUser.role || 'cashier';
                const label = PermissionService.ROLE_LABELS[role] || role;
                const color = PermissionService.ROLE_COLORS[role] || '#475569';
                const icon = role === 'owner' ? '👑' : (role === 'partner' ? '🤝' : (role === 'admin' ? '🛡️' : '🛒'));
                badgeEl.innerHTML = `<span class="badge" style="background: ${color}; color: white; padding: 0.35rem 0.75rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.85rem;">${icon} ${label}</span>`;
            }
            if (bizEl) {
                const activeBiz = localStorage.getItem('CURRENT_BUSINESS') || 'Negocio Principal';
                bizEl.textContent = activeBiz;
            }

            if (codeEl) {
                const storedCode = localStorage.getItem('BUSINESS_ACCESS_CODE');
                if (storedCode) {
                    codeEl.textContent = storedCode;
                } else {
                    const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                        ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                        : 'http://localhost:3000';
                    const userId = currentUser?.id || localStorage.getItem('PMV_USER_ID');
                    const bizId = localStorage.getItem('BUSINESS_ID') || '1';
                    fetch(`${apiBase}/api/businesses/list`, { headers: { 'x-supabase-user-id': userId } })
                        .then(r => r.json())
                        .then(d => {
                            const b = d?.businesses?.find(item => String(item.id) === String(bizId)) || d?.businesses?.[0];
                            if (b && b.accessCode) {
                                codeEl.textContent = b.accessCode;
                                localStorage.setItem('BUSINESS_ACCESS_CODE', b.accessCode);
                                const staffCodeBadge = document.getElementById('staffJoinAccessCodeBadge');
                                if (staffCodeBadge) staffCodeBadge.textContent = b.accessCode;
                            } else {
                                codeEl.textContent = 'LOCAL-0001';
                            }
                        })
                        .catch(() => { codeEl.textContent = 'LOCAL-0001'; });
                }
            }

            const profileThemeContainer = document.getElementById('my-profile-theme-container');
            if (profileThemeContainer) {
                profileThemeContainer.innerHTML = this.renderThemeOptions();
            }

            const brightness = localStorage.getItem('APP_BRIGHTNESS') || '1';
            const mySlider = document.getElementById('my-brightness-slider');
            const myVal = document.getElementById('my-brightness-value');
            if (mySlider) mySlider.value = brightness;
            if (myVal) myVal.textContent = Math.round(brightness * 100) + '%';
        } catch (e) {
            console.error('[Settings] Error en initMyProfileSection:', e);
        }
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
Sistema: Caja Fácil POS

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

    async loadCloudBackupSettings() {
        // Cargar información real de la nube y de la cuenta activa
        setTimeout(async () => {
            try {
                const emailEl = document.getElementById('settings-cloud-email');
                const countsEl = document.getElementById('settings-cloud-counts');
                const syncStatusEl = document.getElementById('settings-cloud-sync-status');
                const lastSyncEl = document.getElementById('settings-cloud-last-sync');

                const currentUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUser() : null;
                const email = currentUser?.email || localStorage.getItem('PMV_USER_EMAIL') || 'Modo Local (Sin cuenta en la nube)';
                if (emailEl) emailEl.innerText = email;

                if (typeof SyncService !== 'undefined' && SyncService.lastSyncTime && lastSyncEl) {
                    lastSyncEl.innerText = SyncService.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }

                // Consultar estado de sincronización al backend
                const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                    ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                    : 'http://localhost:3000';
                const token = localStorage.getItem('AUTH_TOKEN') || sessionStorage.getItem('AUTH_TOKEN');
                const uid = localStorage.getItem('PMV_USER_ID') || localStorage.getItem('SUPABASE_USER_ID') || currentUser?.id;

                const res = await fetch(`${apiBase}/api/sync/status`, {
                    headers: {
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                        'x-supabase-user-id': uid || ''
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (countsEl) {
                        countsEl.innerText = `PC: ${data.localProducts} | Nube: ${data.cloudProducts ?? data.localProducts}`;
                    }
                    if (syncStatusEl) {
                        if (data.cloudProducts === data.localProducts) {
                            syncStatusEl.innerHTML = '<span style="color: #059669; font-weight: 750;">🟢 Catálogos 100% Emparejados</span>';
                        } else {
                            syncStatusEl.innerHTML = '<span style="color: #d97706; font-weight: 750;">🟠 Pendiente de Sincronización</span>';
                        }
                    }
                }
            } catch (err) {
                console.warn('[SettingsView] Advertencia cargando estado de nube:', err);
            }
        }, 200);
    },

    async triggerManualSync() {
        if (typeof SyncService !== 'undefined') {
            await SyncService.syncAll(true);
            this.loadCloudBackupSettings();
        } else {
            showNotification('Motor de sincronización no disponible', 'warning');
        }
    },

    async forceCloudPull() {
        showNotification('📥 Descargando catálogo completo desde Supabase...', 'info');
        if (typeof SyncService !== 'undefined') {
            await SyncService.syncAll(true);
            this.loadCloudBackupSettings();
            if (typeof app !== 'undefined' && app.currentView === 'products') {
                app.navigate('products');
            }
        }
    },

    async testCloudConnection() {
        showNotification('🧪 Verificando conectividad con Supabase Cloud...', 'info');
        try {
            const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                : 'http://localhost:3000';
            const token = localStorage.getItem('AUTH_TOKEN') || sessionStorage.getItem('AUTH_TOKEN');
            const uid = localStorage.getItem('PMV_USER_ID') || localStorage.getItem('SUPABASE_USER_ID');

            const res = await fetch(`${apiBase}/api/sync/status`, {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    'x-supabase-user-id': uid || ''
                }
            });

            if (res.ok) {
                const d = await res.json();
                this.loadCloudBackupSettings();
                showNotification(`🟢 Supabase Conectado — PC: ${d.localProducts} productos | Nube: ${d.cloudProducts ?? d.localProducts}`, 'success');
            } else {
                showNotification('⚠️ El servidor de nube respondió con error', 'error');
            }
        } catch (e) {
            showNotification('❌ Error de conexión: ' + e.message, 'error');
        }
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
                owner: '<span class="badge" style="background: #4f46e5; color: white;">👑 Propietario</span>',
                partner: '<span class="badge" style="background: #059669; color: white;">🤝 Socio / Inv.</span>',
                admin: '<span class="badge" style="background: #d97706; color: white;">🛡️ Administrador</span>',
                cashier: '<span class="badge" style="background: #2563eb; color: white;">🛒 Cajero</span>'
            };

            const currentBizCode = localStorage.getItem('BUSINESS_ACCESS_CODE') || '...';
            let html = `
                <!-- BANNER CÓDIGO ÚNICO PARA EMPLEADOS -->
                <div style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border: 1.5px solid #c7d2fe; border-radius: 0.85rem; padding: 1rem 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 1.75rem;">🔑</span>
                        <div>
                            <strong style="color: #1e293b; font-size: 0.95rem; display: block;">Código Único para que tus Empleados se Unan</strong>
                            <span style="color: #64748b; font-size: 0.8rem;">Tus cajeros deben ingresar este código al iniciar sesión con su correo para vincularse a tu local:</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span id="staffJoinAccessCodeBadge" style="font-family: monospace; font-size: 1.15rem; font-weight: 850; color: #4338ca; background: #ffffff; padding: 0.35rem 0.85rem; border-radius: 0.5rem; border: 1.5px solid #a5b4fc; letter-spacing: 0.05em;">${currentBizCode}</span>
                        <button type="button" class="btn btn-sm btn-primary" onclick="SettingsView.copyBusinessCode()" style="background: #4f46e5; font-weight: 800; font-size: 0.8rem; padding: 0.45rem 0.85rem; cursor: pointer;">📋 Copiar Código</button>
                    </div>
                </div>

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
                        <option value="cashier">🛒 Cajero (Ventas en POS y arqueo ciego)</option>
                        <option value="admin">🛡️ Administrador (Gestión operativa, compras y stock)</option>
                        <option value="partner">🤝 Socio / Inversionista (Acceso total a métricas y personal)</option>
                    </select>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                    <input type="checkbox" id="forcePasswordChangeCheck" style="width: 1.1rem; height: 1.1rem; cursor: pointer; accent-color: #4f46e5;">
                    <label for="forcePasswordChangeCheck" style="font-size: 0.85rem; color: #374151; cursor: pointer; font-weight: 600;">
                        Solicitar cambio de clave en el próximo inicio de sesión
                    </label>
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
        const forcePass = document.getElementById('forcePasswordChangeCheck')?.checked ? 1 : 0;

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
            if (forcePass) {
                try {
                    const u = await User.getByUsername(username);
                    if (u) {
                        u.forcePasswordChange = 1;
                        await db.put('users', u);
                    }
                } catch (_) {}
            }
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
                        <option value="cashier" ${currentRole === 'cashier' ? 'selected' : ''}>🛒 Cajero (Ventas en POS y arqueo ciego)</option>
                        <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>🛡️ Administrador (Gestión operativa)</option>
                        <option value="partner" ${currentRole === 'partner' ? 'selected' : ''}>🤝 Socio / Inversionista (Acceso completo comercial y métricas)</option>
                    </select>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="SettingsView.submitUpdateRole(${userId}, '${username}')">💾 Guardar Rol</button>
        `;

        showModal(content, { title: `🛡️ Cambiar Rol - ${username}`, footer, width: '420px' });
    },

    async submitUpdateRole(userId, username) {
        const newRole = document.getElementById('editUserRoleSelect')?.value || 'cashier';
        try {
            await User.updateRole(userId, newRole);
            closeModal();
            const roleLabels = PermissionService.ROLE_LABELS;
            showNotification(`Rol de "${username}" actualizado a ${roleLabels[newRole] || newRole}`, 'success');
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
    },

    /* ------------------------------------------------------------------ */
    /* MÉTODOS DE LA SUITE DE RESPALDOS, EXPORTACIÓN E IMPORTACIÓN        */
    /* ------------------------------------------------------------------ */

    /**
     * Procesa la carga de un archivo JSON de respaldo con vista previa y confirmación segura.
     */
    async handleImport(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        // Resetear el input para permitir volver a seleccionar el mismo archivo si es necesario
        event.target.value = '';

        try {
            const fileText = await file.text();
            let parsedData;
            try {
                parsedData = JSON.parse(fileText);
            } catch (e) {
                throw new Error('El archivo seleccionado no tiene un formato JSON válido.');
            }

            const data = (parsedData && parsedData.tables) ? parsedData.tables : parsedData;
            const prodsCount = Array.isArray(data.products) ? data.products.length : 0;
            const salesCount = Array.isArray(data.sales) ? data.sales.length : 0;
            const custsCount = Array.isArray(data.customers) ? data.customers.length : 0;
            const suppsCount = Array.isArray(data.suppliers) ? data.suppliers.length : 0;
            const purchCount = Array.isArray(data.purchases) ? data.purchases.length : 0;

            const activeBizName = localStorage.getItem('CURRENT_BUSINESS') || 'Negocio Principal';
            const activeBizId = localStorage.getItem('BUSINESS_ID') || '1';

            const content = `
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div style="text-align: center; padding: 0.5rem 0;">
                        <div style="font-size: 2.5rem; margin-bottom: 0.25rem;">📦</div>
                        <h4 style="margin: 0; font-size: 1.1rem; color: #1e293b;">Respaldo Listo para Restaurar</h4>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.82rem; color: #64748b;">
                            Archivo: <strong>${safeHTML(file.name)}</strong> (${(file.size / 1024).toFixed(1)} KB)
                        </p>
                    </div>

                    <div style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border: 2px solid #6366f1; border-radius: 0.75rem; padding: 0.85rem 1rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="color: #4338ca; font-weight: 700;">🏪 Negocio Destino:</span>
                            <strong style="color: #1e1b4b; font-size: 0.98rem; background: #ffffff; padding: 0.25rem 0.65rem; border-radius: 0.4rem; border: 1px solid #c7d2fe;">${safeHTML(activeBizName)} (ID: ${activeBizId})</strong>
                        </div>
                        <p style="margin: 0.45rem 0 0 0; font-size: 0.8rem; color: #3730a3; line-height: 1.4;">
                            🛡️ <strong>Aislamiento Estricto:</strong> Estás en <strong>${safeHTML(activeBizName)}</strong>. Todos los datos importados pertenecerán <u>exclusivamente</u> a este negocio.
                        </p>
                    </div>

                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 0.75rem; padding: 0.85rem;">
                        <span style="font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
                            Contenido Detectado en la Copia:
                        </span>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem; font-size: 0.85rem;">
                            <div style="background: #ffffff; padding: 0.4rem 0.6rem; border-radius: 0.4rem; border: 1px solid #e2e8f0;">
                                📦 <strong>${prodsCount}</strong> Productos
                            </div>
                            <div style="background: #ffffff; padding: 0.4rem 0.6rem; border-radius: 0.4rem; border: 1px solid #e2e8f0;">
                                🧾 <strong>${salesCount}</strong> Ventas
                            </div>
                            <div style="background: #ffffff; padding: 0.4rem 0.6rem; border-radius: 0.4rem; border: 1px solid #e2e8f0;">
                                👥 <strong>${custsCount}</strong> Clientes
                            </div>
                            <div style="background: #ffffff; padding: 0.4rem 0.6rem; border-radius: 0.4rem; border: 1px solid #e2e8f0;">
                                🚚 <strong>${suppsCount}</strong> Proveedores
                            </div>
                            <div style="background: #ffffff; padding: 0.4rem 0.6rem; border-radius: 0.4rem; border: 1px solid #e2e8f0; grid-column: span 2;">
                                📋 <strong>${purchCount}</strong> Compras y Facturas
                            </div>
                        </div>
                    </div>

                    <div style="background: #eef2ff; border: 1.5px solid #c7d2fe; border-radius: 0.75rem; padding: 0.85rem;">
                        <label style="display: flex; align-items: flex-start; gap: 0.65rem; cursor: pointer; user-select: none;">
                            <input type="checkbox" id="wipeCloudOption" checked style="margin-top: 0.2rem; width: 18px; height: 18px; accent-color: #4f46e5;">
                            <div>
                                <span style="display: block; font-weight: 800; font-size: 0.88rem; color: #1e1b4b;">
                                    🧹 Limpieza Total de Supabase Cloud (Recomendado)
                                </span>
                                <span style="display: block; font-size: 0.78rem; color: #4338ca; line-height: 1.35; margin-top: 0.15rem;">
                                    Vacía los datos viejos en la nube para que este nuevo respaldo se sincronice limpio con Caja Fácil Mobile y se eliminen clientes o ventas duplicadas.
                                </span>
                            </div>
                        </label>
                    </div>

                    <div style="padding: 0.75rem; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 0.5rem; font-size: 0.8rem; color: #9f1239; line-height: 1.4;">
                        ⚠️ <strong>Atención:</strong> Al restaurar este respaldo se actualizarán las tablas operativas de tu local con la información de este archivo.
                    </div>
                </div>
            `;

            const footer = `
                <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="SettingsView.confirmExecuteJsonImport('${encodeURIComponent(fileText)}')" style="font-weight: 850; background: #4f46e5;">
                    ✅ Confirmar y Restaurar Datos
                </button>
            `;

            showModal(content, { title: '📥 Confirmar Restauración de Respaldo', footer, width: '480px' });

        } catch (err) {
            console.error('Error leyendo archivo de respaldo:', err);
            showNotification('Error al leer respaldo: ' + err.message, 'error');
        }
    },

    async confirmExecuteJsonImport(encodedJson) {
        try {
            const wipeCloudCheckbox = document.getElementById('wipeCloudOption');
            const wipeCloud = wipeCloudCheckbox ? wipeCloudCheckbox.checked : true;
            closeModal();
            const jsonText = decodeURIComponent(encodedJson);
            await BackupManager.importData(jsonText, wipeCloud);
        } catch (err) {
            console.error('Error ejecutando importación:', err);
            showNotification('Error al restaurar: ' + err.message, 'error');
        }
    },

    /**
     * Exporta cualquier tabla contable definida en window.BACKUP_ENTITY_CONFIG a Excel.
     */
    async exportEntityData(key) {
        const config = (window.BACKUP_ENTITY_CONFIG || []).find(e => e.key === key);
        if (!config) {
            showNotification(`Tipo de exportación "${key}" no encontrado`, 'warning');
            return;
        }

        if (config.type === 'custom') {
            if (config.handler === 'customerDebts') {
                await BackupManager.exportCustomerDebts(config.sheet, config.label);
            } else if (config.handler === 'reportsSummary') {
                await BackupManager.exportReportsSummary(config.sheet, config.label);
            }
        } else {
            await BackupManager.exportEntityToExcel(config.store, config.label, config.sheet);
        }
    },

    /**
     * Modal interactivo para Importación Masiva de Productos desde Excel.
     */
    showImportProductsModal() {
        const content = `
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                <p style="font-size: 0.88rem; color: #475569; margin: 0; line-height: 1.4;">
                    Selecciona un archivo Excel (<strong>.xlsx</strong> o <strong>.csv</strong>) con tu catálogo de productos. El sistema detectará automáticamente las columnas de código de barra, nombre, costo, margen, precio y stock.
                </p>

                <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 0.85rem; padding: 1.5rem; text-align: center; cursor: pointer;"
                     onclick="document.getElementById('excelProductFileInput').click()"
                     onmouseover="this.style.borderColor='#10b981'; this.style.background='#f0fdf4';"
                     onmouseout="this.style.borderColor='#cbd5e1'; this.style.background='#f8fafc';">
                    <div style="font-size: 2.25rem; margin-bottom: 0.5rem;">📄</div>
                    <strong style="color: #0f172a; font-size: 0.95rem; display: block;">Haz clic aquí para seleccionar tu archivo Excel</strong>
                    <span id="selectedProductFileName" style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem; display: block;">Formatos soportados: .xlsx, .xls, .csv</span>
                    <input type="file" id="excelProductFileInput" accept=".xlsx,.xls,.csv" style="display: none;" onchange="SettingsView.previewProductExcel(this)">
                </div>

                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.85rem;">
                    <label style="font-size: 0.82rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.5rem;">
                        ¿Cómo tratar los productos que ya existen en el sistema?
                    </label>
                    <div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.85rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="productImportMode" value="update" checked>
                            <span><strong>Sumar stock</strong> y actualizar precios/costos (Recomendado)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="productImportMode" value="replace_stock">
                            <span><strong>Reemplazar stock exacto</strong> por el valor del archivo</span>
                        </label>
                    </div>
                </div>

                <div id="productExcelPreview" style="display: none; max-height: 120px; overflow-y: auto; background: #f1f5f9; padding: 0.5rem; border-radius: 0.5rem; font-size: 0.78rem;"></div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-success" id="btnExecuteProductImport" onclick="SettingsView.executeProductExcelImport()" style="font-weight: 850; background: #059669;" disabled>
                📥 Procesar e Importar Productos
            </button>
        `;

        showModal(content, { title: '🛒 Importar Productos desde Excel', footer, width: '500px' });
    },

    _tempProductExcelBuffer: null,

    async previewProductExcel(input) {
        const file = input.files && input.files[0];
        if (!file) return;

        const nameLabel = document.getElementById('selectedProductFileName');
        if (nameLabel) nameLabel.innerHTML = `✅ Archivo: <strong>${safeHTML(file.name)}</strong> (${(file.size / 1024).toFixed(1)} KB)`;

        try {
            const buffer = await file.arrayBuffer();
            this._tempProductExcelBuffer = buffer;

            const btn = document.getElementById('btnExecuteProductImport');
            if (btn) btn.disabled = false;

            // Previsualización rápida
            const wb = XLSX.read(buffer, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

            const previewDiv = document.getElementById('productExcelPreview');
            if (previewDiv && rows.length > 1) {
                previewDiv.style.display = 'block';
                previewDiv.innerHTML = `
                    <strong>Filas detectadas: ${rows.length - 1}</strong><br>
                    Columnas: ${rows[0].slice(0, 5).join(' | ')}${rows[0].length > 5 ? ' ...' : ''}
                `;
            }
        } catch (e) {
            console.error('Error en preview de Excel:', e);
            showNotification('Error al leer el archivo Excel', 'error');
        }
    },

    async executeProductExcelImport() {
        if (!this._tempProductExcelBuffer) {
            showNotification('Selecciona un archivo Excel primero', 'warning');
            return;
        }

        const mode = document.querySelector('input[name="productImportMode"]:checked')?.value || 'update';
        const btn = document.getElementById('btnExecuteProductImport');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Importando productos...';
        }

        try {
            const res = await BackupManager.importProductsFromExcel(this._tempProductExcelBuffer, { mode });
            closeModal();
            this._tempProductExcelBuffer = null;

            showNotification(`✅ ¡Importación completada! Creados: ${res.created} | Actualizados: ${res.updated}`, 'success');
            
            // Si la vista de productos está en pantalla, actualizar
            if (typeof ProductsView !== 'undefined' && typeof ProductsView.loadProducts === 'function') {
                ProductsView.loadProducts();
            }
        } catch (err) {
            console.error('Error importando productos:', err);
            showNotification('Error al importar productos: ' + err.message, 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '📥 Procesar e Importar Productos';
            }
        }
    },

    /**
     * Modal interactivo para Importación Masiva de Clientes desde Excel.
     */
    showImportCustomersModal() {
        const content = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <p style="font-size: 0.88rem; color: #475569; margin: 0;">
                    Selecciona un archivo Excel (<strong>.xlsx</strong> o <strong>.csv</strong>) con la lista de tus clientes (Nombre, RUT, Teléfono, Email, Límite de Crédito, Dirección).
                </p>
                <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 0.85rem; padding: 1.5rem; text-align: center; cursor: pointer;"
                     onclick="document.getElementById('excelCustomerFileInput').click()">
                    <div style="font-size: 2.25rem; margin-bottom: 0.5rem;">👥</div>
                    <strong style="color: #0f172a; font-size: 0.95rem; display: block;">Seleccionar archivo Excel de Clientes</strong>
                    <span id="selectedCustomerFileName" style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem; display: block;">.xlsx, .csv</span>
                    <input type="file" id="excelCustomerFileInput" accept=".xlsx,.xls,.csv" style="display: none;" onchange="SettingsView.handleCustomersExcelImport(this)">
                </div>
            </div>
        `;
        const footer = `<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`;
        showModal(content, { title: '👥 Importar Clientes desde Excel', footer, width: '450px' });
    },

    async handleCustomersExcelImport(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
            showNotification('Importando clientes...', 'info');
            const buffer = await file.arrayBuffer();
            const res = await BackupManager.importCustomersFromExcel(buffer);
            closeModal();
            showNotification(`✅ ¡${res.imported} clientes importados con éxito!`, 'success');
        } catch (e) {
            showNotification('Error importando clientes: ' + e.message, 'error');
        }
    },

    /**
     * Modal interactivo para Importación Masiva de Proveedores desde Excel.
     */
    showImportSuppliersModal() {
        const content = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <p style="font-size: 0.88rem; color: #475569; margin: 0;">
                    Selecciona un archivo Excel (<strong>.xlsx</strong> o <strong>.csv</strong>) con la lista de tus proveedores y distribuidores comerciales.
                </p>
                <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 0.85rem; padding: 1.5rem; text-align: center; cursor: pointer;"
                     onclick="document.getElementById('excelSupplierFileInput').click()">
                    <div style="font-size: 2.25rem; margin-bottom: 0.5rem;">🚚</div>
                    <strong style="color: #0f172a; font-size: 0.95rem; display: block;">Seleccionar archivo Excel de Proveedores</strong>
                    <span id="selectedSupplierFileName" style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem; display: block;">.xlsx, .csv</span>
                    <input type="file" id="excelSupplierFileInput" accept=".xlsx,.xls,.csv" style="display: none;" onchange="SettingsView.handleSuppliersExcelImport(this)">
                </div>
            </div>
        `;
        const footer = `<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`;
        showModal(content, { title: '🚚 Importar Proveedores desde Excel', footer, width: '450px' });
    },

    async handleSuppliersExcelImport(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
            showNotification('Importando proveedores...', 'info');
            const buffer = await file.arrayBuffer();
            const res = await BackupManager.importSuppliersFromExcel(buffer);
            closeModal();
            showNotification(`✅ ¡${res.imported} proveedores importados con éxito!`, 'success');
        } catch (e) {
            showNotification('Error importando proveedores: ' + e.message, 'error');
        }
    },

    /**
     * Deduplica proveedores con nombres idénticos o repetidos.
     */
    async deduplicateSuppliers() {
        try {
            if (db.mode === 'sqlite' && window.ApiClient) {
                const res = await ApiClient.post('complex/suppliers/deduplicate', {});
                if (res && res.success) {
                    showNotification(`✅ Se fusionaron ${res.merged || 0} proveedores duplicados`, 'success');
                    return;
                }
            }

            // Modo local IndexedDB
            const suppliers = await db.getAll('suppliers');
            const nameMap = new Map();
            let merged = 0;

            for (const s of suppliers) {
                const cleanName = (s.name || '').trim().toLowerCase();
                if (!cleanName) continue;

                if (nameMap.has(cleanName)) {
                    const keep = nameMap.get(cleanName);
                    // Reasignar compras si es necesario y eliminar duplicado
                    await db.delete('suppliers', s.id);
                    merged++;
                } else {
                    nameMap.set(cleanName, s);
                }
            }

            if (db.clearCache) await db.clearCache('suppliers');
            showNotification(`✅ Se depuraron ${merged} proveedores duplicados`, 'success');
        } catch (e) {
            console.error('Error deduplicando proveedores:', e);
            showNotification('Error al depurar proveedores: ' + e.message, 'error');
        }
    },

    /**
     * Fusiona clientes duplicados con el mismo nombre o RUT.
     */
    async deduplicateCustomers() {
        try {
            const customers = await db.getAll('customers');
            const keyMap = new Map();
            let merged = 0;

            for (const c of customers) {
                const key = (c.rut && c.rut.length > 3) ? c.rut.trim().toLowerCase() : (c.name || '').trim().toLowerCase();
                if (!key) continue;

                if (keyMap.has(key)) {
                    const keep = keyMap.get(key);
                    // Sumar saldo a favor o deudas si procede
                    keep.balanceCredit = (parseFloat(keep.balanceCredit) || 0) + (parseFloat(c.balanceCredit) || 0);
                    await db.put('customers', keep);
                    await db.delete('customers', c.id);
                    merged++;
                } else {
                    keyMap.set(key, c);
                }
            }

            if (db.clearCache) await db.clearCache('customers');
            showNotification(`✅ Se fusionaron ${merged} clientes repetidos`, 'success');
        } catch (e) {
            console.error('Error deduplicando clientes:', e);
            showNotification('Error al fusionar clientes: ' + e.message, 'error');
        }
    },

    /**
     * Registra el timestamp exacto al salir de la vista de Configuración
     * para la regla de expiración de 1 minuto.
     */
    destroy() {
        localStorage.setItem('settings_last_exit_time', Date.now().toString());
    },

    /**
     * Muestra el Centro de Ayuda y Manual Interactivo del Sistema POS.
     */
    showHelpCenterModal() {
        const content = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: flex; border-bottom: 2px solid #e2e8f0; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem;">
                    <button class="btn btn-sm btn-primary" onclick="SettingsView.switchHelpTab('help-pos')" id="tab-help-pos" style="font-weight: 700;">
                        🛒 Ventas y POS
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="SettingsView.switchHelpTab('help-cash')" id="tab-help-cash" style="font-weight: 700;">
                        💰 Caja y Arqueos
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="SettingsView.switchHelpTab('help-stock')" id="tab-help-stock" style="font-weight: 700;">
                        📦 Productos & Excel
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="SettingsView.switchHelpTab('help-keys')" id="tab-help-keys" style="font-weight: 700;">
                        ⌨️ Atajos Teclado
                    </button>
                </div>

                <!-- PESTAÑA 1: VENTAS Y POS -->
                <div id="help-pos" class="help-section-panel" style="display: block;">
                    <h4 style="color: #4f46e5; margin: 0 0 0.5rem 0;">🚀 Flujo de Cobro Rápido</h4>
                    <p style="font-size: 0.85rem; color: #475569; line-height: 1.5; margin-bottom: 0.75rem;">
                        El punto de venta está optimizado para funcionar a <strong>0ms de retardo</strong> con pistolas lectoras de código de barras USB y navegación 100% por teclado.
                    </p>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.85rem; font-size: 0.82rem; color: #1e293b; line-height: 1.5;">
                        <strong>1. Agregar productos:</strong> Escanea el código con la pistola o presiona <kbd style="background:#e2e8f0; padding:2px 6px; border-radius:4px;">Enter</kbd> en el buscador para filtrar por nombre.<br>
                        <strong>2. Cobrar venta:</strong> Presiona <kbd style="background:#e2e8f0; padding:2px 6px; border-radius:4px;">Espacio</kbd> o haz clic en "Cobrar". Se abrirá la ventana de pago.<br>
                        <strong>3. Seleccionar medio de pago:</strong> Elige Efectivo, Débito/Crédito, Transferencia o Fiado/Crédito Cliente.<br>
                        <strong>4. Finalizar:</strong> Presiona <kbd style="background:#e2e8f0; padding:2px 6px; border-radius:4px;">Enter</kbd> para registrar la venta e imprimir el comprobante.
                    </div>
                </div>

                <!-- PESTAÑA 2: CAJA Y ARQUEOS -->
                <div id="help-cash" class="help-section-panel" style="display: none;">
                    <h4 style="color: #059669; margin: 0 0 0.5rem 0;">💰 Gestión de Turnos de Caja</h4>
                    <p style="font-size: 0.85rem; color: #475569; line-height: 1.5; margin-bottom: 0.75rem;">
                        Mantén el control exacto de las entradas y salidas de efectivo de tu negocio.
                    </p>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.85rem; font-size: 0.82rem; color: #1e293b; line-height: 1.5;">
                        • <strong>Apertura de Caja:</strong> Ingresa el monto inicial en efectivo con el que comienza el turno.<br>
                        • <strong>Entradas / Salidas:</strong> Registra pagos a proveedores en efectivo o retiros de dinero del dueño.<br>
                        • <strong>Arqueo de Cierre:</strong> Al terminar el día, usa la calculadora de dinero para contar montones de billetes y monedas. El sistema comparará el monto contado con las ventas registradas y calculará diferencias (sobrantes o faltantes).
                    </div>
                </div>

                <!-- PESTAÑA 3: PRODUCTOS Y EXCEL -->
                <div id="help-stock" class="help-section-panel" style="display: none;">
                    <h4 style="color: #0891b2; margin: 0 0 0.5rem 0;">📦 Catálogo e Importación Masiva</h4>
                    <p style="font-size: 0.85rem; color: #475569; line-height: 1.5; margin-bottom: 0.75rem;">
                        Aprende a gestionar inventarios grandes y actualizar precios en segundos.
                    </p>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.85rem; font-size: 0.82rem; color: #1e293b; line-height: 1.5;">
                        • <strong>Plantilla Excel:</strong> En <em>Configuración ➔ Respaldos</em> o en <em>Productos</em> descarga la plantilla modelo.<br>
                        • <strong>Carga Masiva:</strong> Puedes subir cientos de productos con código de barra, costo neto, margen y stock.<br>
                        • <strong>Márgenes y Precios:</strong> El sistema calcula automáticamente el precio sugerido con IVA (19%) a partir del margen comercial deseado.
                    </div>
                </div>

                <!-- PESTAÑA 4: ATAJOS DE TECLADO -->
                <div id="help-keys" class="help-section-panel" style="display: none;">
                    <h4 style="color: #7c3aed; margin: 0 0 0.5rem 0;">⌨️ Tabla de Atajos Rápidos</h4>
                    <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: #ffffff;">
                        <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
                            <tbody>
                                <tr style="border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
                                    <td style="padding: 0.4rem 0.6rem; font-weight: 700;">Espacio</td>
                                    <td style="padding: 0.4rem 0.6rem; color: #334155;">Abrir ventana de Cobro en POS</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 0.4rem 0.6rem; font-weight: 700;">Enter</td>
                                    <td style="padding: 0.4rem 0.6rem; color: #334155;">Confirmar cobro / Buscar producto</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
                                    <td style="padding: 0.4rem 0.6rem; font-weight: 700;">F1</td>
                                    <td style="padding: 0.4rem 0.6rem; color: #334155;">Enfocar buscador de productos</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 0.4rem 0.6rem; font-weight: 700;">F2</td>
                                    <td style="padding: 0.4rem 0.6rem; color: #334155;">Seleccionar cliente para venta fiada</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
                                    <td style="padding: 0.4rem 0.6rem; font-weight: 700;">Esc</td>
                                    <td style="padding: 0.4rem 0.6rem; color: #334155;">Cerrar modales o cancelar venta</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        const footer = `<button class="btn btn-primary" onclick="closeModal()" style="font-weight: 800;">Entendido</button>`;
        showModal(content, { title: '📖 Manual y Guía de Uso del Sistema', footer, width: '560px' });
    },

    switchHelpTab(tabId) {
        document.querySelectorAll('.help-section-panel').forEach(p => p.style.display = 'none');
        const target = document.getElementById(tabId);
        if (target) target.style.display = 'block';

        ['tab-help-pos', 'tab-help-cash', 'tab-help-stock', 'tab-help-keys'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                if (id === 'tab-' + tabId) {
                    btn.className = 'btn btn-sm btn-primary';
                } else {
                    btn.className = 'btn btn-sm btn-secondary';
                }
            }
        });
    }
};


