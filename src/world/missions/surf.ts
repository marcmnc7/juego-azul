import * as THREE from 'three';
import { audio } from '../../core/audio';
import { Sky, Sun, toon, makeSea, vibrate } from '../../core/gfx';
import { Surf } from '../../core/surfaces';
import { stage, type Mission, type MissionCtx } from '../../core/stage';
import { MARGAUX_LOOK, MARC_LOOK, castLook } from '../../data/characters';
import { G, Merger, makePerson, animatePerson, type Person } from '../../entities/models';
import { Particles } from '../../entities/fx';
import { hud, livesChip, type Hud } from '../../ui/ui';
import { disposeScene } from '../level';
import { Show } from './show';

// Lo que nos gusta · y lo que viene: surf (4.4.6). Azul, tumbada en su tabla mar adentro; Gas, sentado en la suya a su
// lado. Llega una serie: cuando la ola se acerca hay que remar (tocar 🏄 seguido) hasta ir a su velocidad; cuando la
// ola levanta la tabla, ponerse de pie (otra vez 🏄, a tiempo: pronto, se clava; tarde, se va la ola). De pie, con el
// joystick, por la pared de la ola: delante de la parte que rompe (el «bolsillo»), sin dejar que te pille la espuma y
// sin irte tan lejos que la ola se muera. Tres olas buenas; tres revolcones y otra vez. Retransmitido.

const NEED = 3;
const LIVES = 3;
/** La ola: dónde rompe (x de la espuma) y lo rápido que «abre» hacia la derecha. */
const PEEL_V = 4.2;
const WAVE_H = 3.0;
/** Lo que hay que aguantar de pie en una ola para que cuente. */
const RIDE_NEED = 7;

/** La malla de la ola: columnas a lo largo (cada ~0,7 m) y puntos de su perfil. */
const NX = 112;
const NP = 26;
const SPAN = 80;
const UP = new THREE.Vector3(0, 1, 0);
const C_DEEP = new THREE.Color(0x0f5486);
const C_MID = new THREE.Color(0x2386c2);
const C_TURQ = new THREE.Color(0x4fd0cf);
const C_SEA = new THREE.Color(0x1f7fb8);
const C_WHITE = new THREE.Color(0xf4fbff);
const _c = new THREE.Color();

type State = 'intro' | 'wait' | 'paddle' | 'pop' | 'ride' | 'down';

