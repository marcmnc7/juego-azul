import * as THREE from 'three';
import { Sky, Sun, toon } from '../core/gfx';
import { comicBulbTexture } from '../core/comicTiles';
import { TownHD } from './hd/townHD';
import { AZUL_DIARIO, GAS_DIARIO } from '../data/characters';
import { G, Merger, makePerson, animatePerson, type Person, type PersonLook } from '../entities/models';
import { canvasTex } from './deco';
import { ROOF_GEO } from './ferreries';
import { PinchoGame } from './sideGames';

// Final del capítulo 3: Logroño, de fiesta. La Calle Laurel de noche: bares de tapas a los dos lados (cada uno
// con su color, su puerta abierta, su barra al fondo, su rótulo de bandera y sus barriles de vino en la acera),
// casas de ladrillo y revoco con balcones, guirnaldas y la calle llena. Azul y Gas, bailando en medio.

const WALLS = [0xc98f62, 0xdcc096, 0xb5714c, 0xe6d3ae, 0xcfa476, 0xa9694a];
const BARS = ['Bar Soriano', 'La Tavina', 'Blanco y Negro', 'Bar Páganos', 'Torrecilla', 'Pata Negra', 'El Perchas', 'Bar Sebas'];
const WOODS = [0x3a2418, 0x25382a, 0x4a1f22, 0x1f2a3a, 0x3a2a1a];
const BOARDS = ['#5a1f24', '#1f3a2a', '#2a2a3a', '#6b3a18', '#7a1f3d'];
const CROWD: PersonLook[] = [
  { skin: 0xe8b894, shirt: 0x2d2d3a, pants: 0x3b4a6b, hair: 0x2b1d14, hairStyle: 'short', male: true },
  { skin: 0xf0c8a6, shirt: 0xb4364c, pants: 0x222222, hair: 0x6b3f22, hairStyle: 'straight' },
  { skin: 0xd9a27c, shirt: 0x3a6a5a, pants: 0x2a2a2a, hair: 0x1f1610, hairStyle: 'short', male: true },
  { skin: 0xf3d2b6, shirt: 0xd8cfc0, pants: 0x3b4a6b, hair: 0x9a6a3a, hairStyle: 'straight' },
  { skin: 0xe2b08c, shirt: 0x5a4a78, pants: 0x222222, hair: 0x3a2414, hairStyle: 'short', male: true, beard: true },
];
/** La gente: en corrillos junto a las barras y los barriles. El centro de la calle queda para la cámara y para ellos dos. */
const SPOTS: [number, number][] = [
  [2.1, -13.4], [1.5, -12.6], [2.5, -11.8], [-2.2, -11.2], [-1.6, -10.3], [-2.5, -9.4],
  [2.2, -6.8], [1.6, -6], [2.5, -5], [-2.3, -4.6], [2.3, -1.2], [1.8, -0.1], [2.5, 1],
  [-2.4, 3.4], [-1.8, 4.3], [2.1, 5.4], [1.4, 6.6], [-2, 8.2], [-1.3, 9.1], [2.3, 10.6],
  [0.6, 8.4], [-0.5, 12.4], [1.3, 14.6], [-2.2, 15.4], [2.1, 18.4], [-1.9, 20.6],
];

export class Laurel {
  scene = new THREE.Scene();
  private sky: Sky;
  private azul: Person;
  private gas: Person;
  private pinchos: PinchoGame | null = null;
  private crowd: { p: Person; dance: boolean }[] = [];
  private t = 0;

