import * as THREE from 'three';
import { comicBulbTexture, comicHaloTexture, comicTile } from './comicTiles';
import { glowOn, surfaceShader } from './comicSurfaces';

// Estilo cómic (cel-shading), el único del juego: la luz en tres tonos planos en vez de en degradado y un
// contorno de tinta alrededor de cada cosa. Se aplica a todos los materiales de cada escena (comicScene); los
// materiales con sombreador propio (la multitud animada en la GPU, el agua, el cielo…) se dejan como están.

/** Perfil de luz de tebeo: cada capítulo dice el suyo (main.ts, LOOKS) y una escena puede pedir otro. */
export type ComicLook = 'dia' | 'noche' | 'interior' | 'atardecer';

export const comic = {
  /** Perfil del capítulo en marcha (scene.userData.comicLook manda sobre él). */
  look: 'dia' as ComicLook,
};

/**
 * Luz que añade el cómic en cada perfil: una hemisférica (cielo, suelo, intensidad final) y el tope de las
 * direccionales. La de día es exactamente la del capítulo 1 (1,35 × 0,35 del reparto que hacía su HDRI).
 */
export const LOOK_LIGHT: Record<ComicLook, { sky: number; ground: number; hemi: number; sunMax: number; background: number | null }> = {
  dia: { sky: 0xdff2ff, ground: 0xb59c84, hemi: 1.35 * 0.35, sunMax: 2.1, background: 0x76c3f0 },
  // (de noche, la luna manda, como el sol de día: cara iluminada clara y sombra azul intenso; con mucha luz de
  // ambiente todo salía del mismo lila plano)
  noche: { sky: 0x5a6fc0, ground: 0x1a1830, hemi: 0.55, sunMax: 2.5, background: null },
  interior: { sky: 0xfff4e6, ground: 0x8a7a6a, hemi: 0.9, sunMax: 1.4, background: null },
  atardecer: { sky: 0xffd2a8, ground: 0x6a4a5a, hemi: 0.55, sunMax: 1.8, background: null },
};
const lookOf = (sc: THREE.Object3D) => (sc.userData.comicLook as ComicLook | undefined) ?? comic.look;

const ramps = new Map<string, THREE.DataTexture>();
/**
 * Los tres tonos de la luz: sombra, media luz y luz. Los personajes, con la sombra más clara: en la cara, una
 * sombra muy oscura cortaba los rasgos con una mancha.
 */
function gradient(person = false) {
  const steps = person ? [188, 228, 255] : [90, 170, 255];
  const key = steps.join();
  let ramp = ramps.get(key);
  if (ramp) return ramp;
  const d = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => d.set([v, v, v, 255], i * 4));
  ramp = new THREE.DataTexture(d, steps.length, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  ramps.set(key, ramp);
  return ramp;
}

const means = new WeakMap<THREE.Texture, THREE.Color>();
/** Color medio de una textura (en lineal, como los colores de los materiales). */
function meanColor(t: THREE.Texture) {
  const hit = means.get(t);
  if (hit) return hit;
  const c = new THREE.Color(1, 1, 1);
  const img = t.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
  if (img && (img as HTMLImageElement).width) {
    try {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 16;
      const g = cv.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img as CanvasImageSource, 0, 0, 16, 16);
      const d = g.getImageData(0, 0, 16, 16).data;
      let r = 0, gg = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      c.setRGB(r / n / 255, gg / n / 255, b / n / 255, t.colorSpace === THREE.SRGBColorSpace ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace);
    } catch {
      /* textura sin imagen legible: blanco */
    }
  }
  means.set(t, c);
  return c;
}

type Img = HTMLImageElement | HTMLCanvasElement | ImageBitmap;
const ready = (t?: THREE.Texture | null) => {
  const img = t?.image as Img | undefined;
  return !!img && (img as HTMLImageElement).width > 0;
};
/** Píxeles de una textura a w×h. */
function pixels(t: THREE.Texture, w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(t.image as CanvasImageSource, 0, 0, w, h);
  return { cv, g, id: g.getImageData(0, 0, w, h) };
}
/** Desenfoque de caja separable, con la textura repetida en los bordes (son losetas que se repiten). */
function boxBlur(src: Float32Array, w: number, h: number, ch: number, r: number) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++)
    for (let c = 0; c < ch; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[(y * w + ((k + w) % w)) * ch + c];
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * ch + c] = acc / n;
        acc += src[(y * w + ((x + r + 1) % w)) * ch + c] - src[(y * w + ((x - r + w) % w)) * ch + c];
      }
    }
  for (let x = 0; x < w; x++)
    for (let c = 0; c < ch; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[(((k + h) % h) * w + x) * ch + c];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * ch + c] = acc / n;
        acc += tmp[(((y + r + 1) % h) * w + x) * ch + c] - tmp[(((y - r + h) % h) * w + x) * ch + c];
      }
    }
  return out;
}

const drawn = new Map<string, THREE.Texture | null>();
/**
 * La foto de un material (losas, estuco, tejas, madera) pasada a dibujo de tebeo: el color aplanado (sin el grano
 * de la foto), el relieve en dos tonos planos (luz de arriba a la izquierda, sacada del mapa de normales) y una
 * línea de tinta en las juntas y las grietas. undefined mientras alguna de las dos imágenes está cargando; null si
 * no se puede leer.
 */
