import * as THREE from 'three';
import { Surf } from '../core/surfaces';
import { audio } from '../core/audio';
import { Sky, Sun, glowTexture, toon } from '../core/gfx';
import { Lost } from '../core/lost';
import { AZUL_DIARIO, GAS_DIARIO } from '../data/characters';
import { G, Merger, makePerson, animatePerson, seatedRootY, seatPose, Person } from '../entities/models';
import { makeCarHD } from '../entities/vehiclesHD';
import { Particles } from '../entities/fx';
import { later, type Hud } from '../ui/ui';
import { Walker } from '../core/walker';
import type { Input } from '../core/input';
import { Trail } from '../core/follow';
import { beacon } from '../core/beacon';
import { Door } from './door';
import type { Box2 } from './ferreries';

// Capítulo 3, entre Cafetería Marcial y San Vicente: iba a ser cenita de camping (estrellas, cartas y
// el camping gas) y a él se le olvidó precisamente el gas. De ahí el nombre. Escena de cine: en un claro
// entre matorral y pinos, de noche, con la mesa plegable, las cartas, el farolillo y un hornillo que no enciende.

export class Camp {
  scene = new THREE.Scene();
  private sky: Sky;
  private fx: Particles;
  readonly azul: Person;
  readonly gas: Person;
  private glow: THREE.Sprite;
  private t = 0;
  private lost = new Lost();
  private colliders: Box2[] = [];
  private door!: Door;
  private walker: Walker | null = null;
  private gasTrail = new Trail();
  private who: THREE.Vector3[] = [];
  /** Ya has entrado: el nivel sigue con la escena de la mesa. */
  inside = false;
  /** Chispitas del encendedor del hornillo (pequeñas, que no tapen nada). */
  private sparks: THREE.Sprite[] = [];
  private sparkT = 0;
  /** El hornillo, para encuadrarlo. */
  readonly stove = new THREE.Vector3(0.12, 0.8, 0.02);
  /** Centro de la mesa. */
  readonly table = new THREE.Vector3(0, 0.75, 0);

