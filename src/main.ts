import * as THREE from 'three';
import './ui/style.css';
import { Input } from './core/input';
import { load, save } from './core/save';
import { giftForLevel } from './data/gifts';
import { Level1 } from './world/level1';
import { Level2 } from './world/level2';
import { Level3 } from './world/level3';
import { Level4 } from './world/level4';
import { LevelSantJoan } from './world/levelSantJoan';
import type { Level, LevelResult } from './world/level';
import { applyEnvironment, applyShadows, quality, removeEnvironment, setEnvRenderer, Sky, toon } from './core/gfx';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { titleScreen, mapScreen, showGift, clearScreens, finalLetter, crossword, debugPanel, closeDialogue, chapterCard } from './ui/ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
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
  box.castShadow = box.receiveShadow = true;
  sc.add(box);
  applyEnvironment(sc);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  cam.position.set(0, 0, 5);
  cam.lookAt(0, 0, 0);
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

// Postproceso: MSAA, bloom en las luces, viñeta y un toque de color de cine.
const GRADE = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.32 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, 1.08);                       // un poco más de saturación
      c.rgb *= mix(vec3(0.96, 0.98, 1.04), vec3(1.04, 1.0, 0.95), smoothstep(0.0, 0.6, l)); // sombras frías, luces cálidas
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - amount * smoothstep(0.25, 0.8, dot(d, d) * 2.2);  // viñeta
      gl_FragColor = c;
    }`,
};
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.55, 0.88);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(new ShaderPass(GRADE));
composer.addPass(new OutputPass());
function draw(scene: THREE.Scene) {
  if (!quality.post) {
    renderer.render(scene, camera);
    return;
  }
  renderPass.scene = scene;
  composer.render();
}
const input = new Input(canvas, uiRoot);
let data = load();

let level: Level | null = null;
let levelAt = 0;
let closeDebug: (() => void) | null = null;
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
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h;
  // En vertical abrimos más el plano para que se vea algo de calle
  camera.fov = w < h ? 75 : 60;
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

function goMap() {
  closeDebug?.();
  closeDebug = null;
  closeDialogue();
  if (level) {
    level.dispose();
    level = null;
  }
  input.reset();
  input.enabled = true;
  mapScreen(data, mapOpts);
}

// Sant Joan es de lo más reciente: va el último y después vienen el crucigrama y la carta
const LEVEL_CLASSES = [Level1, Level2, Level3, Level4, LevelSantJoan];

function startLevel(n: number) {
  clearScreens();
  tryFullscreen();
  chapterCard(n);
  const done = (result?: LevelResult) => {
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
        crossword(() => finalLetter(goMap), goMap);
      } else goMap();
    };
    // Los capítulos sin vale (Sant Joan y la piscina) vuelven al mapa; el último abre la carta
    if (g) showGift(g, after, result);
    else after();
  };
  level = new LEVEL_CLASSES[n - 1](camera, input, done, goMap);
  applyShadows(level.threeScene);
  levelAt = performance.now();
  if (TEST) closeDebug = debugPanel(level.debug());
  if (stats) (window as unknown as { game: Level }).game = level;
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
if (stats) {
  stats.className = 'stats';
  uiRoot.append(stats);
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  renderer.info.reset();
  if (level) {
    level.update(dt);
    draw(level.threeScene);
    if (shaderFailed) safeStep();
  } else {
    draw(idle);
  }
  avg = avg * 0.95 + dt * 1000 * 0.05;
  const now = clock.elapsedTime;
  if (level && !HQ && now - lastAdjust > 2 && performance.now() - levelAt > 4000) {
    lastAdjust = now;
    if (avg > 24 && ratio > 1) ratio = Math.max(1, ratio - 0.25);
    else if (avg > 28 && quality.post) quality.post = false; // primero fuera el postproceso
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

document.addEventListener('visibilitychange', () => {
  if (document.hidden) renderer.setAnimationLoop(null);
  else {
    clock.getDelta();
    renderer.setAnimationLoop(frame);
  }
});

titleScreen(() => {
  data = load();
  mapScreen(data, mapOpts);
});
