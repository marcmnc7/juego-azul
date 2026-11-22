import * as THREE from 'three';
import { audio } from '../../core/audio';
import { Sky, Sun, toon, makeSea, vibrate, quality } from '../../core/gfx';
import { Surf } from '../../core/surfaces';
import { beachBallTexture } from '../../core/physics';
import { stage, type Mission, type MissionCtx } from '../../core/stage';
import { MARGAUX_LOOK, MARC_LOOK, castLook } from '../../data/characters';
import { G, Merger, makePerson, animatePerson, type Person } from '../../entities/models';
import { hud, type Hud } from '../../ui/ui';
import { Particles } from '../../entities/fx';
import { Show } from './show';
import { canvasTex } from '../deco';
import { disposeScene } from '../level';

// Lo que nos gusta · septiembre: vóley playa «nivel 6», Azul contra Gas, un partido de verdad (4.4.4). Recibir
// (ponerse bajo la pelota y darle a tiempo), colocársela una misma y rematar arriba del todo, apuntando con el
// joystick a donde no está Gas; si llega, la devuelve y ataca él, cada vez más rápido. Quien gana el punto, saca
// (el saque: lanzar la pelota y saltar a pegarle arriba). A 5 puntos. Presentado como una retransmisión.
// Con la receta del capítulo 1: cielo pintado (mismos azules y horizonte crema), luz de las 11 con el reparto de
// ambiente de Ferreries (hemisférica 1,0 × 0,35 y sol con su tope de tebeo), mar de tebeo y arena dibujada.
// Nada de toast (no se ven en el cómic): los aciertos y fallos, onomatopeyas; el resultado, en la tarjeta.

const ME = new THREE.Vector3(-3.6, 0, 0);
const GAS = new THREE.Vector3(3.6, 0, 0);
const HANDS = 0.95; // altura a la que se le da (antebrazos)
/** A cuántos puntos se juega (gana quien llega antes). */
const NEED = 5;

class BeachMission implements Mission {
  readonly scene = new THREE.Scene();
  private hud: Hud;
  private show = new Show('Lo que nos gusta · septiembre');
  private me: Person;
  private gas: Person;
  private ball: THREE.Mesh;
  private shadow: THREE.Mesh;
  private ring!: THREE.Mesh;
  private trail: THREE.Mesh[] = [];
  private hist: THREE.Vector3[] = [];
  private fx: Particles;
  private sky: Sky;
  private sun: Sun;
  private extras: Person[] = [];
  private cheerT = 0;
  private t = 0;
  // La pelota: de dónde a dónde, cuánto tarda, lo alta que va y por dónde va (0-1)
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private dur = 1;
  private arc = 2.4;
  private k = 0;
  private state: 'intro' | 'toMe' | 'set' | 'toGas' | 'gasSet' | 'dead' | 'toss' = 'intro';
  private stT = 0;
  private mine = 0;
  private his = 0;
  private rally = 0;
  private serverMe = false;
  private hitWin = false;
  private reach = 1.4;
  private pressedDone = false;
  private jumpMe = 0;
  private jumpGas = 0;
  private bumpMe = 0;
  private bumpGas = 0;
  private slow = 1;
  private cut = 0;
  private cutWho: Person | null = null;
  private over = false;
  private camAt = new THREE.Vector3();
  private camLook = new THREE.Vector3(0, 1.2, 0);
  /** (para que los bocadillos de Azul salgan de su cabeza) */
  get azul() {
    return this.me;
  }

