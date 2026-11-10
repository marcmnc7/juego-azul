import * as THREE from 'three';

// Tipo de superficie de cada pieza del decorado (encalado, teja árabe, marès, piedra seca, asfalto, madera,
// losas, adoquín, arena…). Merger lo guarda por vértice según el color (surfaceFor) y el estilo cómic pone
// encima el dibujo de tebeo de esa superficie (ver comicSurfaces.ts).

export enum Surf {
  None = 0,
  Plaster = 1,
  Roof = 2,
  Mares = 3,
  Stone = 4,
  Asphalt = 5,
  Wood = 6,
  Foliage = 7,
  Grass = 8,
  Louvre = 9,
  Paving = 10,
  Terracotta = 11,
  Sand = 12,
  Cobble = 13,
  DryStone = 14,
  Bark = 15,
  /** Sin foto: su brillo. Hierro, acero, barandillas. */
  Metal = 16,
  /** Cristal de ventana. */
  Glass = 17,
  /** Lo que brilla por sí solo (ventanas encendidas, faroles): de noche, sin sombra. */
  Glow = 18,
  /** Roca natural: acantilados, calas, rocas del mar (no sillares). */
  Rock = 19,
}

// ---------- Qué superficie corresponde a cada color ----------

const explicit = new Map<number, Surf>();
/** Fija la superficie de un color concreto (gana a la heurística). */
export function setSurface(color: number, s: Surf) {
  explicit.set(color, s);
}
// Colores con nombre en el decorado
setSurface(0x2f7a4a, Surf.Louvre); // persianas verdes menorquinas
setSurface(0x2f6b46, Surf.Louvre);
setSurface(0xb8623e, Surf.Roof);
setSurface(0xb5603b, Surf.Roof);
setSurface(0x3a3a40, Surf.Asphalt);
setSurface(0x4a4a50, Surf.Asphalt);
setSurface(0xd8cfbd, Surf.Paving);
setSurface(0xbdb4a4, Surf.Paving);
setSurface(0xd8d2c4, Surf.Paving);
setSurface(0xd9c7a6, Surf.Terracotta);
setSurface(0x5a4a38, Surf.Bark);
setSurface(0x6b5a40, Surf.Bark);
setSurface(0x6b4a2e, Surf.Wood);
setSurface(0x8a6a44, Surf.Wood);
setSurface(0x7a5a3a, Surf.Wood);
setSurface(0x8f877a, Surf.DryStone); // pared seca
setSurface(0x6f6a62, Surf.Stone); // pizarra del Cap de Creus
setSurface(0x7d766b, Surf.Stone);
// Casa de Azul y Camí de sa Farola (fotos de Street View)
setSurface(0xd2245a, Surf.Foliage); // buganvilla
setSurface(0xe33a6e, Surf.Foliage);
setSurface(0xd9cfbd, Surf.Paving);
setSurface(0xb5b0a6, Surf.Asphalt); // calle de hormigón
setSurface(0xbfae92, Surf.DryStone);
setSurface(0x8a7a66, Surf.Wood); // cancela de acebuche
setSurface(0x7a6a56, Surf.Wood);
setSurface(0x24603a, Surf.Louvre);
setSurface(0x2c6a48, Surf.None); // lona del toldo
setSurface(0xc9b48a, Surf.Sand); // arcén de tierra
setSurface(0xa9a39a, Surf.Cobble); // adoquín de la placita del faro
setSurface(0xc4977e, Surf.Terracotta); // hormigón impreso
setSurface(0xeeebe4, Surf.Roof); // teja pintada de blanco
// Jardines y campo de alrededor
setSurface(0x3f7a3a, Surf.Grass);
setSurface(0x4a7a40, Surf.Grass);
setSurface(0x5f6f3c, Surf.Grass);
setSurface(0x4c5e34, Surf.Grass);
setSurface(0x56683a, Surf.Grass);
setSurface(0xf4efe2, Surf.Plaster);
// Cristal de las ventanas
for (const c of [0x30384a, 0x2a3138, 0x2c3a46, 0x24303c, 0x3a4250, 0x1b2430, 0x2b3a48, 0x9fd3e8, 0x7a8fa6, 0x9fc4e0, 0x9fb8c8, 0x14181f, 0x1b2440]) setSurface(c, Surf.Glass);
// Hierro y acero: farolas, barandillas, verjas, postes, encimeras
for (const c of [0xc8ccd0, 0x9a9ea2, 0x2b2f36, 0x1e1e22, 0x1e1e1e, 0x8a93a6, 0xd0d6dc, 0x8f98a4, 0x8d9096, 0xb4b7bc, 0x9aa3ad, 0x333338, 0x777777, 0x888888, 0x9a9a9a, 0xbdbdbd, 0x22262c, 0x2c5a40, 0x4a525c, 0xb8bcc4, 0xa8a8b0, 0xbbbbbb, 0x7c7f86, 0x111111, 0x1a1a1a]) setSurface(c, Surf.Metal);
// Flores de buganvilla y adelfa: también hojas, para que no sean bolas
for (const c of [0xc72a5c, 0xdb4a78, 0xe0457b, 0xc2307a, 0xe0245e, 0xff5a7a, 0xd6338a]) setSurface(c, Surf.Foliage);
// La roca de Es Castellar y los armarios pintados de la cocina
setSurface(0xc9a36b, Surf.Stone);
setSurface(0x5f8f6a, Surf.Wood);
setSurface(0x6a5444, Surf.Wood); // el fondo del bar de la terraza
setSurface(0x5e4a38, Surf.Sand); // tierra del camping
setSurface(0x6f7a48, Surf.Grass); // los solares detrás de la calle de Azul
setSurface(0x8a7a68, Surf.Sand); // su claro de grava
// Troncos
for (const c of [0x6b4a32, 0x6b4a30, 0x5a3e28, 0x6b5a46, 0x7a6448, 0x3f3026, 0x5a4634, 0x4a3426]) setSurface(c, Surf.Bark);
// Lo que brilla por sí solo (ventanas encendidas, faroles) va liso
for (const c of [0xffd9a0, 0xffc680, 0xfff3b0, 0xffd890, 0xfff6d8, 0xfff4b0, 0xf4e6c0, 0xff9a3a]) setSurface(c, Surf.Glow);
// Azulejo de las paredes de la piscina (cap. 2)
setSurface(0x3584c8, Surf.Terracotta);

