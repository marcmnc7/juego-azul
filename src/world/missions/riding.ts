import * as THREE from 'three';
import { audio } from '../../core/audio';
import { Sky, Sun, toon, vibrate } from '../../core/gfx';
import { Surf } from '../../core/surfaces';
import { stage, type Mission, type MissionCtx } from '../../core/stage';
import { AZUL_DIARIO, GAS_DIARIO } from '../../data/characters';
import { G, Merger, makePerson, makeHorse, animatePerson, type Person, type Donkey } from '../../entities/models';
import { Particles } from '../../entities/fx';
import { hud, livesChip, type Hud } from '../../ui/ui';
import { disposeScene } from '../level';
import { Show } from './show';

// Lo que nos gusta · noviembre: salto de obstáculos (4.4.4). Azul a caballo en el picadero, con gradas y gente.
// El galope se lleva con el joystick (arriba, más; abajo, menos) para llegar a cada obstáculo en su punto de batida:
// saltar muy pronto o muy tarde derriba una barra; no saltar, el caballo se niega. Verticales, oxers (más fondo:
// batir antes), una combinación doble y la ría (hace falta ir rápido). Tres faltas y eliminada. Gas mira desde la
// valla. Retransmitido: rótulo, marcador, cámara lenta en los grandes saltos.

type Kind = 'vertical' | 'oxer' | 'ria';
interface Fence {
  z: number;
  /** (4.4.11) De lado a lado: cada valla, a la izquierda, en medio o a la derecha del picadero. */
  x: number;
  kind: Kind;
  depth: number;
  h: number;
  group: THREE.Group;
  rail: THREE.Object3D;
  state: 'up' | 'clear' | 'down';
  fall: number;
}

const COLORS = [0xd7263d, 0x1f6fd1, 0xf4b400, 0x2e9e5b];
/** El recorrido: tipo y distancia hasta el siguiente (la doble, a 8 m: un tranco largo y otra vez). */
const PLAN: [Kind, number][] = [
  ['vertical', 22], ['oxer', 24], ['vertical', 20], ['ria', 26], ['oxer', 8.5], ['vertical', 24], ['oxer', 22], ['vertical', 20], ['oxer', 8.5], ['vertical', 26], ['ria', 22], ['oxer', 0],
];
const FAULTS = 3;
const GRAV = 16;
const START_Z = -10;

class RidingMission implements Mission {
  readonly scene = new THREE.Scene();
  private hud: Hud;
  private show = new Show('Lo que nos gusta · noviembre');
  private horse: Donkey;
  private gas: Person;
  private crowd: Person[] = [];
  private fx: Particles;
  private sky: Sky;
  private sun: Sun;
  private fences: Fence[] = [];
  private z = START_Z;
  /** El caballo, de lado a lado (joystick a izquierda y derecha) y hacia dónde mira. */
  private x = 0;
  private yaw = 0;
  private y = 0;
  private vy = 0;
  private v = 8;
  private t = 0;
  private faults = 0;
  private started = false;
  private over = false;
  private stopT = 0;
  private refuseT = 0;
  private slow = 1;
  private cheerT = 0;
  private strideT = 0;
  private dots: HTMLElement;
  private camAt = new THREE.Vector3();
  private look = new THREE.Vector3();
  private onTap = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, .ap-sheet, .fail-card, .pause')) return;
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
    this.fx = new Particles(sc);
    this.buildFences();
    // Gradas a los dos lados, con su gente
    const gm = new Merger();
    const L = this.fences[this.fences.length - 1].z + 30;
    for (const sx of [-1, 1]) {
      gm.add(G.box, 0x7a5a3a, sx * 19.5, 0.5, L / 2 - 10, 0, 0, 0, 2.4, 1.0, L);
      gm.add(G.box, 0x8a6a44, sx * 21.5, 1.3, L / 2 - 10, 0, 0, 0, 2.4, 2.6, L);
    }
    sc.add(gm.mesh());
    const LOOKS = [
      { skin: 0xe8b894, shirt: 0x2f6fd0, pants: 0x2a2a2a, hair: 0x2b1d14, hairStyle: 'short', male: true },
      { skin: 0xf0c8a6, shirt: 0xd7263d, pants: 0x3b4a6b, hair: 0x6b3f22, hairStyle: 'straight' },
      { skin: 0xd9a27c, shirt: 0xf2c94c, pants: 0x3a5a3a, hair: 0x1f1610, hairStyle: 'short', male: true },
      { skin: 0xf3d2b6, shirt: 0x3fa27a, pants: 0x222222, hair: 0x9a6a3a, hairStyle: 'straight' },
    ] as const;
    for (let i = 0; i < 14; i++) {
      const p = makePerson(LOOKS[i % 4]);
      const sx = i % 2 ? 1 : -1;
      p.root.position.set(sx * (i % 4 < 2 ? 19.5 : 21.5), i % 4 < 2 ? 1.0 : 2.6, 4 + i * (L / 14));
      p.root.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      sc.add(p.root);
      this.crowd.push(p);
    }
    // Azul a caballo (con casco) y Gas en la valla, mirando
    this.horse = makeHorse(0x3a2416, AZUL_DIARIO);
    this.horse.root.userData.comicBent = true;
    sc.add(this.horse.root);
    this.gas = makePerson(GAS_DIARIO);
    this.gas.root.position.set(12.4, 0, 6);
    this.gas.root.rotation.y = -Math.PI / 2;
    sc.add(this.gas.root);

