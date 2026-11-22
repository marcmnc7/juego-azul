import { crumb, startTrail } from './core/trail';
startTrail();
import { audio, type Bed } from './core/audio';
import * as THREE from 'three';
import { camWorld } from './core/camWorld';
import './ui/style.css';
import { Input } from './core/input';
import { lastBounds, lastWalk, edgePush, edgePushAt } from './core/walker';
import { initUpdater } from './core/updater';
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
import type { Level, LevelResult } from './world/level';
import { applyShadows, MOBILE, quality, settleAmbient, Sky, toon } from './core/gfx';
import { clearRigPeople, preloadRig, updateRigPeople, ensureVRMs, releaseVRMs, rigPeopleList } from './entities/rig';
import { ensureCrowd } from './entities/crowdRig';
import { initClock, faking } from './core/calendar';
import { preloadDonkey } from './entities/donkeyHD';
import { preloadVehicles } from './entities/vehiclesHD';
import { castFor, castName } from './data/characters';
import type { Person } from './entities/models';
import { comic, comicFlash, comicMood, comicScene, drawComic, type ComicLook } from './core/comic';
import { juice } from './core/juice';
import { cinema } from './core/cinema';
import { stage } from './core/stage';
import { hobbiesFinale, credits } from './ui/finale';
import { ridingMission } from './world/missions/riding';
import { titleScreen, mapScreen, chapterComplete, clearScreens, debugPanel, closeDialogue, newEpoch, chapterCard, setSpeakerResolver, talkingNow, laterHold, toast, comicWord, quizScore, installGate, countdownScreen, beforeGate, pauseState, openPause, setCastChapter, setTestMode, type ChapterLoading } from './ui/ui';
import { ChapterExtras } from './core/extras';
import { prepareMapIntro, preloadMap, hasMapIntro } from './ui/mapIntro';
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
/**
 * Quien se cruza pegado a la cámara, entre ella y Azul, no se dibuja mientras está ahí (antes una cabeza o un brazo
 * llenaban media pantalla). Solo con la cámara normal detrás de Azul: en el cine y en los diálogos no se toca nada.
 */