function drawnMap(t: THREE.Texture, nrm?: THREE.Texture | null) {
  const key = t.uuid + (nrm ? nrm.uuid : '');
  if (drawn.has(key)) return drawn.get(key)!;
  if (!ready(t) || (nrm && !ready(nrm))) return undefined;
  let out: THREE.Texture | null = null;
  try {
    const img = t.image as HTMLImageElement;
    const w = Math.min(512, img.width), h = Math.min(512, img.height);
    const { cv, g, id } = pixels(t, w, h);
    const d = id.data, N = w * h;
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) col[i * 3 + k] = d[i * 4 + k];
    // color: sin grano (desenfoque fuerte) y con la mitad de las manchas de la foto
    const flat = boxBlur(boxBlur(col, w, h, 3, 3), w, h, 3, 2);
    const mean = [0, 0, 0];
    for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) mean[k] += flat[i * 3 + k] / N;
    const lum = new Float32Array(N);
    for (let i = 0; i < N; i++) lum[i] = 0.3 * col[i * 3] + 0.59 * col[i * 3 + 1] + 0.11 * col[i * 3 + 2];
    const meanL = 0.3 * mean[0] + 0.59 * mean[1] + 0.11 * mean[2] || 1;
    // relieve y juntas: del mapa de normales si lo hay; si no, de lo oscuro de la foto
    const shade = new Float32Array(N).fill(1);
    const ink = new Float32Array(N);
    if (nrm) {
      const nd = pixels(nrm, w, h).id.data;
      const L = new THREE.Vector3(-0.45, 0.55, 0.7).normalize();
      const nz = new Float32Array(N), dl = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const nx = nd[i * 4] / 127.5 - 1, ny = nd[i * 4 + 1] / 127.5 - 1, z = nd[i * 4 + 2] / 127.5 - 1;
        const len = Math.hypot(nx, ny, z) || 1;
        nz[i] = z / len;
        dl[i] = (nx * L.x + ny * L.y + z * L.z) / len;
      }
      const dls = boxBlur(dl, w, h, 1, 2);
      void nz;
      for (let i = 0; i < N; i++) shade[i] = dls[i] > 0.9 ? 1.05 : dls[i] < 0.7 ? 0.85 : 1;
    }
    // tinta en los bordes marcados del dibujo (marcos, rejas, juntas anchas), no en el grano de la foto:
    // gradiente de la luminancia ya desenfocada, con umbral fijo
    const ls = boxBlur(lum, w, h, 1, 2);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const at = (xx: number, yy: number) => ls[((yy + h) % h) * w + ((xx + w) % w)];
        const gx = at(x + 1, y) - at(x - 1, y), gy = at(x, y + 1) - at(x, y - 1);
        const gm = Math.hypot(gx, gy);
        ink[y * w + x] = gm > 34 ? 1 : gm > 22 ? (gm - 22) / 12 : 0;
      }
    const keep = 0.45;
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < 3; k++) {
        let v = mean[k] + (flat[i * 3 + k] - mean[k]) * keep;
        v *= shade[i];
        // la tinta es un tono muy oscuro del propio color (no negro: dentro del objeto la línea es más fina)
        v = v * (1 - ink[i]) + v * 0.42 * ink[i];
        d[i * 4 + k] = Math.max(0, Math.min(255, v));
      }
      d[i * 4 + 3] = 255;
    }
    void meanL;
    g.putImageData(id, 0, 0);
    {
      const c = new THREE.CanvasTexture(cv);
      c.colorSpace = t.colorSpace;
      c.wrapS = t.wrapS;
      c.wrapT = t.wrapT;
      c.repeat.copy(t.repeat);
      c.offset.copy(t.offset);
      c.center.copy(t.center);
      c.rotation = t.rotation;
      c.anisotropy = t.anisotropy;
      c.flipY = t.flipY;
      out = c;
    }
  } catch {
    out = null;
  }
  drawn.set(key, out);
  return out;
}

const flats = new Map<string, THREE.Texture | null>();
/**
 * Textura de un personaje (piel, ropa) aplanada para el tebeo: quita el detalle flojo de la foto (arrugas de la
 * camiseta, grano del vaquero, poros) y respeta lo que tiene contraste fuerte (cejas, labios, costuras, logotipos,
 * el borde de la ropa). undefined mientras carga.
 */
