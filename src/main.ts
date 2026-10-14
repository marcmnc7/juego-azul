import * as THREE from 'three';
import './ui/style.css';
import { Input } from './core/input';
import { load, save } from './core/save';
import { giftForLevel } from './data/gifts';
import { Level1 } from './world/level1';
import { Level2 } from './world/level2';
import { Level3 } from './world/level3';
import { Level4 } from './world/level4';
import type { Level, LevelResult } from './world/level';
import { applyShadows, quality } from './core/gfx';
import { titleScreen, mapScreen, showGift, clearScreens, finalLetter, debugPanel, closeDialogue, chapterCard } from './ui/ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const maxRatio = Math.min(window.devicePixelRatio || 1, 2);
let ratio = Math.min(maxRatio, 1.5);
renderer.setPixelRatio(ratio);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
const input = new Input(canvas, uiRoot);
let data = load();

let level: Level | null = null;
let levelAt = 0;
let closeDebug: (() => void) | null = null;
const idle = new THREE.Scene();
idle.background = new THREE.Color(0x2b1840);

// Modo prueba: abrir el enlace terminado en #test (o ?debug en local).
const TEST = location.hash === '#test' || new URLSearchParams(location.search).has('debug');

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
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

const LEVEL_CLASSES = [Level1, Level2, Level3, Level4];

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
        finalLetter(goMap);
      } else goMap();
    };
    // El capítulo 4 no tiene vale: su premio es la carta final
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
  if (level) {
    level.update(dt);
    renderer.render(level.threeScene, camera);
  } else {
    renderer.render(idle, camera);
  }
  avg = avg * 0.95 + dt * 1000 * 0.05;
  const now = clock.elapsedTime;
  if (level && now - lastAdjust > 2 && performance.now() - levelAt > 4000) {
    lastAdjust = now;
    if (avg > 24 && ratio > 1) ratio = Math.max(1, ratio - 0.25);
    else if (avg > 28 && quality.shadows) dropShadows();
    else if (avg < 15 && ratio < maxRatio) ratio = Math.min(maxRatio, ratio + 0.25);
    if (renderer.getPixelRatio() !== ratio) {
      renderer.setPixelRatio(ratio);
      resize();
    }
  }
  if (stats) {
    const i = renderer.info.render;
    stats.textContent = `${(1000 / avg).toFixed(0)} fps · ${i.calls} draws · ${(i.triangles / 1000).toFixed(0)}k tris · x${ratio}`;
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
