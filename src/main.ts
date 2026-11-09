import { audio, type Bed } from './core/audio';
import * as THREE from 'three';
import { camWorld } from './core/camWorld';
import './ui/style.css';
import { Input } from './core/input';
import { lastBounds, edgePush, edgePushAt, walkerActiveAt } from './core/walker';
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
import { applyShadows, MOBILE, quality, settleAmbient, Sky, toon } from './core/gfx';
import { clearRigPeople, preloadRig, updateRigPeople } from './entities/rig';
import { preloadCrowd } from './entities/crowdRig';
import { preloadDonkey } from './entities/donkeyHD';
import { preloadVehicles } from './entities/vehiclesHD';
import { comic, comicFlash, comicMood, comicScene, drawComic, type ComicLook } from './core/comic';
import { juice } from './core/juice';
import { cinema } from './core/cinema';
import { stage } from './core/stage';
import { titleScreen, mapScreen, chapterComplete, clearScreens, finalLetter, crossword, debugPanel, closeDialogue, newEpoch, chapterCard, setSpeakerResolver, toast, comicWord, quizScore, installGate, pauseState, openPause, Tutorial, type ChapterLoading } from './ui/ui';
import { ChapterExtras } from './core/extras';
import { TEASERS } from './data/extras';
import { SONG_OF } from './core/songs';
import { LEVELS } from './data/story';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = quality.shadows;

// Si en este dispositivo algún shader no compila (cada GPU es más o menos estricta), se avisa en la consola
let shaderFailed = false;
renderer.debug.onShaderError = (gl, program, vs, fs) => {
  shaderFailed = true;
  console.warn('[gfx] shader no compila en este dispositivo:', gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs));
};
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const maxRatio = Math.min(window.devicePixelRatio || 1, 2);
// En el móvil se empieza algo más bajo: la pantalla es pequeña y la tinta lo disimula; sube si va sobrado
let ratio = Math.min(maxRatio, MOBILE ? 1.35 : 1.5);
renderer.setPixelRatio(ratio);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);

/**
 * Autocomprobación al arrancar: dibuja un cubo verde del decorado, ya pasado a cómic, en una imagen diminuta y
 * mira si de verdad sale verde. Si en este dispositivo no se ve (hay GPUs que no dan error pero no pintan), se
 * prueba sin sombras.
 */
const gfxLog: string[] = [];
function gfxSelfTest(): boolean {
  const sc = new THREE.Scene();
  const sky = new Sky({ top: 0x4060ff, mid: 0x6080ff, bottom: 0x8090ff });
  sc.add(sky.group);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(1, 3, 2);
  sun.castShadow = quality.shadows;
  sc.add(sun);
  sc.fog = new THREE.Fog(0x8090ff, 30, 200);
  // Igual que el decorado del juego: geometría sin UV, con colores por vértice y superficie dibujada
  const geo = new THREE.BoxGeometry(2, 2, 2);
  geo.deleteAttribute('uv');
  const col = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) col.set([0.19, 0.75, 0.31], i);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const box = new THREE.Mesh(geo, toon({ vertexColors: true }));
  box.position.y = 3;
  box.castShadow = box.receiveShadow = true;
  box.userData.comicBent = true;
  sc.add(box);
  comicScene(sc);
  settleAmbient(sc);
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
  const ok = px[1] > px[0] + 25 && px[1] > px[2] + 10;
  gfxLog.push(`${quality.shadows ? 'S' : '-'}:${px[0]},${px[1]},${px[2]}`);
  if (!ok) console.warn('[gfx] autocomprobación falla', Array.from(px), JSON.stringify(quality));
  return ok;
}
let gfxOk = gfxSelfTest();
if (!gfxOk) {
  quality.shadows = false;
  renderer.shadowMap.enabled = false;
  gfxOk = gfxSelfTest();
}
if (!gfxOk) {
  // Nota discreta unos segundos para saber qué ha pasado si alguien manda una captura
  const note = document.createElement('div');
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '?';
  note.textContent = `gráficos: ${gfxLog.join(' ')} · ${gpu.slice(0, 60)}`;
  note.style.cssText = 'position:fixed;left:8px;bottom:6px;font:11px monospace;color:#fff;opacity:.75;right:8px;word-break:break-all;z-index:99;pointer-events:none;text-shadow:0 1px 2px #000';
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 25000);
}
renderer.info.autoReset = false;