let peopleOf: { scene: THREE.Scene | null; list: THREE.Object3D[]; at: number } = { scene: null, list: [], at: 0 };
const hiddenNow: THREE.Object3D[] = [];
const ocA = new THREE.Vector3(), ocB = new THREE.Vector3(), ocF = new THREE.Vector3();
function hideOccluders(scene: THREE.Scene) {
  hiddenNow.length = 0;
  const pl = (level as unknown as { player?: { root: THREE.Object3D } } | null)?.player?.root;
  if (!pl || stage.current || uiRoot.classList.contains('filming') || document.querySelector('#ui .dialogue')) return;
  const t = performance.now();
  if (peopleOf.scene !== scene || t - peopleOf.at > 1000) {
    const list: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData.person) list.push(o);
    });
    peopleOf = { scene, list, at: t };
  }
  pl.getWorldPosition(ocA);
  ocA.y += 1.2;
  const dp = camera.position.distanceTo(ocA);
  camera.getWorldDirection(ocF);
  if (dp < 1.5 || dp > 12 || ocF.dot(ocB.subVectors(ocA, camera.position).normalize()) < 0.75) return;
  for (const o of peopleOf.list) {
    if (o === pl || !o.visible) continue;
    o.getWorldPosition(ocB);
    ocB.y += 1.25 * o.scale.y;
    const d = camera.position.distanceTo(ocB);
    if (d < 1.5 && d < dp - 0.4) {
      o.visible = false;
      hiddenNow.push(o);
    }
  }
}
function draw(scene: THREE.Scene) {
  if (scene === idle) {
    renderer.autoClear = true;
    renderer.render(scene, camera);
    return;
  }
  hideOccluders(scene);
  drawComic(renderer, scene, camera);
  for (const o of hiddenNow) o.visible = true;
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
let levelAt = 0;
let closeDebug: (() => void) | null = null;
/** Comentarios al andar y recuerdos escondidos del capítulo en marcha. */
let extras: ChapterExtras | null = null;
// Bocadillos de diálogo: quién es quién en cada capítulo (los niveles guardan a los personajes con estos nombres)
const SPEAKERS: Record<string, string[]> = {
  Azul: ['azul', 'player'], Margaux: ['azul', 'player'], azul: ['azul', 'player'], Gas: ['gas', 'marc'], Marc: ['marc', 'gas'],
  Carme: ['carme'], Tòfol: ['tofol'], Camarero: ['barman'],
};
/**
 * Quién es quién por su modelo de VRoid (el nombre del archivo): así sale el globo de los que el capítulo no nombra
 * en un campo (los padres, el taxista, los agentes, los caixers…).
 */
const ROLE: [RegExp, RegExp][] = [
  [/^(Azul|Margaux|azul)$/, /^azul_/],
  [/^(Gas|Marc)$/, /^gas_/],
  [/^Carme$/, /^carme$/],
  [/^Tòfol$/, /^tofol$/],
  [/^Camarero/, /^camarero_/],
  [/^Taxista$/, /^taxista$/],
  [/^Madre de Gas$/, /^madre_gas$/],
  [/^Padre de Gas$/, /^padre_gas$/],
  [/^Padre de Azul$/, /^padre_azul$/],
  [/^Madre( de Azul)?$/, /^madre_azul$/],
  [/^Agente/, /^agente_/],
  [/^Fito$/, /^fito$/],
  [/^Eric$/, /^eric$/],
  [/^Amiga/, /^amiga_/],
  [/^Amigo/, /^amigo_/],
  [/caixer/i, /^caixer$/],
  [/^Un crío/, /^nino_/],
  [/^Fabiolera/, /^fabiolera$/],
  [/ecino/, /^vecino$/],
];
/** Los que tienen nombre propio: si no se les encuentra, no se le pone su frase a otro. */
const NAMED = /^(Azul|Margaux|azul|Gas|Marc|Carme|Tòfol|Fito|Eric|Joy|Vaca)$/;
const _head = new THREE.Vector3();
const _v = new THREE.Vector3();
const lastSpeaker = { pos: new THREE.Vector3(), at: 0, who: '' };
/** A quién se le ha dado la voz de un extra sin nombre: se mantiene mientras siga hablando (no salta de uno a otro). */
const stick = new Map<string, { p: Person; at: number }>();
type PersonLike = { root?: THREE.Object3D; head?: THREE.Object3D; rig?: { bones: Map<string, THREE.Object3D> } };
/** ¿Está en esta escena y se ve? */
const inScene = (root: THREE.Object3D, scene: THREE.Object3D) => {
  let o: THREE.Object3D | null = root;
  while (o) {
    if (!o.visible) return false;
    if (o === scene) return true;
    o = o.parent;
  }
  return false;
};
/** Punto de encima de la cabeza (en el mundo). */
const headTop = (p: PersonLike, out: THREE.Vector3) => {
  const bone = p.rig?.bones.get('Head') ?? p.head!;
  bone.getWorldPosition(out);
  out.y += 0.32 * (p.root!.scale.y || 1);
  return out;
};
/**
 * El punto del mundo a la pantalla. Si queda fuera (o detrás de la cámara), se devuelve igual, marcado `off`: el
 * globo se queda en el borde, del lado de quien habla, en vez de irse a la caja de abajo (que es del narrador).
 */
function toScreen(p: THREE.Vector3) {
  const W = window.innerWidth, H = window.innerHeight;
  // En el espacio de la cámara: si está delante (de verdad, no rozando el plano de la cámara), se proyecta; si está
  // a su lado o detrás, el globo va al borde de la pantalla por el que queda (antes se daba la vuelta al punto y
  // el globo salía en la esquina contraria: arriba a la derecha de alguien que estaba abajo a la izquierda)
  _v.copy(p).applyMatrix4(camera.matrixWorldInverse);
  if (_v.z < -0.6) {
    _v.copy(p).project(camera);
    const off = Math.abs(_v.x) > 0.95 || Math.abs(_v.y) > 1.0;
    return { x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H, off };
  }
  const len = Math.hypot(_v.x, _v.y) || 1;
  const dx = _v.x / len, dy = _v.y / len;
  // (lejos, en esa dirección: la interfaz lo deja pegado al borde)
  return { x: W / 2 + dx * W, y: H / 2 - dy * H, off: true };
}
setSpeakerResolver((who) => {
  // En una misión manda su escena (con su gente) y lo que diga ella; si no, el capítulo
  const mission = stage.current as (typeof stage.current & { speakerPoint?: (who: string) => THREE.Vector3 | null }) | null;
  const scene: THREE.Object3D | undefined = mission ? mission.scene : (level as unknown as { threeScene?: THREE.Scene } | null)?.threeScene;
  if (!scene) return null;
  const L = (mission ? mission : level) as unknown as Record<string, PersonLike>;
  // El nivel (o la misión) puede decir dónde habla alguien que no se ve de cuerpo entero (dentro del coche)
  // (y hacia qué lado se abre el globo: en un coche, cada uno desde su asiento)
  const lv = (mission ?? level) as unknown as { speakerPoint?: (who: string) => THREE.Vector3 | null; speakerSide?: (who: string) => 'l' | 'r' | undefined; speakerBelow?: () => boolean };
  const hook = lv.speakerPoint?.(who);
  if (hook) {
    lastSpeaker.pos.copy(hook);
    lastSpeaker.at = performance.now();
    lastSpeaker.who = who;
    const at = toScreen(hook);
    // (conduciendo, el globo sale por detrás, abajo: encima tapaba la carretera)
    return { ...at, side: lv.speakerSide?.(who), below: lv.speakerBelow?.() ?? false };
  }
  const found = (p: PersonLike) => {
    headTop(p, _head);
    lastSpeaker.pos.copy(_head);
    lastSpeaker.at = performance.now();
    lastSpeaker.who = who;
    return toScreen(_head);
  };
  // 1) Por el campo del capítulo (azul, marc, carme…)
  for (const f of SPEAKERS[who] ?? []) {
    const p = L[f];
    if (p?.root && p.head && inScene(p.root, scene)) return found(p);
  }
  // 2) Por su modelo de VRoid; si hay varios iguales (caixers, críos), el más cercano a la cámara
  const role = ROLE.find(([w]) => w.test(who))?.[1];
  const pp = (L.player?.root ?? L.azul?.root)?.position ?? camera.position;
  if (role) {
    let best: Person | null = null, bd = Infinity;
    for (const p of rigPeopleList()) {
      if (!role.test(castName(p.root.userData.vrm)) || !inScene(p.root, scene)) continue;
      const d = p.root.getWorldPosition(_v).distanceTo(camera.position);
      if (d < bd) (bd = d), (best = p);
    }
    if (best) return found(best);
  }
  if (NAMED.test(who) || who === 'Narrador') return null;
  // 3) Un extra sin nombre («Una señora», «Un señor de Telde», la gente de la fiesta): quien esté más cerca de
  // Azul (o de Gas), que no sea ninguno de los dos, mejor si se le ve. Se queda con él mientras habla
  const now = performance.now();
  const st = stick.get(who);
  if (st && now - st.at < 8000 && inScene(st.p.root, scene)) {
    st.at = now;
    return found(st.p);
  }
  const mine = new Set<THREE.Object3D>();
  for (const f of ['player', 'azul', 'marc', 'gas']) if (L[f]?.root) mine.add(L[f].root!);
  let best: Person | null = null, bd = Infinity;
  for (const p of rigPeopleList()) {
    if (mine.has(p.root) || /^(azul|gas)_/.test(castName(p.root.userData.vrm)) || !inScene(p.root, scene)) continue;
    const d = p.root.getWorldPosition(_v).distanceTo(pp);
    if (d > 12) continue;
    // (los que no salen en pantalla, como si estuvieran el doble de lejos)
    const score = d * (toScreen(headTop(p, _head)).off ? 2 : 1);
    if (score < bd) (bd = score), (best = p);
  }
  if (!best) return null;
  stick.set(who, { p: best, at: now });
  return found(best);
});
// Quien habla y no sale en el plano: la cámara gira (suave) hasta que su cabeza entra, para que el globo salga
// pegado a ella y no en el borde. Se deshace al frame siguiente (el capítulo vuelve a poner su cámara)
const talkCam = { k: 0, saved: new THREE.Quaternion(), applied: false, who: '' };
const _tq = new THREE.Quaternion(), _tq0 = new THREE.Quaternion(), _tq2 = new THREE.Quaternion(), _tm = new THREE.Matrix4(), _tf = new THREE.Vector3(), _ts = new THREE.Vector3();
function talkFrameUndo() {
  if (talkCam.applied) camera.quaternion.copy(talkCam.saved);
  talkCam.applied = false;
}
function talkFrame(dt: number) {
  const who = talkingNow.who;
  let want = 0;
  if (who && lastSpeaker.who === who && performance.now() - lastSpeaker.at < 1500) {
    camera.updateMatrixWorld();
    _v.copy(lastSpeaker.pos).applyMatrix4(camera.matrixWorldInverse);
    const ahead = _v.z < -0.6;
    _v.copy(lastSpeaker.pos).project(camera);
    // (fuera del plano, o pegado al borde: con el globo encima no cabe)
    const out = !ahead || Math.abs(_v.x) > 0.8 || _v.y > 0.72 || _v.y < -1.05;
    // (una vez buscado, se le sigue mirando mientras hable él: si no, la cámara iría y vendría)
    if (out && camera.position.distanceTo(lastSpeaker.pos) > 0.9) (want = 1), (talkCam.who = who);
    else if (talkCam.k > 0.05 && talkCam.who === who) want = 1;
  }
  talkCam.k += (want - talkCam.k) * Math.min(1, dt * 4);
  if (want === 0 && talkCam.k < 0.01) talkCam.k = 0;
  if (talkCam.k <= 0) return;
  talkCam.saved.copy(camera.quaternion);
  talkCam.applied = true;
  // Mira hacia la cabeza de quien habla, pero sin centrarla del todo: se gira lo justo para que quede dentro del
  // plano, a medio camino del centro y el borde por el lado de lo que se miraba (y con sitio arriba para el globo)
  camera.getWorldDirection(_tf);
  _ts.copy(lastSpeaker.pos).sub(camera.position);
  _ts.y -= 0.35;
  _ts.normalize();
  _tq2.setFromUnitVectors(_ts, _tf);
  const ang = 2 * Math.acos(Math.min(1, Math.abs(_tq2.w)));
  const half = THREE.MathUtils.degToRad(camera.fov / 2) * Math.min(1, camera.aspect);
  const t = ang > 1e-4 ? Math.min(1, (half * 0.45) / ang) : 0;
  _tq2.slerpQuaternions(_tq0, _tq2, t);
  _tf.copy(_ts).applyQuaternion(_tq2);
  _tm.lookAt(camera.position, _v.copy(camera.position).add(_tf), camera.up);
  _tq.setFromRotationMatrix(_tm);
  camera.quaternion.slerp(_tq, talkCam.k);
}
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

setTestMode(TEST);

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
  onReset: () => {
    data = { version: data.version, levelsDone: [], giftsUnlocked: [] };
    save(data);
    mapScreen(data, mapOpts);
  },
};

