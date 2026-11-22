import * as THREE from 'three';
import { audio } from '../../core/audio';
import { Sky, Sun, toon, vibrate } from '../../core/gfx';
import { Surf } from '../../core/surfaces';
import { stage, type Mission, type MissionCtx } from '../../core/stage';
import { AZUL_DIARIO, GAS_DIARIO } from '../../data/characters';
import { G, Merger, makePerson, makeHorse, animatePerson, type Person, type Donkey } from '../../entities/models';
import { hud, comicWord, missionCard, failCard, livesChip, type Hud } from '../../ui/ui';
import { disposeScene } from '../level';

// Hípica de saltos (21 nov), en 3D: el picadero de arena de la foto (seto alrededor, focos, obstáculos de barras),
// Azul a caballo con su casco y Gas mirando desde la valla. El caballo va al galope solo; tocar (o el botón) le
// hace saltar. Verticales y oxers (dos barras, más fondo: hay que saltar antes). Más del 75 % de saltos limpios,
// o se repite el recorrido (como los otros juegos de habilidad).

const JUMPS = 12;
const NEED = 0.75;
/** Derribos que se pueden permitir (con uno más, ya no llega al 75 %: se repite en el momento). */
const KNOCKS_OK = JUMPS - Math.ceil(NEED * JUMPS);
const SPEED = 9; // m/s, al galope
const V0 = 6.2; // impulso del salto
const GRAV = 16;
const START_Z = -8;

interface Fence {
  z: number;
  /** Fondo: 0 (vertical) o ~1,2 m (oxer). */
  depth: number;
  h: number;
  group: THREE.Group;
  rail: THREE.Object3D;
  state: 'up' | 'clear' | 'down';
  fall: number;
}

const COLORS = [0xd7263d, 0x1f6fd1, 0xf4b400, 0x2e9e5b];