// Cómic: cada golpe, chapuzón o acierto, con su onomatopeya y su destello
juice.fx = { flashScreen: comicFlash, kick: () => {} };
juice.onWord = (w, c) => comicWord(w, c);
audio.onCue = (c) => juice.cue(c);
let cine = 0;
/** Un fotograma: el capítulo en estilo cómic; la pantalla del mapa, solo su fondo. */
function draw(scene: THREE.Scene) {
  if (scene === idle) {
    renderer.autoClear = true;
    renderer.render(scene, camera);
    return;
  }
  drawComic(renderer, scene, camera);
}
const input = new Input(canvas, uiRoot);
// Las misiones usan la misma cámara y el mismo control; al empezar, su escena se prepara como la de un capítulo
stage.setContext({ camera, input });
stage.onStart = (sc) => {
  comicScene(sc);
  applyShadows(sc);
  try {
    renderer.compile(sc, camera);
  } catch {
    /* se compila al dibujar */
  }
};

let data = load();

let level: Level | null = null;
/** Capítulo en marcha (0 = ninguno). */
let levelN = 0;
/** Primeros pasos: en el capítulo 1, la primera vez, en cuanto se puede andar. */
let tutorial: Tutorial | null = null;
let tutoPending = Tutorial.pending();
let levelAt = 0;
let closeDebug: (() => void) | null = null;
/** Comentarios al andar y recuerdos escondidos del capítulo en marcha. */
let extras: ChapterExtras | null = null;
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
const TEST =
  location.hash === '#test' ||
  new URLSearchParams(location.search).has('debug') ||
  (() => {
    try {
      return localStorage.getItem('margaux-test') === '1';
    } catch {
      return false;
    }
  })();

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
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
    try {
      localStorage.removeItem(Tutorial.KEY);
    } catch {
      /* nada */
    }
    tutoPending = true;
    data = { version: data.version, levelsDone: [], giftsUnlocked: [] };
    save(data);
    mapScreen(data, mapOpts);
  },
};

/** Cierra el capítulo en marcha (si lo hay) y todo lo que tenga encima: diálogo y panel de prueba. */
function leaveLevel() {
  pauseState.on = false;
  tutorial?.dispose();
  tutorial = null;
  levelN = 0;
  stage.end();
  audio.stopTrack();
  // Lo que una partida o una misión deja encima de la escena (si se sale a medias, no se queda colgado)
  document.querySelectorAll('.ll, .panel-overlay, .radar-overlay, .trick-bar, .trick-say, .mission-card').forEach((e) => e.remove());
  cinema.stop();
  beacon.at(null);
  uiRoot.classList.remove('filming');
  closeDebug?.();
  closeDebug = null;
  closeDialogue();
  newEpoch();
  extras?.dispose();
  extras = null;
  if (level) {
    level.dispose();
    level = null;
  }
  clearRigPeople();
  input.reset();
  input.enabled = true;
}

/** La carta final, como escena: de noche sobre el mar, con las fotos flotando y la carta a mano. */
function startLetter() {
  leaveLevel();
  clearScreens();
  audio.bed('none');
  setLook(0, 'noche');
  const me = new LetterScene(camera, goMap, () => finalLetter(() => clearScreens()));
  level = me;
  comicScene(me.threeScene);
  applyShadows(me.threeScene);
  levelAt = performance.now();
  if (TEST) closeDebug = debugPanel(me.debug());
}

function goMap() {
  leaveLevel();
  audio.bed('none');
  mapScreen(data, mapOpts);
}

// En orden real: Ferreries, la piscinita la noche siguiente, el road trip, Fito, la moto por la Costa Brava,
// Sant Joan, la cena a escondidas, el eclipse y, un año después, otra vez Ferreries
// Las texturas fotográficas se cargan ya, mientras se ve la portada
// Personajes glTF y multitud horneada (para los capítulos con la calidad de la prueba)
let hdAssets = false;
// Pantalla de carga: la portada no deja empezar hasta que todo está listo (así cada capítulo abre al momento)
let loadedParts = 0;
const LOAD_PARTS = 4;
const part = <T,>(p: Promise<T>) => p.finally(() => loadedParts++);
const rigLoading = part(preloadRig())
  .then(() => Promise.all([part(preloadCrowd()), part(preloadDonkey()), part(preloadVehicles())]))
  .then(() => (hdAssets = true));
const allLoading = rigLoading;
const LEVEL_CLASSES = [Level1, Level4, Level2, Level3, LevelMoto, LevelSantJoan, LevelCena, LevelEclipse, LevelAniversario];

