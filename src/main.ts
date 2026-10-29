import { audio, type Bed } from './core/audio';
import * as THREE from 'three';
import './ui/style.css';
import { Input } from './core/input';
import { requestJump, releaseJump, walkerActiveAt, lastBounds } from './core/walker';
import { dust } from './core/dust';
import { beacon } from './core/beacon';
import { physLists } from './core/phys';
import { load, save } from './core/save';
import { giftForLevel } from './data/gifts';
import { Level1 } from './world/level1';
import { Level2 } from './world/level2';
import { Level3 } from './world/level3';
import { Level4 } from './world/level4';
import { LevelSantJoan } from './world/levelSantJoan';
import { LevelCena } from './world/levelCena';
import { LevelMoto } from './world/levelMoto';
import { LevelEclipse } from './world/levelEclipse';
import { LevelAniversario } from './world/levelAniversario';
import { LetterScene } from './world/letterScene';
import type { Level, LevelResult } from './world/level';
import { applyEnvironment, applyShadows, hdSurfaces, quality, removeEnvironment, setEnvRenderer, Sky, toon } from './core/gfx';
import { loadHdPhotos, loadSurfacePhotos } from './core/surfaces';
import { clearRigPeople, preloadRig, updateRigPeople } from './entities/rig';
import { preloadCrowd } from './entities/crowdRig';
import { preloadDonkey } from './entities/donkeyHD';
import { preloadVehicles } from './entities/vehiclesHD';
import { preloadHdri } from './core/assets';
import { hdEnvDefault } from './core/gfx';
import sunsetHdr from './assets/env/venice_sunset.hdr';
import quarryHdr from './assets/env/quarry.hdr';
import { Post, GRADES, NEUTRAL, type Grade } from './core/post';
import { paintPalette, paintScene, paintStyle } from './core/paint';
import { juice } from './core/juice';
import { cinema } from './core/cinema';
import { titleScreen, mapScreen, showGift, clearScreens, finalLetter, crossword, debugPanel, closeDialogue, newEpoch, chapterCard, memories, setSpeakerResolver } from './ui/ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = quality.shadows;

// Modo seguro. ?lite arranca sin grano, sin luz de entorno y sin postproceso. Y si en este
// dispositivo algún shader no compila (cada GPU es más o menos estricta), se quitan esos efectos
// uno a uno hasta que todo se vea.
if (new URLSearchParams(location.search).has('lite')) {
  quality.grain = false;
  quality.env = false;
  quality.post = false;
}
let shaderFailed = false;
renderer.debug.onShaderError = (gl, program, vs, fs) => {
  shaderFailed = true;
  console.warn('[gfx] shader no compila en este dispositivo:', gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs));
};
function safeStep() {
  shaderFailed = false;
  if (quality.grain) quality.grain = false;
  else if (quality.env) quality.env = false;
  else if (quality.post) quality.post = false;
  else return;
  console.warn('[gfx] modo seguro:', JSON.stringify(quality));
  const sc = level ? level.threeScene : null;
  if (!sc) return;
  if (!quality.env) removeEnvironment(sc);
  sc.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => (x.needsUpdate = true));
  });
}
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const maxRatio = Math.min(window.devicePixelRatio || 1, 2);
let ratio = Math.min(maxRatio, 1.5);
renderer.setPixelRatio(ratio);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
setEnvRenderer(renderer);

/**
 * Autocomprobación al arrancar: dibuja un cubo verde con los mismos efectos que el juego en una
 * imagen diminuta y mira si de verdad sale verde. Si en este dispositivo no se ve (hay GPUs que no
 * dan error pero no pintan), se van quitando efectos hasta que se vea.
 */
