// Al empezar cada capítulo (ya cargado), una vista de satélite como la de los mapas del móvil: el sitio escrito en
// la barra de búsqueda, el mapa que baja desde toda España hasta la calle donde pasó, la chincheta que cae y un
// fundido que entra en el capítulo. Las imágenes van dentro del juego (public/map, de Esri World Imagery): funciona
// sin conexión. Mientras dura, el capítulo espera (main.ts lo tiene en pausa).

interface Spot {
  lat: number;
  lon: number;
  /** Lo que sale escrito en la barra de búsqueda. */
  label: string;
}

const SPOTS: Record<number, Spot> = {
  1: { lat: 39.983, lon: 4.0099, label: "Pla de l'Església, Ferreries" },
  2: { lat: 40.000536, lon: 3.836986, label: 'Imperi, Plaça des Born, Ciutadella' },
  3: { lat: 40.3916408, lon: -3.6902907, label: 'Calle del Ónice, Madrid' },
  4: { lat: 40.491359, lon: -3.59212, label: 'Aeropuerto Madrid-Barajas T4' },
  5: { lat: 41.4083879, lon: 2.1712518, label: 'Carrer de Lepant, Barcelona' },
  6: { lat: 40.002447, lon: 3.839522, label: 'Plaça Nova, Ciutadella' },
  7: { lat: 39.997691, lon: 3.822223, label: 'Camí de sa Farola, Ciutadella' },
  8: { lat: 39.9956483, lon: 3.8257729, label: 'Castell de Sant Nicolau, Ciutadella' },
  9: { lat: 39.983, lon: 4.0099, label: "Pla de l'Església, Ferreries" },
};

const Z0 = 5;
const Z1 = 17;
/** La caja (px CSS) que cubren las imágenes descargadas en cada nivel: más grande no hay foto. */
const BOX_W = 460 / 0.7;
const BOX_H = 1000 / 0.7;
const TYPE_MS = 1100;
const ZOOM_MS = 7600;

const url = (z: number, x: number, y: number) => `map/${z}/${x}/${y}.jpg`;

function px(lat: number, lon: number, z: number) {
  const n = 256 * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lon + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
}

/** Las imágenes de un nivel que tiene el juego para este sitio. */
function tilesAt(s: Spot, z: number) {
  const c = px(s.lat, s.lon, z);
  const out: [number, number, number][] = [];
  const n = 2 ** z;
  for (let tx = Math.floor((c.x - BOX_W / 2) / 256); tx <= Math.floor((c.x + BOX_W / 2) / 256); tx++)
    for (let ty = Math.floor((c.y - BOX_H / 2) / 256); ty <= Math.floor((c.y + BOX_H / 2) / 256); ty++) if (ty >= 0 && ty < n) out.push([z, ((tx % n) + n) % n, ty]);
  return out;
}

