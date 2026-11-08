import * as THREE from 'three';
import type { Box2 } from '../world/ferreries';
import { physFor } from './phys';
import { camWorld } from './camWorld';
import { airOf, type AirState } from './air';
import { dust } from './dust';

// Movimiento en tercera persona relativo a la cámara, con colisión círculo-contra-cajas,
// empujones, y una cámara que se coloca sola detrás al andar y se acerca si hay una pared.
const R = 0.4;

/** Obstáculo redondo (personas, ases): x, z y radio. */
export interface Circle {
  x: number;
  z: number;
  r: number;
}
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Muelle amortiguado crítico: sigue un objetivo sin pasarse, como un músculo o una suspensión. */
export function spring(x: number, v: number, target: number, omega: number, dt: number): [number, number] {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const det = 1 / (f + hhoo);
  return [(f * x + dt * v + hhoo * target) * det, (v + hoo * (target - x)) * det];
}

// Física de andar: la velocidad no cambia de golpe (hay masa), girar en seco frena, un empujón te
// desplaza y te hace perder el control un momento, y la pared frena de verdad en vez de resbalar.
const ACCEL = 16; // m/s² arrancando (≈0,35 s hasta correr)
const BRAKE = 24; // m/s² frenando o cambiando de sentido
const STUMBLE_DECEL = 8; // m/s² mientras te recuperas de un empujón
const STRIDE = 0.53; // metros por radián de ciclo de paso (una zancada ≈ 1,65 m)
// Salto: gravedad algo mayor que la real (en pantalla se siente más natural) y ≈ 0,55 m de altura si
// se mantiene el botón. Soltarlo pronto corta el salto (salto corto) y la caída es más rápida que la
// subida: así el salto responde y no flota.
const GRAVITY = 13;
const JUMP_V = 3.8;
const CUT_GRAVITY = 2.4; // ×gravedad subiendo con el botón suelto
const FALL_GRAVITY = 1.55; // ×gravedad cayendo
// Acelerón: con el joystick a fondo y recto un rato, se corre algo más (y se nota en la cámara)
const SPRINT_AFTER = 1.0; // segundos a fondo antes de acelerar
const SPRINT = 1.15; // acelerón al correr recto un rato (antes 1,24)
/** La cámara nunca se acerca a la cabeza más que esto (si no cabe, sube en vez de atravesar la pared). */
const CAM_NEAR = 0.9;
/** Aire que la cámara deja a su alrededor, y hacia dónde lo mira. */
const CAM_ROOM = 0.26;
const CAM_SIDES: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

let jumpQueued = false;
let jumpAt = 0;
let jumpHeld = false;
/** Botón o tecla de saltar: vale durante un instante (si se pulsa justo antes de tocar el suelo, salta igual). */
export function requestJump() {
  jumpQueued = true;
  jumpHeld = true;
  jumpAt = performance.now();
}
/** Se suelta el botón de saltar: si aún sube, el salto se queda corto. */
export function releaseJump() {
  jumpHeld = false;
}
/** Momento (performance.now) en que algún Walker se movió por última vez: para enseñar el botón de saltar. */
export let walkerActiveAt = -1e9;
/** Solo para el modo prueba: los últimos límites del área jugable. */
export let lastBounds: Box2 | null = null;
/** Segundos empujando contra el límite del mapa sin nada visible delante, y cuándo fue la última vez. */
export let edgePush = 0;
export let edgePushAt = -1e9;

