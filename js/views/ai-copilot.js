class AICopilot {
    constructor() {
        this.isOpen = false;
        this.history = [];
        this.init();
    }

    init() {
        this.renderWidget();
        this.bindEvents();
        this.addInitialMessage();
    }

    renderWidget() {
        const root = document.getElementById('ai-copilot-root');
        if (!root) return;

        root.innerHTML = `
            <div class="ai-chat-window" id="aiChatWindow">
                <div class="ai-chat-header">
                    <h3>🤖 Copiloto Inteligente</h3>
                    <button class="ai-chat-close" id="aiChatClose">×</button>
                </div>
                <div class="ai-chat-messages" id="aiChatMessages">
                    <div class="ai-typing-indicator" id="aiTypingIndicator">
                        <div class="ai-dot"></div>
                        <div class="ai-dot"></div>
                        <div class="ai-dot"></div>
                    </div>
                </div>
                <div class="ai-chat-input-area">
                    <input type="text" id="aiChatInput" class="ai-chat-input" placeholder="Pregunta sobre tus ventas, stock..." autocomplete="off">
                    <button class="ai-chat-send" id="aiChatSend">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="ai-fab" id="aiFab" title="Asistente de Inteligencia Artificial">
                🤖
            </div>
        `;

        this.fab = document.getElementById('aiFab');
        this.chatWindow = document.getElementById('aiChatWindow');
        this.closeBtn = document.getElementById('aiChatClose');
        this.input = document.getElementById('aiChatInput');
        this.sendBtn = document.getElementById('aiChatSend');
        this.messagesContainer = document.getElementById('aiChatMessages');
        this.typingIndicator = document.getElementById('aiTypingIndicator');
    }

    bindEvents() {
        this.fab.addEventListener('click', () => this.toggleChat());
        this.closeBtn.addEventListener('click', () => this.toggleChat());
        
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.chatWindow.classList.add('open');
            this.input.focus();
            if (this.history.length === 0) {
                // Mensaje inicial ya agregado, no hacer nada
            }
        } else {
            this.chatWindow.classList.remove('open');
        }
    }

    addInitialMessage() {
        this.appendMessage('bot', '¡Hola! Soy tu Copiloto IA. Puedo analizar tus ventas, avisarte del stock crítico o darte sugerencias. ¿En qué te puedo ayudar hoy?');
    }

    appendMessage(role, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-message ${role}`;
        
        // Simple markdown parsing for bold and line breaks
        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
            
        msgDiv.innerHTML = formattedText;
        
        this.messagesContainer.insertBefore(msgDiv, this.typingIndicator);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        // User message
        this.appendMessage('user', text);
        this.input.value = '';
        this.input.focus();

        // Add to history
        this.history.push({ role: 'user', text });

        // Show typing
        this.typingIndicator.classList.add('visible');
        this.scrollToBottom();

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3000/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: text,
                    history: this.history.slice(0, -1) // Send all history except current
                })
            });

            const data = await response.json();
            
            this.typingIndicator.classList.remove('visible');

            if (!response.ok) {
                this.appendMessage('bot', '⚠️ ' + (data.error || 'Error al conectar con la IA.'));
            } else {
                this.appendMessage('bot', data.reply);
                this.history.push({ role: 'model', text: data.reply });
            }
        } catch (error) {
            this.typingIndicator.classList.remove('visible');
            this.appendMessage('bot', '⚠️ No se pudo conectar con el servidor.');
            console.error('AI Copilot Error:', error);
        }
    }
}

// Inicializar cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
    // Only init if we have an element
    if (document.getElementById('ai-copilot-root')) {
        window.aiCopilot = new AICopilot();
    }
});
