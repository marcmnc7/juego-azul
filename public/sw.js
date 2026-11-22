// Para Azul sin conexión: la primera vez se guarda el juego entero (el HTML y los archivos de assets/: modelos,
// música, fotos) y después se abre desde el móvil al momento. Cada versión publicada cambia VERSION y se descarga
// una vez. La lista de assets la rellena la compilación (vite.config.ts).
//
// Actualizar sin romper nada: una versión nueva se descarga entera en segundo plano y ESPERA. No se pone en marcha
// hasta que el juego se lo pide (mensaje «skip»), y el juego solo lo pide en la portada o en el mapa, nunca a mitad
// de capítulo (si no, la partida en curso pediría archivos de la versión vieja que ya no estarían). El progreso no
// vive aquí: va en el localStorage del juego y esto no lo toca.
const VERSION = '__VERSION__';
const CACHE = 'margaux-' + VERSION;
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', '__ASSETS__'].filter((f) => f !== '__ASSETS__');

self.addEventListener('install', (e) => {
  // Los archivos de assets/ llevan su huella en el nombre: los que ya estaban en una versión anterior se copian de
  // allí (no se vuelven a bajar los cientos de MB de modelos y vídeos en cada actualización); solo se baja lo nuevo
  e.waitUntil(
    caches
      .open(CACHE)
      .then(async (c) => {
        const old = (await caches.keys()).filter((k) => k.startsWith('margaux-') && k !== CACHE);
        const fresh = [];
        for (const f of FILES) {
          let hit = null;
          if (f.includes('assets/') || f.includes('map/')) for (const k of old) if ((hit = await (await caches.open(k)).match(f))) break;
          if (hit) await c.put(f, hit);
          else fresh.push(f);
        }
        await c.addAll(fresh);
      })
      // La primera vez (no hay ninguna versión funcionando) se pone en marcha directamente
      .then(() => (self.registration.active ? undefined : self.skipWaiting())),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('margaux-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // version.json, siempre a internet: es lo que dice si hay algo más nuevo
  if (new URL(req.url).pathname.endsWith('/version.json')) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match('./index.html') : null);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }),
  );
});
