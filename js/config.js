const API_CONFIG = {
    // BLINDAJE 100% OFFLINE: Solo habla con el motor interno de esta computadora
    // Configurable via localStorage para desarrollo con diferentes puertos
    BASE_URL: localStorage.getItem('API_BASE_URL') || (window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:3000'),

    get API_URL() {
        return `${this.BASE_URL}/api`;
    }
};

window.API_CONFIG = API_CONFIG;
