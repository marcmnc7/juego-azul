import * as THREE from 'three';
import { audio } from '../../core/audio';
import { Sky, Sun, toon, makeSea, vibrate, quality } from '../../core/gfx';
import { Surf } from '../../core/surfaces';
import { beachBallTexture } from '../../core/physics';
import { stage, type Mission, type MissionCtx } from '../../core/stage';
import { MARGAUX_LOOK, MARC_LOOK, castLook } from '../../data/characters';
import { MINIS } from '../../data/story';
import { G, Merger, makePerson, animatePerson, type Person } from '../../entities/models';
import { hud, comicWord, missionCard, type Hud } from '../../ui/ui';
import { canvasTex } from '../deco';
import { disposeScene } from '../level';

// Misión del capítulo 9 (lo que vino después): septiembre, vóley playa «nivel 6» con Gas. Ella a un lado
// de la red y él al otro; la pelota va y viene y hay que darle justo cuando llega. Tres al suelo y se
// acaba (y si aguantáis doce pases, también: nivel 6 de verdad).
// Con la receta del capítulo 1: cielo pintado (mismos azules y horizonte crema), luz de las 11 con el reparto de
// ambiente de Ferreries (hemisférica 1,0 × 0,35 y sol con su tope de tebeo), mar de tebeo y arena dibujada.
// Nada de toast (no se ven en el cómic): los aciertos y fallos, onomatopeyas; el resultado, en la tarjeta.

const ME = new THREE.Vector3(-3.6, 0, 0);
const GAS = new THREE.Vector3(3.6, 0, 0);
const HANDS = 0.95; // altura a la que se le da (antebrazos)
const LAUNCH = 1.9;
/** Puntos que hay que hacer, y a cuántos se juega el partido. */
const NEED = 4;
const GAME = 7;

class BeachMission implements Mission {
  readonly scene = new THREE.Scene();
  private hud: Hud;
  private me: Person;
  private gas: Person;
  private ball: THREE.Mesh;
  private shadow: THREE.Mesh;
  private sky: Sky;
  private sun: Sun;
  private t = 0;
  private flight = 0;
  private dur = 1.35;
  private toMe = true;
  private tapped = false;
  private dropT = -1;
  private hitT = new Map<Person, number>();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private endT = -1;
  private cool = 0;
  private extras: Person[] = [];
  private camAt = new THREE.Vector3();

