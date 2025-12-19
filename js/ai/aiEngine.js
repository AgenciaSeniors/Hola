// js/ai/aiEngine.js
import { ApiService } from '../services/api.js';

export const AiEngine = {
    async getRecommendation(urlScript, preferences, menuProducts) {
        // Preparamos un "Mini Menú" con IDs para que la IA pueda ser precisa
        const menuContext = menuProducts.map(p => `ID:${p.id}|${p.nombre}`).join('; ');

        const payload = {
            action: "recommendation", // Flag para el backend
            tipo: preferences.tipo || "Sorpresa",
            sabor: preferences.sabor,
            menu: menuContext,
            // Solicitamos JSON explícito en el prompt del backend,
            // pero enviamos contexto estructurado aquí.
        };

        try {
            const data = await ApiService.callGAS(urlScript, payload);
            
            // Validación de respuesta
            if (data.error) throw new Error(data.error);
            
            // Intentamos parsear si viene como string JSON dentro de un campo
            let result = data.recommendation;
            
            // Si el backend ya lo devuelve parseado (ideal)
            if (typeof result === 'object' && result !== null) {
                return result;
            }

            // Fallback: Si el backend devolvió texto plano por error de la LLM
            return {
                product_id: null,
                product_name: String(result).replace(/["{}]/g, "") // Limpieza básica
            };

        } catch (error) {
            console.error("AI Engine Error:", error);
            return null; // Fallo total
        }
    }
};