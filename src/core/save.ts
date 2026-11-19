// Progreso guardado en el propio móvil (localStorage), con versión por si cambia el formato.
const KEY = 'margaux-save';
const VERSION = 3; // 2: capítulos en orden real (la piscinita pasa a ser el 2). 3: la moto entra como 5

export interface SaveData {
  version: number;
  levelsDone: number[];
  giftsUnlocked: string[];
  /** Recuerdos escondidos encontrados. */
  found?: string[];
  /** Los «conecta» (juegos de entre capítulos) hechos. */
  minis?: string[];
}

const empty = (): SaveData => ({ version: VERSION, levelsDone: [], giftsUnlocked: [] });

/** Copia del progreso aparte (antes de cada actualización y con cada guardado), por si el principal se estropea. */
const BACKUP = KEY + '-backup';

export function backupSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) localStorage.setItem(BACKUP, raw);
  } catch {
    /* nada */
  }
}

function parse(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as SaveData;
    return d && Array.isArray(d.levelsDone) ? d : null;
  } catch {
    return null;
  }
}

export function load(): SaveData {
  try {
    // El principal y, si falta o está roto, la copia
    const d = parse(localStorage.getItem(KEY)) ?? parse(localStorage.getItem(BACKUP));
    if (!d) return empty();
    if (d.version === 2) {
      // Sant Joan y la cena se corren un puesto: la moto pasa a ser el 5
      d.levelsDone = d.levelsDone.map((n) => (n >= 5 ? n + 1 : n));
      d.version = VERSION;
      return d;
    }
    // (una versión que no se conoce no se tira: se conserva lo que haya, que el progreso no se pierda nunca)
    if (d.version !== VERSION) return { ...empty(), ...d, version: VERSION };
    return d;
  } catch {
    return empty();
  }
}

export function save(d: SaveData) {
  try {
    const raw = JSON.stringify(d);
    localStorage.setItem(KEY, raw);
    localStorage.setItem(BACKUP, raw);
  } catch {
    /* modo privado: el progreso solo dura esta sesión */
  }
}
