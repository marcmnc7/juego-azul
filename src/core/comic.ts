import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { comicBulbTexture, comicTile } from './comicTiles';

// Estilo cómic (cel-shading): la luz en tres tonos planos en vez de en degradado y un contorno de tinta
// alrededor de cada cosa. Se aplica a todos los materiales de una escena (comicScene) en los capítulos que lo
// llevan; los materiales con sombreador propio (la multitud animada en la GPU, el agua, el cielo…) se dejan
// como están, para no romperlos.

export const comic = {
  /** Encendido para el capítulo que se está jugando. */
  on: false,
};

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
function flatMap(t: THREE.Texture) {
  if (flats.has(t.uuid)) return flats.get(t.uuid)!;
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
  flats.set(t.uuid, out);
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

function toToon(src: THREE.Material, person = false): THREE.Material {
  if (isToon.has(src)) return src;
  const hit = converted.get(src);
  if (hit) return hit;
  const s = src as THREE.MeshStandardMaterial;
  // Solo los materiales normales con luz; los que llevan sombreador propio, tal cual
  const lit = s.isMeshStandardMaterial || (src as THREE.MeshLambertMaterial).isMeshLambertMaterial || (src as THREE.MeshPhongMaterial).isMeshPhongMaterial;
  if (!lit || src.onBeforeCompile !== baseCompile) {
    converted.set(src, src);
    return src;
  }
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
  const flat = person && s.map && !tiled && !(s.map as THREE.CanvasTexture).isCanvasTexture ? flatMap(s.map) : null;
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
      const r = flatMap(map);
      if (r === undefined) return false;
      if (r) t.map = r;
      return true;
    });
  }
  return t;
}

/** Materiales cuya textura aún estaba cargando al pasarlos a cómic: se rematan en una pasada posterior. */
const pending = new Set<() => boolean>();
function settlePending() {
  for (const p of pending) if (p()) pending.delete(p);
}

/**
 * Grosor del contorno de tinta: los personajes, más marcado; sin contorno el cielo (cúpula vista por dentro), lo
 * que no lleva luz (brillos, sprites, fondos) y las piezas recortadas por transparencia (pelo, cordones,
 * zapatos de MakeHuman), que con el contorno sacaban picos.
 */
