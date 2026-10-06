/**
 * LoadingPipelineModal - Componente Universal de Carga de Procesos Pesados
 * Rediseño Prémium Glassmorphism Dark (Estilo Enterprise POS / Linear)
 * Cápsulas horizontales interconectadas, barra shimmer neón y cintillo dinámico de seguridad.
 * Autor: Caja Fácil POS Pro Architecture
 */
const LoadingPipelineModal = {
    modalEl: null,
    currentConfig: null,
    _tipInterval: null,
    _currentTipIndex: 0,
    _tips: [
        '🛡️ Integridad garantizada: transacciones ACID y verificación de estructura.',
        '⚡ Optimizando SQLite local para consultas y ventas en menos de 10ms.',
        '🔒 Tus productos, clientes y finanzas están protegidos en tu almacenamiento local.',
        '☁️ Arquitectura Offline-First: continúa vendiendo sin interrupciones si no hay internet.',
        '🚀 Reconstruyendo índices para maximizar la velocidad de cobro en el POS.'
    ],

    /**
     * Muestra el modal de carga con las etapas configuradas
     * @param {Object} options
     * @param {string} options.title Título del proceso (Ej: 'Restauración del Sistema POS')
     * @param {Array<{id: string, label: string}>} options.steps Lista de fases
     * @param {number} [options.activeStep=0] Índice de fase activa (0-based)
     * @param {number} [options.percent=0] Porcentaje inicial (0 a 100)
     * @param {string} [options.counterText=''] Contador en vivo (Ej: '0 / 60.417 reg')
     * @param {string} [options.detailText=''] Detalle inferior
     * @param {string} [options.estimatedTime=''] Tiempo estimado restante
     */
    show(options = {}) {
        this.currentConfig = {
            title: options.title || 'Restauración de Base de Datos POS',
            steps: options.steps || [
                { id: '1', label: 'Validando Archivo' },
                { id: '2', label: 'Escribiendo en SQLite' },
                { id: '3', label: 'Indexando Registros' },
                { id: '4', label: 'Sincronización Final' }
            ],
            activeStep: options.activeStep || 0,
            percent: options.percent || 0,
            counterText: options.counterText || '',
            detailText: options.detailText || 'Iniciando proceso, por favor espere...',
            estimatedTime: options.estimatedTime || ''
        };

        this._render();
        this._startTipRotation();
    },

    /**
     * Actualiza el progreso en tiempo real
     */
    update(updates = {}) {
        if (!this.currentConfig) return;
        if (updates.activeStep !== undefined) this.currentConfig.activeStep = updates.activeStep;
        if (updates.percent !== undefined) this.currentConfig.percent = Math.min(100, Math.max(0, updates.percent));
        if (updates.counterText !== undefined) this.currentConfig.counterText = updates.counterText;
        if (updates.detailText !== undefined) this.currentConfig.detailText = updates.detailText;
        if (updates.estimatedTime !== undefined) this.currentConfig.estimatedTime = updates.estimatedTime;

        this._updateDOM();
    },

    /**
     * Transforma el modal al estado de éxito final con checkmark verde y botón de continuar
     * @param {Object} finishOptions
     * @param {string} finishOptions.title
     * @param {string} finishOptions.message
     * @param {Function} [finishOptions.onDone]
     */
    finish(finishOptions = {}) {
        this._stopTipRotation();
        if (!this.modalEl) return;
        const title = finishOptions.title || '¡Operación Completada con Éxito!';
        const message = finishOptions.message || 'Todos los registros fueron procesados e integrados correctamente.';
        const onDone = finishOptions.onDone || null;

        const cardEl = this.modalEl.querySelector('.pipeline-card');
        if (!cardEl) return;

        cardEl.innerHTML = `
            <div style="text-align: center; padding: 1.75rem 1rem; animation: pipelineFadeIn 0.4s ease-out forwards;">
                <div style="width: 90px; height: 90px; margin: 0 auto 1.5rem; border-radius: 50%; background: radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0.05) 70%); border: 3px solid #10b981; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: #10b981; box-shadow: 0 0 35px rgba(16, 185, 129, 0.45), inset 0 0 20px rgba(16, 185, 129, 0.25); animation: finishPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    ✓
                </div>
                <h2 style="font-size: 1.85rem; font-weight: 950; color: #ffffff; margin: 0 0 0.75rem 0; letter-spacing: -0.5px;">
                    ${title}
                </h2>
                <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 1rem; padding: 1.1rem 1.5rem; margin: 0 auto 2rem auto; max-width: 520px;">
                    <p style="font-size: 0.95rem; color: #cbd5e1; margin: 0; line-height: 1.55;">
                        ${message}
                    </p>
                </div>
                <button type="button" id="btnPipelineDone" class="btn btn-primary" style="height: 52px; padding: 0 2.75rem; font-size: 1.1rem; font-weight: 900; border-radius: 0.85rem; background: linear-gradient(135deg, #0284c7 0%, #0891b2 50%, #059669 100%); border: 1.5px solid #38bdf8; box-shadow: 0 6px 25px rgba(56, 189, 248, 0.4); cursor: pointer; transition: all 0.2s; color: #ffffff; letter-spacing: 0.3px;">
                    Continuar al Sistema ➔
                </button>
            </div>
        `;

        const btn = cardEl.querySelector('#btnPipelineDone');
        if (btn) {
            btn.onclick = () => {
                this.close();
                if (typeof onDone === 'function') onDone();
            };
        }
    },

    /**
     * Cierra y elimina el modal
     */
    close() {
        this._stopTipRotation();
        if (this.modalEl) {
            this.modalEl.style.opacity = '0';
            this.modalEl.style.transform = 'scale(0.98)';
            this.modalEl.style.transition = 'all 0.25s ease-out';
            setTimeout(() => {
                if (this.modalEl && this.modalEl.parentNode) {
                    this.modalEl.parentNode.removeChild(this.modalEl);
                }
                this.modalEl = null;
                this.currentConfig = null;
            }, 250);
        }
    },

    _render() {
        if (this.modalEl && this.modalEl.parentNode) {
            this.modalEl.parentNode.removeChild(this.modalEl);
        }

        const overlay = document.createElement('div');
        overlay.id = 'loading-pipeline-overlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(6, 10, 20, 0.88);
            backdrop-filter: blur(28px) saturate(180%);
            -webkit-backdrop-filter: blur(28px) saturate(180%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100000;
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 1.25rem;
            animation: pipelineFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        overlay.innerHTML = `
            <div class="pipeline-card" style="position: relative; background: rgba(11, 17, 32, 0.94); border: 1.5px solid rgba(56, 189, 248, 0.28); border-radius: 1.85rem; padding: 2.25rem 2.5rem; max-width: 720px; width: 100%; box-shadow: 0 35px 80px -15px rgba(0,0,0,0.9), 0 0 60px rgba(14, 165, 233, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.12); overflow: hidden;">
                
                <!-- Resplandor ambiental decorativo de fondo -->
                <div style="position: absolute; top: -120px; right: -100px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%); pointer-events: none; z-index: 0;"></div>
                <div style="position: absolute; bottom: -120px; left: -100px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%); pointer-events: none; z-index: 0;"></div>

                <div style="position: relative; z-index: 1;">
                    <!-- Encabezado Prémium con Logotipo Oficial -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1.25rem;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="width: 48px; height: 48px; border-radius: 0.95rem; background: linear-gradient(135deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 25px rgba(56, 189, 248, 0.35); overflow: hidden;">
                                <img src="./icons/icon-192.png" alt="Caja Fácil" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'font-weight:950; color:#38bdf8; font-size:1.15rem;\\'>CF</span>';">
                            </div>
                            <div>
                                <h3 id="pipelineModalTitle" style="margin: 0; font-size: 1.4rem; font-weight: 950; color: #ffffff; letter-spacing: -0.4px;">
                                    ${this.currentConfig.title}
                                </h3>
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                                    <span style="font-size: 0.72rem; color: #38bdf8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; background: rgba(56, 189, 248, 0.12); padding: 0.15rem 0.5rem; border-radius: 0.4rem; border: 1px solid rgba(56, 189, 248, 0.25);">
                                        ⚡ Motor SQLite POS
                                    </span>
                                    <span style="font-size: 0.72rem; color: #10b981; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; background: rgba(16, 185, 129, 0.12); padding: 0.15rem 0.5rem; border-radius: 0.4rem; border: 1px solid rgba(16, 185, 129, 0.25); display: flex; align-items: center; gap: 0.35rem;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; animation: activePulseRing 1.8s infinite;"></span>
                                        Proceso Seguro
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Tiempo Estimado en Cabecera -->
                        <div id="pipelineEstimatedTimeBadge" style="text-align: right; background: rgba(30, 41, 59, 0.6); padding: 0.4rem 0.85rem; border-radius: 0.65rem; border: 1px solid rgba(255,255,255,0.08);">
                            <div style="font-size: 0.68rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Tiempo Estimado</div>
                            <div id="pipelineEstimatedTime" style="font-size: 0.88rem; font-weight: 900; color: #e2e8f0;">
                                ${this.currentConfig.estimatedTime ? `⏱️ ${this.currentConfig.estimatedTime}` : '⏱️ Calculando...'}
                            </div>
                        </div>
                    </div>

                    <!-- Pipeline de Fases (4 Cápsulas Horizontales Conectadas) -->
                    <div id="pipelineNodesContainer" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.65rem; position: relative; margin-bottom: 2rem;">
                        ${this._renderNodesHtml()}
                    </div>

                    <!-- Centro de Control de Métricas -->
                    <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 1.25rem; padding: 1.4rem 1.6rem; margin-bottom: 1.25rem;">
                        <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 0.75rem;">
                            <div style="display: flex; align-items: baseline; gap: 0.4rem;">
                                <div id="pipelinePercentage" style="font-size: 3.2rem; font-weight: 950; line-height: 1; letter-spacing: -1px; background: linear-gradient(135deg, #ffffff 40%, #38bdf8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                                    ${Math.round(this.currentConfig.percent)}%
                                </div>
                                <span style="font-size: 0.82rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Completado</span>
                            </div>
                            <div id="pipelineCounterBadge" style="font-size: 0.85rem; font-weight: 850; color: #38bdf8; background: rgba(56, 189, 248, 0.12); padding: 0.3rem 0.75rem; border-radius: 0.5rem; border: 1px solid rgba(56, 189, 248, 0.3);">
                                ${this.currentConfig.counterText || 'Procesando...'}
                            </div>
                        </div>

                        <!-- Barra de Progreso Neón con Shimmer Luminoso -->
                        <div style="width: 100%; height: 13px; background: rgba(15, 23, 42, 0.9); border-radius: 9999px; overflow: hidden; position: relative; border: 1px solid rgba(56, 189, 248, 0.3); box-shadow: inset 0 2px 4px rgba(0,0,0,0.6);">
                            <div id="pipelineProgressBar" style="height: 100%; width: ${this.currentConfig.percent}%; background: linear-gradient(90deg, #0284c7 0%, #06b6d4 50%, #10b981 100%); border-radius: 9999px; box-shadow: 0 0 20px rgba(56, 189, 248, 0.6); position: relative; transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);">
                                <div class="pipeline-shimmer"></div>
                            </div>
                        </div>

                        <!-- Detalle de Acción Inmediata -->
                        <div id="pipelineDetailText" style="font-size: 0.92rem; font-weight: 750; color: #e2e8f0; margin-top: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 8px #38bdf8;"></span>
                            ${this.currentConfig.detailText}
                        </div>
                    </div>

                    <!-- Franja Rotativa Dinámica de Seguridad y Confianza -->
                    <div id="pipelineSecurityTip" style="background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 0.85rem; padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; color: #94a3b8; font-weight: 600;">
                        <span id="pipelineTipText" style="transition: opacity 0.3s ease-in-out;">
                            ${this._tips[0]}
                        </span>
                        <span style="font-size: 0.72rem; color: #64748b; font-weight: 800; text-transform: uppercase;">🔒 Seguro</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.modalEl = overlay;
        this._injectStyles();
    },

    _renderNodesHtml() {
        const { steps, activeStep, counterText } = this.currentConfig;
        const icons = [
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>'
        ];

        return steps.map((step, idx) => {
            const isDone = idx < activeStep;
            const isActive = idx === activeStep;
            const isPending = idx > activeStep;

            let cardStyle = 'background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.06); color: #64748b;';
            let iconBoxStyle = 'background: rgba(255,255,255,0.04); color: #64748b; border: 1px solid rgba(255,255,255,0.06);';
            let statusText = 'En espera';
            let statusColor = '#64748b';

            if (isDone) {
                cardStyle = 'background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.45); color: #ffffff; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.15);';
                iconBoxStyle = 'background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid #10b981; box-shadow: 0 0 12px rgba(16, 185, 129, 0.35);';
                statusText = 'Listo ✓';
                statusColor = '#10b981';
            } else if (isActive) {
                cardStyle = 'background: rgba(14, 165, 233, 0.14); border: 1.5px solid #38bdf8; color: #ffffff; box-shadow: 0 4px 20px rgba(56, 189, 248, 0.3), inset 0 0 15px rgba(56, 189, 248, 0.1); animation: activeBorderGlow 2s infinite alternate;';
                iconBoxStyle = 'background: rgba(56, 189, 248, 0.25); color: #38bdf8; border: 1.5px solid #38bdf8; box-shadow: 0 0 15px rgba(56, 189, 248, 0.5);';
                statusText = counterText ? counterText : 'Procesando...';
                statusColor = '#38bdf8';
            }

            return `
                <div class="pipeline-node-card" style="border-radius: 1rem; padding: 0.85rem 0.75rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: space-between; min-height: 110px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); ${cardStyle}">
                    <div style="width: 38px; height: 38px; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; font-size: 1rem; margin-bottom: 0.5rem; transition: all 0.3s; ${iconBoxStyle}">
                        ${isDone ? '✓' : (icons[idx] || '⚡')}
                    </div>
                    <div style="font-size: 0.78rem; font-weight: 850; line-height: 1.25; margin-bottom: 0.4rem; color: ${isActive ? '#ffffff' : (isDone ? '#f1f5f9' : '#64748b')};">
                        ${step.label}
                    </div>
                    <div style="font-size: 0.68rem; font-weight: 800; color: ${statusColor}; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
                        ${statusText}
                    </div>
                </div>
            `;
        }).join('');
    },

    _updateDOM() {
        if (!this.modalEl) return;

        const nodesEl = this.modalEl.querySelector('#pipelineNodesContainer');
        if (nodesEl) nodesEl.innerHTML = this._renderNodesHtml();

        const pctEl = this.modalEl.querySelector('#pipelinePercentage');
        if (pctEl) pctEl.textContent = `${Math.round(this.currentConfig.percent)}%`;

        const barEl = this.modalEl.querySelector('#pipelineProgressBar');
        if (barEl) barEl.style.width = `${this.currentConfig.percent}%`;

        const counterEl = this.modalEl.querySelector('#pipelineCounterBadge');
        if (counterEl) {
            counterEl.textContent = this.currentConfig.counterText || `${Math.round(this.currentConfig.percent)}%`;
        }

        const detailEl = this.modalEl.querySelector('#pipelineDetailText');
        if (detailEl) {
            detailEl.innerHTML = `
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 8px #38bdf8;"></span>
                ${this.currentConfig.detailText}
            `;
        }

        const timeEl = this.modalEl.querySelector('#pipelineEstimatedTime');
        if (timeEl) {
            timeEl.textContent = this.currentConfig.estimatedTime ? `⏱️ ${this.currentConfig.estimatedTime}` : '⏱️ En curso';
        }
    },

    _startTipRotation() {
        this._stopTipRotation();
        this._tipInterval = setInterval(() => {
            if (!this.modalEl) return;
            const tipEl = this.modalEl.querySelector('#pipelineTipText');
            if (!tipEl) return;
            this._currentTipIndex = (this._currentTipIndex + 1) % this._tips.length;
            tipEl.style.opacity = '0';
            setTimeout(() => {
                if (tipEl) {
                    tipEl.textContent = this._tips[this._currentTipIndex];
                    tipEl.style.opacity = '1';
                }
            }, 300);
        }, 4500);
    },

    _stopTipRotation() {
        if (this._tipInterval) {
            clearInterval(this._tipInterval);
            this._tipInterval = null;
        }
    },

    _injectStyles() {
        if (document.getElementById('loading-pipeline-styles')) return;
        const style = document.createElement('style');
        style.id = 'loading-pipeline-styles';
        style.textContent = `
            @keyframes pipelineFadeIn {
                from { opacity: 0; transform: scale(0.96) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes activeBorderGlow {
                0% { border-color: rgba(56, 189, 248, 0.4); box-shadow: 0 4px 15px rgba(56, 189, 248, 0.15); }
                100% { border-color: #38bdf8; box-shadow: 0 4px 25px rgba(56, 189, 248, 0.45), inset 0 0 15px rgba(56, 189, 248, 0.15); }
            }
            @keyframes activePulseRing {
                0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
                70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
                100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
            }
            @keyframes finishPop {
                0% { transform: scale(0.5); opacity: 0; }
                50% { transform: scale(1.12); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
            }
            .pipeline-shimmer {
                position: absolute;
                inset: 0;
                background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%);
                animation: pipelineShimmer 1.8s infinite;
            }
            @keyframes pipelineShimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
        `;
        document.head.appendChild(style);
    }
};

window.LoadingPipelineModal = LoadingPipelineModal;