export class Walker implements AirState {
  facing = 0;
  /** Altura del salto sobre el suelo, velocidad vertical y aterrizaje (ver AirState). */
  hop = 0;
  vy = 0;
  land = 0;
  /** Se puede saltar (los niveles lo apagan en escenas, conduciendo o nadando). */
  canJump = true;
  private baseY = 0;
  private coyote = 0;
  yaw = 0;
  /** Fase del ciclo de paso: avanza con la distancia recorrida, así los pies no patinan. */
  walk = 0;
  /** Velocidad punta normal (m/s). Antes 5,2: corría demasiado; algunos niveles la cambian a su gusto. */
  speed = 4.0;
  /** Agarre: 1 en suelo; en el agua bajo, para que se deslice y cueste arrancar y frenar. */
  traction = 1;
  knock = new THREE.Vector3();
  /** Inclinación hacia delante (aceleración) y hacia el lado (curvas), suavizadas, en radianes. */
  leanFwd = 0;
  leanSide = 0;
  private leanFwdV = 0;
  private leanSideV = 0;
  /** Velocidad que la jugadora quiere llevar (hacia donde empuja), aunque algo se lo impida. */
  wish = new THREE.Vector2();
  private turnRate = 0;
  private stumble = 0;
  /** Choque contra una persona este fotograma (m/s de impacto; 0 si no hubo), para sonido o reacción. */
  bump = 0;
  /** Persona contra la que se ha chocado (el círculo), si alguna. */
  bumped: Circle | null = null;
  private bumpCd = 0;
  private wedged = 0;
  private squeezeT = 0;
  private manualCam = 0;
  private velocity = new THREE.Vector3();
  private prevSpeed = 0;
  private camPos = new THREE.Vector3();
  private camVel = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private lookVel = new THREE.Vector3();
  private camInit = false;
  /** Distancia real de la cámara: se acerca rápido si algo tapa y se aleja despacio (sin tirones). */
  private camD = -1;
  private baseFov = 0;
  private shakeT = 0;
  /** Acelerón: tiempo con el joystick a fondo y multiplicador actual de velocidad (1 = normal). */
  private fullT = 0;
  boost = 1;
  private dustT = 0;

  constructor(public pos: THREE.Vector3) {
    this.baseY = pos.y;
    airOf.set(pos, this);
  }

  /** Pasa a mover otro cuerpo (p. ej. cuando se cambia el modelo del personaje por otro con otra ropa). */
  attach(pos: THREE.Vector3) {
    this.pos = pos;
    this.baseY = pos.y - this.hop;
    airOf.set(pos, this);
  }

  get airborne() {
    return this.hop > 0.001;
  }

  /** Giro de cámara manual (arrastre con el dedo). */
  turn(delta: number) {
    if (delta !== 0) {
      this.yaw -= delta;
      this.manualCam = 2.5;
    }
  }

  shake(t = 0.35) {
    this.shakeT = t;
  }

  /** Velocidad real en x y z. */
  get vx() {
    return this.velocity.x;
  }
  get vz() {
    return this.velocity.z;
  }

  /** Velocidad actual (m/s). */
  get currentSpeed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  /** Para teletransportes y escenas: parar en seco sin inercia. */
  stop() {
    this.hop = this.vy = this.land = 0;
    this.baseY = this.pos.y;
    this.velocity.set(0, 0, 0);
    this.knock.set(0, 0, 0);
    this.stumble = 0;
  }