/**
 * Perfil de luz de tebeo de cada capítulo (comic.ts, LOOK_LIGHT). Un capítulo que cambia de hora a mitad lo dice
 * con level.mood ('day' / 'night') y las escenas que se montan aparte, con scene.userData.comicLook.
 */
const LOOKS: Record<number, ComicLook> = { 1: 'dia', 2: 'noche', 3: 'dia', 4: 'noche', 5: 'dia', 6: 'dia', 7: 'noche', 8: 'dia', 9: 'dia' };
function setLook(n: number, look: ComicLook = LOOKS[n] ?? 'dia') {
  comic.look = look;
  dust.tint(look !== 'dia');
  lookMood = undefined;
  // (una curva de tono suave: el sol del capítulo es fuerte y sin ella se quemaba)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
}
let lookMood: 'day' | 'night' | undefined;
// La interfaz (bocadillos, cartuchos, avisos) se dibuja siempre como un tebeo
document.documentElement.classList.add('comic-mode');

// Ambiente sonoro de fondo: casi todo fuera (Marc pondrá canciones). Solo queda el mar suave del eclipse;
// el público del concierto de Fito lo pone el propio capítulo
const BEDS: Record<number, Bed> = { 8: 'sea' };

/** Mientras la pantalla de carga tapa el capítulo, se dibuja (para subir texturas y sombras) pero el tiempo no corre. */
let loadingLevel = false;
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function startLevel(n: number) {
  // Desde el modo prueba se puede saltar de un capítulo a otro sin pasar por el mapa
  leaveLevel();
  clearScreens();
  tryFullscreen();
  audio.bed(BEDS[n] ?? 'none');
  const card = chapterCard(n);
  levelN = n;
  pauseState.on = false;
  pauseState.title = `Capítulo ${n} · ${LEVELS[n - 1].name}`;
  void buildLevel(n, card).catch((e) => {
    console.warn('[juego] montar capítulo', e);
    loadingLevel = false;
    card.done();
  });
}

/** Espera a que el capítulo, ya montado detrás del rótulo, se dibuje a buen ritmo unos cuantos fotogramas seguidos. */
async function settle(maxMs: number) {
  const t0 = performance.now();
  let good = 0, last = performance.now();
  while (performance.now() - t0 < maxMs && good < 8) {
    await nextFrame();
    const now = performance.now();
    good = now - last < 40 ? good + 1 : 0;
    last = now;
  }
}

