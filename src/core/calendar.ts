// Calendario del regalo: el juego se entrega el 25 de noviembre, hasta el 26 solo se ve la cuenta atrás, el
// capítulo 1 se abre el 28 (su cumpleaños) y los demás en días sueltos hasta el 9, el día de Navidad.
// (En JavaScript los meses empiezan en 0: 10 = noviembre, 11 = diciembre.)

/** Hasta este momento solo se ve la cuenta atrás; desde aquí, el menú. */
export const GATE = new Date(2026, 10, 26);

/** Día en que se abre cada capítulo (a las 00:00), del 1 al 9. */
export const OPEN_DAYS = [
  new Date(2026, 10, 28), // 1 · su cumpleaños
  new Date(2026, 11, 2),
  new Date(2026, 11, 5),
  new Date(2026, 11, 9),
  new Date(2026, 11, 12),
  new Date(2026, 11, 16),
  new Date(2026, 11, 19),
  new Date(2026, 11, 22),
  new Date(2026, 11, 25), // 9 · Navidad
];

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * «Ahora». En modo prueba se puede fingir otro día para revisar cada momento del calendario: `?hoy=2026-11-25` en la
 * dirección (se queda guardado) o `?hoy=` para volver al de verdad.
 */
let fake: number | null = null;
export function initClock(test: boolean) {
  if (!test) return;
  try {
    const q = new URLSearchParams(location.search).get('hoy');
    if (q !== null) {
      if (q) localStorage.setItem('margaux-hoy', q);
      else localStorage.removeItem('margaux-hoy');
    }
    const v = localStorage.getItem('margaux-hoy');
    const m = v && /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(v);
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0);
      fake = d.getTime() - Date.now();
    }
  } catch {
    /* sin almacenamiento: el día de verdad */
  }
}
export const now = () => Date.now() + (fake ?? 0);
export const faking = () => fake !== null;

/** Día de apertura del capítulo i (0…8). */
export const openDay = (i: number) => OPEN_DAYS[i];

/** Días de calendario entre hoy y d (0 = hoy, 1 = mañana). */
export function daysUntil(d: Date) {
  const n = new Date(now());
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) / 86400000);
}

/** «28 de noviembre». */
export const longDate = (d: Date) => `${d.getDate()} de ${MONTHS[d.getMonth()]}`;

/** Lo que falta hasta d, en días, horas, minutos y segundos (todo a 0 si ya pasó). */
export function left(d: Date) {
  const s = Math.max(0, Math.floor((d.getTime() - now()) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, done: s === 0 };
}
