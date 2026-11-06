import * as THREE from 'three';
import { G, Merger, makeCar, mergedMat, CarRig, type PersonLook } from '../entities/models';
import { profile } from '../entities/vehiclesHD';
import { Sky, Sun, glowTexture, applyShadows } from '../core/gfx';
import { setSurface, Surf } from '../core/surfaces';
import { cinema } from '../core/cinema';
import { MARGAUX_LOOK } from '../data/characters';
import { canvasTex, streetSignTexture } from './deco';

// Sant Joan, de madrugada: el taxi por el Camí de sa Farola, como en Street View. Asfalto gastado con su línea
// discontinua, arcén de tierra roja, coches aparcados a los dos lados, pinos enormes que cierran la carretera
// por arriba, muro de piedra seca a la derecha, farolas altas de hormigón y postes con el cable.

const EARTH = 0x8a4f33;
setSurface(EARTH, Surf.Sand);
const ASPHALT = 0x4a4a50;
const LEN = 300;
/** Carril de la derecha, mirando hacia +z. */
const LANE_X = -1.75;
const FROM_Z = 8;
const TO_Z = 232;
const RIDE_SECS = 15.5;

const TAXI_DRIVER: PersonLook = { skin: 0xe2b08c, shirt: 0xf2f2ee, pants: 0x2a2a2a, hair: 0x4a4a4a, hairStyle: 'short', male: true };

/** Taxi de Menorca: blanco, con su cajetín en el techo y la luz verde encendida. */
export function makeTaxi() {
  const c = makeCar(0xf4f4ef, { luggage: false, joy: false, driver: TAXI_DRIVER, passenger: MARGAUX_LOOK });
  const tex = canvasTex((x, w, h) => {
    x.fillStyle = '#fbfbf2';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#16365a';
    x.font = 'bold 74px Arial, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('TAXI', w / 2, h / 2 + 3);
  }, 256, 96);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.17, 0.2), new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false }));
  sign.position.set(0, 1.57, -0.72);
  c.body.add(sign);
  const green = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0x38ff6a, fog: false, toneMapped: false }));
  green.position.set(0.36, 1.52, -0.58);
  c.body.add(green);
  // Los pilotos, encendidos: de noche se ven desde lejos
  const tail = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff2a1e, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const s of [-1, 1]) {
    const t = new THREE.Sprite(tail);
    t.position.set(s * 0.62, 0.86, -2.22);
    t.scale.setScalar(0.5);
    c.body.add(t);
  }
  return c;
}

/** Un pino de los de la foto: tronco enorme y torcido que se inclina hacia la carretera (+x) y copa ancha y plana. */
function pineGeo(seed: number) {
  const m = new Merger();
  const bark = [0x6b4a32, 0x5a3e28, 0x6b5a46][seed % 3];
  let x = 0, y = 0, a = 0.1 + seed * 0.05, r = 0.8;
  const LEG = 2.3;
  for (let i = 0; i < 5; i++) {
    const nx = x + Math.sin(a) * LEG, ny = y + Math.cos(a) * LEG;
    m.add(G.cyl, bark, (x + nx) / 2, (y + ny) / 2, 0, 0, 0, -a, r, LEG + 0.2, r);
    x = nx;
    y = ny;
    a += 0.07 + (i === 2 ? 0.2 : 0) + (seed === 1 && i === 1 ? -0.1 : 0);
    r *= 0.84;
  }
  // Las ramas gordas: una sigue sobre la carretera y dos se abren a los lados
  const tips: [number, number, number][] = [];
  for (const [ba, bz, len] of [[0.95, 0.5, 4.4], [0.3, -1.6, 3.4], [-0.25, 1.5, 3.2], [1.25, -0.8, 3.6]] as const) {
    const ex = x + Math.sin(ba) * len, ey = y + Math.cos(ba) * len, ez = bz * 1.3;
    m.add(G.cyl, bark, (x + ex) / 2, (y + ey) / 2, ez / 2, Math.atan2(ez, ey - y) * 0.9, 0, -ba, r * 0.62, Math.hypot(ex - x, ey - y, ez) + 0.1, r * 0.62);
    tips.push([ex, ey, ez]);
  }
  // Copa: matas anchas y planas, oscuras por debajo y más claras por arriba
  for (const [tx, ty, tz] of tips)
    for (let k = 0; k < 6; k++) {
      const an = (k / 6) * Math.PI * 2 + seed;
      const rr = 1.5 + (k % 3) * 0.7;
      m.add(G.bush, k % 2 ? 0x2f5a2c : 0x3a6a34, tx + Math.cos(an) * rr, ty + Math.sin(k * 2.3) * 0.4, tz + Math.sin(an) * rr, 0, k, 0, 3.6, 1.45, 3.6);
    }
  return m.build();
}

