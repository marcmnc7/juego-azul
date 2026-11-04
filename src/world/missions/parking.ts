import * as THREE from 'three';
import { audio } from '../../core/audio';
import { Sky, Sun, toon, glowTexture } from '../../core/gfx';
import { Walker } from '../../core/walker';
import { steerTo, type SteerState } from '../../core/steer';
import { beacon } from '../../core/beacon';
import { stage, type Mission, type MissionCtx } from '../../core/stage';
import { MARGAUX_LOOK, MARC_LOOK } from '../../data/characters';
import { MINIS } from '../../data/story';
import { G, Merger, makePerson, animatePerson, type Person } from '../../entities/models';
import { motoFleet } from '../../entities/vehiclesHD';
import { makeHelmet } from '../../entities/helmet';
import { hud, toast, missionCard, type Hud } from '../../ui/ui';
import { canvasTex } from '../deco';
import { disposeScene } from '../level';
import type { Box2 } from '../ferreries';

// Misión del capítulo 8: 2 de agosto, de noche, en el aparcamiento del aeropuerto. Gas no sabe dónde
// dejó la moto. Azul va con la linterna del móvil entre las filas de motos y mira una a una; la de Gas es
// negra y tiene su casco rojo encima. Si cuesta, Gas se va acordando (y al final, la columna de luz).

const ROWS = [-7.5, -2.5, 2.5, 7.5];
const BAYS = 9;
const BAY = 1.55;
const BOUNDS: Box2 = { minX: -15.5, maxX: 15.5, minZ: -10.5, maxZ: 10.5 };
const COLORS = [0xc23030, 0x1f3a6b, 0xe0e0e0, 0x2f6b46, 0xd9a020, 0x7a3fa0, 0x8a8e94, 0xe86a2a, 0x2a2c30];

interface Bay {
  x: number;
  z: number;
  gas: boolean;
  checked: boolean;
}

class ParkingMission implements Mission {
  readonly scene = new THREE.Scene();
  private hud: Hud;
  private player: Person;
  private gas: Person;
  private walker: Walker;
  private gasSteer: SteerState = {};
  private colliders: Box2[] = [];
  private bays: Bay[] = [];
  private sky: Sky;
  private sun: Sun;
  private spot: THREE.SpotLight;
  private wrong = 0;
  private found = false;
  private endT = -1;
  private t = 0;