  constructor() {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0x1a2347, 30, 130);
    // La noche del cap. 2: se ve de noche, pero sin oscuridad exagerada (luna azulada con sombras, poco ambiente)
    sc.userData.comicLook = 'noche';
    sc.userData.hemiScale = 0.32;
    this.colliders.push({ minX: -0.55, maxX: 0.55, minZ: -0.36, maxZ: 0.36 }); // la mesa
    // Noche de finales de octubre: a la hora de cenar ya no queda resplandor en el horizonte, solo estrellas
    this.sky = new Sky({ top: 0x0a1440, mid: 0x1a2a66, bottom: 0x34437a, stars: 2200 });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0x6f7fc0, 0x1a2030, 1.1));
    const moon = new Sun(sc, 0xb8c8ff, 2.0, new THREE.Vector3(-0.4, 1, 0.5), 12);
    moon.light.shadow.normalBias = 0.16;
    moon.light.shadow.bias = -0.0012;
    this.fx = new Particles(sc);

    const m = new Merger();
    // Tierra, el claro de grava y matorral bajo alrededor, menos donde está la mesa
    m.add(G.box, 0x7d6649, 0, -0.05, 0, 0, 0, 0, 160, 0.1, 160);
    m.add(G.cyl, 0x8a7a68, 0, -0.03, 0, 0, 0, 0, 7, 0.06, 7);
    // El matorral, instanciado y de pocos polígonos (es mucho: con esferas normales la escena iba a tirones)
    const vines: THREE.Matrix4[] = [];
    const tint: THREE.Color[] = [];
    const VC = [0x3f5a2e, 0x4b6a34, 0x5a6e2c].map((c) => new THREE.Color(c));
    for (let row = -12; row <= 12; row++) {
      const x = row * 2.6;
      for (let z = -40; z <= 40; z += 1.6) {
        if (Math.abs(x) < 6.5 && Math.abs(z) < 6.5) continue;
        const j = Math.sin(row * 12.9 + z * 3.7);
        const sx = x + Math.sin(z * 9.1 + row) * 1.2, sz = z + Math.cos(row * 5.3 + z) * 0.7;
        if (Math.abs(sx) < 13.5 && sz > -14.5 && sz < 8) continue; // por donde se anda, despejado: nada de atravesar matas
        vines.push(new THREE.Matrix4().compose(new THREE.Vector3(sx, 0.32, sz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), j * 3), new THREE.Vector3(0.7 + j * 0.2, 0.42 + j * 0.12, 0.8)));
        tint.push(VC[Math.abs(row + Math.round(z)) % 3]);
      }
    }
    // Unos pinos, recortados contra las estrellas
    for (const [px, pz, h] of [[-14, 12, 8], [11, 15, 9], [18, -6, 7.5], [-20, -9, 8.5], [6, -19, 9], [-8, -22, 7], [25, 10, 8], [-27, 6, 9.5]]) {
      m.add(G.cyl, 0x3f3026, px, h / 2, pz, 0.04, 0, 0.05, 0.42, h, 0.42);
      for (let k = 0; k < 5; k++) m.add(G.bush, k % 2 ? 0x24402a : 0x2c4c30, px + Math.cos(k * 1.3) * 1.9, h + Math.sin(k * 2) * 0.5, pz + Math.sin(k * 1.3) * 1.9, 0, k, 0, 3.2, 1.5, 3.0);
    }
    const vineMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), toon({ color: 0xffffff, roughness: 0.9, surf: Surf.Foliage, leafy: true, side: THREE.DoubleSide }), vines.length);
    vines.forEach((mx, i) => {
      vineMesh.setMatrixAt(i, mx);
      vineMesh.setColorAt(i, tint[i]);
    });
    vineMesh.userData.noCast = true;
    sc.add(vineMesh);
    this.buildCabin(m);
    // Mesa plegable y dos sillas de camping
    m.add(G.box, 0xd9d4c8, 0, 0.72, 0, 0, 0, 0, 0.95, 0.03, 0.62);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(G.box, 0x9a9a9a, sx * 0.42, 0.36, sz * 0.26, 0, 0, sz * 0.1, 0.025, 0.72, 0.025);
    for (const sx of [-1, 1]) {
      m.add(G.box, 0x2f5f8a, sx * 0.85, 0.42, 0, 0, 0, 0, 0.45, 0.04, 0.45);
      m.add(G.box, 0x2f5f8a, sx * 1.07, 0.7, 0, 0, 0, sx * 0.15, 0.04, 0.55, 0.45);
      this.colliders.push({ minX: Math.min(sx * 0.6, sx * 1.12), maxX: Math.max(sx * 0.6, sx * 1.12), minZ: -0.26, maxZ: 0.26 });
      for (const sz of [-1, 1]) m.add(G.box, 0x777777, sx * 0.85, 0.21, sz * 0.2, 0, 0, sx * sz * 0.35, 0.02, 0.48, 0.02);
    }
    // Las cartas: un mazo y la partida a medias
    m.add(G.box, 0xf4f1ea, -0.3, 0.75, -0.16, 0, 0.2, 0, 0.06, 0.03, 0.09);
    for (let i = 0; i < 7; i++) m.add(G.box, i % 2 ? 0xf4f1ea : 0xc9302c, -0.15 + i * 0.045, 0.738, 0.12 - (i % 3) * 0.02, 0, 0.3 * Math.sin(i * 2.1), 0, 0.06, 0.002, 0.09);
    // El hornillo de camping, con su olla… y sin cartucho de gas
    m.add(G.cyl, 0x2a4f9a, this.stove.x, 0.77, this.stove.z, 0, 0, 0, 0.2, 0.06, 0.2);
    m.add(G.cyl, 0x2a2a2a, this.stove.x, 0.81, this.stove.z, 0, 0, 0, 0.12, 0.02, 0.12);
    m.add(G.cyl, 0xb8bcc2, this.stove.x, 0.89, this.stove.z, 0, 0, 0, 0.17, 0.12, 0.17);
    // Base del farolillo
    m.add(G.cyl, 0x333333, -0.32, 0.76, 0.16, 0, 0, 0, 0.08, 0.04, 0.08);
    sc.add(m.mesh());

    // El coche de Azul (el Ford Focus gris), aparcado al lado
    const car = makeCarHD(0x8c9096, { empty: true });
    car.root.position.set(-9, 0, -6.5);
    car.root.rotation.y = 1.1;
    this.colliders.push({ minX: -11.4, maxX: -6.6, minZ: -8.2, maxZ: -4.8, low: true });
    sc.add(car.root);

    // El farolillo: la única luz cálida en toda la noche
    const lampGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffc070, emissiveIntensity: 2.4 }));
    lampGlass.position.set(-0.32, 0.83, 0.16);
    sc.add(lampGlass);
    // (sin luz de punto: como en el cap. 2, una lámpara solo se ve encendida; su luz pintaba dianas en la mesa)
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    this.glow.position.copy(lampGlass.position);
    this.glow.scale.setScalar(0.9);
    sc.add(this.glow);

    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff0b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(0.04);
      sp.visible = false;
      this.sparks.push(sp);
      sc.add(sp);
    }

    // Azul y Gas, sentados uno frente al otro
    this.azul = makePerson(AZUL_DIARIO);
    this.gas = makePerson(GAS_DIARIO);
    for (const [p, sx] of [[this.azul, -1], [this.gas, 1]] as const) {
      p.root.position.set(sx * 0.85, seatedRootY(p, 0.44), 0); // asiento de la silla a 44 cm
      p.root.rotation.y = -sx * Math.PI / 2;
      sc.add(p.root);
    }
  }

  /** La cabaña de leña: troncos apilados con sus esquinas cruzadas, tejado de tablas, puerta y leña al lado. */
  private buildCabin(m: Merger) {
    const X = 3.3, Z = 3, H = 2.4, LOG = 0.25, DOOR = 0.6;
    const C = [0x6b4a2e, 0x5f4128, 0x74522f];
    const n = Math.round(H / LOG);
    for (let i = 0; i < n; i++) {
      const y = LOG / 2 + i * LOG;
      const c = C[i % 3];
      // Paredes de los lados y del fondo: enteras, con los troncos sobresaliendo en las esquinas
      for (const s of [-1, 1]) m.add(G.cyl, c, s * X, y, 0, Math.PI / 2, 0, 0, LOG, Z * 2 + 0.6, LOG);
      m.add(G.cyl, C[(i + 1) % 3], 0, y + 0.01, Z, 0, 0, Math.PI / 2, LOG, X * 2 + 0.6, LOG);
      // La de delante, con el hueco de la puerta (hasta 2 m)
      if (y < 2) {
        const len = X - DOOR + 0.3;
        for (const s of [-1, 1]) m.add(G.cyl, C[(i + 1) % 3], s * (DOOR + len / 2), y + 0.01, -Z, 0, 0, Math.PI / 2, LOG, len, LOG);
      } else m.add(G.cyl, C[(i + 1) % 3], 0, y + 0.01, -Z, 0, 0, Math.PI / 2, LOG, X * 2 + 0.6, LOG);
    }
    // Marco de la puerta y suelo de tablas
    for (const s of [-1, 1]) m.add(G.box, 0x3f2c1c, s * DOOR, 1, -Z, 0, 0, 0, 0.1, 2, 0.32);
    m.add(G.box, 0x3f2c1c, 0, 2.02, -Z, 0, 0, 0, DOOR * 2 + 0.1, 0.1, 0.32);
    for (let i = 0; i < 9; i++) m.add(G.box, i % 2 ? 0x6a4d32 : 0x5f452c, 0, 0.015, -Z + 0.33 + i * 0.67, 0, 0, 0, X * 2, 0.03, 0.64);
    // Tejado a dos aguas, de tablas, con los piñones de madera
    const rise = 1.25, half = Z + 0.45;
    const slope = Math.atan2(rise, half), len = Math.hypot(rise, half);
    for (const s of [1, -1]) {
      for (let k = 0; k < 9; k++) {
        const u = (k + 0.5) / 9;
        m.add(G.box, k % 2 ? 0x4c3722 : 0x423021, 0, H + rise * (1 - u) + 0.03, s * half * u, s * slope, 0, 0, X * 2 + 0.9, 0.07, len / 9 + 0.03);
      }
      const tri = new THREE.Shape([new THREE.Vector2(-Z, 0), new THREE.Vector2(Z, 0), new THREE.Vector2(0, rise)]);
      m.add(new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false }).rotateY(Math.PI / 2), 0x5a4128, s * X - 0.06, H, 0, 0, 0, 0, 1, 1, 1);
    }
    // Ventanita con luz
    m.add(G.box, 0x3f2c1c, X + 0.1, 1.45, 1, 0, 0, 0, 0.1, 0.8, 0.8);
    m.add(G.box, 0xffc680, X + 0.16, 1.45, 1, 0, 0, 0, 0.03, 0.62, 0.62);
    // La pila de leña, junto a la puerta
    for (let row = 0; row < 4; row++)
      for (let k = 0; k < 7 - row; k++) m.add(G.cyl, k % 2 ? 0x8a6a44 : 0x9a7a52, 1.45 + k * 0.22 + row * 0.11, 0.11 + row * 0.19, -Z - 0.42, Math.PI / 2, 0, 0, 0.2, 0.7, 0.2);
    this.colliders.push(
      { minX: -X - 0.3, maxX: X + 0.3, minZ: Z - 0.2, maxZ: Z + 0.2 },
      { minX: -X - 0.2, maxX: -X + 0.2, minZ: -Z, maxZ: Z },
      { minX: X - 0.2, maxX: X + 0.2, minZ: -Z, maxZ: Z },
      { minX: -X - 0.3, maxX: -DOOR, minZ: -Z - 0.2, maxZ: -Z + 0.2 },
      { minX: DOOR, maxX: X + 0.3, minZ: -Z - 0.2, maxZ: -Z + 0.2 },
      { minX: 1.3, maxX: 3.2, minZ: -Z - 0.8, maxZ: -Z - 0.2, low: true },
    );
    this.door = new Door({ hinge: new THREE.Vector3(-DOOR + 0.05, 0, -Z), ry: 0, width: DOOR * 2 - 0.1, swing: -1.7, reach: 1.7, speed: 0.5 });
    const dm = new Merger();
    for (let k = 0; k < 6; k++) dm.add(G.box, k % 2 ? 0x5a4128 : 0x644a2e, 0.09 + k * 0.185, 1, 0, 0, 0, 0, 0.175, 1.96, 0.05);
    for (const y of [0.4, 1.6]) dm.add(G.box, 0x3f2c1c, 0.55, y, 0.03, 0, 0, 0, 1.08, 0.09, 0.02);
    this.door.leaf.add(dm.mesh());
    this.scene.add(this.door.group);
  }

  /** Llegas en coche: Azul y Gas se bajan y hay que entrar en la cabaña a pie. */
  startWalk(camera: THREE.Camera) {
    this.azul.root.position.set(-1.6, 0, -8);
    this.azul.root.rotation.set(0, 0, 0);
    this.gas.root.position.set(-2.8, 0, -8.6);
    this.gas.root.rotation.set(0, 0, 0);
    this.walker = new Walker(this.azul.root.position);
    this.walker.yaw = this.walker.facing = 0.2;
    this.gasTrail = new Trail();
    this.inside = false;
    camera.position.set(-2, 3, -12.5);
  }

  /** Dentro: cada uno a su silla. */
  sitDown() {
    this.walker = null;
    for (const [p, sx] of [[this.azul, -1], [this.gas, 1]] as const) {
      p.root.position.set(sx * 0.85, seatedRootY(p, 0.44), 0);
      p.root.rotation.y = -sx * Math.PI / 2;
    }
  }

  /** Él intenta encender el hornillo: clic, clic, clic… y nada. */
  tryStove() {
    for (let i = 0; i < 3; i++)
      later(() => {
        audio.knock(0.5, 3200, 0.03);
        this.sparkT = 0.14;
        for (const sp of this.sparks) {
          sp.position.set(this.stove.x + (Math.random() - 0.5) * 0.05, 0.835 + Math.random() * 0.02, this.stove.z + (Math.random() - 0.5) * 0.05);
          sp.visible = true;
        }
      }, 250 + i * 420);
  }

  private sit(p: Person) {
    animatePerson(p, 0.016, 'idle');
    seatPose(p);
  }

  update(dt: number, camera: THREE.PerspectiveCamera, input: Input | null, hud: Hud) {
    this.t += dt;
    this.fx.update(dt);
    if (this.walker) {
      const w = this.walker;
      const pp = this.azul.root.position;
      w.turn(input ? input.consumeCam() : 0);
      w.canJump = false;
      const mag = w.move(dt, input ? input.axes() : { x: 0, y: 0 }, this.colliders, { minX: -12, maxX: 12, minZ: -13, maxZ: 2 });
      this.azul.root.rotation.y = w.facing;
      animatePerson(this.azul, dt, mag > 0.03 ? 'walk' : 'idle', mag, w.walk, w);
      const moving = this.gasTrail.step(this.gas.root, pp, 1.4, 3.8, dt, this.colliders, 0.26);
      animatePerson(this.gas, dt, moving ? 'walk' : 'idle', moving ? 0.8 : 0);
      this.who.length = 0;
      this.who.push(pp, this.gas.root.position);
      this.door.update(dt, this.who, camera.position);
      // Pistas, solo si se ha perdido (40 s sin entrar): la flecha y la columna sobre la puerta
      if (this.lost.tick('cabin', dt, !input) && pp.z < -3.6) {
        const ang = Math.atan2(-pp.x, -2 - pp.z);
        const rel = Math.atan2(Math.sin(ang - w.yaw), Math.cos(ang - w.yaw));
        hud.setArrow(-rel);
        beacon.at(new THREE.Vector3(0, 0, -3));
      } else {
        hud.setArrow(null);
        beacon.at(null);
      }
      // Pasada la puerta, ya estás dentro
      if (pp.z > -2 && Math.abs(pp.x) < 3 && !this.inside) this.inside = true;
      w.camera(camera, dt, this.colliders, pp.z > -3.4 ? 2.6 : 5.5, pp.z > -3.4 ? 1.9 : 2.8);
    } else {
      this.sit(this.azul);
      this.sit(this.gas);
      this.door.update(dt, this.who.slice(0, 0), camera.position);
      // Él con la mano en el hornillo; ella con las cartas
      this.gas.armR.rotation.x = -0.9 + Math.sin(this.t * 1.7) * 0.04;
      this.azul.armL.rotation.x = -0.7;
    }
    if (this.sparkT > 0) {
      this.sparkT -= dt;
      for (const sp of this.sparks) {
        sp.visible = this.sparkT > 0;
        sp.material.opacity = Math.max(0, this.sparkT / 0.14);
      }
    }
    // La llama del farolillo tiembla un poco
    const fl = 1 + Math.sin(this.t * 13) * 0.04 + Math.sin(this.t * 7.3) * 0.05;
    this.glow.scale.setScalar(0.9 * fl);
    this.sky.update(camera, dt);
  }
}
