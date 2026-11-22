import * as THREE from 'three';
import { audio } from '../../core/audio';
import { Sky, Sun, toon, vibrate } from '../../core/gfx';
import { Surf } from '../../core/surfaces';
import { stage, type Mission, type MissionCtx } from '../../core/stage';
import { AZUL_DIARIO, GAS_DIARIO } from '../../data/characters';
import { MINIS } from '../../data/story';
import { G, Merger, makePerson, makeDog, animatePerson, type Person, type Dog } from '../../entities/models';
import { hud, comicWord, missionCard, livesChip, bark, type Hud } from '../../ui/ui';
import { Show } from './show';
import { disposeScene } from '../level';
import { canvasTex } from '../deco';

// Misión del capítulo 9 (octubre): Joy, campeona de agility. Primero, en el césped del parque, Gas da las
// órdenes y Azul hace el gesto correcto (Joy obedece… o no); luego el circuito: Joy corre sola y hay que
// decirle «¡salta!» en las vallas y los aros, pero no en los túneles (por ahí se pasa por dentro).
// Con la receta del capítulo 1: cielo pintado, ambiente repartido como en Ferreries (× 0,35) y sol con su tope de
// tebeo; hierba dibujada. Sin toast (no se ven): los fallos, onomatopeyas; las órdenes y el paso al circuito, en
// el bocadillo de Gas; el resultado, en la tarjeta.

type Kind = 'valla' | 'doble' | 'rueda' | 'tunel' | 'slalom' | 'pasarela' | 'mesa';
/** (4.4.4) Un recorrido de agility de verdad: vallas, doble, rueda, túnel, slalom, pasarela y mesa. Cada uno, en su
 * lado de la pista (z): hay que llevar a Joy hasta él. */
const COURSE: [Kind, number][] = [
  ['valla', 0], ['valla', -1.3], ['tunel', 1.2], ['rueda', 0], ['slalom', 0], ['doble', -1.2], ['pasarela', 0],
  ['valla', 1.3], ['mesa', 0], ['tunel', -1.2], ['rueda', 1.2], ['valla', 0], ['doble', 0], ['valla', -1.3],
];
/** Lo largo que es cada obstáculo (m), para repartirlos por la pista. */
const LEN: Record<Kind, number> = { valla: 0.2, doble: 1.1, rueda: 0.2, tunel: 2.4, slalom: 6, pasarela: 6, mesa: 1.2 };
const START_X = 4;
const RUN_V = 4.6;
/** Faltas que se pueden hacer (con una más, eliminada: otra vez el recorrido). */
const FAULTS = 3;
/** Los trucos, en el césped de al lado de la pista (antes estaban encima de la arena roja). */
const TRICK_Z = 4.7;

