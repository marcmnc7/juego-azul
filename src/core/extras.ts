import * as THREE from 'three';
import { audio } from './audio';
import { cinema } from './cinema';
import { glowTexture, vibrate } from './gfx';
import type { SaveData } from './save';
import { BARKS, keepsakesFor, type Keepsake } from '../data/extras';
import { bark, keepsakePop } from '../ui/ui';

// Lo que le pasa a un capítulo por encima de su historia, sin tocar su código: las frases que se oyen al andar y
// los recuerdos escondidos. Cada fotograma mira en qué fase está el capítulo, y quién y dónde anda.

/** Lo que hace falta saber del capítulo en marcha (cada uno lo tiene a su manera). */
interface LevelLike {
  threeScene: THREE.Scene;
  stage?: string;
  phase?: string;
  busy?: boolean;
  player?: { root: THREE.Object3D };
  azul?: { root: THREE.Object3D };
  car?: { root: THREE.Object3D };
  moto?: { root: THREE.Object3D };
  camp?: { azul: { root: THREE.Object3D } } | null;
  curve?: THREE.Curve<THREE.Vector3>;
  input?: { axes(): { x: number; y: number } };
}

const BODY = new THREE.BoxGeometry(0.3, 0.36, 0.012);
const PHOTO = new THREE.PlaneGeometry(0.25, 0.25);
let photoTex: THREE.Texture | null = null;
/** La cara de la polaroid: un corazón apenas revelado. */
function polaroidTexture() {
  if (photoTex) return photoTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 128, 128);
  gr.addColorStop(0, '#f7c98a');
  gr.addColorStop(1, '#d9638a');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.font = '64px serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('♥', 64, 70);
  photoTex = new THREE.CanvasTexture(c);
  photoTex.colorSpace = THREE.SRGBColorSpace;
  return photoTex;
}

interface Item {
  k: Keepsake;
  root: THREE.Group | null;
  placed: boolean;
}

export class ChapterExtras {
  private items: Item[] = [];
  private t = 0;
  private barkT = 7;
  private lastKey = '';
  private next = new Map<string, number>();
  private bodyMat = new THREE.MeshBasicMaterial({ color: 0xfbf6ea });
  private picMat = new THREE.MeshBasicMaterial({ map: polaroidTexture() });
  private haloMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffdf9a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  constructor(private n: number, private save: SaveData, private onSave: () => void) {
    for (const k of keepsakesFor(n)) if (!save.found?.includes(k.id)) this.items.push({ k, root: null, placed: false });
  }

  /** Cuántos ha encontrado de este capítulo y cuántos hay. */
  score() {
    const all = keepsakesFor(this.n);
    return [all.filter((k) => this.save.found?.includes(k.id)).length, all.length] as const;
  }

  update(dt: number, L: LevelLike, camera: THREE.Camera) {
    this.t += dt;
    const key = String(L.stage ?? L.phase ?? '');
    const talking = cinema.active || !!document.querySelector('.dialogue, .phone-overlay, .princesa-screen, .gauge, .pack-screen, .mission-card, .gift-overlay');
    this.updateBarks(dt, key, talking || !!L.busy);
    this.updateKeepsakes(L, key, talking, camera);
  }

  private updateBarks(dt: number, key: string, quiet: boolean) {
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.barkT = Math.min(this.barkT, 3.5 + Math.random() * 3);
    }
    if (quiet) return;
    this.barkT -= dt;
    if (this.barkT > 0) return;
    const lines = BARKS[this.n]?.[key];
    const i = this.next.get(key) ?? 0;
    if (!lines || i >= lines.length) {
      this.barkT = 4;
      return;
    }
    this.next.set(key, i + 1);
    bark(lines[i].who, lines[i].text);
    this.barkT = 13 + Math.random() * 9;
  }

  /** Quién anda ahora: la jugadora, o el coche y la moto en los capítulos de carretera. */
  private walkerOf(L: LevelLike, key: string) {
    if (key === 'camp') return L.camp?.azul.root.position;
    if (key === 'drive1' || key === 'drive2') return L.car?.root.position;
    if (key === 'ride') return L.moto?.root.position;
    return (L.player ?? L.azul)?.root.position;
  }

  private build(it: Item, L: LevelLike) {
    const k = it.k;
    const g = new THREE.Group();
    const body = new THREE.Mesh(BODY, this.bodyMat);
    const pic = new THREE.Mesh(PHOTO, this.picMat);
    pic.position.set(0, 0.03, 0.0065);
    const back = new THREE.Mesh(PHOTO, this.picMat);
    back.position.set(0, 0.03, -0.0065);
    back.rotation.y = Math.PI;
    body.userData.noCast = pic.userData.noCast = back.userData.noCast = true;
    const halo = new THREE.Sprite(this.haloMat);
    halo.scale.setScalar(1.15);
    halo.name = 'halo';
    g.add(body, pic, back, halo);
    g.userData.noCam = true;
    // En la moto cuelgan a un lado de la carretera, en la ruta
    if (k.u !== undefined && L.curve) {
      const p = L.curve.getPointAt(k.u);
      const t = L.curve.getTangentAt(k.u);
      const off = 1.6 + (k.side ?? 1) * 1.15;
      g.position.set(p.x - t.z * off, 1.5, p.z + t.x * off);
    } else g.position.set(k.x, (k.y ?? 0) + 1.15, k.z);
    it.root = g;
  }

  private updateKeepsakes(L: LevelLike, key: string, talking: boolean, camera: THREE.Camera) {
    if (!this.items.length) return;
    const pos = this.walkerOf(L, key);
    const sc = L.threeScene;
    for (const it of this.items) {
      const on = it.k.phases.includes(key);
      if (!on) {
        if (it.root?.parent) it.root.removeFromParent();
        continue;
      }
      if (!it.root) this.build(it, L);
      const r = it.root!;
      if (r.parent !== sc) sc.add(r);
      const base = (it.k.u !== undefined ? 1.5 : (it.k.y ?? 0) + 1.15) + Math.sin(this.t * 2 + r.position.x) * 0.07;
      r.position.y = base;
      r.rotation.y = this.t * 1.1 + r.position.z;
      const halo = r.getObjectByName('halo') as THREE.Sprite;
      halo.scale.setScalar(1 + Math.abs(Math.sin(this.t * 2.6 + r.position.x)) * 0.45);
      halo.quaternion.copy(camera.quaternion);
      if (!pos || talking) continue;
      const d = Math.hypot(pos.x - r.position.x, pos.z - r.position.z);
      const got =
        it.k.u !== undefined
          ? // La moto no se sale del carril: al pasar, hay que inclinarse hacia su lado
            d < 3.6 && (L.input?.axes().x ?? 0) * (it.k.side ?? 1) > 0.2
          : d < (it.k.r ?? 1.5);
      if (got) this.take(it);
    }
    this.items = this.items.filter((i) => i.placed === false);
  }

  private take(it: Item) {
    it.placed = true;
    it.root?.removeFromParent();
    (this.save.found ??= []).push(it.k.id);
    this.onSave();
    const [a, b] = this.score();
    audio.chime(2);
    audio.pickup();
    vibrate([20, 30, 20]);
    keepsakePop(it.k, a, b);
  }

  dispose() {
    for (const it of this.items) it.root?.removeFromParent();
    document.querySelectorAll('.bark, .kp-pop').forEach((e) => e.remove());
  }
}
