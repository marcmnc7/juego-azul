import * as THREE from 'three';
import { audio } from '../core/audio';
import { Sky, Sun, toon, vibrate } from '../core/gfx';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, makeScallop, animatePerson, seatedRootY, seatPose, Person } from '../entities/models';
import { Particles } from '../entities/fx';
import { canvasTex } from './deco';

// Mitad del capítulo 2: la terraza de El Ancla, en San Vicente de la Barquera (sacada de la foto de
// Marc: soportales de piedra, toldos de rayas azules y blancas con "⚓ EL ANCLA · TABLAS" y
// "ARROCERÍA · PICOTEO", balcones de madera, sábanas tendidas, mesas de madera y sillas azules).
// Azul y Gas se comen allí sus zamburiñas.

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
  private plate = new THREE.Group();
  private bite: THREE.Group;
  private t = 0;
  private eatT = -1;
  private onAte: (() => void) | null = null;
  private camPos = new THREE.Vector3(1.5, 1.65, -3.3);
  private camLook = new THREE.Vector3(0.8, 1.4, 1.0);
  /** Punto de la mesa en coordenadas de mundo, para tocar. */
  readonly tableTop = new THREE.Vector3(0, 0.8, 0);

  constructor() {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0xcfe3e8, 30, 90);
    this.sky = new Sky({ top: 0x4f86c6, mid: 0x9fc6e0, bottom: 0xdcebf0, sun: { color: 0xfff2c8, dir: new THREE.Vector3(0.5, 0.6, -1) }, clouds: { count: 10, tint: 0xffffff } });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0xeaf4ff, 0x8a8070, 0.95));
    new Sun(sc, 0xfff4e0, 1.45, new THREE.Vector3(0.6, 1, -0.8), 10);
    this.fx = new Particles(sc);

    const m = new Merger();
    const FZ = 3.2; // fachada, mirando a -z (hacia la cámara)
    const WHITE = 0xf4f2ec;
    const STONE = 0xe6e0d2;
    const BLUE = 0x2a4fb0;
    // Suelo de la terraza (losas claras), bordillo y calle
    m.add(G.box, 0xc4bcae, 0, -0.05, 0.5, 0, 0, 0, 30, 0.1, 6);
    m.add(G.box, 0xbdb6a8, 0, -0.03, -2.55, 0, 0, 0, 30, 0.12, 0.2);
    m.add(G.box, 0x6d6d72, 0, -0.08, -8, 0, 0, 0, 30, 0.1, 11);

    // --- Edificio de El Ancla (a la izquierda de la foto = +x) ---
    m.add(G.box, WHITE, 1.2, 6.2, FZ + 0.4, 0, 0, 0, 13, 6, 0.8); // pisos de arriba, blancos
    m.add(G.box, 0x3a3430, 1.2, 1.6, FZ + 0.8, 0, 0, 0, 13, 3.2, 0.4); // interior en sombra
    // Pilares de piedra de los soportales
    for (const x of [7.4, 3.9, 1.0, -2.6, -5.1]) m.add(G.box, STONE, x, 1.6, FZ + 0.1, 0, 0, 0, 0.45, 3.2, 0.45);
    m.add(G.box, STONE, 1.2, 3.25, FZ + 0.2, 0, 0, 0, 13, 0.25, 0.5);
    // Puerta de madera y carteles
    m.add(G.box, 0x9a6a3c, -0.6, 1.25, FZ + 0.55, 0, 0, 0, 1.2, 2.5, 0.06);
    m.add(G.box, 0x7a5030, -0.6, 1.25, FZ + 0.52, 0, 0, 0, 0.05, 2.5, 0.04);
    for (const [x, w, h, c] of [[5.9, 1.2, 1.7, 0xf8f8f8], [4.7, 0.6, 1.4, 0x222428], [2.6, 0.7, 1.6, 0x2a4f8a], [0.5, 0.5, 1.6, 0xf4f4f4], [-3.4, 0.6, 1.5, 0x222428]] as const)
      m.add(G.box, c, x, 1.55, FZ + 0.52, 0, 0, 0, w, h, 0.04);
    for (let i = 0; i < 3; i++) m.add(G.cyl, 0xd9632a, 5.9 - 0.3 + i * 0.32, 1.15, FZ + 0.49, Math.PI / 2, 0, 0, 0.3, 0.02, 0.3); // paellas del cartel
    // Mesas de dentro con mantel azul
    for (const x of [3.2, 1.6, -1.6]) m.add(G.box, BLUE, x, 0.75, FZ + 0.4, 0, 0, 0, 1.0, 0.4, 0.5);
    // Balcones de madera con rejas y ventanas
    for (const x of [4.6, -0.2, -3.6]) {
      m.add(G.box, 0x6b4428, x, 6.3, FZ - 0.05, 0, 0, 0, 1.9, 2.6, 0.12);
      m.add(G.box, 0x2a2420, x, 6.4, FZ - 0.1, 0, 0, 0, 1.5, 2.1, 0.06);
      for (let k = 0; k < 6; k++) m.add(G.box, 0x1e1e1e, x - 0.62 + k * 0.25, 5.55, FZ - 0.25, 0, 0, 0, 0.03, 0.8, 0.03);
      m.add(G.box, 0x1e1e1e, x, 5.95, FZ - 0.25, 0, 0, 0, 1.5, 0.04, 0.04);
      m.add(G.box, 0x6b4428, x, 5.1, FZ - 0.15, 0, 0, 0, 1.9, 0.1, 0.35);
    }
    m.add(G.box, 0xfafafa, -1.6, 4.0, FZ - 0.25, 0, 0, 0, 2.6, 0.55, 0.45); // aire acondicionado
    // La ropa tendida (sábanas blancas) arriba a la izquierda
    m.add(G.box, 0x777777, 5.4, 7.6, FZ - 0.5, 0, 0, 0, 4, 0.02, 0.02);
    for (const [x, h] of [[6.8, 1.9], [5.9, 2.2], [5.1, 1.6], [4.4, 1.1]] as const) m.add(G.box, 0xf2f2f6, x, 7.6 - h / 2, FZ - 0.52, 0, 0, 0.03, 0.75, h, 0.03);

    // Toldos de rayas azules y blancas con su faldón
    const stripes = canvasTex((ctx, w, h) => {
      for (let x = 0; x < w; x += 16) {
        ctx.fillStyle = (x / 16) % 2 ? '#ffffff' : '#2350b8';
        ctx.fillRect(x, 0, 16, h);
      }
    }, 256, 32);
    stripes.wrapS = THREE.RepeatWrapping;
    stripes.repeat.set(3, 1);
    const awnMat = toon({ map: stripes, color: 0xffffff, side: THREE.DoubleSide });
    const valance = (left: string, right: string) =>
      canvasTex(
        (ctx, w, h) => {
          ctx.fillStyle = '#1f43a8';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#ffffff';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 50px Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(left, 40, h / 2 + 2);
          ctx.textAlign = 'right';
          ctx.font = '600 40px Arial, sans-serif';
          ctx.fillText(right.split('').join(' '), w - 40, h / 2 + 2);
        },
        1024,
        80,
      );
    for (const [cx, w, l, r] of [[3.6, 5.4, '⚓ EL ANCLA', 'TABLAS'], [-2.1, 6.2, 'A R R O C E R Í A', 'PICOTEO']] as const) {
      const awn = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.1), awnMat);
      awn.position.set(cx, 3.15, FZ - 1.0);
      awn.rotation.set(-Math.PI / 2 + 0.28, Math.PI, 0);
      const val = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.42), new THREE.MeshBasicMaterial({ map: valance(l, r), color: 0xf2f2f2 }));
      val.position.set(cx, 2.65, FZ - 2.03);
      val.rotation.y = Math.PI;
      sc.add(awn, val);
    }
    // Toldo recogido encima
    m.add(G.box, 0x2350b8, 0.6, 3.6, FZ - 0.35, 0, 0, 0.1, 1.2, 0.6, 0.3);

    // --- Vecino de la derecha: cervecería con rótulo azul marino y fachada amarilla ---
    m.add(G.box, 0xf1d79a, -8.2, 6.2, FZ + 0.4, 0, 0, 0, 6, 6, 0.8);
    m.add(G.box, 0x3a3430, -8.2, 1.6, FZ + 0.8, 0, 0, 0, 6, 3.2, 0.4);
    m.add(G.box, 0x1b2440, -8.2, 3.9, FZ - 0.05, 0, 0, 0, 5.6, 0.9, 0.12);
    m.add(G.box, 0x1b2440, -8.2, 2.9, FZ - 0.9, 0, 0, 0, 5.6, 0.4, 1.6);
    m.add(G.box, 0x6b4428, -8.2, 6.4, FZ - 0.05, 0, 0, 0, 4.6, 1.4, 0.1);
    const cerv = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.38), new THREE.MeshBasicMaterial({ map: valance('CERVECERÍA', ''), color: 0xd8d8e8 }));
    cerv.position.set(-8.2, 2.88, FZ - 1.71);
    cerv.rotation.y = Math.PI;
    sc.add(cerv);
    // --- Vecino de la izquierda: casa de piedra ---
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(5, 9), toon({ map: stoneWall(), color: 0xffffff }));
    wall.position.set(10.2, 4.5, FZ - 0.01);
    wall.rotation.y = Math.PI;
    sc.add(wall);

    // --- Terraza: mesas de madera con patas metálicas y sillas azules ---
    const chair = (x: number, z: number, ry: number) => {
      const c = Math.cos(ry);
      const sn = Math.sin(ry);
      const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * sn, z - lx * sn + lz * c];
      const part = (lx: number, y: number, lz: number, w: number, h: number, d: number, col: number) => {
        const [wx, wz] = at(lx, lz);
        m.add(G.box, col, wx, y, wz, 0, ry, 0, w, h, d);
      };
      part(0, 0.46, 0, 0.44, 0.04, 0.42, 0xb0714a); // asiento de madera
      for (const [dx, dz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) part(dx, 0.23, dz, 0.03, 0.46, 0.03, BLUE);
      for (const dx of [-0.2, 0.2]) part(dx, 0.72, -0.2, 0.03, 0.55, 0.03, BLUE);
      part(0, 0.86, -0.2, 0.42, 0.18, 0.03, BLUE);
    };
    const table = (x: number, z: number, w = 1.3, d = 0.8) => {
      m.add(G.box, 0x9a6a3c, x, 0.76, z, 0, 0, 0, w, 0.05, d);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.add(G.box, 0xbdbdbd, x + dx * (w / 2 - 0.06), 0.38, z + dz * (d / 2 - 0.06), 0, 0, 0, 0.04, 0.76, 0.04);
    };
    table(0, 0, 1.2, 0.85);
    chair(-0.85, 0, Math.PI / 2);
    chair(0.85, 0, -Math.PI / 2);
    for (const [x, z] of [[-3.6, 0.9], [3.4, 1.1], [-6.5, 0.4], [6.4, 0.6], [-2.2, -1.5], [2.4, -1.6]]) {
      table(x, z);
      chair(x - 0.8, z, Math.PI / 2);
      chair(x + 0.8, z, -Math.PI / 2);
      chair(x, z - 0.6, 0);
    }
    // Sombrillas blancas cerradas
    for (const [x, z] of [[4.6, -0.6], [8.6, 0.3]]) {
      m.add(G.cyl, 0xdddddd, x, 1.3, z, 0, 0, 0, 0.06, 2.6, 0.06);
      m.add(G.cone, 0xf6f6f6, x, 1.9, z, 0, 0, 0, 0.5, 2.4, 0.5);
      m.add(G.box, 0x2a3f9a, x, 1.05, z - 0.18, 0, 0, 0, 0.3, 0.2, 0.02);
    }
    // Copas de vino y pan en nuestra mesa
    for (const sx of [-1, 1]) {
      m.add(G.cyl, 0xe8f4f8, sx * 0.32, 0.86, -0.25, 0, 0, 0, 0.06, 0.16, 0.06);
      m.add(G.cyl, 0xe9d36a, sx * 0.32, 0.97, -0.25, 0, 0, 0, 0.14, 0.08, 0.14);
    }
    m.add(G.box, 0xd9a35a, 0.05, 0.82, 0.3, 0, 0.4, 0, 0.3, 0.08, 0.14);
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

    // Azul y Gas sentados uno frente al otro
    this.azul = makePerson(MARGAUX_LOOK);
    this.gas = makePerson(MARC_LOOK);
    for (const [p, sx] of [[this.azul, -1], [this.gas, 1]] as const) {
      p.root.position.set(sx * 0.85, seatedRootY(p, 0.48), 0); // asiento de la silla a 48 cm
      p.root.rotation.y = -sx * Math.PI / 2;
      sc.add(p.root);
    }
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
    // Sentados de verdad: muslos en el asiento, rodillas dobladas y pies en el suelo
    seatPose(p);
  }

  update(dt: number, camera: THREE.PerspectiveCamera) {
    this.t += dt;
    this.fx.update(dt);
    this.sit(this.azul);
    this.sit(this.gas);
    this.gas.armR.rotation.x = -0.6 + Math.sin(this.t * 2) * 0.05;
    this.gas.head.rotation.z = Math.sin(this.t * 0.8) * 0.05;
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
