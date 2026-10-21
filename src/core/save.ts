// Progreso guardado en el propio móvil (localStorage), con versión por si cambia el formato.
const KEY = 'margaux-save';
const VERSION = 2; // 2: capítulos en orden real (la piscinita pasa a ser el 2)

export interface SaveData {
  version: number;
  levelsDone: number[];
  giftsUnlocked: string[];
}

const empty = (): SaveData => ({ version: VERSION, levelsDone: [], giftsUnlocked: [] });

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw) as SaveData;
    if (d.version !== VERSION) return empty();
    return d;
  } catch {
    return empty();
  }
}

export function save(d: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* modo privado: el progreso solo dura esta sesión */
  }
}
