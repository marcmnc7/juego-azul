import * as THREE from 'three';

// Estilo pintado (tipo Alba, A Short Hike o Ghibli): la luz cae en franjas suaves en vez de en
// degradado, las sombras son de color (azul violeta, luminosas) y no negras, las superficies llevan
// pinceladas y manchas en vez de fotos, y los personajes tienen un perfil de luz que los separa del
// fondo. Se aplica a todos los materiales de una escena de una vez (paintScene) y se enciende y apaga
// con un uniforme compartido, sin recompilar: así cada capítulo puede ir pintado o no.

export const paintStyle = {
  /** 0 = como antes, 1 = pintado. */
  value: 0,
};

/** Paleta de la luz pintada. La cambia cada capítulo (mañana de fiesta, noche, atardecer…). */
export const paintPalette = {
  /** Tinte de las sombras: lo que no da el sol se vuelve de este color. */
  shadow: new THREE.Color(0x7f86d8),
  /** Tinte de lo iluminado por el sol. */
  light: new THREE.Color(0xfff0d6),
  /** Perfil de luz de los personajes. */
  rim: new THREE.Color(0xfff2c8),
};

const U = {
  uPaint: paintStyle,
  uPaintShadow: { value: paintPalette.shadow },
  uPaintLight: { value: paintPalette.light },
  uPaintRim: { value: paintPalette.rim },
};

const DECL = /* glsl */ `
uniform float uPaint;
uniform vec3 uPaintShadow;
uniform vec3 uPaintLight;
uniform vec3 uPaintRim;
varying highp vec3 vPaintPos;
float pHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float pNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(pHash(i), pHash(i + vec3(1,0,0)), f.x), mix(pHash(i + vec3(0,1,0)), pHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(pHash(i + vec3(0,0,1)), pHash(i + vec3(1,0,1)), f.x), mix(pHash(i + vec3(0,1,1)), pHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

// Luz directa en franjas: el paso de luz a sombra es una banda estrecha y suave (como un pintor que
// separa luz y sombra con dos tonos), con un poco del degradado real para que no quede plano
const DIRECT_FROM = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
const DIRECT_TO = /* glsl */ `float dotNLraw = dot( geometryNormal, directLight.direction );
	float dotNL = mix( saturate( dotNLraw ), smoothstep( -0.02, 0.22, dotNLraw ) * 0.82 + saturate( dotNLraw ) * 0.18, uPaint * 0.45 );`;

function patch(sh: THREE.WebGLProgramParametersWithUniforms, rim: boolean, blur: number) {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying highp vec3 vPaintPos;')
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 paintP = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        paintP = instanceMatrix * paintP;
      #endif
      vPaintPos = ( modelMatrix * paintP ).xyz;`,
    );
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\n' + DECL)
    .replace(
      '#include <lights_physical_pars_fragment>',
      THREE.ShaderChunk.lights_physical_pars_fragment
        .replace(DIRECT_FROM, DIRECT_TO)
        // El brillo, con la luz real: la franja suavizada es solo para el color. Si no, donde la luz roza
        // la superficie el brillo se dispara y salen líneas blancas en las rocas
        .replace('reflectedLight.directSpecular += irradiance *', 'reflectedLight.directSpecular += saturate( dotNLraw ) * directLight.color *'),
    )
    // Las fotos de las texturas se leen más borrosas: queda la mancha de color, no el detalle fotográfico
    .replace('texture2D( map, vMapUv )', blur > 0 ? `texture2D( map, vMapUv, uPaint * ${blur.toFixed(2)} )` : 'texture2D( map, vMapUv )')
    // Y el relieve fotográfico casi desaparece
    .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * ( 1.0 - uPaint * 0.15 );')
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      if ( uPaint > 0.0 ) {
        // Pinceladas: manchas grandes que cambian un poco el tono y trazos alargados según la cara
        #ifdef FLAT_SHADED
          vec3 pvn = normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) );
        #else
          vec3 pvn = normalize( vNormal );
        #endif
        vec3 pwn = abs( inverseTransformDirection( pvn, viewMatrix ) );
        vec3 pq = vPaintPos * 2.4;
        float strokes = pwn.y > 0.6 ? pNoise( vec3( pq.x * 0.55, pq.z * 3.2, 1.7 ) ) : pNoise( vec3( ( pq.x + pq.z ) * 3.2, pq.y * 0.55, 4.1 ) );
        float blot = pNoise( vPaintPos * 0.32 ) * 0.7 + pNoise( vPaintPos * 1.1 ) * 0.3;
        vec3 painted = diffuseColor.rgb * ( 1.0 + ( strokes - 0.5 ) * 0.05 + ( blot - 0.5 ) * 0.12 );
        // Las manchas también giran un pelín el color (más cálido o más frío), como la pintura de verdad
        painted *= mix( vec3( 0.96, 0.99, 1.05 ), vec3( 1.05, 1.0, 0.93 ), blot );
        diffuseColor.rgb = mix( diffuseColor.rgb, painted, uPaint );
      }`,
    )
    .replace(
      '#include <roughnessmap_fragment>',
      // Pintado = gouache mate: casi sin brillos, salvo lo que de verdad brilla (agua, cristal, metal)
      `#include <roughnessmap_fragment>
      roughnessFactor = mix( roughnessFactor, roughnessFactor < 0.3 ? roughnessFactor : max( roughnessFactor, 0.72 ), uPaint );`,
    )
    .replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      if ( uPaint > 0.0 ) {
        // Sombras de color y luminosas: lo que no da el sol toma el tinte de la paleta y no se apaga
        vec3 shade = reflectedLight.indirectDiffuse * uPaintShadow * 1.3 + material.diffuseColor * uPaintShadow * 0.1;
        // Como un pintor: la sombra es más saturada, no más gris (la piel en sombra se vuelve cálida)
        float shadeL = dot( shade, vec3( 0.299, 0.587, 0.114 ) );
        shade = max( vec3( 0.0 ), mix( vec3( shadeL ), shade, 1.3 ) );
        reflectedLight.indirectDiffuse = mix( reflectedLight.indirectDiffuse, shade, uPaint );
        reflectedLight.directDiffuse *= mix( vec3( 1.0 ), uPaintLight, uPaint );
        // (donde la luz roza y la vista también, el brillo se dispara: eran las líneas blancas en las rocas)
        reflectedLight.directSpecular = min( reflectedLight.directSpecular * ( 1.0 - uPaint * 0.12 ), vec3( 0.85 ) );
        reflectedLight.indirectSpecular *= 1.0 - uPaint * 0.15;
        ${
          rim
            ? `// Perfil de luz: separa al personaje del fondo, como en las películas de animación
        float rimK = 1.0 - saturate( dot( geometryNormal, geometryViewDir ) );
        rimK = smoothstep( 0.55, 0.95, rimK );
        totalEmissiveRadiance += uPaintRim * rimK * 0.22 * uPaint * ( 0.35 + 0.65 * saturate( geometryNormal.y * 0.5 + 0.6 ) );`
            : ''
        }
      }`,
    );
}

