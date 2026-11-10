/**
 * Pistas solo para quien se ha perdido (lo que se aprendió en el cap. 2): la flecha del HUD, la columna de luz
 * y el marcador sobre el objetivo no salen de entrada, sino cuando se llevan `after` segundos sin avanzar.
 *
 * Cada capítulo describe su avance con una clave (fase, cosas recogidas, con quién ha hablado…): cuando la clave
 * cambia, el reloj vuelve a cero. Uso, en el `update` del capítulo:
 *
 *   const tgt = this.lost.tick(`${this.phase}|${this.cosas}`, dt, this.busy) ? this.target() : null;
 */
export class Lost {
  private key = '';
  private t = 0;
  constructor(readonly after = 40) {}

  /** true si lleva `after` s con la misma clave (sin contar el tiempo `paused`: diálogos, escenas). */
  tick(key: string, dt: number, paused = false) {
    if (key !== this.key) {
      this.key = key;
      this.t = 0;
    }
    if (!paused) this.t += dt;
    return this.t > this.after;
  }

  /** Vuelve a esperar (al saltar de fase en el modo prueba, al reintentar). */
  reset() {
    this.t = 0;
  }

  /** Segundos con la misma clave (para avisos intermedios, p. ej. un bocadillo a los 20 s). */
  get seconds() {
    return this.t;
  }
}