interface Obstacle {
  x: number;
  z: number;
  kind: Kind;
  done: boolean;
  /** Para los que se hacen por tramos (slalom, pasarela, mesa): cómo va. */
  prog: number;
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
  private faults = 0;
  private show = new Show('Lo que nos gusta · octubre');
  private slow = 1;
  private speedV = RUN_V;
  private stopT = 0;
  private crowd: Person[] = [];
  private cheerT = 0;
  private callAt = -1;
  private courseEnd = 0;
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
    // (4.4.4) La pista de agility: arena roja con su cuerda, arco de salida y de meta, y los obstáculos repartidos
    // según lo largo que es cada uno, numerados (con su banderín) como en una prueba de verdad
    let x = START_X + 8;
    const plan = COURSE.map(([kind, z]) => {
      const at = x;
      x += LEN[kind] + 5.2;
      return { kind, z, at };
    });
    this.courseEnd = x + 2;
    const L = this.courseEnd + 6, mid = L / 2;
    // (la arena, con su superficie de arena: con el Merger salía dibujada como ladrillos)
    const track = new THREE.Mesh(new THREE.PlaneGeometry(L, 4.6).rotateX(-Math.PI / 2), toon({ color: 0xc8794a, surf: Surf.Sand }));
    track.position.set(mid, 0.008, 0);
    track.userData.noCast = true;
    sc.add(track);
    for (const z of [-2.35, 2.35]) m.add(G.box, 0xf6f1e4, mid, 0.016, z, 0, 0, 0, L, 0.01, 0.08);
    for (const [ax, c] of [[START_X + 2, 0x2f6fd0], [this.courseEnd, 0xd7263d]] as const) {
      for (const z of [-2.6, 2.6]) m.add(G.box, c, ax, 1.4, z, 0, 0, 0, 0.16, 2.8, 0.16);
      m.add(G.box, c, ax, 2.85, 0, 0, 0, 0, 0.2, 0.3, 5.4);
      for (let k = 0; k < 9; k++) m.add(G.cone, [0xd7263d, 0xf2c94c, 0x2f6fd0][k % 3], ax, 2.55, -2.2 + k * 0.55, Math.PI, 0, 0, 0.18, 0.3, 0.05);
    }
    // Gradas a los dos lados, con su gente (que aplaude los limpios)
    for (const sz of [-1, 1]) {
      m.add(G.box, 0x8a6a44, mid, 0.25, sz * 5.6, 0, 0, 0, L * 0.8, 0.5, 1.4);
      m.add(G.box, 0x9a7a54, mid, 0.65, sz * 6.5, 0, 0, 0, L * 0.8, 1.3, 1.2);
    }
    const LOOKS_C = [
      { skin: 0xe8b894, shirt: 0x2f6fd0, pants: 0x2a2a2a, hair: 0x2b1d14, hairStyle: 'short', male: true },
      { skin: 0xf0c8a6, shirt: 0xd7263d, pants: 0x3b4a6b, hair: 0x6b3f22, hairStyle: 'straight' },
      { skin: 0xd9a27c, shirt: 0xf2c94c, pants: 0x3a5a3a, hair: 0x1f1610, hairStyle: 'short', male: true },
      { skin: 0xf3d2b6, shirt: 0x3fa27a, pants: 0x222222, hair: 0x9a6a3a, hairStyle: 'straight' },
    ] as const;
    for (let i = 0; i < 10; i++) {
      const p = makePerson(LOOKS_C[i % 4]);
      const sz = i % 2 ? 1 : -1;
      p.root.position.set(START_X + 10 + i * ((L - 20) / 10), sz > 0 ? 1.3 : 0.5, sz * (sz > 0 ? 6.5 : 5.6));
      p.root.rotation.y = sz > 0 ? Math.PI : 0;
      sc.add(p.root);
      this.crowd.push(p);
    }
    const NUM = (n: number) =>
      new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.5),
        new THREE.MeshBasicMaterial({
          map: canvasTex((c, w, h) => {
            c.fillStyle = '#fffbf0';
            c.fillRect(0, 0, w, h);
            c.strokeStyle = '#141018';
            c.lineWidth = 8;
            c.strokeRect(4, 4, w - 8, h - 8);
            c.fillStyle = '#141018';
            c.font = 'bold 80px sans-serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(String(n), w / 2, h / 2 + 4);
          }, 128, 128),
          side: THREE.DoubleSide,
        }),
      );
    plan.forEach(({ kind, z, at }, i) => {
      const o: Obstacle = { x: at, z, kind, done: false, prog: 0 };
      const x0 = at;
      if (kind === 'valla' || kind === 'doble') {
        for (const dx of kind === 'doble' ? [0, LEN.doble] : [0]) {
          for (const dz of [-0.7, 0.7]) {
            m.add(G.box, 0xf2f2ee, x0 + dx, 0.45, z + dz, 0, 0, 0, 0.07, 0.9, 0.07);
            m.add(G.box, 0xf2f2ee, x0 + dx, 0.03, z + dz, 0, 0, 0, 0.5, 0.06, 0.1);
          }
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 10).rotateX(Math.PI / 2), toon({ color: i % 2 ? 0x2f6fd0 : 0xd7263d }));
          bar.position.set(x0 + dx, kind === 'doble' ? 0.5 : 0.55, z);
          bar.castShadow = true;
          sc.add(bar);
          if (!dx) o.bar = bar;
        }
      } else if (kind === 'rueda') {
        for (const dz of [-0.8, 0.8]) m.add(G.box, 0x2f6fd0, x0, 0.65, z + dz, 0, 0, 0, 0.07, 1.3, 0.07);
        m.add(G.box, 0x2f6fd0, x0, 1.3, z, 0, 0, 0, 0.07, 0.07, 1.67);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 12, 28).rotateY(Math.PI / 2), toon({ color: 0xf2c94c }));
        ring.position.set(x0, 0.72, z);
        ring.castShadow = true;
        sc.add(ring);
      } else if (kind === 'tunel') {
        const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 2.4, 20, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), toon({ color: 0x1b8a6a, side: THREE.DoubleSide }));
        tunnel.position.set(x0 + 1.2, 0.02, z);
        tunnel.castShadow = true;
        sc.add(tunnel);
        for (const dx of [0, 2.4]) m.add(new THREE.TorusGeometry(0.47, 0.04, 6, 20, Math.PI).rotateY(Math.PI / 2), 0x14684f, x0 + dx, 0.02, z, 0, 0, 0, 1, 1, 1);
      } else if (kind === 'slalom') {
        for (let k = 0; k < 6; k++) m.add(G.cyl, k % 2 ? 0xf2f2ee : 0xd7263d, x0 + k * 1.1, 0.5, z, 0, 0, 0, 0.05, 1.0, 0.05);
      } else if (kind === 'pasarela') {
        // Rampa de subida, tabla arriba y rampa de bajada (con sus zonas de contacto amarillas)
        m.add(G.box, 0xd9a35a, x0 + 1, 0.3, z, 0, 0, 0.55, 2.2, 0.06, 0.32);
        m.add(G.box, 0xd9a35a, x0 + 3, 0.62, z, 0, 0, 0, 2.0, 0.06, 0.32);
        m.add(G.box, 0xd9a35a, x0 + 5, 0.3, z, 0, 0, -0.55, 2.2, 0.06, 0.32);
        for (const dx of [0.35, 5.65]) m.add(G.box, 0xf2c94c, x0 + dx, dx < 1 ? 0.12 : 0.12, z, 0, 0, dx < 1 ? 0.55 : -0.55, 0.7, 0.07, 0.33);
        for (const dx of [2.1, 3.9]) m.add(G.box, 0x8a6a44, x0 + dx, 0.3, z, 0, 0, 0, 0.06, 0.6, 0.06);
      } else {
        // La mesa: Joy tiene que quedarse quieta encima un momento
        m.add(G.box, 0x2f6fd0, x0 + 0.6, 0.35, z, 0, 0, 0, 1.0, 0.08, 1.0);
        for (const [dx, dz] of [[0.15, -0.4], [1.05, -0.4], [0.15, 0.4], [1.05, 0.4]]) m.add(G.box, 0x8a8a8a, x0 + dx, 0.17, z + dz, 0, 0, 0, 0.06, 0.34, 0.06);
      }
      // El número del obstáculo, en su banderín
      m.add(G.cyl, 0xf6f1e4, x0 - 0.3, 0.6, z + (z >= 0 ? 1.15 : -1.15), 0, 0, 0, 0.03, 1.2, 0.03);
      const num = NUM(i + 1);
      num.position.set(x0 - 0.3, 1.3, z + (z >= 0 ? 1.15 : -1.15));
      num.rotation.y = -Math.PI / 2;
      sc.add(num);
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
    // (los parterres, solo al principio: más allá están las gradas)
    for (const [x, z] of [[-6, -5], [8, 6]] as const) {
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
    // (en los trucos mandan los botones de las órdenes; en el circuito, 🐕 para saltar)
    this.hud.setIcon('');
    this.show.bind(this.hud);
    this.hud.setObjective('🐕');
    ctx.camera.position.set(4.2, 1.5, 3.6 + TRICK_Z);
    ctx.camera.lookAt(0.5, 0.55, 0.7 + TRICK_Z);
    this.order = Array.from({ length: 6 }, (_, i) => (i + Math.floor(Math.random() * 4)) % T.commands.length);
    missionCard(T.title, T.hint);
    this.nextCmd();
  }

  private updateHud() {
    if (this.phase === 'tricks') {
      this.hud.setCounters(`<span class="chip">🐕 ${this.ok}/${this.order.length}</span>`);
      return;
    }
    const passed = this.obs.filter((o) => o.done).length;
    this.show.score(`<span class="chip">🏁 ${passed}/${this.obs.length}</span>${livesChip('🐕', FAULTS - this.faults, FAULTS)}`);
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
  /** (para que los bocadillos de Azul salgan de su cabeza) */
  get azul() {
    return this.me;
  }

  /** Lo que dicen, en su bocadillo de siempre (pegado a la cabeza, como en los capítulos). */
  private say(text: string, name = 'Gas') {
    bark(name, text);
    return;
    // (como un bocadillo de tebeo: el nombre arriba y la frase, sin comillas)
    this.bubble.innerHTML = '';
    this.bubble.style.display = '';
    const who = document.createElement('b');
    who.textContent = name;
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

  /** Modo prueba: sin trucos, al circuito. */
  skipToCourse() {
    this.cmd = this.order.length;
    this.startCourse();
  }

  private startCourse() {
    this.phase = 'course';
    this.hud.setIcon('🐕');
    this.bar.remove();
    this.hud.setObjective('🏁');
    this.hits = 0;
    this.faults = 0;
    this.jumpT = -1;
    this.stopT = 0;
    this.callAt = -1;
    this.speedV = RUN_V;
    for (const o of this.obs) {
      o.done = false;
      o.prog = 0;
      if (o.bar) o.bar.rotation.x = 0;
    }
    this.joy.root.position.set(START_X, 0, 0);
    this.joy.root.rotation.set(0, Math.PI / 2, 0);
    // Azul corre al lado de Joy por fuera de la pista (en agility, la guía va con el perro)
    this.me.root.position.set(START_X - 0.6, 0, 3.0);
    this.me.root.rotation.y = Math.PI / 2;
    this.gas.root.position.set(START_X - 3, 0, 3.8);
    this.gas.root.rotation.y = Math.PI / 2;
    this.show.intro('Agility', 'Joy & Azul · prueba de grado 1', 'Lleva a Joy con el joystick (arriba, más rápido; abajo, más despacio). 🐕 para saltar vallas y rueda, y en la mesa, para que se quede quieta. Tres faltas y eliminada.', 4.2);
    this.stopT = -4.3; // (quieta en la salida mientras sale el rótulo)
    this.updateHud();
    this.bubble.style.display = 'none';
  }

  /** Una falta en el obstáculo (o un acierto): rótulo, sonido y el público. */
  private judge(o: Obstacle, good: boolean, why: string) {
    o.done = true;
    if (good) {
      this.hits++;
      audio.pickup();
      this.show.call(why, true, 0.8);
      this.cheerT = 1.2;
      if (Math.random() < 0.5) audio.cheer(0.25);
    } else {
      this.faults++;
      audio.boo();
      vibrate(40);
      this.show.call(why, false, 0.9);
      if (o.bar) o.bar.rotation.x = 0.9;
      if (this.faults > FAULTS - 1 + 0.5 && this.phase === 'course') {
        // Eliminada: otra vez desde la salida
        this.phase = 'end';
        this.endT = -99;
        this.show.call('¡ELIMINADA!', false, 1.6);
        window.setTimeout(() => this.startCourse(), 1900);
      }
    }
    this.updateHud();
  }

  private updateCourse(dt: number, pressed: boolean, ax: { x: number; y: number }) {
    const r = this.joy.root;
    // Quieta en la salida (rótulo) o en la mesa
    if (this.stopT < 0) {
      this.stopT += dt;
      if (this.stopT >= 0) {
        this.stopT = 0;
        audio.knock(0.5, 1400, 0.06);
      }
      animatePerson(this.me, dt, 'idle');
      return;
    }
    // Velocidad: arriba, más rápido; abajo, más despacio
    this.speedV += (THREE.MathUtils.clamp(RUN_V + ax.y * 1.6, 3.0, 6.4) - this.speedV) * Math.min(1, dt * 3);
    const onTable = this.obs.find((o) => o.kind === 'mesa' && !o.done && r.position.x > o.x + 0.2 && r.position.x < o.x + 1.1);
    if (pressed && this.jumpT < 0 && !onTable) {
      this.jumpT = 0;
      audio.knock(0.25, 900, 0.04);
    }
    // En la mesa: 🐕 para que se quede quieta (sentada) un momento; si pasa de largo, falta
    if (onTable && pressed && onTable.prog === 0) {
      onTable.prog = 1;
      this.stopT = -1.2;
      r.position.y = 0.42;
      audio.knock(0.4, 700, 0.05);
      this.show.call('¡QUIETA!', true, 0.8);
      window.setTimeout(() => this.phase === 'course' && !onTable.done && this.judge(onTable, true, '¡MESA!'), 1200);
      return;
    }
    r.position.x += this.speedV * dt;
    // Con el joystick, Joy va a un lado u otro de la pista (con la cámara detrás: derecha es +z)
    r.position.z = THREE.MathUtils.clamp(r.position.z + ax.x * 3.4 * dt, -2.0, 2.0);
    r.rotation.y = Math.PI / 2 - ax.x * 0.35;
    if (this.jumpT >= 0) {
      this.jumpT += dt / 0.55;
      r.position.y = Math.sin(Math.min(1, this.jumpT) * Math.PI) * 0.75;
      if (this.jumpT >= 1) {
        this.jumpT = -1;
        r.position.y = 0;
      }
    }
    // Azul, por delante, va cantando el siguiente obstáculo (como en las pruebas de verdad)
    const next = this.obs.find((o) => !o.done);
    if (next && next !== this.obs[this.callAt] && next.x - r.position.x < 7) {
      this.callAt = this.obs.indexOf(next);
      bark('Azul', ({ valla: '¡Hop!', doble: '¡Hop, hop!', rueda: '¡Rueda!', tunel: '¡Túnel!', slalom: '¡Slalom!', pasarela: '¡Arriba!', mesa: '¡Mesa!' } as Record<Kind, string>)[next.kind]);
    }
    for (const o of this.obs) {
      if (o.done) continue;
      const lined = (tol: number) => Math.abs(r.position.z - o.z) < tol;
      const air = r.position.y > 0.28;
      switch (o.kind) {
        case 'valla':
        case 'rueda':
          if (r.position.x >= o.x) {
            if (!lined(o.kind === 'rueda' ? 0.4 : 0.6)) this.judge(o, false, '¡SE LO SALTA!');
            else if (!air) this.judge(o, false, '¡DERRIBO!');
            else {
              this.judge(o, true, o.kind === 'rueda' ? '¡POR EL ARO!' : '¡LIMPIO!');
              this.slow = 0.45;
            }
          }
          break;
        case 'doble':
          // Dos barras seguidas: hay que ir por el aire en las dos (saltar algo antes)
          if (r.position.x >= o.x && o.prog === 0) {
            if (!lined(0.6) || !air) return void this.judge(o, false, !lined(0.6) ? '¡SE LO SALTA!' : '¡DERRIBO!');
            o.prog = 1;
          }
          if (o.prog === 1 && r.position.x >= o.x + LEN.doble) {
            if (!air) this.judge(o, false, '¡DERRIBO!');
            else {
              this.judge(o, true, '¡DOBLE!');
              this.slow = 0.45;
            }
          }
          break;
        case 'tunel':
          if (r.position.x >= o.x && o.prog === 0) {
            if (!lined(0.5) || air) return void this.judge(o, false, air ? '¡POR ENCIMA!' : '¡SE LO SALTA!');
            o.prog = 1;
          }
          if (o.prog === 1 && r.position.x >= o.x + LEN.tunel) this.judge(o, true, '¡TÚNEL!');
          break;
        case 'slalom': {
          // Seis palos: entre ellos, en zigzag (el primero por la derecha, el siguiente por la izquierda…)
          if (r.position.x < o.x - 0.3) break;
          if (!lined(1.2) && o.prog === 0) return void this.judge(o, false, '¡SE LO SALTA!');
          const k = Math.floor((r.position.x - o.x + 0.55) / 1.1);
          if (k >= 1 && k <= 6 && k > o.prog) {
            const side = (r.position.z - o.z) * (k % 2 ? 1 : -1);
            if (side < 0.12) return void this.judge(o, false, '¡FALLA EL SLALOM!');
            o.prog = k;
            audio.knock(0.2, 1100 + k * 80, 0.03);
          }
          if (o.prog >= 6) this.judge(o, true, '¡SLALOM!');
          break;
        }
        case 'pasarela':
          // Por la tabla (estrecha): centrada todo el rato
          if (r.position.x >= o.x && r.position.x <= o.x + LEN.pasarela) {
            if (!lined(0.28)) return void this.judge(o, false, o.prog === 0 ? '¡SE LO SALTA!' : '¡SE CAE!');
            o.prog = 1;
            const u = (r.position.x - o.x) / LEN.pasarela;
            r.position.y = Math.max(r.position.y, u < 0.33 ? u * 3 * 0.62 : u > 0.67 ? (1 - u) * 3 * 0.62 : 0.62);
          }
          if (r.position.x > o.x + LEN.pasarela) this.judge(o, true, '¡PASARELA!');
          break;
        case 'mesa':
          if (r.position.x >= o.x + 1.15 && o.prog === 0) this.judge(o, false, !lined(0.6) ? '¡SE LO SALTA!' : '¡SIN PARAR!');
          break;
      }
    }
    // En el túnel, por dentro (agachada)
    const inTunnel = this.obs.some((o) => o.kind === 'tunel' && r.position.x > o.x && r.position.x < o.x + LEN.tunel && Math.abs(r.position.z - o.z) < 0.5);
    r.scale.y = inTunnel && r.position.y < 0.1 ? 0.8 : 1;
    if (this.jumpT < 0 && !this.obs.some((o) => o.kind === 'pasarela' && r.position.x >= o.x && r.position.x <= o.x + LEN.pasarela)) r.position.y = Math.max(0, r.position.y - dt * 3);
    // Azul, corriendo a su lado por fuera de la pista
    const mp = this.me.root.position;
    mp.x += (r.position.x - 0.5 - mp.x) * Math.min(1, dt * 6);
    mp.z += (Math.max(2.9, r.position.z + 1.4) - mp.z) * Math.min(1, dt * 4);
    animatePerson(this.me, dt, 'walk', 1.4);
    this.me.root.rotation.y = Math.PI / 2;
    if (r.position.x > this.courseEnd && this.phase === 'course') {
      this.phase = 'end';
      this.endT = 0;
      this.show.win(this.faults === 0 ? '¡RECORRIDO LIMPIO!' : '¡CLASIFICADAS!');
    }
  }

  update(dtRaw: number) {
    // (cámara lenta en los saltos limpios)
    this.slow += (1 - this.slow) * Math.min(1, dtRaw * 2.5);
    const dt = dtRaw * this.slow;
    this.t += dt;
    this.cheerT -= dt;
    this.crowd.forEach((p, i) => animatePerson(p, dt, this.cheerT > 0 || this.phase === 'end' ? 'cheer' : i % 3 ? 'idle' : 'talk', 0, this.t * 2 + i));
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
        if (this.endT > 3.6) {
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
    this.show.dispose();
    this.hud.remove();
    this.bar.remove();
    this.bubble.remove();
    disposeScene(this.scene);
  }
}

/** Octubre: adiestrar a Joy y el circuito de agility. */
export function parkMission(onDone: () => void, course = false) {
  stage.start((ctx) => {
    const m = new ParkMission(ctx, onDone);
    // (modo prueba: directo al circuito de agility)
    if (course) m.skipToCourse();
    return m;
  }, false);
}
