import type { PersonLook } from '../entities/models';
// Personajes de VRoid Studio (VRM 1.0). Para añadir uno: exportarlo de VRoid, aligerarlo con
// `python3 scripts/vrm_slim.py <exportado>.vrm src/assets/vrm/<nombre>.vrm`, importarlo aquí, ponerlo en
// VRM_FILES con su altura y usarlo en un look con `vrm: <url>`.
import azulFerreriesVrm from '../assets/vrm/azul_ferreries.vrm';

// Aspecto de los protagonistas. Azul: rubia, ojos verdes y, cómo no, de azul.
// Sacado de las fotos: ella, rubia tirando a miel y ojos verdes; él, pelo castaño
// oscuro rizado con volumen arriba, bigote fino y perilla.
// Ropa: top corto blanco de punto y vaqueros, a juego con la camiseta y los vaqueros de Gas
export const MARGAUX_LOOK: PersonLook = { skin: 0xf4d0b0, shirt: 0xf2eee6, pants: 0x4a6f9c, hair: 0xcfa767, hairStyle: 'straight', skirt: true, eyes: 0x2f9e5b, jeans: true, azul: true };
// Gas: camiseta verde militar y vaqueros (los capítulos con camisa de otro color la cambian)
export const MARC_LOOK: PersonLook = { skin: 0xe8b894, shirt: 0x5b6b3a, pants: 0x3f5f8a, hair: 0x84593a, hairStyle: 'short', male: true, curls: true, stache: true, gas: true };

/** Modelos de VRoid de Azul por capítulo (de momento, solo el del jaleo de Ferreries, con el mono negro). */
export const AZUL_VRM = { ferreries: azulFerreriesVrm };
// Gas sigue con su modelo de MakeHuman hasta que su VRM esté terminado (bigote, perilla, rizos, la del Barça).

/** Todos los VRM que se cargan al empezar, con la altura a la que se escalan (en metros). */
export const VRM_FILES: [url: string, height: number][] = [[AZUL_VRM.ferreries, 1.66]];
