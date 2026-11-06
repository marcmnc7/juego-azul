// Progreso guardado en el propio móvil (localStorage), con versión por si cambia el formato.
const KEY = 'margaux-save';
const VERSION = 3; // 2: capítulos en orden real (la piscinita pasa a ser el 2). 3: la moto entra como 5

export interface SaveData {
  version: number;
  levelsDone: number[];
  giftsUnlocked: string[];
  /** Recuerdos escondidos encontrados. */
  found?: string[];
}

const empty = (): SaveData => ({ version: VERSION, levelsDone: [], giftsUnlocked: [] });

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw) as SaveData;
    if (d.version === 2) {
      // Sant Joan y la cena se corren un puesto: la moto pasa a ser el 5
      d.levelsDone = d.levelsDone.map((n) => (n >= 5 ? n + 1 : n));
      d.version = VERSION;
      return d;
    }
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
