// Capítulo 7: antes de cocinar hay que reunir los ingredientes por el patio (paso nuevo, [inventado]).
// Tres sitios: la cesta del taburete junto a la cocina (huevos y espaguetis), el pecorino en su tabla sobre la mesa
// del jardín y la nevera de dentro de casa (se entra por la puerta de abajo), donde hay que elegir entre guanciale,
// bacon y nata (el chiste del chat).
import * as THREE from 'three';
import { G, Merger } from '../entities/models';
import { toon } from '../core/gfx';

export type PantryKey = 'cesta' | 'queso' | 'nevera';
export type CoolerPick = 'guanciale' | 'bacon' | 'nata';

interface Spot {
  key: PantryKey;
  at: THREE.Vector3;
  obj: THREE.Object3D;
  done: boolean;
  k: number;
}

const uiRoot = () => document.getElementById('ui')!;
/** La cocina de dentro (decorado apartado bajo el mundo) y, fuera, delante de la puerta de abajo, donde se entra. */
const ROOM = new THREE.Vector3(0, -40, -4);
const FRIDGE_DOOR = new THREE.Vector3(0, 0, 1.0);

export class Pantry {
  readonly spots: Spot[] = [];
  private lid = new THREE.Group();
  private packs: { key: CoolerPick; obj: THREE.Object3D; btn: HTMLButtonElement }[] = [];
  private open = 0;
  private opening = false;
  private v = new THREE.Vector3();