async function buildLevel(n: number, card: ChapterLoading) {
  loadingLevel = true;
  const epochAt = ++buildEpoch;
  const stale = () => epochAt !== buildEpoch;
  // Personajes glTF y texturas (suele estar desde la portada)
  card.progress(0.08, 'Cargando personajes');
  if (!hdAssets) await rigLoading;
  if (stale()) return;
  // La canción se descodifica mientras tanto: así suena desde el primer segundo
  card.progress(0.2, 'Preparando la canción');
  const song = SONG_OF[n] ? audio.preloadTrack(SONG_OF[n]) : Promise.resolve();
  await Promise.race([song, pause(5000)]);
  if (stale()) return;
  card.progress(0.38, 'Montando el escenario');
  await pause(40);
  const done = (result?: LevelResult) => {
    // Un capítulo ya cerrado no puede completarse "solo"
    if (level !== me) return;
    closeDebug?.();
    closeDebug = null;
    // Lo de encima de la historia: recuerdos encontrados y cuántas respuestas recordaba
    if (result && extras) {
      const [a, b] = extras.score();
      if (b) result.stats.push(['Recuerdos escondidos', `${a}/${b} 🔎`]);
      if (quizScore.total) result.stats.push(['Te acordabas', `${quizScore.right}/${quizScore.total} 💬`]);
    }
    extras?.dispose();
    extras = null;
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
    // Todo el final en una pantalla: estrellas, regalo, fotos y lo que viene mañana
    const teaser = TEASERS[n + 1] && !data.levelsDone.includes(n + 1) ? n + 1 : null;
    chapterComplete(n, result, g ?? null, teaser, after);
  };
  camera.fov = camera.userData.baseFov ?? camera.fov;
  camera.updateProjectionMatrix();
  setLook(n);
  const t0 = performance.now();
  const me = new LEVEL_CLASSES[n - 1](camera, input, done, goMap);
  level = me;
  quizScore.right = quizScore.total = 0;
  extras = new ChapterExtras(n, data, () => save(data));
  // Cómic y sombras en el mismo paso: si se dibujara antes sin ellos, cada shader se compilaría dos veces
  comicScene(me.threeScene);
  applyShadows(me.threeScene);
  console.info(`[juego] capítulo ${n} montado en ${Math.round(performance.now() - t0)} ms`);
  if (TEST) closeDebug = debugPanel(me.debug());
  if (stats) (window as unknown as { game: Level }).game = me;
  card.progress(0.72, 'Preparando luces y sombras');
  await pause(30);
  if (level !== me) return;
  // Compila todos los materiales antes de quitar el rótulo: así no hay tirones al empezar a jugar
  // (compileAsync se cuelga con algunos materiales en three r180: mejor el síncrono, que va detrás del rótulo)
  try {
    renderer.compile(me.threeScene, camera);
  } catch (e) {
    console.warn('[gfx] compilar', e);
  }
  // Unos fotogramas detrás del rótulo: suben las texturas, se hacen las sombras y se compila la pasada de tinta
  card.progress(0.86, 'Últimos retoques');
  await settle(MOBILE ? 7000 : 4000);
  if (level !== me) return;
  loadingLevel = false;
  levelAt = performance.now();
  if (SONG_OF[n]) audio.playTrack(SONG_OF[n]);
  card.done();
}
let buildEpoch = 0;

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
let lastDrop = -100;
// El contador de fps, solo si se pide (?stats): en el móvil, incluso en modo prueba, estorbaba
const stats = new URLSearchParams(location.search).has('stats') ? document.createElement('div') : null;
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
      level: () => level, start: (n: number) => startLevel(n), camera, physLists, THREE, bounds: () => lastBounds, quality, juice, cinema, beacon, input, stage, camWorld,
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
let comicScened: THREE.Scene | null = null;
let comicAt = 0;
let debt = 0;
// Modo prueba: bucle de reserva por mensajes (no lo frena el navegador) mientras la página está oculta
let keepAlive = false;
let lastPump = 0;
const pump = new MessageChannel();
pump.port1.onmessage = () => {
  if (!keepAlive) return;
  const now = performance.now();
  // Con la página oculta (aunque diga «visible») requestAnimationFrame no llega: se mueve desde aquí
  if (now - lastPump >= 16 && now - lastFrame > 60) {
    lastPump = now;
    frame();
  }
  pump.port2.postMessage(0);
};

