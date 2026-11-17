// Capítulo 7: antes de cocinar hay que reunir los ingredientes por el patio (paso nuevo, [inventado]).
// Tres sitios: la cesta del taburete junto a la cocina (huevos y espaguetis), el pecorino en su tabla sobre la mesa
// del jardín y la nevera de playa de la esquina, donde hay que elegir entre guanciale, bacon y nata (el chiste del chat).
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

    // La nevera de playa, bajo la pérgola, detrás de la mesa: caja azul, tapa blanca con asa; dentro, tres paquetes
    const cooler = new THREE.Group();
    const cm = new Merger(false);
    cm.add(G.rbox, 0x2f78c4, 0, 0.21, 0, 0, 0, 0, 0.62, 0.42, 0.4);
    cm.add(G.box, 0xf4f4f2, 0, 0.36, 0.201, 0, 0, 0, 0.5, 0.05, 0.004); // franja blanca
    cm.add(G.box, 0x1e1e22, -0.33, 0.3, 0, 0, 0, 0, 0.04, 0.08, 0.12); // bisagras del asa
    cm.add(G.box, 0x1e1e22, 0.33, 0.3, 0, 0, 0, 0, 0.04, 0.08, 0.12);
    cooler.add(cm.mesh());
    // El interior, claro: se ve al levantar la tapa
    const liner = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.004, 0.32), toon({ color: 0xdfe7ee }));
    liner.position.y = 0.423;
    cooler.add(liner);
    const lm = new Merger(false);
    lm.add(G.rbox, 0xf4f4f2, 0, 0.03, 0.2, 0, 0, 0, 0.64, 0.06, 0.42);
    lm.add(G.box, 0x2f78c4, 0, 0.07, 0.2, 0, 0, 0, 0.34, 0.03, 0.09);
    this.lid.add(lm.mesh());
    this.lid.position.set(0, 0.42, -0.2); // bisagra atrás
    cooler.add(this.lid);
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
      obj.position.set(x, 0.39, 0.03);
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
    const cx = 4.4, cz = 3.6;
    cooler.position.set(cx, 0, cz);
    cooler.rotation.y = -1.26; // la boca, hacia el patio
    sc.add(cooler);
    this.spots.push({ key: 'nevera', at: new THREE.Vector3(cx, 0, cz), obj: cooler, done: false, k: 1 });
    this.cooler = cooler;
  }

  private cooler: THREE.Group;

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
    this.lid.rotation.x = 0;
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

  /** Para la cámara al elegir: por encima del hombro de Azul, que está delante de la nevera, mirando dentro. */
  coolerCam(pos: THREE.Vector3, look: THREE.Vector3) {
    const c = this.cooler.position, a = this.cooler.rotation.y;
    pos.set(c.x + Math.sin(a) * 0.95 + Math.cos(a) * 0.7, 1.55, c.z + Math.cos(a) * 0.95 - Math.sin(a) * 0.7);
    look.set(c.x - Math.cos(a) * 0.05, 0.36, c.z + Math.sin(a) * 0.05);
  }

  /** Dónde se pone Azul para abrirla, y hacia dónde mira (yaw). */
  coolerStand(out: THREE.Vector3) {
    const c = this.cooler.position, a = this.cooler.rotation.y;
    out.set(c.x + Math.sin(a) * 0.62 - Math.cos(a) * 0.5, 0, c.z + Math.cos(a) * 0.62 + Math.sin(a) * 0.5);
    return a + Math.PI - 0.6;
  }

  update(dt: number, camera: THREE.Camera) {
    // La tapa se abre o se cierra
    const goal = this.opening ? 1 : 0;
    this.open += (goal - this.open) * Math.min(1, dt * 7);
    this.lid.rotation.x = -this.open * 1.9;
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
