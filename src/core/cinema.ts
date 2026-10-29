import * as THREE from 'three';

// Escenas de cine: una lista de planos que manda sobre la cámara del capítulo mientras dura (cada
// plano con su movimiento, su encuadre, su enfoque y, si hace falta, cámara lenta). El bucle
// principal lo aplica después de que el capítulo coloque la cámara, así que ningún capítulo tiene
// que cambiar su lógica: pide los planos y sigue a lo suyo.

/** Un punto fijo o uno que se recalcula en cada fotograma (para seguir a alguien que se mueve). */
export type At = THREE.Vector3 | (() => THREE.Vector3);

export interface Shot {
  /** Segundos que dura el plano. Infinity = se queda hasta que alguien llame a cinema.stop() o next(). */
  dur: number;
  pos: At;
  look: At;
  /** A dónde va la cámara durante el plano (travelling). Sin esto, el plano es fijo. */
  pos2?: At;
  look2?: At;
  /** Segundos que tarda el travelling (por defecto, lo que dura el plano). */
  move?: number;
  /** Ángulo de visión al principio y al final (más pequeño = teleobjetivo, más cerrado). */
  fov?: number;
  fov2?: number;
  /** Velocidad del mundo durante el plano: 0.2 = cámara lenta. */
  slow?: number;
  /** Lo que queda nítido; el resto se desenfoca. */
  focus?: At;
  /** Cámara en mano: un leve vaivén (metros). */
  handheld?: number;
  /** Se llama al empezar el plano. */
  at?: () => void;
}

const val = (a: At | undefined, out: THREE.Vector3) => (a === undefined ? null : out.copy(typeof a === 'function' ? a() : a));
const ease = (k: number) => k * k * k * (k * (k * 6 - 15) + 10);

class Cinema {
  private shots: Shot[] = [];
  private i = -1;
  private t = 0;
  private total = 0;
  private done: (() => void) | null = null;
  private baseFov = 0;
  private p0 = new THREE.Vector3();
  private p1 = new THREE.Vector3();
  private l0 = new THREE.Vector3();
  private l1 = new THREE.Vector3();
  /** Velocidad del mundo (la lee el bucle principal). Vuelve a 1 con suavidad al acabar. */
  timeScale = 1;
  /** Punto enfocado del plano actual, o null. */
  readonly focus = new THREE.Vector3();
  hasFocus = false;

  get active() {
    return this.i >= 0;
  }

  /** Empieza una escena. onDone se llama al acabar el último plano (no si se corta con stop). */
  play(shots: Shot[], onDone?: () => void) {
    this.shots = shots;
    this.done = onDone ?? null;
    this.i = -1;
    this.next();
  }

  /** Pasa al plano siguiente (o termina si era el último). */
  next() {
    this.i++;
    this.t = 0;
    if (this.i >= this.shots.length) {
      const d = this.done;
      this.end();
      d?.();
      return;
    }
    this.shots[this.i].at?.();
  }

  /** Corta la escena sin llamar a su final (salir del capítulo, saltar…). La cámara lenta se acaba ya. */
  stop() {
    this.end();
    this.timeScale = 1;
  }

  private end() {
    this.i = -1;
    this.shots = [];
    this.done = null;
    this.hasFocus = false;
  }

  /** Coloca la cámara si hay escena. Devuelve si la ha movido. */
  update(cam: THREE.PerspectiveCamera, dt: number) {
    const s = this.shots[this.i];
    // La cámara lenta entra y sale con suavidad (nunca de golpe)
    const want = s?.slow ?? 1;
    this.timeScale += (want - this.timeScale) * Math.min(1, dt * (want < this.timeScale ? 5 : 2.5));
    if (!s) {
      if (this.baseFov) {
        cam.fov = this.baseFov;
        cam.updateProjectionMatrix();
        this.baseFov = 0;
      }
      return false;
    }
    if (!this.baseFov) this.baseFov = cam.fov;
    this.t += dt;
    this.total += dt;
    const k = ease(Math.min(1, this.t / Math.max(0.001, s.move ?? (isFinite(s.dur) ? s.dur : 2))));
    val(s.pos, this.p0)!;
    val(s.look, this.l0)!;
    if (val(s.pos2, this.p1)) this.p0.lerp(this.p1, k);
    if (val(s.look2, this.l1)) this.l0.lerp(this.l1, k);
    if (s.handheld) {
      const h = s.handheld, T = this.total;
      this.p0.x += Math.sin(T * 1.3) * h + Math.sin(T * 3.1) * h * 0.3;
      this.p0.y += Math.sin(T * 1.7 + 1) * h * 0.7;
      this.p0.z += Math.cos(T * 1.1) * h;
    }
    cam.position.copy(this.p0);
    cam.lookAt(this.l0);
    const f0 = s.fov ?? this.baseFov;
    const fov = s.fov2 !== undefined ? THREE.MathUtils.lerp(f0, s.fov2, k) : f0;
    if (Math.abs(cam.fov - fov) > 1e-3) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    this.hasFocus = !!val(s.focus, this.focus);
    if (this.t >= s.dur) this.next();
    return true;
  }
}

export const cinema = new Cinema();

/** Rótulo grande de cine sobre la imagen (un nombre, una fecha), que entra y se va solo. */
export function cineTitle(text: string, sub = '', secs = 3.2) {
  const root = document.getElementById('ui')!;
  const t = document.createElement('div');
  t.className = 'cine-title';
  t.style.setProperty('--secs', `${secs}s`);
  const big = document.createElement('div');
  big.className = 'cine-big';
  big.textContent = text;
  t.append(big);
  if (sub) {
    const s = document.createElement('div');
    s.className = 'cine-sub';
    s.textContent = sub;
    t.append(s);
  }
  root.append(t);
  setTimeout(() => t.remove(), secs * 1000 + 200);
}

// ---------- Ayudas para encuadrar ----------

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Posición de la cabeza (o de los ojos) de un personaje, en el mundo. */
export function headOf(p: { root: THREE.Object3D; head: THREE.Object3D; rig?: { bones: Map<string, THREE.Object3D> } }, up = 0.06) {
  const b = p.rig?.bones.get('Head') ?? p.head;
  return b.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, up, 0));
}

/**
 * Punto de cámara respecto a una línea entre dos cosas (from → to): `back` metros por detrás de from,
 * `side` a la derecha y `up` arriba. Es el plano de "por encima del hombro" o el contraplano.
 */
export function rel(from: THREE.Vector3, to: THREE.Vector3, back: number, side: number, up: number) {
  _a.subVectors(to, from).setY(0);
  if (_a.lengthSq() < 1e-6) _a.set(0, 0, 1);
  _a.normalize();
  _b.set(_a.z, 0, -_a.x); // derecha
  return from.clone().addScaledVector(_a, -back).addScaledVector(_b, side).add(new THREE.Vector3(0, up, 0));
}