function flatMap(t: THREE.Texture, cloth = false) {
  const key = t.uuid + (cloth ? 'c' : '');
  if (flats.has(key)) return flats.get(key)!;
  if (!ready(t)) return undefined;
  let out: THREE.Texture | null = null;
  try {
    const img = t.image as HTMLImageElement;
    const w = Math.min(1024, img.width), h = Math.min(1024, img.height);
    const { cv, g, id } = pixels(t, w, h);
    const d = id.data, N = w * h;
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) col[i * 3 + k] = d[i * 4 + k];
    const fine = boxBlur(col, w, h, 3, 1);
    const R = Math.max(3, Math.round(w / 110));
    const broad = boxBlur(boxBlur(fine, w, h, 3, R), w, h, 3, R);
    // ropa: también fuera el sombreado grande que trae pintado (pliegues, desgaste del vaquero): color liso
    const wide = cloth ? boxBlur(boxBlur(broad, w, h, 3, R * 4), w, h, 3, R * 4) : null;
    if (wide) for (let i = 0; i < N * 3; i++) broad[i] = wide[i] + (broad[i] - wide[i]) * 0.3;
    for (let i = 0; i < N; i++) {
      const dl = 0.3 * (fine[i * 3] - broad[i * 3]) + 0.59 * (fine[i * 3 + 1] - broad[i * 3 + 1]) + 0.11 * (fine[i * 3 + 2] - broad[i * 3 + 2]);
      const a = Math.abs(dl);
      // lo flojo (menos de ~14 niveles) casi fuera; lo marcado (más de ~42) entero
      const keep = a < 14 ? 0.12 : a > 42 ? 1 : 0.12 + ((a - 14) / 28) * 0.88;
      for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.max(0, Math.min(255, broad[i * 3 + k] + (fine[i * 3 + k] - broad[i * 3 + k]) * keep));
    }
    g.putImageData(id, 0, 0);
    const c = new THREE.CanvasTexture(cv);
    c.colorSpace = t.colorSpace;
    c.wrapS = t.wrapS;
    c.wrapT = t.wrapT;
    c.repeat.copy(t.repeat);
    c.offset.copy(t.offset);
    c.flipY = t.flipY;
    c.anisotropy = t.anisotropy;
    out = c;
  } catch {
    out = null;
  }
  flats.set(key, out);
  return out;
}

/** La textura dibujada con la repetición y el desplazamiento de la foto a la que sustituye. */
function withRepeat(tile: THREE.Texture, like: THREE.Texture) {
  const t = tile.clone();
  t.repeat.copy(like.repeat);
  t.offset.copy(like.offset);
  t.center.copy(like.center);
  t.rotation = like.rotation;
  return t;
}

const converted = new WeakMap<THREE.Material, THREE.Material>();
const isToon = new WeakSet<THREE.Material>();
const baseCompile = THREE.Material.prototype.onBeforeCompile;

function toToon(src: THREE.Material, person = false, cloth = false): THREE.Material {
  if (isToon.has(src)) return src;
  const hit = converted.get(src);
  if (hit) return hit;
  const s = src as THREE.MeshStandardMaterial;
  // Todo material con luz pasa a cómic. Si lleva sombreador propio: el del grano y la foto de superficie se
  // tira (es justo lo que no queremos); los demás (la animación de la multitud, la ropa de verano pintada, el
  // corte del pelo) tocan trozos que el material de cómic también tiene, y se le pasan tal cual
  const lit = s.isMeshStandardMaterial || (src as THREE.MeshLambertMaterial).isMeshLambertMaterial || (src as THREE.MeshPhongMaterial).isMeshPhongMaterial;
  if (!lit) {
    converted.set(src, src);
    return src;
  }
  const carry = src.onBeforeCompile !== baseCompile;
  // decorado de toon() / Merger: el dibujo de tebeo de su superficie, proyectado en el mundo (comicSurfaces.ts)
  const grain = !!src.userData.grain;
  const surf = (src.userData.surf as number | undefined) ?? 0;
  // Las texturas que se repiten (paredes, suelo, tejados: fotos de material) se suavizan: queda el dibujo de las
  // losas o las tejas, pero flojo, como trazo; si no se pueden leer, su color medio. Las que son un dibujo suelto
  // (carteles, pancartas, caras, ropa) se quedan
  const tiled = !!s.map && (s.map.wrapS === THREE.RepeatWrapping || s.map.wrapT === THREE.RepeatWrapping) && !s.vertexColors;
  const color = s.color.clone();
  // las fotos del pueblo tienen su dibujo hecho a mano (comicTiles); el resto, la foto pasada a dibujo
  const tile = tiled && s.map!.userData.comic ? comicTile(s.map!.userData.comic as string) : null;
  const soft = tile ? withRepeat(tile, s.map!) : tiled ? drawnMap(s.map!, s.normalMap) : null;
  if (tiled && soft === null) color.multiply(meanColor(s.map!));
  // la piel y la ropa de los personajes, sin el detalle flojo de la foto
  // (las que el juego ya pinta en un lienzo, como la de Azul, salen lisas de origen en el cómic)
  const flat = person && s.map && !tiled && !(s.map as THREE.CanvasTexture).isCanvasTexture ? flatMap(s.map, cloth) : null;
  const t = new THREE.MeshToonMaterial({
    color,
    // textura que aún no ha llegado: la original mientras tanto, y se cambia cuando se pueda leer
    map: tiled ? soft ?? (soft === undefined ? s.map : null) : flat ?? s.map,
    alphaMap: s.alphaMap,
    emissive: s.emissive,
    emissiveMap: s.emissiveMap,
    emissiveIntensity: s.emissiveIntensity,
    gradientMap: gradient(person),
    transparent: s.transparent,
    opacity: s.opacity,
    alphaTest: s.alphaTest,
    side: s.side,
    depthWrite: s.depthWrite,
    vertexColors: s.vertexColors,
    fog: s.fog,
  });
  t.name = s.name;
  t.userData = s.userData;
  t.polygonOffset = s.polygonOffset;
  t.polygonOffsetFactor = s.polygonOffsetFactor;
  t.polygonOffsetUnits = s.polygonOffsetUnits;
  // Los personajes se marcan en el canal alfa de la imagen (0.5): la pasada de tebeo no les pone ni tinta de
  // aristas ni trama (en las caras eran manchas y rayas); su línea es solo su contorno, fino
  const mark = person && !t.transparent;
  // Pintura de coche (laca con barniz): en el tebeo, el brillo se dibuja: una mancha blanca donde refleja la luna o
  // el sol y una raya clara donde refleja el horizonte (ver comicGloss)
  const ph = src as THREE.MeshPhysicalMaterial;
  const paint = !!ph.isMeshPhysicalMaterial && ph.clearcoat >= 0.9 && ph.metalness >= 0.5 && !ph.transparent;
  {
    const prev = carry ? src.onBeforeCompile : null;
    const prevKey = carry ? src.customProgramCacheKey.bind(src) : () => '';
    t.onBeforeCompile = (sh, r) => {
      prev?.call(src, sh, r);
      bandedLights(sh);
      if (grain) surfaceShader(sh, surf);
      if (mark) sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n\tgl_FragColor.a = 0.5;');
      if (paint) sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', COMIC_GLOSS + '\n#include <opaque_fragment>');
    };
    t.customProgramCacheKey = () => prevKey() + '|band' + (grain ? '|cs' + surf : '') + (mark ? '|pmask' : '') + (paint ? '|gloss' : '');
  }
  isToon.add(t);
  converted.set(src, t);
  if (tiled && soft === undefined) {
    const map = s.map!, nrm = s.normalMap;
    pending.add(() => {
      const r = drawnMap(map, nrm);
      if (r === undefined) return false;
      if (r) t.map = r;
      else {
        t.map = null;
        t.color.multiply(meanColor(map));
      }
      return true;
    });
  }
  if (flat === undefined) {
    const map = s.map!;
    pending.add(() => {
      const r = flatMap(map, cloth);
      if (r === undefined) return false;
      if (r) t.map = r;
      return true;
    });
  }
  return t;
}

