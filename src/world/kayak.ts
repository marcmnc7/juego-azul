import * as THREE from 'three';
import { G, Merger, type Person } from '../entities/models';
import { leanTorso, rigPost } from '../entities/rig';
import { twoBone } from '../entities/embrace';
import { canvasTex } from './deco';

// El kayak doble de Sa Farola: casco de fibra con su arrufo, bañeras, gomas en cubierta y dos remos
// de doble pala. Azul delante y Gas detrás, sentados de verdad, remando con las manos en el remo.

/** Casco de kayak de mar: secciones elípticas a lo largo de la eslora, que se afinan hasta la roda. */
function hullGeo(L: number, B: number, D: number, H: number) {
  const S = 56, R = 32;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= S; i++) {
    const t = -1 + (2 * i) / S;
    const z = (t * L) / 2;
    const w = (B / 2) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.1)), 0.6);
    const d = D * (1 - 0.55 * t * t); // quilla con balancín: las puntas suben
    const top = H * (1 - 0.25 * t * t) + 0.12 * Math.pow(Math.abs(t), 6); // proa y popa un poco alzadas
    for (let j = 0; j <= R; j++) {
      const a = (j / R) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const x = w * Math.sign(c) * Math.pow(Math.abs(c), 0.65);
      const y = s < 0 ? -d * Math.pow(-s, 1.15) : top * Math.pow(s, 0.8) * 0.85 + top * 0.15 * (1 - Math.abs(c));
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < S; i++)
    for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j, b = a + R + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Estela en V de tebeo: dos brazos de espuma blanca plana, a trazos que se abren y se acortan hacia atrás, con su
 * tinta (antes, cientos de puntitos con degradado). Lo estrecho, arriba (pegado a la popa).
 */
function wakeTexture() {
  return canvasTex((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const v0 = i / 9 + 0.02, v1 = v0 + 0.07 - i * 0.004;
        const x0 = w / 2 + side * (0.06 + v0 * 0.36) * w, x1 = w / 2 + side * (0.06 + v1 * 0.36) * w;
        const y0 = v0 * h, y1 = v1 * h;
        const lw = 9 - i * 0.7;
        ctx.strokeStyle = '#2b2233';
        ctx.lineWidth = lw + 4;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    }
  }, 128, 256);
}