/**
 * Prepara todos los materiales de la escena para el estilo pintado (una sola vez por material). Los
 * personajes (mallas con esqueleto) llevan además perfil de luz; las fotos de las fachadas se leen
 * borrosas. Mientras paintStyle.value sea 0, todo se ve exactamente como antes.
 */
export function paintScene(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const rim = (mesh as THREE.SkinnedMesh).isSkinnedMesh || !!mesh.userData.person;
    for (const mat of mats) paintMaterial(mat as THREE.MeshStandardMaterial, rim);
  });
}

function paintMaterial(m: THREE.MeshStandardMaterial, rim: boolean) {
  if (!m || !m.isMeshStandardMaterial) return;
  const key = rim ? 'r' : 'p';
  if (m.userData.painted === key || m.userData.painted === 'r') return;
  m.userData.painted = key;
  // Solo se desenfocan las texturas fotográficas grandes (fachadas, suelo, tejas), no carteles ni caras
  const img = m.map?.image as { width?: number } | undefined;
  const photo = !rim && !!m.map && !(m.map as THREE.CanvasTexture).isCanvasTexture && (img?.width ?? 0) >= 512;
  const blur = photo ? 0.5 : 0;
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey;
  // La clave por defecto es el código de onBeforeCompile: hay que guardar la del parche anterior
  // (grano, piel de los brazos…) o materiales distintos acabarían compartiendo programa
  const base = prevKey === THREE.Material.prototype.customProgramCacheKey ? prev.toString() : null;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    patch(sh, rim, blur);
  };
  m.customProgramCacheKey = () => (base ?? prevKey.call(m)) + '|paint' + key + blur;
  m.needsUpdate = true;
}
