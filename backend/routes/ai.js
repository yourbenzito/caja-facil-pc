const express = require('express');
const router = express.Router();
const { dbGet, dbAll } = require('../database/connection');
const { GoogleGenerativeAI } = require('@google/generative-ai');

router.post('/api/ai/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        const businessId = req.user ? req.user.business_id : 1;

        if (!message) {
            return res.status(400).json({ error: 'Mensaje es requerido' });
        }

        // Obtener API Key
        const setting = await dbGet("SELECT value FROM settings WHERE key = 'gemini_api_key' AND business_id = ?", [businessId]);
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'La API Key de Gemini no está configurada. Ve a Configuración -> IA.' });
        }

        const apiKey = setting.value;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Extraer contexto de la base de datos (RAG Local)
        const today = new Date().toISOString().split('T')[0];
        
        // Ventas de hoy
        const salesStats = await dbGet(`
            SELECT 
                COUNT(*) as totalVentas,
                SUM(total) as ingresos,
                SUM(total - (SELECT SUM(cost * json_extract(value, '$.quantity')) FROM json_each(items))) as gananciasEstimadas
            FROM sales 
            WHERE date LIKE ? AND business_id = ? AND status = 'completed'
        `, [`${today}%`, businessId]);

        // Stock Crítico
        const lowStock = await dbAll(`
            SELECT name, stock, minStock 
            FROM products 
            WHERE stock <= minStock AND isActive = 1 AND business_id = ?
            LIMIT 20
        `, [businessId]);

        let contextText = `
### CONTEXTO DEL NEGOCIO (Día actual: ${today})
- Ventas de hoy: ${salesStats.totalVentas || 0}
- Ingresos de hoy: $${salesStats.ingresos || 0}
- Ganancia estimada hoy: $${salesStats.gananciasEstimadas || 0}

- Productos con stock crítico (menos o igual al mínimo):
${lowStock.length > 0 ? lowStock.map(p => `  * ${p.name}: Quedan ${p.stock}`).join('\n') : '  No hay productos en stock crítico.'}
`;

        const systemInstruction = `
Eres el "Copiloto IA" del sistema Punto de Venta (POS) "CajaFácil".
Eres un asesor de minimarket chileno y debes ayudar al dueño. 
Responde de forma amigable, directa y concisa.
Utiliza el contexto proporcionado para responder a preguntas sobre las ventas, inventario y estado general.
No inventes datos de ventas o stock si no están en el contexto.
Da sugerencias para mejorar el negocio si se te solicita.
El usuario hace la siguiente pregunta o comentario. Revisa también el historial reciente para tener contexto de la conversación.
`;

        const chatHistory = (history || []).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const chatSession = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: 'Instrucciones del sistema y contexto:\n' + systemInstruction + '\n\n' + contextText }]
                },
                {
                    role: 'model',
                    parts: [{ text: 'Entendido. Estoy listo para ayudar al dueño basándome en este contexto.' }]
                },
                ...chatHistory
            ]
        });

        const result = await chatSession.sendMessage(message);
        const responseText = result.response.text();

        res.json({ reply: responseText });
    } catch (error) {
        console.error('Error en /api/ai/chat:', error);
        res.status(500).json({ error: 'Error interno conectando con la Inteligencia Artificial.' });
    }
});

module.exports = router;