// Las siluetas de los coches aparcados: las mismas curvas que el coche de verdad, en una sola geometría
const CAR = {
  body: profile([[-2.05, 0.3], [2.03, 0.3], [2.12, 0.46], [2.1, 0.68], [1.95, 0.82], [1.15, 0.98], [0.93, 1.02], [-1.84, 1.06], [-2.05, 0.98], [-2.12, 0.62]], 1.76, 0.07),
  glass: profile([[-1.92, 1.02], [-1.72, 1.34], [-1.4, 1.42], [0.1, 1.41], [0.96, 1.0]], 1.54, 0.05),
  roof: profile([[-1.68, 1.36], [-1.4, 1.45], [0.12, 1.44], [0.3, 1.36]], 1.46, 0.04),
};
const VAN = {
  body: profile([[-2.5, 0.34], [2.5, 0.34], [2.58, 0.5], [2.52, 0.86], [2.2, 1.08], [1.55, 1.5], [1.1, 2.12], [0.85, 2.3], [-2.38, 2.34], [-2.52, 2.2], [-2.56, 0.7]], 1.96, 0.08),
  glass: profile([[1.68, 1.28], [1.58, 1.32], [1.16, 1.95], [0.86, 2.06], [0.3, 2.06], [0.3, 1.3]], 1.98, 0),
};
const WHEEL = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 18).rotateZ(Math.PI / 2);
const RIM = new THREE.CylinderGeometry(0.2, 0.2, 0.235, 12).rotateZ(Math.PI / 2);

/** Coche aparcado en el arcén, con su silueta, lunas, ruedas, faros y pilotos. ry = 0 mira hacia +z; 1, hacia -z. */
function parked(m: Merger, x: number, z: number, c: number, kind: 'car' | 'van', ry: number) {
  const Y = ry ? Math.PI : 0;
  const dz = (d: number) => (ry ? -d : d);
  const L = kind === 'van' ? 5.1 : 4.2, W = kind === 'van' ? 1.96 : 1.76;
  if (kind === 'van') {
    m.add(VAN.body, c, x, 0, z, 0, Y, 0);
    m.add(VAN.glass, 0x223040, x, 0, z, 0, Y, 0);
    m.add(G.box, 0x2c3540, x, 0.44, z, 0, 0, 0, W + 0.03, 0.2, L - 0.3);
    m.add(G.box, 0x3a3f46, x, 2.42, z + dz(-0.3), 0, 0, 0, 0.7, 0.1, 0.9);
  } else {
    m.add(CAR.body, c, x, 0, z, 0, Y, 0);
    m.add(CAR.glass, 0x223040, x, 0, z, 0, Y, 0);
    m.add(CAR.roof, c, x, 0, z, 0, Y, 0);
    m.add(G.box, 0x24262a, x, 0.38, z, 0, 0, 0, W + 0.02, 0.15, L - 0.1);
    for (const s of [-1, 1]) m.add(G.rbox, c, x + s * (W / 2 + 0.06), 1.06, z + dz(0.78), 0, 0, 0, 0.14, 0.09, 0.1);
  }
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const wx = x + sx * (W / 2 - 0.1), wz = z + sz * (L / 2 - 0.82);
    m.add(WHEEL, 0x151515, wx, 0.33, wz);
    m.add(RIM, 0x8d9096, wx, 0.33, wz);
  }
  const front = L / 2 + (kind === 'van' ? 0.1 : 0.06), rear = L / 2 + 0.04;
  for (const s of [-1, 1]) {
    m.add(G.rbox, 0xeef0e8, x + s * (W / 2 - 0.26), 0.72, z + dz(front - 0.08), 0, 0, 0, 0.36, 0.12, 0.05);
    m.add(G.rbox, 0x8a1a1e, x + s * (W / 2 - 0.22), kind === 'van' ? 1.0 : 0.82, z + dz(-rear), 0, 0, 0, 0.3, 0.13, 0.05);
  }
  m.add(G.box, 0xf0f0ea, x, 0.54, z + dz(front), 0, 0, 0, 0.5, 0.11, 0.02);
  m.add(G.box, 0xf0f0ea, x, 0.56, z + dz(-rear - 0.03), 0, 0, 0, 0.5, 0.11, 0.02);
}

