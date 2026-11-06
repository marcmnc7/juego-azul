import type * as THREE from 'three';
import type { Box2 } from '../world/ferreries';
import { physFor } from './phys';

// Acompañantes (Joy, Gas, Eric…) que siguen a alguien sin atravesar nada: van por donde ha pasado
// quien guía (un rastro de migas), de modo que entran por las puertas y rodean las esquinas igual
// que él, y cada paso pasa por el controlador de personaje para resbalar en las paredes.

const CRUMB = 0.35; // cada cuánto se deja una miga (m)

export class Trail {
  private crumbs: { x: number; z: number }[] = [];
  private stuck = 0;
  private last = { x: 0, z: 0 };
  /** A qué ritmo va el guía (m/s, suavizado): quien sigue va casi igual de rápido. */
  private leadSpeed = 0;
  private leadAt: { x: number; z: number } | null = null;
  /** La soltura con la que anda ahora (0 a 1): para la animación. */
  pace = 0;

  /**
   * Avanza `root` hacia quien guía. `gap` es la distancia a la que se queda. Devuelve si se mueve.
   * Va casi al paso del guía y, si se queda atrás, aprieta. Solo reaparece en el rastro tras un corte
   * o un salto de fase (cuando el guía está tan lejos que corriendo no llegaría).
   */
  step(root: THREE.Object3D, lead: { x: number; z: number }, gap: number, speed: number, dt: number, walls: readonly Box2[], r = 0.26, limit = Infinity) {
    const pos = root.position;
    const c = this.crumbs;
    const tail = c[c.length - 1];
    // Un salto del guía (fase nueva): el rastro viejo ya no vale
    if (tail && Math.hypot(lead.x - tail.x, lead.z - tail.z) > 5) c.length = 0;
    if (!c.length || Math.hypot(lead.x - c[c.length - 1].x, lead.z - c[c.length - 1].z) > CRUMB) c.push({ x: lead.x, z: lead.z });

    const dLead = Math.hypot(lead.x - pos.x, lead.z - pos.z);
    if (this.leadAt && dt > 0) {
      const v = Math.min(12, Math.hypot(lead.x - this.leadAt.x, lead.z - this.leadAt.z) / dt);
      this.leadSpeed += (v - this.leadSpeed) * Math.min(1, dt * 5);
    }
    this.leadAt = { x: lead.x, z: lead.z };
    // Demasiado lejos (un corte, una fase nueva): se recoloca en el rastro (o, sin rastro, justo detrás)
    if (dLead > 22) {
      const b = c.length > 4 ? c[c.length - 4] : lead;
      pos.x = b.x;
      pos.z = b.z;
      this.stuck = 0;
      c.splice(0, Math.max(0, c.length - 4));
      return false;
    }
    if (dLead <= gap) {
      this.stuck = 0;
      this.pace = 0;
      return false;
    }
    // Borra las migas ya alcanzadas y coge la siguiente que no esté pegada
    while (c.length > 1 && Math.hypot(c[0].x - pos.x, c[0].z - pos.z) < 0.45) c.shift();
    const t = c[0] ?? lead;
    const dx = t.x - pos.x, dz = t.z - pos.z;
    const d = Math.hypot(dx, dz) || 1;
    // Al ritmo del guía (nunca menos que el suyo propio) y, cuanto más atrás, más aprieta
    const pace = Math.min(limit, Math.max(speed, this.leadSpeed * 0.97) + Math.max(0, dLead - gap - 1) * 0.9);
    const stepLen = Math.min(pace * dt * Math.min(1, (dLead - gap) * 1.5 + 0.3), d);
    const want = { x: (dx / d) * stepLen, z: (dz / d) * stepLen };
    const phys = physFor(walls as Box2[]);
    const got = phys ? phys.move(this, { x: pos.x, y: 0, z: pos.z }, want.x, want.z, r) : want;
    pos.x += got.x;
    pos.z += got.z;
    const real = Math.hypot(got.x, got.z);
    this.pace = dt > 0 ? Math.min(1, real / dt / 5.2) : 0;
    // Girar hacia donde anda de verdad, sin saltos
    if (real > 1e-3) {
      const a = Math.atan2(got.x, got.z);
      const da = Math.atan2(Math.sin(a - root.rotation.y), Math.cos(a - root.rotation.y));
      root.rotation.y += da * Math.min(1, dt * 12);
    }
    // Atascado contra algo: salta a la miga para no quedarse empujando la pared
    if (real < stepLen * 0.25) this.stuck += dt;
    else this.stuck = 0;
    if (this.stuck > 0.5 && c.length > 1) c.shift();
    this.last.x = pos.x;
    this.last.z = pos.z;
    return real > 1e-3;
  }

  /** Empieza un rastro nuevo (al cambiar de sitio o de fase). */
  reset() {
    this.crumbs.length = 0;
    this.stuck = 0;
  }
}
