// Estado del salto de cada personaje que mueve un Walker, por la posición de su raíz: así la
// animación (animatePerson) sabe si está en el aire o aterrizando sin que cada nivel lo pase.
export interface AirState {
  /** Altura sobre el suelo (m). */
  hop: number;
  /** Velocidad vertical (m/s). */
  vy: number;
  /** Aterrizaje: 1 justo al tocar el suelo y baja a 0 (las rodillas absorben el golpe). */
  land: number;
}
export const airOf = new WeakMap<object, AirState>();
