/**
 * CategoryHelper
 * Utilidad centralizada para la normalización, estandarización a Tipo Título y comparación de categorías.
 */
const CategoryHelper = {
    /**
     * Convierte cualquier texto a Formato Tipo Título (ej: "bebidas sin alcohol" -> "Bebidas Sin Alcohol")
     * Elimina espacios al inicio, final y dobles espacios intermedios.
     * @param {string} str 
     * @returns {string}
     */
    toTitleCase(str) {
        if (!str || typeof str !== 'string') return 'General';
        const cleaned = str.trim().replace(/\s+/g, ' ');
        if (!cleaned) return 'General';

        // Capitalizar cada palabra respetando caracteres especiales y acentos
        return cleaned.split(' ').map(word => {
            if (!word) return '';
            // Preservar acrónimos de 2-3 letras completamente en mayúsculas (ej: POS, IVA) si venían así
            if (word.length <= 3 && word === word.toUpperCase() && /^[A-ZÁÉÍÓÚÑ]+$/.test(word)) {
                return word;
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
    },

    /**
     * Genera una clave única en minúsculas y sin acentos para comparaciones e identificadores únicos.
     * Ej: "Bebidas Sín Alcohol" -> "bebidas sin alcohol"
     * @param {string} str 
     * @returns {string}
     */
    normalizeKey(str) {
        if (!str || typeof str !== 'string') return 'general';
        return str.trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ');
    },

    /**
     * Limpia y estandariza una categoría. Retorna 'General' si está vacía.
     * @param {string} catName 
     * @returns {string}
     */
    sanitize(catName) {
        return this.toTitleCase(catName);
    },

    /**
     * Compara si dos nombres de categorías son equivalentes (ignorando mayúsculas, minúsculas, espacios y acentos).
     * @param {string} catA 
     * @param {string} catB 
     * @returns {boolean}
     */
    areEqual(catA, catB) {
        return this.normalizeKey(catA) === this.normalizeKey(catB);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CategoryHelper;
}