  constructor(private ctx: MissionCtx, private onDone: () => void) {
    const sc = this.scene;
    const T = MINIS.moto;
    sc.fog = new THREE.Fog(0x0b1224, 10, 60);
    this.sky = new Sky({ top: 0x050a1c, mid: 0x14204a, bottom: 0x2a2a4a, stars: 700 });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0x5a6a9a, 0x14141c, 0.55));
    this.sun = new Sun(sc, 0x8fa4d8, 0.35, new THREE.Vector3(-0.4, 1, 0.3), 24); // la luna

    // Asfalto con las plazas pintadas
    const asphalt = canvasTex((c, w, h) => {
      c.fillStyle = '#2b2c31';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const v = 30 + Math.random() * 40;
        c.fillStyle = `rgba(${v},${v},${v + 4},.5)`;
        c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, 256, 256);
    asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
    asphalt.repeat.set(14, 10);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70).rotateX(-Math.PI / 2), toon({ map: asphalt, roughness: 0.95 }));
    ground.userData.noCast = true;
    sc.add(ground);
    const m = new Merger();
    for (const z of ROWS) {
      for (let i = 0; i <= BAYS; i++) m.add(G.box, 0xe8e6dc, -BAYS * BAY / 2 + i * BAY, 0.01, z, 0, 0, 0, 0.08, 0.01, 2.4);
      m.add(G.box, 0xe8e6dc, 0, 0.01, z + (z > 0 ? 1.2 : -1.2), 0, 0, 0, BAYS * BAY, 0.01, 0.08);
    }
    // Bordillo y seto alrededor, farolas de luz naranja y la terminal iluminada al fondo
    for (const [x, z, w, d] of [[0, -11, 34, 0.4], [0, 11, 34, 0.4], [-16, 0, 0.4, 22], [16, 0, 0.4, 22]] as const) {
      m.add(G.box, 0xb8b4a8, x, 0.08, z, 0, 0, 0, w, 0.16, d);
      m.add(G.box, 0x24402a, x, 0.6, z + (z > 0 ? 0.5 : z < 0 ? -0.5 : 0), 0, 0, 0, w, 0.9, d + 0.6);
    }
    for (const [x, z] of [[-12, -5], [12, -5], [-12, 5], [12, 5], [0, 0]] as const) {
      m.add(G.cyl, 0x5a5e66, x, 3, z, 0, 0, 0, 0.14, 6, 0.14);
      m.add(G.box, 0x3a3e46, x, 6, z, 0, 0, 0, 0.7, 0.18, 0.35);
      const l = new THREE.PointLight(0xffb060, 16, 15, 1.4);
      l.position.set(x, 5.7, z);
      sc.add(l);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.set(x, 5.85, z);
      glow.scale.setScalar(2.4);
      sc.add(glow);
      this.colliders.push({ minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2 });
    }
    m.add(G.box, 0x3a4256, 0, 4, 34, 0, 0, 0, 60, 8, 8);
    for (let i = 0; i < 18; i++) m.add(G.box, 0xffd890, -27 + i * 3.2, 4, 29.9, 0, 0, 0, 2.2, 3.2, 0.05);
    sc.add(m.mesh());
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), new THREE.MeshBasicMaterial({ map: canvasTex((c, w, h) => {
      c.fillStyle = '#1b2a4a';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffd23f';
      c.font = 'bold 64px Arial, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('AEROPORT DE MENORCA', w / 2, h / 2);
    }, 1024, 128) }));
    sign.position.set(0, 9, 29.95);
    sign.rotation.y = Math.PI;
    sc.add(sign);

    // Las motos: la de Gas, negra con su casco rojo, en una plaza al azar de las filas del fondo
    const free: Bay[] = [];
    for (const z of ROWS) for (let i = 0; i < BAYS; i++) free.push({ x: -BAYS * BAY / 2 + (i + 0.5) * BAY, z, gas: false, checked: false });
    const taken = free.filter((_, i) => i % 7 !== 3 && i % 5 !== 1);
    const gasBay = taken.filter((b) => b.z > 0)[Math.floor(Math.random() * taken.filter((b) => b.z > 0).length)];
    gasBay.gas = true;
    this.bays = taken;
    sc.add(motoFleet(taken.map((b, i) => ({ x: b.x, z: b.z, ry: b.z > 0 ? Math.PI : 0, color: b.gas ? 0x1b1d22 : COLORS[(i * 5) % COLORS.length] }))));
    for (const b of taken) this.colliders.push({ minX: b.x - 0.42, maxX: b.x + 0.42, minZ: b.z - 1.15, maxZ: b.z + 1.15 });
    const helmet = makeHelmet({ color: 0xb02a2a, stripe: 0xf2f2ee });
    helmet.position.set(gasBay.x, 1.07, gasBay.z + 0.35);
    helmet.rotation.set(0.25, 0.6, 0.1);
    sc.add(helmet);

    // Azul con el móvil en alto haciendo de linterna; Gas detrás, rascándose la cabeza
    this.player = makePerson(MARGAUX_LOOK);
    this.player.root.position.set(-14, 0, 0);
    this.gas = makePerson(MARC_LOOK);
    this.gas.root.position.set(-15, 0, 0.8);
    sc.add(this.player.root, this.gas.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.yaw = this.walker.facing = Math.PI / 2;
    this.spot = new THREE.SpotLight(0xfff0d8, 40, 13, 0.55, 0.6, 1.3);
    this.spot.position.set(0, 1.35, 0.25);
    this.spot.target.position.set(0, 0.2, 4);
    this.player.root.add(this.spot, this.spot.target);
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.01), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xdfe8ff, emissiveIntensity: 0.6 }));
    phone.rotation.x = -Math.PI / 2;
    this.player.handR.add(phone);

    this.hud = hud(() => ctx.input.queueAction(), () => {}, 'Arrastra a la izquierda para andar · a la derecha para girar la cámara', true);
    this.hud.setObjective(T.goal);
    this.updateHud();
    const p = this.player.root.position;
    ctx.camera.position.set(p.x - 5, 3, p.z);
    missionCard(T.title, T.goal);
    audio.ambience(0.15);
  }

  private updateHud() {
    this.hud.setCounters(`<span class="chip">🔦 ${this.bays.filter((b) => b.checked).length}</span>`);
  }

  /** La moto que tiene delante (desde el pasillo, el centro de una moto queda a metro y medio largo). */
  private nearBay() {
    const p = this.player.root.position;
    const f = this.walker.facing;
    let best: Bay | null = null;
    let bd = Infinity;
    for (const b of this.bays) {
      if (b.checked) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d > 2.1) continue;
      // Mejor la que queda en la dirección en la que mira
      const a = Math.atan2(b.x - p.x, b.z - p.z) - f;
      const score = d + (1 - Math.cos(Math.atan2(Math.sin(a), Math.cos(a)))) * 0.8;
      if (score < bd) {
        bd = score;
        best = b;
      }
    }
    return best;
  }

  private check(b: Bay) {
    const T = MINIS.moto;
    b.checked = true;
    if (b.gas) {
      this.found = true;
      this.endT = 0;
      beacon.at(null);
      toast(T.found);
      missionCard(T.title, '', true);
      return;
    }
    this.wrong++;
    audio.boo();
    toast(this.wrong === 3 ? T.hint1 : this.wrong === 5 ? T.hint2 : T.nope);
    if (this.wrong >= 5) {
      const g = this.bays.find((x) => x.gas)!;
      beacon.at(new THREE.Vector3(g.x, 0, g.z));
    }
    this.updateHud();
  }

  update(dt: number) {
    this.t += dt;
    const { input, camera } = this.ctx;
    const free = !this.found;
    this.walker.turn(input.consumeCam());
    const mag = this.walker.move(dt, free ? input.axes() : { x: 0, y: 0 }, this.colliders, BOUNDS);
    const p = this.player.root.position;
    this.player.root.rotation.y = this.walker.facing;
    animatePerson(this.player, dt, mag > 0.03 ? 'walk' : 'idle', mag, this.walker.walk, this.walker); // (encontrarla no es para ponerse a bailar)
    if (!this.found) {
      // El brazo con el móvil, delante, alumbrando
      this.player.armR.rotation.x = -1.25;
      this.player.elbowR.rotation.x = -0.3;
    }
    // Gas va detrás, a un par de pasos
    const g = this.gas.root.position;
    const back = new THREE.Vector3(p.x - Math.sin(this.walker.facing) * 1.4, 0, p.z - Math.cos(this.walker.facing) * 1.4);
    const far = g.distanceTo(back) > 0.4;
    if (far) steerTo(this.gas.root, this.gasSteer, back.x, back.z, 3.2, dt, [{ x: p.x, z: p.z, r: 0.4 }]);
    animatePerson(this.gas, dt, far ? 'walk' : 'idle');
    if (!far && !this.found) this.gas.root.rotation.y = Math.atan2(p.x - g.x, p.z - g.z);

    const b = free ? this.nearBay() : null;
    this.hud.setAction(b ? MINIS.moto.check : null, !!b);
    if (input.consumeAction() && b) this.check(b);

    if (this.endT >= 0) {
      this.endT += dt;
      if (this.endT > 2.4) {
        const done = this.onDone;
        stage.end();
        done();
        return;
      }
    }
    this.walker.camera(camera, dt, this.colliders, 5.2, 2.8);
    this.sky.update(camera, dt);
    this.sun.follow(p);
  }

  dispose() {
    this.hud.remove();
    beacon.at(null);
    audio.ambience(0);
    disposeScene(this.scene);
  }
}

/** 2 de agosto: buscar la moto de Gas en el aparcamiento del aeropuerto, con la linterna del móvil. */
export function parkingMission(onDone: () => void) {
  stage.start((ctx) => new ParkingMission(ctx, onDone));
}
