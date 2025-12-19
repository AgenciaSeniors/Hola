// js/script.js - Lógica Cliente (Refactorizado con Módulos ES)

import { normalizeStr, findProductMatch, getRandomProduct } from './ai/aiUtils.js';
import { ApiService } from './services/api.js';
import { AiEngine } from './ai/aiEngine.js';
import { supabaseClient } from './config.js';

// URL DE GOOGLE APPS SCRIPT (Asegúrate de que es la correcta y desplegada como Web App)
const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbyyJoRpC1mYNKNlKxjZVAT0dyXYW79wFq_IbV0KOll2bY0cjWXoUN7K-71lzB6TgJ5x/exec";

// --- ESTADO GLOBAL ---
let todosLosProductos = [];
let productoActual = null;
let puntuacion = 0;
let searchTimeout;

// Estado del Shaker
let shakerState = {
    seleccionados: [],
    isShaking: false,
    isProcessing: false,
    shakeCount: 0
};
let watchID = null;

// Configuración de Esencias
const ESENCIAS = [
    { id: 'fresco', icono: '🧊', nombre: 'Fresco' },
    { id: 'dulce', icono: '🍬', nombre: 'Dulce' },
    { id: 'fuerte', icono: '🔥', nombre: 'Potente' },
    { id: 'frutal', icono: '🍍', nombre: 'Frutal' },
    { id: 'amargo', icono: '🍋', nombre: 'Ácido' },
    { id: 'party', icono: '🎉', nombre: 'Fiesta' }
];

// --- EXPORTAR FUNCIONES AL WINDOW (Para compatibilidad con onclick HTML) ---
window.registrarBienvenida = registrarBienvenida;
window.cerrarWelcome = cerrarWelcome;
window.filtrar = filtrar;
window.abrirDetalle = abrirDetalle;
window.cerrarDetalle = cerrarDetalle;
window.abrirOpinionDesdeDetalle = abrirOpinionDesdeDetalle;
window.cerrarModalOpiniones = cerrarModalOpiniones;
window.enviarOpinion = enviarOpinion;
window.abrirShaker = abrirShaker;
window.cerrarShaker = cerrarShaker;
window.procesarMezcla = procesarMezcla;
window.cargarMenu = cargarMenu; // Útil para reintentar

document.addEventListener('DOMContentLoaded', () => {
    checkWelcome();
    cargarMenu();
    updateConnectionStatus();
});

// --- LÓGICA DE VISITAS Y BIENVENIDA ---
async function checkWelcome() {
    const clienteId = localStorage.getItem('cliente_id');
    const modoAnonimo = localStorage.getItem('modo_anonimo');
    const modal = document.getElementById('modal-welcome');

    // Si ya es cliente o eligió ser anónimo
    if (clienteId || modoAnonimo === 'true') {
        if (modal) modal.style.display = 'none';

        // LÓGICA DE VISITA RECURRENTE (Solo para registrados)
        if (clienteId) {
            const ultimaVisita = localStorage.getItem('ultima_visita_ts');
            const ahora = Date.now();
            const HORAS_12 = 12 * 60 * 60 * 1000;

            if (!ultimaVisita || (ahora - parseInt(ultimaVisita)) > HORAS_12) {
                console.log("Registrando visita recurrente...");
                // CORRECCIÓN: Usamos inserción segura que maneja el error 409
                const res = await ApiService.safeInsert(supabaseClient, 'visitas', {
                    cliente_id: clienteId,
                    motivo: 'Regreso al Menú'
                });

                if (res.status === 'success' || res.status === 'duplicate') {
                    localStorage.setItem('ultima_visita_ts', ahora.toString());
                }
            }
        }
    } else {
        // Usuario nuevo: Mostrar modal
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    }
}

function cerrarWelcome() {
    activarModoAnonimo();
}

function activarModoAnonimo() {
    localStorage.setItem('modo_anonimo', 'true');
    const modal = document.getElementById('modal-welcome');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 400);
    }
    showToast("Modo Explorador Anónimo", "info");
}

function limpiarTelefono(input) {
    if (!input) return "";
    let limpio = input.replace(/\D/g, ''); 
    if (limpio.length === 10 && limpio.startsWith('53')) {
        limpio = limpio.substring(2);
    }
    return limpio;
}