const gfxLog: string[] = [];
function gfxSelfTest(mode: 'game' | 'basic' | 'uv' = 'game'): boolean {
  const sc = new THREE.Scene();
  const sky = new Sky({ top: 0x4060ff, mid: 0x6080ff, bottom: 0x8090ff });
  sc.add(sky.group);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(1, 3, 2);
  sun.castShadow = quality.shadows;
  sc.add(sun);
  sc.fog = new THREE.Fog(0x8090ff, 30, 200);
  // Igual que el decorado del juego: geometría sin UV y con colores por vértice
  const geo = new THREE.BoxGeometry(2, 2, 2);
  if (mode !== 'uv') geo.deleteAttribute('uv');
  const col = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) col.set([0.19, 0.75, 0.31], i);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = mode === 'basic' ? new THREE.MeshBasicMaterial({ vertexColors: true }) : mode === 'uv' ? toon({ color: 0x30c050 }) : toon({ vertexColors: true });
  const box = new THREE.Mesh(geo, mat);
  box.position.y = 3; // por encima de la suciedad del pie de las paredes
  box.castShadow = box.receiveShadow = true;
  sc.add(box);
  applyEnvironment(sc);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  cam.position.set(0, 3, 5);
  cam.lookAt(0, 3, 0);
  const rt = new THREE.WebGLRenderTarget(16, 16);
  const px = new Uint8Array(4);
  try {
    renderer.setRenderTarget(rt);
    renderer.render(sc, cam);
    renderer.readRenderTargetPixels(rt, 8, 8, 1, 1, px);
  } catch (e) {
    console.warn('[gfx] autocomprobación', e);
  }
  renderer.setRenderTarget(null);
  rt.dispose();
  geo.dispose();
  mat.dispose();
  sc.environment?.dispose();
  const ok = px[1] > px[0] + 25 && px[1] > px[2] + 10;
  gfxLog.push(`${mode === 'game' ? (quality.grain ? 'G' : '-') + (quality.env ? 'E' : '-') + (quality.shadows ? 'S' : '-') + quality.kind[0].toUpperCase() : mode}:${px[0]},${px[1]},${px[2]}`);
  if (!ok) console.warn('[gfx] autocomprobación falla', Array.from(px), JSON.stringify(quality));
  return ok;
}
// Orden de preferencia: lo más realista primero. Se queda con lo primero que se vea de verdad.
const gfxTries: Array<Partial<typeof quality>> = [
  { kind: 'standard', grain: true, env: true },
  { kind: 'standard', grain: false, env: true },
  { kind: 'standard', grain: false, env: false },
  { kind: 'phong', grain: true, env: false },
  { kind: 'phong', grain: false, env: false },
  { kind: 'lambert', grain: false, env: false },
];
let gfxOk = false;
for (const t of gfxTries) {
  Object.assign(quality, t);
  if ((gfxOk = gfxSelfTest())) break;
}
if (!gfxOk) {
  quality.shadows = false;
  renderer.shadowMap.enabled = false;
}
if (!gfxOk || quality.kind === 'lambert') {
  // Nota discreta unos segundos para saber qué ha pasado si alguien manda una captura
  const note = document.createElement('div');
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '?';
  note.textContent = `gráficos: modo seguro ${quality.grain ? 'G' : '-'}${quality.env ? 'E' : '-'}${quality.shadows ? 'S' : '-'}${quality.kind[0].toUpperCase()} · ${gfxLog.join(' ')} · ${gpu.slice(0, 60)}`;
  note.style.cssText = 'position:fixed;left:8px;bottom:6px;font:11px monospace;color:#fff;opacity:.75;right:8px;word-break:break-all;z-index:99;pointer-events:none;text-shadow:0 1px 2px #000';
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 25000);
}
renderer.info.autoReset = false;

// Postproceso de cine (ver core/post.ts): oclusión ambiental, profundidad de campo en los diálogos,
// bloom, tono y etalonaje por capítulo.
const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
const post = new Post(renderer, camera, MOBILE);
juice.fx = post;
audio.onCue = (c) => juice.cue(c);
let cine = 0;
function draw(scene: THREE.Scene, dt = 1 / 60) {
  if (!quality.post) {
    renderer.render(scene, camera);
    return;
  }
  post.draw(scene, dt);
}
const input = new Input(canvas, uiRoot);

// Saltar: botón en pantalla (solo mientras se controla a alguien andando) y tecla J en el ordenador
const jumpBtn = document.createElement('button');
jumpBtn.className = 'jump-btn';
jumpBtn.textContent = 'Saltar';
jumpBtn.hidden = true;
jumpBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  requestJump();
});
// Soltar pronto = salto corto; mantener = salto entero
for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) jumpBtn.addEventListener(ev, () => releaseJump());
uiRoot.append(jumpBtn);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyJ' && !e.repeat) requestJump();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyJ') releaseJump();
});
let data = load();

