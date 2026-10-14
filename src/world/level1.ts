import * as THREE from 'three';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { FERRERIES, NAMES } from '../data/story';
import { buildFerreries, animateCrowd, FerreriesWorld, Box2 } from './ferreries';
import { makePerson, makeDonkey, Person, Donkey, Merger, G } from '../entities/models';
import { Particles } from '../entities/fx';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { hud, dialogue, toast, Hud, DebugItem } from '../ui/ui';
import type { Level } from './level';

// Nivel 1 · Jaleo d'ases (Ferreries).
// Bucle: hablar con Tòfol → 3 pomadas + 3 toques de suerte esquivando ases → volver a Tòfol → encontrar a Marc → bailar → regalo.

type Stage = 'intro' | 'talkTofol' | 'collect' | 'returnTofol' | 'findMarc' | 'ending' | 'done';

const PLAYER_R = 0.4;
const SPEED = 5.5;

interface DonkeyState {
  d: Donkey;
  mode: 'circle' | 'street';
  angle: number; // para el círculo
  dir: number; // para la calle
  rearT: number; // tiempo restante encabritado
  nextRear: number;
  touched: boolean;
  walkPhase: number;
}

interface Pomada {
  mesh: THREE.Object3D;
  home: THREE.Vector3;
  taken: boolean;
}


export class Level1 implements Level {
  private scene = new THREE.Scene();
  private world: FerreriesWorld;
  private player: Person;
  private tofol: Person;
  private marc: Person;
  private donkeys: DonkeyState[] = [];
  private pomadas: Pomada[] = [];
  private fx: Particles;
  private marker: THREE.Mesh;
  private hud: Hud;
  private stage: Stage = 'intro';
  private pomadaCount = 0;
  private luckCount = 0;
  private yaw = 0; // dirección de la cámara
  private facing = 0;
  private walk = 0;
  private knock = new THREE.Vector3();
  private invuln = 0;
  private t = 0;
  private busy = false; // diálogo abierto
  private endingT = 0;
  private pendingAction: (() => void) | null = null;