async function registrarBienvenida() {
    const inputNombre = document.getElementById('welcome-nombre');
    const inputPhone = document.getElementById('welcome-phone');
    const btn = document.querySelector('#modal-welcome button');

    const nombre = inputNombre.value ? inputNombre.value.trim() : '';
    const telefono = limpiarTelefono(inputPhone.value);

    if (!nombre || !telefono || telefono.length < 8) {
        showToast("Nombre y teléfono válido (min 8 dígitos) requeridos.", "warning");
        return;
    }

    if(btn) { btn.textContent = "Entrando..."; btn.disabled = true; }

    try {
        let { data: cliente } = await supabaseClient
            .from('clientes')
            .select('id')
            .eq('telefono', telefono)
            .single();

        let clienteId = cliente ? cliente.id : null;

        if (!clienteId) {
            const { data: nuevo } = await supabaseClient
                .from('clientes')
                .insert([{ nombre, telefono }])
                .select()
                .single();
            clienteId = nuevo.id;
        }

        await ApiService.safeInsert(supabaseClient, 'visitas', {
            cliente_id: clienteId,
            motivo: 'Ingreso Inicial'
        });

        localStorage.setItem('cliente_id', clienteId);
        localStorage.setItem('cliente_nombre', nombre);
        localStorage.removeItem('modo_anonimo');
        localStorage.setItem('ultima_visita_ts', Date.now().toString());

        const modal = document.getElementById('modal-welcome');
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 400);
        showToast(`¡Bienvenido, ${nombre}!`, "success");

    } catch (err) {
        console.error("Error registro:", err);
        cerrarWelcome(); 
    } finally {
        if(btn) { btn.textContent = "INGRESAR"; btn.disabled = false; }
    }
}

// --- MENÚ Y PRODUCTOS ---
async function cargarMenu() {
    const grid = document.getElementById('menu-grid');
    
    const menuCache = localStorage.getItem('menu_cache');
    if (menuCache) {
        todosLosProductos = JSON.parse(menuCache);
        renderizarMenu(todosLosProductos);
    } else {
        if(grid) grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px;">
                <span class="material-icons spin" style="font-size:2rem; color:var(--neon-cyan);">refresh</span>
                <p style="color:#888; margin-top:10px;">Cargando carta...</p>
            </div>`;
    }

    try {
        if (typeof supabaseClient === 'undefined') throw new Error("Supabase no definido");

        let { data: productos, error } = await supabaseClient
            .from('productos')
            .select(`*, opiniones(puntuacion)`)
            .eq('activo', true)
            .order('destacado', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;

        if (!productos || productos.length === 0) {
            todosLosProductos = [];
            localStorage.removeItem('menu_cache');
            renderizarMenu([]);
            return;
        }

        const productosProcesados = productos.map(prod => {
            const opiniones = prod.opiniones || [];
            const total = opiniones.length;
            const suma = opiniones.reduce((acc, curr) => acc + curr.puntuacion, 0);
            prod.ratingPromedio = total ? (suma / total).toFixed(1) : null;
            return prod;
        });

        localStorage.setItem('menu_cache', JSON.stringify(productosProcesados));
        todosLosProductos = productosProcesados;
        renderizarMenu(todosLosProductos);

    } catch (err) {
        console.warn("Offline o error:", err);
        if(!menuCache && grid) {
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:30px;">
                    <span class="material-icons" style="font-size:3rem; color:var(--neon-red);">wifi_off</span>
                    <h4 style="margin:10px 0;">Error de Conexión</h4>
                    <button class="btn-modal-action" onclick="cargarMenu()" style="width:auto; padding:0 20px;">REINTENTAR</button>
                </div>`;
        }
    }
}