let level: Level | null = null;
let levelAt = 0;
let closeDebug: (() => void) | null = null;
// Bocadillos de diálogo: quién es quién en cada capítulo (los niveles guardan a los personajes con estos nombres)
const SPEAKERS: Record<string, string[]> = {
  Azul: ['azul', 'player'], Margaux: ['azul', 'player'], Gas: ['gas', 'marc'], Marc: ['marc', 'gas'],
  Carme: ['carme'], Tòfol: ['tofol'], Camarero: ['barman'],
};
const _head = new THREE.Vector3();
const lastSpeaker = { pos: new THREE.Vector3(), at: 0 };
setSpeakerResolver((who) => {
  const L = level as unknown as Record<string, { root?: THREE.Object3D; head?: THREE.Object3D; rig?: { bones: Map<string, THREE.Object3D> } }> | null;
  if (!L) return null;
  for (const f of SPEAKERS[who] ?? []) {
    const p = L[f];
    if (!p?.root || !p.head) continue;
    // Tiene que estar en la escena y visible
    let o: THREE.Object3D | null = p.root;
    while (o && o.visible && o.parent) o = o.parent;
    if (!o || !o.visible || !(o as THREE.Scene).isScene) continue;
    const bone = p.rig?.bones.get('Head') ?? p.head;
    bone.getWorldPosition(_head);
    lastSpeaker.pos.copy(_head);
    lastSpeaker.at = performance.now();
    if (_head.distanceTo(camera.position) > 22) return null;
    _head.y += 0.32 * (p.root.scale.y || 1);
    _head.project(camera);
    if (_head.z > 1 || Math.abs(_head.x) > 0.95 || Math.abs(_head.y) > 1.1) return null;
    return { x: (_head.x * 0.5 + 0.5) * window.innerWidth, y: (-_head.y * 0.5 + 0.5) * window.innerHeight };
  }
  return null;
});
const idle = new THREE.Scene();
idle.background = new THREE.Color(0x2b1840);

// Modo prueba: abrir el enlace terminado en #test (o ?debug en local).
// ?hq desactiva la bajada automática de calidad (para capturas)
const HQ = new URLSearchParams(location.search).has('hq');
const TEST = location.hash === '#test' || new URLSearchParams(location.search).has('debug');

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  post.setSize(w, h);
  camera.aspect = w / h;
  // En vertical abrimos más el plano para que se vea algo de calle
  camera.fov = w < h ? 75 : 60;
  camera.userData.baseFov = camera.fov;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

const mapOpts = {
  test: TEST,
  onPlay: (n: number) => startLevel(n),
  onLetter: () => startLetter(),
  onReset: () => {
    data = { version: data.version, levelsDone: [], giftsUnlocked: [] };
    save(data);
    mapScreen(data, mapOpts);
  },
};

/** Cierra el capítulo en marcha (si lo hay) y todo lo que tenga encima: diálogo, panel de prueba y botón de saltar. */
function leaveLevel() {
  cinema.stop();
  beacon.at(null);
  uiRoot.classList.remove('filming');
  closeDebug?.();
  closeDebug = null;
  closeDialogue();
  newEpoch();
  if (level) {
    level.dispose();
    level = null;
  }
  clearRigPeople();
  jumpBtn.hidden = true;
  input.reset();
  input.enabled = true;
}

/** La carta final, como escena: de noche sobre el mar, con las fotos flotando y la carta a mano. */
function startLetter() {
  leaveLevel();
  clearScreens();
  audio.bed('none');
  setHd(true, 2); // la luz pintada de noche
  const me = new LetterScene(camera, goMap, () => finalLetter(() => clearScreens()));
  level = me;
  applyShadows(me.threeScene);
  if (paintStyle.value) paintScene(me.threeScene);
  levelAt = performance.now();
  if (TEST) closeDebug = debugPanel(me.debug());
}

function goMap() {
  leaveLevel();
  audio.bed('none');
  setHd(false);
  mapScreen(data, mapOpts);
}

