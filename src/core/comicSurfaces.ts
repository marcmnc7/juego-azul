import * as THREE from 'three';
import { comicSurfaceCanvas } from './comicTiles';
import { Surf } from './surfaces';

// Superficies dibujadas del decorado de tebeo. Lo que se construye con Merger o toon() no tiene UV, así que el
// dibujo de cada tipo de superficie (encalado, teja, sillares, asfalto, hierba, adoquín…) se proyecta desde los
// tres ejes del mundo (triplanar) y se multiplica por el color de la pieza, normalizado a su color medio: el
// dibujo pone las piezas, las juntas y la tinta; el color lo sigue eligiendo quien construye.

const LAYERS = 16;
const SIZE = 512;

/** Dibujo de cada Surf (índice), metros que ocupa una repetición y cuánto se nota. Misma escala que el cap. 1. */
const SPEC: Array<[kind: string | null, meters: number, strength: number]> = [];
SPEC[Surf.None] = [null, 1, 0];
SPEC[Surf.Plaster] = ['wash', 3, 0.7];
SPEC[Surf.Roof] = ['roof', 2, 0.9];
SPEC[Surf.Mares] = ['mares', 1.5, 0.9];
SPEC[Surf.Stone] = ['stone', 2.4, 0.9];
SPEC[Surf.Asphalt] = ['asphalt', 4, 0.8];
SPEC[Surf.Wood] = ['wood', 1, 0.85];
// (las copas de los árboles, lisas, como en el cap. 1)
SPEC[Surf.Foliage] = [null, 1, 0];
SPEC[Surf.Grass] = ['grass', 2.5, 0.85];
SPEC[Surf.Louvre] = ['louvre', 0.9, 0.85];
SPEC[Surf.Paving] = ['slabs', 3.2, 0.85];
SPEC[Surf.Terracotta] = ['terracotta', 2.4, 0.85];
SPEC[Surf.Sand] = ['sand', 3, 0.7];
// (adoquín grande, como lo dibujaría un dibujante: a 1,6 m la explanada del Born parecía una foto de ladrillitos)
SPEC[Surf.Cobble] = ['cobble', 2.6, 0.9];
SPEC[Surf.DryStone] = ['drystone', 2.6, 0.95];
SPEC[Surf.Bark] = ['bark', 1.2, 0.8];

let tex: THREE.DataArrayTexture | null = null;
const scale = new Array<number>(LAYERS).fill(1);
const strength = new Array<number>(LAYERS).fill(0);
const means = Array.from({ length: LAYERS }, () => new THREE.Vector3(1, 1, 1));

const toLin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** La textura por capas (se dibuja una vez, al primer uso: unos 16 MB de vídeo). */
function surfaceArray() {
  if (tex) return tex;
  const data = new Uint8Array(SIZE * SIZE * 4 * LAYERS).fill(255);
  for (let l = 0; l < LAYERS; l++) {
    const spec = SPEC[l];
    scale[l] = 1 / (spec?.[1] ?? 1);
    const cv = spec?.[0] ? comicSurfaceCanvas(spec[0]) : null;
    if (!cv) continue;
    strength[l] = spec[2];
    const px = cv.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, SIZE, SIZE).data;
    const off = l * SIZE * SIZE * 4;
    let r = 0, g = 0, b = 0;
    // (fila a fila al revés: en la GPU la v crece hacia arriba, y así la luz de cada pieza queda arriba)
    for (let y = 0; y < SIZE; y++) {
      const src = px.subarray(y * SIZE * 4, (y + 1) * SIZE * 4);
      data.set(src, off + (SIZE - 1 - y) * SIZE * 4);
      for (let i = 0; i < src.length; i += 4) {
        r += toLin(src[i]);
        g += toLin(src[i + 1]);
        b += toLin(src[i + 2]);
      }
    }
    const n = SIZE * SIZE;
    means[l].set(Math.max(0.02, r / n), Math.max(0.02, g / n), Math.max(0.02, b / n));
  }
  tex = new THREE.DataArrayTexture(data, SIZE, SIZE, LAYERS);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** De noche, lo que brilla por sí solo (Surf.Glow: ventanas encendidas, faroles) se pinta sin sombra. */
export const glowOn = { value: 0 };

/**
 * Añade al sombreador de un material de tebeo (MeshToon) el dibujo triplanar de su superficie: la del atributo
 * `surf` de cada vértice (Merger) o la de `userData.surf` del material (toon({ surf })).
 */
export function surfaceShader(sh: THREE.WebGLProgramParametersWithUniforms, surf: number) {
  sh.uniforms.csTex = { value: surfaceArray() };
  sh.uniforms.csScale = { value: scale };
  sh.uniforms.csStrength = { value: strength };
  sh.uniforms.csMean = { value: means };
  sh.uniforms.uSurf = { value: surf };
  sh.uniforms.uGlowOn = glowOn;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying highp vec3 vCsPos;\nvarying vec3 vCsN;\nattribute float surf;\nvarying float vSurf;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vCsPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vCsN = mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal;
      #else
        vCsPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vCsN = mat3(modelMatrix) * objectNormal;
      #endif
      vSurf = surf;`,
    );
  sh.fragmentShader = sh.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      varying highp vec3 vCsPos;
      varying vec3 vCsN;
      varying float vSurf;
      uniform highp sampler2DArray csTex;
      uniform float csScale[${LAYERS}];
      uniform float csStrength[${LAYERS}];
      uniform vec3 csMean[${LAYERS}];
      uniform float uSurf;
      uniform float uGlowOn;`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      int csF = int(max(vSurf, uSurf) + 0.5);
      int csI = csF < ${LAYERS} ? csF : 0;
      if (csStrength[csI] > 0.0) {
        // (en una arista muy viva la normal interpolada casi se anula)
        float csL = length(vCsN);
        vec3 csU = csL > 1e-3 ? vCsN / csL : vec3(0.0, 1.0, 0.0);
        // proyección casi de una sola cara: en un tebeo la junta no se ve doble
        vec3 csW = pow(abs(csU), vec3(8.0));
        csW /= (csW.x + csW.y + csW.z + 1e-4);
        vec3 csP = vCsPos * csScale[csI];
        float csLay = float(csI);
        vec3 csT = vec3(0.0);
        if (csW.x > 0.01) csT += texture(csTex, vec3(csP.zy * vec2(sign(csU.x), 1.0), csLay)).rgb * csW.x;
        if (csW.y > 0.01) csT += texture(csTex, vec3(csP.xz, csLay)).rgb * csW.y;
        if (csW.z > 0.01) csT += texture(csTex, vec3(csP.xy * vec2(-sign(csU.z), 1.0), csLay)).rgb * csW.z;
        diffuseColor.rgb *= mix(vec3(1.0), csT / csMean[csI], csStrength[csI]);
      }`,
    )
    .replace(
      '#include <opaque_fragment>',
      `if (csF == ${Surf.Glow} && uGlowOn > 0.5) outgoingLight = diffuseColor.rgb;
      #include <opaque_fragment>`,
    );
}
