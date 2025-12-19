// sw.js - Service Worker Actualizado y Optimizado v3
const CACHE_NAME = 'bar-v3-modular'; // Incrementamos versión para forzar actualización

// Lista completa de recursos críticos
const ASSETS_TO_CACHE = [
  // App Shell y HTML
  './',
  './index.html',
  './admin.html', // Agregado panel admin
  './login.html',
  
  // Manifiesto
  './manifest.json',

  // Estilos
  './css/style.css',
  './css/modal.css',
  './css/admin.css', // Estilos del admin
  './css/reviews.css',

  // Lógica JavaScript (Módulos y Librerías)
  './js/config.js',
  './js/script.js',
  './js/admin.js',
  './js/libs/supabase.js', // Dependencia crítica
  
  // Nuevos Módulos de IA y Servicios
  './js/services/api.js',
  './js/ai/aiEngine.js',
  './js/ai/aiUtils.js',
  './js/reviews.js',
  './js/metrics.js',

  // Imágenes Locales Críticas
  './img/logo.png',
  './img/icon-192.png',

  // Recursos Externos (Fuentes e Imágenes fijas)
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;800&family=Yellowtail&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=600&q=60'
];

// 1. Instalación: Cachear todo lo estático
self.addEventListener('install', (e) => {
  console.log('[SW] Instalando y cacheando dependencias...');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Forzar activación inmediata
});

// 2. Activación: Limpiar cachés antiguas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Borrando caché antigua:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim(); // Tomar control de clientes abiertos
});

// 3. Estrategias de Interceptación (Fetch)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // A. ESTRATEGIA: Cache First (Stale-While-Revalidate) para IMÁGENES y FUENTES
  // Ideal para assets que no cambian seguido (jpg, png, woff, etc.)
  if (e.request.destination === 'image' || e.request.destination === 'font') {
    e.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(e.request).then((cachedResponse) => {
          const fetchPromise = fetch(e.request).then((networkResponse) => {
            // Actualizar caché en segundo plano si hay internet
            if(networkResponse.ok) cache.put(e.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => {
             // Si falla red, no pasa nada, ya devolvimos caché (o undefined)
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // B. ESTRATEGIA: Network First (con caída a Caché) para HTML, JS y CSS
  // Ideal para la lógica de la App. Intenta obtener lo nuevo; si falla, usa lo guardado.
  // Esto asegura que los usuarios reciban actualizaciones de código (bugfixes) al recargar.
  if (e.request.destination === 'script' || 
      e.request.destination === 'style' || 
      e.request.destination === 'document' ||
      url.pathname.endsWith('.js') || // Seguridad extra para módulos
      e.request.mode === 'navigate') {
    
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          // Si la red responde bien, actualizamos la copia en caché
          if(networkResponse.ok) {
              const resClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Si no hay red, devolvemos lo que haya en caché
          console.log('[SW] Modo Offline: Sirviendo caché para', e.request.url);
          return caches.match(e.request);
        })
    );
    return;
  }

  // C. ESTRATEGIA: Cache First por defecto para cualquier otra cosa
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});