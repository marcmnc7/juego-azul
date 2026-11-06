import type { Person } from './models';

/**
 * Anda muy cojo del pie derecho: encima de la animación, la pierna mala casi no se dobla, el cuerpo se hunde y
 * se ladea al apoyarla, la cabeza va baja y un brazo se abre para no perder el equilibrio.
 * Se llama justo después de animatePerson. Parado, se queda descargando esa pierna.
 */
export function limpPose(p: Person, moving: boolean) {
  const ph = p.auto?.ph ?? 0;
  const s = Math.sin(ph);
  if (moving) {
    p.legR.rotation.x *= 0.42;
    p.kneeR.rotation.x *= 0.22;
    p.footR.rotation.x *= 0.3;
    p.body.position.y -= 0.035 + 0.085 * Math.max(0, s);
    p.body.rotation.z += s * 0.19;
    p.body.rotation.x += 0.1 + Math.max(0, s) * 0.07;
    p.head.rotation.x += 0.14;
    p.head.rotation.z -= s * 0.08;
    p.armL.rotation.z += -0.32 - Math.max(0, s) * 0.2;
    p.armR.rotation.x *= 0.6;
  } else {
    p.legR.rotation.x -= 0.14;
    p.kneeR.rotation.x += 0.24;
    p.body.rotation.z -= 0.07;
    p.head.rotation.x += 0.08;
  }
}