// En orden real: Ferreries, la piscinita la noche siguiente, el road trip, Fito, la moto por la Costa Brava,
// Sant Joan, la cena a escondidas, el eclipse y, un año después, otra vez Ferreries
// Las texturas fotográficas se cargan ya, mientras se ve la portada
// Personajes glTF y multitud horneada (para los capítulos con la calidad de la prueba)
let hdAssets = false;
// Pantalla de carga: la portada no deja empezar hasta que todo está listo (así cada capítulo abre al momento)
let loadedParts = 0;
const LOAD_PARTS = 8;
const part = <T,>(p: Promise<T>) => p.finally(() => loadedParts++);
const photosLoading = Promise.all([part(Promise.resolve(loadSurfacePhotos())), part(Promise.resolve(loadHdPhotos()))]);
const rigLoading = part(preloadRig())
  .then(() => Promise.all([part(preloadCrowd()), part(preloadDonkey()), part(preloadVehicles()), part(preloadHdri(sunsetHdr).catch((e) => console.warn('[gfx] HDRI', e))), part(preloadHdri(quarryHdr).catch((e) => console.warn('[gfx] HDRI', e)))]))
  .then(() => (hdAssets = true));
const allLoading = Promise.all([rigLoading, photosLoading.catch(() => {})]);
const LEVEL_CLASSES = [Level1, Level4, Level2, Level3, LevelMoto, LevelSantJoan, LevelCena, LevelEclipse, LevelAniversario];

// Capítulos que ya usan la calidad de la prueba de concepto: texturas fotográficas con relieve,
// cielo HDRI y tono AgX. Los demás siguen con el aspecto anterior hasta que se migren.
const HD_CHAPTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
// De día, la luz ambiente sale del cielo de la prueba (quarry_01); de noche, del cielo de cada escena
const HD_DAY_CHAPTERS = [3, 5, 6, 8];
// Estilo pintado en todos los capítulos. ?estilo=antes lo quita para comparar con el aspecto anterior
const ESTILO = new URLSearchParams(location.search).get('estilo');
const PAINT_CHAPTERS = ESTILO === 'antes' ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Luz pintada de cada capítulo: tinte de las sombras, de lo que da el sol (o la luna) y del perfil de los personajes. */
const PAINT_LIGHT: Record<number, [number, number, number]> = {
  1: [0xc9c8f2, 0xfff0d4, 0xfff3cf], // Ferreries a las 11: sombras lavanda, sol de mediodía
  2: [0xb6bae6, 0xfff4e6, 0xa9c4ff], // La piscinita: noche azul, luz de luna en el perfil
  3: [0xc4cbe8, 0xfff2dc, 0xfff3d6], // Carretera al norte en octubre
  4: [0xa89cf0, 0xfff0f6, 0xffc0e8], // Fito: noche de neón rosa
  5: [0xc8b8e8, 0xffe6c4, 0xffe0b0], // Costa Brava a la hora dorada
  6: [0xc9c8f2, 0xfff0d4, 0xfff3cf], // Sant Joan, de día
  7: [0xb6bae6, 0xfff1e0, 0xb0c4ff], // Cena a escondidas, de noche
  8: [0xc0b0e6, 0xffdcb4, 0xffd2a0], // El eclipse, sol bajo sobre el mar
  9: [0xc9c8f2, 0xfff0d4, 0xfff3cf],
};
const NIGHT_CHAPTERS = [2, 4, 7];
/** Etalonaje pintado: el de cada capítulo, más vivo, con filtro de óleo en el fondo, tinta y papel. */
function paintGrade(n: number): Grade {
  const base = GRADES[n] ?? NEUTRAL;
  const night = NIGHT_CHAPTERS.includes(n);
  if (n === 1 || n === 9) return { ...base, exposure: 1.06, saturation: 1.2, contrast: 1.02, tint: 0.12, bloom: 0.35, vignette: 0.22, paint: 0.7, ink: 0.9, paper: 0.03, lift: 0.035 };
  return { ...base, saturation: base.saturation * 1.07, contrast: Math.min(base.contrast, 1.04), paint: night ? 0.3 : 0.7, ink: night ? 0.7 : 0.9, paper: 0.03, lift: night ? 0.025 : 0.035 };
}
/**
 * Luz y etalonaje del capítulo. Un capítulo de noche con un rato de día (Barajas, en el de Fito) toma
 * para ese rato los del viaje por el norte.
 */