  constructor() {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0x1a1430, 26, 90);
    // La noche del cap. 2 (perfil noche, poco ambiente, luna azulada con sombras), con el suelo algo cálido: los
    // bares están abiertos. Sin luces de punto: las lámparas solo se ven encendidas
    sc.userData.comicLook = 'noche';
    sc.userData.hemiScale = 0.32;
    this.sky = new Sky({ top: 0x0b1030, mid: 0x1b1f4a, bottom: 0x3a2f5a, stars: 700 });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0x7f84c8, 0x4a3a34, 1.1));
    const moon = new Sun(sc, 0xb8c8ff, 2.0, new THREE.Vector3(-0.3, 1, 0.3), 14);
    moon.light.shadow.normalBias = 0.16;
    moon.light.shadow.bias = -0.0012;

    const m = new Merger();
    const L = 44;
    const W = 3.4; // media anchura de la calle
    const hd = new TownHD();
    // Suelo de losa, con su canal de agua en medio y los bordes de piedra
    // (las losas a la escala del cap. 1: 3,2 m por repetición)
    if (hd) hd.b.box(hd.M.slabs, [0, -0.05, 0], [W * 2, 0.1, L * 2], { tile: 3.2 });
    else m.add(G.box, 0x6b6660, 0, -0.05, 0, 0, 0, 0, W * 2, 0.1, L * 2);
    m.add(G.box, 0x625d56, 0, 0.004, 0, 0, 0, 0, 0.22, 0.01, L * 2);
    for (const s of [-1, 1]) m.add(G.box, 0x8a8378, s * (W - 0.17), 0.018, 0, 0, 0, 0, 0.34, 0.04, L * 2);

    const signs: { name: string; x: number; z: number; s: number; board: string }[] = [];
    for (const s of [-1, 1]) {
      let i = 0;
      for (let z = -L + 4; z < L; z += 8, i++) {
        const k = i + (s > 0 ? 2 : 0);
        const h = 9.8 + ((i * 3) % 4) * 0.9;
        const c = WALLS[k % WALLS.length];
        const wx = s * (W + 3);
        if (hd) {
          hd.wall(wx - 3, wx + 3, z - 3.98, z + 3.98, h, c);
          hd.facade(z - 3.9, z + 3.9, s * W, (s > 0 ? -1 : 1) as 1 | -1, Math.floor((h - 1) / 3), false, false);
        } else m.add(G.box, c, wx, h / 2, z, 0, 0, 0, 6, h, 7.96);
        // Tejado, con su alero asomando sobre la calle
        m.add(ROOF_GEO, 0xb5603b, wx, h + 0.22, z, 0, Math.PI / 2, 0, 8.1, 2 + (i % 3) * 0.3, 6.8);
        // Chimenea e impostas entre plantas
        m.add(G.box, 0xb98f6a, wx - s * 1.2, h + 1.7, z + 1.7, 0, 0, 0, 0.6, 1.2, 0.6);
        m.add(G.box, 0xd9c7a4, s * (W - 0.03), 3.28, z, 0, 0, 0, 0.1, 0.16, 7.96);
        m.add(G.cyl, 0x7c8084, s * (W - 0.09), h / 2, z + 3.86, 0, 0, 0, 0.09, h, 0.09); // bajante

        // El bajo: tablero de madera pintada con la puerta abierta y el escaparate, distintos en cada bar
        const wood = WOODS[k % WOODS.length];
        const fx = (d: number) => s * (W - d); // d metros hacia la calle
        m.add(G.box, wood, fx(0.04), 1.6, z, 0, 0, 0, 0.08, 3.2, 7.7);
        m.add(G.box, 0x8a6a44, fx(0.1), 3.06, z, 0, 0, 0, 0.05, 0.05, 7.7); // moldura
        const doorZ = z + (k % 2 ? 2.15 : -2.15);
        const winZ = z - (k % 2 ? 1.2 : -1.2);
        // La puerta abierta: se ve la barra, los taburetes y las botellas del fondo con la luz cálida
        m.add(G.box, 0xdca566, fx(0.085), 1.28, doorZ, 0, 0, 0, 0.01, 2.5, 1.6);
        m.add(G.box, 0x4a2c1a, fx(0.09), 0.72, doorZ, 0, 0, 0, 0.012, 1.0, 1.6); // barra
        m.add(G.box, 0xc9a06a, fx(0.095), 1.24, doorZ, 0, 0, 0, 0.012, 0.05, 1.66);
        for (let b = 0; b < 8; b++) m.add(G.box, [0x2f5a3a, 0x6b2a2a, 0x3a2a18, 0x8a6a2a][(b + k) % 4], fx(0.092), 1.78, doorZ - 0.68 + b * 0.195, 0, 0, 0, 0.008, 0.26, 0.07);
        m.add(G.box, 0x4a2c1a, fx(0.092), 1.62, doorZ, 0, 0, 0, 0.01, 0.03, 1.5);
        for (const d of [-1, 1]) m.add(G.box, 0x2a1c12, fx(0.12), 1.3, doorZ + d * 0.86, 0, 0, 0, 0.1, 2.6, 0.12); // jambas
        m.add(G.box, 0x2a1c12, fx(0.12), 2.6, doorZ, 0, 0, 0, 0.1, 0.14, 1.84);
        m.add(G.box, 0xffe2a8, fx(0.11), 2.42, doorZ, 0, 0, 0, 0.03, 0.12, 1.5); // tira de luz
        // El escaparate: tres estantes con botellas de verdad de pequeñas, jamones colgando y el zócalo
        const len = 3.3;
        m.add(G.box, 0xf2c88a, fx(0.085), 1.62, winZ, 0, 0, 0, 0.01, 1.74, len);
        m.add(G.box, wood, fx(0.12), 0.42, winZ, 0, 0, 0, 0.08, 0.84, len + 0.2);
        for (const y of [1.12, 1.56, 2.0]) {
          m.add(G.box, 0x4a2c1a, fx(0.1), y, winZ, 0, 0, 0, 0.05, 0.03, len - 0.1);
          const nb = Math.floor((len - 0.2) / 0.095);
          for (let b = 0; b < nb; b++) {
            if ((b * 3 + i + Math.round(y * 9)) % 11 === 0) continue;
            const hb = 0.2 + ((b * 7 + i) % 3) * 0.03;
            m.add(G.cyl, [0x2f5a3a, 0x6b2a2a, 0x3a2a18, 0x8a6a2a, 0x233a4a][(b + i) % 5], fx(0.1), y + 0.02 + hb / 2, winZ - len / 2 + 0.14 + b * 0.095, 0, 0, 0, 0.05, hb, 0.05);
          }
        }
        for (let h2 = 0; h2 < 5; h2++) m.add(G.capsule, 0x7a3a22, fx(0.1), 2.3, winZ - len / 2 + 0.4 + h2 * 0.62, 0, 0, 0, 0.09, 0.12, 0.09);
        for (const dz of [-len / 2, -len / 6, len / 6, len / 2]) m.add(G.box, wood, fx(0.13), 1.62, winZ + dz, 0, 0, 0, 0.04, 1.78, 0.05); // parteluces
        m.add(G.box, wood, fx(0.13), 2.5, winZ, 0, 0, 0, 0.04, 0.05, len + 0.05);
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.74), toon({ color: 0xbcd6e6, transparent: true, opacity: 0.13, roughness: 0.05, depthWrite: false }));
        glass.position.set(fx(0.14), 1.62, winZ);
        glass.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
        sc.add(glass);
        // Barril de vino en la acera, con sus aros, su tapa y dos copas; cada dos bares
        if (i % 2 === k % 2) {
          const bz = winZ + (k % 2 ? -0.9 : 0.9);
          const bx = s * (W - 0.72);
          m.add(new THREE.CylinderGeometry(0.33, 0.33, 0.96, 14), 0x6b4428, bx, 0.48, bz);
          m.add(new THREE.CylinderGeometry(0.39, 0.39, 0.5, 14), 0x7a4e2e, bx, 0.48, bz);
          for (const y of [0.2, 0.76]) m.add(new THREE.CylinderGeometry(0.385, 0.385, 0.04, 14), 0x3a3a3a, bx, y, bz);
          m.add(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 14), 0x8a6a44, bx, 0.97, bz);
          for (const d of [-0.1, 0.13]) {
            m.add(new THREE.CylinderGeometry(0.03, 0.025, 0.1, 8), 0x7a1f30, bx + d, 1.04, bz + d * 0.5);
            m.add(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), 0xdfe8ee, bx + d, 1.02, bz + d * 0.5);
          }
        }
        // Rótulo de bandera sobre la puerta y farol de hierro
        if (i % 2 === 0 || s > 0) signs.push({ name: BARS[(i * 3 + (s > 0 ? 1 : 0)) % BARS.length], x: s * (W - 0.72), z: doorZ, s, board: BOARDS[k % BOARDS.length] });
        m.add(G.box, 0x1e1e1e, s * (W - 0.45), 3.72, doorZ, 0, 0, 0, 0.9, 0.04, 0.04);
      }
      // Los dos extremos de la calle: una casa la cierra
      for (const e of [-1, 1]) {
        const zc = e * (L + 3);
        if (hd) {
          hd.wall(-W - 3, W + 3, zc - 3, zc + 3, 11, WALLS[e > 0 ? 3 : 1]);
          hd.facade(-W, W, zc - e * 3, (e > 0 ? -1 : 1) as 1 | -1, 3);
        } else m.add(G.box, WALLS[3], 0, 5.5, zc, 0, 0, 0, W * 2 + 6, 11, 6);
      }
    }
    sc.add(m.mesh());
    hd?.finish(sc);

    // Rótulos de bandera, colgados de su barra sobre cada puerta
    for (const it of signs) {
      const tex = canvasTex((ctx, w, h) => {
        ctx.fillStyle = it.board;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#e8c98a';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = '#ffe6b0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let size = 64;
        do ctx.font = `bold ${size}px Georgia, serif`;
        while (ctx.measureText(it.name).width > w - 44 && (size -= 3) > 20);
        ctx.fillText(it.name, w / 2, h / 2 + 3);
      }, 512, 128);
      for (const ry of [0, Math.PI]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshBasicMaterial({ map: tex }));
        p.position.set(it.x, 3.46, it.z + (ry ? -0.012 : 0.012));
        p.rotation.y = ry;
        sc.add(p);
      }
    }

    // Guirnaldas cruzando la calle, con su cable
    // (bombillas de tebeo: un círculo de color con su aro de tinta; antes, halos aditivos)
    const bulb = new THREE.SpriteMaterial({ map: comicBulbTexture(), color: 0xffd38a, alphaTest: 0.5 });
    bulb.userData.comicGlow = true;
    const cable = new Merger(false);
    for (let z = -36; z <= 36; z += 6) {
      for (let k = 0; k <= 10; k++) {
        const b = new THREE.Sprite(bulb);
        const u = k / 10;
        b.position.set(-W + u * W * 2, 5.2 - Math.sin(u * Math.PI) * 0.8, z);
        b.scale.setScalar(0.16);
        sc.add(b);
        if (k < 10) {
          const u2 = (k + 1) / 10;
          const x0 = -W + u * W * 2, x1 = -W + u2 * W * 2, y0 = 5.2 - Math.sin(u * Math.PI) * 0.8, y1 = 5.2 - Math.sin(u2 * Math.PI) * 0.8;
          cable.add(G.box, 0x1a1a1a, (x0 + x1) / 2, (y0 + y1) / 2 + 0.03, z, 0, 0, Math.atan2(y1 - y0, x1 - x0), Math.hypot(x1 - x0, y1 - y0), 0.012, 0.012);
        }
      }
    }
    const cm = cable.mesh();
    cm.userData.noCast = true;
    sc.add(cm);

    // La gente, con su vaso: unos bailan y otros hablan
    const glass = new THREE.CylinderGeometry(0.035, 0.03, 0.12, 8);
    const glassMat = toon({ color: 0x7a1f30, emissive: 0x2a0a10 });
    SPOTS.forEach(([x, z], i) => {
      const lk = CROWD[i % CROWD.length];
      const p = makePerson(lk);
      p.root.position.set(x, 0, z);
      p.root.rotation.y = i % 3 === 2 ? Math.atan2(-x, -z) : Math.atan2(SPOTS[i ^ 1]?.[0] - x || 0.1, SPOTS[i ^ 1]?.[1] - z || 0.1);
      const g = new THREE.Mesh(glass, glassMat);
      g.position.y = -0.03;
      p.handR.add(g);
      sc.add(p.root);
      this.crowd.push({ p, dance: i % 3 === 0 });
    });

    this.azul = makePerson(AZUL_DIARIO);
    this.gas = makePerson(GAS_DIARIO);
    this.azul.root.position.set(-0.42, 0, 0);
    this.gas.root.position.set(0.42, 0, 0);
    this.azul.root.rotation.y = Math.PI / 2;
    this.gas.root.rotation.y = -Math.PI / 2;
    sc.add(this.azul.root, this.gas.root);
  }

  /** Quita la barra de pinchos a medias (al saltar de fase en el modo prueba: sus botones se quedaban en pantalla). */
  stopPinchos() {
    this.pinchos?.dispose();
    this.pinchos = null;
  }

  /** Cabeza del camarero de los pinchos (de ahí salen sus bocadillos), o null si no está sirviendo. */
  waiterHead() {
    const w = this.pinchos?.waiter;
    return w ? (w.rig?.bones.get('Head') ?? w.head).getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)) : null;
  }

  /** Plano medio de los dos. */
  readonly mid = new THREE.Vector3(0, 1.35, 0);

  /** La barra en plena calle: ellos dos delante y el camarero cantando la ronda. */
  startPinchos(onDone: () => void) {
    const Z = -19.5;
    this.azul.root.position.set(-1.25, 0, Z + 0.95);
    this.gas.root.position.set(1.3, 0, Z + 0.95);
    this.azul.root.rotation.y = this.gas.root.rotation.y = Math.PI;
    this.pinchos = new PinchoGame(this.scene, Z, () => {
      this.pinchos?.dispose();
      this.pinchos = null;
      this.azul.root.position.set(-0.42, 0, 0);
      this.gas.root.position.set(0.42, 0, 0);
      this.azul.root.rotation.y = Math.PI / 2;
      this.gas.root.rotation.y = -Math.PI / 2;
      onDone();
    });
  }

  update(dt: number, camera: THREE.Camera) {
    this.t += dt;
    this.pinchos?.update(dt, camera);
    const play = !!this.pinchos;
    animatePerson(this.azul, dt, play ? 'idle' : 'dance', 0, this.t * 6);
    animatePerson(this.gas, dt, play ? 'talk' : 'dance', 0, this.t * 6 + 1);
    this.crowd.forEach((c, i) => animatePerson(c.p, dt, c.dance ? 'dance' : 'talk', 0, this.t * 6 + i));
    this.sky.update(camera, dt);
  }
}