    this.hud = hud(() => this.jump(), () => {}, '', true);
    this.hud.setIcon('🐎');
    this.show.bind(this.hud);
    this.hud.setObjective('🏇 Salto de obstáculos');
    // Los trancos hasta la siguiente valla (tres puntos que se encienden al ritmo del galope)
    this.dots = document.createElement('div');
    this.dots.className = 'rd-dots';
    this.dots.innerHTML = '<i></i><i></i><i></i>';
    document.getElementById('ui')!.append(this.dots);
    window.addEventListener('pointerdown', this.onTap);
    this.reset();
    this.place(0);
    this.camAt.copy(this.camTarget());
    ctx.camera.position.copy(this.camAt);
    this.show.intro('Salto de obstáculos', 'Azul · recorrido de 12', 'Lleva el galope con el joystick (arriba, más; abajo, menos) y bate en su punto: ni muy pronto ni muy tarde. Los oxers, un poco antes; la ría, rápido. Tres faltas y eliminada.', 4.2);
    this.stopT = 4.3;
  }

  private buildFences() {
    let z = 18;
    PLAN.forEach(([kind, gap], i) => {
      const h = kind === 'ria' ? 0.35 : 0.85 + Math.min(0.3, i * 0.03);
      const depth = kind === 'oxer' ? 1.2 : kind === 'ria' ? 3.2 : 0;
      const g = new THREE.Group();
      const color = COLORS[i % COLORS.length];
      const fm = new Merger();
      if (kind === 'ria') {
        // La ría: el agua azul, un seto bajo delante y banderas a los lados
        fm.add(G.box, 0x2f7fc4, 0, 0.02, depth / 2, 0, 0, 0, 3.6, 0.03, depth);
        fm.add(G.bush, 0x3f7a32, 0, 0.18, -0.2, 0, 0, 0, 3.8, 0.4, 0.5);
        for (const sx of [-2, 2]) {
          fm.add(G.cyl, 0xffffff, sx, 0.8, 0, 0, 0, 0, 0.05, 1.6, 0.05);
          fm.add(G.box, sx < 0 ? 0xd7263d : 0xffffff, sx, 1.45, 0.2, 0, 0, 0, 0.02, 0.3, 0.4);
        }
      } else {
        for (const dz of depth ? [0, depth] : [0]) {
          for (const sx of [-1.7, 1.7]) {
            for (let k = 0; k < 6; k++) fm.add(G.box, k % 2 ? 0xffffff : color, sx, 0.13 + k * 0.26, dz, 0, 0, 0, 0.16, 0.26, 0.16);
            fm.add(G.box, 0x6b6b6b, sx, 0.02, dz, 0, 0, 0, 0.6, 0.04, 0.5);
          }
          fm.add(G.cyl, 0xffffff, 0, h * 0.45, dz, 0, 0, Math.PI / 2, 0.09, 3.3, 0.09);
        }
        // Jardineras de flores delante
        for (const sx of [-1, 1]) {
          fm.add(G.box, 0x7a5a3a, sx * 1.1, 0.12, -0.5, 0, 0, 0, 1.2, 0.24, 0.35);
          for (let k = 0; k < 4; k++) fm.add(G.sphere, [0xd7263d, 0xf2c94c, 0xffffff, 0xe96aa0][k], sx * 1.1 - 0.45 + k * 0.3, 0.3, -0.5, 0, 0, 0, 0.18, 0.16, 0.18);
        }
      }
      g.add(fm.mesh());
      const rm = new Merger();
      for (let k = 0; k < 6; k++) rm.add(G.cyl, k % 2 ? 0xffffff : color, -1.375 + k * 0.55, 0, 0, 0, 0, Math.PI / 2, 0.1, 0.55, 0.1);
      const rail = rm.mesh();
      rail.position.set(0, h, depth);
      rail.visible = kind !== 'ria';
      g.add(rail);
      const fx = [0, -4.5, 4, -3, 4.5, 0, -4.5, 3.5, -4, 0, 4.5, -3][i % 12];
      g.position.set(fx, 0, z);
      this.scene.add(g);
      this.fences.push({ z, x: fx, kind, depth, h, group: g, rail, state: 'up', fall: 0 });
      z += gap;
    });
  }

  private reset() {
    this.z = START_Z;
    this.x = 0;
    this.yaw = 0;
    this.y = this.vy = 0;
    this.v = 8;
    this.t = 0;
    this.faults = 0;
    this.started = false;
    this.over = false;
    this.refuseT = 0;
    for (const f of this.fences) {
      f.state = 'up';
      f.fall = 0;
      f.rail.position.set(0, f.h, f.depth);
      f.rail.rotation.set(0, 0, 0);
    }
    this.paint();
  }

  private paint() {
    const passed = this.fences.filter((f) => f.state !== 'up').length;
    this.show.score(`<span class="chip">🏇 ${passed}/${this.fences.length}</span>${livesChip('🚧', FAULTS - this.faults, FAULTS)}`);
  }

  /** La siguiente valla que no se ha saltado. */
  private next() {
    return this.fences.find((f) => f.state === 'up' && f.z + f.depth > this.z - 1.1);
  }

  /** Punto de batida ideal: a qué distancia de la valla (más lejos en los oxers y la ría, y cuanto más rápido). */
  private ideal(f: Fence) {
    return 1.9 + f.depth * 0.45 + (this.v - 8) * 0.15;
  }

  private jump() {
    if (this.over || this.stopT > 0 || this.refuseT > 0) return;
    if (!this.started) {
      this.started = true;
      audio.knock(0.5, 1400, 0.06);
      return;
    }
    if (this.y > 0.02) return;
    const f = this.next();
    const d = f ? f.z - (this.z + 1.1) : 99;
    // La calidad del salto según lo lejos que bate: en su punto, más alto y limpio
    let lift = 6.0;
    if (f && d < 6) {
      const off = d - this.ideal(f);
      if (Math.abs(off) < 0.45) {
        lift = 7.3;
        this.slow = 0.35;
        this.show.call('¡EN SU PUNTO!', true, 0.8);
      } else if (Math.abs(off) < 1.0) lift = 6.6;
      else lift = off > 0 ? 6.4 : 5.4; // (pronto: no llega a pasar por encima; tarde: tropieza con la barra)
    }
    this.vy = lift;
    audio.whoosh();
    this.fx.burst(new THREE.Vector3(this.x, 0.1, this.z), 'dust', 6, 0.8, 0.4);
  }

  private fault(f: Fence, why: string) {
    this.faults++;
    audio.hit();
    vibrate(60);
    this.show.call(why, false, 1.0);
    this.paint();
    if (this.faults >= FAULTS && !this.over) {
      this.over = true;
      window.setTimeout(() => {
        this.show.call('¡ELIMINADA!', false, 1.8);
        window.setTimeout(() => this.reset(), 2000);
      }, 900);
    }
    void f;
  }

  private camTarget() {
    // Detrás del caballo y algo alta (se ve hacia qué lado está la siguiente valla); en el salto, un poco de lado
    const tall = this.ctx.camera.aspect < 1;
    const air = this.y > 0.3 ? 1 : 0;
    return new THREE.Vector3(this.x * 0.6 + air * 2.5, (tall ? 4.2 : 3.6) - air * 0.5, this.z - (tall ? 9 : 8) + air * 2);
  }

  private place(dt: number) {
    const r = this.horse.root;
    r.position.set(this.x, this.y, this.z);
    r.rotation.y = this.yaw + (this.refuseT > 0 ? Math.sin((1 - this.refuseT / 1.4) * Math.PI) * 1.2 : 0);
    const tilt = this.y > 0.02 ? THREE.MathUtils.clamp(-this.vy * 0.06, -0.3, 0.3) : 0;
    this.horse.pivot.rotation.x += (tilt - this.horse.pivot.rotation.x) * Math.min(1, dt * 10);
  }

  update(dtRaw: number) {
    this.slow += (1 - this.slow) * Math.min(1, dtRaw * 2.5);
    const dt = dtRaw * this.slow;
    this.fx.update(dt);
    this.cheerT -= dt;
    this.crowd.forEach((p, i) => animatePerson(p, dt, this.cheerT > 0 ? 'cheer' : i % 3 ? 'idle' : 'talk', 0, this.t * 2 + i));
    const input = this.ctx.input;
    const ax = input.axes();
    if (input.consumeAction()) this.jump();
    if (this.stopT > 0) this.stopT -= dtRaw;
    if (this.refuseT > 0) {
      // Se niega: se para, gira y vuelve unos metros para atrás
      this.refuseT -= dt;
      this.z -= dt * 6;
      this.v = 4;
    } else if (this.started && !this.over && this.stopT <= 0) {
      this.t += dt;
      this.v += (THREE.MathUtils.clamp(8.5 + ax.y * 2.6, 5.5, 11.5) - this.v) * Math.min(1, dt * 2.5);
      // Guiarlo: el joystick a los lados lo lleva a izquierda o derecha (en el aire no se gira)
      if (this.y < 0.05) this.yaw += (THREE.MathUtils.clamp(-ax.x * 0.55, -0.55, 0.55) - this.yaw) * Math.min(1, dt * 4);
      this.z += this.v * Math.cos(this.yaw) * dt;
      this.x = THREE.MathUtils.clamp(this.x + this.v * Math.sin(this.yaw) * dt, -9.5, 9.5);
    }
    if (this.y > 0 || this.vy > 0) {
      this.vy -= GRAV * dt;
      this.y = Math.max(0, this.y + this.vy * dt);
      if (this.y === 0) {
        this.vy = 0;
        audio.knock(0.3, 220, 0.06);
        this.fx.burst(new THREE.Vector3(this.x, 0.1, this.z + 0.8), 'dust', 8, 1, 0.4);
      }
    }
    // El galope suena (cada tranco) y los puntos de los trancos que faltan hasta la siguiente valla
    const f = this.next();
    if (this.started && this.y === 0 && this.refuseT <= 0 && !this.over && this.stopT <= 0) {
      this.strideT -= dt * (this.v / 3.4);
      if (this.strideT <= 0) {
        this.strideT = 1;
        audio.knock(0.18, 140, 0.05);
      }
    }
    const strides = f ? Math.ceil((f.z - (this.z + 1.1) - this.ideal(f)) / 3.4) : 9;
    [...this.dots.children].forEach((d, i) => d.classList.toggle('on', strides >= 0 && strides <= 3 && i < 3 - strides + 1 && i <= 2));
    this.dots.classList.toggle('show', !!f && strides <= 3 && strides >= 0 && this.started && !this.over);
    this.place(dt);
    // Cada obstáculo: limpio si el caballo (unos 2,2 m) pasa por encima de la barra; si llega sin saltar, se niega
    for (const fe of this.fences) {
      if (fe.state !== 'up') {
        if (fe.state === 'down' && fe.fall < 1) {
          fe.fall = Math.min(1, fe.fall + dt * 2.4);
          fe.rail.position.y = fe.h * (1 - fe.fall) + 0.1 * fe.fall;
          fe.rail.position.z = fe.depth + fe.fall * 0.6;
          fe.rail.rotation.y = fe.fall * 0.35;
        }
        continue;
      }
      const front = this.z + 1.1, back = this.z - 1.1;
      // Se escapa: pasa la línea de la valla por el lado (sin ir hacia ella)
      if (front > fe.z && front < fe.z + 0.5 && Math.abs(this.x - fe.x) > 1.7 && this.refuseT <= 0 && !this.over) {
        fe.state = 'down';
        fe.rail.visible = fe.kind !== 'ria';
        this.fault(fe, '¡SE ESCAPA!');
        continue;
      }
      // Se niega: llega a la valla sin haber saltado
      if (this.y < 0.05 && this.vy <= 0 && front > fe.z - 0.4 && front < fe.z + 0.3 && this.refuseT <= 0 && !this.over) {
        this.refuseT = 1.4;
        this.fault(fe, '¡SE NIEGA!');
        continue;
      }
      if (fe.kind === 'ria') {
        // La ría: si cae dentro del agua, falta
        if (this.y === 0 && back > fe.z && front < fe.z + fe.depth + 1.5 && this.z > fe.z + 0.5 && this.z < fe.z + fe.depth) {
          fe.state = 'down';
          this.fx.burst(new THREE.Vector3(this.x, 0.2, this.z), 'spray', 14, 1.4, 1.2);
          this.fault(fe, '¡AL AGUA!');
        } else if (back > fe.z + fe.depth) {
          fe.state = 'clear';
          this.clean(fe);
        }
        continue;
      }
      if (front > fe.z && back < fe.z + fe.depth && this.y < fe.h - 0.32) {
        fe.state = 'down';
        this.fault(fe, '¡DERRIBO!');
      } else if (back > fe.z + fe.depth) {
        fe.state = 'clear';
        this.clean(fe);
      }
    }
    if (!this.over && this.fences.every((fe) => fe.state !== 'up') && this.z > this.fences[this.fences.length - 1].z + 8) this.finish();
    // Gas, mirando cómo pasa
    animatePerson(this.gas, dt, this.over && this.faults < FAULTS ? 'cheer' : 'idle');
    this.gas.root.rotation.y = Math.atan2(0 - 12.4, this.z - 6);
    const cam = this.ctx.camera;
    this.camAt.lerp(this.camTarget(), Math.min(1, dtRaw * 3));
    cam.position.copy(this.camAt);
    this.look.set(this.x * 0.8, 1.0 + this.y * 0.4, this.z + (cam.aspect < 1 ? 7 : 8));
    cam.lookAt(this.look);
    this.hud.setAction(this.started ? '🐎 ¡Salta!' : '🐎 ¡Al galope!');
    this.sky.update(cam, dtRaw);
    this.sun.follow(this.horse.root.position);
  }

  private clean(_f: Fence) {
    audio.chime(4);
    this.cheerT = 1.4;
    this.show.call('¡LIMPIO!', true, 0.7);
    this.paint();
  }

  private finish() {
    this.over = true;
    audio.cheer(0.6);
    this.show.win(this.faults === 0 ? '¡RECORRIDO LIMPIO!' : '¡RECORRIDO TERMINADO!');
    window.setTimeout(() => {
      const done = this.onDone;
      stage.end();
      done();
    }, 3800);
  }

  dispose() {
    window.removeEventListener('pointerdown', this.onTap);
    this.dots.remove();
    this.show.dispose();
    this.hud.remove();
    disposeScene(this.scene);
  }
}

/** La hípica de saltos, en el picadero (misión 3D). */
export function ridingMission(onDone: () => void) {
  stage.start((ctx) => new RidingMission(ctx, onDone), true);
}