function applyLook(n: number, paint: boolean, mood?: 'day' | 'night') {
  const k = mood === 'day' && NIGHT_CHAPTERS.includes(n) ? 3 : n;
  const pl = PAINT_LIGHT[k] ?? [0xc6c6ee, 0xffefd8, 0xfff2cc];
  paintPalette.shadow.setHex(pl[0]);
  paintPalette.light.setHex(pl[1]);
  paintPalette.rim.setHex(pl[2]);
  post.setGrade(paint ? paintGrade(k) : GRADES[k] ?? NEUTRAL, true);
}
let lookN = 0;
let lookMood: 'day' | 'night' | undefined;
function setHd(on: boolean, n = 0) {
  const paint = on && PAINT_CHAPTERS.includes(n);
  paintStyle.value = paint ? 1 : 0;
  lookN = n;
  lookMood = undefined;
  hdSurfaces.value = on ? 1 : 0;
  hdEnvDefault.url = on && HD_DAY_CHAPTERS.includes(n) ? quarryHdr : null;
  // AgX apaga los colores: el pintado va con ACES, más vivo
  renderer.toneMapping = on && !paint ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = paint ? 0.98 : on ? 1.05 : 0.92;
  if (on) applyLook(n, paint);
  else post.setGrade(NEUTRAL, true);
}

// Ambiente sonoro de fondo: casi todo fuera (Marc pondrá canciones). Solo queda el mar suave del eclipse;
// el público del concierto de Fito lo pone el propio capítulo
const BEDS: Record<number, Bed> = { 8: 'sea' };

function startLevel(n: number) {
  // Los capítulos con personajes glTF esperan a que estén cargados (suele ser al instante)
  if (HD_CHAPTERS.includes(n) && !hdAssets) {
    void rigLoading.then(() => startLevel(n));
    return;
  }
  // Desde el modo prueba se puede saltar de un capítulo a otro sin pasar por el mapa
  leaveLevel();
  clearScreens();
  tryFullscreen();
  audio.bed(BEDS[n] ?? 'none');
  // El rótulo tapa la pantalla mientras se monta el capítulo y se compilan sus shaders
  let ready!: () => void;
  chapterCard(n, new Promise<void>((r) => (ready = r)));
  setTimeout(() => buildLevel(n, ready), 60);
}

function buildLevel(n: number, ready: () => void) {
  const done = (result?: LevelResult) => {
    // Un capítulo ya cerrado no puede completarse "solo"
    if (level !== me) return;
    closeDebug?.();
    closeDebug = null;
    const g = giftForLevel(n);
    if (!data.levelsDone.includes(n)) data.levelsDone.push(n);
    if (g && !data.giftsUnlocked.includes(g.id)) data.giftsUnlocked.push(g.id);
    save(data);
    const after = () => {
      // Al terminar el último capítulo, directamente a la carta
      if (n === LEVEL_CLASSES.length && LEVEL_CLASSES.every((_, i) => data.levelsDone.includes(i + 1))) {
        if (level) {
          level.dispose();
          level = null;
        }
        crossword(startLetter, goMap);
      } else goMap();
    };
    // Después del vale (si lo hay) caen las fotos del capítulo; luego mapa o, al final, crucigrama y carta
    const photos = () => memories(n, after);
    if (g) showGift(g, photos, result);
    else photos();
  };
  camera.fov = camera.userData.baseFov ?? camera.fov;
  camera.updateProjectionMatrix();
  setHd(HD_CHAPTERS.includes(n), n);
  const me = new LEVEL_CLASSES[n - 1](camera, input, done, goMap);
  level = me;
  if (paintStyle.value) paintScene(level.threeScene);
  applyShadows(level.threeScene);
  levelAt = performance.now();
  if (TEST) closeDebug = debugPanel(level.debug());
  if (stats) (window as unknown as { game: Level }).game = level;
  // Compila todos los materiales antes de quitar el rótulo: así no hay tirones al empezar a jugar
  // (compileAsync se cuelga con algunos materiales en three r180: mejor el síncrono, que va detrás del rótulo)
  try {
    renderer.compile(level.threeScene, camera);
  } catch (e) {
    console.warn('[gfx] compilar', e);
  }
  requestAnimationFrame(() => requestAnimationFrame(ready));
}

function tryFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {})).catch(() => {});
    }
  } catch {
    /* iPhone no lo permite: se puede añadir a la pantalla de inicio */
  }
}

