// Controles táctiles: joystick que aparece donde se toca en la mitad izquierda, arrastrar en la
// derecha para girar la cámara (y pellizcar para acercarla). En ordenador: WASD/flechas, espacio,
// ratón para mirar, Mayús para andar.

export class Input {
  move = { x: 0, y: 0 };
  look = { dx: 0, dy: 0 };
  zoom = 0;
  jump = false;
  dance = false;
  walkKey = false;
  lastLook = -1e9;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private lookIds = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  private keys = new Set<string>();

  constructor(el: HTMLElement, private stick: HTMLElement, jumpBtn: HTMLElement, danceBtn: HTMLElement) {
    el.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.moveEv(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    el.addEventListener('wheel', (e) => { this.zoom += e.deltaY * 0.002; e.preventDefault(); }, { passive: false });
    const press = (b: HTMLElement, f: () => void) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); f(); });
    press(jumpBtn, () => (this.jump = true));
    press(danceBtn, () => (this.dance = true));
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') this.jump = true;
      if (e.code === 'KeyB') this.dance = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private down(e: PointerEvent) {
    if (e.pointerType !== 'mouse' && e.clientX < window.innerWidth * 0.45 && this.stickId === null) {
      this.stickId = e.pointerId;
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      this.stick.style.display = 'block';
      this.stick.style.left = e.clientX + 'px';
      this.stick.style.top = e.clientY + 'px';
      (this.stick.firstElementChild as HTMLElement).style.transform = '';
    } else {
      this.lookIds.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.lookIds.size === 2) this.pinch = this.pinchDist();
    }
  }

  private pinchDist() {
    const p = [...this.lookIds.values()];
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }

  private moveEv(e: PointerEvent) {
    if (e.pointerId === this.stickId) {
      let dx = e.clientX - this.stickOrigin.x, dy = e.clientY - this.stickOrigin.y;
      const r = 55, d = Math.hypot(dx, dy);
      if (d > r) { dx *= r / d; dy *= r / d; }
      this.move.x = dx / r; this.move.y = dy / r;
      (this.stick.firstElementChild as HTMLElement).style.transform = `translate(${dx}px, ${dy}px)`;
      return;
    }
    const p = this.lookIds.get(e.pointerId);
    if (!p) return;
    if (this.lookIds.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const d = this.pinchDist();
      this.zoom -= (d - this.pinch) * 0.01;
      this.pinch = d;
      return;
    }
    this.look.dx += e.clientX - p.x;
    this.look.dy += e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    this.lastLook = performance.now();
  }

  private up(e: PointerEvent) {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.move.x = this.move.y = 0;
      this.stick.style.display = 'none';
    }
    this.lookIds.delete(e.pointerId);
  }

  /** Dirección pedida (x derecha, y hacia delante) en -1..1 y si se quiere correr. */
  read() {
    let x = this.move.x, y = -this.move.y;
    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); x = kx / l; y = ky / l; }
    const walk = k.has('ShiftLeft') || k.has('ShiftRight');
    return { x, y, run: !walk };
  }

  consume() {
    const r = { jump: this.jump, dance: this.dance, dx: this.look.dx, dy: this.look.dy, zoom: this.zoom };
    this.jump = this.dance = false;
    this.look.dx = this.look.dy = 0;
    this.zoom = 0;
    return r;
  }
}