const hsl = { h: 0, s: 0, l: 0 };
const tmp = new THREE.Color();
const cache = new Map<number, Surf>();

/** Superficie por defecto de un color: blanco → encalado, teja, marès, asfalto, madera, verdes… */
export function surfaceFor(color: number): Surf {
  const e = explicit.get(color);
  if (e !== undefined) return e;
  const c = cache.get(color);
  if (c !== undefined) return c;
  tmp.set(color).getHSL(hsl, THREE.SRGBColorSpace);
  const h = hsl.h * 360, s = hsl.s, l = hsl.l;
  let r = Surf.None;
  if (l > 0.74 && s < 0.55) r = Surf.Plaster;
  else if (h >= 8 && h <= 26 && s > 0.4 && l > 0.3 && l < 0.55) r = Surf.Roof;
  else if (h >= 28 && h <= 46 && s > 0.25 && s < 0.65 && l > 0.45 && l < 0.72) r = Surf.Mares;
  else if (h >= 20 && h <= 45 && s < 0.3 && l > 0.3 && l < 0.62) r = Surf.Stone;
  else if (l < 0.3 && s < 0.12 && l > 0.12) r = Surf.Asphalt;
  else if (h >= 18 && h <= 40 && s > 0.25 && l > 0.17 && l < 0.42) r = Surf.Wood;
  else if (h >= 70 && h <= 160 && s > 0.15 && l > 0.12 && l < 0.55) r = Surf.Foliage;
  // Grises medios: hormigón, bordillos, piedra de banco (antes quedaban lisos)
  else if (s < 0.1 && l >= 0.42 && l <= 0.72) r = Surf.Paving;
  else if (h >= 40 && h <= 70 && s > 0.2 && s < 0.6 && l > 0.3 && l < 0.6) r = Surf.Grass;
  // Lo que quedaba liso: piedra y hormigón en gris azulado, hierro casi negro y paredes de color
  else if (s < 0.28 && l >= 0.25 && l <= 0.72) r = Surf.Stone;
  else if (l < 0.14 && s < 0.3) r = Surf.Metal;
  else if (h >= 18 && h <= 62 && l > 0.5 && s < 0.95) r = Surf.Plaster;
  cache.set(color, r);
  return r;
}
