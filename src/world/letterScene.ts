import * as THREE from 'three';
import { audio } from '../core/audio';
import { Fireworks, Sky, makeSea } from '../core/gfx';
import { comicMoonTexture } from '../core/comicTiles';
import { FINAL_LETTER } from '../data/story';
import { MEMORIES, LETTER_PHOTOS } from '../data/memories';
import type { DebugItem } from '../ui/ui';
import { later } from '../ui/ui';
import { disposeScene, type Level } from './level';

// La carta final, como escena: de noche sobre el mar de Menorca, con las fotos de la historia
// flotando como farolillos y la cámara avanzando despacio entre ellas. La carta aparece párrafo a
// párrafo, escrita a mano; al final, fuegos sobre el mar.

const PHOTO_W = 1.1;

export class LetterScene implements Level {
  private scene = new THREE.Scene();
  private sky: Sky;
  private fireworks = new Fireworks();
  private photos: { obj: THREE.Object3D; base: THREE.Vector3; ph: number }[] = [];
  private t = 0;
  private fwT = -1;
  private ui: HTMLElement;
  private moonGlow: THREE.Sprite;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private onClose: () => void,
    private openFull: () => void,
  ) {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0x1a2a5c, 30, 160);
    this.sky = new Sky({ top: 0x0e1c52, mid: 0x24397a, bottom: 0x4a4a86, stars: 2600 });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0x8fa0e0, 0x1a2040, 0.7));
    const moonDir = new THREE.Vector3(0.15, 0.32, 1).normalize();
    // Luna de tebeo (disco plano con su contorno y un anillo de luz)
    this.moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: comicMoonTexture(), transparent: true, depthWrite: false, fog: false }));
    this.moonGlow.position.copy(moonDir).multiplyScalar(300);
    this.moonGlow.scale.setScalar(26);
    sc.add(this.moonGlow);
    const light = new THREE.DirectionalLight(0xc8d4ff, 0.8);
    light.position.copy(moonDir).multiplyScalar(50);
    sc.add(light);
    const sea = makeSea([600, 600], 0x14305a, moonDir, { night: true });
    // Mar en calma: con el oleaje normal, los halos de las fotos se reflejaban a trozos
    const su = (sea.material as THREE.ShaderMaterial).uniforms;
    if (su?.distortionScale) su.distortionScale.value = 0.22;
    sc.add(sea);
    sc.add(this.fireworks.points);

    // Las fotos de la historia, flotando sobre el mar a los lados del camino de la cámara
    const srcs = [...LETTER_PHOTOS, ...MEMORIES.filter((m) => m.src && !m.sticker && !LETTER_PHOTOS.includes(m.src)).map((m) => m.src!)];
    const loader = new THREE.TextureLoader();
    srcs.forEach((src, i) => {
      const tex = loader.load(src, (t) => {
        const img = t.image as { width: number; height: number };
        const asp = img.height / img.width;
        photo.scale.set(1, asp, 1);
        frame.scale.set(1.12, asp + 0.3, 1);
        frame.position.y = -0.1;
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      const g = new THREE.Group();
      // Polaroid: marco blanco con más margen abajo, y la foto
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO_W, PHOTO_W), new THREE.MeshBasicMaterial({ color: 0xfbf7ee, side: THREE.DoubleSide }));
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO_W * 0.9, PHOTO_W * 0.9), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      photo.position.z = 0.005;
      g.add(frame, photo);
      const side = i % 2 ? 1 : -1;
      const base = new THREE.Vector3(side * (1.8 + (i % 3) * 0.6), 1.6 + ((i * 7) % 5) * 0.35, 8 + i * 5.5);
      g.position.copy(base);
      g.rotation.y = Math.PI - side * 0.35;
      sc.add(g);
      this.photos.push({ obj: g, base, ph: i * 1.7 });
    });
    this.camera.position.set(0, 1.5, 0);
    this.camera.lookAt(0, 1.6, 10);
    audio.startMusic('night');

    this.ui = document.createElement('div');
    this.ui.className = 'letter-cine';
    document.getElementById('ui')!.append(this.ui);
    later(() => this.paragraph(-1), 1200);
  }

  /** Párrafo i de la carta (−1 = el título). Toca para seguir. */
  private paragraph(i: number) {
    const paras = FINAL_LETTER.paragraphs;
    const box = this.ui;
    box.innerHTML = '';
    const p = document.createElement('div');
    p.className = i < 0 ? 'lc-title' : 'lc-text';
    p.textContent = i < 0 ? FINAL_LETTER.title : paras[i];
    const hint = document.createElement('div');
    hint.className = 'lc-hint';
    hint.textContent = 'Toca para seguir';
    box.append(p, hint);
    box.onpointerdown = (e) => {
      e.stopPropagation();
      box.onpointerdown = null;
      p.classList.add('out');
      later(() => (i + 1 < paras.length ? this.paragraph(i + 1) : this.ending()), 450);
    };
  }

  /** La firma, fuegos sobre el mar y los botones para volver o leerla entera. */
  private ending() {
    const box = this.ui;
    box.innerHTML = '';
    const sig = document.createElement('div');
    sig.className = 'lc-title';
    sig.textContent = FINAL_LETTER.signature;
    const row = document.createElement('div');
    row.className = 'lc-buttons';
    const full = document.createElement('button');
    full.className = 'link-btn';
    full.textContent = 'Leer la carta entera';
    full.onclick = this.openFull;
    const back = document.createElement('button');
    back.className = 'big-btn';
    back.textContent = 'Volver al mapa';
    back.onclick = this.onClose;
    row.append(full, back);
    box.append(sig, row);
    audio.fanfare();
    this.fwT = 0;
  }

  get threeScene() {
    return this.scene;
  }

  update(dt: number) {
    this.t += dt;
    // La cámara avanza despacio sobre el mar, entre las fotos, con un leve vaivén de barca
    const z = Math.min(this.t * 0.55, 8 + this.photos.length * 5.5 - 6);
    this.camera.position.set(Math.sin(this.t * 0.2) * 0.25, 1.5 + Math.sin(this.t * 0.7) * 0.05, z);
    this.camera.lookAt(Math.sin(this.t * 0.13) * 0.6, 1.65, z + 10);
    for (const p of this.photos) {
      p.obj.position.set(p.base.x, p.base.y + Math.sin(this.t * 0.8 + p.ph) * 0.12, p.base.z);
      p.obj.rotation.z = Math.sin(this.t * 0.5 + p.ph) * 0.06;
    }
    if (this.fwT >= 0) {
      this.fwT += dt;
      if (Math.floor(this.fwT / 0.7) !== Math.floor((this.fwT - dt) / 0.7)) {
        this.fireworks.burst(new THREE.Vector3((Math.random() - 0.5) * 30, 14 + Math.random() * 8, this.camera.position.z + 40 + Math.random() * 15));
        audio.knock(0.35, 180, 0.3);
      }
    }
    this.fireworks.update(dt);
    this.sky.update(this.camera, dt);
  }

  dispose() {
    this.ui.remove();
    audio.stopMusic();
    disposeScene(this.scene);
  }

  debug(): DebugItem[] {
    return [{ label: '✓ Final con fuegos', run: () => this.ending() }];
  }
}
