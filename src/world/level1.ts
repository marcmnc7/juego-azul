import * as THREE from 'three';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker, type Circle } from '../core/walker';
import { Confetti, Fireworks, toon, vibrate } from '../core/gfx';
import { FERRERIES, NAMES } from '../data/story';
import { buildFerreries, animateCrowd, FerreriesWorld } from './ferreries';
import { makePerson, makeDonkey, animatePerson, Person, Donkey, Merger, G } from '../entities/models';
import { Particles } from '../entities/fx';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { hud, dialogue, toast, Hud, DebugItem } from '../ui/ui';
import { clock, type Level, type LevelDone } from './level';

// Nivel 1 · Jaleo d'ases (Ferreries).
// Bucle: hablar con Tòfol → 3 pomadas + 3 toques de suerte esquivando ases → volver a Tòfol → encontrar a Marc → bailar → regalo.
// Los ases avisan con un "!" antes de ponerse de manos; tocarlos en lo más alto da un toque perfecto.

type Stage = 'intro' | 'talkTofol' | 'collect' | 'returnTofol' | 'findMarc' | 'kiss' | 'kissing' | 'ending' | 'done';

const WARN = 0.8;
const REAR = 1.8;
const TOUCH_R = 3.2;

interface DonkeyState {
  d: Donkey;
  mode: 'circle' | 'street';
  angle: number; // para el círculo
  dir: number; // para la calle
  warnT: number; // aviso antes de encabritarse
  rearT: number; // tiempo restante encabritado
  nextRear: number;
  touched: boolean;
  walkPhase: number;
  alert: THREE.Sprite;
  ring: THREE.Mesh;
}

interface Pomada {
  mesh: THREE.Object3D;
  home: THREE.Vector3;
  taken: boolean;
}

let alertTex: THREE.Texture | null = null;
function alertTexture() {
  if (alertTex) return alertTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#2a1a2e';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a1a2e';
  ctx.font = 'bold 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 64, 70);
  alertTex = new THREE.CanvasTexture(c);
  alertTex.colorSpace = THREE.SRGBColorSpace;
  return alertTex;
}

export class Level1 implements Level {
  private scene = new THREE.Scene();
  private world: FerreriesWorld;
  private player: Person;
  private walker: Walker;
  private tofol: Person;
  private marc: Person;
  private donkeys: DonkeyState[] = [];
  private pomadas: Pomada[] = [];
  private inHand: THREE.Object3D;
  private fx: Particles;
  private confetti = new Confetti(180, 12, 10);
  private marker: THREE.Group;
  private hud: Hud;
  private stage: Stage = 'intro';
  private pomadaCount = 0;
  private luckCount = 0;
  private perfects = 0;
  private hits = 0;
  private playTime = 0;
  private invuln = 0;
  private t = 0;
  private busy = false; // diálogo abierto
  private endingT = 0;
  private pendingAction: (() => void) | null = null;
  private fabiolera: Person;
  private fireworks = new Fireworks();
  private kissT = 0;
  private noteT = 0;
  private partyColors: Float32Array;
  private hue = 0;
  private tmpC = new THREE.Color();
  private solids: Circle[] = [];