/**
 * Brillo dibujado de la pintura de los coches: donde la superficie refleja la luz principal (sol o luna), una mancha
 * blanca de borde duro; donde refleja el horizonte, una raya clara a lo largo de la carrocería, como la pinta un
 * dibujante. Sin esto, un coche de tebeo era un bloque de color plano.
 */
const COMIC_GLOSS = /* glsl */ `
  {
    vec3 gV = normalize(vViewPosition);
    vec3 gR = reflect(-gV, normalize(normal));
    vec3 gRw = (vec4(gR, 0.0) * viewMatrix).xyz;
    float gHorizon = step(0.03, gRw.y) * step(gRw.y, 0.17);
    float gHot = 0.0;
    #if NUM_DIR_LIGHTS > 0
      gHot = step(0.96, dot(gR, directionalLights[0].direction));
    #endif
    float gL = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
    outgoingLight = mix(outgoingLight, mix(outgoingLight, vec3(1.0), 0.5) + 0.06, gHorizon * (1.0 - gHot));
    outgoingLight = mix(outgoingLight, vec3(max(1.0, gL)), gHot);
  }`;

/**
 * Las luces de punto y de foco (farolas, el porche, la luz de la piscina) en bandas: su luz baja a saltos con la
 * distancia, en anillos de color plano, como un charco de luz dibujado, en vez de en degradado.
 */
const LIGHTS_BANDED = THREE.ShaderChunk.lights_fragment_begin
  .replace('getPointLightInfo( pointLight, geometryPosition, directLight );', 'getPointLightInfo( pointLight, geometryPosition, directLight );\n\t\tdirectLight.color = comicBand( directLight.color );')
  .replace('getSpotLightInfo( spotLight, geometryPosition, directLight );', 'getSpotLightInfo( spotLight, geometryPosition, directLight );\n\t\tdirectLight.color = comicBand( directLight.color );');
