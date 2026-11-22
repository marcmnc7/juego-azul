import * as THREE from 'three';
import { audio } from '../../core/audio';
import { Sky, Sun, toon, vibrate } from '../../core/gfx';
import { Surf } from '../../core/surfaces';
import { stage, type Mission, type MissionCtx } from '../../core/stage';
import { AZUL_DIARIO, GAS_DIARIO } from '../../data/characters';
import { MINIS } from '../../data/story';
import { G, Merger, makePerson, makeDog, animatePerson, type Person, type Dog } from '../../entities/models';
import { hud, comicWord, missionCard, type Hud } from '../../ui/ui';
import { disposeScene } from '../level';

// Misión del capítulo 9 (octubre): Joy, campeona de agility. Primero, en el césped del parque, Gas da las
// órdenes y Azul hace el gesto correcto (Joy obedece… o no); luego el circuito: Joy corre sola y hay que
// decirle «¡salta!» en las vallas y los aros, pero no en los túneles (por ahí se pasa por dentro).
// Con la receta del capítulo 1: cielo pintado, ambiente repartido como en Ferreries (× 0,35) y sol con su tope de
// tebeo; hierba dibujada. Sin toast (no se ven): los fallos, onomatopeyas; las órdenes y el paso al circuito, en
// el bocadillo de Gas; el resultado, en la tarjeta.

type Kind = 'valla' | 'rueda' | 'tunel';
const COURSE: Kind[] = ['valla', 'valla', 'rueda', 'tunel', 'valla', 'valla', 'rueda', 'valla', 'tunel', 'valla'];
const START_X = 4;
const GAP = 6;
const RUN_V = 4.6;

/** De qué lado de la pista va cada obstáculo (z): hay que llevar a Joy hasta él. */
const LANES = [0, -1.3, 1.3, 0, 1.3, -1.3, 0, 1.3, -1.3, 0];
/** Cuántos hay que hacer bien para acabar (si no, otra vuelta). */
const COURSE_NEED = 7;
/** Los trucos, en el césped de al lado de la pista (antes estaban encima de la arena roja). */
const TRICK_Z = 4.7;

interface Obstacle {
  x: number;
  z: number;
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
  private walkers: { p: Person; mode: string; dog: Dog | null; x0: number; z: number; dir: number }[] = [];
  private endT = -1;
  private again = false;