  constructor(private ctx: MissionCtx, private onDone: () => void) {
    const sc = this.scene;
    const T = MINIS.voley;
    // (sol alto y de lado: la sombra de la pelota se ve en la arena)
    const sunDir = new THREE.Vector3(-0.3, 0.75, 0.6);
    sc.fog = new THREE.Fog(0xcfe0ee, 70, 220);
    this.sky = new Sky({ top: 0x2a6fd0, mid: 0x7fbdf2, bottom: 0xf6ead2, sun: { color: 0xfff4dc, dir: sunDir, size: 70 }, clouds: { count: 9, tint: 0xffffff } });
    sc.add(this.sky.group);
    // El ambiente, repartido como en Ferreries (ver settleAmbient): si no, las sombras salían planas
    sc.userData.hemiScale = 0.35;
    sc.add(new THREE.HemisphereLight(0xeaf2ff, 0x8a7a64, 1.0));
    this.sun = new Sun(sc, 0xfff1dc, 3.4, sunDir, 18);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(120, 60).rotateX(-Math.PI / 2), toon({ color: 0xd2b07a, surf: Surf.Sand }));
    sand.position.z = -14;
    sand.userData.noCast = true;
    sc.add(sand);
    const sea = makeSea([500, 300], 0x1d78a8, sunDir);
    sea.position.set(0, -0.15, 170);
    sc.add(sea);
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(120, 6).rotateX(-Math.PI / 2), toon({ color: 0xcdb888, roughness: 0.4 }));
    wet.position.set(0, 0.005, 18);
    sc.add(wet);
    // Red: postes, cinta blanca de arriba y la malla; líneas de la pista marcadas con cuerda
    const m = new Merger();
    for (const z of [-4.6, 4.6]) {
      m.add(G.cyl, 0xd8d8d2, 0, 1.25, z, 0, 0, 0, 0.1, 2.5, 0.1);
      m.add(G.cyl, 0x9a9a92, 0, 0.02, z, 0, 0, 0, 0.3, 0.04, 0.3);
    }
    m.add(G.box, 0xf6f6f0, 0, 2.38, 0, 0, 0, 0, 0.03, 0.08, 9.2);
    for (const [x, z, w, d] of [[-8, 0, 0.05, 8], [8, 0, 0.05, 8], [0, -4, 16, 0.05], [0, 4, 16, 0.05]] as const) m.add(G.box, 0x2f6fb0, x, 0.012, z, 0, 0, 0, w + 0.03, 0.01, d + 0.03);
    // Sombrilla y toallas a un lado, para que sea una playa y no un plató
    m.add(G.cyl, 0xf2f2ee, -7, 1.2, -7, 0.12, 0, 0, 0.06, 2.6, 0.06);
    m.add(G.cone, 0xe0533a, -7.15, 2.45, -7, 0, 0, 0, 3.0, 0.6, 3.0);
    m.add(G.box, 0x3a8fd8, -5.5, 0.01, -8, 0, 0.3, 0, 0.9, 0.01, 1.8);
    m.add(G.box, 0xf2c94c, -8.6, 0.01, -8.2, 0, -0.2, 0, 0.9, 0.01, 1.8);
    // Detrás de Gas, la playa de septiembre con gente: sombrillas de rayas, toallas, neveras y un chiringuito
    const PARASOLS: [number, number, number, number][] = [
      [10.5, -7.5, 0xe0533a, 0xf6f1e4], [12.5, 6.5, 0x2f7fc4, 0xf6f1e4], [16, -3, 0xf2c94c, 0xe0533a], [19, 9, 0x3fa27a, 0xf6f1e4],
      [21, -9, 0xe0533a, 0xf2c94c], [25, 3, 0x2f7fc4, 0xf2c94c], [9.5, 11, 0xf2c94c, 0xf6f1e4], [28, -5, 0x3fa27a, 0xe0533a],
    ];
    const PARASOL = new THREE.ConeGeometry(0.5, 1, 18);
    PARASOLS.forEach(([x, z, a, b], i) => {
      m.add(G.cyl, 0xf2f2ee, x, 1.2, z, 0.1 * (i % 2 ? 1 : -1), 0, 0, 0.06, 2.6, 0.06);
      m.add(PARASOL, a, x, 2.45, z, 0, i, 0, 2.8, 0.55, 2.8);
      m.add(G.cyl, b, x, 2.16, z, 0, 0, 0, 2.86, 0.08, 2.86); // el faldón, del otro color
      m.add(G.box, [0x3a8fd8, 0xf2c94c, 0xe0533a, 0xf6f1e4][i % 4], x + 1.1, 0.01, z + 0.6, 0, 0.2 * i, 0, 0.9, 0.01, 1.8);
      if (i % 3 === 0) m.add(G.rbox, 0x2f7fc4, x - 0.9, 0.2, z + 0.9, 0, i, 0, 0.5, 0.36, 0.34); // nevera
    });
    // El chiringuito: caseta de madera con tejadillo de cañizo y su barra
    m.add(G.box, 0xb88a5a, 30, 1.4, 13, 0, -0.3, 0, 5, 2.8, 3);
    m.add(G.box, 0xd9c08a, 30, 2.95, 13, 0, -0.3, 0, 5.8, 0.25, 3.8);
    m.add(G.box, 0x7a5236, 29.2, 1.1, 14.3, 0, -0.3, 0, 4.2, 0.12, 0.6);
    sc.add(m.mesh());
    const LOOKS = [
      { skin: 0xe8b894, shirt: 0x2f7fc4, pants: 0x2a2a2a, hair: 0x2b1d14, hairStyle: 'short', male: true, shorts: true },
      { skin: 0xf0c8a6, shirt: 0xe0533a, pants: 0xe0533a, hair: 0x6b3f22, hairStyle: 'straight', shorts: true },
      { skin: 0xd9a27c, shirt: 0xf6f1e4, pants: 0x3a6a5a, hair: 0x1f1610, hairStyle: 'short', male: true, shorts: true },
      { skin: 0xf3d2b6, shirt: 0xf2c94c, pants: 0x3b4a6b, hair: 0x9a6a3a, hairStyle: 'straight', shorts: true },
    ] as const;
    this.extras = [[11.8, -6.6], [13.6, 7.4], [17.3, -2.2], [20.2, 9.9], [22.3, -8.2], [10.6, 11.9]].map(([x, z], i) => {
      const p = makePerson(LOOKS[i % LOOKS.length]);
      p.root.position.set(x, 0, z);
      p.root.rotation.y = -Math.PI / 2 + (i - 2.5) * 0.4;
      sc.add(p.root);
      return p;
    });
    const netTex = canvasTex((c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = 'rgba(30,30,34,.85)';
      c.lineWidth = 2;
      for (let x = 0; x <= w; x += 16) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, h);
        c.stroke();
      }
      for (let y = 0; y <= h; y += 16) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
    }, 256, 64);
    netTex.wrapS = THREE.RepeatWrapping;
    netTex.repeat.set(9, 1);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 0.9), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    net.position.set(0, 1.9, 0);
    net.rotation.y = Math.PI / 2;
    sc.add(net);

    this.me = makePerson(castLook({ ...MARGAUX_LOOK, shorts: true }, 'azul_playa'));
    this.gas = makePerson(castLook({ ...MARC_LOOK, shorts: true }, 'gas_playa'));
    this.me.root.position.copy(ME);
    this.me.root.rotation.y = Math.PI / 2;
    this.gas.root.position.copy(GAS);
    this.gas.root.rotation.y = -Math.PI / 2;
    sc.add(this.me.root, this.gas.root);
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), toon({ map: beachBallTexture(), roughness: 0.4 }));
    this.ball.castShadow = true;
    sc.add(this.ball);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    this.shadow.position.y = 0.01;
    // (la sombra de mentira, solo sin sombras de verdad: con las dos, la pelota tenía dos sombras)
    this.shadow.visible = !quality.shadows;
    sc.add(this.shadow);

    this.hud = hud(() => ctx.input.queueAction(), () => {}, 'Muévete hasta la sombra de la pelota y dale cuando llegue', true);
    this.hud.setObjective('🏐 4 puntos');
    this.updateHud();
    // A su espalda y un poco de lado: ella delante, la red, Gas y la playa con gente detrás; el mar a la izquierda
    ctx.camera.position.set(-9.6, 3.4, -2.2);
    ctx.camera.lookAt(0.5, 1.0, 0.4);
    missionCard(T.title, T.hint);
    this.mark = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, depthWrite: false }));
    this.mark.position.y = 0.02;
    this.mark.renderOrder = 3;
    sc.add(this.mark);
    this.serve();
  }

  // (4.3) Un partido de verdad: Gas la manda a un sitio distinto de tu campo (el aro amarillo dice dónde cae);
  // corres hasta allí con el joystick y le das cuando llega. Si se la devuelves, a veces Gas falla: punto tuyo.
  // Si se te cae, punto de Gas. A 7 puntos; hay que hacer al menos 4, y si no, otra vez.
  private mark: THREE.Mesh;
  private mine = 0;
  private his = 0;
  private rally = 0;
  private gasMiss = false;

  private updateHud() {
    this.hud.setCounters(`<span class="chip${this.mine >= NEED ? ' ok' : ''}">🏐 Tú ${this.mine}/${NEED}</span><span class="chip">Gas ${this.his}</span>`);
  }

  /** Gas saca o devuelve: a un punto al azar de tu campo. */
  private serve() {
    this.rally++;
    const tz = (Math.random() * 2 - 1) * 3.2, tx = -1.8 - Math.random() * 4.6;
    this.launchTo(GAS, new THREE.Vector3(tx, HANDS, tz));
  }

  private launchTo(a: THREE.Vector3, b: THREE.Vector3) {
    this.dur = Math.max(1.05, 1.5 - this.rally * 0.03);
    this.from.set(a.x * 0.95, LAUNCH, a.z);
    this.to.copy(b);
    this.flight = 0;
    this.tapped = false;
    this.toMe = b.x < 0;
    this.mark.visible = this.toMe;
    if (this.toMe) this.mark.position.set(b.x, 0.02, b.z);
  }

  private ballAt(k: number, out: THREE.Vector3) {
    // Parábola alta por encima de la red
    out.lerpVectors(this.from, this.to, k);
    out.y += Math.sin(k * Math.PI) * 2.4;
    return out;
  }

  private bump(p: Person) {
    this.hitT.set(p, 0.35);
    audio.knock(0.4, 520, 0.05);
  }

  private point(mine: boolean) {
    if (mine) this.mine++;
    else this.his++;
    this.updateHud();
    this.dropT = 0;
    this.mark.visible = false;
    if (mine) {
      audio.chime(1);
      comicWord('¡PUNTO!', 'perfect');
    } else {
      audio.boo();
      comicWord(MINIS.voley.miss, 'hit');
    }
  }

  update(dt: number) {
    this.t += dt;
    this.extras.forEach((p, i) => animatePerson(p, dt, i % 2 ? 'talk' : 'idle', 0, this.t * 3 + i));
    const { input, camera } = this.ctx;
    const T = MINIS.voley;
    const pressed = input.consumeAction();
    this.cool -= dt;
    // Ella se mueve por su campo con el joystick (de espaldas a la cámara: arriba, hacia la red)
    const ax = input.axes();
    let moving = 0;
    if (this.endT < 0) {
      const sp = 4.6;
      const mp = this.me.root.position;
      mp.x = THREE.MathUtils.clamp(mp.x + ax.y * sp * dt, -7.4, -1.1);
      mp.z = THREE.MathUtils.clamp(mp.z + ax.x * sp * dt, -3.9, 3.9);
      moving = Math.min(1, Math.hypot(ax.x, ax.y));
    }
    if (this.endT >= 0) {
      this.endT += dt;
      if (this.endT > 2.8) {
        const won = this.mine >= NEED;
        if (won) {
          const done = this.onDone;
          stage.end();
          done();
        } else {
          // No llega a 4: otra vez el partido
          this.endT = -1;
          this.mine = this.his = 0;
          this.rally = 0;
          this.updateHud();
          missionCard(T.title, T.again, false);
          this.serve();
        }
        return;
      }
    } else if (this.dropT >= 0) {
      // Al suelo: rebota en la arena y se vuelve a sacar
      this.dropT += dt;
      const k = Math.min(1, this.dropT / 0.6);
      this.ball.position.y = Math.max(0.17, 0.17 + Math.abs(Math.sin(k * Math.PI * 2)) * 0.4 * (1 - k));
      if (this.dropT > 1.2) {
        this.dropT = -1;
        if (this.mine >= NEED || this.his >= GAME - NEED + 1) this.finishMatch();
        else this.serve();
      }
    } else {
      this.flight += dt / this.dur;
      const k = Math.min(1.25, this.flight);
      this.ballAt(Math.min(1, k), this.ball.position);
      if (k > 1) this.ball.position.y = Math.max(0.17, HANDS - (k - 1) * 4);
      const mp = this.me.root.position;
      const near = Math.hypot(mp.x - this.to.x, mp.z - this.to.z) < 0.95;
      const window = this.toMe && this.flight > 0.78 && this.flight < 1.1;
      (this.mark.material as THREE.MeshBasicMaterial).color.set(near ? 0x5cff8a : 0xffd23f);
      this.hud.setAction(T.btn, window && near);
      if (this.toMe && pressed && !this.tapped && this.cool <= 0) {
        if (window && near) {
          this.tapped = true;
          this.bump(this.me);
          vibrate(15);
          // A veces Gas no llega: punto tuyo (más a menudo cuanto más larga es la jugada)
          this.gasMiss = Math.random() < 0.38 + Math.min(0.3, this.rally * 0.04);
          const tz = (Math.random() * 2 - 1) * 3.4;
          this.launchTo(ME, new THREE.Vector3(this.gasMiss ? 5.2 + Math.random() * 1.6 : GAS.x, HANDS, this.gasMiss ? tz : this.gas.root.position.z));
        } else {
          this.cool = 0.4;
          comicWord(!near ? T.far : this.flight < 0.78 ? T.early : T.late, 'hit');
        }
      }
      if (this.flight >= 1 && !this.toMe) {
        if (this.gasMiss) this.point(true);
        else {
          this.bump(this.gas);
          this.serve();
        }
      } else if (this.flight >= 1.2 && this.toMe && !this.tapped) this.point(false);
    }
    // Gas se mueve hacia donde va a caer lo que le mandas
    if (!this.toMe && !this.gasMiss) this.gas.root.position.z += (this.to.z - this.gas.root.position.z) * Math.min(1, dt * 3);
    // Brazos: listos para recibir; al darle, extendidos y un salto de rodillas
    for (const p of [this.me, this.gas]) {
      const h = (this.hitT.get(p) ?? 0) - dt;
      this.hitT.set(p, h);
      const run = p === this.me && moving > 0.1 && this.endT < 0;
      animatePerson(p, dt, this.endT >= 0 && p === this.me && this.mine >= NEED ? 'cheer' : run ? 'walk' : 'idle', run ? moving : 0);
      if (this.endT < 0 && !run) {
        const k = h > 0 ? 1 : 0.4;
        p.armL.rotation.set(-0.9 * k - 0.2, 0, 0.25);
        p.armR.rotation.set(-0.9 * k - 0.2, 0, -0.25);
        p.elbowL.rotation.x = p.elbowR.rotation.x = h > 0 ? 0 : -0.5;
        p.kneeL.rotation.x = p.kneeR.rotation.x = h > 0 ? 0.5 : 0.25;
      }
    }
    this.shadow.position.set(this.ball.position.x, 0.01, this.ball.position.z);
    this.ball.rotation.x += dt * 6;
    // A su espalda, más alta y algo más lejos para ver todo su campo, siguiéndola un poco
    this.camAt.set(-9.6 + (this.me.root.position.x + 3.6) * 0.3, 3.4, -2.2 + this.me.root.position.z * 0.35);
    camera.position.lerp(this.camAt, Math.min(1, dt * 2));
    camera.lookAt(0.5 + this.ball.position.x * 0.12, 1.0, this.me.root.position.z * 0.3 + 0.4);
    this.sky.update(camera, dt);
    this.sun.follow(new THREE.Vector3());
  }

  private finishMatch() {
    this.endT = 0;
    this.hud.setAction(null);
    this.mark.visible = false;
    const T = MINIS.voley;
    if (this.mine >= NEED) missionCard(T.title, T.done, true);
    else comicWord(T.short(this.mine), 'hit');
  }

  dispose() {
    this.hud.remove();
    disposeScene(this.scene);
  }
}

/** Septiembre: vóley playa con Gas. */
export function beachMission(onDone: () => void) {
  stage.start((ctx) => new BeachMission(ctx, onDone), false);
}
