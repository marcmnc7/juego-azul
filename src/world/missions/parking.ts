import * as THREE from 'three';
import { audio } from '../../core/audio';
import { Sky, Sun, toon, paintMat } from '../../core/gfx';
import { Surf } from '../../core/surfaces';
import { comicHaloTexture } from '../../core/comicTiles';
import { Lost } from '../../core/lost';
import { Walker } from '../../core/walker';
import { steerTo, type SteerState } from '../../core/steer';
import { beacon } from '../../core/beacon';
import { stage, type Mission, type MissionCtx } from '../../core/stage';
import { MARGAUX_LOOK, MARC_LOOK } from '../../data/characters';
import { MINIS } from '../../data/story';
import { G, Merger, makePerson, animatePerson, type Person } from '../../entities/models';
import { motoFleet } from '../../entities/vehiclesHD';
import { makeHelmet } from '../../entities/helmet';
import { hud, bark, comicWord, missionCard, type Hud } from '../../ui/ui';
import { canvasTex } from '../deco';
import { disposeScene } from '../level';
import type { Box2 } from '../ferreries';

// Misión del capítulo 8: 2 de agosto en el aparcamiento de motos del aeropuerto. Gas no sabe dónde dejó la moto.
// Azul va entre las filas y mira una a una; la de Gas es negra y tiene su casco rojo encima (y hay otras negras y
// otros cascos, para que no sea a la primera). Si cuesta, Gas se va acordando; la columna de luz, solo si se lleva
// 40 s sin mirar ninguna (Lost).
//
// La hora: el chat es de las 17:48 (chats.ts, motoPerdida), así que es de día, con el sol de la tarde por el
// oeste-suroeste. La versión de noche (con la linterna del móvil) se queda detrás de NIGHT, por si el dueño la
// prefiere: como las noches del cap. 2 (perfil `noche`, hemiScale 0,32, luna azulada con sombras, sin luces de punto).
const NIGHT = false;

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
  private lost = new Lost();
  private wrong = 0;
  private found = false;
  private endT = -1;
  private t = 0;

  constructor(private ctx: MissionCtx, private onDone: () => void) {
    const sc = this.scene;
    const T = MINIS.moto;
    if (NIGHT) {
      sc.userData.comicLook = 'noche';
      sc.userData.hemiScale = 0.32;
      sc.fog = new THREE.Fog(0x1a2347, 30, 130);
      this.sky = new Sky({ top: 0x0a1440, mid: 0x1a2a66, bottom: 0x34437a, stars: 900 });
      sc.add(new THREE.HemisphereLight(0x6f7fc0, 0x1a2030, 1.1));
      this.sun = new Sun(sc, 0xb8c8ff, 2.0, new THREE.Vector3(-0.4, 1, 0.3), 24); // la luna
      this.sun.light.shadow.normalBias = 0.16;
      this.sun.light.shadow.bias = -0.0012;
    } else {
      // Las seis menos diez de una tarde de agosto: sol alto todavía, por el oeste-suroeste. Ambiente como el cap. 1
      sc.userData.hemiScale = 0.35;
      sc.fog = new THREE.Fog(0xd9ecf7, 70, 200);
      this.sky = new Sky({ top: 0x3f86d8, mid: 0x8ec4ee, bottom: 0xd9ecf7, clouds: { count: 7, tint: 0xffffff } });
      sc.add(new THREE.HemisphereLight(0xd8e6ff, 0x6a5a48, 1.0));
      this.sun = new Sun(sc, 0xfff1d8, 2.1, new THREE.Vector3(-0.75, 0.8, 0.35), 24);
    }
    sc.add(this.sky.group);

    // Asfalto dibujado (el de tebeo, en coordenadas del mundo) y las plazas, pintura plana a ras de suelo (con cajas
    // de 1 cm, la tinta les dibujaba dientes de sierra)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70).rotateX(-Math.PI / 2), toon({ color: 0x3a3a40, surf: Surf.Asphalt }));
    ground.userData.noCast = true;
    sc.add(ground);
    const paint = new Merger();
    const strip = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (const z of ROWS) {
      for (let i = 0; i <= BAYS; i++) paint.add(strip, 0xe8e6dc, -BAY * BAYS / 2 + i * BAY, 0.004, z, 0, 0, 0, 0.1, 1, 2.4);
      paint.add(strip, 0xe8e6dc, 0, 0.004, z + (z > 0 ? 1.2 : -1.2), 0, 0, 0, BAYS * BAY, 1, 0.1);
    }
    const lines = new THREE.Mesh(paint.build(), paintMat());
    lines.userData.noCast = true;
    sc.add(lines);
    const m = new Merger();
    // Bordillo y seto alrededor, farolas y la terminal al fondo
    for (const [x, z, w, d] of [[0, -11, 34, 0.4], [0, 11, 34, 0.4], [-16, 0, 0.4, 22], [16, 0, 0.4, 22]] as const) {
      m.add(G.box, 0xb8b4a8, x, 0.08, z, 0, 0, 0, w, 0.16, d);
      m.add(G.box, 0x24402a, x, 0.6, z + (z > 0 ? 0.5 : z < 0 ? -0.5 : 0), 0, 0, 0, w, 0.9, d + 0.6);
    }
    for (const [x, z] of [[-12, -5], [12, -5], [-12, 5], [12, 5], [0, 0]] as const) {
      m.add(G.cyl, 0x5a5e66, x, 3, z, 0, 0, 0, 0.14, 6, 0.14);
      m.add(G.box, 0x3a3e46, x, 6, z, 0, 0, 0, 0.7, 0.18, 0.35);
      // Las lámparas no iluminan nada: de noche solo se ven encendidas (luz de tebeo); de día, apagadas
      if (NIGHT) {
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: comicHaloTexture(), color: 0xffc070, transparent: true, depthWrite: false }));
        glow.material.userData.comicGlow = true;
        glow.position.set(x, 5.85, z);
        glow.scale.setScalar(1.6);
        sc.add(glow);
      }
      this.colliders.push({ minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2 });
    }
    // La terminal: de día, sus cristaleras son cristal (de noche, encendidas)
    m.add(G.box, 0x3a4256, 0, 4, 34, 0, 0, 0, 60, 8, 8);
    for (let i = 0; i < 18; i++) m.add(G.box, NIGHT ? 0xffd890 : 0x7a8fa6, -27 + i * 3.2, 4, 29.9, 0, 0, 0, 2.2, 3.2, 0.05);
    sc.add(m.mesh());
    // Rótulo de tebeo: letras planas con su tinta y borde de tinta (de día, con luz: no brilla solo)
    const signTex = canvasTex((c, w, h) => {
      c.fillStyle = '#1b2a4a';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#2b2233';
      c.lineWidth = 10;
      c.strokeRect(5, 5, w - 10, h - 10);
      c.font = 'bold 64px Arial, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 8;
      c.lineJoin = 'round';
      c.strokeText('AEROPORT DE MENORCA', w / 2, h / 2 + 2);
      c.fillStyle = '#ffd23f';
      c.fillText('AEROPORT DE MENORCA', w / 2, h / 2 + 2);
    }, 1024, 128);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), NIGHT ? new THREE.MeshBasicMaterial({ map: signTex }) : toon({ map: signTex }));
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
    const fleet = motoFleet(taken.map((b, i) => ({ x: b.x, z: b.z, ry: b.z > 0 ? Math.PI : 0, color: b.gas ? 0x1b1d22 : COLORS[(i * 5) % COLORS.length] })));
    // Aparcadas: con las luces apagadas (los faros, pilotos y el cuadro salían encendidos). Son materiales propios de
    // esta flota (motoFleet los crea cada vez), así que no se apagan las motos de otros capítulos
    fleet.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat?.emissive && mat.emissiveIntensity > 0) {
        mat.emissive.setHex(0);
        mat.emissiveIntensity = 0;
      }
    });
    sc.add(fleet);
    for (const b of taken) this.colliders.push({ minX: b.x - 0.42, maxX: b.x + 0.42, minZ: b.z - 1.15, maxZ: b.z + 1.15 });
    const helmet = makeHelmet({ color: 0xb02a2a, stripe: 0xf2f2ee });
    helmet.position.set(gasBay.x, 1.07, gasBay.z + 0.35);
    helmet.rotation.set(0.25, 0.6, 0.1);
    sc.add(helmet);
    // Otros cascos encima de otras motos (uno rojo en una que no es negra, otros de colores en motos oscuras): de día
    // se ve todo y, si no, la suya era la única con casco
    const decoys = taken.filter((b) => !b.gas);
    for (const [i, col] of [[3, 0xb02a2a], [8, 0xf2f2ee], [14, 0x1f3a6b], [19, 0x2a2c30]] as const) {
      const b = decoys[(i * 7) % decoys.length];
      if (!b) continue;
      const h = makeHelmet({ color: col, stripe: 0xf2f2ee });
      h.position.set(b.x, 1.07, b.z + (b.z > 0 ? 0.35 : -0.35));
      h.rotation.set(0.25, -0.4 + i * 0.3, 0.1);
      sc.add(h);
    }

    // Azul buscando (de noche, con el móvil en alto haciendo de linterna); Gas detrás
    this.player = makePerson(MARGAUX_LOOK);
    this.player.root.position.set(-14, 0, 0);
    this.gas = makePerson(MARC_LOOK);
    this.gas.root.position.set(-15, 0, 0.8);
    sc.add(this.player.root, this.gas.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.yaw = this.walker.facing = Math.PI / 2;
    if (NIGHT) {
      // La linterna no ilumina nada (las lámparas solo se ven encendidas): el móvil y su luz de tebeo
      const phone = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.01), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xdfe8ff, emissiveIntensity: 0.6 }));
      phone.rotation.x = -Math.PI / 2;
      this.player.handR.add(phone);
      const torch = new THREE.Sprite(new THREE.SpriteMaterial({ map: comicHaloTexture(), color: 0xfff0d8, transparent: true, depthWrite: false }));
      torch.material.userData.comicGlow = true;
      torch.scale.setScalar(0.35);
      torch.position.set(0, -0.02, 0.08);
      phone.add(torch);
    }

    this.hud = hud(() => ctx.input.queueAction(), () => {}, 'Arrastra a la izquierda para andar · a la derecha para girar la cámara', true);
    this.hud.setObjective('🏍️');
    this.updateHud();
    const p = this.player.root.position;
    ctx.camera.position.set(p.x - 5, 3, p.z);
    missionCard(T.title, T.goal);
    audio.ambience(0.15);
  }

  private updateHud() {
    this.hud.setCounters(`<span class="chip">${NIGHT ? '🔦' : '👀'} ${this.bays.filter((b) => b.checked).length}</span>`);
  }

  /**
   * De dónde salen los bocadillos en la misión (el capítulo se lo pregunta: si no, buscaba a Gas en la escena del
   * capítulo, la del kayak, que está detrás).
   */
  speakerPoint(who: string) {
    const p = who === 'Gas' || who === 'Marc' ? this.gas : who === 'Margaux' || who === 'Azul' ? this.player : null;
    if (!p) return null;
    const h = (p.rig?.bones.get('Head') ?? p.head).getWorldPosition(new THREE.Vector3());
    return h.setY(h.y + 0.32);
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
      comicWord('¡AHÍ ESTÁ!', 'fanfare');
      bark('Margaux', T.found);
      missionCard(T.title, '', true);
      return;
    }
    this.wrong++;
    audio.boo();
    // (los letreros no se ven en el tebeo: lo dice Gas, y se va acordando)
    bark('Gas', this.wrong === 3 ? T.hint1 : this.wrong === 5 ? T.hint2 : T.nope);
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
    if (!this.found && NIGHT) {
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
    // La columna de luz sobre su moto, solo si lleva 40 s sin mirar ninguna
    const lost = !this.found && this.lost.tick(String(this.bays.filter((x) => x.checked).length), dt);
    const mine = this.bays.find((x) => x.gas)!;
    beacon.at(lost ? new THREE.Vector3(mine.x, 0, mine.z) : null);

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