export class TaxiRide {
  scene = new THREE.Scene();
  private sky: Sky;
  private sun: Sun;
  private taxi = makeTaxi();
  private rig: CarRig;
  private t = 0;
  private prevZ = FROM_Z;
  private fill = new THREE.PointLight(0xffc48a, 16, 22, 1.5);
  done = false;

  constructor() {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0x0d1430, 28, 150);
    this.sky = new Sky({ top: 0x02030f, mid: 0x0b1440, bottom: 0x1d2350, stars: 1400 });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0x8090c8, 0x1a2030, 1.05));
    this.sun = new Sun(sc, 0xa9bcff, 0.7, new THREE.Vector3(-0.3, 1, 0.55), 26);

    const m = new Merger();
    const midZ = LEN / 2;
    // Suelo del pinar, arcén de tierra roja y el asfalto, con su línea discontinua y sus remiendos
    m.add(G.box, 0x4f5a34, 0, -0.06, midZ, 0, 0, 0, 420, 0.1, LEN + 220);
    for (const s of [-1, 1]) m.add(G.box, EARTH, s * 5.25, -0.005, midZ, 0, 0, 0, 3.5, 0.03, LEN + 120);
    m.add(G.box, ASPHALT, 0, 0.012, midZ, 0, 0, 0, 7, 0.02, LEN + 120);
    for (let z = -50; z < LEN + 60; z += 5.5) m.add(G.box, 0xdcd8cc, 0, 0.026, z, 0, 0, 0, 0.1, 0.006, 2.6);
    for (let i = 0; i < 22; i++) m.add(G.box, 0x3f3f46, ((i * 37) % 11) * 0.5 - 2.5, 0.024, 10 + i * 13.5, 0, i * 0.3, 0, 0.8 + (i % 3) * 0.5, 0.005, 1.2 + (i % 4) * 0.7);

    // A la derecha, el muro de piedra seca con su remate irregular y la maleza asomando por encima
    const WALL_X = -7.3;
    m.add(G.box, 0xbfae92, WALL_X, 0.58, midZ, 0, 0, 0, 0.7, 1.16, LEN + 120);
    for (let z = -50, i = 0; z < LEN + 60; z += 1.05, i++) {
      m.add(i % 2 ? G.rock : G.crag, i % 3 ? 0xa89a80 : 0xbaa98c, WALL_X + Math.sin(i * 2.1) * 0.12, 1.18 + (i % 4) * 0.03, z, 0, i, 0, 0.62, 0.26 + (i % 3) * 0.07, 0.72);
      if (i % 4 === 0) m.add(G.bush, i % 8 ? 0x3e6e34 : 0x4a7c3c, WALL_X - 1.05, 1.6 + (i % 3) * 0.25, z + 0.3, 0, i, 0, 2.2, 1.9, 2.5);
      if (i % 9 === 0) m.add(G.crag, 0x9a8a70, WALL_X + 0.55, 0.14, z, 0, i, 0, 0.5, 0.26, 0.5);
    }
    // A la izquierda, matorral entre los pinos y hierba seca al borde del arcén
    for (let i = 0; i < 64; i++) {
      const z = -40 + i * 5.4 + Math.sin(i * 1.7) * 1.6;
      m.add(G.bush, i % 3 ? 0x3e6e34 : 0x57803e, 8.3 + Math.sin(i * 2.7) * 1.2, 0.8 + (i % 3) * 0.25, z, 0, i, 0, 2.6, 1.9, 2.8);
      if (i % 2) m.add(G.tuft, 0x8d8f4a, 6.9, 0, z + 1.2, 0, i, 0, 1.2, 1, 1.2);
    }

    // Coches aparcados a los dos lados, en el arcén, como en la foto
    const WHITE = 0xf1f1ec, SIL = 0xb9bdc2, DARK = 0x2c3038, RED = 0x8a2a2a, BLUE = 0x24345e, BEIGE = 0xc9bfa8;
    const R: [number, 'car' | 'van', number][] = [[14, 'car', SIL], [24, 'van', WHITE], [36, 'car', DARK], [47, 'car', RED], [60, 'car', BEIGE], [73, 'car', SIL], [85, 'van', BLUE], [100, 'car', WHITE], [114, 'car', DARK], [127, 'car', SIL], [146, 'car', RED], [158, 'car', WHITE], [175, 'van', SIL], [189, 'car', BLUE], [204, 'car', BEIGE], [221, 'car', SIL], [238, 'car', DARK]];
    const LF: [number, 'car' | 'van', number][] = [[20, 'van', WHITE], [33, 'car', BEIGE], [44, 'car', SIL], [58, 'car', DARK], [70, 'car', WHITE], [88, 'car', RED], [99, 'car', SIL], [116, 'van', WHITE], [131, 'car', BLUE], [149, 'car', SIL], [165, 'car', DARK], [181, 'car', WHITE], [197, 'car', RED], [214, 'van', SIL], [230, 'car', BEIGE]];
    const cars = new Merger(false);
    for (const [z, k, c] of R) parked(cars, -4.85 - ((z * 3) % 5) * 0.06, z, c, k, 0);
    for (const [z, k, c] of LF) parked(cars, 4.85 + ((z * 7) % 5) * 0.06, z, c, k, 1);
    sc.add(cars.mesh());

    // Farolas altas de hormigón, a la derecha, con su brazo y su luminaria rectangular
    const lampZ: number[] = [];
    for (let z = 4; z < LEN + 40; z += 33) lampZ.push(z);
    for (const z of lampZ) {
      m.add(new THREE.CylinderGeometry(0.075, 0.13, 8, 10), 0xc8c4bc, -6.5, 4, z);
      m.add(G.box, 0xb8b4ac, -6.05, 8, z, 0, 0, 0, 0.95, 0.09, 0.09);
      m.add(G.box, 0x8e9196, -5.45, 8, z, 0, 0, 0, 0.82, 0.16, 0.36);
    }
    // Postes de madera con el cable, a la izquierda
    let prev: number | null = null;
    for (let z = -10; z < LEN + 40; z += 27) {
      m.add(new THREE.CylinderGeometry(0.09, 0.14, 8.6, 8), 0x5a4634, 7.05, 4.3, z, 0, 0, 0.012);
      m.add(G.box, 0x5a4634, 7.05, 8.1, z, 0, 0, 0, 1.2, 0.08, 0.08);
      if (prev !== null)
        for (const dx of [-0.5, 0, 0.5])
          for (let k = 0; k < 4; k++) {
            const a = k / 4, b = (k + 1) / 4;
            const sag = (u: number) => 8.15 - Math.sin(u * Math.PI) * 0.65;
            const z0 = prev + (z - prev) * a, z1 = prev + (z - prev) * b;
            const y0 = sag(a), y1 = sag(b);
            m.add(G.box, 0x121214, 7.05 + dx, (y0 + y1) / 2, (z0 + z1) / 2, Math.atan2(y0 - y1, z1 - z0), 0, 0, 0.018, 0.018, Math.hypot(z1 - z0, y1 - y0));
          }
      prev = z;
    }
    const main = m.mesh();
    sc.add(main);

    // La luz de cada farola: la bombilla, el resplandor y el charco de luz en el asfalto
    const bulb = new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, toneMapped: false });
    const halo = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pool = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffb06a, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending });
    const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const bulbGeo = new THREE.BoxGeometry(0.66, 0.03, 0.26);
    for (const z of lampZ) {
      const b = new THREE.Mesh(bulbGeo, bulb);
      b.position.set(-5.45, 7.91, z);
      b.userData.noCast = true;
      sc.add(b);
      const s = new THREE.Sprite(halo);
      s.position.set(-5.45, 7.85, z);
      s.scale.setScalar(3);
      sc.add(s);
      const p = new THREE.Mesh(poolGeo, pool);
      p.position.set(-3.6, 0.05, z);
      p.scale.set(18, 1, 22);
      p.userData.noCast = true;
      sc.add(p);
    }

    // Los pinos: los de delante, sobre la carretera; los de detrás, el pinar hasta donde se pierde la vista
    const q = new THREE.Quaternion(), e = new THREE.Euler(), mt = new THREE.Matrix4(), ps = new THREE.Vector3(), sz = new THREE.Vector3();
    [pineGeo(0), pineGeo(1), pineGeo(2)].forEach((g, v) => {
      const list: [number, number, number, number][] = [];
      for (let z = -30 + v * 4; z < LEN + 40; z += 13.5 + v) {
        const j = Math.sin(z * 1.3 + v) * 2.5;
        list.push([-9.4 - Math.abs(j) * 0.5, z + j, 0.04 + (Math.sin(z) * 0.2), 1.08 + Math.sin(z * 0.7) * 0.2]);
        list.push([9.9 + Math.abs(j) * 0.6, z + 6 - j, Math.PI + Math.sin(z * 2) * 0.2, 1.12 + Math.cos(z * 0.9) * 0.2]);
      }
      for (let i = 0; i < 42; i++) {
        const side = i % 2 ? 1 : -1;
        list.push([side * (17 + ((i * 13) % 30)), -20 + ((i * 47 + v * 31) % (LEN + 50)), i * 1.3, 0.85 + (i % 4) * 0.14]);
      }
      const im = new THREE.InstancedMesh(g, mergedMat(g), list.length);
      im.frustumCulled = false;
      list.forEach(([x, z, ry, s], i) => {
        q.setFromEuler(e.set(0, ry, 0));
        im.setMatrixAt(i, mt.compose(ps.set(x, 0, z), q, sz.setScalar(s)));
      });
      sc.add(im);
    });

    // La placa de la calle, al empezar
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.34), new THREE.MeshBasicMaterial({ map: streetSignTexture('Camí de sa Farola') }));
    plate.position.set(-6.5, 2.9, 30.05);
    plate.rotation.y = Math.PI;
    sc.add(plate);
    sc.add(new Merger().add(G.cyl, 0x8a8e92, -6.5, 1.5, 30.12, 0, 0, 0, 0.06, 3, 0.06).add(G.box, 0x9aa0a6, -6.5, 2.9, 30.1, 0, 0, 0, 1.54, 0.38, 0.03).mesh());

    // El taxi, con los faros iluminando la carretera
    const t = this.taxi;
    t.root.position.set(LANE_X, 0, FROM_Z);
    sc.add(t.root);
    this.rig = new CarRig(t);
    const head = new THREE.SpotLight(0xfff0d0, 70, 46, 0.52, 0.7, 1.2);
    head.position.set(0, 0.85, 2);
    head.target.position.set(0, 0, 16);
    t.root.add(head, head.target);
    sc.add(this.fill);
    applyShadows(sc);
  }

  /** La carretera a cámara: por detrás, de frente con los faros y desde el arcén, bajo los pinos. */
  start() {
    const p = this.taxi.root.position;
    const V = (x: number, y: number, z: number) => () => new THREE.Vector3(p.x + x, y, p.z + z);
    cinema.play([
      { dur: 5.4, pos: V(-0.4, 2.4, -8), pos2: V(0.6, 1.9, -6.8), look: V(0, 1.5, 9), fov: 56 },
      { dur: 4.6, pos: V(1.6, 0.75, 8.5), pos2: V(1.1, 0.95, 6.6), look: V(0, 0.95, -1), fov: 42 },
      { dur: 5.6, pos: V(2.2, 3.9, 5), pos2: V(-1.2, 7.2, -9), look: V(0, 1, 14), fov: 58 },
    ]);
  }

  /** Avanza el viaje; devuelve true al llegar al final. */
  update(dt: number, camera: THREE.Camera) {
    this.t += dt;
    const k = Math.min(1, this.t / RIDE_SECS);
    // Sale despacio, va a lo suyo y frena un poco al final
    const e = k < 0.12 ? (k * k) / 0.24 : k > 0.9 ? 1 - ((1 - k) * (1 - k)) / 0.2 - 0.06 + 0.0 : k - 0.06;
    const z = FROM_Z + (TO_Z - FROM_Z) * Math.min(1, e / 0.94);
    const v = dt > 0 ? (z - this.prevZ) / dt : 0;
    this.prevZ = z;
    const p = this.taxi.root.position;
    p.z = z;
    this.rig.update(dt, v, 0, 1.2);
    this.fill.position.set(p.x + 2, 3.2, p.z + 1);
    this.sun.follow(p);
    this.sky.update(camera, dt);
    return k >= 1;
  }
}
