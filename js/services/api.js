// js/services/api.js
import { supabaseClient } from '../config.js'; // <--- Nueva importación

export const ApiService = {
    /**
     * Envía datos a Google Apps Script evitando preflight CORS.
     * Usa text/plain para que el navegador no envíe OPTIONS.
     */
    async callGAS(url, payload) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { "Content-Type": "text/plain" }, // CLAVE: Evita preflight
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`GAS Error: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error("ApiService GAS Error:", error);
            throw error;
        }
    },

    /**
     * Wrapper para inserciones en Supabase manejando conflictos (409).
     * @param {Object} supabaseClient - Instancia global de Supabase
     * @param {string} table - Nombre de la tabla
     * @param {Object} data - Datos a insertar
     */
    async safeInsert(supabaseClient, table, data) {
        try {
            const { data: result, error } = await supabaseClient
                .from(table)
                .insert([data])
                .select(); // Necesario para confirmar inserción

            if (error) {
                // Manejo específico de duplicados
                if (error.code === '23505' || error.message.includes('409')) {
                    console.warn(`Registro duplicado en ${table} (ignorado o manejado).`);
                    return { status: 'duplicate', error: null };
                }
                throw error;
            }
            return { status: 'success', data: result };
        } catch (err) {
            console.error(`Error DB ${table}:`, err);
            return { status: 'error', error: err };
        }
    }
};