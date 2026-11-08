import type { PersonLook } from '../entities/models';

// Aspecto de los protagonistas. Azul: rubia, ojos verdes y, cómo no, de azul.
// Sacado de las fotos: ella, rubia tirando a miel y ojos verdes; él, pelo castaño
// oscuro rizado con volumen arriba, bigote fino y perilla.
// Ropa: top corto blanco de punto y vaqueros, a juego con la camiseta y los vaqueros de Gas
export const MARGAUX_LOOK: PersonLook = { skin: 0xf4d0b0, shirt: 0xf2eee6, pants: 0x4a6f9c, hair: 0xcfa767, hairStyle: 'straight', skirt: true, eyes: 0x2f9e5b, jeans: true, azul: true };
// Gas: camiseta verde militar y vaqueros (los capítulos con camisa de otro color la cambian)
export const MARC_LOOK: PersonLook = { skin: 0xe8b894, shirt: 0x5b6b3a, pants: 0x3f5f8a, hair: 0x84593a, hairStyle: 'short', male: true, curls: true, stache: true, gas: true };
