// Que el juego instalado se vaya poniendo al día solo, sin perder el progreso.
//
// - Al abrir y cada vez que se vuelve a la app (y cada media hora con ella abierta) mira version.json, siempre a
//   internet. Si hay una versión más nueva, el navegador la descarga entera en segundo plano.
// - Ya descargada, se aplica solo en la portada o en el mapa (nunca a mitad de capítulo): aviso, copia del progreso
//   y se recarga.
// - Plan B: si version.json dice que hay algo más nuevo y el navegador no consigue descargarlo (caché atascada, un
//   service worker que no arranca…), se borra la copia guardada del juego y se recarga de internet. El progreso,
//   que va en localStorage, no se toca (y antes se copia aparte, por si acaso).
import { BUILD, READY } from './release';
import { backupSave } from './save';

export interface Latest {
  version: string;
  ready: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let reg: ServiceWorkerRegistration | null = null;
let latest: Latest | null = null;
let ready = false; // hay una versión nueva descargada esperando
let applying = false;
let checking: Promise<void> | null = null;
let stuckTimer = 0;
let isSafe: () => boolean = () => true;
let announce: (msg: string) => void = () => {};

/** Lo último que se sabe de internet (null si aún no se ha mirado o no hay conexión). */
export const latestInfo = () => latest;
/** ¿Esta versión trae ya el capítulo n? */
export const hasChapter = (n: number) => n <= READY;
/** ¿Hay en internet una versión que sí lo trae? */
export const onlineHas = (n: number) => !!latest && latest.ready >= n;
export const updateReady = () => ready;
export const onUpdateChange = (fn: Listener) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach((f) => f());

/** Arranca: registra el service worker y mira si hay algo nuevo. */
export function initUpdater(opts: { safe: () => boolean; toast: (msg: string) => void; enabled: boolean }) {
  isSafe = opts.safe;
  announce = opts.toast;
  if (!opts.enabled || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register('sw.js', { updateViaCache: 'none' })
    .then((r) => {
      reg = r;
      const watch = (w: ServiceWorker | null) => {
        if (!w) return;
        const on = () => {
          // «installed» con otra versión ya funcionando = descargada y esperando
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            ready = true;
            emit();
            tryApply();
          }
        };
        w.addEventListener('statechange', on);
        on();
      };
      watch(r.waiting);
      watch(r.installing);
      r.addEventListener('updatefound', () => watch(r.installing));
      void check();
    })
    .catch((e) => console.warn('[pwa]', e));
  // Cuando la nueva toma el mando, se recarga (solo pasa después de pedírselo nosotros, o en la primera instalación)
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return void (had = true);
    location.reload();
  });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void check());
  window.addEventListener('online', () => void check());
  setInterval(() => document.visibilityState === 'visible' && void check(), 30 * 60 * 1000);
}

/** Mira en internet si hay algo más nuevo (y si lo hay, que se descargue). */
export function check(): Promise<void> {
  if (checking) return checking;
  checking = (async () => {
    try {
      const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) return;
      latest = (await r.json()) as Latest;
      emit();
      if (latest.version === BUILD || !reg) return;
      // Hay una más nueva: que el navegador la busque (con sw.js también sin caché)
      await reg.update().catch(() => {});
      watchStuck();
    } catch {
      /* sin conexión: ya se mirará */
    } finally {
      checking = null;
    }
  })();
  return checking;
}

/** Si en un rato no ha empezado a descargarse nada, plan B. Mientras descarga, se espera lo que haga falta. */
function watchStuck() {
  clearTimeout(stuckTimer);
  stuckTimer = window.setTimeout(() => {
    if (!latest || latest.version === BUILD || ready || applying) return;
    if (reg?.installing) return watchStuck();
    if (isSafe()) void hardRefresh();
  }, 25000);
}

/** En la portada o el mapa: si hay una versión nueva esperando, se aplica. */
export function tryApply() {
  if (!ready || applying || !isSafe() || !reg?.waiting) return;
  applying = true;
  backupSave();
  announce('✨ Hay novedades. Un segundo…');
  const w = reg.waiting;
  setTimeout(() => w.postMessage('skip'), 1200);
  // (si por lo que sea no llega a recargar sola, se recarga igual)
  setTimeout(() => location.reload(), 6000);
}

/** Plan B: fuera la copia del juego guardada en el móvil y a cargarlo de nuevo de internet. El progreso se queda. */
export async function hardRefresh() {
  if (applying) return;
  applying = true;
  backupSave();
  announce('✨ Actualizando el juego…');
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('margaux-')).map((k) => caches.delete(k)));
  } catch {
    /* lo que se pueda */
  }
  location.replace(`./?v=${Date.now()}`);
}