/** Ola de proa del ferry, de tebeo: bigote de espuma blanca plana con el borde festoneado y su tinta. */
function bowFoamTexture() {
  return canvasTex((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    // Lo estrecho a la izquierda del lienzo (en la roda), abriéndose hacia la derecha por los dos costados
    ctx.moveTo(w * 0.04, h / 2);
    for (let i = 0; i <= 10; i++) {
      const x = w * (0.04 + i * 0.09), y = h / 2 - (0.06 + i * 0.038) * h;
      ctx.quadraticCurveTo(x + w * 0.045, y - h * 0.05, x + w * 0.09, y);
    }
    ctx.lineTo(w * 0.94, h / 2 - h * 0.36);
    for (let i = 10; i >= 0; i--) {
      const x = w * (0.04 + i * 0.09), y = h / 2 - (0.06 + i * 0.038) * h + h * 0.07;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.moveTo(w * 0.04, h / 2);
    for (let i = 0; i <= 10; i++) {
      const x = w * (0.04 + i * 0.09), y = h / 2 + (0.06 + i * 0.038) * h;
      ctx.quadraticCurveTo(x + w * 0.045, y + h * 0.05, x + w * 0.09, y);
    }
    ctx.lineTo(w * 0.94, h / 2 + h * 0.36);
    for (let i = 10; i >= 0; i--) {
      const x = w * (0.04 + i * 0.09), y = h / 2 + (0.06 + i * 0.038) * h - h * 0.07;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2b2233';
    ctx.lineWidth = 4;
    ctx.stroke();
  }, 256, 256);
}

function paddleMesh() {
  const m = new Merger(false);
  m.add(G.cyl, 0x22262c, 0, 0, 0, 0, 0, Math.PI / 2, 0.034, 2.3, 0.034);
  for (const s of [-1, 1]) {
    m.add(G.sphere, 0xd7263d, s * 1.17, 0, 0, 0, 0, 0, 0.5, 0.19, 0.03);
    m.add(G.cyl, 0x22262c, s * 0.92, 0, 0, 0, 0, Math.PI / 2, 0.05, 0.08, 0.05); // anillo antigoteo
  }
  const mesh = m.mesh();
  mesh.castShadow = true;
  return mesh;
}

export interface Kayak {
  /** Va por el mar: posición y rumbo. */
  root: THREE.Group;
  /** Dentro: cabeceo, balanceo y el vuelco. */
  roll: THREE.Group;
  /** Velocidad para el ritmo de las paladas; devuelve dónde ha entrado una pala en el agua. */
  update(dt: number, speed: number, waterY: number): THREE.Vector3 | null;
  stop(): void;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _e = new THREE.Euler();

export function buildKayak(front: Person, back: Person): Kayak {
  const root = new THREE.Group();
  // (se mueve, vuelca y lleva los remos: el cómic no lo dobla a mano alzada donde nace, ni a nada de dentro)
  root.userData.comicBent = true;
  const roll = new THREE.Group();
  root.add(roll);
  const hull = new THREE.Mesh(
    hullGeo(4.9, 0.72, 0.2, 0.17),
    new THREE.MeshPhysicalMaterial({ color: 0xf2b81e, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0 }),
  );
  hull.castShadow = true;
  roll.add(hull);
  // Bañeras, tambuchos, gomas de cubierta y asas
  const d = new Merger(false);
  const cockpits = [0.62, -0.78];
  for (const z of cockpits) {
    d.add(G.cyl, 0x14161a, 0, 0.165, z, 0, 0, 0, 0.44, 0.03, 0.78);
    d.add(new THREE.TorusGeometry(0.5, 0.06, 6, 24).rotateX(Math.PI / 2), 0x1e2126, 0, 0.18, z, 0, 0, 0, 0.46, 1, 0.8);
  }
  for (const z of [1.55, -1.75]) {
    d.add(G.cyl, 0x1e2126, 0, 0.15, z, 0, 0, 0, 0.3, 0.025, 0.36);
    for (const dz of [-0.35, 0.35]) d.add(G.box, 0x111111, 0, 0.14 - Math.abs(z) * 0.01, z + dz, 0, 0, 0, 0.42, 0.012, 0.012);
    for (const dx of [-0.13, 0.13]) d.add(G.box, 0x111111, dx, 0.14, z, 0, Math.sign(dx) * 0.4, 0, 0.012, 0.012, 0.9);
  }
  for (const s of [-1, 1]) {
    d.add(new THREE.TorusGeometry(0.06, 0.012, 5, 10), 0x111111, 0, 0.33, s * 2.38, 0, Math.PI / 2, 0, 1, 1, 1);
  }
  d.add(G.box, 0x111111, 0, -0.14, -2.3, 0, 0, 0, 0.02, 0.2, 0.18); // timón
  const deck = d.mesh();
  deck.castShadow = true;
  roll.add(deck);
  // Estela
  const wakeMat = new THREE.MeshBasicMaterial({ map: wakeTexture(), transparent: true, alphaTest: 0.05, depthWrite: false, opacity: 0, fog: true });
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 7), wakeMat);
  wake.rotation.set(-Math.PI / 2, 0, Math.PI); // lo estrecho pegado a la popa
  wake.position.set(0, 0.03, -5.4);
  wake.userData.noCast = true;
  root.add(wake);

  // Los dos, sentados en sus bañeras: piernas estiradas dentro del casco
  const seats: { p: Person; paddle: THREE.Object3D; z: number; ph: number; prevLow: [boolean, boolean]; hands: [string, string] | null }[] = [];
  for (const [p, z, ph] of [[front, cockpits[0], 0], [back, cockpits[1], 0.35]] as [Person, number, number][]) {
    p.root.rotation.set(0, 0, 0);
    p.legL.rotation.set(-Math.PI / 2 + 0.12, 0, 0.04);
    p.legR.rotation.set(-Math.PI / 2 + 0.12, 0, -0.04);
    p.kneeL.rotation.x = p.kneeR.rotation.x = 0.25;
    p.footL.rotation.x = p.footR.rotation.x = -0.3;
    p.armL.rotation.set(-1.1, 0, 0.2);
    p.armR.rotation.set(-1.1, 0, -0.2);
    p.elbowL.rotation.x = p.elbowR.rotation.x = -0.6;
    let hands: [string, string] | null = null;
    if (p.rig) {
      p.rig.force = { body: 1, legL: 1, legR: 1, armL: 1, armR: 1 };
      p.root.position.set(0, 0.04 - p.rig.hipsHeight * (p.root.scale.y || 1), z - 0.05);
      // Qué mano queda a su izquierda (+x)
      p.root.updateWorldMatrix(true, true);
      const l = p.rig.bones.get('LeftHand')!.getWorldPosition(_a);
      p.root.worldToLocal(l);
      hands = l.x > 0 ? ['Left', 'Right'] : ['Right', 'Left'];
    } else {
      p.root.position.set(0, -0.3, z);
    }
    p.root.traverse((o) => {
      if (o.userData.blob) o.visible = false;
    });
    roll.add(p.root);
    const paddle = paddleMesh();
    roll.add(paddle);
    seats.push({ p, paddle, z, ph, prevLow: [false, false], hands });
  }

  let phase = 0;
  const splashAt = new THREE.Vector3();
  const post = () => {
    for (const s of seats) {
      if (!s.hands || !s.p.root.parent) continue;
      const r = s.p.rig!;
      const B = (n: string) => r.bones.get(n)!;
      for (const [i, side] of s.hands.entries()) {
        const grip = s.paddle.localToWorld(_b.set(i === 0 ? 0.36 : -0.36, 0, 0));
        const sh = B(side + 'Arm').getWorldPosition(_a);
        // Codo hacia fuera y hacia abajo
        const out = _c.set(i === 0 ? 1 : -1, 0, 0).transformDirection(roll.matrixWorld);
        const pole = sh.clone().addScaledVector(out, 0.45);
        pole.y -= 0.45;
        twoBone(B(side + 'Arm'), B(side + 'ForeArm'), B(side + 'Hand'), grip.clone(), pole, 1);
      }
    }
  };
  rigPost.add(post);

  return {
    root,
    roll,
    update(dt, speed, waterY) {
      phase += dt * (1.6 + Math.min(speed, 3) * 1.5);
      let splash: THREE.Vector3 | null = null;
      for (const s of seats) {
        const f = phase * 1 + s.ph;
        const rollA = 0.42 * Math.sin(f);
        const yaw = 0.42 * Math.cos(f);
        // Remo delante del pecho; gira el torso con la palada
        const hip = s.p.rig ? s.p.root.position.y + s.p.rig.hipsHeight : 0.05;
        s.paddle.position.set(Math.sin(f) * 0.05, hip + 0.36, s.z + 0.36 + Math.cos(f) * 0.04);
        s.paddle.quaternion.setFromEuler(_e.set(0, yaw, rollA, 'YXZ'));
        // El tronco acompaña la palada; caderas y piernas quedan quietas dentro del kayak
        leanTorso(s.p, 0.12 + Math.abs(Math.sin(f)) * 0.06, yaw * 0.55, -rollA * 0.15);
        // Si no hay esqueleto, el remo va pegado a las manos de mentira
        if (!s.hands) {
          s.p.armL.rotation.set(-1.15 + yaw * 0.5, 0, 0.2 + rollA * 0.4);
          s.p.armR.rotation.set(-1.15 - yaw * 0.5, 0, -0.2 + rollA * 0.4);
        }
        // ¿Ha entrado una pala en el agua?
        s.paddle.updateWorldMatrix(true, false);
        for (const [i, x] of [1.17, -1.17].entries()) {
          const tip = s.paddle.localToWorld(_a.set(x, 0, 0));
          const low = tip.y < waterY + 0.02;
          if (low && !s.prevLow[i] && speed > 0.2) splash = splashAt.copy(tip);
          s.prevLow[i] = low;
        }
      }
      wakeMat.opacity += (Math.min(1, speed / 2) * 0.9 - wakeMat.opacity) * Math.min(1, dt * 2);
      wake.scale.y = 0.5 + Math.min(1, speed / 2) * 0.5;
      wake.position.z = -2.4 - 3.5 * wake.scale.y;
      return splash;
    },
    stop() {
      rigPost.delete(post);
    },
  };
}

/** Ferry de línea Ciutadella–Alcúdia: casco con proa afilada, franjas, cubiertas con ventanas y chimenea. */
export function buildFerry() {
  const hullShape = (len: number, beam: number) => {
    const s = new THREE.Shape();
    const h = beam / 2;
    s.moveTo(-len / 2, -h);
    s.lineTo(len * 0.18, -h);
    s.quadraticCurveTo(len * 0.42, -h, len / 2, 0);
    s.quadraticCurveTo(len * 0.42, h, len * 0.18, h);
    s.lineTo(-len / 2, h);
    s.lineTo(-len / 2, -h);
    return s;
  };
  const ext = (len: number, beam: number, height: number) => new THREE.ExtrudeGeometry(hullShape(len, beam), { depth: height, bevelEnabled: false, curveSegments: 10 }).rotateX(-Math.PI / 2);
  const m = new Merger(false);
  m.add(ext(62, 13, 3), 0x1d3f7a, 0, -2, 0); // obra viva, azul
  m.add(ext(62.4, 13.3, 0.9), 0xd7263d, 0, 0.6, 0); // franja roja en la flotación
  m.add(ext(62, 13, 5), 0xf6f6f4, 0, 1.5, 0);
  // Cubiertas
  for (const [y, len, x0] of [[6.5, 40, -6], [9.4, 32, -8], [12.2, 18, -10]] as const) {
    m.add(G.rbox, 0xf2f2ef, x0, y, 0, 0, 0, 0, len, 2.9, 12.2 - (y - 6.5) * 0.25);
    m.add(G.box, 0x1c2633, x0, y + 0.35, 0, 0, 0, 0, len + 0.05, 0.9, 12.25 - (y - 6.5) * 0.25);
  }
  // Puente de mando con su cristalera inclinada
  m.add(G.box, 0x1c2633, 0.8, 12.6, 0, 0, 0, -0.35, 1.2, 1.4, 11.2);
  // Ventanas del casco (ojos de buey en fila)
  for (const sz of [-1, 1]) for (let i = 0; i < 16; i++) m.add(G.cyl, 0x1c2633, -26 + i * 3.2, 3.4, sz * 6.52, Math.PI / 2, 0, 0, 0.6, 0.1, 0.6);
  // Chimenea
  m.add(G.rbox, 0xf2f2ef, -18, 15.2, 0, 0, 0, 0.12, 4, 4.6, 3.4);
  m.add(G.box, 0x1d3f7a, -18.2, 16.6, 0, 0, 0, 0.12, 4.1, 1.1, 3.5);
  m.add(G.box, 0x1a1a1a, -18.4, 17.6, 0, 0, 0, 0.12, 3.6, 0.3, 3);
  // Botes salvavidas naranjas
  for (const sz of [-1, 1]) for (const x of [-14, -4, 6]) m.add(G.capsule, 0xff7a1a, x, 8.4, sz * 6.4, 0, 0, Math.PI / 2, 1.1, 2.6, 1.1);
  // Mástil
  m.add(G.cyl, 0xdddddd, -6, 16.5, 0, 0, 0, 0, 0.2, 6, 0.2);
  const g = new THREE.Group();
  // (navega y vira: sin doblar a mano alzada, como los coches)
  g.userData.comicBent = true;
  const mesh = m.mesh();
  mesh.castShadow = true;
  // (sin recibir sombras: el sol rasante sobre el casco largo y liso pintaba rayas verticales de acné)
  mesh.receiveShadow = false;
  mesh.userData.noReceive = true;
  g.add(mesh);
  // Ola de proa: el bigote de espuma, con lo estrecho en la roda (la proa mira a +x)
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 18),
    new THREE.MeshBasicMaterial({ map: bowFoamTexture(), transparent: true, alphaTest: 0.05, depthWrite: false }),
  );
  foam.rotation.set(-Math.PI / 2, 0, Math.PI); // lo estrecho del lienzo (su izquierda) hacia +x, en la roda
  foam.position.set(22, 0.4, 0);
  foam.userData.noCast = true;
  g.add(foam);
  return g;
}
