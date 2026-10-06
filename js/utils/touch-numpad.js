/**
 * Sistema Touch POS 2026: Teclado Numérico Táctil Universal
 * Permite ingresar cifras, montos y cantidades en cualquier input sin necesidad de teclado físico.
 * Funciona de forma no invasiva sobre cualquier modal existente.
 */
const TouchNumpad = {
    _targetInput: null,
    _currentValue: '0',
    _mode: 'currency', // 'currency' | 'decimal' | 'integer'
    _onConfirm: null,
    _title: 'Teclado Numérico',

    /**
     * Abre el teclado numérico táctil para un input específico.
     * @param {string|HTMLInputElement} target Elemento o ID del input.
     * @param {Object} options Opciones de configuración.
     */
    open(target, options = {}) {
        const inputEl = typeof target === 'string' ? document.getElementById(target) : target;
        if (!inputEl) return;

        this._targetInput = inputEl;
        this._mode = options.mode || 'currency';
        this._title = options.title || (this._mode === 'currency' ? 'Ingresar Monto' : 'Ingresar Cantidad');
        this._onConfirm = typeof options.onConfirm === 'function' ? options.onConfirm : null;

        // Valor inicial limpio
        const rawVal = inputEl.value !== undefined ? String(inputEl.value).trim() : '';
        this._currentValue = rawVal && rawVal !== '0' && !isNaN(parseFloat(rawVal)) ? rawVal : '0';

        this._renderModal();
    },

    _renderModal() {
        this._closeModal(); // Asegurar que no haya duplicados

        const overlay = document.createElement('div');
        overlay.id = 'touch-numpad-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(8px);
            z-index: 10500;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            box-sizing: border-box;
            animation: fadeIn 0.15s ease-out forwards;
        `;

        const isCurrency = this._mode === 'currency';
        const displayFormatted = isCurrency 
            ? '$' + Math.round(parseFloat(this._currentValue) || 0).toLocaleString('es-CL')
            : this._currentValue;

        const quickBillsHtml = isCurrency ? `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; margin-bottom: 0.75rem;">
                <button type="button" class="btn-bill" onclick="TouchNumpad.addBill(1000)">+$1.000</button>
                <button type="button" class="btn-bill" onclick="TouchNumpad.addBill(2000)">+$2.000</button>
                <button type="button" class="btn-bill" onclick="TouchNumpad.addBill(5000)">+$5.000</button>
                <button type="button" class="btn-bill" onclick="TouchNumpad.addBill(10000)">+$10.000</button>
                <button type="button" class="btn-bill" onclick="TouchNumpad.addBill(20000)">+$20.000</button>
                <button type="button" class="btn-bill exact-cash" onclick="TouchNumpad.setExact()">Efectivo Exacto</button>
            </div>
        ` : '';

        overlay.innerHTML = `
            <div class="touch-numpad-modal" style="
                background: #ffffff;
                width: 100%;
                max-width: 440px;
                border-radius: 1.5rem;
                padding: 1.25rem;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                border: 2px solid var(--border);
                display: flex;
                flex-direction: column;
                user-select: none;
            ">
                <!-- Cabecera -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <strong style="font-size: 1.05rem; font-weight: 900; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
                        <span>🔢</span> ${this._title}
                    </strong>
                    <button type="button" onclick="TouchNumpad.cancel()" style="background: transparent; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer; padding: 0.2rem 0.5rem; line-height: 1;">✕</button>
                </div>

                <!-- Pantalla del visor -->
                <div class="touch-numpad-display-box">
                    <span class="touch-numpad-label">${isCurrency ? 'Total a Ingresar (CLP)' : 'Valor Ingresado'}</span>
                    <span class="touch-numpad-val" id="touchNumpadDisplay">${displayFormatted}</span>
                </div>

                <!-- Atajos rápidos de billetes (si es modo moneda) -->
                ${quickBillsHtml}

                <!-- Grilla de Teclas Táctiles -->
                <div class="touch-numpad-grid">
                    <button type="button" class="btn-numpad-key" onclick="TouchNumpad.press('7')">7</button>
                    <button type="button" class="btn-numpad-key" onclick="TouchNumpad.press('8')">8</button>
                    <button type="button" class="btn-numpad-key" onclick="TouchNumpad.press('9')">9</button>
                    <button type="button" class="btn-numpad-key action-backspace" onclick="TouchNumpad.backspace()" title="Borrar último dígito">⌫</button>

                    <button type="button" class="btn-numpad-key" onclick="TouchNumpad.press('4')">4</button>
                    <button type="button" class="btn-numpad-key" onclick="TouchNumpad.press('5')">5</button>
                    <button type="button" class="btn-numpad-key" onclick="TouchNumpad.press('6')">6</button>
                    <button type="button" class="btn-numpad-key action-clear" onclick="TouchNumpad.clear()" title="Limpiar">C</button>

                    <button type="button" class="btn-numpad-key" onclick="TouchNumpad.press('1')">1</button>
                    <button type="button" class="btn-numpad-key" onclick="TouchNumpad.press('2')">2</button>
                    <button type="button" class="btn-numpad-key" onclick="TouchNumpad.press('3')">3</button>
                    <button type="button" class="btn-numpad-key" onclick="TouchNumpad.press('00')">00</button>

                    <button type="button" class="btn-numpad-key" onclick="TouchNumpad.press('0')">0</button>
                    <button type="button" class="btn-numpad-key" onclick="TouchNumpad.press('.')">${this._mode === 'currency' ? '000' : '.'}</button>
                    <button type="button" class="btn-numpad-key action-ok" onclick="TouchNumpad.confirm()">✓ ACEPTAR</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
    },

    _updateDisplay() {
        const disp = document.getElementById('touchNumpadDisplay');
        if (!disp) return;

        const isCurrency = this._mode === 'currency';
        if (isCurrency) {
            const num = parseFloat(this._currentValue) || 0;
            disp.textContent = '$' + Math.round(num).toLocaleString('es-CL');
        } else {
            disp.textContent = this._currentValue || '0';
        }
    },

    press(char) {
        if (char === '.') {
            if (this._mode === 'currency') {
                // En modo moneda, el botón actúa como '+000' para miles rápidos
                if (this._currentValue === '0') return;
                this._currentValue += '000';
                this._updateDisplay();
                return;
            }
            if (this._currentValue.includes('.')) return;
            this._currentValue = this._currentValue === '0' ? '0.' : this._currentValue + '.';
            this._updateDisplay();
            return;
        }

        if (char === '00') {
            if (this._currentValue === '0') return;
            this._currentValue += '00';
            this._updateDisplay();
            return;
        }

        if (this._currentValue === '0') {
            this._currentValue = String(char);
        } else {
            // Limitar longitud para evitar overflow
            if (this._currentValue.length >= 10) return;
            this._currentValue += String(char);
        }

        this._updateDisplay();
    },

    addBill(amount) {
        let currentNum = parseFloat(this._currentValue) || 0;
        currentNum += amount;
        this._currentValue = String(Math.round(currentNum));
        this._updateDisplay();
    },

    setExact() {
        if (this._targetInput && this._targetInput.dataset && this._targetInput.dataset.exact) {
            this._currentValue = String(this._targetInput.dataset.exact);
        } else {
            // Buscar total en carrito o modal
            const cartTotEl = document.getElementById('cartTotal') || document.getElementById('modalTotalToPay');
            if (cartTotEl) {
                const rawNum = cartTotEl.textContent.replace(/[^0-9]/g, '');
                if (rawNum) this._currentValue = rawNum;
            }
        }
        this._updateDisplay();
    },

    backspace() {
        if (this._currentValue.length <= 1) {
            this._currentValue = '0';
        } else {
            this._currentValue = this._currentValue.slice(0, -1);
            if (this._currentValue === '' || this._currentValue === '-') {
                this._currentValue = '0';
            }
        }
        this._updateDisplay();
    },

    clear() {
        this._currentValue = '0';
        this._updateDisplay();
    },

    confirm() {
        if (this._targetInput) {
            const finalVal = this._mode === 'currency' 
                ? Math.round(parseFloat(this._currentValue) || 0)
                : (this._mode === 'integer' ? parseInt(this._currentValue, 10) || 0 : parseFloat(this._currentValue) || 0);

            this._targetInput.value = finalVal;
            // Disparar eventos nativos para que los controladores reaccionen
            this._targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            this._targetInput.dispatchEvent(new Event('change', { bubbles: true }));

            if (this._onConfirm) {
                this._onConfirm(finalVal);
            }
        }

        this._closeModal();
    },

    cancel() {
        this._closeModal();
    },

    _closeModal() {
        const overlay = document.getElementById('touch-numpad-overlay');
        if (overlay) {
            overlay.remove();
        }
        this._targetInput = null;
        this._onConfirm = null;
    }
};

// Exportar al objeto global para acceso universal
window.TouchNumpad = TouchNumpad;