let lastFrame = 0;
let edgeHintAt = 0;
function frame() {
  lastFrame = performance.now();
  const raw = Math.min(clock.getDelta(), 0.1) + debt;
  const dt = Math.min(raw, Math.max(smoothDt * 1.6, 1 / 120), 1 / 12);
  debt = Math.min(0.1, raw - dt);
  smoothDt += (dt - smoothDt) * 0.15;
  renderer.info.reset();
  // Una misión en marcha (el aparcamiento, la playa…) manda: se dibuja su escena y el capítulo espera
  const mission = stage.current;
  if (level || mission) {
    const sc = mission ? mission.scene : level!.threeScene;
    const frozen = loadingLevel || pauseState.on;
    const gdt = frozen ? 1e-4 : juice.scaleDt(dt) * cinema.timeScale;
    dust.attach(sc);
    beacon.attach(sc);
    camWorld.attach(sc);
    if (mission) mission.update(gdt);
    else {
      level!.update(gdt);
      extras?.update(gdt, level as unknown as Parameters<ChapterExtras['update']>[1], camera);
    }
    dust.update(gdt);
    updateRigPeople(gdt);
    // Escenas de cine: mandan sobre la cámara que haya puesto el capítulo
    const filming = cinema.update(camera, frozen ? 1e-4 : dt);
    if (uiRoot.classList.contains('filming') !== filming) uiRoot.classList.toggle('filming', filming);
    // La columna de luz del objetivo: no en las escenas de cine ni mientras alguien habla
    beacon.update(dt, filming || !!document.querySelector('.dialogue, .phone-overlay'), camera);
    // Diálogos en modo cine: un leve acercamiento
    const talking = !!document.querySelector('.dialogue') || filming;
    cine += ((talking ? 1 : 0) - cine) * Math.min(1, dt * 3.5);
    juice.apply(camera, dt, cine * 0.1);
    // Primeros pasos: en cuanto se controla a Azul por primera vez en el capítulo 1
    if (tutoPending && !tutorial && levelN === 1 && !frozen && !talking && performance.now() - walkerActiveAt < 300) {
      tutoPending = false;
      tutorial = new Tutorial(input.usage);
    }
    tutorial?.update(talking || filming || frozen);
    // Empujando contra el final del mapa, donde no se ve nada que lo impida: mejor decirlo
    if (!talking && edgePush > 0.45 && performance.now() - edgePushAt < 200 && performance.now() > edgeHintAt) {
      edgeHintAt = performance.now() + 9000;
      toast(beacon.want > 0 ? 'Por aquí no hay paso: sigue la flecha' : 'Por aquí no hay paso');
    }
    // Solo en pruebas: ?cam=x,y,z,lx,ly,lz fija la cámara para revisar un lugar
    const camQ = TEST ? ((window as unknown as { __cam?: string }).__cam ?? new URLSearchParams(location.search).get('cam')) : null;
    if (camQ) {
      const v = camQ.split(',').map(Number);
      camera.position.set(v[0], v[1], v[2]);
      camera.lookAt(v[3], v[4], v[5]);
    }
    // Capítulos que pasan del día a la noche: cambia la luz al cambiar de sitio
    if (level && !mission && level.mood !== lookMood) {
      lookMood = level.mood;
      comicMood(level.threeScene, lookMood === 'day' ? 'dia' : lookMood === 'night' ? 'noche' : comic.look);
    }
    // Lo que aparece a mitad de capítulo (escenas nuevas, gente que llega) también se pasa a cómic
    if (sc !== comicScened || clock.elapsedTime - comicAt > 1) {
      comicScened = sc;
      comicAt = clock.elapsedTime;
      comicScene(sc);
    }
    draw(sc);
    if (shotReq) {
      shotReq(canvas.toDataURL('image/png'));
      shotReq = null;
    }
    if (shaderFailed) {
      shaderFailed = false;
      console.warn('[gfx] algún shader no compila en este dispositivo');
    }
  } else {
    draw(idle);
  }
  avg = avg * 0.95 + dt * 1000 * 0.05;
  const now = clock.elapsedTime;
  if (level && !loadingLevel && !HQ && now - lastAdjust > 1.2 && performance.now() - levelAt > 2500) {
    lastAdjust = now;
    // Objetivo: 60 fps (16,7 ms). Se baja enseguida si no llega y solo se vuelve a subir si va sobrado un buen rato
    if (avg > 19.5 && ratio > 1) {
      ratio = Math.max(1, ratio - 0.15);
      lastDrop = now;
    } else if (avg > 46 && quality.shadows) dropShadows();
    else if (avg < 17.4 && ratio < Math.min(maxRatio, MOBILE ? 1.5 : 2) && now - lastDrop > 10) ratio = Math.min(maxRatio, ratio + 0.15);
    if (renderer.getPixelRatio() !== ratio) {
      renderer.setPixelRatio(ratio);
      resize();
    }
  }
  if (stats) {
    const i = renderer.info.render;
    stats.textContent = `${(1000 / avg).toFixed(0)} fps · ${i.calls} draws · ${(i.triangles / 1000).toFixed(0)}k tris · x${ratio}${quality.shadows ? '' : ' · sin sombras'}`;
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
    if (m.userData.blob) m.visible = !m.userData.blobOff;
    if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => (x.needsUpdate = true));
  });
}

window.addEventListener('pointerdown', () => audio.resume(), true);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && level && !loadingLevel) openPause();
});
document.addEventListener('visibilitychange', () => {
  // Al irse a segundo plano en mitad de un capítulo, al volver lo encuentra en pausa
  // (en las revisiones automáticas, con keepAlive, la partida sigue aunque la página quede oculta)
  if (document.hidden && level && !loadingLevel && !keepAlive) openPause();
  if (document.hidden) renderer.setAnimationLoop(null);
  else {
    audio.resume();
    clock.getDelta();
    renderer.setAnimationLoop(frame);
  }
});

// Instalable (PWA): servido desde su propia dirección, se guarda para abrirse sin conexión. Dentro del artifact
// (un iframe) no se puede instalar, así que ni se intenta.
const topLevel = (() => {
  try {
    return window.top === window;
  } catch {
    return false;
  }
})();
const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
if ('serviceWorker' in navigator && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && topLevel && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[pwa]', e));
}
// En el navegador del móvil no se juega: hay que abrirlo desde la pantalla de inicio (pantalla completa, sin
// barras, sin conexión). Dentro del artifact, en el ordenador y en modo prueba sí se puede
const phone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
if (topLevel && !standalone && phone && !TEST) installGate(/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent));
else
  titleScreen(
    () => {
      data = load();
      mapScreen(data, mapOpts);
    },
    { done: allLoading, progress: () => Math.min(1, loadedParts / LOAD_PARTS) },
    data,
  );
