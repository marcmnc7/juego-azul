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
const WAVE_H = 2.1;
/** Lo que hay que aguantar de pie en una ola para que cuente. */
const RIDE_NEED = 7;

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
  private foam: THREE.Mesh;
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
  private lastDir = 0;
  private turns = 0;
  private slow = 1;
  private camAt = new THREE.Vector3();
  private look = new THREE.Vector3();
  /** (para que los bocadillos de Azul salgan de su cabeza) */
  get azul() {
    return this.me;
  }
  private onTap = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, .pause, .ap-sheet')) return;
    // (remar y ponerse de pie: tocando en cualquier sitio; de pie, la pantalla es del joystick)
    if (this.state !== 'paddle' && this.state !== 'pop') return;
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
    // La ola: una pared curvada (de perfil, una sola malla larga) que avanza hacia la playa y crece; y la espuma, la
    // parte que ya ha roto, a la izquierda de donde rompe
    const prof = new THREE.Shape();
    prof.moveTo(-4, 0);
    prof.quadraticCurveTo(-1.2, 0.2, -0.2, 0.85);
    prof.quadraticCurveTo(0.35, 1.05, 0.25, 0.75);
    prof.quadraticCurveTo(0.6, 0.35, 2.6, 0);
    prof.lineTo(-4, 0);
    const wg = new THREE.ExtrudeGeometry(prof, { depth: 140, bevelEnabled: false, curveSegments: 10 });
    wg.translate(0, 0, -70);
    wg.rotateY(-Math.PI / 2); // (el perfil, en el plano z-y: la pared mira a la playa, +z; la ola, a lo largo de x)
    this.wave = new THREE.Mesh(wg, toon({ color: 0x2a8fc8, emissive: 0x0a2a44 }));
    this.wave.userData.noCast = true;
    sc.add(this.wave);
    this.foam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1, 14).rotateZ(Math.PI / 2), toon({ color: 0xffffff }));
    sc.add(this.foam);
    // Las tablas y ellos dos (con el bañador del capítulo de la playa)
    const boardGeo = new THREE.CapsuleGeometry(0.28, 1.5, 6, 14).rotateX(Math.PI / 2);
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
    this.show.intro('Surf', 'Azul & Gas · mar adentro', 'Cuando llegue la ola, rema (🏄 seguido) hasta ir a su ritmo; cuando te levante, 🏄 para ponerte de pie. Luego, con el joystick, delante de la espuma sin que te pille. Tres olas buenas.', 4.2);
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
    } else if (this.state === 'pop') {
      // De pie: en su momento (con la tabla ya cayendo por la pared, ni antes ni cuando ya ha pasado)
      const k = this.stT;
      if (k < 0.22) this.wipe('¡SE CLAVA!');
      else if (k > 1.25) this.wipe('¡SE VA LA OLA!');
      else {
        this.state = 'ride';
        this.stT = 0;
        this.rideT = this.tubeT = this.turns = 0;
        this.lastDir = 0;
        this.vx = PEEL_V;
        // (la ola rompe a unos metros a su izquierda: empieza en el bolsillo)
        this.curlX = this.x - 4.5;
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
        if (this.waveZ > b.position.z - 1.2) {
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
        b.position.z = this.waveZ - 1.0;
        lift = Math.min(1, this.stT * 2);
        if (this.stT > 1.5) this.wipe('¡SE VA LA OLA!');
        break;
      case 'ride': {
        this.rideT += dt;
        this.waveZ += dt * 5.5;
        // La ola no rompe siempre igual de rápido: hay tramos que «corren» (hay que ir hacia delante) y tramos que
        // se paran (hay que frenar para no quedarse sin pared)
        const peel = PEEL_V * (1 + 0.55 * Math.sin(this.rideT * 0.8 + 0.6) + 0.25 * Math.sin(this.rideT * 2.1));
        this.curlX += peel * dt;
        // La tabla va sola con la ola (a su velocidad de siempre); el joystick, a la derecha acelera y a la izquierda
        // frena (con su inercia, sin tirones)
        const want = PEEL_V + ax.x * 4.2;
        this.vx += (want - this.vx) * Math.min(1, dt * 3);
        this.x += this.vx * dt;
        const gap = this.x - this.curlX;
        // Cambios de sentido con velocidad: giros (para el estilo)
        const dir = Math.sign(this.vx);
        if (dir && dir !== this.lastDir && Math.abs(this.vx) > 2.5) {
          if (this.lastDir) {
            this.turns++;
            this.fx.burst(b.position.clone().setY(0.6), 'spray', 8, 1.0, 1.0);
            audio.knock(0.2, 900, 0.03);
          }
          this.lastDir = dir;
        }
        // Muy cerca de la espuma: el tubo (bonus); dentro, revolcón; muy lejos, la ola se muere
        if (gap < 0.35) this.wipe('¡REVOLCÓN!');
        else if (gap < 2.4) {
          this.tubeT += dt;
          if (this.tubeT > 1.2 && this.tubeT - dt <= 1.2) this.show.call('¡AL TUBO!', true, 1.0);
        } else if (gap > 13) {
          this.state = 'down';
          this.stT = 0;
          if (this.rideT >= RIDE_NEED) this.goodWave();
          else this.wipe('¡SE MUERE LA OLA!');
        }
        if (this.state === 'ride' && this.rideT >= RIDE_NEED + 3) {
          this.state = 'down';
          this.stT = 0;
          this.goodWave();
        }
        // (en la pared de la ola, por delante de la cresta: a media altura)
        b.position.set(this.x, 0, this.waveZ + 1.2);
        lift = 1;
        if (Math.random() < dt * 8) this.fx.burst(b.position.clone().setY(0.3).setX(this.x - 0.6 * dir), 'spray', 1, 0.5, 0.4);
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
    // La ola y la espuma
    this.wave.position.set(0, 0, this.waveZ);
    this.wave.scale.set(1, this.waveH, 1 + this.waveH * 0.3);
    const foamLen = Math.max(0.1, this.curlX + 70);
    this.foam.visible = this.state === 'ride' || this.state === 'down';
    this.foam.scale.set(foamLen, Math.max(0.2, this.waveH * 0.6), Math.max(0.2, this.waveH * 0.6));
    this.foam.position.set(this.curlX - foamLen / 2, this.waveH * 0.55, this.waveZ - 0.2);
    if (this.foam.visible && Math.random() < dt * 14) this.fx.burst(new THREE.Vector3(this.curlX, this.waveH * 0.8, this.waveZ), 'spray', 2, 1.2, 1.4);
    // Ella: tumbada remando, o de pie, en postura de surf, inclinada hacia donde va
    const ride = this.state === 'ride';
    const lying = this.state === 'wait' || this.state === 'paddle' || this.state === 'intro' || (this.state === 'pop' && false);
    if (this.state !== 'ride') {
      if (this.state !== 'pop' && this.state !== 'paddle') b.position.set(this.x, 0, b.position.z);
    }
    const by = lift ? Math.sin(Math.min(1, lift) * Math.PI * 0.5) * this.waveH * 0.55 : Math.sin(this.t * 1.6) * 0.06;
    b.position.y = 0.06 + by;
    // (de pie, la tabla de lado, a lo largo de la ola, hacia donde va; inclinada hacia la pared)
    b.rotation.set(ride ? 0.35 : lift ? -0.25 * lift : Math.sin(this.t * 1.2) * 0.04, ride ? (this.vx >= 0 ? Math.PI / 2 : -Math.PI / 2) : 0, ride ? -this.vx * 0.03 : 0);
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
      // (de lado sobre la tabla: el pecho hacia la playa, los pies a lo largo de la tabla)
      me.root.rotation.set(0, 0, 0);
      animatePerson(me, dt, this.state === 'down' && this.good >= NEED ? 'cheer' : 'idle');
      if (this.state === 'ride' || (this.state === 'down' && this.good > 0)) {
        me.kneeL.rotation.x = me.kneeR.rotation.x = -0.6;
        me.armL.rotation.set(-0.2, 0, 1.2 + Math.sin(this.t * 3) * 0.1);
        me.armR.rotation.set(-0.2, 0, -1.2 - Math.sin(this.t * 3) * 0.1);
        me.root.rotation.z = -this.vx * 0.03;
      }
    }
    // Cámara: detrás de ella y algo de lado; en el paseo por la ola, de lado y baja, con la pared detrás
    const cam = this.ctx.camera;
    const tall = cam.aspect < 1;
    // (de lado: se ve la ola llegando por la izquierda; de pie, desde delante de la pared, con la espuma detrás)
    if (ride) this.camAt.set(this.x + (tall ? 2.2 : 4.5), 3.3, b.position.z + (tall ? 8.5 : 8));
    else this.camAt.set(b.position.x + (tall ? 5.5 : 6.5), 2.8, b.position.z + (tall ? 5.5 : 4.5));
    cam.position.lerp(this.camAt, Math.min(1, dtRaw * 2.4));
    this.look.lerp(ride ? new THREE.Vector3(this.x - (tall ? 0.6 : 1.2), 1.1 + by * 0.5, b.position.z - 0.5) : new THREE.Vector3(b.position.x + 0.8, 0.7, b.position.z - 4), Math.min(1, dtRaw * 3));
    cam.lookAt(this.look);
    this.hud.setAction(this.state === 'paddle' ? '🏄 Remar' : this.state === 'pop' ? '🏄 De pie' : null);
    this.sky.update(cam, dtRaw);
    this.sun.follow(b.position);
  }

  private goodWave() {
    this.good++;
    audio.chime(3);
    audio.cheer(0.4);
    this.show.call(this.tubeT > 1.2 ? '¡OLA DE TUBO!' : this.turns >= 3 ? '¡CON ESTILO!' : '¡OLA!', true, 1.2);
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