/** Se bajan (o se leen de la caché) mientras carga el capítulo: así el vuelo va fino desde el primer fotograma. */
export async function preloadMap(n: number) {
  const s = SPOTS[n];
  if (!s) return;
  const all: string[] = [];
  for (let z = Z0; z <= Z1; z++) for (const [a, b, c] of tilesAt(s, z)) all.push(url(a, b, c));
  let i = 0;
  const worker = async () => {
    while (i < all.length) {
      const u = all[i++];
      try {
        await fetch(u);
      } catch {
        /* sin esa imagen se ve la del nivel de antes, ampliada */
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}

// El vuelo: arranca suave, va rápido por arriba y frena largo al llegar al sitio (como cuando el mapa «aterriza»)
const fly = (t: number) => 1 - (1 - t * t * (3 - 2 * t)) ** 1.7;
const easeIn = (t: number) => t * t * t;
const easeInOut = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;

export function hasMapIntro(n: number) {
  return !!SPOTS[n];
}

/**
 * El vuelo: `onReveal` cuando empieza el fundido (el capítulo puede ponerse en marcha) y `onDone` al acabar.
 * Tocar la pantalla lo adelanta al final.
 */
export function mapIntro(n: number, onReveal: () => void, onDone: () => void) {
  const s = SPOTS[n];
  const root = document.getElementById('ui')!;
  if (!s) {
    onReveal();
    onDone();
    return;
  }
  const o = document.createElement('div');
  o.className = 'map-intro';
  const cv = document.createElement('canvas');
  const bar = document.createElement('div');
  bar.className = 'mi-search';
  bar.innerHTML = '<span class="mi-lens"></span><span class="mi-q"></span><span class="mi-caret"></span>';
  const scale = document.createElement('div');
  scale.className = 'mi-scale';
  scale.innerHTML = '<span></span><b></b>';
  const credit = document.createElement('div');
  credit.className = 'mi-credit';
  credit.textContent = 'Imágenes © Esri, Maxar, Earthstar Geographics';
  o.append(cv, bar, scale, credit);
  root.append(o);
  const q = bar.querySelector('.mi-q') as HTMLElement;
  const scaleBar = scale.querySelector('span') as HTMLElement;
  const scaleTxt = scale.querySelector('b') as HTMLElement;
  const ctx = cv.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
  };
  resize();
  window.addEventListener('resize', resize);

  // Imágenes cargadas (solo las de los niveles de alrededor del que se ve: el resto se suelta)
  const imgs = new Map<string, HTMLImageElement>();
  const want = (z: number) => {
    if (z < Z0 || z > Z1) return;
    for (const [a, b, c] of tilesAt(s, z)) {
      const k = `${a}/${b}/${c}`;
      if (imgs.has(k)) continue;
      const im = new Image();
      im.decoding = 'async';
      im.src = url(a, b, c);
      imgs.set(k, im);
    }
  };
  const drop = (keepFrom: number) => {
    for (const [k, im] of imgs) {
      if (Number(k.split('/')[0]) < keepFrom) {
        im.src = '';
        imgs.delete(k);
      }
    }
  };
  const drawLevel = (L: number, z: number) => {
    const k = 2 ** (z - L);
    const c = px(s.lat, s.lon, L);
    for (const [a, b, cc] of tilesAt(s, L)) {
      const im = imgs.get(`${a}/${b}/${cc}`);
      if (!im || !im.complete || !im.naturalWidth) continue;
      const sx = (b * 256 - c.x) * k + W / 2, sy = (cc * 256 - c.y) * k + H / 2, sz = 256 * k;
      if (sx > W || sy > H || sx + sz < 0 || sy + sz < 0) continue;
      ctx.drawImage(im, sx * dpr, sy * dpr, sz * dpr + 1, sz * dpr + 1);
    }
  };
  // La barra de escala, como en los mapas: un número redondo de metros o kilómetros
  const paintScale = (z: number) => {
    const mpp = (156543.03 * Math.cos((s.lat * Math.PI) / 180)) / 2 ** z;
    const max = 90 * mpp;
    const p = 10 ** Math.floor(Math.log10(max));
    const nice = [5, 2, 1].map((m) => m * p).find((v) => v <= max) ?? p;
    scaleBar.style.width = `${(nice / mpp).toFixed(0)}px`;
    scaleTxt.textContent = nice >= 1000 ? `${nice / 1000} km` : `${nice} m`;
  };

  want(Z0);
  want(Z0 + 1);
  // (empieza cuando el rótulo del capítulo ya se está yendo)
  const t0 = performance.now() + 900;
  let raf = 0;
  let skipAt = Infinity;
  let revealed = false;
  let finished = false;
  // Todo en un solo movimiento: el mapa baja frenando poco a poco y, sin pararse, se va deshaciendo en el capítulo
  // (desenfoque y transparencia suaves) mientras sigue acercándose
  const total = TYPE_MS + ZOOM_MS;
  const FADE_AT = 0.68;
  let fadeStart = Infinity;
  let fadeLen = (1 - FADE_AT) * ZOOM_MS;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const t = Math.max(0, now - t0);
    // 1) Se escribe el sitio en la barra
    const typed = Math.min(1, t / TYPE_MS);
    const shown = s.label.slice(0, Math.ceil(typed * s.label.length));
    if (q.textContent !== shown) q.textContent = shown;
    bar.classList.toggle('done', typed >= 1);
    // 2) El vuelo: de España entera a la calle, cada vez más despacio (sigue un poco más allá de Z1 mientras se funde)
    const zt = Math.max(0, Math.min(1, (t - TYPE_MS) / ZOOM_MS));
    const z = Z0 + (Z1 + 0.9 - Z0) * fly(zt);
    // 3) El fundido, en marcha (tocar la pantalla lo adelanta: empieza ya y dura menos)
    if (fadeStart === Infinity && (t >= TYPE_MS + FADE_AT * ZOOM_MS || skipAt !== Infinity)) {
      fadeStart = now;
      if (skipAt !== Infinity) fadeLen = 1100;
      o.classList.add('diving');
      if (!revealed) {
        revealed = true;
        onReveal();
      }
    }
    let p = 0;
    if (fadeStart !== Infinity) {
      p = Math.min(1, (now - fadeStart) / fadeLen);
      const a = 1 - easeInOut(p);
      cv.style.opacity = a.toFixed(3);
      cv.style.filter = `blur(${(easeIn(p) * 8).toFixed(1)}px)`;
      o.style.backgroundColor = `rgba(11,42,61,${(a * a * a).toFixed(3)})`;
      if (p >= 1) finish();
    }
    const L = Math.max(Z0, Math.min(Z1, Math.floor(z + 0.5)));
    want(L);
    want(Math.min(Z1, L + 1));
    drop(L - 1);
    ctx.fillStyle = '#0b2a3d';
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (L - 1 >= Z0) drawLevel(L - 1, z);
    drawLevel(L, z);
    if (p === 0) paintScale(z);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    for (const im of imgs.values()) im.src = '';
    imgs.clear();
    o.remove();
    onDone();
  };
  o.onpointerdown = (e) => {
    e.stopPropagation();
    if (skipAt === Infinity) skipAt = Math.max(0, performance.now() - t0);
  };
  raf = requestAnimationFrame(frame);
  // (por si la pestaña está oculta y no hay fotogramas: nunca se queda colgado)
  setTimeout(() => {
    if (!revealed) {
      revealed = true;
      onReveal();
    }
    finish();
  }, total + 5000);
}
