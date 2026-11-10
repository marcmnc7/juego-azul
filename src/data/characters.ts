import type { PersonLook } from '../entities/models';

// Personajes de VRoid Studio (VRM 1.0). Para añadir uno (ver docs/PLAN-reparto-vroid.md):
//   python3 scripts/vrm_slim.py <exportado>.vrm src/assets/vrm/<nombre>.vrm
// y ya está: el archivo se encuentra por su nombre (castVrm) y lo usa quien lo tenga en su look (castLook). Si el
// archivo no está, ese personaje sigue con su modelo de antes.

// Aspecto de los protagonistas. Azul: rubia, ojos verdes y, cómo no, de azul.
// Sacado de las fotos: ella, rubia tirando a miel y ojos verdes; él, pelo castaño
// oscuro rizado con volumen arriba, bigote fino y perilla.
// Ropa: top corto blanco de punto y vaqueros, a juego con la camiseta y los vaqueros de Gas
export const MARGAUX_LOOK: PersonLook = { skin: 0xf4d0b0, shirt: 0xf2eee6, pants: 0x4a6f9c, hair: 0xcfa767, hairStyle: 'straight', skirt: true, eyes: 0x2f9e5b, jeans: true, azul: true };
// Gas: camiseta verde militar y vaqueros (los capítulos con camisa de otro color la cambian)
export const MARC_LOOK: PersonLook = { skin: 0xe8b894, shirt: 0x5b6b3a, pants: 0x3f5f8a, hair: 0x84593a, hairStyle: 'short', male: true, curls: true, stache: true, gas: true };

// ---------- Reparto de VRoid ----------

/** Todos los .vrm de src/assets/vrm/, por su nombre sin extensión (azul_ferreries, gas_diario, tofol…). */
const FILES = import.meta.glob('../assets/vrm/*.vrm', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const BY_NAME = new Map(Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.vrm$/, ''), url]));
const NAME_OF = new Map([...BY_NAME].map(([n, u]) => [u, n]));

/** La dirección del VRM de ese personaje, o undefined si todavía no está hecho. */
export function castVrm(name: string): string | undefined {
  return BY_NAME.get(name);
}

/** El look con su VRM puesto, si el archivo existe (si no, el look tal cual: el modelo de antes). */
export function castLook(look: PersonLook, name: string): PersonLook {
  const vrm = castVrm(name);
  return vrm ? { ...look, vrm } : look;
}

/** Altura de cada personaje en metros (la de su ficha en docs/PLAN-reparto-vroid.md). */
const HEIGHT: Record<string, number> = {
  carme: 1.64, fabiolera: 1.62, tofol: 1.72, fito: 1.78, eric: 1.32,
  padre_azul: 1.76, madre_azul: 1.62, padre_gas: 1.75, madre_gas: 1.6,
};
export function vrmHeight(url: string) {
  const n = NAME_OF.get(url) ?? '';
  if (HEIGHT[n]) return HEIGHT[n];
  if (n.startsWith('azul_')) return 1.66;
  if (n.startsWith('gas_')) return 1.8;
  if (n.startsWith('nino_')) return 1.3;
  if (/(^|_)(m\d|mujer|amiga|madre)|_m$/.test(n)) return 1.63;
  return 1.74;
}

/** Sant Joan (cap. 6): camisetas blancas con el caballo; también en el taxi de vuelta. */
export const AZUL_SANTJOAN: PersonLook = castLook({ ...MARGAUX_LOOK, shirt: 0xffffff, pants: 0x6f8fb8, skirt: false, shorts: true }, 'azul_santjoan');
export const GAS_SANTJOAN: PersonLook = castLook({ ...MARC_LOOK, shirt: 0xffffff, pants: 0x2d3a55, shorts: true }, 'gas_santjoan');
/** La ropa de diario (caps. 2, 3, 7, 8 y misiones), con su VRM. */
export const AZUL_DIARIO: PersonLook = castLook(MARGAUX_LOOK, 'azul_diario');
export const GAS_DIARIO: PersonLook = castLook(MARC_LOOK, 'gas_diario');

/** Azul del cap. 1 (mono negro): el único VRM que había antes del reparto. */
export const AZUL_VRM = { ferreries: castVrm('azul_ferreries') };

/**
 * Qué VRM usa cada capítulo y cuántas personas a la vez como mucho lo llevan (en escenas distintas que siguen
 * vivas: el coche y el camping del 3, una misión encima del capítulo…). Se cargan al empezar el capítulo y se
 * sueltan al pasar a otro. Las copias comparten geometría y texturas: solo cuesta su esqueleto.
 */
const CAST_BY_CHAPTER: Record<number, [name: string, count: number][]> = {
  1: [['azul_ferreries', 1], ['gas_ferreries', 1], ['tofol', 1], ['carme', 1], ['fabiolera', 1], ['nino_1', 1], ['nino_2', 1], ['nino_3', 1], ['extra_m1', 1], ['extra_m2', 1], ['extra_h1', 1], ['extra_h2', 1]],
  2: [['azul_diario', 1], ['gas_diario', 1], ['azul_piscina', 1], ['gas_piscina', 1], ['amigo_imperi', 1], ['amiga_imperi_1', 1], ['amiga_imperi_2', 1]],
  3: [['azul_diario', 4], ['gas_diario', 4], ['camarero_laurel', 1]],
  4: [['azul_diario', 1], ['gas_fito', 1], ['camarero_fito', 1], ['agente_aeropuerto_h', 1], ['agente_aeropuerto_m', 1], ['fito', 1], ['bajista', 1], ['saxofonista', 1], ['bateria', 1]],
  5: [['azul_moto', 2], ['gas_moto', 2], ['extra_h3', 1], ['extra_h4', 2], ['extra_m1', 1]],
  // (un caixer por caballo: 4 por la calle, 2 por Ses Voltes y 3 en Es Bè)
  6: [['azul_santjoan', 4], ['gas_santjoan', 4], ['taxista', 3], ['caixer', 9]],
  7: [['azul_diario', 1], ['gas_diario', 2], ['padre_azul', 2], ['madre_azul', 2], ['vecino', 1]],
  8: [['azul_diario', 3], ['gas_diario', 3], ['padre_azul', 1], ['madre_azul', 1], ['padre_gas', 1], ['madre_gas', 1], ['eric', 1], ['extra_mayor_m', 1], ['extra_mayor_h', 1]],
  9: [['azul_aniversario', 1], ['gas_diario', 2], ['azul_diario', 1], ['azul_playa', 1], ['gas_playa', 1], ['tofol', 1], ['carme', 1], ['fabiolera', 1], ['extra_m1', 1], ['extra_m2', 1], ['extra_h1', 1], ['extra_h2', 1]],
};

/** Los VRM que existen para ese capítulo: dirección, cuántas copias y altura. */
export function castFor(chapter: number): [url: string, count: number, height: number][] {
  const out: [string, number, number][] = [];
  for (const [name, count] of CAST_BY_CHAPTER[chapter] ?? []) {
    const url = castVrm(name);
    if (url) out.push([url, count, vrmHeight(url)]);
  }
  return out;
}