// Bucle principal con dt limitado y resolución dinámica.
const clock = new THREE.Clock();
let avg = 16;
let lastAdjust = 0;
const stats = TEST ? document.createElement('div') : null;
// Modo prueba: acceso desde la consola para revisar colisiones
// Captura del lienzo a resolución real (las capturas de pantalla del navegador salen reducidas)
let shotReq: ((url: string) => void) | null = null;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Modo prueba: pasa diálogos y chats como si se tocara la pantalla. */
async function dbgSkip(max = 30) {
  for (let i = 0; i < max; i++) {
    if (document.querySelector('.phone-overlay')) {
      document.querySelector('.phone-skip')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await wait(300);
      document.querySelector('.phone-overlay')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await wait(500);
      continue;
    }
    const d = document.querySelector('.dialogue');
    if (!d) return;
    d.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await wait(150);
    if (document.querySelector('.dialogue') === d) d.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await wait(450);
  }
}
if (TEST)
  Object.assign(window, {
    __dbg: {
      level: () => level, start: (n: number) => startLevel(n), camera, physLists, THREE, bounds: () => lastBounds, quality, post, juice, cinema,
      shot: () => new Promise<string>((r) => (shotReq = r)),
      skip: dbgSkip,
      /** Abre el capítulo n y pasa la introducción. */
      go: async (n: number) => {
        startLevel(n);
        await wait(4500);
        await dbgSkip();
      },
      /** Salta a la fase del panel de prueba que empieza por `label`. */
      phase: async (label: string, ms = 2500) => {
        [...document.querySelectorAll<HTMLButtonElement>('.debug-list button')].find((b) => b.textContent!.trim().startsWith(label))?.click();
        await wait(ms);
      },
      /** Captura del lienzo a pantalla completa encima de todo (para revisar); unview la quita. */
      view: async () => {
        document.querySelector('#shotov')?.remove();
        const img = document.createElement('img');
        img.src = await new Promise<string>((r) => (shotReq = r));
        img.id = 'shotov';
        img.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;z-index:9999;background:#000;pointer-events:none';
        document.body.append(img);
      },
      unview: () => document.querySelector('#shotov')?.remove(),
      /** Con la pestaña en segundo plano el navegador para el bucle: esto lo mantiene vivo (solo pruebas). */
      keepAlive: (on: boolean) => {
        keepAlive = on;
        if (on) pump.port2.postMessage(0);
      },
    },
  });
if (stats) {
  stats.className = 'stats';
  uiRoot.append(stats);
}

// dt suavizado: un fotograma que llega tarde (GC, carga de textura) no provoca un salto brusco,
// pero el tiempo total se conserva para que nada vaya a cámara lenta.
let smoothDt = 1 / 60;
let paintedScene: THREE.Scene | null = null;
let paintedAt = 0;
let debt = 0;
// Modo prueba: bucle de reserva por mensajes (no lo frena el navegador) mientras la página está oculta
let keepAlive = false;
let lastPump = 0;
const pump = new MessageChannel();
pump.port1.onmessage = () => {
  if (!keepAlive || !document.hidden) return;
  const now = performance.now();
  if (now - lastPump >= 16) {
    lastPump = now;
    frame();
  }
  pump.port2.postMessage(0);
};
document.addEventListener('visibilitychange', () => {
  if (keepAlive && document.hidden) pump.port2.postMessage(0);
});