/** Cierra el capítulo en marcha (si lo hay) y todo lo que tenga encima: diálogo y panel de prueba. */
function leaveLevel() {
  pauseState.on = false;
  mapIntroNow?.cancel();
  mapIntroNow = null;
  laterHold.on = false;
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
  // (y lo que cada capítulo deja a medias si se sale por la pausa: la mochila del cap. 5 se quedaba encima del mapa)
  document
    .querySelectorAll('#ui > .pack-screen, #ui > .side-panel, #ui > .side-spot, #ui > .gh-panel, #ui > .kp-pop, #ui > .rose-phone, #ui > .cam, #ui > .rhythm, #ui > .rhythm-btns, #ui > .route, #ui > .wind-arrow, #ui > .bark, #ui > .fail-back, #ui > .hud-top, #ui > .counters, #ui > .action-btn, #ui > .pause-fab, #ui > .hint-move')
    .forEach((e) => e.remove());
  clearRigPeople();
  input.reset();
  input.enabled = true;
}

function goMap() {
  leaveLevel();
  audio.bed('none');
  mapScreen(data, mapOpts);
}

// En orden real: Ferreries, la piscinita la noche siguiente, el road trip, Fito, la moto por la Costa Brava,
// Sant Joan, la cena a escondidas, el eclipse y, un año después, otra vez Ferreries
// Las texturas fotográficas se cargan ya, mientras se ve la portada
// Personajes glTF (para los capítulos con la calidad de la prueba); la multitud se hornea con cada capítulo
let hdAssets = false;
// Pantalla de carga: la portada no deja empezar hasta que todo está listo (así cada capítulo abre al momento)
let loadedParts = 0;
const LOAD_PARTS = 3;
const part = <T,>(p: Promise<T>) => p.finally(() => loadedParts++);
const rigLoading = part(preloadRig())
  .then(() => Promise.all([part(preloadDonkey()), part(preloadVehicles())]))
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
  setCastChapter(n);
  const card = chapterCard(n);
  pauseState.on = false;
  pauseState.title = `Capítulo ${n} · ${LEVELS[n - 1].name}`;
  pauseState.n = n;
  void buildLevel(n, card).catch((e) => {
    console.warn('[juego] montar capítulo', e);
    crumb(`montar: error ${e instanceof Error ? e.message : String(e)}`);
    loadingLevel = false;
    laterHold.on = false;
    mapIntroNow?.cancel();
    mapIntroNow = null;
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
  // (lo que el capítulo programe al montarse espera a que se vea: ni detrás del rótulo ni detrás del mapa)
  laterHold.on = true;
  // El vuelo de satélite del principio: el mapa ya tapa la pantalla (debajo del rótulo) desde ahora, así nunca se ve
  // el escenario ni una frase antes de tiempo; sus fotos se bajan mientras se monta el resto
  const NOMAP = new URLSearchParams(location.search).has('nomap') || !hasMapIntro(n);
  mapIntroNow?.cancel();
  const intro = NOMAP ? null : prepareMapIntro(n);
  mapIntroNow = intro;
  const mapReady = NOMAP ? Promise.resolve() : preloadMap(n);
  const epochAt = ++buildEpoch;
  const stale = () => epochAt !== buildEpoch;
  // Personajes glTF y texturas (suele estar desde la portada)
  crumb(`cap ${n}: empieza`);
  card.progress(0.08, 'Cargando personajes');
  if (!hdAssets) await rigLoading;
  if (stale()) return;
  // Los personajes de VRoid de este capítulo (los que ya estén hechos); fuera los del anterior
  if (hdAssets) {
    const cast = castFor(n);
    releaseVRMs(new Set(cast.map((c) => c[0])));
    await ensureVRMs(cast);
    if (stale()) return;
    // La multitud de VRoid de este capítulo (si tiene)
    crumb(`cap ${n}: personajes cargados`);
    card.progress(0.14, 'Preparando a la gente');
    await ensureCrowd(n);
    if (stale()) return;
  }
  // La canción se descodifica mientras tanto: así suena desde el primer segundo
  crumb(`cap ${n}: gente lista`);
  card.progress(0.2, 'Preparando la canción');
  const song = SONG_OF[n] ? audio.preloadTrack(SONG_OF[n]) : Promise.resolve();
  await Promise.race([song, pause(5000)]);
  if (stale()) return;
  crumb(`cap ${n}: montando el escenario`);
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
      if (b) result.stats.push(['Recuerdos escondidos', `${a}/${b} ✨`]);
      if (quizScore.total) result.stats.push(['Te acordabas', `${quizScore.right}/${quizScore.total} 💬`]);
    }
    extras?.dispose();
    extras = null;
    const g = giftForLevel(n);
    if (!data.levelsDone.includes(n)) data.levelsDone.push(n);
    if (g && !data.giftsUnlocked.includes(g.id)) data.giftsUnlocked.push(g.id);
    save(data);
    // (21 nov) Al acabar el último capítulo, después del regalo: los hobbies compartidos y el final con créditos
    // (los minijuegos del final ya no van pegados al cap. 9: son el juego pequeño de después, en el mapa)
    const after = () => goMap();
    // Todo el final en una pantalla: estrellas, regalo, fotos y lo que viene mañana
    const teaser = TEASERS[n + 1] && !data.levelsDone.includes(n + 1) ? n + 1 : null;
    chapterComplete(n, result, g ?? null, teaser, after);
  };
  camera.fov = camera.userData.baseFov ?? camera.fov;
  camera.updateProjectionMatrix();
  setLook(n);
  const t0 = performance.now();
  if (SONG_OF[n]) audio.holdForTrack();
  const me = new LEVEL_CLASSES[n - 1](camera, input, done, goMap);
  crumb(`cap ${n}: escenario construido`);
  level = me;
  quizScore.right = quizScore.total = 0;
  extras = new ChapterExtras(n, data, () => save(data));
  // Cómic y sombras en el mismo paso: si se dibujara antes sin ellos, cada shader se compilaría dos veces
  comicScene(me.threeScene);
  applyShadows(me.threeScene);
  console.info(`[juego] capítulo ${n} montado en ${Math.round(performance.now() - t0)} ms`);
  if (TEST) closeDebug = debugPanel(me.debug());
  if (stats) (window as unknown as { game: Level }).game = me;
  crumb(`cap ${n}: cómic y sombras`);
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
  crumb(`cap ${n}: shaders compilados`);
  card.progress(0.86, 'Últimos retoques');
  await settle(MOBILE ? 7000 : 4000);
  if (level !== me) return;
  await Promise.race([mapReady, pause(6000)]);
  if (level !== me) return;
  if (SONG_OF[n]) audio.playTrack(SONG_OF[n]);
  crumb(`cap ${n}: listo`);
  const start = () => {
    loadingLevel = false;
    levelAt = performance.now();
  };
  // (lo programado, en marcha cuando ya no hay mapa delante: ver el capítulo es lo primero)
  const release = () => (laterHold.on = false);
  if (!intro) {
    start();
    release();
    card.done();
    return;
  }
  // El vuelo hasta el sitio, debajo del rótulo que se va; el capítulo espera (en pausa) hasta el fundido
  card.done();
  intro.play(
    () => level === me && start(),
    () => {
      release();
      if (mapIntroNow === intro) mapIntroNow = null;
    },
  );
}
let mapIntroNow: ReturnType<typeof prepareMapIntro> | null = null;
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
      level: () => level, start: (n: number) => startLevel(n), camera, physLists, THREE, bounds: () => lastBounds, walk: () => lastWalk, quality, juice, cinema, beacon, input, stage, camWorld,
      shot: () => new Promise<string>((r) => (shotReq = r)),
      /** Dibuja ya el fotograma actual y lo devuelve (para revisar con la página oculta, sin esperar al bucle). */
      snap: () => {
        const sc = stage.current ? stage.current.scene : level?.threeScene;
        if (sc) draw(sc);
        return canvas.toDataURL('image/png');
      },
      skip: dbgSkip,
      /** El final del año (hobbies, hípica y créditos), para probarlo sin jugar el cap. 9. */
      finale: () => {
        leaveLevel();
        clearScreens();
        hobbiesFinale(() => goMap());
      },
      hipica: () => ridingMission(() => {}),
      credits: () => credits(() => goMap()),
      /** Anima a los personajes un paso (con la página oculta el bucle casi no corre). */
      rig: (dt = 0.033) => updateRigPeople(dt),
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
  talkFrameUndo();
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
    talkFrame(frozen ? 1e-4 : dt);
    const talking = !!document.querySelector('.dialogue') || filming;
    cine += ((talking ? 1 : 0) - cine) * Math.min(1, dt * 3.5);
    juice.apply(camera, dt, cine * 0.1);
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
      const switched = sc !== comicScened;
      comicScened = sc;
      comicAt = clock.elapsedTime;
      comicScene(sc);
      // Al volver a una escena ya convertida (del camping de noche a la carretera de día), su perfil otra vez: si no,
      // se quedaba el de la última escena (ventanas «encendidas» a pleno sol)
      if (switched && sc.userData.comicHemi && !mission) comicMood(sc, (sc.userData.comicLook as ComicLook | undefined) ?? comic.look);
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
// Sin conexión y al día: el service worker y las actualizaciones (core/updater.ts). Se aplican solo fuera de los
// capítulos (en la portada o el mapa), con el progreso a salvo.
initUpdater({
  // (en local, solo con ?sw: para probar las actualizaciones con la compilación)
  enabled: topLevel && ((!/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.protocol === 'https:') || new URLSearchParams(location.search).has('sw')),
  safe: () => !level && !document.querySelector('.chapter-card, .phone-overlay, .dialogue, .wn-screen, .crossword-screen'),
  toast: (m) => toast(m),
});
// En el navegador del móvil no se juega: hay que abrirlo desde la pantalla de inicio (pantalla completa, sin
// barras, sin conexión). Dentro del artifact, en el ordenador y en modo prueba sí se puede
const phone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
initClock(TEST);
if (topLevel && !standalone && phone && !TEST) installGate(/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent));
// Hasta el 26 de noviembre, solo la cuenta atrás (en modo prueba se ve fingiendo el día con ?hoy=2026-11-25)
else if (beforeGate() && (!TEST || faking())) countdownScreen(() => location.reload());
else
  titleScreen(
    () => {
      data = load();
      mapScreen(data, mapOpts);
    },
    { done: allLoading, progress: () => Math.min(1, loadedParts / LOAD_PARTS) },
    data,
  );
