// La versión publicada: la hora de la compilación (la misma en el código, en sw.js y en version.json). En
// desarrollo, «dev».
declare const __BUILD__: string;
export const BUILD: string = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';