function frame() {
  const raw = Math.min(clock.getDelta(), 0.1) + debt;
  const dt = Math.min(raw, Math.max(smoothDt * 1.6, 1 / 120), 1 / 12);
  debt = Math.min(0.1, raw - dt);
  smoothDt += (dt - smoothDt) * 0.15;
  renderer.info.reset();
  if (level) {
    const gdt = juice.scaleDt(dt) * cinema.timeScale;
    dust.attach(level.threeScene);
    beacon.attach(level.threeScene);
    level.update(gdt);
    dust.update(gdt);
    updateRigPeople(gdt);
    // Escenas de cine: mandan sobre la cámara que haya puesto el capítulo
    const filming = cinema.update(camera, dt);
    if (uiRoot.classList.contains('filming') !== filming) uiRoot.classList.toggle('filming', filming);
    // La columna de luz del objetivo: no en las escenas de cine ni mientras alguien habla
    beacon.update(dt, filming || !!document.querySelector('.dialogue, .phone-overlay'), camera);
    // Diálogos en modo cine: bandas, un leve acercamiento y desenfoque del fondo enfocando a quien habla
    const talking = !!document.querySelector('.dialogue') || filming;
    cine += ((talking ? 1 : 0) - cine) * Math.min(1, dt * 3.5);
    post.cinematic = cine < 0.01 ? 0 : cine;
    // Solo se desenfoca el fondo cuando habla alguien que está en escena (el narrador no)
    const speaker = (talking && lastSpeaker.at > performance.now() - 300) || cinema.hasFocus;
    if (cinema.hasFocus) post.focus.copy(cinema.focus);
    else if (speaker) post.focus.copy(lastSpeaker.pos);
    post.dofAmount += ((speaker ? 1 : 0) - post.dofAmount) * Math.min(1, dt * 4);
    juice.apply(camera, dt, cine * 0.1);
    const showJump = performance.now() - walkerActiveAt < 250 && !talking;
    if (jumpBtn.hidden === showJump) jumpBtn.hidden = !showJump;
    // Solo en pruebas: ?cam=x,y,z,lx,ly,lz fija la cámara para revisar un lugar
    const camQ = TEST ? ((window as unknown as { __cam?: string }).__cam ?? new URLSearchParams(location.search).get('cam')) : null;
    if (camQ) {
      const v = camQ.split(',').map(Number);
      camera.position.set(v[0], v[1], v[2]);
      camera.lookAt(v[3], v[4], v[5]);
    }
    // Capítulos que pasan del día a la noche: cambia la luz al cambiar de sitio
    if (level.mood !== lookMood) {
      lookMood = level.mood;
      applyLook(lookN, paintStyle.value > 0, lookMood);
    }
    // Lo que aparece a mitad de capítulo (escenas nuevas, gente que llega) también se pinta
    if (paintStyle.value && (level.threeScene !== paintedScene || clock.elapsedTime - paintedAt > 1)) {
      paintedScene = level.threeScene;
      paintedAt = clock.elapsedTime;
      paintScene(paintedScene);
    }
    draw(level.threeScene, dt);
    if (shotReq) {
      shotReq(canvas.toDataURL('image/png'));
      shotReq = null;
    }
    if (shaderFailed) safeStep();
  } else {
    draw(idle, dt);
  }
  avg = avg * 0.95 + dt * 1000 * 0.05;
  const now = clock.elapsedTime;
  if (level && !HQ && now - lastAdjust > 2 && performance.now() - levelAt > 4000) {
    lastAdjust = now;
    if (avg > 24 && ratio > 1) ratio = Math.max(1, ratio - 0.25);
    else if (avg > 26 && post.aoEnabled) post.aoEnabled = false; // primero fuera la oclusión ambiental
    else if (avg > 28 && quality.post) quality.post = false; // luego el resto del postproceso
    else if (avg > 30 && quality.shadows) dropShadows();
    else if (avg < 15 && ratio < maxRatio) ratio = Math.min(maxRatio, ratio + 0.25);
    if (renderer.getPixelRatio() !== ratio) {
      renderer.setPixelRatio(ratio);
      resize();
    }
  }
  if (stats) {
    const i = renderer.info.render;
    stats.textContent = `${(1000 / avg).toFixed(0)} fps · ${i.calls} draws · ${(i.triangles / 1000).toFixed(0)}k tris · x${ratio}${quality.grain && quality.env && quality.kind === 'standard' ? '' : ' · seguro ' + (quality.grain ? 'G' : '-') + (quality.env ? 'E' : '-') + (quality.shadows ? 'S' : '-') + quality.kind[0].toUpperCase()}`;
  }
}
renderer.setAnimationLoop(frame);

/** Si el móvil no llega ni a resolución mínima, quitamos las sombras reales (quedan las "manchas"). */
function dropShadows() {
  quality.shadows = false;
  renderer.shadowMap.enabled = false;
  if (!level) return;
  level.threeScene.traverse((o) => {
    const m = o as THREE.Mesh;
    if ((o as THREE.DirectionalLight).isDirectionalLight) (o as THREE.DirectionalLight).castShadow = false;
    if (m.userData.blob) m.visible = true;
    if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => (x.needsUpdate = true));
  });
}

window.addEventListener('pointerdown', () => audio.resume(), true);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) renderer.setAnimationLoop(null);
  else {
    audio.resume();
    clock.getDelta();
    renderer.setAnimationLoop(frame);
  }
});

titleScreen(
  () => {
    data = load();
    mapScreen(data, mapOpts);
  },
  { done: allLoading, progress: () => Math.min(1, loadedParts / LOAD_PARTS) },
);
