import * as THREE from 'three';
import { audio } from '../../core/audio';
import { Sky, Sun, toon, vibrate } from '../../core/gfx';
import { Surf } from '../../core/surfaces';
import { stage, type Mission, type MissionCtx } from '../../core/stage';
import { MARGAUX_LOOK, MARC_LOOK } from '../../data/characters';
import { MINIS } from '../../data/story';
import { G, Merger, makePerson, makeDog, animatePerson, type Person, type Dog } from '../../entities/models';
import { hud, toast, missionCard, type Hud } from '../../ui/ui';
import { disposeScene } from '../level';

// Misión del capítulo 9 (octubre): Joy, campeona de agility. Primero, en el césped del parque, Gas da las
// órdenes y Azul hace el gesto correcto (Joy obedece… o no); luego el circuito: Joy corre sola y hay que
// decirle «¡salta!» en las vallas y los aros, pero no en los túneles (por ahí se pasa por dentro).

type Kind = 'valla' | 'rueda' | 'tunel';
const COURSE: Kind[] = ['valla', 'valla', 'rueda', 'tunel', 'valla', 'valla', 'rueda', 'valla', 'tunel', 'valla'];
const START_X = 4;
const GAP = 6;
const RUN_V = 4.6;

interface Obstacle {
  x: number;
  kind: Kind;
  done: boolean;
  bar?: THREE.Object3D;
}

class ParkMission implements Mission {
  readonly scene = new THREE.Scene();
  private hud: Hud;
  private me: Person;
  private gas: Person;
  private joy: Dog;
  private sky: Sky;
  private sun: Sun;
  private t = 0;
  private phase: 'tricks' | 'course' | 'end' = 'tricks';
  // Trucos
  private order: number[] = [];
  private cmd = -1;
  private cmdT = 0;
  private ok = 0;
  private pose = -1;
  private poseT = 0;
  private bar: HTMLElement;
  private bubble: HTMLElement;
  // Circuito
  private obs: Obstacle[] = [];
  private jumpT = -1;
  private hits = 0;
  private endT = -1;