function bandedLights(sh: THREE.WebGLProgramParametersWithUniforms) {
  sh.fragmentShader = sh.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      vec3 comicBand(vec3 c) {
        float m = max(max(c.r, c.g), c.b);
        // (tres anillos como mucho, y el de dentro con tope: un charco de luz dibujado, no una diana ni una
        // mancha quemada a blanco junto a la bombilla)
        if (m < 0.12) return vec3(0.0);
        float q = m >= 1.2 ? 1.5 : m >= 0.4 ? 0.65 : 0.25;
        return c * (q / m);
      }`,
    )
    .replace('#include <lights_fragment_begin>', LIGHTS_BANDED);
}

/** Materiales cuya textura aún estaba cargando al pasarlos a cómic: se rematan en una pasada posterior. */
const pending = new Set<() => boolean>();
function settlePending() {
  for (const p of pending) if (p()) pending.delete(p);
}

/**
 * Desplazamiento «a mano alzada» de un punto del mundo: las paredes se inclinan un poco (más cuanto más altas),
 * se comban y los tejados ceden por el medio, como en los pueblos de los tebeos. Es un campo suave en
 * coordenadas del mundo: todas las piezas de una casa se mueven igual en el mismo sitio, sin abrir grietas, y a
 * ras de suelo no mueve nada (las colisiones y los pies de la gente siguen donde estaban).
 */
function handOffset(p: THREE.Vector3, out: THREE.Vector3) {
  const { x, y, z } = p;
  if (y <= 0.02) return out.set(0, 0, 0);
  const lean = 0.03 * y;
  const nx = Math.sin(x * 0.37 + z * 0.21 + 1.3) * Math.cos(z * 0.29 - x * 0.13 + 0.4);
  const nz = Math.sin(z * 0.33 - x * 0.19 + 2.1) * Math.cos(x * 0.27 + z * 0.11 + 1.7);
  const bow = 0.075 * THREE.MathUtils.smoothstep(y, 0, 1.4);
  const sag = THREE.MathUtils.smoothstep(y, 3, 6);
  // (y las líneas horizontales, cornisas, alféizares, aleros, ondulan un poco: nada queda a regla)
  const wave = 0.05 * THREE.MathUtils.smoothstep(y, 0.4, 2) * Math.sin(x * 1.1 + z * 0.9 + 0.7);
  return out.set(
    lean * nx + bow * Math.sin(y * 0.9 + z * 0.55 + x * 0.1),
    wave - 0.12 * sag * Math.pow(Math.sin(x * 0.8 + 0.3) * Math.sin(z * 0.7 + 1.1), 2),
    lean * nz + bow * Math.sin(y * 0.8 + x * 0.6 - z * 0.1),
  );
}

/** Dobla a mano alzada lo fijo y grande del decorado (una vez por pieza; nunca personas ni geometría compartida). */
function handDrawn(scene: THREE.Object3D) {
  const users = new Map<THREE.BufferGeometry, number>();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) users.set(m.geometry, (users.get(m.geometry) ?? 0) + 1);
  });
  const p = new THREE.Vector3(), d = new THREE.Vector3(), inv = new THREE.Matrix4();
  scene.updateMatrixWorld();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.comicBent || (m as THREE.SkinnedMesh).isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh) return;
    if (o.parent?.userData.sky || o.userData.noComic || users.get(m.geometry)! > 1) return;
    m.userData.comicBent = true;
    // (lo que va dentro de algo que se mueve, como un coche o la hoja de una puerta, no se dobla: viajaría torcido)
    for (let a = o.parent; a; a = a.parent) if (a.userData.comicBent) return;
    const g = m.geometry;
    // (una geometría que se reutiliza de una en una, como los obstáculos de la carretera, solo se dobla una vez)
    if (g.userData.comicBent) return;
    g.userData.comicBent = true;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (g.boundingSphere!.radius * o.matrixWorld.getMaxScaleOnAxis() < 0.8) return;
    const pos = g.attributes.position as THREE.BufferAttribute;
    inv.copy(o.matrixWorld).invert();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      p.add(handOffset(p, d)).applyMatrix4(inv);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    g.computeBoundingSphere();
    g.computeBoundingBox();
  });
}

/** Pasa la escena al estilo cómic (se puede llamar varias veces: lo ya convertido se queda). */
export function comicScene(scene: THREE.Object3D) {
  handDrawn(scene);
  const night = lookOf(scene) !== 'dia';
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    // Brillos (luces de fiesta, halos de farolas, luciérnagas)
    const p = o as THREE.Points;
    if ((p.isPoints || (o as THREE.Sprite).isSprite) && !o.parent?.userData.sky) {
      const pm = p.material as THREE.PointsMaterial;
      if (pm.blending === THREE.AdditiveBlending && !pm.userData.comicGlow) {
        pm.userData.comicGlow = true;
        if (p.isPoints && pm.map && pm.vertexColors && pm.size >= 0.6 && p.geometry.attributes.position.count >= 100) {
          // guirnaldas de bombillas: cada una, un círculo de color con su aro de tinta
          pm.map = comicBulbTexture();
          pm.blending = THREE.NormalBlending;
          pm.alphaTest = 0.5;
          pm.depthWrite = true;
          pm.opacity = 1;
          pm.size *= 0.32;
          pm.needsUpdate = true;
        } else if (night) {
          // de noche son la luz: núcleo con su aro de tinta y anillos planos del color de la luz
          pm.map = comicHaloTexture();
          pm.blending = THREE.NormalBlending;
          pm.transparent = true;
          pm.depthWrite = false;
          pm.needsUpdate = true;
        } else if (p.isPoints && pm.size >= 0.6) {
          // halos de las farolas: de día, en un tebeo, no se dibujan
          pm.opacity = 0;
          pm.visible = false;
        } else pm.opacity *= 0.4;
      }
      return;
    }
    if (!m.isMesh) return;
    if (o.userData.noComic) return;
    const person = !!(o as THREE.SkinnedMesh).isSkinnedMesh || (!!(o as THREE.InstancedMesh).isInstancedMesh && !!o.userData.person);
    const cloth = person && /^(Shirt|Pants|PantsShort|Shoes)$/.test(o.name);
    m.material = Array.isArray(m.material) ? m.material.map((x) => toToon(x, person, cloth)) : toToon(m.material, person, cloth);
  });
  settlePending();
  const sc = scene as THREE.Scene;
  if (sc.isScene && !sc.userData.comicHemi) {
    // Sin reflejo del cielo (los materiales de cómic no lo usan): una luz de cielo y suelo hace de ambiente.
    // (fuerte: en la sombra de la pared, la gente proyectaba una silueta casi negra que parecía un fantasma)
    sc.environment = null;
    const hemi = new THREE.HemisphereLight();
    hemi.userData.comicHemi = true;
    sc.add(hemi);
    sc.userData.comicHemi = hemi;
    comicMood(sc, lookOf(sc));
  }
  // Las luces nuevas (un sol que se añade más tarde) también con su tope
  if (sc.isScene) clampSuns(sc, LOOK_LIGHT[lookOf(sc)].sunMax);
}

/** El sol más suave (en tres tonos planos, el fuerte quema los colores claros a blanco). */
function clampSuns(sc: THREE.Object3D, max: number) {
  sc.traverse((o) => {
    const l = o as THREE.DirectionalLight;
    if (!l.isDirectionalLight || l.userData.comicLit === max) return;
    l.userData.comicLit = max;
    l.intensity = Math.min(l.intensity, max);
  });
}

/**
 * Cambia el perfil de luz de una escena ya convertida (un capítulo que pasa del día a la noche, Barajas de día
 * en el capítulo de Fito). La hemisférica del cómic queda en scene.userData.comicHemi: los niveles que oscurecen
 * a propósito la pueden bajar.
 */
export function comicMood(scene: THREE.Scene, look: ComicLook) {
  scene.userData.comicLook = look;
  const L = LOOK_LIGHT[look];
  const hemi = scene.userData.comicHemi as THREE.HemisphereLight | undefined;
  if (hemi) {
    hemi.color.setHex(L.sky);
    hemi.groundColor.setHex(L.ground);
    hemi.intensity = L.hemi;
  }
  // Fondo azul plano de tebeo detrás de la cúpula (el HDRI sin curva de tono salía oscuro)
  if (L.background !== null && !(scene.background instanceof THREE.Texture)) scene.background = new THREE.Color(L.background);
  clampSuns(scene, L.sunMax);
  glowOn.value = look === 'dia' ? 0 : 1;
}

// ---------- Pasada de tebeo ----------
// Sobre la imagen ya dibujada: tinta en todas las aristas (no solo en la silueta: esquinas de las casas,
// balcones, bordillos), sacada de la profundidad; trama de puntos de imprenta en lo oscuro, y el color un poco
// más vivo, como impreso. Es una sola pasada a pantalla completa.

const PASS_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const PASS_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float near, far, linePx, dotPx, action, seed, flash;
uniform vec3 flashCol;
varying vec2 vUv;
float rawD(vec2 uv) { return texture2D(tDepth, uv).x; }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float linD(float d) { float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
void main() {
  vec4 c = texture2D(tColor, vUv);
  #ifdef TONE_MAPPING
  c.rgb = toneMapping(c.rgb);
  #endif
  float dc = rawD(vUv);
  // personaje (marcado en el alfa): sin tinta de aristas ni trama, solo el color de imprenta
  bool person = c.a < 0.75;
  if (dc < 1.0 && person) {
    float lp = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    c.rgb = max(mix(vec3(lp), c.rgb, 1.12), 0.0);
    // su línea: solo la silueta (donde detrás hay algo lejos), fina; nada por dentro de la cara ni de la ropa
    float zp = linD(dc);
    vec2 op = texel * max(1.0, linePx * 0.75 * mix(1.0, 0.6, smoothstep(4.0, 18.0, zp)));
    float fp = max(max(linD(rawD(vUv - vec2(op.x, 0.0))), linD(rawD(vUv + vec2(op.x, 0.0)))), max(linD(rawD(vUv + vec2(0.0, op.y))), linD(rawD(vUv - vec2(0.0, op.y)))));
    float silp = smoothstep(0.06, 0.12, (fp - zp) / zp);
    c.rgb = mix(c.rgb, vec3(0.045, 0.035, 0.055), silp * 0.9);
  } else if (dc < 1.0) {
    // ---- tinta ----
    // trazo a mano: la línea ondula un poco (el punto donde se mira la profundidad se desplaza con un ruido
    // suave) y cambia de grosor como con la presión del plumín
    vec2 px = gl_FragCoord.xy / linePx;
    vec2 wob = (vec2(vnoise(px * 0.045), vnoise(px * 0.045 + 17.3)) - 0.5) * texel * linePx * 2.6;
    float pressure = 0.7 + 0.6 * vnoise(px * 0.03 + 5.1);
    vec2 uv = vUv + wob;
    dc = rawD(uv);
    float zc = linD(dc);
    // la línea adelgaza con la distancia, como la de un dibujante (lejos, gruesa, emborronaba a la gente)
    vec2 o = texel * max(1.0, linePx * pressure * mix(1.0, 0.4, smoothstep(4.0, 16.0, zc)));
    float dl = rawD(uv - vec2(o.x, 0.0)), dr = rawD(uv + vec2(o.x, 0.0));
    float du = rawD(uv + vec2(0.0, o.y)), dd = rawD(uv - vec2(0.0, o.y));
    // silueta: algún vecino mucho más lejos (la línea queda del lado del objeto de delante)
    float far4 = max(max(linD(dl), linD(dr)), max(linD(du), linD(dd)));
    float sil = smoothstep(0.035, 0.07, (far4 - zc) / zc);
    // arista: la profundidad de pantalla es lineal sobre un plano, así que su laplaciano solo salta donde
    // cambia la orientación de la superficie (una esquina, un alféizar, el borde de una losa elevada)
    float lap = abs(dl + dr - 2.0 * dc) + abs(du + dd - 2.0 * dc);
    float grad = abs(dr - dl) + abs(du - dd);
    // (umbral alto: las superficies curvas, como un cuerpo, también tienen algo de laplaciano y se llenaban de rayas)
    float crease = smoothstep(0.8, 1.3, lap / (grad + 1e-6)) * step(1e-6, lap) * (1.0 - smoothstep(22.0, 40.0, zc));
    // (al lado de algo que está delante, como una persona, el salto de profundidad no es una arista de esta
    // superficie: sin esto la gente llevaba un halo negro gordo)
    float near4 = min(min(linD(dl), linD(dr)), min(linD(du), linD(dd)));
    crease *= 1.0 - smoothstep(0.02, 0.04, (zc - near4) / zc);
    // (de base algo más suave, y más aún a lo lejos, donde las líneas se amontonan)
    float ink = max(sil, crease * 0.8) * mix(1.0, 0.6, smoothstep(10.0, 30.0, zc));
    // ---- trama ----
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    float pl = pow(max(l, 0.0), 1.0 / 2.2);
    float amt = smoothstep(0.52, 0.22, pl) * (1.0 - 0.5 * smoothstep(12.0, 30.0, zc));
    vec2 g = gl_FragCoord.xy / dotPx;
    vec2 r = vec2(g.x + g.y, g.y - g.x) * 0.7071;
    float dist = length(fract(r) - 0.5);
    float rad = 0.5 * sqrt(amt);
    float dotm = (1.0 - smoothstep(rad - 0.07, rad + 0.07, dist)) * step(0.02, amt);
    // (sin trama de puntos: se veía como un filtro de cuadraditos en todo el juego)
    c.rgb *= 1.0 - dotm * 0.0;
    // ---- color de imprenta ----
    float l2 = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    c.rgb = max(mix(vec3(l2), c.rgb, 1.18), 0.0);
    c.rgb = mix(c.rgb, vec3(0.045, 0.035, 0.055), ink);
  } else {
    // cielo: trama de puntos que se aprieta hacia arriba, como los cielos de imprenta
    float amt = smoothstep(0.35, 1.0, vUv.y) * 0.55;
    vec2 g = gl_FragCoord.xy / (dotPx * 1.3);
    vec2 r = vec2(g.x + g.y, g.y - g.x) * 0.7071;
    float dist = length(fract(r) - 0.5);
    float rad = 0.5 * sqrt(amt);
    c.rgb *= 1.0;
  }
  // líneas de acción: rayas radiales desde el borde, al dar un golpe o al ir deprisa
  if (action > 0.01) {
    vec2 q = (vUv - 0.5) * vec2(texel.y / texel.x, 1.0);
    float rr = length(q) / length(vec2(0.5 * texel.y / texel.x, 0.5));
    float a = atan(q.y, q.x) / 6.28318 * 90.0;
    float id = floor(a);
    float h = fract(sin(id * 91.7 + floor(seed) * 13.1) * 43758.5);
    float w = abs(fract(a) - 0.5);
    float start = 0.42 + 0.3 * h - 0.18 * action;
    float line = step(0.55, h) * smoothstep(start, start + 0.25, rr) * (1.0 - smoothstep(0.012 + 0.06 * rr, 0.03 + 0.07 * rr, w));
    c.rgb = mix(c.rgb, vec3(0.045, 0.035, 0.055), line * action * 0.8);
  }
  // papel: lo blanco tira a crema, como impreso
  c.rgb *= vec3(1.0, 0.978, 0.93);
  // destello (aciertos, fotos, sorpresas): un golpe de color plano que se apaga
  c.rgb = mix(c.rgb, flashCol, flash);
  gl_FragColor = vec4(c.rgb, 1.0);
  #include <colorspace_fragment>
}`;

interface Pass {
  rt: THREE.WebGLRenderTarget;
  mat: THREE.ShaderMaterial;
  quad: THREE.Mesh;
  cam: THREE.OrthographicCamera;
}
let pass: Pass | null = null;
const size = new THREE.Vector2();

function makePass(renderer: THREE.WebGLRenderer): Pass {
  renderer.getDrawingBufferSize(size);
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    // con mucha densidad de píxeles (el móvil) el dentado no se nota y el antialias cuesta mucha memoria
    samples: renderer.getPixelRatio() >= 2 ? 0 : 4,
    depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType),
  });
  const mat = new THREE.ShaderMaterial({
    vertexShader: PASS_VERT,
    fragmentShader: PASS_FRAG,
    uniforms: {
      tColor: { value: rt.texture },
      tDepth: { value: rt.depthTexture },
      texel: { value: new THREE.Vector2() },
      near: { value: 0.1 },
      far: { value: 1000 },
      linePx: { value: 1 },
      dotPx: { value: 5 },
      action: { value: 0 },
      seed: { value: 0 },
      flash: { value: 0 },
      flashCol: { value: new THREE.Color() },
    },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  return { rt, mat, quad, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
}

let burst = 0;
let burstSeed = 0;
let flash = 0;
const flashCol = new THREE.Color();
/** Destello de pantalla (aciertos, fotos, sorpresas): lo usa juice. */
export function comicFlash(color: number, amount: number) {
  flashCol.setHex(color);
  flash = Math.max(flash, amount);
}
/** Líneas de acción de un golpe o un acierto (0..1); se apagan solas en un tercio de segundo. */
export function comicBurst(amount: number) {
  if (amount > burst) burstSeed++;
  burst = Math.max(burst, amount);
}
const lastCam = new THREE.Vector3();
let lastT = 0;
let speedAmt = 0;

/** Dibuja un fotograma en estilo cómic: la escena y, encima, la pasada de tinta, papel y líneas de acción. */
export function drawComic(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  pass ??= makePass(renderer);
  renderer.getDrawingBufferSize(size);
  if (pass.rt.width !== size.x || pass.rt.height !== size.y) pass.rt.setSize(size.x, size.y);
  const pr = renderer.getPixelRatio();
  const u = pass.mat.uniforms;
  u.texel.value.set(1 / size.x, 1 / size.y);
  const pc = camera as THREE.PerspectiveCamera;
  u.near.value = pc.near ?? 0.1;
  u.far.value = pc.far ?? 1000;
  u.linePx.value = Math.max(1.3, pr * 1.12);
  u.dotPx.value = 4.2 * pr;
  // líneas de velocidad: a partir de ~5 m/s de cámara (en burro, en moto, en coche); más el golpe que se apaga
  const now = performance.now() / 1000;
  const dt = Math.min(0.1, Math.max(1e-3, now - lastT));
  const v = lastT ? camera.position.distanceTo(lastCam) / dt : 0;
  lastT = now;
  lastCam.copy(camera.position);
  // (un salto de cámara de un plano a otro no es velocidad)
  const target = v > 40 ? speedAmt : THREE.MathUtils.smoothstep(v, 5, 11) * 0.7;
  speedAmt += (target - speedAmt) * Math.min(1, dt * 4);
  burst = Math.max(0, burst - dt * 3);
  u.action.value = Math.max(speedAmt, burst);
  // (más suave que el del cine: sobre papel, un blanco entero se come el dibujo)
  u.flash.value = flash * 0.6;
  (u.flashCol.value as THREE.Color).copy(flashCol);
  flash = Math.max(0, flash - dt * 2.8);
  // las rayas de velocidad cambian a saltos (8 por segundo), como dibujadas a mano; las de golpe, por golpe
  u.seed.value = burst > speedAmt ? burstSeed * 7 : Math.floor(now * 8);
  renderer.autoClear = true;
  renderer.setRenderTarget(pass.rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(pass.quad, pass.cam);
}

let poolTex: THREE.CanvasTexture | null = null;
/**
 * Charco de luz de tebeo en el suelo (bajo una farola): dos discos planos del color de la luz, el de dentro más
 * fuerte, con el borde un poco a mano. Sale casi gratis (una malla plana) y hace lo que una luz de verdad por
 * cada farola costaría en el móvil.
 */
export function comicLightPool(x: number, y: number, z: number, radius: number, color = 0xffe0a0, strength = 1) {
  if (!poolTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const disc = (r: number, a: number) => {
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.beginPath();
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * Math.PI * 2;
        const rr = r * (1 + 0.025 * Math.sin(t * 5 + r) + 0.015 * Math.sin(t * 11));
        g.lineTo(128 + Math.cos(t) * rr, 128 + Math.sin(t) * rr);
      }
      g.fill();
    };
    disc(124, 0.45);
    disc(70, 0.55);
    poolTex = new THREE.CanvasTexture(c);
    poolTex.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: poolTex, color, transparent: true, opacity: 0.32 * strength, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  );
  m.position.set(x, y, z);
  m.userData.noComic = true;
  m.renderOrder = 1;
  return m;
}

let fanTex: THREE.CanvasTexture | null = null;
/**
 * Abanico de luz de tebeo: un trapecio plano que nace estrecho en la lámpara (o en la ventana, o en el faro) y se
 * abre, fuerte cerca y más flojo lejos, en dos tonos. En el plano XY: el lado estrecho en y = 0 y el ancho en
 * y = -len. Para el suelo, girarlo con rotation.x = -π/2 (se abre hacia +z); para una pared, dejarlo de pie
 * (se abre hacia abajo) y girarlo con rotation.y hacia fuera de la pared.
 */
export function comicLightFan(nearW: number, farW: number, len: number, color = 0xffe0a0, strength = 1) {
  if (!fanTex) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(0, 0, 16, 56);
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(0, 56, 16, 66);
    fanTex = new THREE.CanvasTexture(c);
    fanTex.colorSpace = THREE.SRGBColorSpace;
    fanTex.magFilter = THREE.NearestFilter;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-nearW / 2, 0, 0, nearW / 2, 0, 0, farW / 2, -len, 0, -farW / 2, -len, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  geo.setIndex([0, 2, 1, 0, 3, 2]);
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ map: fanTex, color, transparent: true, opacity: 0.6 * strength, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  );
  m.userData.noComic = true;
  m.renderOrder = 1;
  return m;
}