function ink(m: THREE.Material, person: boolean, name: string) {
  if (m.userData.outlineParameters) return;
  // (los zapatos sí: los picos eran de los pesos de piel, ya corregidos)
  const cut = (m.alphaTest > 0 && name !== 'Shoes') || m.transparent;
  // (el mundo lleva la tinta de la pasada de tebeo; el contorno 3D es solo para los personajes)
  if (!person || m.side === THREE.BackSide || !(m as THREE.MeshToonMaterial).isMeshToonMaterial || cut) {
    m.userData.outlineParameters = { visible: false };
  } else if (person) m.userData.outlineParameters = { thickness: 0.0075 };
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
  const lean = 0.024 * y;
  const nx = Math.sin(x * 0.37 + z * 0.21 + 1.3) * Math.cos(z * 0.29 - x * 0.13 + 0.4);
  const nz = Math.sin(z * 0.33 - x * 0.19 + 2.1) * Math.cos(x * 0.27 + z * 0.11 + 1.7);
  const bow = 0.055 * THREE.MathUtils.smoothstep(y, 0, 1.4);
  const sag = THREE.MathUtils.smoothstep(y, 3, 6);
  return out.set(
    lean * nx + bow * Math.sin(y * 0.9 + z * 0.55 + x * 0.1),
    -0.09 * sag * Math.pow(Math.sin(x * 0.8 + 0.3) * Math.sin(z * 0.7 + 1.1), 2),
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
    const g = m.geometry;
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
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    // Brillos (luces de fiesta, halos de farolas): de día, en un tebeo, apenas un punto de color, no un foco
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
        } else if (p.isPoints && pm.size >= 0.6) {
          // halos de las farolas: de día, en un tebeo, no se dibujan
          pm.opacity = 0;
          pm.visible = false;
        } else pm.opacity *= 0.4;
      }
      return;
    }
    if (!m.isMesh || o.userData.noComic) return;
    const person = !!(o as THREE.SkinnedMesh).isSkinnedMesh;
    m.material = Array.isArray(m.material) ? m.material.map((x) => toToon(x, person)) : toToon(m.material, person);
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => ink(x, person, o.name));
  });
  settlePending();
  // Sin reflejo del cielo (los materiales de cómic no lo usan): una luz de cielo y suelo hace de ambiente
  const sc = scene as THREE.Scene;
  if (sc.isScene && !sc.userData.comicSky) {
    // Cielo azul plano de tebeo (el HDRI sin curva de tono salía oscuro)
    sc.background = new THREE.Color(0x76c3f0);
    sc.environment = null;
    sc.userData.comicSky = true;
  }
  // Luces de tebeo: el sol más suave (en tres tonos planos el fuerte quema los colores claros a blanco) y más
  // luz de ambiente, para que las sombras sean un tono más oscuro del color y no un agujero negro
  // (la luz de ambiente del capítulo se queda como esté, que algunos la animan; se suma una propia del cómic)
  if (sc.isScene) {
    sc.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (!l.isDirectionalLight || l.userData.comicLit) return;
      l.userData.comicLit = true;
      l.intensity = Math.min(l.intensity, 2.1);
    });
    if (!sc.userData.comicHemi) {
      sc.add(new THREE.HemisphereLight(0xdff2ff, 0xb59c84, 0.8));
      sc.userData.comicHemi = true;
    }
  }
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
uniform float near, far, linePx, dotPx, action, seed;
varying vec2 vUv;
float rawD(vec2 uv) { return texture2D(tDepth, uv).x; }
float linD(float d) { float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
void main() {
  vec4 c = texture2D(tColor, vUv);
  #ifdef TONE_MAPPING
  c.rgb = toneMapping(c.rgb);
  #endif
  float dc = rawD(vUv);
  if (dc < 1.0) {
    // ---- tinta ----
    float zc = linD(dc);
    // la línea adelgaza con la distancia, como la de un dibujante (lejos, gruesa, emborronaba a la gente)
    vec2 o = texel * max(1.0, linePx * mix(1.0, 0.45, smoothstep(5.0, 22.0, zc)));
    float dl = rawD(vUv - vec2(o.x, 0.0)), dr = rawD(vUv + vec2(o.x, 0.0));
    float du = rawD(vUv + vec2(0.0, o.y)), dd = rawD(vUv - vec2(0.0, o.y));
    // silueta: algún vecino mucho más lejos (la línea queda del lado del objeto de delante)
    float far4 = max(max(linD(dl), linD(dr)), max(linD(du), linD(dd)));
    float sil = smoothstep(0.035, 0.07, (far4 - zc) / zc);
    // arista: la profundidad de pantalla es lineal sobre un plano, así que su laplaciano solo salta donde
    // cambia la orientación de la superficie (una esquina, un alféizar, el borde de una losa elevada)
    float lap = abs(dl + dr - 2.0 * dc) + abs(du + dd - 2.0 * dc);
    float grad = abs(dr - dl) + abs(du - dd);
    // (umbral alto: las superficies curvas, como un cuerpo, también tienen algo de laplaciano y se llenaban de rayas)
    float crease = smoothstep(0.8, 1.3, lap / (grad + 1e-6)) * step(1e-6, lap) * (1.0 - smoothstep(22.0, 40.0, zc));
    float ink = max(sil, crease);
    // ---- trama ----
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    float pl = pow(max(l, 0.0), 1.0 / 2.2);
    float amt = smoothstep(0.52, 0.22, pl) * (1.0 - 0.5 * smoothstep(12.0, 30.0, zc));
    vec2 g = gl_FragCoord.xy / dotPx;
    vec2 r = vec2(g.x + g.y, g.y - g.x) * 0.7071;
    float dist = length(fract(r) - 0.5);
    float rad = 0.5 * sqrt(amt);
    float dotm = (1.0 - smoothstep(rad - 0.07, rad + 0.07, dist)) * step(0.02, amt);
    c.rgb *= 1.0 - dotm * 0.3;
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
    c.rgb *= 1.0 - (1.0 - smoothstep(rad - 0.07, rad + 0.07, dist)) * step(0.02, amt) * 0.16;
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
/** Líneas de acción de un golpe o un acierto (0..1); se apagan solas en un tercio de segundo. */
export function comicBurst(amount: number) {
  if (amount > burst) burstSeed++;
  burst = Math.max(burst, amount);
}
const lastCam = new THREE.Vector3();
let lastT = 0;
let speedAmt = 0;

let outline: OutlineEffect | null = null;
/** Dibuja en estilo cómic (sustituye al postproceso en los capítulos de cómic). */
export function drawComic(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  // contorno 3D solo en los personajes (más grueso que la tinta de las aristas); el resto, en la pasada
  outline ??= new OutlineEffect(renderer, { defaultThickness: 0.0045, defaultColor: [0.012, 0.009, 0.014], defaultAlpha: 1 });
  pass ??= makePass(renderer);
  renderer.getDrawingBufferSize(size);
  if (pass.rt.width !== size.x || pass.rt.height !== size.y) pass.rt.setSize(size.x, size.y);
  const pr = renderer.getPixelRatio();
  const u = pass.mat.uniforms;
  u.texel.value.set(1 / size.x, 1 / size.y);
  const pc = camera as THREE.PerspectiveCamera;
  u.near.value = pc.near ?? 0.1;
  u.far.value = pc.far ?? 1000;
  u.linePx.value = Math.max(1.5, pr * 1.35);
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
  // las rayas de velocidad cambian a saltos (8 por segundo), como dibujadas a mano; las de golpe, por golpe
  u.seed.value = burst > speedAmt ? burstSeed * 7 : Math.floor(now * 8);
  renderer.autoClear = true;
  renderer.setRenderTarget(pass.rt);
  outline.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(pass.quad, pass.cam);
}