function renderizarMenu(lista) {
    const contenedor = document.getElementById('menu-grid');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (!lista || lista.length === 0) {
        contenedor.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;"><h4>Carta Vacía o Sin Resultados</h4></div>';
        return;
    }

    const html = lista.map(item => {
        const esAgotado = item.estado === 'agotado';
        let badgeHTML = '';
        
        if (esAgotado) badgeHTML = `<span class="badge-agotado" style="color:var(--neon-red); border:1px solid var(--neon-red);">AGOTADO</span>`;
        else if (item.destacado) badgeHTML = `<span class="badge-destacado">🔥 HOT</span>`;

        const img = item.imagen_url || 'img/logo.png';
        const rating = item.ratingPromedio ? `★ ${item.ratingPromedio}` : '';
        const accionClick = esAgotado ? '' : `onclick="abrirDetalle(${item.id})"`;
        const claseAgotado = esAgotado ? 'agotado' : '';

        return `
            <div class="card ${claseAgotado}" ${accionClick}>
                ${badgeHTML}
                <div class="img-box"><img src="${img}" loading="lazy" alt="${item.nombre}"></div>
                <div class="info">
                    <h3>${item.nombre}</h3>
                    <p class="short-desc">${item.descripcion || ''}</p>
                    <div class="card-footer">
                         <span class="price">$${item.precio}</span>
                         <span class="rating-pill">${rating}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    contenedor.innerHTML = html;
}

// --- BÚSQUEDA Y FILTROS ---
const searchInput = document.getElementById('search-input');
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const term = e.target.value.toLowerCase();
        searchTimeout = setTimeout(() => {
            const lista = todosLosProductos.filter(p => 
                (p.nombre || '').toLowerCase().includes(term) || 
                (p.descripcion || '').toLowerCase().includes(term)
            );
            renderizarMenu(lista);
        }, 300);
    });
}

function filtrar(cat, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    if(searchInput) searchInput.value = '';
    
    const lista = cat === 'todos' ? todosLosProductos : todosLosProductos.filter(p => p.categoria === cat);
    renderizarMenu(lista);
}

// --- DETALLES Y OPINIONES ---
function abrirDetalle(id) {
    productoActual = todosLosProductos.find(p => p.id === id);
    if (!productoActual) return;

    const imgEl = document.getElementById('det-img');
    if(imgEl) imgEl.src = productoActual.imagen_url || '';
    
    setText('det-titulo', productoActual.nombre);
    setText('det-desc', productoActual.descripcion);
    setText('det-precio', `$${productoActual.precio}`);
    setText('det-rating-big', productoActual.ratingPromedio ? `★ ${productoActual.ratingPromedio}` : '★ --');

    const box = document.getElementById('box-curiosidad');
    if (productoActual.curiosidad && productoActual.curiosidad.length > 5) {
        if(box) box.style.display = "block";
        setText('det-curiosidad', productoActual.curiosidad);
    } else {
        if(box) box.style.display = "none";
    }
    
    const modal = document.getElementById('modal-detalle');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function cerrarDetalle() {
    const modal = document.getElementById('modal-detalle');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 350);
}

function abrirOpinionDesdeDetalle() {
    cerrarDetalle();
    const modal = document.getElementById('modal-opinion');
    setTimeout(() => {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        
        const nombreGuardado = localStorage.getItem('cliente_nombre');
        const inputNombre = document.getElementById('cliente-nombre');
        if(nombreGuardado && inputNombre) inputNombre.value = nombreGuardado;

        puntuacion = 0;
        actualizarEstrellas();
    }, 300);
}

function cerrarModalOpiniones() {
    const modal = document.getElementById('modal-opinion');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 350);
}

// Estrellas
const starsContainer = document.getElementById('stars-container');
if(starsContainer) {
    starsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'SPAN') {
            puntuacion = parseInt(e.target.dataset.val);
            actualizarEstrellas();
        }
    });
}

function actualizarEstrellas() {
    document.querySelectorAll('#stars-container span').forEach(s => {
        const val = parseInt(s.dataset.val);
        s.style.color = val <= puntuacion ? 'var(--gold)' : '#444';
        s.textContent = val <= puntuacion ? '★' : '☆';
    });
}

async function enviarOpinion() {
    if (puntuacion === 0) { showToast("¡Marca las estrellas!", "warning"); return; }

    const LAST_OPINION = 'last_opinion_ts';
    const lastTime = localStorage.getItem(LAST_OPINION);
    const ahora = Date.now();
    
    if (lastTime && (ahora - parseInt(lastTime)) < 12 * 60 * 60 * 1000) {
        showToast("Solo puedes opinar cada 12 horas.", "warning");
        return;
    }

    const nombre = document.getElementById('cliente-nombre').value || "Anónimo";
    const comentario = document.getElementById('cliente-comentario').value;
    const btn = document.querySelector('#modal-opinion .btn-big-action');

    if(btn) { btn.textContent = "Enviando..."; btn.disabled = true; }

    const { error } = await supabaseClient.from('opiniones').insert([{
        producto_id: productoActual.id,
        cliente_nombre: nombre,
        comentario: comentario, 
        puntuacion: puntuacion
    }]);

    if (!error) {
        localStorage.setItem(LAST_OPINION, ahora.toString());
        showToast("¡Gracias por tu opinión!", "success");
        cerrarModalOpiniones();
        document.getElementById('cliente-comentario').value = "";
        cargarMenu();
    } else {
        showToast("Error: " + error.message, "error");
    }
    
    if(btn) { btn.textContent = "ENVIAR"; btn.disabled = false; }
}

// --- UTILIDADES ---
function setText(id, val) { const el = document.getElementById(id); if(el) el.textContent = val; }

function showToast(msg, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const t = document.createElement('div');
    t.className = `toast ${tipo}`;
    t.innerHTML = `<span class="toast-msg">${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.style.animation = 'fadeOut 0.4s forwards'; setTimeout(() => t.remove(), 400); }, 3000);
}

function updateConnectionStatus() {
    const el = document.getElementById('connection-status');
    const dot = document.getElementById('status-dot');
    if (!el) return;
    if (navigator.onLine) {
        el.textContent = "Conectado"; el.style.color = "var(--green-success)";
        if(dot) dot.style.backgroundColor = "var(--green-success)";
    } else {
        el.textContent = "Offline"; el.style.color = "var(--neon-red)";
        if(dot) dot.style.backgroundColor = "var(--neon-red)";
    }
}

window.addEventListener('online', () => { updateConnectionStatus(); showToast("Conexión restaurada"); cargarMenu(); });
window.addEventListener('offline', () => { updateConnectionStatus(); showToast("Modo Offline", "warning"); });

// ==========================================
// 🌪️ SHAKER VIRTUAL (Mixer IA) - REFACTORIZADO
// ==========================================

function abrirShaker() {
    const modal = document.getElementById('modal-shaker');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    // Reiniciar estado
    shakerState.seleccionados = [];
    renderizarEsencias();
    actualizarEstadoShaker();
    iniciarDetectorMovimiento();
}

function cerrarShaker() {
    const modal = document.getElementById('modal-shaker');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
    detenerDetectorMovimiento();
}

function renderizarEsencias() {
    const grid = document.getElementById('essences-grid');
    grid.innerHTML = '';
    
    ESENCIAS.forEach(esencia => {
        const btn = document.createElement('div');
        btn.className = 'essence-btn';
        btn.innerHTML = `<span>${esencia.icono}</span><small>${esencia.nombre}</small>`;
        btn.onclick = () => toggleEsencia(esencia, btn);
        grid.appendChild(btn);
    });
}

function toggleEsencia(esencia, btnElement) {
    const index = shakerState.seleccionados.indexOf(esencia.nombre);
    
    if (index > -1) {
        shakerState.seleccionados.splice(index, 1);
        btnElement.classList.remove('selected');
    } else {
        if (shakerState.seleccionados.length < 3) {
            shakerState.seleccionados.push(esencia.nombre);
            btnElement.classList.add('selected');
        } else {
            showToast("Máximo 3 ingredientes", "warning");
        }
    }
    actualizarEstadoShaker();
}

function actualizarEstadoShaker() {
    const count = shakerState.seleccionados.length;
    const visual = document.getElementById('shaker-img');
    const status = document.getElementById('shaker-status');
    const btn = document.getElementById('btn-mix-manual');
    const icon = visual.querySelector('.material-icons');

    if (count === 0) {
        status.textContent = "Añade ingredientes...";
        visual.classList.remove('ready');
        icon.style.color = "#ccc";
        btn.disabled = true;
        btn.style.opacity = "0.5";
    } else {
        status.textContent = `${count}/3 Ingredientes`;
        icon.style.color = "white";
        
        if (count >= 1) { 
            visual.classList.add('ready');
            status.textContent = "¡Agita tu móvil o pulsa el botón!";
            status.style.color = "var(--gold)";
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
}

// --- DETECTOR DE AGITACIÓN (SHAKE) ---
function iniciarDetectorMovimiento() {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    activarSensores();
                } else {
                    showToast("Permiso de acelerómetro denegado.", "error");
                }
            })
            .catch(console.error);
    } else {
        activarSensores();
    }
}