  // temporales reutilizables
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: LevelDone,
    onMenu: () => void,
  ) {
    this.world = buildFerreries(this.scene);
    this.fx = new Particles(this.scene);

    this.player = makePerson(MARGAUX_LOOK);
    this.player.root.position.copy(this.world.spawn);
    this.scene.add(this.player.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.facing = this.walker.yaw = Math.PI / 2;
    this.solids.push(...this.world.people);

    this.tofol = makePerson({ skin: 0xd9a27c, shirt: 0xffffff, pants: 0x222222, hair: 0x9a9a9a, hairStyle: 'short', beard: true });
    this.tofol.root.position.copy(this.world.tofolPos);
    // Delantal de Tòfol
    this.tofol.body.add(new Merger().add(G.box, 0x2a7a50, 0, 0.92, 0.17, 0, 0, 0, 0.42, 0.5, 0.04).mesh());
    this.scene.add(this.tofol.root);

    this.marc = makePerson(MARC_LOOK);
    this.marc.root.position.copy(this.world.marcPos);
    this.marc.root.rotation.y = Math.atan2(-this.world.marcPos.x, 14 - this.world.marcPos.z);
    this.scene.add(this.marc.root);

    // La fabiolera: toca el fabiol y el tamborí delante de la iglesia
    this.fabiolera = makePerson({ skin: 0xf0c8a6, shirt: 0x1b1b22, pants: 0xf3f0ea, hair: 0x5a3a22, hairStyle: 'bun', shoes: 0x111111 });
    this.fabiolera.root.position.copy(this.world.fabioleraPos);
    this.fabiolera.root.rotation.y = Math.PI;
    this.fabiolera.body.add(
      new Merger()
        .add(G.cyl, 0x111111, 0, 2.08, 0, 0, 0, 0, 0.62, 0.18, 0.62) // bombín
        .add(G.cyl, 0x111111, 0, 1.99, 0, 0, 0, 0, 0.82, 0.03, 0.82)
        .add(G.cyl, 0xd9c7a5, 0.24, 0.95, 0.12, 0, 0, Math.PI / 2, 0.36, 0.22, 0.36) // tamborí
        .add(G.cyl, 0x9b2335, 0.24, 0.95, 0.12, 0, 0, Math.PI / 2, 0.37, 0.05, 0.37)
        .mesh(),
    );
    this.fabiolera.handR.add(new Merger().add(G.cyl, 0x6b4428, 0, 0.1, 0.05, 0.4, 0, 0, 0.04, 0.4, 0.04).mesh()); // fabiol
    this.scene.add(this.fabiolera.root);
    this.world.colliders.push({ minX: this.world.fabioleraPos.x - 0.4, maxX: this.world.fabioleraPos.x + 0.4, minZ: this.world.fabioleraPos.z - 0.4, maxZ: this.world.fabioleraPos.z + 0.4 });
    this.scene.add(this.fireworks.points);
    this.partyColors = this.world.partyLights.geometry.attributes.color.array as Float32Array;
    for (const p of [this.world.tofolPos, this.world.marcPos]) {
      this.world.colliders.push({ minX: p.x - 0.35, maxX: p.x + 0.35, minZ: p.z - 0.35, maxZ: p.z + 0.35 });
    }

    // Ases: 3 dando vueltas en la plaza y 1 paseando por la calle
    const coats = [0x7d6b5d, 0x5e4f45, 0x8f8379, 0x6d5a4a];
    const ringGeo = new THREE.RingGeometry(TOUCH_R - 0.25, TOUCH_R, 40).rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const d = makeDonkey(coats[i]);
      this.scene.add(d.root);
      const alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTexture(), depthTest: false, transparent: true }));
      alert.position.y = 3.6;
      alert.scale.setScalar(0.9);
      alert.visible = false;
      alert.renderOrder = 5;
      d.root.add(alert);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x5cff8a, transparent: true, opacity: 0.7, depthWrite: false }));
      ring.position.y = 0.04;
      ring.visible = false;
      d.root.add(ring);
      this.donkeys.push({
        d,
        mode: i < 3 ? 'circle' : 'street',
        angle: (i / 3) * Math.PI * 2,
        dir: 1,
        warnT: 0,
        rearT: 0,
        nextRear: 2 + i * 1.7,
        touched: false,
        walkPhase: i,
        alert,
        ring,
      });
      if (i === 3) d.root.position.set(-20, 0, 0);
    }

    // Pomadas: vaso con limonada y rodaja de limón, con un haz de luz para verlas de lejos
    const glassGeo = new Merger()
      .add(new THREE.CylinderGeometry(0.16, 0.12, 0.38, 12), 0xfff4b0, 0, 0.19, 0)
      .add(G.cyl, 0xf9e04b, 0.1, 0.4, 0, 0, 0, Math.PI / 2, 0.18, 0.03, 0.18)
      .add(G.cyl, 0x7fd36b, -0.05, 0.42, 0, 0.3, 0, 0.2, 0.03, 0.35, 0.03)
      .build();
    const glassMat = toon({ vertexColors: true, emissive: 0x4a3a00 });
    const beamGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 16, 1, true).translate(0, 3.5, 0);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const home of this.world.pomadaSpots) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(glassGeo, glassMat));
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.6, depthWrite: false }));
      glow.position.y = 0.02;
      g.add(glow, new THREE.Mesh(beamGeo, beamMat));
      g.position.copy(home);
      g.visible = false;
      this.scene.add(g);
      this.pomadas.push({ mesh: g, home: home.clone(), taken: false });
    }
    // La pomada que lleva en la mano
    this.inHand = new THREE.Mesh(glassGeo, glassMat);
    this.inHand.scale.setScalar(0.7);
    this.inHand.position.set(0, -0.2, 0.02);
    this.inHand.visible = false;
    this.player.handR.add(this.inHand);

    // Marcador de objetivo: flecha dorada que flota
    this.marker = new THREE.Group();
    const arrowMat = toon({ color: 0xffd23f, emissive: 0x7a5200 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.55, 16).rotateX(Math.PI), arrowMat);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 12).translate(0, 0.45, 0), arrowMat);
    this.marker.add(cone, stem);
    this.scene.add(this.marker);

    this.confetti.mesh.visible = false;
    this.confetti.active = false;
    this.scene.add(this.confetti.mesh);

    this.hud = hud(() => this.input.queueAction(), onMenu);
    this.updateHud();

    this.camera.position.set(-50, 9, 4);
    this.busy = true;
    setTimeout(() => {
      if (this.stage !== 'intro') return;
      dialogue(FERRERIES.intro, () => {
        this.busy = false;
        this.stage = 'talkTofol';
        this.updateHud();
      });
    }, 2300);
    audio.startMusic();
    audio.ambience(0.1);
  }

  get threeScene() {
    return this.scene;
  }

  private updateHud() {
    const h = this.hud;
    const counters = `<span class="chip">🍋 ${this.pomadaCount}/3</span><span class="chip">🍀 ${this.luckCount}/3</span>`;
    switch (this.stage) {
      case 'intro':
      case 'talkTofol':
        h.setObjective('Habla con Tòfol en el bar de la plaza');
        h.setCounters('');
        break;
      case 'collect':
        if (this.luckCount >= 3) h.setObjective('Recoge las pomadas que faltan en los bares');
        else if (this.pomadaCount >= 3) h.setObjective('Toca a los ases cuando se pongan de manos');
        else h.setObjective('Pomadas en los bares y toques a los ases cuando se pongan de manos');
        h.setCounters(counters);
        break;
      case 'returnTofol':
        h.setObjective('¡Lo tienes! Vuelve con Tòfol');
        h.setCounters(counters);
        break;
      case 'findMarc':
        h.setObjective(`Lleva una pomada a ${NAMES.partner}, junto a la iglesia`);
        h.setCounters('');
        break;
      case 'kiss':
        h.setObjective('…');
        h.setCounters('');
        break;
      default:
        h.setObjective('❤ Feliz cumpleaños ❤');
        h.setCounters('');
    }
  }

  private target(): THREE.Vector3 | null {
    switch (this.stage) {
      case 'talkTofol':
      case 'returnTofol':
        return this.world.tofolPos;
      case 'findMarc':
        return this.world.marcPos;
      case 'collect': {
        if (this.pomadaCount < 3) {
          let best: Pomada | null = null;
          let bd = Infinity;
          for (const p of this.pomadas) {
            if (p.taken) continue;
            const d = p.home.distanceToSquared(this.player.root.position);
            if (d < bd) {
              bd = d;
              best = p;
            }
          }
          if (best && (this.luckCount >= 3 || bd < 30 * 30)) return best.home;
        }
        return this.world.plazaCenter;
      }
      default:
        return null;
    }
  }

  private updateDonkeys(dt: number) {
    const pp = this.player.root.position;
    let rearingNear: DonkeyState | null = null;
    let nearest = Infinity;
    for (const s of this.donkeys) {
      const r = s.d.root;
      const dist = r.position.distanceTo(pp);
      if (s.rearT > 0) {
        const before = s.rearT;
        s.rearT -= dt;
        const prog = Math.min(1, 1 - s.rearT / REAR);
        const k = Math.sin(prog * Math.PI);
        s.d.pivot.rotation.x = -k * 0.8;
        s.d.legs[0].rotation.x = s.d.legs[1].rotation.x = -k * 1.2 + Math.sin(this.t * 16) * 0.35 * k;
        s.d.head.rotation.x = -k * 0.4;
        // Aterriza: polvo y temblor
        if (before > 0.3 && s.rearT <= 0.3) {
          r.localToWorld(this.v1.set(0, 0.1, 0.9));
          this.fx.burst(this.v1, 'dust', 6, 1.6, 0.4);
          if (dist < 7) this.walker.shake(0.18);
        }
        const touchable = !s.touched && s.rearT > 0.2 && this.stage === 'collect';
        s.ring.visible = touchable;
        if (touchable) {
          const perfect = k > 0.85;
          (s.ring.material as THREE.MeshBasicMaterial).color.set(perfect ? 0xffd23f : 0x5cff8a);
          s.ring.scale.setScalar(perfect ? 1 + Math.sin(this.t * 20) * 0.03 : 1);
        }
        if (s.rearT <= 0) {
          s.d.pivot.rotation.x = 0;
          s.ring.visible = false;
          s.nextRear = 3 + Math.random() * 4;
        }
      } else if (s.warnT > 0) {
        // Aviso: se para, sacude la cabeza y aparece el "!"
        s.warnT -= dt;
        s.alert.visible = true;
        s.alert.scale.setScalar(0.9 + Math.abs(Math.sin(this.t * 12)) * 0.25);
        s.d.head.rotation.y = Math.sin(this.t * 25) * 0.25;
        s.d.pivot.rotation.x = -Math.sin(this.t * 25) * 0.04;
        if (s.warnT <= 0) {
          s.alert.visible = false;
          s.d.head.rotation.y = 0;
          s.rearT = REAR;
          if (dist < 12) audio.whoosh();
        }
      } else {
        const spd = s.mode === 'circle' ? 0.32 : 2.6;
        if (s.mode === 'circle') {
          s.angle += dt * spd;
          const c = this.world.plazaCenter;
          r.position.set(c.x + Math.cos(s.angle) * 5.2, 0, c.z + Math.sin(s.angle) * 4.4);
          r.rotation.y = -s.angle; // tangente al círculo
        } else {
          r.position.x += s.dir * spd * dt;
          if (Math.abs(r.position.x) > 40) s.dir *= -1;
          r.position.z = 0;
          r.rotation.y = (s.dir * Math.PI) / 2;
        }
        s.walkPhase += dt * 8;
        const w = Math.sin(s.walkPhase) * 0.5;
        s.d.legs[0].rotation.x = w;
        s.d.legs[3].rotation.x = w;
        s.d.legs[1].rotation.x = -w;
        s.d.legs[2].rotation.x = -w;
        s.d.head.rotation.x = Math.sin(s.walkPhase * 0.5) * 0.08;
        s.d.pivot.rotation.x = Math.sin(s.walkPhase * 2) * 0.015;
        s.nextRear -= dt;
        // En la calle solo se encabrita si estás cerca; en la plaza, siempre
        if (s.nextRear <= 0 && (s.mode === 'circle' || dist < 7)) {
          s.warnT = WARN;
          if (dist < 12) audio.warn();
        }
      }

      if (!s.touched && s.rearT > 0.2 && dist < TOUCH_R && dist < nearest) {
        rearingNear = s;
        nearest = dist;
      }

      // Choque: el ase te empuja (solo si no está de manos)
      if (s.rearT <= 0 && dist < 1.35 && this.invuln <= 0 && !this.busy && this.stage !== 'ending') {
        this.v1.subVectors(pp, r.position).setY(0).normalize().multiplyScalar(10);
        this.walker.knock.copy(this.v1);
        this.walker.shake(0.4);
        this.invuln = 1.5;
        this.hits++;
        audio.hit();
        vibrate(90);
        this.fx.burst(this.v2.copy(pp).setY(0.1), 'dust', 5, 1.5, 0.3);
        if (this.stage === 'collect' && this.pomadaCount > 0) {
          this.pomadaCount--;
          const lost = this.pomadas.find((p) => p.taken);
          if (lost) {
            lost.taken = false;
            lost.mesh.visible = true;
          }
          toast(FERRERIES.hints.dropped);
          this.fx.burst(this.v1.copy(pp).setY(1.5), '🍋', 5);
          this.updateHud();
        } else {
          toast('¡Buu! Cuidado con los ases 🫏');
        }
      }
    }
    return rearingNear;
  }

  private touchDonkey(s: DonkeyState) {
    const k = Math.sin(Math.min(1, 1 - s.rearT / REAR) * Math.PI);
    const perfect = k > 0.85;
    s.touched = true;
    s.ring.visible = false;
    this.luckCount++;
    const at = this.v1.copy(s.d.root.position).setY(2.4);
    if (perfect) {
      this.perfects++;
      audio.perfect();
      toast(FERRERIES.hints.perfect);
      this.fx.burst(at, '✨', 10, 3.5, 1.4);
      vibrate([20, 30, 20]);
    } else {
      audio.luck();
      toast(k < 0.4 ? FERRERIES.hints.late : FERRERIES.hints.luck);
      vibrate(25);
    }
    this.fx.burst(at, '🍀', perfect ? 12 : 8);
    audio.cheer(perfect ? 0.45 : 0.3);
    if (this.luckCount === 3) setTimeout(() => toast(FERRERIES.hints.allLuck), 1200);
    this.checkCollectDone();
  }

  update(dt: number) {
    this.t += dt;
    const ending = this.stage === 'ending' || this.stage === 'done';
    animateCrowd(this.world.crowds, this.t, ending ? 1.7 : 1);
    this.fx.update(dt);
    (this.world.lights.material as THREE.PointsMaterial).size = 0.9 + Math.sin(this.t * 3) * 0.08;
    // Guirnaldas de los bares que cambian de color con la música
    this.hue += dt * 0.35;
    for (let i = 0; i < this.partyColors.length / 3; i++) {
      this.tmpC.setHSL((this.hue + i * 0.13) % 1, 0.95, 0.55 + 0.15 * Math.sin(this.t * 8 + i));
      this.partyColors[i * 3] = this.tmpC.r;
      this.partyColors[i * 3 + 1] = this.tmpC.g;
      this.partyColors[i * 3 + 2] = this.tmpC.b;
    }
    this.world.partyLights.geometry.attributes.color.needsUpdate = true;
    // Notas musicales saliendo de los bares cercanos
    this.noteT -= dt;
    if (this.noteT <= 0) {
      this.noteT = 0.35;
      for (const b of this.world.bars) {
        if (b.distanceTo(this.player.root.position) < 22) this.fx.burst(this.v1.copy(b).setY(2.8).setX(b.x + (Math.random() - 0.5) * 4), Math.random() < 0.5 ? '🎵' : '🎶', 1, 0.8, 0.5);
      }
    }
    this.fireworks.update(dt);
    if (this.stage === 'collect' || this.stage === 'returnTofol' || this.stage === 'findMarc') this.playTime += dt;

    const pp = this.player.root.position;
    this.walker.turn(this.input.consumeCam());
    const ax = this.busy || ending || this.stage === 'kiss' ? { x: 0, y: 0 } : this.input.axes();
    // Obstáculos redondos: el público y los ases (dos círculos a lo largo del cuerpo)
    this.solids.length = this.world.people.length;
    let k = this.solids.length;
    for (const s of this.donkeys) {
      const r = s.d.root;
      const fx = Math.sin(r.rotation.y);
      const fz = Math.cos(r.rotation.y);
      for (const o of [0.55, -0.5]) this.solids[k++] = { x: r.position.x + fx * o, z: r.position.z + fz * o, r: 0.5 };
    }
    const move = this.walker.move(dt, ax, this.world.colliders, this.world.bounds, this.solids);
    this.invuln -= dt;
    this.player.root.rotation.y = this.walker.facing;
    this.player.root.visible = this.invuln <= 0 || Math.floor(this.invuln * 10) % 2 === 0;

    if (ending) animatePerson(this.player, dt, 'dance', 0, this.t * 8);
    else if (this.stage === 'kiss' || this.stage === 'kissing') animatePerson(this.player, dt, 'idle');
    else animatePerson(this.player, dt, move > 0.03 ? 'walk' : 'idle', move, this.walker.walk, this.walker);
    // Con una pomada en la mano, el brazo va un poco adelantado
    const carrying = this.pomadaCount > 0 && (this.stage === 'collect' || this.stage === 'returnTofol' || this.stage === 'findMarc');
    this.inHand.visible = carrying;
    if (carrying && !ending) this.player.armR.rotation.x = -0.7 + this.player.armR.rotation.x * 0.3;

    const dT = pp.distanceTo(this.world.tofolPos);
    const dM = pp.distanceTo(this.world.marcPos);
    animatePerson(this.tofol, dt, dT < 5 && !ending ? 'wave' : 'idle');
    if (dT < 8) this.tofol.root.rotation.y = Math.atan2(pp.x - this.world.tofolPos.x, pp.z - this.world.tofolPos.z);
    if (this.stage === 'kiss' || this.stage === 'kissing') animatePerson(this.marc, dt, 'idle');
    else animatePerson(this.marc, dt, 'dance', 0, this.t * 8 + 1);
    animatePerson(this.fabiolera, dt, 'talk');
    this.fabiolera.armR.rotation.set(-1.9, 0, 0.5); // fabiol a la boca
    this.fabiolera.armL.rotation.set(-0.6 + Math.abs(Math.sin(this.t * 9)) * 0.5, 0, -0.2); // baqueta
    if (this.stage === 'kissing') this.updateKiss(dt);

    const rearingNear = this.updateDonkeys(dt);

    // Pomadas
    if (this.stage === 'collect') {
      for (const p of this.pomadas) {
        if (p.taken) continue;
        p.mesh.visible = true;
        p.mesh.rotation.y += dt * 2;
        p.mesh.position.y = p.home.y + Math.sin(this.t * 3) * 0.08;
        this.v1.copy(p.home).setY(0);
        if (this.v1.distanceTo(this.v2.copy(pp).setY(0)) < 1.9) {
          p.taken = true;
          p.mesh.visible = false;
          this.pomadaCount++;
          audio.pickup();
          vibrate(20);
          toast(FERRERIES.hints.pomada);
          this.fx.burst(this.v1.copy(p.home), '✨', 8);
          this.checkCollectDone();
        }
      }
    }

    // Acción contextual
    this.pendingAction = null;
    let label: string | null = null;
    let pulse = false;
    if (!this.busy && !ending) {
      if (this.stage === 'collect' && rearingNear) {
        label = FERRERIES.hints.rear;
        pulse = true;
        const s = rearingNear;
        this.pendingAction = () => this.touchDonkey(s);
      } else if (dT < 3.5) {
        label = 'Hablar';
        this.pendingAction = () => this.talkTofol();
      } else if (this.stage === 'kiss') {
        label = '💋 Darle un beso';
        pulse = true;
        this.pendingAction = () => this.startKiss();
      } else if (dM < 3.5) {
        label = this.stage === 'findMarc' ? 'Darle la pomada' : 'Hablar';
        this.pendingAction = () => this.talkMarc();
      }
    }
    this.hud.setAction(label, pulse);
    if (this.input.consumeAction() && this.pendingAction) this.pendingAction();

    // Marcador de objetivo
    const tgt = this.target();
    this.marker.visible = !!tgt && !this.busy;
    if (tgt) {
      this.marker.position.set(tgt.x, (tgt.y > 0.5 ? tgt.y + 1.0 : 3.9) + Math.sin(this.t * 3) * 0.18, tgt.z);
      this.marker.rotation.y += dt * 2;
      const ang = Math.atan2(tgt.x - pp.x, tgt.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
      this.hud.setArrow(pp.distanceTo(tgt) < 3 ? null : -rel);
    } else this.hud.setArrow(null);

    // Final: la pareja baila, confeti y la cámara gira alrededor
    if (this.stage === 'ending') {
      this.endingT += dt;
      this.walker.yaw += dt * 0.5;
      if (Math.random() < dt * 6) this.fx.burst(this.v1.copy(pp).lerp(this.world.marcPos, 0.5).setY(2.4), '❤️', 2, 1.5);
      if (Math.random() < dt * 1.8) this.fireworks.burst(this.v2.set(-14 + Math.random() * 28, 20 + Math.random() * 8, 34 + Math.random() * 10));
      if (this.endingT > 8) {
        this.stage = 'done';
        this.confetti.active = false;
        audio.ambience(0);
        const stars = 1 + (this.hits <= 2 ? 1 : 0) + (this.perfects >= 2 ? 1 : 0);
        this.onComplete({
          stars,
          stats: [
            ['Toques perfectos', `${this.perfects}/3`],
            ['Empujones de ases', `${this.hits}`],
            ['Tiempo', clock(this.playTime)],
          ],
        });
      }
    }
    if (this.confetti.mesh.visible) this.confetti.update(dt, this.world.marcPos, this.t);

    const intro = this.stage === 'intro';
    const close = this.stage === 'kiss' || this.stage === 'kissing';
    this.walker.camera(this.camera, intro ? dt * 0.35 : dt, this.world.colliders, close ? 3.6 : ending ? 6.5 : intro ? 11 : 7.5, close ? 2.3 : ending ? 4.2 : intro ? 6 : 3.8);
    this.world.sun.follow(pp);
    this.world.sky.update(this.camera, dt);
  }

  private checkCollectDone() {
    if (this.pomadaCount >= 3 && this.luckCount >= 3) {
      this.stage = 'returnTofol';
      this.pomadas.forEach((p) => (p.mesh.visible = false));
      this.donkeys.forEach((d) => (d.ring.visible = false));
      audio.fanfare();
    }
    this.updateHud();
  }

  private talkTofol() {
    this.busy = true;
    this.input.reset();
    const done = (next?: Stage) => () => {
      this.busy = false;
      if (next) this.stage = next;
      this.updateHud();
    };
    if (this.stage === 'talkTofol') dialogue(FERRERIES.tofolQuest, done('collect'));
    else if (this.stage === 'collect') dialogue(FERRERIES.tofolNotYet, done());
    else if (this.stage === 'returnTofol') dialogue(FERRERIES.tofolDone, done('findMarc'));
    else dialogue([{ who: 'Tòfol', text: '¿Qué haces aquí todavía? ¡Ve a por él!' }], done());
  }

  private talkMarc() {
    this.busy = true;
    this.input.reset();
    if (this.stage !== 'findMarc') {
      dialogue([{ who: NAMES.partner, text: '¡Hola! 🙂 (Te sonríe y sigue bailando… bastante mal.)' }], () => (this.busy = false));
      return;
    }
    // Ponerse frente a frente
    const pp = this.player.root.position;
    const mp = this.world.marcPos;
    this.walker.facing = Math.atan2(mp.x - pp.x, mp.z - pp.z);
    this.marc.root.rotation.y = Math.atan2(pp.x - mp.x, pp.z - mp.z);
    dialogue(FERRERIES.marcMeet, () => {
      this.busy = false;
      this.pomadaCount = 0;
      // Se acercan: cara a cara, a un palmo, y la cámara de lado
      const dir = this.v1.subVectors(pp, mp).setY(0).normalize();
      pp.copy(mp).addScaledVector(dir, 0.95);
      this.walker.knock.set(0, 0, 0);
      this.walker.facing = Math.atan2(-dir.x, -dir.z);
      this.walker.yaw = this.walker.facing - Math.PI / 2;
      this.marc.root.rotation.y = Math.atan2(dir.x, dir.z);
      this.stage = 'kiss';
      this.updateHud();
    });
  }

  private startKiss() {
    this.stage = 'kissing';
    this.kissT = 0;
    this.busy = true;
    this.input.reset();
    audio.stopMusic();
    audio.ambience(0.04);
  }

  /** El beso: se inclinan el uno hacia el otro, corazones y fuegos artificiales. */
  private updateKiss(dt: number) {
    this.kissT += dt;
    const k = Math.min(1, this.kissT / 1.2);
    const lean = Math.sin(k * Math.PI * 0.5) * 0.22;
    for (const p of [this.player, this.marc]) {
      p.body.rotation.x = lean;
      p.head.rotation.x = lean * 0.6;
      p.armL.rotation.x = p.armR.rotation.x = -0.5 * k;
      p.eyes.scale.y = k > 0.8 ? 0.15 : 1; // ojos cerrados
    }
    this.marc.head.rotation.z = 0.15 * k;
    this.player.head.rotation.z = -0.15 * k;
    if (this.kissT > 1.2 && this.kissT - dt <= 1.2) {
      const mid = this.v1.copy(this.player.root.position).lerp(this.marc.root.position, 0.5).setY(2.5);
      this.fx.burst(mid, '❤️', 14, 3, 1.2);
      this.fx.burst(mid, '💋', 3, 1, 0.8);
      audio.fanfare();
      audio.cheer(0.7);
      vibrate([60, 40, 120]);
      for (let i = 0; i < 3; i++) this.fireworks.burst(this.v2.set(-12 + i * 12, 22 + Math.random() * 5, 38));
    }
    if (this.kissT > 3.2) {
      this.stage = 'done'; // evita que se repita mientras está el diálogo
      dialogue(FERRERIES.afterKiss, () => {
        this.busy = false;
        this.stage = 'ending';
        this.endingT = 0;
        this.confetti.mesh.visible = true;
        this.confetti.active = true;
        audio.startMusic();
        audio.ambience(0.12);
        audio.cheer(0.6);
        this.updateHud();
      });
    }
  }

  debug(): DebugItem[] {
    const tp = (x: number, z: number) => {
      this.player.root.position.set(x, 0, z);
      this.walker.knock.set(0, 0, 0);
    };
    const go = (stage: Stage, setup?: () => void) => () => {
      this.busy = false;
      this.input.reset();
      setup?.();
      this.stage = stage;
      if (stage !== 'collect') this.pomadas.forEach((p) => (p.mesh.visible = false));
      this.updateHud();
    };
    return [
      { label: '1 · Hablar con Tòfol', run: go('talkTofol', () => tp(9, 9.6)) },
      {
        label: '2 · Pomadas y ases',
        run: go('collect', () => {
          this.pomadaCount = this.luckCount = this.perfects = this.hits = 0;
          this.pomadas.forEach((p) => (p.taken = false));
          this.donkeys.forEach((d) => (d.touched = false));
          tp(0, 6);
        }),
      },
      { label: '3 · Volver a Tòfol', run: go('returnTofol', () => { this.pomadaCount = this.luckCount = 3; tp(9, 9.6); }) },
      { label: '4 · Encontrar a Marc', run: go('findMarc', () => { this.pomadaCount = 1; tp(this.world.marcPos.x + 2.2, this.world.marcPos.z - 1.4); }) },
      {
        label: '5 · Ver el final',
        run: () => {
          go('findMarc', () => { this.pomadaCount = 1; tp(this.world.marcPos.x + 2.2, this.world.marcPos.z - 1.4); })();
          this.talkMarc();
        },
      },
      {
        label: '✓ Completar capítulo',
        run: () => {
          this.stage = 'done';
          this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] });
        },
      },
    ];
  }

  dispose() {
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
