// Qué trae cada versión publicada. Al publicar un capítulo nuevo, sube READY: la compilación lo copia a
// version.json, y el juego no deja abrir (aunque ya sea su día) un capítulo que su versión todavía no trae:
// primero se actualiza.

/** Hasta qué capítulo está terminado en esta versión. */
export const READY = 6;

declare const __BUILD__: string;
/** Número de la versión (la hora de la compilación, en milisegundos; en desarrollo, «dev»). */
export const BUILD: string = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';
