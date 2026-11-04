import * as THREE from 'three';
import { Sky, Sun, glowTexture, toon } from '../core/gfx';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, animatePerson, type Person, type PersonLook } from '../entities/models';
import { canvasTex } from './deco';

// Final del capítulo 3: Logroño, de fiesta. La Calle Laurel de noche: bares de tapas a los dos lados,
// rótulos, guirnaldas y la calle llena. Azul y Gas, bailando en medio.

const WALLS = [0xe4c79a, 0xd9a877, 0xeadbbf, 0xc98d5e, 0xe8d3ae];
const BARS = ['Bar Soriano', 'La Tavina', 'Blanco y Negro', 'Bar Páganos', 'Torrecilla', 'Pata Negra'];
const CROWD: PersonLook[] = [
  { skin: 0xe8b894, shirt: 0x2d2d3a, pants: 0x3b4a6b, hair: 0x2b1d14, hairStyle: 'short', male: true },
  { skin: 0xf0c8a6, shirt: 0xb4364c, pants: 0x222222, hair: 0x6b3f22, hairStyle: 'straight' },
  { skin: 0xd9a27c, shirt: 0x3a6a5a, pants: 0x2a2a2a, hair: 0x1f1610, hairStyle: 'short', male: true },
  { skin: 0xf3d2b6, shirt: 0xd8cfc0, pants: 0x3b4a6b, hair: 0x9a6a3a, hairStyle: 'straight' },
  { skin: 0xe2b08c, shirt: 0x5a4a78, pants: 0x222222, hair: 0x3a2414, hairStyle: 'short', male: true, beard: true },
];

export class Laurel {
  scene = new THREE.Scene();
  private sky: Sky;
  private azul: Person;
  private gas: Person;
  private crowd: { p: Person; dance: boolean }[] = [];
  private t = 0;

  constructor() {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0x1a1430, 18, 70);
    this.sky = new Sky({ top: 0x0b1030, mid: 0x1b1f4a, bottom: 0x5a3050, stars: 700 });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0x8f8fd8, 0x3a2a24, 0.75));
    new Sun(sc, 0xb0c0ff, 0.35, new THREE.Vector3(-0.3, 1, 0.3), 14);

    const m = new Merger();
    const L = 44;
    const W = 3.4; // media anchura de la calle
    m.add(G.box, 0x6b6660, 0, -0.05, 0, 0, 0, 0, W * 2, 0.1, L * 2);
    for (const s of [-1, 1]) {
      let i = 0;
      for (let z = -L + 4; z < L; z += 8, i++) {
        const h = 8 + ((i * 3) % 4);
        const c = WALLS[(i + (s > 0 ? 2 : 0)) % WALLS.length];
        m.add(G.box, c, s * (W + 3), h / 2, z, 0, 0, 0, 6, h, 7.96);
        m.add(G.box, 0xa9573a, s * (W + 3), h + 0.15, z, 0, 0, 0, 6.3, 0.3, 8.1);
        // Barra iluminada abajo y balcones arriba
        m.add(G.box, 0x2a1d16, s * (W + 0.02), 1.5, z, 0, 0, 0, 0.06, 3, 6.6);
        m.add(G.box, 0xffc680, s * (W - 0.01), 1.35, z - 1.2, 0, 0, 0, 0.04, 2.1, 2.6);
        m.add(G.box, 0xffc680, s * (W - 0.01), 1.35, z + 1.9, 0, 0, 0, 0.04, 2.1, 1.6);
        for (let f = 0; f * 3 + 5 < h; f++)
          for (const o of [-2, 2]) {
            m.add(G.box, 0x3a4250, s * (W + 0.02), 4.6 + f * 3, z + o, 0, 0, 0, 0.06, 1.6, 1.1);
            m.add(G.box, 0x24242a, s * (W - 0.3), 3.75 + f * 3, z + o, 0, 0, 0, 0.6, 0.06, 1.5);
          }
      }
    }
    sc.add(m.mesh());

    // Rótulos de los bares
    let n = 0;
    for (const s of [-1, 1])
      for (let z = -32; z < 40; z += 16, n++) {
        const name = BARS[n % BARS.length];
        const tex = canvasTex((ctx, w, h) => {
          ctx.fillStyle = '#7a1f3d';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#ffe6b0';
          ctx.font = 'bold 54px Georgia, serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(name, w / 2, h / 2 + 3);
        }, 512, 96);
        const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.75), new THREE.MeshBasicMaterial({ map: tex }));
        p.position.set(s * (W - 0.03), 3.3, z);
        p.rotation.y = -s * Math.PI / 2;
        sc.add(p);
      }

    // Guirnaldas cruzando la calle
    const bulb = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd38a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let z = -36; z <= 36; z += 6)
      for (let k = 0; k <= 10; k++) {
        const b = new THREE.Sprite(bulb);
        const u = k / 10;
        b.position.set(-W + u * W * 2, 5.2 - Math.sin(u * Math.PI) * 0.8, z);
        b.scale.setScalar(0.34);
        sc.add(b);
      }
    for (const z of [-12, 0, 12]) {
      const l = new THREE.PointLight(0xffb878, 26, 22, 1.5);
      l.position.set(0, 4.4, z);
      sc.add(l);
    }

    // La gente, con su vaso: unos bailan y otros hablan
    const glass = new THREE.CylinderGeometry(0.035, 0.03, 0.12, 8);
    const glassMat = toon({ color: 0xe9c75a, emissive: 0x4a3a10 });
    for (let i = 0; i < 18; i++) {
      const lk = CROWD[i % CROWD.length];
      const p = makePerson(lk);
      const a = i * 2.4;
      const r = 1.7 + (i % 5) * 0.75;
      p.root.position.set(THREE.MathUtils.clamp(Math.cos(a) * r, -W + 0.5, W - 0.5), 0, Math.sin(a) * r * 3.2);
      p.root.rotation.y = Math.atan2(-p.root.position.x, -p.root.position.z) + (i % 3) * 0.6;
      const g = new THREE.Mesh(glass, glassMat);
      g.position.y = -0.03;
      p.handR.add(g);
      sc.add(p.root);
      this.crowd.push({ p, dance: i % 2 === 0 });
    }

    this.azul = makePerson(MARGAUX_LOOK);
    this.gas = makePerson(MARC_LOOK);
    this.azul.root.position.set(-0.42, 0, 0);
    this.gas.root.position.set(0.42, 0, 0);
    this.azul.root.rotation.y = Math.PI / 2;
    this.gas.root.rotation.y = -Math.PI / 2;
    sc.add(this.azul.root, this.gas.root);
  }

  /** Plano medio de los dos. */
  readonly mid = new THREE.Vector3(0, 1.35, 0);

  update(dt: number, camera: THREE.Camera) {
    this.t += dt;
    animatePerson(this.azul, dt, 'dance', 0, this.t * 6);
    animatePerson(this.gas, dt, 'dance', 0, this.t * 6 + 1);
    this.crowd.forEach((c, i) => animatePerson(c.p, dt, c.dance ? 'dance' : 'talk', 0, this.t * 6 + i));
    this.sky.update(camera, dt);
  }
}
