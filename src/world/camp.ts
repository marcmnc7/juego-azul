import * as THREE from 'three';
import { audio } from '../core/audio';
import { Sky, Sun, glowTexture, toon } from '../core/gfx';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, animatePerson, seatedRootY, seatPose, Person } from '../entities/models';
import { makeCarHD } from '../entities/vehiclesHD';
import { Particles } from '../entities/fx';
import { later } from '../ui/ui';

// Capítulo 3, entre Cafetería Marcial y San Vicente: iba a ser cenita de camping (estrellas, cartas y
// el camping gas) y a él se le olvidó precisamente el gas. De ahí el nombre. Escena de cine: en un claro
// entre matorral y pinos, de noche, con la mesa plegable, las cartas, el farolillo y un hornillo que no enciende.

export class Camp {
  scene = new THREE.Scene();
  private sky: Sky;
  private fx: Particles;
  readonly azul: Person;
  readonly gas: Person;
  private lamp: THREE.PointLight;
  private glow: THREE.Sprite;
  private t = 0;
  /** Chispitas del encendedor del hornillo (pequeñas, que no tapen nada). */
  private sparks: THREE.Sprite[] = [];
  private sparkT = 0;
  /** El hornillo, para encuadrarlo. */
  readonly stove = new THREE.Vector3(0.12, 0.8, 0.02);
  /** Centro de la mesa. */
  readonly table = new THREE.Vector3(0, 0.75, 0);

  constructor() {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0x1a2347, 25, 120);
    // Noche de octubre: estrellas y, al fondo, el último resplandor en el horizonte
    this.sky = new Sky({ top: 0x1a2f72, mid: 0x34509a, bottom: 0x9a7090, stars: 2200 });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0x7f8fd8, 0x2a2230, 0.6));
    new Sun(sc, 0xb0c0ff, 0.6, new THREE.Vector3(-0.4, 1, 0.5), 12);
    this.fx = new Particles(sc);

    const m = new Merger();
    // Tierra, el claro de grava y matorral bajo alrededor, menos donde está la mesa
    m.add(G.box, 0x5e4a38, 0, -0.05, 0, 0, 0, 0, 160, 0.1, 160);
    m.add(G.cyl, 0x8a7a66, 0, -0.03, 0, 0, 0, 0, 7, 0.06, 7);
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
        if (Math.abs(sx) < 6.5 && Math.abs(sz) < 6.5) continue;
        vines.push(new THREE.Matrix4().compose(new THREE.Vector3(sx, 0.32, sz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), j * 3), new THREE.Vector3(0.7 + j * 0.2, 0.42 + j * 0.12, 0.8)));
        tint.push(VC[Math.abs(row + Math.round(z)) % 3]);
      }
    }
    // Unos pinos, recortados contra las estrellas
    for (const [px, pz, h] of [[-14, 12, 8], [11, 15, 9], [18, -6, 7.5], [-20, -9, 8.5], [6, -19, 9], [-8, -22, 7], [25, 10, 8], [-27, 6, 9.5]]) {
      m.add(G.cyl, 0x3f3026, px, h / 2, pz, 0.04, 0, 0.05, 0.42, h, 0.42);
      for (let k = 0; k < 5; k++) m.add(G.bush, k % 2 ? 0x24402a : 0x2c4c30, px + Math.cos(k * 1.3) * 1.9, h + Math.sin(k * 2) * 0.5, pz + Math.sin(k * 1.3) * 1.9, 0, k, 0, 3.2, 1.5, 3.0);
    }
    const vineMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), toon({ color: 0xffffff, roughness: 0.9 }), vines.length);
    vines.forEach((mx, i) => {
      vineMesh.setMatrixAt(i, mx);
      vineMesh.setColorAt(i, tint[i]);
    });
    vineMesh.userData.noCast = true;
    sc.add(vineMesh);
    // Mesa plegable y dos sillas de camping
    m.add(G.box, 0xd9d4c8, 0, 0.72, 0, 0, 0, 0, 0.95, 0.03, 0.62);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(G.box, 0x9a9a9a, sx * 0.42, 0.36, sz * 0.26, 0, 0, sz * 0.1, 0.025, 0.72, 0.025);
    for (const sx of [-1, 1]) {
      m.add(G.box, 0x2f5f8a, sx * 0.85, 0.42, 0, 0, 0, 0, 0.45, 0.04, 0.45);
      m.add(G.box, 0x2f5f8a, sx * 1.07, 0.7, 0, 0, 0, sx * 0.15, 0.04, 0.55, 0.45);
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
    car.root.position.set(-3.4, 0, 1.6);
    car.root.rotation.y = 0.5;
    sc.add(car.root);

    // El farolillo: la única luz cálida en toda la noche
    const lampGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffc070, emissiveIntensity: 2.4 }));
    lampGlass.position.set(-0.32, 0.83, 0.16);
    sc.add(lampGlass);
    this.lamp = new THREE.PointLight(0xffc27a, 9, 9, 1.6);
    this.lamp.position.set(-0.32, 0.95, 0.16);
    sc.add(this.lamp);
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
    this.azul = makePerson(MARGAUX_LOOK);
    this.gas = makePerson(MARC_LOOK);
    for (const [p, sx] of [[this.azul, -1], [this.gas, 1]] as const) {
      p.root.position.set(sx * 0.85, seatedRootY(p, 0.44), 0); // asiento de la silla a 44 cm
      p.root.rotation.y = -sx * Math.PI / 2;
      sc.add(p.root);
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

  update(dt: number, camera: THREE.Camera) {
    this.t += dt;
    this.fx.update(dt);
    this.sit(this.azul);
    this.sit(this.gas);
    // Él con la mano en el hornillo; ella con las cartas
    this.gas.armR.rotation.x = -0.9 + Math.sin(this.t * 1.7) * 0.04;
    this.azul.armL.rotation.x = -0.7;
    if (this.sparkT > 0) {
      this.sparkT -= dt;
      for (const sp of this.sparks) {
        sp.visible = this.sparkT > 0;
        sp.material.opacity = Math.max(0, this.sparkT / 0.14);
      }
    }
    // La llama del farolillo tiembla un poco
    const fl = 1 + Math.sin(this.t * 13) * 0.04 + Math.sin(this.t * 7.3) * 0.05;
    this.lamp.intensity = 9 * fl;
    this.glow.scale.setScalar(0.9 * fl);
    this.sky.update(camera, dt);
  }
}