  constructor(private ctx: MissionCtx, private onDone: () => void) {
    const sc = this.scene;
    const sunDir = new THREE.Vector3(0.5, 0.6, -0.4);
    sc.fog = new THREE.Fog(0xd8e8f0, 40, 160);
    this.sky = new Sky({ top: 0x4a86cc, mid: 0x9cc8ea, bottom: 0xe6f0f2, sun: { color: 0xfff0c8, dir: sunDir, size: 40 }, clouds: { count: 8, tint: 0xffffff }, physical: { sunDir } });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0xdcecff, 0x5a7a3a, 0.9));
    this.sun = new Sun(sc, 0xfff2d8, 2.0, sunDir, 26);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(160, 80).rotateX(-Math.PI / 2), toon({ color: 0x6f9a48, surf: Surf.Grass }));
    grass.position.x = 30;
    grass.userData.noCast = true;
    sc.add(grass);
    const m = new Merger();
    // Pista del circuito (franja de césped más clara) y los obstáculos
    m.add(G.box, 0x86ad58, 30, 0.005, 0, 0, 0, 0, 80, 0.01, 2.4);
    COURSE.forEach((kind, i) => {
      const x = START_X + 8 + i * GAP;
      const o: Obstacle = { x, kind, done: false };
      if (kind === 'valla') {
        for (const z of [-0.7, 0.7]) m.add(G.box, 0xf2f2ee, x, 0.45, z, 0, 0, 0, 0.06, 0.9, 0.06);
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 10).rotateX(Math.PI / 2), toon({ color: i % 2 ? 0x2f6fd0 : 0xd7263d }));
        bar.position.set(x, 0.55, 0);
        bar.castShadow = true;
        sc.add(bar);
        o.bar = bar;
      } else if (kind === 'rueda') {
        for (const z of [-0.8, 0.8]) m.add(G.box, 0x2f6fd0, x, 0.65, z, 0, 0, 0, 0.07, 1.3, 0.07);
        m.add(G.box, 0x2f6fd0, x, 1.3, 0, 0, 0, 0, 0.07, 0.07, 1.67);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 12, 28).rotateY(Math.PI / 2), toon({ color: 0xf2c94c }));
        ring.position.set(x, 0.72, 0);
        ring.castShadow = true;
        sc.add(ring);
      } else {
        const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.4, 20, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), toon({ color: 0x1b8a6a, side: THREE.DoubleSide }));
        tunnel.position.set(x, 0.02, 0);
        tunnel.castShadow = true;
        sc.add(tunnel);
      }
      this.obs.push(o);
    });
    // Árboles, banco y valla del parque
    for (let i = 0; i < 18; i++) {
      const x = -8 + i * 5.5 + Math.sin(i * 2.1) * 1.5;
      const z = i % 2 ? 9 + Math.cos(i) * 2 : -9 - Math.sin(i) * 2;
      m.add(G.cyl, 0x5a4a38, x, 1.3, z, 0, 0, 0, 0.3, 2.6, 0.3);
      m.add(G.bush, i % 3 ? 0x3f6a32 : 0x4d7a3a, x, 3.2, z, 0, i, 0, 3.4, 2.6, 3.4);
    }
    m.add(G.box, 0x8a6a44, -2.5, 0.45, 3.2, 0, 0, 0, 1.8, 0.08, 0.45);
    for (const x of [-3.2, -1.8]) m.add(G.box, 0x3a3a3e, x, 0.22, 3.2, 0, 0, 0, 0.08, 0.45, 0.4);
    for (let i = 0; i < 30; i++) m.add(G.box, 0xe8e2d0, -10 + i * 3, 0.5, -12, 0, 0, 0, 0.08, 1.0, 0.08);
    m.add(G.box, 0xe8e2d0, 35, 0.9, -12, 0, 0, 0, 90, 0.06, 0.06);
    sc.add(m.mesh());

    this.me = makePerson(MARGAUX_LOOK);
    this.gas = makePerson(MARC_LOOK);
    // Los dos de pie frente a Joy, que los mira sentada en el césped; la cámara, de lado
    this.me.root.position.set(1.5, 0, 1.6);
    this.gas.root.position.set(-0.4, 0, 1.7);
    for (const p of [this.me, this.gas]) p.root.rotation.y = Math.atan2(0.6 - p.root.position.x, 0 - p.root.position.z);
    this.joy = makeDog();
    this.joy.root.position.set(0.6, 0, -0.1);
    this.joy.root.rotation.y = 0;
    sc.add(this.me.root, this.gas.root, this.joy.root);

    // Los gestos de los trucos (abajo) y el bocadillo de Gas
    const T = MINIS.tricks;
    const root = document.getElementById('ui')!;
    this.bar = document.createElement('div');
    this.bar.className = 'trick-bar';
    T.commands.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'trick-btn';
      b.innerHTML = `<span>${c.icon}</span>${c.label}`;
      b.onpointerdown = (e) => {
        e.preventDefault();
        this.answer(i);
      };
      this.bar.append(b);
    });
    this.bubble = document.createElement('div');
    this.bubble.className = 'pr-log trick-say';
    root.append(this.bar, this.bubble);

    this.hud = hud(() => ctx.input.queueAction(), () => {}, T.hint, true);
    this.hud.setObjective(T.hint);
    ctx.camera.position.set(4.2, 1.5, 3.6);
    ctx.camera.lookAt(0.5, 0.55, 0.7);
    this.order = Array.from({ length: 6 }, (_, i) => (i + Math.floor(Math.random() * 4)) % T.commands.length);
    missionCard(T.title, T.hint);
    this.nextCmd();
  }

  private updateHud() {
    if (this.phase === 'tricks') this.hud.setCounters(`<span class="chip">🐕 ${this.ok}/${this.order.length}</span>`);
    else this.hud.setCounters(`<span class="chip">🏁 ${this.hits}/${COURSE.length}</span>`);
  }

  // ---------- Trucos ----------

  private nextCmd() {
    this.cmd++;
    this.cmdT = 0;
    this.updateHud();
    if (this.cmd >= this.order.length) {
      toast(MINIS.tricks.done(this.ok));
      this.startCourse();
      return;
    }
    const c = MINIS.tricks.commands[this.order[this.cmd]];
    this.bubble.textContent = `Gas: «¡${c.say}!»`;
    this.bubble.classList.remove('pop');
    void this.bubble.offsetWidth;
    this.bubble.classList.add('pop');
    audio.talk();
  }

  private answer(i: number) {
    if (this.phase !== 'tricks' || this.cmd >= this.order.length || this.cmdT < 0.25) return;
    if (i === this.order[this.cmd]) {
      this.ok++;
      this.pose = i;
      this.poseT = 1.2;
      audio.pickup();
      vibrate(15);
    } else {
      toast(MINIS.tricks.wrong);
      audio.boo();
    }
    this.cmdT = -1.3; // un momento para que se vea el truco antes de la siguiente orden
  }

  /** Joy hace el truco con todo el cuerpo (su modelo no trae poses: se inclina, se agacha o da la vuelta). */
  private poseJoy(dt: number) {
    const r = this.joy.root;
    this.poseT -= dt;
    const k = this.poseT > 0 ? Math.min(1, (1.2 - this.poseT) * 6, this.poseT * 4) : 0;
    const base = 0;
    r.position.y = 0;
    r.rotation.set(0, base, 0);
    if (k <= 0) return;
    switch (this.pose) {
      case 0: // sienta
        r.rotation.x = -0.45 * k;
        r.position.y = -0.04 * k;
        break;
      case 1: // tumba
        r.position.y = -0.16 * k;
        r.rotation.x = 0.08 * k;
        break;
      case 2: // pata
        r.rotation.x = -0.22 * k;
        r.rotation.z = 0.15 * k;
        break;
      case 3: // gira
        r.rotation.y = base + (1 - this.poseT / 1.2) * Math.PI * 2;
        break;
    }
  }

  // ---------- Circuito ----------

  private startCourse() {
    this.phase = 'course';
    this.bar.remove();
    this.bubble.textContent = MINIS.agility.hint;
    this.hud.setObjective(MINIS.agility.hint);
    this.joy.root.position.set(START_X, 0, 0);
    this.joy.root.rotation.set(0, Math.PI / 2, 0);
    missionCard(MINIS.agility.title, MINIS.agility.hint);
    this.updateHud();
  }

  private updateCourse(dt: number, pressed: boolean) {
    const r = this.joy.root;
    if (pressed && this.jumpT < 0) {
      this.jumpT = 0;
      audio.knock(0.25, 900, 0.04);
    }
    r.position.x += RUN_V * dt;
    if (this.jumpT >= 0) {
      this.jumpT += dt / 0.55;
      r.position.y = Math.sin(Math.min(1, this.jumpT) * Math.PI) * 0.75;
      if (this.jumpT >= 1) {
        this.jumpT = -1;
        r.position.y = 0;
      }
    }
    for (const o of this.obs) {
      if (o.done || r.position.x < o.x) continue;
      o.done = true;
      const air = r.position.y > 0.28;
      const good = o.kind === 'tunel' ? !air : air;
      if (good) {
        this.hits++;
        audio.pickup();
      } else {
        audio.boo();
        toast(o.kind === 'tunel' ? MINIS.agility.overTunnel : MINIS.agility.knock);
        if (o.bar) o.bar.rotation.x = 0.9; // la barra, tirada
      }
      this.updateHud();
    }
    // En el túnel, por dentro (agachada)
    const inTunnel = this.obs.some((o) => o.kind === 'tunel' && Math.abs(r.position.x - o.x) < 1.2);
    r.scale.y = inTunnel && r.position.y < 0.1 ? 0.8 : 1;
    if (r.position.x > this.obs[this.obs.length - 1].x + 4 && this.phase === 'course') {
      this.phase = 'end';
      this.endT = 0;
      this.hud.setAction(null);
      toast(MINIS.agility.done(this.hits));
      missionCard(MINIS.agility.title, '', true);
    }
  }

  update(dt: number) {
    this.t += dt;
    const { input, camera } = this.ctx;
    const pressed = input.consumeAction();
    if (this.phase === 'tricks') {
      this.cmdT += dt;
      if (this.cmdT > 3.4) {
        toast(MINIS.tricks.slow);
        this.cmdT = 0;
        this.nextCmd();
      }
      // Después de un truco (cmdT en negativo) sale la orden siguiente
      if (this.cmdT >= 0 && this.cmdT - dt < 0 && this.cmd >= 0) this.nextCmd();
      this.poseJoy(dt);
      this.hud.setAction(null);
      camera.position.lerp(new THREE.Vector3(4.2, 1.5, 3.6), Math.min(1, dt * 2));
      camera.lookAt(0.5, 0.55, 0.7);
    } else {
      if (this.phase === 'course') {
        this.updateCourse(dt, pressed);
        this.hud.setAction(MINIS.agility.btn, this.obs.some((o) => !o.done && o.kind !== 'tunel' && o.x - this.joy.root.position.x < 1.6 && o.x > this.joy.root.position.x));
      }
      // Cámara de lado siguiendo a Joy por el circuito
      const x = this.joy.root.position.x;
      camera.position.lerp(new THREE.Vector3(x + 1, 1.6, 6.2), Math.min(1, dt * 3));
      camera.lookAt(x + 1.5, 0.5, 0);
      if (this.endT >= 0) {
        this.endT += dt;
        if (this.endT > 2.6) {
          const done = this.onDone;
          stage.end();
          done();
          return;
        }
      }
    }
    animatePerson(this.me, dt, this.phase === 'end' ? 'cheer' : 'idle');
    animatePerson(this.gas, dt, this.phase === 'end' ? 'cheer' : this.phase === 'tricks' ? 'talk' : 'idle');
    // Azul hace el gesto con la mano cuando Joy hace el truco
    if (this.phase === 'tricks' && this.poseT > 0) this.me.armR.rotation.x = -1.4;
    this.sky.update(camera, dt);
    this.sun.follow(this.joy.root.position);
  }

  dispose() {
    this.hud.remove();
    this.bar.remove();
    this.bubble.remove();
    disposeScene(this.scene);
  }
}

/** Octubre: adiestrar a Joy y el circuito de agility. */
export function parkMission(onDone: () => void) {
  stage.start((ctx) => new ParkMission(ctx, onDone), false);
}