  constructor(private ctx: MissionCtx, private onDone: () => void) {
    const sc = this.scene;
    const sunDir = new THREE.Vector3(0.5, 0.6, -0.4);
    sc.fog = new THREE.Fog(0xcfe0ee, 60, 160);
    this.sky = new Sky({ top: 0x2a6fd0, mid: 0x7fbdf2, bottom: 0xf6ead2, sun: { color: 0xfff4dc, dir: sunDir, size: 60 }, clouds: { count: 9, tint: 0xffffff } });
    sc.add(this.sky.group);
    sc.userData.hemiScale = 0.35;
    sc.add(new THREE.HemisphereLight(0xeaf2ff, 0x5a7a3a, 1.0));
    this.sun = new Sun(sc, 0xfff1dc, 3.4, sunDir, 26);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(160, 80).rotateX(-Math.PI / 2), toon({ color: 0x6f9a48, surf: Surf.Grass }));
    grass.position.x = 30;
    grass.userData.noCast = true;
    sc.add(grass);
    const m = new Merger();
    // Pista del circuito (franja de césped más clara) y los obstáculos
    // (4.3) El circuito de verdad: pista ancha de arena roja con su cuerda blanca, arco de salida y de meta con
    // banderines, y los obstáculos a un lado u otro de la pista (hay que llevar a Joy hasta cada uno)
    m.add(G.box, 0xc8794a, 36, 0.006, 0, 0, 0, 0, 72, 0.012, 4.6);
    for (const z of [-2.35, 2.35]) m.add(G.box, 0xf6f1e4, 36, 0.016, z, 0, 0, 0, 72, 0.01, 0.08);
    for (const [ax, c] of [[START_X + 2, 0x2f6fd0], [START_X + 8 + COURSE.length * GAP, 0xd7263d]] as const) {
      for (const z of [-2.6, 2.6]) m.add(G.box, c, ax, 1.4, z, 0, 0, 0, 0.16, 2.8, 0.16);
      m.add(G.box, c, ax, 2.85, 0, 0, 0, 0, 0.2, 0.3, 5.4);
      for (let k = 0; k < 9; k++) m.add(G.cone, [0xd7263d, 0xf2c94c, 0x2f6fd0][k % 3], ax, 2.55, -2.2 + k * 0.55, Math.PI, 0, 0, 0.18, 0.3, 0.05);
    }
    COURSE.forEach((kind, i) => {
      const x = START_X + 8 + i * GAP;
      const z = LANES[i];
      const o: Obstacle = { x, z, kind, done: false };
      if (kind === 'valla') {
        for (const dz of [-0.7, 0.7]) {
          m.add(G.box, 0xf2f2ee, x, 0.45, z + dz, 0, 0, 0, 0.07, 0.9, 0.07);
          m.add(G.box, 0xf2f2ee, x, 0.03, z + dz, 0, 0, 0, 0.5, 0.06, 0.1);
        }
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 10).rotateX(Math.PI / 2), toon({ color: i % 2 ? 0x2f6fd0 : 0xd7263d }));
        bar.position.set(x, 0.55, z);
        bar.castShadow = true;
        sc.add(bar);
        o.bar = bar;
      } else if (kind === 'rueda') {
        for (const dz of [-0.8, 0.8]) m.add(G.box, 0x2f6fd0, x, 0.65, z + dz, 0, 0, 0, 0.07, 1.3, 0.07);
        m.add(G.box, 0x2f6fd0, x, 1.3, z, 0, 0, 0, 0.07, 0.07, 1.67);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 12, 28).rotateY(Math.PI / 2), toon({ color: 0xf2c94c }));
        ring.position.set(x, 0.72, z);
        ring.castShadow = true;
        sc.add(ring);
      } else {
        const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 2.4, 20, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), toon({ color: 0x1b8a6a, side: THREE.DoubleSide }));
        tunnel.position.set(x, 0.02, z);
        tunnel.castShadow = true;
        sc.add(tunnel);
        for (const dx of [-1.2, 1.2]) m.add(new THREE.TorusGeometry(0.47, 0.04, 6, 20, Math.PI).rotateY(Math.PI / 2), 0x14684f, x + dx, 0.02, z, 0, 0, 0, 1, 1, 1);
      }
      // Un banderín junto a cada obstáculo, del color de su lado
      m.add(G.cyl, 0xf6f1e4, x, 0.6, z + (z > 0 ? 1.1 : -1.1) * (z ? 1 : 1), 0, 0, 0, 0.03, 1.2, 0.03);
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
    // Más parque al fondo: otra hilera de árboles, parterres con flores, farolas y bancos con gente
    for (let i = 0; i < 14; i++) {
      const x = -14 + i * 7 + Math.cos(i * 1.7) * 2;
      for (const z of [-17 - (i % 3), 16 + (i % 2) * 2]) {
        m.add(G.cyl, 0x5a4a38, x, 1.6, z, 0, 0, 0, 0.34, 3.2, 0.34);
        m.add(G.bush, i % 2 ? 0x3f6a32 : 0x557f3c, x, 4, z, 0, i, 0, 4.2, 3.2, 4.2);
      }
    }
    for (const [x, z] of [[-6, -5], [8, 6], [20, -6], [34, 6]] as const) {
      m.add(G.cyl, 0x8a6a44, x, 0.12, z, 0, 0, 0, 3.2, 0.24, 3.2);
      for (let k = 0; k < 9; k++) m.add(G.sphere, [0xe0533a, 0xf2c94c, 0xf6f1e4, 0xc85aa0][k % 4], x + Math.cos(k * 0.7) * (0.4 + (k % 3) * 0.4), 0.34, z + Math.sin(k * 0.7) * (0.4 + (k % 3) * 0.4), 0, 0, 0, 0.32, 0.26, 0.32);
    }
    for (const x of [-9, 6, 22, 38]) {
      m.add(G.cyl, 0x2a2e33, x, 1.7, -10.4, 0, 0, 0, 0.1, 3.4, 0.1);
      m.add(G.sphere, 0xf6efd8, x, 3.5, -10.4, 0, 0, 0, 0.36, 0.42, 0.36);
    }
    for (const x of [12, 28]) {
      m.add(G.box, 0x8a6a44, x, 0.45, -10.6, 0, 0, 0, 1.8, 0.08, 0.45);
      m.add(G.box, 0x8a6a44, x, 0.75, -10.85, 0, 0, 0, 1.8, 0.4, 0.06);
    }
    for (let i = 0; i < 30; i++) m.add(G.box, 0xe8e2d0, -10 + i * 3, 0.5, -12, 0, 0, 0, 0.08, 1.0, 0.08);
    m.add(G.box, 0xe8e2d0, 35, 0.9, -12, 0, 0, 0, 90, 0.06, 0.06);
    sc.add(m.mesh());

    this.me = makePerson(AZUL_DIARIO);
    this.gas = makePerson(GAS_DIARIO);
    // Los dos de pie frente a Joy, que los mira sentada en el césped; la cámara, de lado
    this.me.root.position.set(1.5, 0, 1.6 + TRICK_Z);
    this.gas.root.position.set(-0.4, 0, 1.7 + TRICK_Z);
    for (const p of [this.me, this.gas]) p.root.rotation.y = Math.atan2(0.6 - p.root.position.x, TRICK_Z - p.root.position.z);
    this.joy = makeDog();
    this.joy.root.position.set(0.6, 0, -0.1 + TRICK_Z);
    this.joy.root.rotation.y = 0;
    sc.add(this.me.root, this.gas.root, this.joy.root);
    // Gente del parque: dos sentados en los bancos y dos paseando a su perro por el fondo
    const LOOKS = [
      { skin: 0xe8b894, shirt: 0x8a3a3a, pants: 0x2a2a2a, hair: 0x2b1d14, hairStyle: 'short', male: true },
      { skin: 0xf0c8a6, shirt: 0x3a6a8a, pants: 0x3b4a6b, hair: 0x6b3f22, hairStyle: 'straight' },
      { skin: 0xd9a27c, shirt: 0xd8cfc0, pants: 0x3a5a3a, hair: 0x1f1610, hairStyle: 'short', male: true },
      { skin: 0xf3d2b6, shirt: 0xe0a040, pants: 0x222222, hair: 0x9a6a3a, hairStyle: 'straight' },
    ] as const;
    this.walkers = [[11.4, -9.7, 'talk'], [12.6, -9.7, 'talk'], [-4, -7.5, 'walk'], [18, 7.5, 'walk']].map(([x, z, mode], i) => {
      const p = makePerson(LOOKS[i]);
      p.root.position.set(x as number, 0, z as number);
      p.root.rotation.y = mode === 'talk' ? (i === 0 ? Math.PI / 2 : -Math.PI / 2) : i === 2 ? Math.PI / 2 : -Math.PI / 2;
      sc.add(p.root);
      let dog: Dog | null = null;
      if (mode === 'walk') {
        dog = makeDog();
        dog.root.scale.setScalar(0.8);
        sc.add(dog.root);
      }
      return { p, mode: mode as string, dog, x0: x as number, z: z as number, dir: i === 2 ? 1 : -1 };
    });

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
    this.hud.setObjective('🐕');
    ctx.camera.position.set(4.2, 1.5, 3.6 + TRICK_Z);
    ctx.camera.lookAt(0.5, 0.55, 0.7 + TRICK_Z);
    this.order = Array.from({ length: 6 }, (_, i) => (i + Math.floor(Math.random() * 4)) % T.commands.length);
    missionCard(T.title, T.hint);
    this.nextCmd();
  }

  private updateHud() {
    if (this.phase === 'tricks') this.hud.setCounters(`<span class="chip">🐕 ${this.ok}/${this.order.length}</span>`);
    else this.hud.setCounters(`<span class="chip${this.hits >= COURSE_NEED ? ' ok' : ''}">🏁 ${this.hits}/${COURSE_NEED}</span>`);
  }

  // ---------- Trucos ----------

  private nextCmd(repeat = false) {
    if (!repeat) this.cmd++;
    this.cmdT = 0;
    this.updateHud();
    if (this.cmd >= this.order.length) {
      this.startCourse();
      // (lo dice Gas, en su bocadillo: «N trucos. Ahora, el circuito»)
      this.say(MINIS.tricks.done(this.ok));
      return;
    }
    const c = MINIS.tricks.commands[this.order[this.cmd]];
    this.say(`¡${c.say}!`);
    audio.talk();
  }

  /** Lo que dice Gas, en su bocadillo de abajo. */
  private say(text: string) {
    // (como un bocadillo de tebeo: el nombre arriba y la frase, sin comillas)
    this.bubble.innerHTML = '';
    const who = document.createElement('b');
    who.textContent = 'Gas';
    const say = document.createElement('span');
    say.textContent = text;
    this.bubble.append(who, say);
    this.bubble.classList.remove('pop');
    void this.bubble.offsetWidth;
    this.bubble.classList.add('pop');
  }

  private answer(i: number) {
    if (this.phase !== 'tricks' || this.cmd >= this.order.length || this.cmdT < 0.25) return;
    if (i === this.order[this.cmd]) {
      this.ok++;
      this.pose = i;
      this.poseT = 1.2;
      audio.pickup();
      vibrate(15);
      this.cmdT = -1.3; // un momento para que se vea el truco antes de la siguiente orden
    } else {
      // (4.3: hasta que no lo hace bien, no hay siguiente orden: la misma otra vez)
      comicWord(MINIS.tricks.wrong, 'hit');
      audio.boo();
      this.cmdT = -1.0;
      this.again = true;
    }
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
      case 1: // abajo
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
    this.hud.setObjective('🏁');
    this.hits = 0;
    this.jumpT = -1;
    for (const o of this.obs) {
      o.done = false;
      if (o.bar) o.bar.rotation.x = 0;
    }
    this.joy.root.position.set(START_X, 0, 0);
    this.joy.root.rotation.set(0, Math.PI / 2, 0);
    // Azul corre al lado de Joy por fuera de la pista (en agility, la guía va con el perro)
    this.me.root.position.set(START_X - 0.6, 0, 3.0);
    this.me.root.rotation.y = Math.PI / 2;
    this.gas.root.position.set(START_X - 3, 0, 3.8);
    this.gas.root.rotation.y = Math.PI / 2;
    missionCard(MINIS.agility.title, MINIS.agility.hint);
    this.updateHud();
    // (el bocadillo de los trucos no se queda tapando el circuito)
    window.setTimeout(() => (this.bubble.style.display = 'none'), 2600);
  }

  private updateCourse(dt: number, pressed: boolean, ax: { x: number; y: number }) {
    const r = this.joy.root;
    if (pressed && this.jumpT < 0) {
      this.jumpT = 0;
      audio.knock(0.25, 900, 0.04);
    }
    r.position.x += RUN_V * dt;
    // Con el joystick, Joy va a un lado u otro de la pista (con la cámara detrás: derecha es +z)
    r.position.z = THREE.MathUtils.clamp(r.position.z + ax.x * 3.2 * dt, -2.0, 2.0);
    r.rotation.y = Math.PI / 2 - ax.x * 0.35;
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
      const lined = Math.abs(r.position.z - o.z) < 0.55;
      const air = r.position.y > 0.28;
      const good = lined && (o.kind === 'tunel' ? !air : air);
      if (good) {
        this.hits++;
        audio.pickup();
        comicWord('¡BIEN!', 'perfect');
      } else {
        audio.boo();
        comicWord(!lined ? MINIS.agility.missed : o.kind === 'tunel' ? MINIS.agility.overTunnel : MINIS.agility.knock, 'hit');
        if (o.bar && lined) o.bar.rotation.x = 0.9; // la barra, tirada
      }
      this.updateHud();
    }
    // En el túnel, por dentro (agachada)
    const inTunnel = this.obs.some((o) => o.kind === 'tunel' && Math.abs(r.position.x - o.x) < 1.2 && Math.abs(r.position.z - o.z) < 0.55);
    r.scale.y = inTunnel && r.position.y < 0.1 ? 0.8 : 1;
    // Azul, corriendo a su lado por fuera de la pista
    const mp = this.me.root.position;
    mp.x += (r.position.x - 0.5 - mp.x) * Math.min(1, dt * 6);
    mp.z += (Math.max(2.9, r.position.z + 1.4) - mp.z) * Math.min(1, dt * 4);
    animatePerson(this.me, dt, 'walk', 1.4);
    this.me.root.rotation.y = Math.PI / 2;
    if (r.position.x > this.obs[this.obs.length - 1].x + 4 && this.phase === 'course') {
      this.hud.setAction(null);
      if (this.hits >= COURSE_NEED) {
        this.phase = 'end';
        this.endT = 0;
        missionCard(MINIS.agility.title, MINIS.agility.done(this.hits), true);
      } else {
        // Pocos bien: otra vuelta
        comicWord(MINIS.agility.again(this.hits, COURSE_NEED), 'hit');
        this.startCourse();
      }
    }
  }

  update(dt: number) {
    this.t += dt;
    // La gente del fondo: los de los paseos van y vienen con su perro delante; los otros, de charla
    for (const w of this.walkers) {
      if (w.mode !== 'walk') {
        animatePerson(w.p, dt, 'talk', 0, this.t * 3 + w.x0);
        continue;
      }
      const r = w.p.root;
      r.position.x += w.dir * 1.1 * dt;
      if (Math.abs(r.position.x - w.x0) > 7) {
        w.dir = -w.dir;
        r.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      animatePerson(w.p, dt, 'walk', 1.1);
      if (w.dog) {
        w.dog.root.position.set(r.position.x + w.dir * 1.3, 0, w.z + 0.5);
        w.dog.root.rotation.y = r.rotation.y;
      }
    }
    const { input, camera } = this.ctx;
    const pressed = input.consumeAction();
    if (this.phase === 'tricks') {
      this.cmdT += dt;
      if (this.cmdT > 3.4) {
        // Se ha despistado: la misma orden otra vez
        comicWord(MINIS.tricks.slow, 'luck');
        this.cmdT = 0;
        this.nextCmd(true);
      }
      // Después de un truco (cmdT en negativo) sale la orden siguiente (o la misma, si falló)
      if (this.cmdT >= 0 && this.cmdT - dt < 0 && this.cmd >= 0) {
        this.nextCmd(this.again);
        this.again = false;
      }
      this.poseJoy(dt);
      this.hud.setAction(null);
      camera.position.lerp(new THREE.Vector3(4.2, 1.5, 3.6 + TRICK_Z), Math.min(1, dt * 2));
      camera.lookAt(0.5, 0.55, 0.7 + TRICK_Z);
    } else {
      if (this.phase === 'course') {
        this.updateCourse(dt, pressed, input.axes());
        this.hud.setAction(MINIS.agility.btn, this.obs.some((o) => !o.done && o.kind !== 'tunel' && o.x - this.joy.root.position.x < 1.6 && o.x > this.joy.root.position.x));
      }
      // Cámara detrás de Joy, alta: se ve hacia qué lado está el siguiente obstáculo
      const x = this.joy.root.position.x, z = this.joy.root.position.z;
      camera.position.lerp(new THREE.Vector3(x - 4.6, 2.7, z * 0.5 + 1.2), Math.min(1, dt * 3));
      camera.lookAt(x + 3, 0.4, z * 0.4);
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
    if (this.phase !== 'course') animatePerson(this.me, dt, this.phase === 'end' ? 'cheer' : 'idle');
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
