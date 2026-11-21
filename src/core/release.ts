// La versión publicada: la hora de la compilación (la misma en el código, en sw.js y en version.json). En
// desarrollo, «dev».
declare const __BUILD__: string;
export const BUILD: string = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';

// La versión de la app (la de package.json), la que se enseña en la portada y en el mapa.
declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
