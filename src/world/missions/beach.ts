import * as THREE from 'three';
import { audio } from '../../core/audio';
import { Sky, Sun, toon, makeSea, vibrate, quality } from '../../core/gfx';
import { Surf } from '../../core/surfaces';
import { beachBallTexture } from '../../core/physics';
import { stage, type Mission, type MissionCtx } from '../../core/stage';
import { MARGAUX_LOOK, MARC_LOOK } from '../../data/characters';
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
  private passes = 0;
  private misses = 0;
  private hitT = new Map<Person, number>();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private endT = -1;
  private cool = 0;

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
    sc.add(m.mesh());
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

    this.me = makePerson({ ...MARGAUX_LOOK, shorts: true });
    this.gas = makePerson({ ...MARC_LOOK, shorts: true });
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

    this.hud = hud(() => ctx.input.queueAction(), () => {}, 'Toca el botón cuando la pelota llegue a ti', true);
    this.hud.setObjective('🏐');
    this.updateHud();
    ctx.camera.position.set(-3.2, 2.7, -8.2);
    ctx.camera.lookAt(0, 1.3, 0.5);
    missionCard(T.title, T.hint);
    this.launch(GAS, ME);
  }

  private updateHud() {
    this.hud.setCounters(`<span class="chip">🏐 ${this.passes}</span><span class="chip">${'❤️'.repeat(3 - this.misses)}${'🤍'.repeat(this.misses)}</span>`);
  }

  private launch(a: THREE.Vector3, b: THREE.Vector3) {
    this.dur = Math.max(0.9, 1.35 - this.passes * 0.04);
    this.from.set(a.x * 0.95, LAUNCH, a.z);
    this.to.set(b.x, HANDS, b.z + (Math.random() - 0.5) * 0.4);
    this.flight = 0;
    this.tapped = false;
    this.toMe = b === ME;
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

  update(dt: number) {
    this.t += dt;
    const { input, camera } = this.ctx;
    const T = MINIS.voley;
    const pressed = input.consumeAction();
    this.cool -= dt;
    if (this.endT >= 0) {
      this.endT += dt;
      if (this.endT > 2.6) {
        const done = this.onDone;
        stage.end();
        done();
        return;
      }
    } else if (this.dropT >= 0) {
      // Al suelo: rebota en la arena y se vuelve a sacar
      this.dropT += dt;
      const k = Math.min(1, this.dropT / 0.6);
      this.ball.position.y = Math.max(0.17, 0.17 + Math.abs(Math.sin(k * Math.PI * 2)) * 0.4 * (1 - k));
      if (this.dropT > 1.2) {
        this.dropT = -1;
        if (this.misses >= 3) this.finish();
        else this.launch(GAS, ME);
      }
    } else {
      this.flight += dt / this.dur;
      const k = Math.min(1.25, this.flight);
      this.ballAt(Math.min(1, k), this.ball.position);
      if (k > 1) this.ball.position.y = Math.max(0.17, HANDS - (k - 1) * 4);
      const window = this.toMe && this.flight > 0.8 && this.flight < 1.1;
      this.hud.setAction(T.btn, window);
      if (this.toMe && pressed && !this.tapped && this.cool <= 0) {
        if (window) {
          this.tapped = true;
          this.passes++;
          this.bump(this.me);
          vibrate(15);
          this.updateHud();
          if (this.passes >= 12) {
            this.finish();
            return;
          }
          this.launch(ME, GAS);
        } else {
          this.cool = 0.4;
          comicWord(this.flight < 0.8 ? T.early : T.late, 'hit');
        }
      }
      if (this.flight >= 1 && !this.toMe) {
        // Gas siempre la devuelve
        this.bump(this.gas);
        this.launch(GAS, ME);
      } else if (this.flight >= 1.2 && this.toMe && !this.tapped) {
        this.misses++;
        this.dropT = 0;
        audio.boo();
        comicWord(T.miss, 'hit');
        this.updateHud();
      }
    }
    // Brazos: listos para recibir; al darle, extendidos y un salto de rodillas
    for (const p of [this.me, this.gas]) {
      const h = (this.hitT.get(p) ?? 0) - dt;
      this.hitT.set(p, h);
      animatePerson(p, dt, this.endT >= 0 && p === this.me && this.passes >= 5 ? 'cheer' : 'idle');
      if (this.endT < 0) {
        const k = h > 0 ? 1 : 0.4;
        p.armL.rotation.set(-0.9 * k - 0.2, 0, 0.25);
        p.armR.rotation.set(-0.9 * k - 0.2, 0, -0.25);
        p.elbowL.rotation.x = p.elbowR.rotation.x = h > 0 ? 0 : -0.5;
        p.kneeL.rotation.x = p.kneeR.rotation.x = h > 0 ? 0.5 : 0.25;
      }
      // Se mueve un poco hacia donde va a caer
      if (p === this.me && this.toMe) p.root.position.z += (this.to.z - p.root.position.z) * Math.min(1, dt * 3);
    }
    this.shadow.position.set(this.ball.position.x, 0.01, this.ball.position.z);
    this.ball.rotation.x += dt * 6;
    // Cámara de lado, siguiendo un poco la pelota
    // Tres cuartos desde la banda (de canto, la red no se veía), siguiendo un poco la pelota
    camera.position.lerp(new THREE.Vector3(this.ball.position.x * 0.25 - 3.2, 2.7, -8.2), Math.min(1, dt * 1.5));
    camera.lookAt(this.ball.position.x * 0.3, 1.35, 0.5);
    this.sky.update(camera, dt);
    this.sun.follow(new THREE.Vector3());
  }

  private finish() {
    this.endT = 0;
    this.hud.setAction(null);
    // (el resultado, en la tarjeta de misión cumplida: el toast no se ve)
    missionCard(MINIS.voley.title, MINIS.voley.done(this.passes), true);
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