  constructor(private ctx: MissionCtx, private onDone: () => void) {
    const sc = this.scene;
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

    this.fx = new Particles(sc);
    // El aro de cuándo darle: alrededor de la sombra, se cierra a medida que baja la pelota
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
    this.ring.position.y = 0.025;
    this.ring.visible = false;
    sc.add(this.ring);
    // La estela de la pelota (bolitas que se apagan)
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12 - i * 0.012, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 - i * 0.045, depthWrite: false }));
      m.visible = false;
      sc.add(m);
      this.trail.push(m);
    }

    this.hud = hud(() => ctx.input.queueAction(), () => {}, '', true);
    this.hud.setIcon('🏐');
    this.show.bind(this.hud);
    this.hud.setObjective(`🏐 A ${NEED} puntos`);
    this.paint();
    // Entrada: desde el mar, volando hasta detrás de ella, con el rótulo del partido
    ctx.camera.position.set(-6, 14, 34);
    ctx.camera.lookAt(0, 1, 0);
    this.camAt.copy(ctx.camera.position);
    this.show.intro('Vóley playa', 'Azul vs Gas · nivel 6', `Muévete con el joystick y dale con 🏐: recibe, colócatela y remata arriba del todo, apuntando adonde no esté Gas. A ${NEED} puntos.`);
    this.ball.position.set(GAS.x, HANDS, 0);
  }

  private paint() {
    this.show.score(`<span class="chip${this.mine >= NEED ? ' ok' : ''}">🏐 Tú ${this.mine} · ${this.his} Gas <small>a ${NEED}</small></span>`);
  }

  private fly(from: THREE.Vector3, to: THREE.Vector3, dur: number, arc: number) {
    this.from.copy(from);
    this.to.copy(to);
    this.dur = dur;
    this.arc = arc;
    this.k = 0;
    this.pressedDone = false;
  }

  private ballAt(k: number, out: THREE.Vector3) {
    out.lerpVectors(this.from, this.to, k);
    out.y += Math.sin(Math.min(1, k) * Math.PI) * this.arc;
    return out;
  }

  /** Lo que tarda en cruzar: cada vez más deprisa cuanto más larga es la jugada. */
  private speedK() {
    return Math.max(0.7, 1 - this.rally * 0.05);
  }

  private gasServe() {
    this.serverMe = false;
    this.state = 'toMe';
    this.rally = 0;
    this.jumpGas = 0.5;
    audio.knock(0.4, 520, 0.05);
    const target = new THREE.Vector3(-1.8 - Math.random() * 5, HANDS, (Math.random() * 2 - 1) * 3.4);
    this.fly(new THREE.Vector3(GAS.x + 2.5, 2.2, this.gas.root.position.z), target, 1.55, 2.9);
  }

  /** Gas ataca a su campo (remate): bajo y rápido. */
  private gasAttack() {
    this.state = 'toMe';
    this.rally++;
    this.jumpGas = 0.55;
    audio.knock(0.5, 300, 0.06);
    // A veces falla él: a la red o fuera (más cuanto más larga es la jugada)
    if (Math.random() < 0.08 + Math.min(0.12, this.rally * 0.02)) {
      const out = Math.random() < 0.5;
      this.fly(new THREE.Vector3(this.gas.root.position.x, 2.9, this.gas.root.position.z), out ? new THREE.Vector3(-9.5, 0.2, (Math.random() < 0.5 ? -1 : 1) * 5.5) : new THREE.Vector3(0.3, 1.2, this.gas.root.position.z), 0.8, out ? 0.8 : 0.1);
      this.state = 'dead';
      this.stT = -0.8;
      window.setTimeout(() => !this.over && this.point(true, out ? '¡FUERA!' : '¡A LA RED!'), 800);
      return;
    }
    const target = new THREE.Vector3(-1.6 - Math.random() * 5.4, HANDS, (Math.random() * 2 - 1) * 3.6);
    this.fly(new THREE.Vector3(this.gas.root.position.x, 2.9, this.gas.root.position.z), target, 1.05 * this.speedK(), 1.0);
  }

  /** Su remate (o su saque): adonde apunta el joystick en el campo de Gas. perfect: más rápido y más difícil de coger. */
  private herAttack(perfect: boolean, serve = false) {
    const ax = this.ctx.input.axes();
    const tz = THREE.MathUtils.clamp(ax.x * 3.8 + (Math.random() - 0.5) * 0.8, -3.8, 3.8);
    const tx = 2.2 + Math.max(0, -ax.y) * 3 + Math.random() * 2.5;
    this.state = 'toGas';
    this.jumpMe = 0.55;
    this.slow = 0.3;
    vibrate(25);
    audio.hit();
    this.reach = perfect ? 0.95 : serve ? 1.6 : 1.35;
    const m = this.me.root.position;
    this.fly(new THREE.Vector3(m.x + 0.4, 2.9, m.z), new THREE.Vector3(tx, HANDS * 0.6, tz), (perfect ? 0.42 : 0.55) * (serve ? 1.6 : 1), serve ? 1.6 : 0.35);
    if (perfect) this.show.call(serve ? '¡SAQUE BOMBA!' : '¡REMATE!', true, 0.9);
  }

  private point(mine: boolean, why: string) {
    if (this.over) return;
    if (mine) this.mine++;
    else this.his++;
    this.paint();
    this.state = 'dead';
    this.stT = 0;
    this.ring.visible = false;
    this.fx.burst(this.ball.position.clone().setY(0.1), 'dust', 10, 1.2, 0.6);
    this.show.call(why, mine, 1.2);
    // Plano corto de quien gana el punto
    this.cut = 1.5;
    this.cutWho = mine ? this.me : this.gas;
    if (mine) {
      audio.cheer(0.45);
      audio.chime(2);
      this.cheerT = 2.2;
    } else audio.boo();
    if (this.mine >= NEED || this.his >= NEED) {
      this.over = true;
      const won = this.mine >= NEED;
      window.setTimeout(() => {
        if (won) {
          this.show.win('¡NIVEL 6!');
          window.setTimeout(() => {
            const done = this.onDone;
            stage.end();
            done();
          }, 3400);
        } else {
          this.show.call('¡REVANCHA!', false, 1.6);
          window.setTimeout(() => {
            this.mine = this.his = 0;
            this.over = false;
            this.paint();
            this.gasServe();
          }, 1800);
        }
      }, 1300);
    }
  }

  update(dtRaw: number) {
    // (cámara lenta en los remates)
    this.slow += (1 - this.slow) * Math.min(1, dtRaw * 2.2);
    const dt = dtRaw * this.slow;
    this.t += dt;
    this.fx.update(dt);
    this.cheerT -= dt;
    this.extras.forEach((p, i) => animatePerson(p, dt, this.cheerT > 0 ? 'cheer' : i % 2 ? 'talk' : 'idle', 0, this.t * 3 + i));
    const { input, camera } = this.ctx;
    const pressed = input.consumeAction();
    const ax = input.axes();
    const mp = this.me.root.position;
    let moving = 0;
    // Ella, por su campo (de espaldas a la cámara: arriba, hacia la red)
    if (this.state !== 'intro' && this.state !== 'toss') {
      const sp = 5.2;
      mp.x = THREE.MathUtils.clamp(mp.x + ax.y * sp * dt, -7.8, -0.9);
      mp.z = THREE.MathUtils.clamp(mp.z + ax.x * sp * dt, -4, 4);
      moving = Math.min(1, Math.hypot(ax.x, ax.y));
    }
    this.stT += dt;
    const b = this.ball.position;
    switch (this.state) {
      case 'intro':
        if (this.stT > 3.4) this.gasServe();
        break;
      case 'toMe': {
        this.k += dt / this.dur;
        this.ballAt(Math.min(1.25, this.k), b);
        if (this.k > 1) b.y = Math.max(0.17, HANDS - (this.k - 1) * 5);
        // El aro: dónde cae y cuándo (se cierra hasta el tamaño de ella)
        this.ring.visible = this.k < 1.05;
        this.ring.position.set(this.to.x, 0.025, this.to.z);
        this.ring.scale.setScalar(Math.max(0.5, 1.6 - this.k * 1.15));
        const near = Math.hypot(mp.x - this.to.x, mp.z - this.to.z) < 1.05;
        (this.ring.material as THREE.MeshBasicMaterial).color.set(near ? 0x7dffa0 : 0xffffff);
        if (pressed && !this.pressedDone) {
          this.pressedDone = true;
          const off = Math.abs(this.k - 0.96);
          if (near && off < 0.12) {
            const perfect = off < 0.04;
            this.bumpMe = 0.4;
            audio.knock(0.45, 560, 0.05);
            if (perfect) this.show.call('¡PERFECTA!', true, 0.8);
            // Se la coloca: arriba, un poco hacia la red
            this.state = 'set';
            this.stT = 0;
            this.hitWin = perfect;
            this.ring.visible = false;
            this.fly(b.clone(), new THREE.Vector3(Math.min(-1.2, mp.x + 1.2), HANDS + 0.6, mp.z), perfect ? 1.25 : 1.05, 2.6);
            break;
          }
          this.show.call(!near ? '¡LEJOS!' : this.k < 0.84 ? '¡PRONTO!' : '¡TARDE!', false, 0.7);
        }
        if (this.k > 1.15) this.point(false, '¡AL SUELO!');
        break;
      }
      case 'set': {
        this.k += dt / this.dur;
        this.ballAt(Math.min(1.2, this.k), b);
        // Remate: arriba del todo (alrededor de la mitad del vuelo), más margen si la recepción fue perfecta
        const win = this.hitWin ? 0.2 : 0.14;
        if (pressed && !this.pressedDone) {
          this.pressedDone = true;
          const off = Math.abs(this.k - 0.5);
          if (off < win) this.herAttack(off < 0.06);
          else {
            this.show.call(this.k < 0.5 ? '¡PRONTO!' : '¡TARDE!', false, 0.7);
            // Sin remate: la pasa como puede, fácil para él
            this.state = 'toGas';
            this.reach = 9;
            this.fly(b.clone(), new THREE.Vector3(3.6, HANDS, (Math.random() - 0.5) * 2), 1.2, 1.6);
          }
        }
        if (this.state === 'set' && this.k > 0.9 && !this.pressedDone) {
          // No ha rematado: se la pasa por encima como puede
          this.state = 'toGas';
          this.reach = 9;
          this.fly(b.clone(), new THREE.Vector3(3.6, HANDS, (Math.random() - 0.5) * 2), 1.2, 1.6);
        }
        break;
      }
      case 'toGas': {
        this.k += dt / this.dur;
        this.ballAt(Math.min(1, this.k), b);
        // Gas corre hacia donde cae (con un poco de reacción)
        if (this.k > 0.12) {
          const g = this.gas.root.position;
          const dz = this.to.z - g.z, dx = this.to.x - g.x;
          const d = Math.hypot(dx, dz);
          const v = 5.4 * dt;
          if (d > 0.05) {
            g.z += (dz / d) * Math.min(v, d);
            g.x = THREE.MathUtils.clamp(g.x + (dx / d) * Math.min(v, d) * 0.6, 1.5, 7.6);
          }
        }
        if (this.k >= 1) {
          const g = this.gas.root.position;
          if (Math.hypot(g.x - this.to.x, g.z - this.to.z) <= this.reach) {
            // La saca: se la coloca y ataca
            this.bumpGas = 0.4;
            audio.knock(0.45, 520, 0.05);
            this.state = 'gasSet';
            this.stT = 0;
            this.fly(b.clone(), new THREE.Vector3(g.x - 0.8, 3.0, g.z), 0.85, 1.4);
          } else this.point(true, this.serverMe && this.rally === 0 ? '¡ACE!' : '¡PUNTO!');
        }
        break;
      }
      case 'gasSet':
        this.k += dt / this.dur;
        this.ballAt(Math.min(1, this.k), b);
        if (this.k >= 1) this.gasAttack();
        break;
      case 'toss': {
        // Su saque: primer toque, la lanza; el segundo, arriba del todo, salta y le pega
        mp.x += (-7.6 - mp.x) * Math.min(1, dt * 6);
        if (this.stT < 0) {
          b.set(mp.x + 0.3, HANDS, mp.z);
          if (pressed) {
            this.stT = 0;
            this.fly(b.clone(), b.clone().setY(HANDS + 0.1), 1.2, 3);
            audio.whoosh();
          }
        } else {
          this.k += dt / this.dur;
          this.ballAt(Math.min(1.2, this.k), b);
          if (pressed && !this.pressedDone) {
            this.pressedDone = true;
            const off = Math.abs(this.k - 0.5);
            if (off < 0.16) {
              this.rally = 0;
              this.herAttack(off < 0.05, true);
            } else this.point(false, '¡FALTA!');
          }
          if (this.state === 'toss' && this.k > 1.05) this.point(false, '¡FALTA!');
        }
        break;
      }
      case 'dead':
        if (this.stT < 0) {
          // (fallo de Gas: la pelota se va a la red o fuera)
          this.k += dt / this.dur;
          this.ballAt(Math.min(1, this.k), b);
        } else {
          b.y = Math.max(0.17, b.y - dt * 6);
          if (this.stT > 1.7 && !this.over) {
            if (this.mine > 0 && this.cutWho === this.me) {
              this.serverMe = true;
              this.state = 'toss';
              this.stT = -1;
              this.hud.setAction('🏐 Sacar');
            } else this.gasServe();
          }
        }
        break;
    }
    // Gas vuelve poco a poco al centro de su campo cuando no va a por la pelota
    if (this.state === 'toMe' || this.state === 'dead') {
      const g = this.gas.root.position;
      g.x += (4.2 - g.x) * Math.min(1, dt * 1.5);
      g.z += (0 - g.z) * Math.min(1, dt * 1.2);
    }
    // Saltos y brazos (recibir abajo, rematar arriba)
    this.jumpMe = Math.max(0, this.jumpMe - dt);
    this.jumpGas = Math.max(0, this.jumpGas - dt);
    this.bumpMe -= dt;
    this.bumpGas -= dt;
    for (const [p, jump, bump] of [[this.me, this.jumpMe, this.bumpMe], [this.gas, this.jumpGas, this.bumpGas]] as const) {
      const run = p === this.me && moving > 0.1 && jump <= 0;
      animatePerson(p, dt, this.over && p === (this.mine >= NEED ? this.me : this.gas) ? 'cheer' : run ? 'walk' : 'idle', run ? moving : 0);
      p.root.position.y = jump > 0 ? Math.sin((jump / 0.55) * Math.PI) * 0.75 : 0;
      if (jump > 0) {
        p.armR.rotation.set(-2.9, 0, -0.2);
        p.armL.rotation.set(-2.2, 0, 0.3);
      } else if (!run) {
        const k = bump > 0 ? 1 : 0.4;
        p.armL.rotation.set(-0.9 * k - 0.2, 0, 0.25);
        p.armR.rotation.set(-0.9 * k - 0.2, 0, -0.25);
        p.elbowL.rotation.x = p.elbowR.rotation.x = bump > 0 ? 0 : -0.5;
        p.kneeL.rotation.x = p.kneeR.rotation.x = bump > 0 ? 0.5 : 0.25;
      }
    }
    // Estela
    this.hist.unshift(b.clone());
    if (this.hist.length > 16) this.hist.pop();
    const fast = this.state === 'toGas' || (this.state === 'toMe' && this.dur < 1.1);
    this.trail.forEach((m, i) => {
      const h = this.hist[(i + 1) * 2];
      m.visible = fast && !!h;
      if (h) m.position.copy(h);
    });
    this.shadow.position.set(b.x, 0.01, b.z);
    this.ball.rotation.x += dt * 8;
    // Cámara: detrás de ella; en el remate, más baja y cerca; tras un punto, plano corto de quien lo gana
    this.cut -= dtRaw;
    if (this.state === 'intro') {
      this.camAt.set(-10.5, 3.8, -2);
      camera.position.lerp(this.camAt, Math.min(1, dtRaw * 0.9));
      this.camLook.lerp(new THREE.Vector3(0.5, 1, 0), Math.min(1, dtRaw * 1.2));
    } else if (this.cut > 0 && this.cutWho) {
      const w = this.cutWho.root.position;
      const side = this.cutWho === this.me ? 1 : -1;
      this.camAt.set(w.x + side * 3.2, 1.7, w.z + 2.2);
      camera.position.lerp(this.camAt, Math.min(1, dtRaw * 5));
      this.camLook.lerp(new THREE.Vector3(w.x, 1.3, w.z), Math.min(1, dtRaw * 6));
    } else {
      const attack = this.state === 'set' || (this.state === 'toss' && this.stT >= 0);
      this.camAt.set(attack ? mp.x - 5.2 : -10.2 + (mp.x + 3.6) * 0.3, attack ? 2.4 : 3.8, (attack ? mp.z * 0.8 : mp.z * 0.35) - (attack ? 1.6 : 2));
      camera.position.lerp(this.camAt, Math.min(1, dtRaw * 2.2));
      this.camLook.lerp(new THREE.Vector3(attack ? b.x * 0.5 : 0.5 + b.x * 0.12, attack ? Math.max(1.5, b.y * 0.7) : 1.0, attack ? b.z * 0.6 : mp.z * 0.3 + 0.4), Math.min(1, dtRaw * 3));
    }
    camera.lookAt(this.camLook);
    this.sky.update(camera, dtRaw);
    this.sun.follow(new THREE.Vector3());
  }

  dispose() {
    this.hud.remove();
    this.show.dispose();
    disposeScene(this.scene);
  }
}

/** Septiembre: vóley playa con Gas. */
export function beachMission(onDone: () => void) {
  stage.start((ctx) => new BeachMission(ctx, onDone), false);
}
