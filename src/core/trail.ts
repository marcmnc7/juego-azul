import { BUILD } from './release';

// Rastro de la carga, guardado en el propio teléfono: si el navegador cierra la pestaña (por memoria) a medio
// montar un capítulo, al volver a abrir se ve en Ajustes hasta dónde llegó. Cada paso se escribe al momento.

const KEY = 'margaux-trail';
const PREV = 'margaux-trail-prev';
const t0 = Date.now();

function heap() {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return m ? ` ${Math.round(m.usedJSHeapSize / 1e6)}MB` : '';
}

/** Un paso más del arranque o de la carga. */
export function crumb(s: string) {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]') as string[];
    a.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s}${heap()}`);
    localStorage.setItem(KEY, JSON.stringify(a.slice(-40)));
  } catch {
    /* sin almacenamiento: nada */
  }
}

/** Al arrancar: el rastro de la vez anterior pasa a «anterior» y empieza uno nuevo. */
export function startTrail() {
  try {
    const old = localStorage.getItem(KEY);
    if (old) localStorage.setItem(PREV, old);
    localStorage.setItem(KEY, '[]');
  } catch {
    /* nada */
  }
  crumb(`arranque · versión ${BUILD} · ${navigator.userAgent.match(/iPhone OS [\d_]+|Android [\d.]+|Mac OS X [\d_]+/)?.[0] ?? ''} · ${screen.width}x${screen.height}@${devicePixelRatio}`);
}

/** El rastro de la vez anterior (para enseñarlo en Ajustes), o vacío. */
export function previousTrail(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PREV) || '[]') as string[];
  } catch {
    return [];
  }
}
