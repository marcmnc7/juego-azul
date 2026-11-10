// Entrada unificada: joystick virtual (mitad izquierda), arrastre para girar cámara (mitad derecha),
// botón de acción en pantalla, y teclado/ratón para probar en el ordenador.
export class Input {
  /** Radio del aro del joystick, en píxeles de pantalla. */
  static readonly R = 52;
  moveX = 0; // -1..1 (derecha +)
  moveY = 0; // -1..1 (adelante +)
  camDelta = 0; // radianes acumulados desde el último consume
  private actionQueued = false;
  private keys = new Set<string>();
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private camId: number | null = null;
  private camLastX = 0;
  enabled = true;
  /** Cuánto se ha usado cada control (lo mira el tutorial): segundos de joystick, píxeles de cámara, acciones. */
  readonly usage = { stick: 0, cam: 0, action: 0 };
  private stickAt = 0;

  private base: HTMLDivElement;
  private knob: HTMLDivElement;

  constructor(surface: HTMLElement, ui: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'stick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'stick-knob';
    this.base.appendChild(this.knob);
    ui.appendChild(this.base);
    this.ghost();

    surface.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      // Con un diálogo abierto la tecla solo sirve para avanzarlo (si no, se reabría al cerrarlo)
      if ((e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') && !document.querySelector('.dialogue')) this.actionQueued = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    // Si el móvil se va a segundo plano con el dedo en el joystick, el "soltar" no llega nunca
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.reset();
    });
    document.addEventListener('visibilitychange', () => document.hidden && this.reset());
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    const left = e.clientX < window.innerWidth * 0.45;
    if (left) {
      this.stickId = e.pointerId;
      // El aro se queda donde cae el pulgar (algo hacia dentro si es muy al borde, para que se vea entero) y ya
      // no se mueve: solo se mueve la bola, hasta el borde del aro
      const m = Input.R + 14;
      const x = Math.max(m, Math.min(window.innerWidth * 0.45, e.clientX));
      const y = Math.max(m + 60, Math.min(window.innerHeight - m, e.clientY));
      this.stickOrigin = { x, y };
      this.base.style.left = `${x}px`;
      this.base.style.top = `${y}px`;
      this.base.classList.add('on');
      this.base.classList.remove('ghost');
      this.knob.style.transform = 'translate(-50%,-50%)';
    } else if (!left && this.camId === null) {
      this.camId = e.pointerId;
      this.camLastX = e.clientX;
    }
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId === this.stickId) {
      const R = Input.R;
      let dx = e.clientX - this.stickOrigin.x;
      let dy = e.clientY - this.stickOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        // Pasado el borde, la bola se queda en el borde (el aro no se mueve)
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      // Zona muerta pequeña y velocidad máxima a algo más de media carrera: no hace falta llevar el pulgar al
      // borde para correr. Por debajo, un poco de pulgar = andar despacio
      const r = Math.min(1, Math.hypot(dx, dy) / R);
      const m = Math.min(1, len / (R * 0.62));
      const g = m < 0.1 ? 0 : Math.pow((m - 0.1) / 0.9, 1.1) / (r || 1);
      this.moveX = (dx / R) * g;
      this.moveY = (-dy / R) * g;
      const now = performance.now();
      if (m > 0.3 && this.stickAt) this.usage.stick += Math.min(0.1, (now - this.stickAt) / 1000);
      this.stickAt = now;
    } else if (e.pointerId === this.camId) {
      // Misma sensación en cualquier pantalla: media pantalla de arrastre ≈ media vuelta
      this.camDelta += ((e.clientX - this.camLastX) / Math.max(480, window.innerWidth)) * 6.5;
      this.usage.cam += Math.abs(e.clientX - this.camLastX);
      this.camLastX = e.clientX;
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.moveX = this.moveY = 0;
      this.ghost();
    } else if (e.pointerId === this.camId) {
      this.camId = null;
    }
  };

  /** Dirección final combinando teclado y joystick. */
  axes() {
    let x = this.moveX;
    let y = this.moveY;
    if (this.keys.size) {
      const k = this.keys;
      const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      if (kx || ky) {
        x = kx;
        y = ky;
        this.usage.stick += 1 / 60;
      }
      if (k.has('KeyQ')) this.camDelta -= 0.04;
      if (k.has('KeyR')) this.camDelta += 0.04;
    }
    if (!this.enabled) return { x: 0, y: 0 };
    return { x, y };
  }

  /** ¿Está pulsada esta tecla? (p. ej. Mayúsculas para ir de puntillas con el teclado) */
  held(code: string) {
    return this.keys.has(code);
  }

  queueAction() {
    this.actionQueued = true;
    this.usage.action++;
  }

  consumeAction() {
    const a = this.actionQueued;
    this.actionQueued = false;
    return a && this.enabled;
  }

  consumeCam() {
    const d = this.camDelta;
    this.camDelta = 0;
    return d;
  }

  reset() {
    this.stickId = this.camId = null;
    this.moveX = this.moveY = 0;
    this.actionQueued = false;
    this.ghost();
  }

  /** Sin dedo: el joystick se queda en su sitio, transparente, para que se sepa dónde tocar. */
  private ghost() {
    this.base.classList.remove('on');
    this.base.classList.add('ghost');
    this.base.style.left = this.base.style.top = '';
    this.knob.style.transform = 'translate(-50%,-50%)';
  }
}