  constructor(sc: THREE.Scene, stove: THREE.Vector3, table: THREE.Vector3) {
    // Taburete de madera junto a la encimera, con la cesta de mimbre: huevos y un paquete de espaguetis
    const stool = new Merger(false);
    const sx = stove.x - 1.45, sz = stove.z + 0.75;
    stool.add(G.cyl, 0x9a6e44, 0, 0.44, 0, 0, 0, 0, 0.38, 0.05, 0.38);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      stool.add(G.cyl, 0x7d5634, Math.cos(a) * 0.13, 0.21, Math.sin(a) * 0.13, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12, 0.035, 0.44, 0.035);
    }
    const stoolMesh = stool.mesh();
    stoolMesh.position.set(sx, 0, sz);
    sc.add(stoolMesh);
    const basket = new THREE.Group();
    const bm = new Merger(false);
    for (let i = 0; i < 5; i++) bm.add(G.sphere, i % 2 ? 0xf1e4c8 : 0xe9cfa6, -0.08 + i * 0.04, 0.17 + (i % 2) * 0.01, (i % 2 ? 0.045 : -0.035), 0.3, i, 0, 0.06, 0.078, 0.06);
    bm.add(G.box, 0x2b5fae, 0.07, 0.22, 0.05, 0.22, 0, -0.3, 0.075, 0.28, 0.035); // espaguetis
    bm.add(G.box, 0xf4efe2, 0.08, 0.24, 0.068, 0.22, 0, -0.3, 0.055, 0.07, 0.002);
    basket.add(bm.mesh());
    // Cesta de mimbre: cuerpo que se abre hacia arriba, borde trenzado y asa en arco
    const wicker = toon({ color: 0xb98a4e });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.15, 16, 1, true), toon({ color: 0xb98a4e, side: THREE.DoubleSide }));
    body.position.y = 0.075;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), wicker);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.005;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 6, 20), toon({ color: 0x8f6534 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.15;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.011, 6, 18, Math.PI), toon({ color: 0x8f6534 }));
    handle.position.y = 0.15;
    basket.add(body, bottom, rim, handle);
    basket.position.set(sx, 0.465, sz);
    sc.add(basket);
    this.spots.push({ key: 'cesta', at: new THREE.Vector3(sx, 0, sz), obj: basket, done: false, k: 1 });

    // El pecorino en su tabla, sobre la mesa del jardín (aún sin poner)
    const cheese = new THREE.Group();
    const board = new Merger(false);
    board.add(G.rbox, 0x9a6e44, 0, 0.012, 0, 0, 0.3, 0, 0.3, 0.025, 0.19);
    board.add(G.box, 0xc8ccd0, 0.07, 0.03, 0.05, 0, 0.3, 0, 0.1, 0.008, 0.025); // cuchillo de queso
    board.add(G.box, 0x2a2a2e, 0.15, 0.032, 0.025, 0, 0.3, 0, 0.07, 0.014, 0.02);
    cheese.add(board.mesh());
    const wedgeGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 18, 1, false, 0, Math.PI * 0.32);
    const wedge = new THREE.Mesh(wedgeGeo, toon({ color: 0xf5e4a8 }));
    wedge.position.set(-0.08, 0.075, -0.04);
    wedge.rotation.y = 0.2; // la punta hacia el patio
    cheese.add(wedge);
    const rind = new THREE.Mesh(new THREE.CylinderGeometry(0.153, 0.153, 0.102, 18, 1, true, 0, Math.PI * 0.32), toon({ color: 0xa87a3e, side: THREE.DoubleSide }));
    rind.position.copy(wedge.position);
    rind.rotation.y = wedge.rotation.y;
    cheese.add(rind);
    cheese.position.set(table.x - 0.25, 0.8, table.z + 0.18);
    for (const c of cheese.children) {
      c.position.multiplyScalar(1.1);
      c.scale.multiplyScalar(1.1);
    }
    sc.add(cheese);
    this.spots.push({ key: 'queso', at: new THREE.Vector3(table.x - 0.25, 0, table.z + 0.18), obj: cheese, done: false, k: 1 });

    // La nevera, dentro de casa: se entra por la puerta de abajo (la del porche) a la cocina de dentro. La cocina es un
    // decorado propio, apartado bajo el suelo del mundo (ROOM): al entrar, la cámara se va allí. Nevera blanca alta
    // contra la pared, con su puerta que se abre; dentro, la luz y los tres paquetes en el estante del medio.
    const room = new THREE.Group();
    const rm = new Merger(false);
    rm.add(G.box, 0xcfc3ad, 0, -0.05, 0, 0, 0, 0, 4.2, 0.1, 3.6); // suelo de baldosa
    rm.add(G.box, 0xf3eee4, 0, 1.4, -1.8, 0, 0, 0, 4.2, 2.8, 0.1); // pared del fondo
    for (const sx of [-2.1, 2.1]) rm.add(G.box, 0xefe9de, sx, 1.4, 0, 0, 0, 0, 0.1, 2.8, 3.6);
    rm.add(G.box, 0xf6f2ea, 0, 2.82, 0, 0, 0, 0, 4.2, 0.08, 3.6); // techo
    rm.add(G.box, 0x8a6a44, 1.25, 0.45, -1.45, 0, 0, 0, 1.4, 0.9, 0.6); // encimera
    rm.add(G.box, 0x6b5238, 1.25, 0.92, -1.45, 0, 0, 0, 1.45, 0.05, 0.62);
    rm.add(G.box, 0x2f6b3a, -1.4, 1.6, -1.74, 0, 0, 0, 0.6, 0.45, 0.02); // un cuadro
    // La nevera, hueca (la boca hacia la habitación, en z = -1,07): fondo, laterales, techo, suelo y estantes
    const FW = 0xf4f4f2;
    rm.add(G.box, FW, 0, 0.9, -1.66, 0, 0, 0, 0.72, 1.8, 0.04); // fondo
    for (const sx of [-0.34, 0.34]) rm.add(G.box, FW, sx, 0.9, -1.37, 0, 0, 0, 0.04, 1.8, 0.62);
    rm.add(G.box, FW, 0, 1.78, -1.37, 0, 0, 0, 0.72, 0.04, 0.62);
    rm.add(G.box, FW, 0, 0.06, -1.37, 0, 0, 0, 0.72, 0.12, 0.62);
    for (const y of [0.5, 0.92, 1.34]) rm.add(G.box, 0xd8e2ea, 0, y, -1.38, 0, 0, 0, 0.62, 0.015, 0.54);
    room.add(rm.mesh());
    // La luz de dentro, al fondo
    const fridgeLight = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.6), new THREE.MeshBasicMaterial({ color: 0xeaf6ff }));
    fridgeLight.position.set(0, 0.95, -1.635);
    room.add(fridgeLight);
    // La puerta de la nevera (bisagra a la izquierda): se abre hacia fuera
    const dm = new Merger(false);
    dm.add(G.rbox, 0xf7f7f5, 0.36, 0, 0, 0, 0, 0, 0.72, 1.78, 0.06);
    dm.add(G.box, 0xb8bcc0, 0.64, 0.25, 0.045, 0, 0, 0, 0.03, 0.5, 0.03); // tirador
    this.lid.add(dm.mesh());
    this.lid.position.set(-0.36, 0.9, -1.04);
    room.add(this.lid);
    const cooler = new THREE.Group();
    cooler.add(room);
    cooler.position.copy(ROOM);
    const packDefs: [CoolerPick, number, number, string][] = [
      ['guanciale', 0xe9b9a6, -0.19, 'Guanciale'],
      ['bacon', 0xd9726a, 0, 'Bacon'],
      ['nata', 0xf4f4f2, 0.19, 'Nata'],
    ];
    for (const [key, col, x, name] of packDefs) {
      const p = new Merger(false);
      if (key === 'nata') {
        p.add(G.box, 0xf4f4f2, 0, 0.09, 0, 0, 0, 0, 0.1, 0.18, 0.06);
        p.add(G.box, 0x2f78c4, 0, 0.12, 0.031, 0, 0, 0, 0.08, 0.05, 0.002);
        p.add(G.cyl, 0x2f78c4, 0.02, 0.19, 0, 0, 0, 0, 0.03, 0.02, 0.03);
      } else if (key === 'bacon') {
        p.add(G.rbox, 0xb93a3a, 0, 0.02, 0, 0, 0, 0, 0.14, 0.035, 0.1);
        for (let i = 0; i < 3; i++) p.add(G.box, i % 2 ? 0xf2c6b6 : col, -0.035 + i * 0.035, 0.042, 0, 0, 0, 0, 0.025, 0.008, 0.09);
      } else {
        // Un trozo de guanciale envuelto en papel de carnicería
        p.add(G.rbox, 0xf2ead8, 0, 0.035, 0, 0, 0.2, 0, 0.15, 0.06, 0.11);
        p.add(G.rbox, col, 0.01, 0.07, 0, 0, 0.2, 0, 0.11, 0.035, 0.08);
        p.add(G.box, 0xf6efe6, 0.01, 0.09, 0, 0, 0.2, 0, 0.11, 0.008, 0.03);
      }
      const obj = p.mesh();
      obj.position.set(x * 1.25, 0.93, -1.36);
      obj.visible = false;
      cooler.add(obj);
      const btn = document.createElement('button');
      btn.className = 'side-spot pincho-tag';
      const span = document.createElement('span');
      span.textContent = name;
      btn.append(span);
      btn.style.display = 'none';
      uiRoot().append(btn);
      this.packs.push({ key, obj, btn });
    }
    sc.add(cooler);
    // (en el patio, el sitio es la puerta de abajo: ahí se entra)
    this.spots.push({ key: 'nevera', at: FRIDGE_DOOR.clone(), obj: cooler, done: false, k: 1 });
  }

  get count() {
    return this.spots.filter((s) => s.done).length;
  }

  /** Todos cogidos (true: ya se cocinó, nada a la vista) o todos en su sitio. */
  reset(done: boolean) {
    this.closeCooler();
    for (const s of this.spots) {
      s.done = done;
      s.k = done ? 0 : 1;
      s.obj.visible = !done || s.key === 'nevera';
      s.obj.scale.setScalar(1);
    }
    this.lid.rotation.y = 0;
    this.open = 0;
  }

  /** El sitio por recoger más cercano, si está al alcance. */
  near(pp: THREE.Vector3, reach = 1.25): Spot | null {
    let best: Spot | null = null;
    let bd = reach;
    for (const s of this.spots) {
      if (s.done) continue;
      const d = Math.hypot(pp.x - s.at.x, pp.z - s.at.z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  /** El sitio por recoger más cercano, a cualquier distancia (para la flecha de «perdida»). */
  nearest(pp: THREE.Vector3): THREE.Vector3 | null {
    const left = this.spots.filter((s) => !s.done);
    left.sort((a, b) => pp.distanceTo(a.at) - pp.distanceTo(b.at));
    return left[0]?.at ?? null;
  }

  take(key: PantryKey) {
    const s = this.spots.find((x) => x.key === key);
    if (s) s.done = true;
  }

  /** Abre la nevera: los tres paquetes asoman con su nombre encima; se toca el que se lleva. */
  openCooler(onPick: (p: CoolerPick) => void) {
    this.opening = true;
    for (const p of this.packs) {
      p.obj.visible = true;
      p.btn.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onPick(p.key);
      };
    }
  }

  /** Quita un paquete equivocado de la vista (se queda en la nevera). */
  shake(p: CoolerPick) {
    const pk = this.packs.find((x) => x.key === p);
    if (!pk) return;
    pk.btn.classList.remove('nope');
    void pk.btn.offsetWidth;
    pk.btn.classList.add('nope');
  }

  closeCooler() {
    this.opening = false;
    for (const p of this.packs) {
      p.btn.style.display = 'none';
      p.btn.onpointerdown = null;
    }
  }

  get coolerOpen() {
    return this.opening;
  }

  /** Para la cámara al elegir: dentro, delante de la nevera abierta, mirando los tres paquetes. */
  coolerCam(pos: THREE.Vector3, look: THREE.Vector3) {
    pos.copy(ROOM).add(this.v.set(0.12, 1.32, -0.3));
    look.copy(ROOM).add(this.v.set(0, 0.9, -1.38));
  }

  /** Dónde se pone Azul para entrar (delante de la puerta de abajo), y hacia dónde mira (yaw). */
  coolerStand(out: THREE.Vector3) {
    out.copy(FRIDGE_DOOR);
    return Math.PI;
  }

  update(dt: number, camera: THREE.Camera) {
    // La tapa se abre o se cierra
    const goal = this.opening ? 1 : 0;
    this.open += (goal - this.open) * Math.min(1, dt * 7);
    this.lid.rotation.y = -this.open * 1.75;
    if (!this.opening && this.open < 0.05) for (const p of this.packs) p.obj.visible = false;
    // Lo recogido encoge de un salto y desaparece (la nevera se queda)
    for (const s of this.spots) {
      if (!s.done || s.key === 'nevera' || s.k <= 0) continue;
      s.k = Math.max(0, s.k - dt * 3.5);
      const pop = s.k > 0.8 ? 1 + (1 - s.k) * 1.2 : s.k * 1.2;
      s.obj.scale.setScalar(Math.max(0.001, pop));
      if (s.k === 0) s.obj.visible = false;
    }
    // Las etiquetas de la nevera, sobre cada paquete
    const W = window.innerWidth, H = window.innerHeight;
    for (const p of this.packs) {
      if (!this.opening || this.open < 0.7) {
        p.btn.style.display = 'none';
        continue;
      }
      p.obj.getWorldPosition(this.v);
      this.v.y += 0.12;
      this.v.project(camera);
      p.btn.style.display = '';
      p.btn.style.left = `${((this.v.x + 1) / 2) * W}px`;
      p.btn.style.top = `${((1 - this.v.y) / 2) * H}px`;
    }
  }

  dispose() {
    for (const p of this.packs) p.btn.remove();
  }
}
