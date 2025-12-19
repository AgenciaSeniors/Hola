/**
 * Normaliza una cadena de texto para comparaciones robustas.
 * Elimina acentos, pasa a minúsculas y elimina caracteres no alfanuméricos.
 * Ej: "¡Un Mojito!" -> "mojito"
 */
export function normalizeStr(str) {
    if (!str) return '';
    return str.toString()
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/[^a-z0-9]/g, ""); // Quitar puntuación y espacios
}

/**
 * Busca un producto en el inventario usando lógica difusa y por ID.
 * Prioridad: Match por ID > Match exacto de nombre > Match parcial (includes).
 */
export function findProductMatch(products, searchCriteria) {
    const { id, name } = searchCriteria;

    // 1. Intento por ID (La opción más segura si la IA devolvió ID)
    if (id) {
        const matchId = products.find(p => p.id == id);
        if (matchId) return matchId;
    }

    // 2. Intento por Nombre (Normalizado)
    if (name) {
        const cleanSearch = normalizeStr(name);
        
        // Match exacto normalizado
        const matchExact = products.find(p => normalizeStr(p.nombre) === cleanSearch);
        if (matchExact) return matchExact;

        // Match parcial (bidireccional)
        const matchPartial = products.find(p => {
            const cleanP = normalizeStr(p.nombre);
            return cleanP.includes(cleanSearch) || cleanSearch.includes(cleanP);
        });
        if (matchPartial) return matchPartial;
    }

    return null;
}

/**
 * Selecciona un producto aleatorio del array (evita el índice 0 fijo).
 * Se puede excluir un ID específico (ej. el último recomendado).
 */
export function getRandomProduct(products, excludeId = null) {
    if (!products || products.length === 0) return null;
    
    let pool = products;
    if (excludeId) {
        pool = products.filter(p => p.id !== excludeId);
        // Si el filtro vacía la lista, usamos todos
        if (pool.length === 0) pool = products;
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
}