  /** Devuelve la intensidad del movimiento (0..1) para animar. */
  move(dt: number, ax: { x: number; y: number }, boxes: Box2[], b: Box2, circles: readonly Circle[] = []) {
    if (dt <= 0) return Math.min(1, this.currentSpeed / this.speed);
    if (this.canJump) walkerActiveAt = performance.now();
    lastBounds = b;
    let mag = Math.min(1, Math.hypot(ax.x, ax.y));
    const p = this.pos;
    const sx = p.x;
    const sz = p.z;
    const v = this.velocity;

    // Empujón: impulso de velocidad y un momento sin control total
    if (this.knock.lengthSq() > 0.01) {
      v.x += this.knock.x * 0.65;
      v.z += this.knock.z * 0.65;
      this.stumble = 0.45;
      this.knock.set(0, 0, 0);
    }
    this.stumble = Math.max(0, this.stumble - dt);
    if (this.stumble > 0) mag *= 0.25;

    let tx = 0;
    let tz = 0;
    const prevFacing = this.facing;
    const spd = this.currentSpeed;
    if (mag > 0.1) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const mx = fx * ax.y - fz * ax.x;
      const mz = fz * ax.y + fx * ax.x;
      const want = Math.atan2(mx, mz);
      // Se gira rápido parado y más despacio corriendo
      const maxTurn = THREE.MathUtils.lerp(14, 7, Math.min(1, spd / this.speed));
      const diff = wrap(want - this.facing);
      this.facing += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn * dt, Math.abs(diff) * Math.min(1, dt * 16));
      // Girar en seco frena: la velocidad deseada cae con el ángulo entre hacia dónde miras y hacia dónde vas
      const off = Math.abs(wrap(want - this.facing));
      const turnPenalty = 0.3 + 0.7 * Math.max(0, Math.cos(Math.min(Math.PI / 2, off * 1.2)));
      const len = Math.hypot(mx, mz) || 1;
      // Acelerón: a fondo, recto y en tierra firme durante un rato
      const flat = mag > 0.92 && turnPenalty > 0.85 && this.traction >= 1 && this.stumble <= 0;
      this.fullT = flat ? this.fullT + dt : 0;
      const wantBoost = this.fullT > SPRINT_AFTER ? SPRINT : 1;
      if (wantBoost > 1 && this.boost < 1.02) dust.puff(p.x, p.y, p.z, 7, 0.6);
      this.boost += (wantBoost - this.boost) * Math.min(1, dt * (wantBoost > this.boost ? 2.5 : 6));
      tx = (mx / len) * this.speed * this.boost * mag * turnPenalty;
      tz = (mz / len) * this.speed * this.boost * mag * turnPenalty;
      // Girar en seco corriendo levanta polvo
      if (turnPenalty < 0.6 && spd > 3.2 && !this.airborne && this.traction >= 1 && this.dustT <= 0) {
        dust.puff(p.x, p.y, p.z, 3, 0.4);
        this.dustT = 0.15;
      }
      // La cámara se recoloca sola detrás, salvo si se camina hacia ella
      this.manualCam -= dt;
      // (más rápido cuanto más corres, y nada en el primer instante para que girar sobre sí no maree)
      if (this.manualCam <= 0 && ax.y > -0.35) this.yaw += wrap(this.facing - this.yaw) * Math.min(1, dt * (0.6 + 1.6 * Math.min(1, spd / this.speed)) * mag);
    }
    else {
      this.fullT = 0;
      this.boost += (1 - this.boost) * Math.min(1, dt * 6);
    }
    this.turnRate = wrap(this.facing - prevFacing) / dt;
    this.wish.set(tx, tz);
    // Al correr con acelerón, una estela de polvo a los pies
    this.dustT -= dt;
    if (this.boost > 1.1 && !this.airborne && this.dustT <= 0 && this.traction >= 1) {
      dust.puff(p.x, p.y, p.z, 2, 0.3);
      this.dustT = 0.16;
    }

    // Aceleración limitada: arrancar cuesta un poco más que frenar
    const dx = tx - v.x;
    const dz = tz - v.z;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-5) {
      const speeding = tx * v.x + tz * v.z > 0 && tx * tx + tz * tz > v.x * v.x + v.z * v.z;
      // En el aire casi no se puede cambiar de rumbo (no hay suelo en el que apoyarse)
      const a = (this.stumble > 0 ? STUMBLE_DECEL : speeding ? ACCEL : BRAKE) * this.traction * (this.airborne ? 0.25 : 1);
      const step = Math.min(dl, a * dt);
      v.x += (dx / dl) * step;
      v.z += (dz / dl) * step;
    }
    this.vertical(dt);
    const phys = physFor(boxes);
    if (phys) {
      // Rapier: barrido continuo de la cápsula contra todas las cajas a la vez
      const m = phys.move(this, p, v.x * dt, v.z * dt, R - 0.02);
      p.x += m.x;
      p.z += m.z;
    } else {
      p.x += v.x * dt;
      p.z += v.z * dt;
    }

    // Red de seguridad (y lo único si Rapier no está): sacar de cualquier caja en la que se haya
    // quedado dentro, p. ej. al aparecer en un sitio o si el nivel mueve una caja encima.
    for (const c of boxes) {
      if (c.round) {
        // Redondo de verdad: si no, las esquinas de su caja te echaban hacia fuera sin tocar nada
        const ccx = (c.minX + c.maxX) / 2, ccz = (c.minZ + c.maxZ) / 2, rr = (c.maxX - c.minX) / 2 + R;
        const ex = p.x - ccx, ez = p.z - ccz, dd = Math.hypot(ex, ez) || 1e-3;
        if (dd < rr) {
          p.x = ccx + (ex / dd) * rr;
          p.z = ccz + (ez / dd) * rr;
        }
        continue;
      }
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const ex = p.x - cx;
      const ez = p.z - cz;
      const d2 = ex * ex + ez * ez;
      if (d2 < R * R) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          p.x = cx + (ex / d) * R;
          p.z = cz + (ez / d) * R;
        } else {
          const opts = [p.x - c.minX, c.maxX - p.x, p.z - c.minZ, c.maxZ - p.z];
          const i = opts.indexOf(Math.min(...opts));
          if (i === 0) p.x = c.minX - R;
          else if (i === 1) p.x = c.maxX + R;
          else if (i === 2) p.z = c.minZ - R;
          else p.z = c.maxZ + R;
        }
      }
    }
    // Personas y animales: empujar hacia fuera del círculo. Rozar a alguien te desvía (resbalas por
    // su lado); chocar de frente corriendo te hace rebotar un poco, como contra un cuerpo de verdad.
    this.bump = 0;
    this.bumped = null;
    this.bumpCd = Math.max(0, this.bumpCd - dt);
    this.squeezeT = Math.max(0, this.squeezeT - dt);
    let touching = 0;
    for (const c of circles) {
      const ex = p.x - c.x;
      const ez = p.z - c.z;
      const rr = c.r + R;
      const d2 = ex * ex + ez * ez;
      if (d2 < rr * rr) {
        touching++;
        if (this.squeezeT > 0) continue;
        const d = Math.sqrt(d2) || 1e-3;
        const nx = ex / d;
        const nz = ez / d;
        p.x = c.x + nx * rr;
        p.z = c.z + nz * rr;
        const vn = -(v.x * nx + v.z * nz);
        if (vn > 2.6 && this.bumpCd <= 0) {
          this.bump = vn;
          this.bumped = c;
          this.bumpCd = 0.5;
          this.knock.set(nx * vn * 0.55, 0, nz * vn * 0.55);
          this.shake(0.12);
        }
      }
    }
    const ox = p.x, oz = p.z;
    p.x = Math.max(b.minX, Math.min(b.maxX, p.x));
    p.z = Math.max(b.minZ, Math.min(b.maxZ, p.z));
    if (mag > 0.4 && (ox !== p.x || oz !== p.z)) {
      const ex = Math.sign(ox - p.x), ez = Math.sign(oz - p.z), el = Math.hypot(ex, ez);
      if (camWorld.cast(p.x, p.y + 1, p.z, ex / el, 0, ez / el, 1.2, boxes) >= 1.2) {
        edgePush = performance.now() - edgePushAt < 300 ? edgePush + dt : dt;
        edgePushAt = performance.now();
      }
    }

    // Lo que de verdad se ha movido manda: contra una pared la velocidad se pierde. Pero solo para frenar: si
    // alguien la empuja fuera de su sitio (Gas pegado a ella al soltar el abrazo en la piscina), ese empujón
    // no puede convertirse en velocidad (en el agua apenas frena y salía disparada hasta el otro lado)
    const realX = (p.x - sx) / dt;
    const realZ = (p.z - sz) / dt;
    if (Math.abs(realX - v.x) > 0.01) v.x = THREE.MathUtils.clamp(realX, Math.min(0, v.x), Math.max(0, v.x));
    if (Math.abs(realZ - v.z) > 0.01) v.z = THREE.MathUtils.clamp(realZ, Math.min(0, v.z), Math.max(0, v.z));

    const moved = Math.hypot(p.x - sx, p.z - sz);
    this.walk += moved / STRIDE;
    // Encajada entre dos o más personas sin poder avanzar: se pasa apretándose entre ellas, nunca atrapada
    if (touching >= 2 && mag > 0.4 && moved < this.speed * mag * dt * 0.15) {
      this.wedged += dt;
      if (this.wedged > 0.9) {
        this.wedged = 0;
        this.squeezeT = 0.7;
      }
    } else this.wedged = Math.max(0, this.wedged - dt);

    // Inclinación: hacia delante al acelerar (y un poco siempre al correr), hacia dentro en las curvas
    const now = this.currentSpeed;
    const accel = (now - this.prevSpeed) / dt;
    this.prevSpeed = now;
    const fwdTarget = THREE.MathUtils.clamp(accel * 0.012 + (now / this.speed) * 0.07, -0.12, 0.2);
    const sideTarget = THREE.MathUtils.clamp(-this.turnRate * now * 0.012, -0.22, 0.22);
    [this.leanFwd, this.leanFwdV] = spring(this.leanFwd, this.leanFwdV, fwdTarget, 10, dt);
    [this.leanSide, this.leanSideV] = spring(this.leanSide, this.leanSideV, sideTarget, 9, dt);
    return Math.min(1, now / this.speed);
  }

  /**
   * Salto con gravedad. La altura se suma a la del suelo que ponga el nivel (si el nivel fija
   * pos.y, por ejemplo en una explanada, esa es la nueva base).
   */
  private vertical(dt: number) {
    const p = this.pos;
    if (Math.abs(p.y - (this.baseY + this.hop)) > 1e-4) this.baseY = p.y - this.hop;
    const grounded = this.hop <= 0.001;
    this.coyote = grounded ? 0.1 : this.coyote - dt;
    // Se guarda hasta el siguiente fotograma (aunque el móvil vaya lento), pero no más de un segundo
    const fresh = jumpQueued && performance.now() - jumpAt < 180;
    if (!fresh) jumpQueued = false;
    if (fresh && this.coyote > 0 && this.canJump && this.traction >= 1 && this.stumble <= 0) {
      jumpQueued = false;
      this.vy = JUMP_V;
      this.coyote = 0;
    }
    if (this.vy !== 0 || this.hop > 0) {
      const g = this.vy < 0 ? FALL_GRAVITY : jumpHeld ? 1 : CUT_GRAVITY;
      this.vy -= GRAVITY * g * dt;
      this.hop += this.vy * dt;
      if (this.hop <= 0) {
        if (this.vy < -2) {
          this.land = Math.min(1, -this.vy / 5);
          if (this.vy < -3.5) this.shake(0.1);
          dust.puff(p.x, this.baseY, p.z, 5 + Math.round(this.land * 6), this.land);
        }
        this.hop = 0;
        this.vy = 0;
      }
    }
    this.land = Math.max(0, this.land - dt * 4.5);
    p.y = this.baseY + this.hop;
  }

  /**
   * Pone la cámara a `safe` metros de la cabeza en esa dirección. Si eso la dejaría pegada a la cabeza
   * (una pared justo detrás) no atraviesa la pared para guardar la distancia: se queda de este lado y
   * sube hasta verla desde arriba, sin meterse en lo que haya encima.
   */
  private clampCam(cp: THREE.Vector3, from: { x: number; y: number; z: number }, dx: number, dy: number, dz: number, safe: number, walls: Box2[]) {
    const s = Math.max(0, safe);
    if (s >= CAM_NEAR) {
      cp.set(from.x + dx * s, from.y + dy * s, from.z + dz * s);
      return;
    }
    const up = Math.sqrt(CAM_NEAR * CAM_NEAR - s * s);
    const roof = camWorld.cast(from.x, from.y, from.z, 0, 1, 0, up + 0.3, walls);
    cp.set(from.x + dx * s, from.y + Math.max(dy * s, Math.max(0.05, Math.min(up, roof - 0.3))), from.z + dz * s);
  }

  camera(cam: THREE.Camera, dt: number, walls: Box2[], dist = 7, h = 3.6) {
    const p = this.pos;
    // Encuadre de tercera persona más cercano y bajo: se ve a Azul y el horizonte, no el suelo desde
    // un dron. Los planos muy altos a propósito (pasillos, presentaciones) se respetan.
    if (h < 5) {
      dist *= 0.7;
      h = 1.55 + (h - 1.6) * 0.62;
    }
    const sx = -Math.sin(this.yaw);
    const sz = -Math.cos(this.yaw);
    const phys = physFor(walls);
    const minD = Math.min(1.7, dist * 0.45);
    let d = minD;
    const baseY = p.y - this.hop; // la cámara no sube y baja con cada salto
    if (phys) {
      // Esfera lanzada desde la cabeza hacia donde iría la cámara: se para antes del primer muro
      const from = { x: p.x, y: baseY + 1.5, z: p.z };
      const to = { x: p.x + sx * dist, y: baseY + h, z: p.z + sz * dist };
      const L = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
      const dir = { x: (to.x - from.x) / L, y: (to.y - from.y) / L, z: (to.z - from.z) / L };
      d = Math.max(minD, (phys.camCast(from, dir, L) / L) * dist - 0.15);
      // Con una pared justo detrás, la cámara gira poco a poco hacia donde haya sitio en vez de quedarse
      // pegada a la nuca (a mano manda quien juega)
      if (d < dist * 0.62 && this.manualCam <= 0 && dt > 0) {
        let best = d, side = 0;
        for (const da of [0.5, -0.5, 1, -1]) {
          const ax = p.x - Math.sin(this.yaw + da) * dist - from.x, az = p.z - Math.cos(this.yaw + da) * dist - from.z, ay = to.y - from.y;
          const LL = Math.hypot(ax, ay, az);
          const f = (phys.camCast(from, { x: ax / LL, y: ay / LL, z: az / LL }, LL) / LL) * dist;
          if (f > best + 0.8) {
            best = f;
            side = da;
          }
        }
        if (side) this.yaw += Math.sign(side) * Math.min(Math.abs(side), dt * 0.9);
      }
    } else {
      for (; d < dist; d += 0.25) {
        const x = p.x + sx * d;
        const z = p.z + sz * d;
        // Edificios y también muros largos y finos (antes la cámara los atravesaba)
        if (walls.some((c) => !c.low && (c.maxX - c.minX > 3 || c.maxZ - c.minZ > 3) && x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4)) break;
      }
    }
    // Y además contra lo que de verdad se ve (balcones, toldos, arcos, copas): tres rayos, en medio y a los lados
    {
      const from = { x: p.x, y: baseY + 1.5, z: p.z };
      const ty = baseY + h + (dist - d) * 0.32;
      const ex = sx * d, ey = ty - from.y, ez = sz * d;
      const L = Math.hypot(ex, ey, ez) || 1;
      const nx = -sz * 0.22, nz = sx * 0.22;
      const dx = ex / L, dy = ey / L, dz = ez / L;
      const hit = Math.min(
        camWorld.cast(from.x, from.y, from.z, dx, dy, dz, L, walls),
        camWorld.cast(from.x + nx, from.y, from.z + nz, dx, dy, dz, L, walls),
        camWorld.cast(from.x - nx, from.y, from.z - nz, dx, dy, dz, L, walls),
      );
      if (hit < L) d = Math.max(0.9, d * Math.max(0, hit - 0.3) / L);
    }
    if (this.camD < 0 || !this.camInit) this.camD = d;
    else this.camD += (d - this.camD) * Math.min(1, dt * (d < this.camD ? 14 : 2.2));
    d = this.camD;
    const run = Math.min(1, this.currentSpeed / this.speed);
    // Alturas relativas a los pies (en el agua, en una explanada o en una escalera la cámara sigue igual);
    // si una pared la acerca, sube: mirar por encima de su hombro en vez de pegarse a su nuca
    let rise = (dist - d) * 0.32;
    // Pero nunca hasta meterse en lo que tenga encima (el arco de los soportales, un toldo)
    if (rise > 0.05) {
      const ry = baseY + h + rise - (baseY + 1.5), rl = Math.hypot(d, ry) || 1;
      const free = camWorld.cast(p.x, baseY + 1.5, p.z, (sx * d) / rl, ry / rl, (sz * d) / rl, rl, walls);
      if (free < rl) rise = 0;
    }
    this.camPos.set(p.x + sx * d, baseY + h + rise, p.z + sz * d);
    // Al saltar, la mirada sube solo un poco: la cámara acompaña sin dar botes
    // La mirada se adelanta un poco hacia donde vas (se ve lo que viene) y baja un pelín al aterrizar
    const v = this.velocity;
    // De cerca (una pared detrás) mira más hacia ella: que se la vea entera y no solo la coronilla
    const far = THREE.MathUtils.clamp(d / 4.5, 0.05, 1);
    const ahead = 1.5 * far;
    this.camLook.set(p.x - sx * ahead + v.x * 0.16, baseY + 1.3 - (1 - far) * 0.55 + this.hop * 0.35 - this.land * 0.12, p.z - sz * ahead + v.z * 0.16);
    if (!this.camInit || cam.position.distanceToSquared(this.camPos) > 400) {
      // Primera vez o teletransporte: sin muelle
      this.camInit = true;
      cam.position.copy(this.camPos);
      this.camVel.set(0, 0, 0);
      this.lookVel.set(0, 0, 0);
      cam.userData.look = this.camLook.clone();
    }
    // Cámara con muelle (como una steadicam): sigue con un pelín de retraso y frena sin tirones
    const look = (cam.userData.look as THREE.Vector3 | undefined) ?? (cam.userData.look = this.camLook.clone());
    const cp = cam.position;
    const k = dt <= 0 ? 0 : dt;
    for (const ax of ['x', 'y', 'z'] as const) {
      [cp[ax], this.camVel[ax]] = spring(cp[ax], this.camVel[ax], this.camPos[ax], 5.5, k);
      [look[ax], this.lookVel[ax]] = spring(look[ax], this.lookVel[ax], this.camLook[ax], 9, k);
    }
    // El muelle va con un pelín de retraso: si en ese retraso la cámara quedara dentro de un muro
    // (al girar una esquina), se adelanta hasta el borde. Nunca se ve el interior de una pared.
    if (phys) {
      const from = { x: p.x, y: baseY + 1.5, z: p.z };
      const ex = cp.x - from.x, ey = cp.y - from.y, ez = cp.z - from.z;
      const L = Math.hypot(ex, ey, ez);
      if (L > 0.5) {
        const free = phys.camCast(from, { x: ex / L, y: ey / L, z: ez / L }, L);
        if (free < L - 0.05) this.clampCam(cp, from, ex / L, ey / L, ez / L, free - 0.1, walls);
      }
    }
    {
      const fy = baseY + 1.5;
      const ex = cp.x - p.x, ey = cp.y - fy, ez = cp.z - p.z;
      const L = Math.hypot(ex, ey, ez);
      if (L > 0.5) {
        const free = camWorld.cast(p.x, fy, p.z, ex / L, ey / L, ez / L, L, walls);
        if (free < L - 0.05) this.clampCam(cp, { x: p.x, y: fy, z: p.z }, ex / L, ey / L, ez / L, free - 0.25, walls);
      }
    }
    // Que no roce nada: una pared que pasa de lado a menos de un palmo se vería por dentro
    for (const [ax, az] of CAM_SIDES) {
      const t = camWorld.cast(cp.x, cp.y, cp.z, ax, 0, az, CAM_ROOM, walls);
      if (t < CAM_ROOM) {
        cp.x -= ax * (CAM_ROOM - t);
        cp.z -= az * (CAM_ROOM - t);
      }
    }
    const over = camWorld.cast(cp.x, cp.y, cp.z, 0, 1, 0, CAM_ROOM, walls);
    if (over < CAM_ROOM) cp.y -= CAM_ROOM - over;
    // Un leve balanceo con los pasos al correr
    const bob = Math.abs(Math.sin(this.walk)) * 0.04 * run;
    cam.lookAt(look.x, look.y + bob, look.z);
    const pc = cam as THREE.PerspectiveCamera;
    if (pc.isPerspectiveCamera) {
      if (!this.baseFov) this.baseFov = pc.fov;
      const fov = (pc.userData.baseFov ?? this.baseFov) + run * 3 + (this.boost - 1) * 26;
      if (Math.abs(pc.fov - fov) > 0.05) {
        pc.fov += (fov - pc.fov) * Math.min(1, k * 3);
        pc.updateProjectionMatrix();
      }
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = this.shakeT * 0.25;
      cp.x += (Math.random() - 0.5) * s;
      cp.y += (Math.random() - 0.5) * s;
    }
  }
}