class RidingMission implements Mission {
  readonly scene = new THREE.Scene();
  private hud: Hud;
  private horse: Donkey;
  private gas: Person;
  private sky: Sky;
  private sun: Sun;
  private fences: Fence[] = [];
  private z = START_Z;
  private y = 0;
  private vy = 0;
  private t = 0;
  private clean = 0;
  private knocks = 0;
  private started = false;
  private over = false;
  private camAt = new THREE.Vector3();
  private look = new THREE.Vector3();
  private onTap = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, .ap-sheet, .fail-card')) return;
    this.jump();
  };

  constructor(private ctx: MissionCtx, private onDone: () => void) {
    const sc = this.scene;
    const sunDir = new THREE.Vector3(-0.45, 0.8, 0.35);
    sc.fog = new THREE.Fog(0xd8e8f2, 80, 260);
    this.sky = new Sky({ top: 0x2a6fd0, mid: 0x86c2f2, bottom: 0xf3ead6, sun: { color: 0xfff4dc, dir: sunDir, size: 70 }, clouds: { count: 6, tint: 0xffffff } });
    sc.add(this.sky.group);
    sc.userData.hemiScale = 0.35;
    sc.add(new THREE.HemisphereLight(0xeaf2ff, 0x8a7a64, 1.0));
    this.sun = new Sun(sc, 0xfff1dc, 3.4, sunDir, 24);
    // El suelo: hierba seca alrededor y la pista de arena
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(260, 400).rotateX(-Math.PI / 2), toon({ color: 0xb9a76a, surf: Surf.Grass }));
    grass.position.set(0, -0.02, 120);
    grass.userData.noCast = true;
    sc.add(grass);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(26, 300).rotateX(-Math.PI / 2), toon({ color: 0xe2c48e, surf: Surf.Sand }));
    sand.position.set(0, 0, 120);
    sand.userData.noCast = true;
    sc.add(sand);
    const m = new Merger();
    // Seto a los dos lados y valla blanca de la pista
    for (const sx of [-1, 1]) {
      for (let z = -30; z < 270; z += 6) m.add(G.bush, 0x4c8a3a, sx * 15.5, 0.8, z, 0, z, 0, 6.4, 1.8, 2.2);
      for (let z = -30; z < 270; z += 3) m.add(G.box, 0xf2f2ec, sx * 13.2, 0.55, z, 0, 0, 0, 0.12, 1.1, 0.12);
      m.add(G.box, 0xf2f2ec, sx * 13.2, 1.0, 120, 0, 0, 0, 0.1, 0.1, 300);
      m.add(G.box, 0xf2f2ec, sx * 13.2, 0.5, 120, 0, 0, 0, 0.1, 0.1, 300);
      // Focos del picadero
      for (let z = 0; z < 260; z += 40) {
        m.add(G.cyl, 0x6b7380, sx * 17.5, 4.5, z, 0, 0, 0, 0.18, 9, 0.18);
        m.add(G.box, 0xeef2f6, sx * 17.3, 9.1, z, 0, 0, sx * 0.3, 1.4, 0.5, 0.6);
      }
    }
    // Algunos árboles y lomas al fondo
    for (let i = 0; i < 18; i++) {
      const sx = i % 2 ? 1 : -1;
      const z = -20 + i * 16;
      m.add(G.cyl, 0x6b5a46, sx * (24 + (i % 3) * 4), 1.5, z, 0, 0, 0, 0.4, 3, 0.4);
      m.add(G.bush, i % 3 ? 0x4f8a3a : 0x5f9a46, sx * (24 + (i % 3) * 4), 3.8, z, 0, i, 0, 4.2, 3.4, 4.2);
    }
    sc.add(m.mesh());
    this.buildFences();
    // Azul a caballo (con casco) y Gas en la valla, mirando
    this.horse = makeHorse(0x3a2416, AZUL_DIARIO);
    this.horse.root.userData.comicBent = true;
    sc.add(this.horse.root);
    this.gas = makePerson(GAS_DIARIO);
    this.gas.root.position.set(12.4, 0, 6);
    this.gas.root.rotation.y = -Math.PI / 2;
    sc.add(this.gas.root);

    this.hud = hud(() => this.jump(), () => {}, 'Toca para saltar · los oxers (dos barras), un poco antes', true);
    this.hud.setObjective('🏇 Salto de obstáculos');
    missionCard('Salto de obstáculos', `Haz limpios al menos ${Math.ceil(JUMPS * NEED - 1e-6)} de ${JUMPS} saltos`);
    window.addEventListener('pointerdown', this.onTap);
    this.reset();
    this.place(0);
    this.camAt.copy(this.camTarget());
    ctx.camera.position.copy(this.camAt);
  }

  private buildFences() {
    let z = 18;
    for (let i = 0; i < JUMPS; i++) {
      const oxer = i > 1 && i % 3 !== 0 && Math.random() < 0.6;
      const h = 0.75 + Math.min(0.3, i * 0.025) + Math.random() * 0.1;
      const depth = oxer ? 1.1 + Math.random() * 0.3 : 0;
      const g = new THREE.Group();
      const color = COLORS[i % COLORS.length];
      const fm = new Merger();
      // Montantes a rayas (blanco y color), uno a cada lado, delante y, en los oxers, también detrás
      for (const dz of depth ? [0, depth] : [0]) {
        for (const sx of [-1.7, 1.7]) {
          for (let k = 0; k < 6; k++) fm.add(G.box, k % 2 ? 0xffffff : color, sx, 0.13 + k * 0.26, dz, 0, 0, 0, 0.16, 0.26, 0.16);
          fm.add(G.box, 0x6b6b6b, sx, 0.02, dz, 0, 0, 0, 0.6, 0.04, 0.5);
        }
        // Barras de abajo (fijas)
        fm.add(G.cyl, 0xffffff, 0, h * 0.45, dz, 0, 0, Math.PI / 2, 0.09, 3.3, 0.09);
      }
      const fixed = fm.mesh();
      g.add(fixed);
      // La barra de arriba (la que se derriba): a rayas
      const rm = new Merger();
      for (let k = 0; k < 6; k++) rm.add(G.cyl, k % 2 ? 0xffffff : color, -1.375 + k * 0.55, 0, 0, 0, 0, Math.PI / 2, 0.1, 0.55, 0.1);
      const rail = rm.mesh();
      rail.position.set(0, h, depth);
      g.add(rail);
      g.position.z = z;
      this.scene.add(g);
      this.fences.push({ z, depth, h, group: g, rail, state: 'up', fall: 0 });
      z += 15 + Math.random() * 6;
    }
  }

  private reset() {
    this.z = START_Z;
    this.y = this.vy = 0;
    this.t = 0;
    this.clean = this.knocks = 0;
    this.started = false;
    this.over = false;
    for (const f of this.fences) {
      f.state = 'up';
      f.fall = 0;
      f.rail.position.set(0, f.h, f.depth);
      f.rail.rotation.set(0, 0, 0);
    }
    this.paint();
  }

  private paint() {
    // (el objetivo, saltos limpios x/N; los derribos, en corazones: sin corazones, se repite)
    this.hud.setCounters(`<span class="chip${this.clean >= Math.ceil(NEED * JUMPS) ? ' ok' : ''}">🏇 ${this.clean}/${Math.ceil(NEED * JUMPS)}</span>${livesChip('🚧', KNOCKS_OK + 1 - this.knocks, KNOCKS_OK + 1)}`);
  }

  private jump() {
    if (this.over) return;
    if (!this.started) {
      this.started = true;
      document.querySelector('.mission-card')?.remove();
      return;
    }
    if (this.y > 0.02) return;
    this.vy = V0;
    audio.whoosh();
  }

  private camTarget() {
    // De lado y un poco por detrás: se ve el caballo y lo que viene (en vertical, más lejos para que quepa)
    const tall = this.ctx.camera.aspect < 1;
    return tall ? new THREE.Vector3(6.5, 3.0, this.z - 8) : new THREE.Vector3(8, 2.6, this.z - 3);
  }

  private place(dt: number) {
    const r = this.horse.root;
    r.position.set(0, this.y, this.z);
    r.rotation.y = 0;
    // En el aire: el morro arriba al despegar y abajo al caer
    const tilt = this.y > 0.02 ? THREE.MathUtils.clamp(-this.vy * 0.06, -0.3, 0.3) : 0;
    this.horse.pivot.rotation.x += (tilt - this.horse.pivot.rotation.x) * Math.min(1, dt * 10);
  }

  update(dt: number) {
    if (this.started && !this.over) {
      this.t += dt;
      this.z += SPEED * dt;
    }
    if (this.y > 0 || this.vy > 0) {
      this.vy -= GRAV * dt;
      this.y = Math.max(0, this.y + this.vy * dt);
      if (this.y === 0) {
        this.vy = 0;
        audio.knock(0.3, 220, 0.06);
      }
    }
    this.place(dt);
    // Cada obstáculo: limpio si el caballo (unos 2,2 m de largo) va por encima de la barra mientras lo cruza
    for (const f of this.fences) {
      const front = this.z + 1.1, back = this.z - 1.1;
      if (f.state === 'up' && front > f.z && back < f.z + f.depth && this.y < f.h - 0.32) {
        f.state = 'down';
        this.knocks++;
        audio.hit();
        vibrate(60);
        comicWord('¡DERRIBO!', 'hit');
        this.paint();
        // (con un derribo de más ya no se llega: se repite ya, sin esperar al final)
        if (this.knocks > KNOCKS_OK && !this.over) this.finish();
      }
      if (f.state === 'up' && back > f.z + f.depth) {
        f.state = 'clear';
        this.clean++;
        audio.chime(this.clean % 8);
        this.paint();
      }
      if (f.state === 'down' && f.fall < 1) {
        f.fall = Math.min(1, f.fall + dt * 2.4);
        f.rail.position.y = f.h * (1 - f.fall) + 0.1 * f.fall;
        f.rail.position.z = f.depth + f.fall * 0.6;
        f.rail.rotation.y = f.fall * 0.35;
      }
    }
    if (!this.over && this.clean + this.knocks >= JUMPS && this.z > this.fences[JUMPS - 1].z + 6) this.finish();
    // Gas, mirando cómo pasa
    animatePerson(this.gas, dt, 'idle');
    this.gas.root.rotation.y = Math.atan2(0 - 12.4, this.z - 6);
    const cam = this.ctx.camera;
    this.camAt.lerp(this.camTarget(), Math.min(1, dt * 4));
    cam.position.copy(this.camAt);
    this.look.set(0, 1.1 + this.y * 0.3, this.z + (cam.aspect < 1 ? 3.5 : 4));
    cam.lookAt(this.look);
    this.hud.setAction(this.over ? null : this.started ? '🐎 ¡Salta!' : '🐎 ¡Al galope!', !this.started);
    this.sky.update(cam, dt);
    this.sun.follow(this.horse.root.position);
  }

  private finish() {
    this.over = true;
    const pct = this.clean / JUMPS;
    setTimeout(() => {
      if (pct < NEED) {
        failCard('Demasiados derribos', `${this.clean} de ${JUMPS} saltos limpios (${Math.round(pct * 100)} %). Hace falta al menos el 75 %: otra vez el recorrido.`, () => this.reset());
        return;
      }
      audio.fanfare();
      vibrate([30, 40, 60]);
      comicWord(this.clean === JUMPS ? '¡SIN DERRIBOS!' : '¡RECORRIDO!', 'perfect');
      setTimeout(() => {
        const done = this.onDone;
        stage.end();
        done();
      }, 1800);
    }, 900);
  }

  dispose() {
    window.removeEventListener('pointerdown', this.onTap);
    this.hud.remove();
    disposeScene(this.scene);
  }
}

/** La hípica de saltos, en el picadero (misión 3D). */
export function ridingMission(onDone: () => void) {
  stage.start((ctx) => new RidingMission(ctx, onDone), false);
}