  // temporales reutilizables
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: () => void,
    onMenu: () => void,
  ) {
    this.world = buildFerreries(this.scene);
    this.fx = new Particles(this.scene);

    this.player = makePerson(MARGAUX_LOOK);
    this.player.root.position.copy(this.world.spawn);
    this.facing = Math.PI / 2;
    this.yaw = Math.PI / 2;
    this.scene.add(this.player.root);

    this.tofol = makePerson({ skin: 0xd9a27c, shirt: 0xffffff, pants: 0x222222, hair: 0x888888, hairStyle: 'short' });
    this.tofol.root.position.copy(this.world.tofolPos);
    this.tofol.root.rotation.y = 0;
    // Delantal de Tòfol
    this.tofol.body.add(new Merger().add(G.box, 0x2a7a50, 0, 0.95, 0.2, 0, 0, 0, 0.5, 0.6, 0.05).mesh());
    this.scene.add(this.tofol.root);

    this.marc = makePerson(MARC_LOOK);
    this.marc.root.position.copy(this.world.marcPos);
    this.marc.root.rotation.y = Math.PI;
    this.scene.add(this.marc.root);
    for (const p of [this.world.tofolPos, this.world.marcPos]) {
      this.world.colliders.push({ minX: p.x - 0.35, maxX: p.x + 0.35, minZ: p.z - 0.35, maxZ: p.z + 0.35 });
    }

    // Ases: 3 dando vueltas en la plaza y 1 paseando por la calle
    const coats = [0x7d6b5d, 0x5e4f45, 0x8f8379, 0x6d5a4a];
    for (let i = 0; i < 4; i++) {
      const d = makeDonkey(coats[i]);
      this.scene.add(d.root);
      this.donkeys.push({
        d,
        mode: i < 3 ? 'circle' : 'street',
        angle: (i / 3) * Math.PI * 2,
        dir: 1,
        rearT: 0,
        nextRear: 2 + i * 1.7,
        touched: false,
        walkPhase: i,
      });
      if (i === 3) d.root.position.set(-20, 0, 0);
    }

    // Pomadas: vaso con limonada y rodaja de limón
    const glassGeo = new Merger()
      .add(new THREE.CylinderGeometry(0.16, 0.12, 0.38, 10), 0xfff4b0, 0, 0.19, 0)
      .add(G.cyl, 0xf9e04b, 0.1, 0.4, 0, 0, 0, Math.PI / 2, 0.18, 0.03, 0.18)
      .add(G.cyl, 0xffffff, -0.05, 0.42, 0, 0.3, 0, 0.2, 0.03, 0.35, 0.03)
      .build();
    for (const home of this.world.pomadaSpots) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(glassGeo, new THREE.MeshBasicMaterial({ color: 0xfff1a0 })));
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.6, depthWrite: false }));
      glow.position.y = 0.02;
      g.add(glow);
      g.position.copy(home);
      g.visible = false;
      this.scene.add(g);
      this.pomadas.push({ mesh: g, home: home.clone(), taken: false });
    }

    this.marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    this.scene.add(this.marker);

    this.hud = hud(() => this.input.queueAction(), onMenu);
    this.updateHud();

    this.camera.position.set(-44, 4, 0);
    this.busy = true;
    setTimeout(() => {
      dialogue(FERRERIES.intro, () => {
        this.busy = false;
        this.stage = 'talkTofol';
        this.updateHud();
      });
    }, 600);
    audio.startMusic();
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
        h.setObjective(
          this.pomadaCount < 3 ? 'Consigue pomadas en los bares y toca a los ases cuando se pongan de manos' : 'Toca a los ases de la plaza cuando se pongan de manos',
        );
        if (this.luckCount >= 3) h.setObjective('Recoge las pomadas que faltan en los bares');
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

  private collide(p: THREE.Vector3, boxes: Box2[], b: Box2) {
    for (const c of boxes) {
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < PLAYER_R * PLAYER_R) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * PLAYER_R;
          p.z = cz + (dz / d) * PLAYER_R;
        } else {
          // dentro de la caja: salir por el lado más cercano
          const opts = [p.x - c.minX, c.maxX - p.x, p.z - c.minZ, c.maxZ - p.z];
          const i = opts.indexOf(Math.min(...opts));
          if (i === 0) p.x = c.minX - PLAYER_R;
          else if (i === 1) p.x = c.maxX + PLAYER_R;
          else if (i === 2) p.z = c.minZ - PLAYER_R;
          else p.z = c.maxZ + PLAYER_R;
        }
      }
    }
    p.x = Math.max(b.minX, Math.min(b.maxX, p.x));
    p.z = Math.max(b.minZ, Math.min(b.maxZ, p.z));
  }

  private animatePerson(p: Person, speed01: number, phase: number, dance = false) {
    const s = Math.sin(phase);
    if (dance) {
      p.body.position.y = Math.abs(Math.sin(phase * 0.5)) * 0.3;
      p.armL.rotation.z = -2.4 + Math.sin(phase) * 0.4;
      p.armR.rotation.z = 2.4 - Math.sin(phase) * 0.4;
      p.legL.rotation.x = s * 0.3;
      p.legR.rotation.x = -s * 0.3;
      return;
    }
    p.body.position.y = Math.abs(s) * 0.08 * speed01;
    p.legL.rotation.x = s * 0.7 * speed01;
    p.legR.rotation.x = -s * 0.7 * speed01;
    p.armL.rotation.x = -s * 0.6 * speed01;
    p.armR.rotation.x = s * 0.6 * speed01;
    p.armL.rotation.z = -0.1;
    p.armR.rotation.z = 0.1;
  }

  private updateDonkeys(dt: number) {
    const pp = this.player.root.position;
    let rearingNear: DonkeyState | null = null;
    for (const s of this.donkeys) {
      const r = s.d.root;
      if (s.rearT > 0) {
        s.rearT -= dt;
        const k = Math.sin(Math.min(1, (1.8 - s.rearT) / 1.8) * Math.PI);
        s.d.pivot.rotation.x = -k * 0.75;
        s.d.legs[0].rotation.x = s.d.legs[1].rotation.x = -k * 1.1 + Math.sin(this.t * 14) * 0.3 * k;
        if (s.rearT <= 0) {
          s.d.pivot.rotation.x = 0;
          s.nextRear = 3 + Math.random() * 4;
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
        s.nextRear -= dt;
        // En la calle se encabrita menos; en la plaza más cuando estás cerca
        const close = r.position.distanceTo(pp) < 7;
        if (s.nextRear <= 0 && (s.mode === 'circle' || close)) s.rearT = 1.8;
      }

      const dist = r.position.distanceTo(pp);
      if (s.rearT > 0.2 && dist < 3.2 && !s.touched) rearingNear = s;

      // Choque: el ase te empuja (solo si no está de manos)
      if (s.rearT <= 0 && dist < 1.3 && this.invuln <= 0 && !this.busy) {
        this.v1.subVectors(pp, r.position).setY(0).normalize().multiplyScalar(9);
        this.knock.copy(this.v1);
        this.invuln = 1.5;
        audio.hit();
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

  update(dt: number) {
    this.t += dt;
    animateCrowd(this.world.crowds, this.t);
    this.fx.update(dt);

    const pp = this.player.root.position;
    // Movimiento relativo a la cámara
    this.yaw -= this.input.consumeCam();
    const ax = this.busy || this.stage === 'ending' ? { x: 0, y: 0 } : this.input.axes();
    const mag = Math.min(1, Math.hypot(ax.x, ax.y));
    if (mag > 0.1) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      // adelante = (fx, fz); derecha = (-fz, fx)
      const mx = fx * ax.y - fz * ax.x;
      const mz = fz * ax.y + fx * ax.x;
      const len = Math.hypot(mx, mz) || 1;
      pp.x += (mx / len) * SPEED * mag * dt;
      pp.z += (mz / len) * SPEED * mag * dt;
      const targetFacing = Math.atan2(mx, mz);
      let diff = targetFacing - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facing += diff * Math.min(1, dt * 12);
      this.walk += dt * 11 * mag;
    }
    if (this.knock.lengthSq() > 0.01) {
      pp.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 6));
    }
    this.collide(pp, this.world.colliders, this.world.bounds);
    this.invuln -= dt;
    this.player.root.rotation.y = this.facing;
    this.player.root.visible = this.invuln <= 0 || Math.floor(this.invuln * 10) % 2 === 0;

    if (this.stage === 'ending') this.animatePerson(this.player, 0, this.t * 8, true);
    else this.animatePerson(this.player, mag, this.walk);
    this.animatePerson(this.tofol, 0, this.t * 2);
    this.tofol.body.rotation.y = Math.sin(this.t * 0.7) * 0.3;
    this.animatePerson(this.marc, 0, this.t * 8 + 1, true);

    const rearingNear = this.updateDonkeys(dt);

    // Pomadas
    if (this.stage === 'collect') {
      for (const p of this.pomadas) {
        if (p.taken) continue;
        p.mesh.visible = true;
        p.mesh.rotation.y += dt * 2;
        p.mesh.position.y = p.home.y + Math.sin(this.t * 3) * 0.08;
        this.v1.copy(p.home).setY(0);
        if (this.v1.distanceTo(this.v2.copy(pp).setY(0)) < 1.6) {
          p.taken = true;
          p.mesh.visible = false;
          this.pomadaCount++;
          audio.pickup();
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
    if (!this.busy && this.stage !== 'ending' && this.stage !== 'done') {
      const dT = pp.distanceTo(this.world.tofolPos);
      const dM = pp.distanceTo(this.world.marcPos);
      if (this.stage === 'collect' && rearingNear) {
        label = FERRERIES.hints.rear;
        pulse = true;
        const s = rearingNear;
        this.pendingAction = () => {
          s.touched = true;
          this.luckCount++;
          audio.luck();
          toast(FERRERIES.hints.luck);
          this.fx.burst(this.v1.copy(s.d.root.position).setY(2), '🍀', 10);
          this.checkCollectDone();
        };
      } else if (dT < 3.5) {
        label = 'Hablar';
        this.pendingAction = () => this.talkTofol();
      } else if (dM < 3.5) {
        label = 'Hablar';
        this.pendingAction = () => this.talkMarc();
      }
    }
    this.hud.setAction(label, pulse);
    if (this.input.consumeAction() && this.pendingAction) this.pendingAction();

    // Marcador de objetivo
    const tgt = this.target();
    this.marker.visible = !!tgt && !this.busy;
    if (tgt) {
      this.marker.position.set(tgt.x, (tgt.y > 0.5 ? tgt.y + 0.9 : 3.9) + Math.sin(this.t * 3) * 0.15, tgt.z);
      this.marker.rotation.y += dt * 2;
      const ang = Math.atan2(tgt.x - pp.x, tgt.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.yaw), Math.cos(ang - this.yaw));
      this.hud.setArrow(pp.distanceTo(tgt) < 3 ? null : -rel);
    } else this.hud.setArrow(null);

    // Final: cámara que gira alrededor de la pareja
    if (this.stage === 'ending') {
      this.endingT += dt;
      this.yaw += dt * 0.6;
      if (Math.random() < dt * 6) this.fx.burst(this.v1.copy(pp).lerp(this.world.marcPos, 0.5).setY(2.2), '❤️', 2, 1.5);
      if (this.endingT > 5 && this.stage === 'ending') {
        this.stage = 'done';
        this.onComplete();
      }
    }

    this.updateCamera(dt);
  }

  private checkCollectDone() {
    if (this.pomadaCount >= 3 && this.luckCount >= 3) {
      this.stage = 'returnTofol';
      this.pomadas.forEach((p) => (p.mesh.visible = false));
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
    this.facing = Math.atan2(mp.x - pp.x, mp.z - pp.z);
    this.marc.root.rotation.y = Math.atan2(pp.x - mp.x, pp.z - mp.z);
    dialogue(FERRERIES.marcMeet, () => {
      this.busy = false;
      this.stage = 'ending';
      this.endingT = 0;
      audio.fanfare();
      this.updateHud();
    });
  }

  private updateCamera(dt: number) {
    const pp = this.player.root.position;
    const dist = this.stage === 'ending' ? 6.5 : 7.5;
    const h = this.stage === 'ending' ? 4.6 : 4;
    // Acercar la cámara si una casa se interpone
    const sx = -Math.sin(this.yaw);
    const sz = -Math.cos(this.yaw);
    let d = 1;
    for (; d < dist; d += 0.25) {
      const x = pp.x + sx * d;
      const z = pp.z + sz * d;
      if (this.world.colliders.some((c) => c.maxX - c.minX > 2 && c.maxZ - c.minZ > 2 && x > c.minX - 0.3 && x < c.maxX + 0.3 && z > c.minZ - 0.3 && z < c.maxZ + 0.3)) break;
    }
    this.camPos.set(pp.x + sx * d, h + (dist - d) * 0.35, pp.z + sz * d);
    const k = 1 - Math.exp(-dt * 6);
    this.camera.position.lerp(this.camPos, k);
    this.camLook.set(pp.x, 1.4, pp.z);
    this.camera.lookAt(this.camLook);
  }

  debug(): DebugItem[] {
    const tp = (x: number, z: number) => {
      this.player.root.position.set(x, 0, z);
      this.knock.set(0, 0, 0);
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
          this.pomadaCount = this.luckCount = 0;
          this.pomadas.forEach((p) => (p.taken = false));
          this.donkeys.forEach((d) => (d.touched = false));
          tp(0, 6);
        }),
      },
      { label: '3 · Volver a Tòfol', run: go('returnTofol', () => { this.pomadaCount = this.luckCount = 3; tp(9, 9.6); }) },
      { label: '4 · Encontrar a Marc', run: go('findMarc', () => tp(1.5, 19.6)) },
      {
        label: '5 · Ver el final',
        run: () => {
          go('findMarc', () => tp(1.5, 19.6))();
          this.talkMarc();
        },
      },
      {
        label: '✓ Completar capítulo',
        run: () => {
          this.stage = 'done';
          this.onComplete();
        },
      },
    ];
  }

  dispose() {
    this.hud.remove();
    audio.stopMusic();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