class SurfMission implements Mission {
  readonly scene = new THREE.Scene();
  private hud: Hud;
  private show = new Show('Lo que nos gusta · y lo que viene');
  private me: Person;
  private gas: Person;
  private board: THREE.Mesh;
  private gasBoard: THREE.Mesh;
  private wave: THREE.Mesh;
  private wpos: Float32Array;
  private wcol: Float32Array;
  /** Ya ha roto (de pie): hay espuma a la izquierda de curlX y el labio se tira justo delante. */
  private broken = false;
  private faceY = 0;
  private _n = new THREE.Vector3();
  private _no = new THREE.Vector3();
  private _q = new THREE.Quaternion();
  private _q2 = new THREE.Quaternion();
  private fx: Particles;
  private sky: Sky;
  private sun: Sun;
  private state: State = 'intro';
  private stT = 0;
  private t = 0;
  private good = 0;
  private lost = 0;
  private waveZ = -60;
  private waveH = 0;
  private curlX = -30;
  private paddleV = 0;
  private stroke = 0;
  private x = 0;
  private vx = 0;
  private rideT = 0;
  private tubeT = 0;
  private slow = 1;
  /** (4.4.11) De pie: la altura en la pared (0 abajo, 1 en el labio), el aéreo y los que hay en la ola. */
  private h = 0.5;
  private air = 0;
  private tricks = 0;
  private obs: { x: number; h: number; mesh: THREE.Object3D; passed: boolean }[] = [];
  private camAt = new THREE.Vector3();
  private look = new THREE.Vector3();
  /** (para que los bocadillos de Azul salgan de su cabeza) */
  get azul() {
    return this.me;
  }
  private onTap = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, .pause, .ap-sheet')) return;
    // (remar y ponerse de pie: tocando en cualquier sitio; de pie, la pantalla es del joystick)
    if (this.state === 'ride' && e.clientX < window.innerWidth * 0.45) return; // (de pie, a la izquierda va el joystick)
    if (this.state !== 'paddle' && this.state !== 'pop' && this.state !== 'ride') return;
    this.press();
  };

  constructor(private ctx: MissionCtx, private onDone: () => void) {
    const sc = this.scene;
    const sunDir = new THREE.Vector3(0.4, 0.55, 0.7).normalize();
    sc.fog = new THREE.Fog(0xcfe4f2, 70, 260);
    this.sky = new Sky({ top: 0x2a6fd0, mid: 0x86c6f2, bottom: 0xf6e8cf, sun: { color: 0xfff1d6, dir: sunDir, size: 80 }, clouds: { count: 7, tint: 0xffffff } });
    sc.add(this.sky.group);
    sc.userData.hemiScale = 0.35;
    sc.add(new THREE.HemisphereLight(0xeaf2ff, 0x3a6a8a, 1.0));
    this.sun = new Sun(sc, 0xfff1dc, 3.2, sunDir, 26);
    const sea = makeSea([600, 600], 0x1f7fb8, sunDir);
    sea.position.set(0, -0.05, 60);
    sc.add(sea);
    // La playa al fondo (hacia donde van las olas), con sus casitas blancas y unas lomas
    const m = new Merger();
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(400, 60).rotateX(-Math.PI / 2), toon({ color: 0xe6cf9c, surf: Surf.Sand }));
    sand.position.set(0, 0.25, 110);
    sand.userData.noCast = true;
    sc.add(sand);
    for (let i = 0; i < 26; i++) {
      const x = -120 + i * 9.5 + Math.sin(i * 2.3) * 3;
      m.add(G.box, 0xf6f1e4, x, 2.2, 132 + (i % 3) * 3, 0, 0, 0, 5 + (i % 2) * 2, 4 + (i % 4), 5);
      m.add(G.box, i % 3 ? 0xd9a35a : 0x2f7fc4, x, 4.5 + (i % 4) * 0.5, 132 + (i % 3) * 3, 0, 0, 0, 5.4 + (i % 2) * 2, 0.4, 5.4);
    }
    for (let i = 0; i < 8; i++) m.add(G.bush, 0x5f8a46, -150 + i * 45, 6, 160, 0, i, 0, 40, 16, 20);
    sc.add(m.mesh());
    // La ola (4.4.11): una malla viva, columna a columna a lo largo de la ola. Cada columna es su perfil: la espalda,
    // la cresta, el labio (que delante de donde rompe se tira hacia delante y hace el tubo) y la pared cóncava hasta
    // el seno. Va bajando hacia el hombro y, a la izquierda de donde rompe, ya es espuma blanca.
    const wg = new THREE.BufferGeometry();
    this.wpos = new Float32Array(NX * NP * 3);
    this.wcol = new Float32Array(NX * NP * 3);
    wg.setAttribute('position', new THREE.BufferAttribute(this.wpos, 3).setUsage(THREE.DynamicDrawUsage));
    wg.setAttribute('color', new THREE.BufferAttribute(this.wcol, 3).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < NX - 1; i++)
      for (let k = 0; k < NP - 1; k++) {
        const a = i * NP + k, b2 = (i + 1) * NP + k;
        idx.push(a, b2, a + 1, b2, b2 + 1, a + 1);
      }
    wg.setIndex(idx);
    this.wave = new THREE.Mesh(wg, toon({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55 }));
    this.wave.frustumCulled = false;
    this.wave.userData.noCast = true;
    sc.add(this.wave);
    // Los que también cogen la ola (bodyboards con su surfista): hay que esquivarlos subiendo o bajando
    for (let i = 0; i < 3; i++) {
      const g = new Merger();
      g.add(G.box, [0xe0533a, 0x2f6fd0, 0x3fa27a][i], 0, 0.05, 0, 0, 0, 0, 1.1, 0.08, 0.5);
      g.add(G.sphere, 0x2b1d14, 0.2, 0.32, 0, 0, 0, 0, 0.26, 0.26, 0.26);
      g.add(G.box, [0x222222, 0xd7263d, 0x1f4fa8][i], -0.15, 0.2, 0, 0, 0, 0, 0.6, 0.22, 0.32);
      const mesh = g.mesh();
      mesh.visible = false;
      sc.add(mesh);
      this.obs.push({ x: 0, h: 0.5, mesh, passed: false });
    }
    // Las tablas y ellos dos (con el bañador del capítulo de la playa)
    const boardGeo = new THREE.CapsuleGeometry(0.25, 1.45, 6, 14).rotateX(Math.PI / 2);
    boardGeo.scale(1, 0.16, 1);
    this.board = new THREE.Mesh(boardGeo, toon({ color: 0xf2c94c }));
    this.gasBoard = new THREE.Mesh(boardGeo, toon({ color: 0xe0533a }));
    sc.add(this.board, this.gasBoard);
    this.me = makePerson(castLook({ ...MARGAUX_LOOK, shorts: true }, 'azul_playa'));
    this.gas = makePerson(castLook({ ...MARC_LOOK, shorts: true }, 'gas_playa'));
    sc.add(this.me.root, this.gas.root);
    this.fx = new Particles(sc);

    this.hud = hud(() => this.press(), () => {}, '', true);
    this.hud.setIcon('🏄');
    this.show.bind(this.hud);
    this.hud.setObjective(`🌊 ${NEED} olas`);
    window.addEventListener('pointerdown', this.onTap);
    this.paint();
    ctx.camera.position.set(6, 2.8, 5);
    this.camAt.copy(ctx.camera.position);
    this.show.intro('Surf', 'Azul & Gas · mar adentro', 'Rema (🏄 seguido) cuando llegue la ola y 🏄 para ponerte de pie. De pie: joystick arriba/abajo por la pared y a los lados para ir más o menos rápido; esquiva a los demás y, arriba del todo, 🏄 para un aéreo. Tres olas buenas.', 4.2);
  }

  /** La altura de la ola en x: baja hacia el hombro; donde ya ha roto, se hunde en espuma. */
  private hAt(x: number) {
    if (!this.broken) return this.waveH * (0.9 + 0.1 * Math.cos(x * 0.06));
    const d = x - this.curlX;
    return this.waveH * (d < 0 ? 0.42 + 0.58 * Math.exp(d / 2.5) : 1 - 0.6 * THREE.MathUtils.smoothstep(d, 7, 36));
  }
  /** Cuánto se tira el labio (1: el tubo, justo delante de donde rompe). */
  private pitchAt(x: number) {
    if (!this.broken) return 0;
    const d = x - this.curlX;
    return d < 0 ? THREE.MathUtils.clamp(1 + d / 3, 0, 1) : Math.exp(-((d / 2.4) ** 2));
  }
  /** La pared: z (desde la cresta) a la altura y; cóncava, vertical arriba y tendida abajo. */
  private zFace(y: number, H: number) {
    const zt = 0.4 + 1.5 * H;
    const f = H > 0.01 ? 1 - THREE.MathUtils.clamp(y / H, 0, 1) : 1;
    return 0.25 + (zt - 0.25) * f ** 1.8;
  }
  /** Lo contrario: la altura de la pared a dz (desde la cresta) por delante; 0 si aún no llega. */
  private yOnFace(dz: number, H: number) {
    const zt = 0.4 + 1.5 * H;
    if (dz >= zt || H < 0.05) return 0;
    const f = THREE.MathUtils.clamp((dz - 0.25) / (zt - 0.25), 0, 1);
    return H * (1 - f ** (1 / 1.8));
  }
  /** La normal de la pared a la altura y (hacia fuera: la playa y arriba). */
  private faceNormal(y: number, H: number, out: THREE.Vector3) {
    const dy = Math.max(0.02, 0.06 * H);
    const z1 = this.zFace(y, H), z2 = this.zFace(Math.max(0, y - dy), H);
    return out.set(0, Math.max(0.001, z2 - z1), dy).normalize();
  }
  /** Rehace la ola alrededor de x (lo que ve la cámara). */
  private buildWave(cx: number) {
    const pos = this.wpos, col = this.wcol;
    const x0 = cx - SPAN / 2;
    let v = 0;
    const put = (x: number, y: number, z: number, c: THREE.Color) => {
      pos[v] = x;
      pos[v + 1] = y;
      pos[v + 2] = z;
      col[v] = c.r;
      col[v + 1] = c.g;
      col[v + 2] = c.b;
      v += 3;
    };
    for (let i = 0; i < NX; i++) {
      const x = x0 + (i / (NX - 1)) * SPAN;
      const H = this.hAt(x);
      const p = this.pitchAt(x);
      const d = x - this.curlX;
      // (la espuma de lo ya roto, con su grumo; y el blanco de la cresta que se tira)
      const ww = this.broken ? THREE.MathUtils.clamp(0.25 - d / 1.4, 0, 1) : 0;
      const grain = 0.9 + 0.1 * Math.sin(x * 3.3 + this.t * 6) * Math.sin(x * 1.7 - this.t * 3);
      const zt = 0.4 + 1.5 * H;
      for (let k = 0; k < 8; k++) {
        const s = k / 7;
        _c.copy(C_DEEP).lerp(C_MID, s).lerp(C_WHITE, ww * grain);
        put(x, H * s * s * (3 - 2 * s), -7 + 7 * s, _c);
      }
      for (let k = 0; k < 4; k++) {
        const t = (k + 1) / 4;
        _c.copy(C_TURQ).lerp(C_WHITE, Math.min(1, 0.4 + 0.6 * p + ww) * grain);
        put(x, H + Math.sin(t * Math.PI) * 0.1 * H - p * t * t * 0.62 * H, 0.15 * t + p * t * 0.95 * H, _c);
      }
      for (let k = 0; k < 12; k++) {
        const s = k / 11;
        const y = H * (1 - s);
        _c.copy(C_TURQ).lerp(C_DEEP, s ** 0.6).lerp(C_WHITE, Math.max(ww * grain, k === 0 ? 0.35 : 0));
        put(x, y, this.zFace(y, H), _c);
      }
      _c.copy(C_DEEP).lerp(C_SEA, 0.5).lerp(C_WHITE, ww * 0.6 * grain);
      put(x, 0, zt + 3, _c);
      put(x, -0.02, zt + 10, C_SEA);
    }
    const g = this.wave.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.computeVertexNormals();
  }

  private paint() {
    this.show.score(`<span class="chip">🌊 ${this.good}/${NEED}</span>${livesChip('🏄', LIVES - this.lost, LIVES)}`);
  }

  /** El botón 🏄: remar (mientras viene la ola), ponerse de pie (cuando levanta la tabla). */
  private press() {
    if (this.state === 'paddle') {
      this.paddleV = Math.min(1.25, this.paddleV + 0.22);
      this.stroke = 1;
      audio.knock(0.15, 500, 0.04);
      this.fx.burst(this.board.position.clone().setY(0.1), 'spray', 2, 0.5, 0.3);
    } else if (this.state === 'ride') {
      // Arriba, en el labio: un aéreo (salta por encima de la cresta, gira y vuelve a la pared)
      if (this.h > 0.78 && this.air <= 0) {
        this.air = 1.0;
        this.tricks++;
        this.slow = 0.45;
        audio.whoosh();
        vibrate(20);
        this.fx.burst(this.board.position.clone().setY(this.board.position.y + 0.3), 'spray', 12, 1.2, 1.4);
        this.show.call(this.tricks === 1 ? '¡AÉREO!' : '¡OTRO AÉREO!', true, 0.9);
      }
    } else if (this.state === 'pop') {
      // De pie: en su momento (con la tabla ya cayendo por la pared, ni antes ni cuando ya ha pasado)
      const k = this.stT;
      if (k < 0.22) this.wipe('¡SE CLAVA!');
      else if (k > 1.25) this.wipe('¡SE VA LA OLA!');
      else {
        this.state = 'ride';
        this.stT = 0;
        this.rideT = this.tubeT = this.tricks = 0;
        this.vx = PEEL_V;
        // (la ola rompe a unos metros a su izquierda: empieza en el bolsillo)
        this.curlX = this.x - 4.5;
        this.broken = true;
        this.h = 0.45;
        this.air = 0;
        this.obs.forEach((o, i) => {
          o.x = this.x + 18 + i * 17 + Math.random() * 4;
          o.h = 0.2 + Math.random() * 0.55;
          o.passed = false;
          o.mesh.visible = true;
        });
        this.slow = 0.35;
        audio.whoosh();
        vibrate(25);
        this.show.call(k < 0.8 ? '¡DE PIE!' : '¡JUSTO!', true, 0.8);
      }
    }
  }

  /** Revolcón: pierde la ola y una vida. */
  private wipe(why: string) {
    this.state = 'down';
    this.stT = 0;
    this.lost++;
    audio.boo();
    vibrate([40, 30, 60]);
    this.fx.burst(this.board.position.clone().setY(0.6), 'spray', 18, 1.6, 1.4);
    this.show.call(why, false, 1.1);
    this.paint();
  }

  private nextWave() {
    if (this.lost >= LIVES) {
      this.show.call('¡OTRA SERIE!', false, 1.6);
      this.good = this.lost = 0;
      this.paint();
    }
    this.state = 'wait';
    this.stT = 0;
    this.waveZ = -52;
    this.waveH = 0.2;
    this.curlX = -26;
    this.paddleV = 0;
    this.x = 0;
    this.broken = false;
    this.faceY = 0;
  }

  update(dtRaw: number) {
    this.slow += (1 - this.slow) * Math.min(1, dtRaw * 2.2);
    const dt = dtRaw * this.slow;
    this.t += dt;
    this.stT += dt;
    this.fx.update(dt);
    const input = this.ctx.input;
    if (input.consumeAction()) this.press();
    const ax = input.axes();
    const me = this.me, gas = this.gas, b = this.board;
    // Gas, sentado en su tabla, mecido por el mar (y celebrando las buenas)
    const bob = Math.sin(this.t * 1.4) * 0.08;
    this.gasBoard.position.set(-3.5, 0.05 + bob, 2);
    this.gasBoard.rotation.set(Math.sin(this.t * 1.1) * 0.05, 0.3, 0);
    // (tumbado en su tabla, como ella, esperando su ola; levanta un brazo cuando ella surfea)
    gas.root.position.set(-3.5, 0.17 + bob, 1.8);
    gas.root.rotation.set(Math.PI / 2 - 0.08, 0.3, 0);
    animatePerson(gas, dt, 'idle');
    const cheer = this.state === 'ride' && this.rideT > 2;
    gas.armL.rotation.set(-2.4 + Math.sin(this.t * 1.3) * 0.25, 0, 0.2);
    gas.armR.rotation.set(cheer ? -3.0 + Math.sin(this.t * 9) * 0.3 : -2.4 + Math.sin(this.t * 1.3 + 1) * 0.25, 0, -0.2);
    // La ola: avanza, crece al acercarse y rompe abriendo hacia la derecha
    let lift = 0;
    switch (this.state) {
      case 'intro':
        if (this.stT > 4.3) this.nextWave();
        break;
      case 'wait':
        this.waveZ += dt * 6;
        this.waveH = THREE.MathUtils.lerp(0.2, WAVE_H * 0.6, THREE.MathUtils.smoothstep(this.waveZ, -52, -18));
        if (this.waveZ > -22) {
          this.state = 'paddle';
          this.stT = 0;
          // (Gas avisa: es lo que diría él en el agua)
          this.show.call('¡REMA, REMA!', true, 0.9);
        }
        break;
      case 'paddle': {
        this.waveZ += dt * 7.5;
        this.waveH = THREE.MathUtils.lerp(WAVE_H * 0.6, WAVE_H, THREE.MathUtils.smoothstep(this.waveZ, -22, -1));
        this.paddleV = Math.max(0, this.paddleV - dt * 0.4);
        b.position.z += this.paddleV * 4.2 * dt;
        // Llega la ola: si va a su ritmo, la coge; si no, le pasa por debajo
        // (la pared ya la levanta: sube por ella mientras rema)
        this.faceY = this.yOnFace(b.position.z - this.waveZ, this.hAt(b.position.x));
        if (this.faceY > 0.2 * this.waveH) {
          if (this.paddleV >= 0.6) {
            this.state = 'pop';
            this.stT = 0;
            audio.chime(2);
          } else this.wipe('¡SE TE ESCAPA!');
        }
        break;
      }
      case 'pop':
        this.waveZ += dt * 7.5;
        lift = Math.min(1, this.stT * 2);
        {
          const H = this.hAt(b.position.x), y = (0.2 + 0.3 * lift) * H;
          b.position.y = y + 0.1;
          b.position.z = this.waveZ + this.zFace(y, H) + 0.15;
        }
        if (this.stT > 1.5) this.wipe('¡SE VA LA OLA!');
        break;
      case 'ride': {
        this.rideT += dt;
        // (de pie, la ola avanza despacio: se queda mar adentro, con la playa lejos)
        this.waveZ += dt * 1.2;
        // La ola no rompe siempre igual de rápido: tramos que corren y tramos que se paran
        const peel = PEEL_V * (1 + 0.45 * Math.sin(this.rideT * 0.8 + 0.6) + 0.2 * Math.sin(this.rideT * 2.1));
        this.curlX += peel * dt;
        // Joystick: arriba/abajo, subir o bajar por la pared; derecha/izquierda, acelerar o frenar. Bajando se coge
        // velocidad; subiendo se pierde (como de verdad)
        if (this.air <= 0) this.h = THREE.MathUtils.clamp(this.h + ax.y * 1.5 * dt, 0.05, 0.95);
        const want = PEEL_V + (0.55 - this.h) * 3.4 + ax.x * 3.2;
        this.vx += (want - this.vx) * Math.min(1, dt * 2.6);
        this.x += this.vx * dt;
        const dir = 1;
        const gap = this.x - this.curlX;
        if (this.air > 0) {
          this.air -= dt;
          if (this.air <= 0) {
            this.h = 0.7;
            this.fx.burst(b.position.clone(), 'spray', 10, 1.0, 0.8);
            audio.knock(0.25, 400, 0.05);
          }
        }
        // Los bodyboards: chocar con uno (a su altura y sin ir por el aire) es revolcón; pasarlo, bien
        for (const o of this.obs) {
          if (!o.mesh.visible) continue;
          o.x += PEEL_V * 0.55 * dt;
          if (!o.passed && Math.abs(this.x - o.x) < 0.9 && Math.abs(this.h - o.h) < 0.17 && this.air <= 0) {
            o.mesh.visible = false;
            this.wipe('¡CHOQUE!');
            break;
          }
          if (!o.passed && this.x > o.x + 1) {
            o.passed = true;
            audio.chime(1);
          }
        }
        if (this.state !== 'ride') break;
        // Pillada por la espuma: revolcón; muy por delante: la ola se muere; aguantando, ola buena
        if (gap < 0.35) this.wipe('¡REVOLCÓN!');
        else if (gap < 2.2) {
          this.tubeT += dt;
          if (this.tubeT > 1.2 && this.tubeT - dt <= 1.2) this.show.call('¡AL TUBO!', true, 1.0);
        } else if (gap > 14) {
          this.state = 'down';
          this.stT = 0;
          if (this.rideT >= RIDE_NEED) this.goodWave();
          else this.wipe('¡SE MUERE LA OLA!');
        }
        if (this.state === 'ride' && this.rideT >= RIDE_NEED + 5) {
          this.state = 'down';
          this.stT = 0;
          this.goodWave();
        }
        // En la pared: abajo, cerca del agua y delante; arriba, junto al labio (en el aéreo, por encima)
        {
          const H = this.hAt(this.x), fy = this.h * H * 0.92;
          this.faceNormal(fy, H, this._n);
          const up = this.air > 0 ? Math.sin((1 - this.air) * Math.PI) * 1.6 : 0;
          b.position.set(this.x, fy + up, this.waveZ + this.zFace(fy, H)).addScaledVector(this._n, 0.1);
        }
        lift = 1;
        if (Math.random() < dt * 10) this.fx.burst(b.position.clone().setX(this.x - 0.7 * dir), 'spray', 1, 0.5, 0.4);
        break;
      }
      case 'down':
        this.waveZ += dt * 6;
        this.waveH = Math.max(0, this.waveH - dt * 0.8);
        if (this.stT > 2.2) {
          if (this.good >= NEED) return this.win();
          b.position.set(0, 0, 0);
          this.nextWave();
        }
        break;
    }
    const ride = this.state === 'ride';
    // La ola (alrededor de lo que se ve) y la espuma que salta donde rompe
    this.buildWave(ride ? this.x + 4 : b.position.x);
    this.wave.position.set(0, 0, this.waveZ);
    if (this.broken && this.waveH > 0.5 && Math.random() < dt * 16) {
      const H = this.hAt(this.curlX);
      this.fx.burst(new THREE.Vector3(this.curlX + Math.random() * 1.5, H * 0.8, this.waveZ + this.zFace(H * 0.5, H)), 'spray', 2, 1.4, 1.6);
    }
    for (const o of this.obs) {
      if (!o.mesh.visible) continue;
      if (this.state !== 'ride') {
        o.mesh.visible = false;
        continue;
      }
      const H = this.hAt(o.x), y = o.h * H * 0.92;
      this.faceNormal(y, H, this._no);
      o.mesh.position.set(o.x, y, this.waveZ + this.zFace(y, H)).addScaledVector(this._no, 0.08);
      o.mesh.quaternion.setFromUnitVectors(UP, this._no);
    }
    // Ella: tumbada remando, o de pie, en postura de surf, inclinada hacia donde va
    const lying = this.state === 'wait' || this.state === 'paddle' || this.state === 'intro' || (this.state === 'pop' && false);
    if (this.state !== 'ride') {
      if (this.state !== 'pop' && this.state !== 'paddle') b.position.set(this.x, 0, b.position.z);
    }
    const by = lift ? Math.sin(Math.min(1, lift) * Math.PI * 0.5) * this.waveH * 0.55 : Math.sin(this.t * 1.6) * 0.06;
    if (!ride && this.state !== 'pop') b.position.y = 0.06 + by + (this.state === 'paddle' ? this.faceY : 0);
    // (de pie, la tabla de lado, a lo largo de la ola, hacia donde va; inclinada hacia la pared)
    const spin = ride && this.air > 0 ? (1 - this.air) * Math.PI * 2 : 0;
    if (ride) {
      // (pegada a la pared: su normal; a lo largo de la ola, hacia donde va)
      this._q.setFromUnitVectors(UP, this._n);
      this._q2.setFromAxisAngle(UP, Math.PI / 2 + spin);
      b.quaternion.copy(this._q).multiply(this._q2);
    } else b.rotation.set(lift ? -0.35 * lift : Math.sin(this.t * 1.2) * 0.04, 0, 0);
    if (lying || this.state === 'pop') {
      // Tumbada boca abajo, remando con los brazos
      me.root.position.set(b.position.x, b.position.y + 0.12, b.position.z - 0.2);
      me.root.rotation.set(Math.PI / 2 - 0.08, 0, 0);
      animatePerson(me, dt, 'idle');
      const ph = this.t * (6 + this.paddleV * 6);
      this.stroke = Math.max(0, this.stroke - dt * 2);
      me.armL.rotation.set(-2.4 + Math.sin(ph) * 1.2 * (this.state === 'paddle' ? 1 : 0.2), 0, 0.2);
      me.armR.rotation.set(-2.4 + Math.sin(ph + Math.PI) * 1.2 * (this.state === 'paddle' ? 1 : 0.2), 0, -0.2);
    } else {
      // De pie, de lado sobre la tabla, rodillas flexionadas y brazos abiertos
      me.root.position.set(b.position.x, b.position.y + 0.08, b.position.z);
      // (de lado sobre la tabla: el pecho hacia la playa, los pies a lo largo de la tabla; medio inclinada con la
      // pared; en el aéreo, gira con ella)
      if (ride) {
        this._q.setFromUnitVectors(UP, this._n);
        this._q2.identity().slerp(this._q, 0.5);
        me.root.quaternion.copy(this._q2).multiply(this._q.setFromAxisAngle(UP, spin));
      } else me.root.rotation.set(0, 0, 0);
      animatePerson(me, dt, this.state === 'down' && this.good >= NEED ? 'cheer' : 'idle');
      if (this.state === 'ride' || (this.state === 'down' && this.good > 0)) {
        me.kneeL.rotation.x = me.kneeR.rotation.x = -0.6;
        me.armL.rotation.set(-0.2, 0, 1.2 + Math.sin(this.t * 3) * 0.1);
        me.armR.rotation.set(-0.2, 0, -1.2 - Math.sin(this.t * 3) * 0.1);
      }
    }
    // Cámara: detrás de ella y algo de lado; en el paseo por la ola, de lado y baja, con la pared detrás
    const cam = this.ctx.camera;
    const tall = cam.aspect < 1;
    // (de lado: se ve la ola llegando por la izquierda; de pie, desde delante de la pared, con la espuma detrás)
    // (de pie: desde la playa y algo por detrás de ella, mirando a lo largo de la ola: lo que viene, delante)
    const Hc = this.hAt(this.x);
    if (ride) this.camAt.set(this.x + (tall ? 5.5 : 7.5), Hc * 0.35 + 0.9, this.waveZ + 0.4 + 1.5 * Hc + (tall ? 4.2 : 5));
    else this.camAt.set(b.position.x + (tall ? 5.5 : 6.5), 2.8, b.position.z + (tall ? 5.5 : 4.5));
    cam.position.lerp(this.camAt, Math.min(1, dtRaw * 2.4));
    this.look.lerp(ride ? new THREE.Vector3(this.x - 1, this.h * Hc * 0.55 + 1.0, this.waveZ + 1.2) : new THREE.Vector3(b.position.x + 0.8, 0.7, b.position.z - 4), Math.min(1, dtRaw * 3));
    cam.lookAt(this.look);
    this.hud.setAction(this.state === 'paddle' ? '🏄 Remar' : this.state === 'pop' ? '🏄 De pie' : null);
    this.sky.update(cam, dtRaw);
    this.sun.follow(b.position);
  }

  private goodWave() {
    this.good++;
    audio.chime(3);
    audio.cheer(0.4);
    this.show.call(this.tricks ? '¡OLA CON AÉREO!' : this.tubeT > 1.2 ? '¡OLA DE TUBO!' : '¡OLA!', true, 1.2);
    this.paint();
  }

  private win() {
    this.state = 'intro';
    this.stT = -99;
    this.show.win('¡SURFERA!');
    window.setTimeout(() => {
      const done = this.onDone;
      stage.end();
      done();
    }, 3600);
  }

  dispose() {
    window.removeEventListener('pointerdown', this.onTap);
    this.show.dispose();
    this.hud.remove();
    disposeScene(this.scene);
  }
}

/** Surf con Gas (misión 3D). */
export function surfMission(onDone: () => void) {
  stage.start((ctx) => new SurfMission(ctx, onDone), true);
}