function activarSensores() {
    if (window.DeviceMotionEvent) {
        const umbral = 25; 
        let lastX = 0, lastY = 0, lastZ = 0;

        const handleMotion = (event) => {
            if (shakerState.isProcessing) return; 
            if (shakerState.seleccionados.length === 0) return;

            const acc = event.accelerationIncludingGravity;
            if (!acc) return;

            const deltaX = Math.abs(acc.x - lastX);
            const deltaY = Math.abs(acc.y - lastY);
            const deltaZ = Math.abs(acc.z - lastZ);

            if (deltaX + deltaY + deltaZ > umbral) {
                shakerState.shakeCount++;
                document.getElementById('shaker-img').classList.add('shaking');
                
                if (shakerState.shakeCount > 8) {
                    procesarMezcla();
                    shakerState.shakeCount = 0; 
                }
                
                clearTimeout(shakerState.shakeTimer);
                shakerState.shakeTimer = setTimeout(() => {
                    document.getElementById('shaker-img').classList.remove('shaking');
                }, 300);
            }

            lastX = acc.x;
            lastY = acc.y;
            lastZ = acc.z;
        };
        
        window.addEventListener('devicemotion', handleMotion, true);
        watchID = handleMotion;
    }
}

function detenerDetectorMovimiento() {
    if (watchID) {
        window.removeEventListener('devicemotion', watchID, true);
        watchID = null;
    }
}

