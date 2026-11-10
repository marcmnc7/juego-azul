import * as THREE from 'three';
import { audio } from '../core/audio';
import { Sky, Sun, toon, vibrate, glowTexture } from '../core/gfx';
import { rigPost, leanTorso } from '../entities/rig';
import { twoBone } from '../entities/embrace';
import { AZUL_DIARIO, GAS_DIARIO } from '../data/characters';
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

const FINGER_AXIS = new THREE.Vector3(1, 0, 0);
const sstep = THREE.MathUtils.smoothstep;

/**
 * Cómo se come la zamburiña (segundos de juego; la escena va a cámara lenta):
 * se inclina y alarga la mano, la coge por la charnela, se la lleva a los labios, la inclina y se la come, y
 * deja la concha vacía en el plato.
 */
const EAT = { reach: 0.42, grab: 0.5, lips: 1.0, tilt: 1.12, gone: 1.2, back: 1.42, down: 1.85, end: 2.3 };

export class Terrace {
  scene = new THREE.Scene();
  private sky: Sky;
  private fx: Particles;
  readonly azul: Person;
  readonly gas: Person;
  private plate = new THREE.Group();
  private bite: THREE.Group;
  /** Lo que se come (carne, coral, ajo y perejil): la concha se queda. */
  private biteMeat: THREE.Object3D[] = [];
  private biteHome = new THREE.Vector3();
  private biteHomeQ = new THREE.Quaternion();
  private shellDir = new THREE.Vector3();
  private shellUp = new THREE.Vector3();
  private t = 0;
  private eatT = -1;
  /** Brillo dorado de la zamburiña, en el primer plano. */
  private shine = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffcf7a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  private biteFrom = new THREE.Vector3();
  private mouth = new THREE.Vector3();
  private grip = new THREE.Vector3();
  private gripDir = new THREE.Vector3(0, 0, 1);
  private basisX = new THREE.Vector3();
  private basisY = new THREE.Vector3();
  private basisM = new THREE.Matrix4();
  private gripWorld = new THREE.Vector3();
  private tipA = new THREE.Vector3();
  private tipB = new THREE.Vector3();
  private fingerQ = new THREE.Quaternion();
  private post: ((dt: number) => void) | null = null;
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
    m.add(G.box, 0x6a5444, 1.2, 1.6, FZ + 0.8, 0, 0, 0, 13, 3.2, 0.4); // interior del bar, en penumbra cálida
    for (const x of [6.3, 3.0, 2.2, -1.9, -4.2]) {
      m.add(G.box, 0x7a5a3a, x, 1.85, FZ + 0.58, 0, 0, 0, 0.72, 0.03, 0.12); // estantes con botellas
      for (let k = 0; k < 4; k++) m.add(G.cyl, [0x2f6b3a, 0x8a5a1c, 0x3a2418, 0xd8d0b8][k], x - 0.25 + k * 0.17, 2.01, FZ + 0.56, 0, 0, 0, 0.06, 0.28, 0.06);
    }
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
    for (const [x, h] of [[6.8, 1.75], [5.9, 1.85], [5.1, 1.65], [4.4, 1.75]] as const) m.add(G.box, 0xf2f2f6, x, 7.6 - h / 2, FZ - 0.52, 0, 0, 0.03, 0.75, h, 0.03);

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
    // El pan, en su cestita de mimbre con servilleta
    m.add(new THREE.CylinderGeometry(0.11, 0.085, 0.06, 14), 0x8a6238, 0.05, 0.815, 0.28);
    m.add(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 14), 0xf2efe6, 0.05, 0.846, 0.28);
    for (const [dx, dz, ry] of [[-0.035, -0.02, 0.4], [0.04, 0.02, 1.4], [0, 0.05, 2.5]] as const) m.add(G.sphere, 0xc98f4e, 0.05 + dx, 0.868, 0.28 + dz, 0, ry, 0, 0.1, 0.05, 0.065);
    sc.add(m.mesh());
    // Dos copas de albariño: pie y tallo finos, cáliz de cristal y el vino dentro
    {
      const prof = [[0.032, 0], [0.006, 0.006], [0.0045, 0.1], [0.02, 0.118], [0.034, 0.15], [0.036, 0.18], [0.033, 0.205]].map(([x, y]) => new THREE.Vector2(x, y));
      const glassG = new THREE.LatheGeometry(prof, 18);
      const wineG = new THREE.CylinderGeometry(0.031, 0.021, 0.055, 18);
      const glassM = new THREE.MeshStandardMaterial({ color: 0xdfeaf0, transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
      const wineM = new THREE.MeshStandardMaterial({ color: 0xe6d680, transparent: true, opacity: 0.85, roughness: 0.2 });
      for (const sx of [-1, 1]) {
        const gl = new THREE.Mesh(glassG, glassM);
        gl.position.set(sx * 0.32, 0.785, -0.25);
        gl.userData.noCast = true;
        const w = new THREE.Mesh(wineG, wineM);
        w.position.set(sx * 0.32, 0.785 + 0.15, -0.25);
        w.userData.noCast = true;
        sc.add(gl, w);
      }
    }

    // Plato de zamburiñas
    this.plate.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.02, 28), toon({ color: 0xffffff })));
    for (let i = 0; i < 6; i++) {
      const s = makeScallop();
      const a = (i / 6) * Math.PI * 2;
      s.root.position.set(Math.cos(a) * 0.1, 0.012, Math.sin(a) * 0.1);
      s.root.rotation.y = -a + Math.PI / 2; // la charnela hacia el centro del plato
      (s.meat.material as THREE.MeshStandardMaterial).color.set(0xeec691);
      this.plate.add(s.root);
    }
    // El plato, algo más cerca de ella (la mesa es pequeña: está entre los dos) y la zamburiña que se come, la
    // de su lado
    this.plate.position.set(-0.24, 0.8, 0.05);
    sc.add(this.plate);
    this.bite = this.plate.children[4] as THREE.Group;
    this.biteMeat = this.bite.children.slice(1);

    // Azul y Gas sentados uno frente al otro
    this.azul = makePerson(AZUL_DIARIO);
    this.gas = makePerson(GAS_DIARIO);
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

  /** Dónde está la zamburiña que se come, para encuadrarla. */
  bitePos() {
    return this.bite.getWorldPosition(new THREE.Vector3());
  }

  /** Empieza: la coge del plato, se la come y deja la concha (el tiempo lo frena la cámara lenta de la escena). */
  eat() {
    if (this.eatT >= 0) return;
    this.eatT = 0;
    if (this.post) rigPost.delete(this.post);
    if (this.biteHome.lengthSq() === 0) {
      this.biteHome.copy(this.bite.position);
      this.biteHomeQ.copy(this.bite.quaternion);
    }
    this.bite.position.copy(this.biteHome);
    this.bite.quaternion.copy(this.biteHomeQ);
    for (const o of this.biteMeat) o.visible = true;
    this.bite.getWorldPosition(this.biteFrom);
    this.shine.scale.setScalar(0.16);
    this.scene.add(this.shine);
    const a = this.azul;
    const r = a.rig;
    if (!r) return;
    const side = r.bones.get('RightHand') === a.handR.parent ? 'Right' : 'Left';
    const B = (n: string) => r.bones.get(side + n)!;
    const t = new THREE.Vector3();
    const pole = new THREE.Vector3();
    const q = new THREE.Vector3();
    const v = new THREE.Vector3();
    const headQ = new THREE.Quaternion();
    const X = new THREE.Vector3(1, 0, 0);
    this.post = () => {
      if (!a.root.parent || this.eatT < 0) return;
      const e = this.eatT;
      const w = sstep(e, 0, 0.32) * (1 - sstep(e, EAT.down, EAT.end));
      if (w <= 0) return;
      a.root.updateWorldMatrix(true, true);
      const fx = Math.sin(a.root.rotation.y), fz = Math.cos(a.root.rotation.y);
      // La cabeza baja un poco hacia la zamburiña al acercarla y se echa atrás al comérsela
      const nod = 0.16 * sstep(e, EAT.grab, EAT.lips) * (1 - sstep(e, EAT.tilt, EAT.back)) - 0.1 * sstep(e, EAT.tilt, EAT.gone) * (1 - sstep(e, EAT.back, EAT.down));
      const hb = r.bones.get('Head')!;
      hb.quaternion.multiply(headQ.setFromAxisAngle(X, nod));
      hb.updateWorldMatrix(false, false);
      // La boca: delante y algo por encima del hueso de la cabeza (que está en la base del cráneo), en los ejes de la cabeza
      hb.getWorldPosition(q);
      const hq = hb.getWorldQuaternion(new THREE.Quaternion());
      this.mouth.copy(v.set(0, 0.035, 0.11).applyQuaternion(hq)).add(q);
      // Dónde va la charnela de la concha (donde la pellizcan los dedos) y hacia dónde apunta su borde ancho
      const lift = sstep(e, EAT.grab, EAT.lips);
      const ret = sstep(e, EAT.back, EAT.down);
      const toMouth = v.copy(this.mouth).sub(this.biteFrom);
      // En el plato, apuntando hacia fuera (hacia Gas); en la boca, el borde ancho a los labios
      const flatDir = this.shellUp.set(fx, 0, fz);
      this.shellDir.copy(flatDir).lerp(toMouth.clone().normalize(), lift * (1 - ret)).normalize();
      const len = 0.075; // de la charnela al borde
      const atMouth = this.mouth.clone().addScaledVector(this.shellDir, -len - 0.006);
      // Arco: sube por encima del plato antes de ir hacia la boca, y lo mismo al volver
      const k = lift * (1 - ret);
      this.grip.copy(this.biteFrom).lerp(atMouth, k);
      this.grip.y += Math.sin(Math.PI * k) * 0.05;
      // Al comérsela, se acerca un poco más a los labios
      this.grip.addScaledVector(this.shellDir, 0.02 * sstep(e, EAT.lips, EAT.tilt) * (1 - sstep(e, EAT.gone, EAT.back)));
      // Antes de cogerla, la mano llega desde arriba (la muñeca alta, los dedos bajan a la concha)
      const reach = sstep(e, 0.05, EAT.reach);
      const hover = (1 - sstep(e, EAT.reach - 0.08, EAT.grab)) * 0.06 + ret * sstep(e, EAT.down - 0.2, EAT.down) * 0.05;
      const ax = B('ForeArm').getWorldPosition(new THREE.Vector3());
      const toTarget = this.gripDir.copy(this.grip).sub(ax).normalize();
      t.copy(this.grip).addScaledVector(toTarget, -0.13);
      t.y += 0.045 * (1 - k) + hover;
      // Desde donde estaba la mano (en reposo) hasta la concha
      if (reach < 1) {
        const rest = B('Hand').getWorldPosition(new THREE.Vector3());
        t.lerp(rest, 1 - reach);
      }
      // El codo, abierto hacia fuera, por delante y más bajo que la mano: el brazo no queda tieso
      const sh = B('Arm').getWorldPosition(new THREE.Vector3());
      const sd = side === 'Right' ? -1 : 1;
      pole.set(sh.x + fx * 0.25 + fz * sd * 0.55, sh.y - 0.55, sh.z + fz * 0.25 - fx * sd * 0.55);
      // Pinza: índice y pulgar se juntan sobre la charnela; corazón, anular y meñique, algo recogidos
      const pinch = sstep(e, EAT.reach - 0.1, EAT.grab) * (1 - sstep(e, EAT.down - 0.1, EAT.down + 0.15));
      for (const [f, ang] of [['Index', 0.22], ['Middle', 0.36], ['Ring', 0.5], ['Pinky', 0.55], ['Thumb', 0.12]] as const)
        for (const i of [1, 2, 3]) {
          const fb = r.bones.get(`${side}Hand${f}${i}`);
          if (!fb) continue;
          this.fingerQ.setFromAxisAngle(FINGER_AXIS, ang * pinch);
          fb.quaternion.multiply(this.fingerQ);
        }
      const tip = (f: string, o: THREE.Vector3) => (r.bones.get(`${side}Hand${f}4`) ?? r.bones.get(`${side}Hand${f}3`) ?? r.bones.get(`${side}Hand`)!).getWorldPosition(o);
      const measure = () => {
        a.root.updateWorldMatrix(true, true);
        tip('Thumb', this.tipA);
        tip('Index', this.tipB);
        this.gripWorld.copy(this.tipA).lerp(this.tipB, 0.5);
      };
      // Dos pasadas: la segunda corrige lo que separa la pinza de los dedos de donde tiene que estar la concha
      // (la mano no mide lo mismo en cada postura). Antes la concha acababa bajo la barbilla
      const q0 = [B('Arm').quaternion.clone(), B('ForeArm').quaternion.clone(), B('Hand').quaternion.clone()];
      twoBone(B('Arm'), B('ForeArm'), B('Hand'), t, pole, w);
      if (reach >= 1 || e > EAT.reach)
        for (let it = 0; it < 3; it++) {
          measure();
          t.add(v.copy(this.grip).sub(this.gripWorld).multiplyScalar(w));
          B('Arm').quaternion.copy(q0[0]);
          B('ForeArm').quaternion.copy(q0[1]);
          B('Hand').quaternion.copy(q0[2]);
          twoBone(B('Arm'), B('ForeArm'), B('Hand'), t, pole, w);
        }
      measure();
    };
    rigPost.add(this.post);
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
      const e = this.eatT;
      // Se inclina hacia la mesa para cogerla y se endereza para comérsela
      if (this.azul.rig) leanTorso(this.azul, 0.2 * sstep(e, 0.02, EAT.reach) * (1 - sstep(e, EAT.grab, EAT.lips)) + 0.12 * sstep(e, EAT.back, EAT.down) * (1 - sstep(e, EAT.down, EAT.end)), 0, 0);
      const k = Math.min(1, e / 1.0);
      // Sin esqueleto (modo ligero): el brazo a la boca a mano
      if (!this.azul.rig) {
        this.azul.armR.rotation.x = -Math.sin(k * Math.PI * 0.5) * 1.1;
        this.azul.elbowR.rotation.x = -Math.sin(k * Math.PI * 0.5) * 1.9;
      }
      const held = e > EAT.grab - 0.04 && e < EAT.down;
      if (held && this.azul.rig && this.gripWorld.lengthSq() > 0) {
        // La concha sale de entre el pulgar y el índice, cogida por la charnela, con el borde ancho hacia donde va
        const d = this.shellDir;
        const at = this.gripWorld.clone().addScaledVector(d, 0.012);
        at.y = Math.max(at.y, this.biteFrom.y + 0.008);
        this.bite.position.copy(this.plate.worldToLocal(at));
        // Al comérsela, se inclina hacia la boca: la carne mira a los labios
        const tilt = 0.9 * sstep(e, EAT.lips, EAT.tilt) * (1 - sstep(e, EAT.gone + 0.05, EAT.back));
        const z = this.basisY.copy(d).normalize();
        const x = this.basisX.set(0, 1, 0).cross(z).normalize();
        const y = new THREE.Vector3().crossVectors(z, x);
        this.basisM.makeBasis(x, y, z);
        this.bite.quaternion.setFromRotationMatrix(this.basisM).multiply(this.fingerQ.setFromAxisAngle(FINGER_AXIS, -tilt));
        // (los ejes de la concha están en los del plato, que no gira)
      } else if (!held && this.azul.rig && e >= EAT.down) {
        // Vacía, otra vez en su sitio del plato
        this.bite.position.copy(this.biteHome);
        this.bite.quaternion.copy(this.biteHomeQ);
      } else if (!this.azul.rig && e > 0.22 && e < 1.14) {
        this.bite.position.copy(this.plate.worldToLocal(this.azul.handR.getWorldPosition(new THREE.Vector3())));
        this.bite.rotation.set(0, 0, -0.55);
      }
      const eaten = this.biteMeat[0] && !this.biteMeat[0].visible;
      const sm = this.shine.material;
      sm.opacity = !eaten ? sstep(e, 0.3, 0.75) * (0.42 + Math.sin(this.t * 3) * 0.08) : Math.max(0, sm.opacity - dt * 3);
      this.bite.getWorldPosition(this.shine.position);
      if (e >= EAT.gone && !eaten) {
        for (const o of this.biteMeat) o.visible = false;
        if (!this.azul.rig) this.bite.visible = false;
        audio.pickup();
        vibrate(30);
      }
      if (e > EAT.end && this.post) {
        rigPost.delete(this.post);
        this.post = null;
        leanTorso(this.azul, 0, 0, 0);
      }
    }
    camera.position.lerp(this.camPos, Math.min(1, dt * 2));
    camera.lookAt(this.camLook);
    this.sky.update(camera, dt);
  }
}
