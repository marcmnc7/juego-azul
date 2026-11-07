import * as THREE from 'three';
import { makePerson, animatePerson, type Person } from './models';
import { boneAnchor, rigPost } from './rig';
import { twoBone } from './embrace';
import { canvasTex } from '../world/deco';

// Fito en el escenario: de negro, con sombrero, y su guitarra (una Les Paul con el acabado sunburst) colgada de
// verdad: la mano izquierda en el mástil y la derecha rasgueando. Se pasea por el escenario andando, no flotando,
// y un foco cálido le sigue para que se le vea desde el público (y en el vídeo que graba Azul).

/** El contorno de la guitarra (en metros, el mástil hacia +y). Les Paul: cuerpo con una sola cutaway. */
function bodyShape() {
  const p = (x: number, y: number) => new THREE.Vector2(x, y);
  const s = new THREE.Shape();
  s.moveTo(0, -0.245);
  s.splineThru([
    p(0.105, -0.228), p(0.162, -0.15), p(0.158, -0.05), p(0.118, 0.03), p(0.122, 0.11), p(0.095, 0.175), p(0.035, 0.198),
    p(-0.005, 0.18), p(-0.022, 0.13), p(-0.06, 0.118), p(-0.105, 0.105), p(-0.122, 0.05), p(-0.112, 0.0),
    p(-0.152, -0.07), p(-0.158, -0.16), p(-0.108, -0.228), p(0, -0.245),
  ]);
  return s;
}

function sunburst() {
  const t = canvasTex(
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.05, w * 0.5, h * 0.5, w * 0.62);
      g.addColorStop(0, '#f2b04a');
      g.addColorStop(0.45, '#c8641e');
      g.addColorStop(0.8, '#5a1a0c');
      g.addColorStop(1, '#260806');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Las vetas del arce
      ctx.globalAlpha = 0.07;
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = i % 2 ? '#000' : '#fff';
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        const x = Math.random() * w;
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 20, h * 0.3, x - 20, h * 0.7, x + 10, h);
        ctx.stroke();
      }
    },
    256,
    256,
  );
  // UV de ExtrudeGeometry = coordenadas del contorno: se lleva el cuerpo (0,34 × 0,5 m) a 0-1
  t.repeat.set(1 / 0.34, 1 / 0.5);
  t.offset.set(0.5, 0.5);
  return t;
}

export function makeGuitar() {
  const g = new THREE.Group();
  const std = (color: number, rough = 0.5, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bodyShape(), { depth: 0.045, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 10 }),
    new THREE.MeshStandardMaterial({ map: sunburst(), roughness: 0.25, metalness: 0.05 }),
  );
  body.position.z = -0.0225;
  g.add(body);
  const face = 0.03; // delante de la tapa
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.z = rz;
    g.add(m);
    return m;
  };
  const black = std(0x111111, 0.4), chrome = std(0xd8d8d8, 0.2, 0.9), gold = std(0xd8b25a, 0.3, 0.8), cream = std(0xefe6cf, 0.5);
  // Mástil de caoba, diapasón de palosanto con sus incrustaciones, y la pala inclinada con las clavijas
  add(new THREE.BoxGeometry(0.052, 0.44, 0.026), std(0x6b3a1e, 0.45), 0, 0.4, 0.004);
  add(new THREE.BoxGeometry(0.046, 0.43, 0.006), std(0x2a1a12, 0.6), 0, 0.405, 0.02);
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.018, 0.006, 0.002), cream, 0, 0.24 + i * 0.055, 0.0235);
  const head = add(new THREE.BoxGeometry(0.085, 0.16, 0.018), black, 0, 0.69, 0.0);
  head.rotation.x = -0.2;
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6), chrome, sx * 0.055, 0.65 + i * 0.04, -0.004, Math.PI / 2);
  // Pastillas, puente, cordal, golpeador y los cuatro potes dorados
  for (const y of [-0.035, 0.075]) {
    add(new THREE.BoxGeometry(0.075, 0.036, 0.012), cream, 0, y, face);
    add(new THREE.BoxGeometry(0.066, 0.026, 0.004), chrome, 0, y, face + 0.007);
  }
  add(new THREE.BoxGeometry(0.075, 0.01, 0.01), chrome, 0, -0.085, face + 0.002);
  add(new THREE.BoxGeometry(0.07, 0.012, 0.008), chrome, 0, -0.12, face + 0.002);
  const guard = add(new THREE.BoxGeometry(0.06, 0.12, 0.003), cream, 0.075, 0.03, face - 0.004);
  guard.rotation.z = -0.25;
  for (const [x, y] of [[0.085, -0.13], [0.12, -0.1], [0.075, -0.175], [0.115, -0.15]]) add(new THREE.CylinderGeometry(0.011, 0.012, 0.012, 10), gold, x, y, face, 0).rotation.x = Math.PI / 2;
  // Cuerdas, del cordal a la cejuela (finas, solo brillan de cerca)
  const strMat = std(0xe8e8e8, 0.25, 0.9);
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.0012, 0.72, 0.0012), strMat, -0.018 + i * 0.0072, 0.25, face + 0.012);
  // Correa: del botón de abajo, por la espalda, al de arriba (la parte de delante)
  const strap = add(new THREE.BoxGeometry(0.045, 0.5, 0.006), std(0x1a1414, 0.8), -0.12, 0.08, -0.03);
  strap.rotation.z = 0.5;
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

/** Sombrero de ala corta, negro, con cinta. */
function makeHat() {
  const g = new THREE.Group();
  const felt = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 28), felt);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.12, 24), felt);
  crown.position.y = 0.065;
  const dent = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.16), felt);
  dent.position.y = 0.122;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.111, 0.111, 0.022, 24), new THREE.MeshStandardMaterial({ color: 0x5a1a14, roughness: 0.6 }));
  band.position.y = 0.017;
  g.add(brim, crown, dent, band);
  g.scale.set(1, 1, 1.08);
  return g;
}

