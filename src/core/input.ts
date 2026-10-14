// Entrada unificada: joystick virtual (mitad izquierda), arrastre para girar cámara (mitad derecha),
// botón de acción en pantalla, y teclado/ratón para probar en el ordenador.
export class Input {
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

  private base: HTMLDivElement;
  private knob: HTMLDivElement;

  constructor(surface: HTMLElement, ui: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'stick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'stick-knob';
    this.base.appendChild(this.knob);
    ui.appendChild(this.base);

    surface.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') this.actionQueued = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    const left = e.clientX < window.innerWidth * 0.45;
    if (left && this.stickId === null) {
      this.stickId = e.pointerId;
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.base.classList.add('on');
      this.knob.style.transform = 'translate(-50%,-50%)';
    } else if (!left && this.camId === null) {
      this.camId = e.pointerId;
      this.camLastX = e.clientX;
    }
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId === this.stickId) {
      const R = 55;
      let dx = e.clientX - this.stickOrigin.x;
      let dy = e.clientY - this.stickOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.moveX = dx / R;
      this.moveY = -dy / R;
    } else if (e.pointerId === this.camId) {
      this.camDelta += (e.clientX - this.camLastX) * 0.008;
      this.camLastX = e.clientX;
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.moveX = this.moveY = 0;
      this.base.classList.remove('on');
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
      }
      if (k.has('KeyQ')) this.camDelta -= 0.04;
      if (k.has('KeyR')) this.camDelta += 0.04;
    }
    if (!this.enabled) return { x: 0, y: 0 };
    return { x, y };
  }

  queueAction() {
    this.actionQueued = true;
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
    this.base.classList.remove('on');
  }
}
