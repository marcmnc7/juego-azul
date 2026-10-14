import * as THREE from 'three';
import { audio } from '../core/audio';
import { Sky, Sun, toon, vibrate } from '../core/gfx';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, makeDog, makeScallop, animatePerson, Person, Dog } from '../entities/models';
import { Particles } from '../entities/fx';
import { canvasTex } from './deco';

// Final del capítulo 2: Azul y Gas sentados en la terraza del restaurante de las zamburiñas,
// con Joy debajo de la mesa. Azul se come una y se acaba el capítulo.

function signTexture(name: string) {
  return canvasTex(
    (ctx, w, h) => {
      ctx.fillStyle = '#f6efe0';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#3a2a1c';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = '#3a2a1c';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 64px Georgia, serif';
      ctx.fillText(name, w / 2, h / 2 + 4);
    },
    768,
    112,
  );
}

function stoneWall() {
  const t = canvasTex((ctx, w, h) => {
    ctx.fillStyle = '#c9b796';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 22)
      for (let x = (y / 22) % 2 ? -20 : 0; x < w; x += 40) {
        const v = 180 + Math.random() * 40;
        ctx.fillStyle = `rgb(${v},${v - 14},${v - 40})`;
        ctx.fillRect(x + 2, y + 2, 36, 18);
      }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class Terrace {
  scene = new THREE.Scene();
  private sky: Sky;
  private fx: Particles;
  private azul: Person;
  private gas: Person;
  private joy: Dog;
  private plate = new THREE.Group();
  private bite: THREE.Group;
  private t = 0;
  private eatT = -1;
  private onAte: (() => void) | null = null;
  private camPos = new THREE.Vector3(0.35, 1.75, -2.5);
  private camLook = new THREE.Vector3(0, 1.0, 0.4);
  /** Punto de la mesa en coordenadas de mundo, para tocar. */
  readonly tableTop = new THREE.Vector3(0, 0.8, 0);

  constructor(name = 'Restaurante') {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0xf6c9a0, 30, 90);
    this.sky = new Sky({ top: 0x5a4a9a, mid: 0xf2a77d, bottom: 0xf6c9a0, sun: { color: 0xffd08a, dir: new THREE.Vector3(-0.6, 0.18, 1) }, clouds: { count: 8, tint: 0xffd2b8 } });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0xffe2c8, 0x6a5040, 1.3));
    new Sun(sc, 0xffd2a0, 1.6, new THREE.Vector3(-0.8, 1, -0.6), 10);
    this.fx = new Particles(sc);

    const m = new Merger();
    // Suelo de la terraza y la calle
    m.add(G.box, 0xcfc2aa, 0, -0.05, 0, 0, 0, 0, 30, 0.1, 24);
    // Fachada del restaurante detrás de la mesa
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), toon({ map: stoneWall(), color: 0xffffff }));
    (wall.material as THREE.MeshToonMaterial).map!.repeat.set(4, 2);
    wall.position.set(0, 3.5, 3.2);
    wall.rotation.y = Math.PI;
    sc.add(wall);
    m.add(G.box, 0xcfc2aa, 0, 3.5, 3.6, 0, 0, 0, 16, 7, 0.7);
    m.add(G.box, 0x5a3a24, -1.6, 1.3, 3.15, 0, 0, 0, 1.4, 2.6, 0.08); // puerta
    m.add(G.box, 0xffd9a0, 1.8, 1.6, 3.15, 0, 0, 0, 2.2, 1.6, 0.06); // ventanal iluminado
    m.add(G.box, 0x5a3a24, 1.8, 1.6, 3.12, 0, 0, 0, 2.4, 1.8, 0.04);
    m.add(G.box, 0x7a2030, 0, 2.95, 2.4, -0.35, 0, 0, 7, 0.06, 1.8); // toldo
    m.add(G.box, 0x6a1a28, 0, 2.62, 1.55, 0, 0, 0, 7, 0.3, 0.04);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.62), new THREE.MeshBasicMaterial({ map: signTexture(name), color: 0xf0f0f0 }));
    sign.position.set(0, 3.7, 3.1);
    sign.rotation.y = Math.PI;
    sc.add(sign);
    // Mesa y sillas
    m.add(G.cyl, 0xf4efe2, 0, 0.76, 0, 0, 0, 0, 1.2, 0.05, 1.2);
    m.add(G.cyl, 0x555555, 0, 0.38, 0, 0, 0, 0, 0.08, 0.76, 0.08);
    m.add(G.cyl, 0x555555, 0, 0.02, 0, 0, 0, 0, 0.5, 0.04, 0.5);
    for (const sx of [-1, 1]) {
      const x = sx * 0.85;
      m.add(G.box, 0x7a5a3a, x, 0.46, 0, 0, 0, 0, 0.5, 0.05, 0.5);
      m.add(G.box, 0x7a5a3a, x + sx * 0.25, 0.75, 0, 0, 0, 0, 0.05, 0.6, 0.5);
      for (const [dx, dz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) m.add(G.box, 0x5a3a24, x + dx, 0.23, dz, 0, 0, 0, 0.04, 0.46, 0.04);
    }
    // Copas de vino y pan
    for (const sx of [-1, 1]) {
      m.add(G.cyl, 0xe8f4f8, sx * 0.32, 0.86, -0.25, 0, 0, 0, 0.06, 0.16, 0.06);
      m.add(G.cyl, 0x7a1830, sx * 0.32, 0.97, -0.25, 0, 0, 0, 0.14, 0.08, 0.14);
    }
    m.add(G.box, 0xd9a35a, 0.05, 0.82, 0.35, 0, 0.4, 0, 0.3, 0.08, 0.14);
    // Otras mesas de la terraza, vacías
    for (const [x, z] of [[-4, 0.6], [4, 0.6], [-6.5, -1.6], [6.5, -1.6]]) {
      m.add(G.cyl, 0xf4efe2, x, 0.76, z, 0, 0, 0, 1.1, 0.05, 1.1);
      m.add(G.cyl, 0x555555, x, 0.38, z, 0, 0, 0, 0.08, 0.76, 0.08);
    }
    // Macetas
    for (const x of [-7.5, -3.6, 3.6, 7.5]) {
      m.add(G.cyl, 0xb5603b, x, 0.3, 2.6, 0, 0, 0, 0.6, 0.6, 0.6);
      m.add(G.sphere, 0x4e8a3e, x, 0.9, 2.6, 0, 0, 0, 0.8, 0.8, 0.8);
    }
    sc.add(m.mesh());

    // Plato de zamburiñas
    this.plate.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.04, 20), toon({ color: 0xffffff })));
    for (let i = 0; i < 6; i++) {
      const s = makeScallop();
      s.root.scale.setScalar(0.32);
      const a = (i / 6) * Math.PI * 2;
      s.root.position.set(Math.cos(a) * 0.17, 0.0, Math.sin(a) * 0.17);
      (s.meat.material as THREE.MeshLambertMaterial).color.set(0xe0a040);
      this.plate.add(s.root);
    }
    this.plate.position.set(0, 0.8, 0.05);
    sc.add(this.plate);
    this.bite = this.plate.children[1] as THREE.Group;

    // Azul y Gas sentados uno frente al otro, Joy debajo de la mesa
    this.azul = makePerson(MARGAUX_LOOK);
    this.gas = makePerson(MARC_LOOK);
    for (const [p, sx] of [[this.azul, -1], [this.gas, 1]] as const) {
      p.root.position.set(sx * 0.85, -0.2, 0);
      p.root.rotation.y = -sx * Math.PI / 2;
      sc.add(p.root);
    }
    this.joy = makeDog();
    this.joy.root.position.set(-1.45, 0, -0.55);
    this.joy.root.rotation.y = Math.PI * 0.75;
    sc.add(this.joy.root);
  }

  /** Coloca la cámara en el plano de la mesa. */
  frame(camera: THREE.PerspectiveCamera) {
    camera.position.copy(this.camPos);
    camera.lookAt(this.camLook);
  }

  eat(onDone: () => void) {
    if (this.eatT >= 0) return;
    this.eatT = 0;
    this.onAte = onDone;
  }

  private sit(p: Person) {
    animatePerson(p, 0.016, 'idle');
    p.legL.rotation.x = p.legR.rotation.x = -Math.PI / 2;
  }

  update(dt: number, camera: THREE.PerspectiveCamera) {
    this.t += dt;
    this.fx.update(dt);
    this.sit(this.azul);
    this.sit(this.gas);
    this.gas.armR.rotation.x = -0.6 + Math.sin(this.t * 2) * 0.05;
    this.gas.head.rotation.z = Math.sin(this.t * 0.8) * 0.05;
    this.joy.tail.rotation.z = Math.sin(this.t * 12) * 0.6;
    if (this.eatT >= 0) {
      this.eatT += dt;
      const k = Math.min(1, this.eatT / 1.0);
      // Azul coge la zamburiña y se la lleva a la boca
      this.azul.armR.rotation.x = -Math.sin(k * Math.PI * 0.5) * 2.1;
      const hand = this.azul.handR.getWorldPosition(new THREE.Vector3());
      if (this.eatT < 1.1) this.bite.position.copy(this.plate.worldToLocal(hand.clone()));
      if (this.eatT >= 1.1 && this.bite.visible) {
        this.bite.visible = false;
        audio.pickup();
        vibrate(30);
        this.fx.burst(hand.setY(hand.y + 0.4), '💕', 8, 1.2, 0.8);
        this.fx.burst(this.tableTop.clone().setY(1.6), '😋', 1, 0.6, 1);
      }
      if (this.eatT > 1.6) this.azul.armR.rotation.x = THREE.MathUtils.lerp(this.azul.armR.rotation.x, 0, 0.1);
      if (this.eatT > 2.2 && this.onAte) {
        const cb = this.onAte;
        this.onAte = null;
        cb();
      }
    }
    camera.position.lerp(this.camPos, Math.min(1, dt * 2));
    camera.lookAt(this.camLook);
    this.sky.update(camera, dt);
  }
}