export class Fito {
  readonly person: Person;
  readonly guitar: THREE.Group;
  /** Foco cálido que le sigue desde arriba y por delante. */
  readonly spot: THREE.SpotLight;
  private fill: THREE.PointLight;
  private back: THREE.PointLight;
  private post: ((dt: number) => void) | null = null;
  private t = 0;
  private prevX = 0;
  private yaw = Math.PI;
  private fret = new THREE.Vector3();
  private strum = new THREE.Vector3();
  private pole = new THREE.Vector3();
  private v = new THREE.Vector3();
  /** Qué mano va al mástil (los nombres de los huesos no siempre coinciden con el lado): se decide al empezar. */
  private fretSide: 'Left' | 'Right' | null = null;

  constructor(sc: THREE.Scene, x: number, y: number, z: number) {
    this.person = makePerson({ skin: 0xe2b08c, shirt: 0x151515, pants: 0x1c2333, hair: 0x2a2420, hairStyle: 'short', male: true, beard: true, shoes: 0x111111 });
    const p = this.person;
    p.root.position.set(x, y, z);
    p.root.rotation.y = Math.PI;
    this.prevX = x;
    sc.add(p.root);
    this.guitar = makeGuitar();
    const hat = makeHat();
    if (p.rig) {
      // Colgada a la altura de la cadera, el mástil hacia su izquierda y arriba
      const a = boneAnchor(p, 'Spine');
      this.guitar.position.set(-0.04, -0.02, 0.17);
      this.guitar.rotation.set(0.08, 0, -1.08);
      a.add(this.guitar);
      const h = boneAnchor(p, 'Head');
      hat.position.set(0, 0.215, 0.0);
      hat.rotation.x = -0.08;
      h.add(hat);
      this.post = (dt) => this.hands(dt);
      rigPost.add(this.post);
    } else {
      this.guitar.position.set(0, 1.05, 0.2);
      this.guitar.rotation.z = -1.08;
      p.body.add(this.guitar);
      hat.position.y = 1.85;
      p.body.add(hat);
    }
    // El escenario solo tiene los haces de colores (falsos): sin luz de verdad encima, Fito era una silueta negra
    this.spot = new THREE.SpotLight(0xffe6c4, 300, 40, 0.3, 0.5, 1);
    this.spot.castShadow = false;
    this.fill = new THREE.PointLight(0xffc8a0, 7, 9, 1);
    this.back = new THREE.PointLight(0x9fb8ff, 9, 8, 1);
    sc.add(this.spot, this.spot.target, this.fill, this.back);
  }

  /** Se pasea (x de destino) a ritmo de concierto: andando de verdad y mirando al público al pararse. */
  update(dt: number, beat: number) {
    this.t += dt;
    const p = this.person;
    const x = p.root.position.x;
    const vx = dt > 0 ? (x - this.prevX) / dt : 0;
    this.prevX = x;
    // Andando, hacia donde va; parado, al público
    const want = Math.PI - (Math.abs(vx) > 0.5 ? Math.sign(vx) * Math.PI * 0.3 : 0);
    const d = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
    this.yaw += d * Math.min(1, dt * 5);
    p.root.rotation.y = this.yaw;
    animatePerson(p, dt, 'walk', Math.min(1, Math.abs(vx) / 2.4));
    if (!p.rig) p.body.position.y = Math.max(0, Math.sin(beat * Math.PI * 2)) * 0.04;
    const r = p.root.position;
    this.spot.position.set(r.x, r.y + 9, r.z - 6);
    this.spot.target.position.set(r.x, r.y + 1.2, r.z);
    this.fill.position.set(r.x + 0.6, r.y + 1.9, r.z - 2.2);
    this.back.position.set(r.x - 0.4, r.y + 2.6, r.z + 1.4);
    this.fill.visible = this.back.visible = this.spot.visible;
  }

  private hands(_dt: number) {
    const p = this.person;
    const r = p.rig;
    if (!r || !p.root.parent || !p.root.visible) return;
    p.root.updateWorldMatrix(true, true);
    const gm = this.guitar.matrixWorld;
    // Mano del mástil, en el tercer traste; la otra, sobre las cuerdas entre las pastillas, rasgueando
    this.fret.set(-0.005, 0.47 + Math.sin(this.t * 1.3) * 0.03, 0.035).applyMatrix4(gm);
    this.strum.set(Math.sin(this.t * 15) * 0.035, 0.03, 0.07).applyMatrix4(gm);
    if (!this.fretSide) {
      const l = r.bones.get('LeftHand')!.getWorldPosition(this.v).distanceTo(this.fret);
      const rr = r.bones.get('RightHand')!.getWorldPosition(this.v).distanceTo(this.fret);
      this.fretSide = l < rr ? 'Left' : 'Right';
    }
    const other = this.fretSide === 'Left' ? 'Right' : 'Left';
    const B = (n: string) => r.bones.get(n)!;
    // Codos hacia abajo y algo hacia fuera y atrás
    const back = this.v.set(0, 0, -1).applyQuaternion(p.root.quaternion);
    for (const [side, target] of [[this.fretSide, this.fret], [other, this.strum]] as const) {
      const sh = B(side + 'Arm').getWorldPosition(this.pole);
      this.pole.copy(sh).addScaledVector(back, 0.35);
      this.pole.y -= 0.6;
      twoBone(B(side + 'Arm'), B(side + 'ForeArm'), B(side + 'Hand'), target, this.pole, 1);
    }
  }

  dispose() {
    if (this.post) rigPost.delete(this.post);
    this.post = null;
  }
}
