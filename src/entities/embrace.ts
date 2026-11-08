import * as THREE from 'three';
import type { Person } from './models';
import { boneFrame, rigPost } from './rig';

// Besos y abrazos de verdad entre dos personajes glTF: se acercan hasta tocarse, se inclinan,
// giran la cabeza el uno hacia el otro y apoyan las manos en el otro (IK de dos huesos).
// Va después de la animación de cada fotograma, así que el reposo sigue respirando debajo.

export type EmbraceKind = 'kiss' | 'hug';

export interface Embrace {
  /** 0 = cada uno a lo suyo, 1 = abrazados del todo. El nivel lo sube poco a poco. */
  k: number;
  /** Si se pone, k va solo hacia este valor; al volver a 0 se suelta del todo. */
  to?: number;
  stop(): void;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _t = new THREE.Vector3();
const _p = new THREE.Vector3();
const _d = new THREE.Vector3();
const _e = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _fr = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

const bone = (p: Person, n: string) => p.rig!.bones.get(n)!;
const wpos = (p: Person, n: string, out: THREE.Vector3) => bone(p, n).getWorldPosition(out);

/** Gira un hueso en mundo (rot por delante de su rotación actual), mezclado con w. */
export function rotateWorld(b: THREE.Object3D, rot: THREE.Quaternion, w: number) {
  b.getWorldQuaternion(_q2);
  const target = _q3.copy(rot).multiply(_q2);
  b.parent!.getWorldQuaternion(_q2).invert();
  _q.copy(_q2).multiply(target);
  b.quaternion.slerp(_q, w);
  b.updateWorldMatrix(false, true);
}

/** IK de dos huesos (hombro-codo-mano) hacia t, con el codo empujado hacia pole. */
export function twoBone(upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Object3D, t: THREE.Vector3, pole: THREE.Vector3, w: number) {
  if (w <= 0) return;
  for (let it = 0; it < 2; it++) {
    const a = upper.getWorldPosition(_a), b = lower.getWorldPosition(_b), c = end.getWorldPosition(_c);
    const lab = a.distanceTo(b), lcb = b.distanceTo(c);
    const lat = THREE.MathUtils.clamp(_t.copy(t).sub(a).length(), 0.01, (lab + lcb) * 0.999);
    // Codo: el ángulo que hace falta para que la mano llegue a la distancia del objetivo
    const ba = _d.copy(a).sub(b).normalize(), bc = _e.copy(c).sub(b).normalize();
    const cur = Math.acos(THREE.MathUtils.clamp(ba.dot(bc), -1, 1));
    const want = Math.acos(THREE.MathUtils.clamp((lab * lab + lcb * lcb - lat * lat) / (2 * lab * lcb), -1, 1));
    const axis = _p.crossVectors(ba, bc);
    if (axis.lengthSq() < 1e-8) axis.copy(pole).sub(b).cross(ba);
    axis.normalize();
    rotateWorld(lower, _fr.setFromAxisAngle(axis, want - cur), w);
    // Hombro: apunta la mano al objetivo…
    end.getWorldPosition(c);
    _d.copy(c).sub(a).normalize();
    _e.copy(t).sub(a).normalize();
    rotateWorld(upper, _fr.setFromUnitVectors(_d, _e), w);
    // …y gira el brazo sobre ese eje para que el codo vaya hacia pole
    lower.getWorldPosition(b);
    const dir = _e.copy(t).sub(a).normalize();
    const eb = _d.copy(b).sub(a);
    eb.addScaledVector(dir, -eb.dot(dir));
    const ep = _p.copy(pole).sub(a);
    ep.addScaledVector(dir, -ep.dot(dir));
    if (eb.lengthSq() > 1e-8 && ep.lengthSq() > 1e-8) {
      eb.normalize();
      ep.normalize();
      const ang = Math.atan2(_c.crossVectors(eb, ep).dot(dir), eb.dot(ep));
      rotateWorld(upper, _fr.setFromAxisAngle(dir, ang), w);
    }
  }
}

/** Hueso de un lado del personaje: Left o Right según quede a su izquierda (+x) o derecha. */
export function sideNames(p: Person) {
  p.root.updateWorldMatrix(true, true);
  const l = wpos(p, 'LeftArm', _a);
  const inv = p.root.matrixWorld.clone().invert();
  return l.applyMatrix4(inv).x > 0 ? (['Left', 'Right'] as const) : (['Right', 'Left'] as const);
}

/**
 * Junta a los dos. her y him se miran de frente; el nivel solo pone sus raíces más o menos cerca
 * y sube e.k. Los modelos se adelantan dentro de su raíz lo justo para tocarse.
 */
export function embrace(her: Person, him: Person, kind: EmbraceKind): Embrace {
  const e: Embrace = {
    k: 0,
    stop: () => {
      rigPost.delete(tick);
      if (her.rig) her.rig.noFidget = false;
      if (him.rig) him.rig.noFidget = false;
    },
  };
  if (!her.rig || !him.rig) {
    // Muñecos sin esqueleto (modo ligero): se inclinan el uno hacia el otro
    const lite = (dt: number) => {
      if (e.to !== undefined) {
        e.k = THREE.MathUtils.clamp(e.k + Math.sign(e.to - e.k) * dt * 1.4, 0, 1);
        if (e.to === 0 && e.k === 0) return e.stop();
      }
      for (const p of [her, him]) {
        p.body.rotation.x = 0.18 * e.k;
        p.armL.rotation.x = p.armR.rotation.x = -1.2 * e.k;
      }
    };
    rigPost.add(lite);
    e.stop = () => rigPost.delete(lite);
    return e;
  }
  // (sin gestos sueltos mientras dura: moverían la cabeza y los brazos que coloca el abrazo)
  her.rig.noFidget = him.rig.noFidget = true;
  const sides = new Map([her, him].map((p) => [p, sideNames(p)]));
  const base = new Map([her, him].map((p) => [p, p.rig!.model.position.z]));
  let push = 0;
  let trim = 0; // lo que aún falta para que las bocas se toquen, medido en la pose final del fotograma anterior
  // Dónde están los labios respecto al hueso de la cabeza, medido en los modelos (la punta de la nariz menos
  // 1,5 cm): Azul 0,113 m, MakeHuman (Gas) 0,139 m. Con la medida de antes (0,105 para los dos) los labios
  // «tocaban» 4 cm dentro de la cara del otro y las caras se fundían
  const lipsFwd = new Map([her, him].map((p) => [p, p.rig!.model.getObjectByName('MHHair') ? 0.139 : 0.113]));
  const lipsOf = (p: Person, out: THREE.Vector3) => {
    boneFrame(p, 'Head', _fr);
    return bone(p, 'Head').getWorldPosition(out).addScaledVector(_d.copy(Z).applyQuaternion(_fr), lipsFwd.get(p)!).addScaledVector(_d.set(0, 1, 0).applyQuaternion(_fr), 0.045);
  };
  const tick = (dt: number) => {
    if (e.to !== undefined) {
      e.k = e.k < e.to ? Math.min(e.to, e.k + dt * 1.4) : Math.max(e.to, e.k - dt * 1.8);
      if (e.to === 0 && e.k === 0) return e.stop();
    }
    const k = THREE.MathUtils.smoothstep(e.k, 0, 1);
    if (!her.root.parent || !him.root.parent) return;
    // 1. Inclinarse: él (más alto) se inclina más; ella se pone de puntillas con la espalda
    for (const p of [her, him]) {
      const tall = p === him ? 1 : 0;
      boneFrame(p, 'Spine', _fr);
      // Girar sobre su eje x (a su izquierda) en positivo le echa hacia delante
      const side = _c.copy(X).applyQuaternion(_fr);
      const lean = kind === 'kiss' ? (tall ? 0.16 : 0.04) : tall ? 0.1 : 0.06;
      rotateWorld(bone(p, 'Spine1'), new THREE.Quaternion().setFromAxisAngle(side, lean), k);
      rotateWorld(bone(p, 'Spine2'), new THREE.Quaternion().setFromAxisAngle(side, lean * 0.6), k);
    }

    // 2. Acercarse: cada modelo avanza dentro de su raíz la mitad de lo que falta
    const probe = kind === 'kiss' ? 'Head' : 'Spine2';
    const gap = kind === 'kiss' ? 0.17 - trim : 0.27;
    const hp = wpos(her, probe, _a), mp = wpos(him, probe, _b);
    // Separación medida hacia donde mira ella (con signo: si se pasan, sale negativa y retroceden)
    const fwd = _c.set(0, 0, 1).applyQuaternion(her.root.getWorldQuaternion(_q));
    const sep = (mp.x - hp.x) * fwd.x + (mp.z - hp.z) * fwd.z;
    const applied = (her.rig!.model.position.z - base.get(her)!) * (her.root.scale.z || 1);
    const need = THREE.MathUtils.clamp(applied + (sep - gap) / 2, 0, 0.8);
    push += (need - push) * Math.min(1, dt * 8);
    for (const p of [her, him]) {
      p.rig!.model.position.z = base.get(p)! + (push * k) / (p.root.scale.z || 1);
      p.rig!.model.updateWorldMatrix(false, true);
    }

    // 3. Cabezas: el beso, cara con cara y ladeadas cada una a un lado; el abrazo, al hombro del otro
    for (const [p, o] of [[her, him], [him, her]] as const) {
      const head = bone(p, 'Head');
      const target = wpos(o, kind === 'kiss' ? 'Head' : 'Neck', new THREE.Vector3());
      if (kind === 'kiss') target.y += 0.045;
      else {
        // Por encima del hombro del otro (su lado derecho, -x) y un poco por detrás
        boneFrame(o, 'Spine2', _fr);
        target.addScaledVector(_e.copy(X).applyQuaternion(_fr), -0.22).addScaledVector(_p.copy(Z).applyQuaternion(_fr), -0.25);
      }
      const to = target.sub(head.getWorldPosition(_a)).normalize();
      // Ladeo (ella a un lado, él al otro, para no chocar de narices)
      const tilt = new THREE.Quaternion().setFromAxisAngle(to, kind === 'kiss' ? (p === her ? 0.4 : -0.4) : 0.12);
      boneFrame(p, 'Head', _fr);
      const aim = new THREE.Quaternion().setFromUnitVectors(_d.copy(Z).applyQuaternion(_fr), to);
      rotateWorld(bone(p, 'Neck'), aim.clone().slerp(new THREE.Quaternion(), 0.6), k);
      boneFrame(p, 'Head', _fr);
      aim.setFromUnitVectors(_d.copy(Z).applyQuaternion(_fr), to).premultiply(tilt);
      rotateWorld(head, aim, k);
    }

    if (kind === 'kiss' && e.k > 0.8) {
      const a = lipsOf(her, new THREE.Vector3()), b = lipsOf(him, new THREE.Vector3());
      const ff = _c.set(0, 0, 1).applyQuaternion(her.root.getWorldQuaternion(_q));
      // (se tocan, sin fundirse: medio centímetro entre los dos puntos de los labios)
      const res = (b.x - a.x) * ff.x + (b.z - a.z) * ff.z - 0.005;
      trim = THREE.MathUtils.clamp(trim + res * Math.min(1, dt * 6), -0.15, 0.3);
    }

    // 4. Manos: IK hasta el cuerpo del otro
    for (const [p, o] of [[her, him], [him, her]] as const) {
      const [L, R] = sides.get(p)!;
      boneFrame(o, 'Spine2', _fr);
      const oRight = new THREE.Vector3(-1, 0, 0).applyQuaternion(_fr); // derecha del otro (-x)
      const oBack = new THREE.Vector3(0, 0, -1).applyQuaternion(_fr);
      const pUp = Y;
      for (const [side, sgn] of [[L, 1], [R, -1]] as const) {
        const sh = wpos(p, side + 'Arm', new THREE.Vector3());
        let anchor: string, across: number, back: number, up: number;
        if (p === her) {
          // Ella: al cuello en el beso; por debajo de sus brazos, a la espalda, en el abrazo
          [anchor, across, back, up] = kind === 'kiss' ? ['Neck', 0.07, 0.05, -0.02] : ['Spine1', 0.11, 0.11, 0];
        } else {
          // Él: a la cintura en el beso; a la parte alta de la espalda en el abrazo
          [anchor, across, back, up] = kind === 'kiss' ? ['Spine', 0.12, 0.07, 0.02] : ['Spine2', 0.1, 0.1, 0.04];
        }
        const t = wpos(o, anchor, new THREE.Vector3());
        // La mano izquierda de uno va al lado derecho del otro (están de frente)
        const toSide = Math.sign(_e.copy(sh).sub(t).dot(oRight)) || sgn;
        t.addScaledVector(oRight, across * toSide).addScaledVector(oBack, back);
        t.y += up;
        const pole = sh.clone().addScaledVector(_e.copy(oRight), toSide * 0.35).addScaledVector(pUp, p === her && kind === 'kiss' ? -0.15 : -0.35);
        twoBone(bone(p, side + 'Arm'), bone(p, side + 'ForeArm'), bone(p, side + 'Hand'), t, pole, k);
      }
    }
  };
  rigPost.add(tick);
  const stop = e.stop;
  e.stop = () => {
    stop();
    for (const p of [her, him]) p.rig!.model.position.z = base.get(p)!;
  };
  return e;
}

/** Un abrazo de unos segundos (reencuentros): se abrazan, aguantan y se sueltan solos. */
export function hugFor(her: Person, him: Person, seconds: number) {
  const e = embrace(her, him, 'hug');
  e.to = 1;
  window.setTimeout(() => (e.to = 0), seconds * 1000);
  return e;
}