// --- LOGICA IA CENTRALIZADA ---
async function procesarMezcla() {
    if (shakerState.isProcessing) return;
    
    if (!todosLosProductos || todosLosProductos.length === 0) {
        showToast("Cargando el menú... espera un segundo", "warning");
        return;
    }

    shakerState.isProcessing = true;
    detenerDetectorMovimiento(); 

    const btn = document.getElementById('btn-mix-manual');
    const status = document.getElementById('shaker-status');
    const visual = document.getElementById('shaker-img');
    
    btn.textContent = "Mezclando sabores...";
    status.textContent = "🧠 La IA está probando la mezcla...";
    visual.classList.add('shaking'); 

    try {
        const preferences = {
            tipo: "Bebida",
            sabor: shakerState.seleccionados.join(', ')
        };

        // Usamos el Engine Modular
        const aiResponse = await AiEngine.getRecommendation(URL_SCRIPT, preferences, todosLosProductos);

        if (aiResponse) {
            mostrarResultadoShaker(aiResponse);
        } else {
            throw new Error("Respuesta IA inválida");
        }

    } catch (error) {
        console.error("Fallo IA:", error);
        status.textContent = "Error de conexión. Intenta de nuevo.";
        showToast("La IA está descansando. Recomendación local.", "warning");
        // Fallback en caso de error de red
        mostrarResultadoShaker({ product_id: null, product_name: "" });
    } finally {
        // Corrección del "Cargando infinito": Siempre reseteamos
        shakerState.isProcessing = false;
        visual.classList.remove('shaking');
        btn.textContent = "¡MEZCLAR AHORA!";
        btn.disabled = false;
    }
}

function mostrarResultadoShaker(aiResult) {
    // CORRECCIÓN: Matching robusto
    const match = findProductMatch(todosLosProductos, {
        id: aiResult.product_id,
        name: aiResult.product_name || aiResult.recomendacion
    });

    cerrarShaker();

    if (match) {
        abrirDetalle(match.id);
        showToast(`✨ Combinación perfecta: ${match.nombre}`, "success");
    } else {
        // CORRECCIÓN: Fallback Aleatorio (Evita efecto Mojito índice 0)
        console.warn("Matching falló. Usando random fallback.");
        const randomProd = getRandomProduct(todosLosProductos);
        if (randomProd) {
            abrirDetalle(randomProd.id);
            showToast("¡Sorpresa! Prueba nuestra recomendación de la casa", "info");
        } else {
            showToast("No se encontraron productos.", "error");
        }
    }
}