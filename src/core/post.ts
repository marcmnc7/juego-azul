import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  Effect,
  EffectAttribute,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

// Postproceso de cine: oclusión ambiental (las esquinas, los pies de las paredes y los personajes
// "se apoyan" en el suelo), profundidad de campo en los diálogos, bloom suave, tono AgX y un
// etalonaje distinto en cada capítulo (mañana cálida en Ferreries, noche azul en la piscinita…).

/** Etalonaje de un capítulo. Valores pensados alrededor de 1 (neutro). */
export interface Grade {
  exposure: number;
  saturation: number;
  contrast: number;
  /** Tinte de las sombras y de las luces (split toning). */
  shadows: number;
  highlights: number;
  /** Cuánto pesa el tinte (0-1). */
  tint: number;
  bloom: number;
  vignette: number;
  /** Estilo pintado: filtro de óleo (0-1), tinta en las siluetas (0-1), grano de papel y negros levantados. */
  paint?: number;
  ink?: number;
  paper?: number;
  lift?: number;
}

const DAY: Grade = { exposure: 1.0, saturation: 1.12, contrast: 1.06, shadows: 0x2a5d7a, highlights: 0xffd9a0, tint: 0.16, bloom: 0.2, vignette: 0.3 };
const NIGHT: Grade = { exposure: 1.08, saturation: 1.05, contrast: 1.08, shadows: 0x1a2a6a, highlights: 0xffc890, tint: 0.24, bloom: 1.05, vignette: 0.42 };

/** Un etalonaje por capítulo (mismo orden que el mapa). */
export const GRADES: Record<number, Grade> = {
  1: { ...DAY, exposure: 1.02, highlights: 0xffd08a, tint: 0.2 }, // Ferreries, mediodía de fiesta
  2: NIGHT, // La piscinita
  3: { ...DAY, saturation: 1.08, shadows: 0x35607a, highlights: 0xffe2b8 }, // Carretera al norte
  4: { ...NIGHT, saturation: 1.18, shadows: 0x2a1060, highlights: 0xff9ad0, bloom: 1.35 }, // Fito: neones y láseres
  5: { ...DAY, saturation: 1.16, highlights: 0xffc27a, tint: 0.22 }, // Costa Brava al atardecer
  6: { ...DAY, highlights: 0xffd49a }, // Sant Joan
  7: { ...NIGHT, shadows: 0x1c2f60, highlights: 0xffb070 }, // Cena a escondidas
  8: { ...DAY, saturation: 1.1, contrast: 1.1, highlights: 0xffa860, tint: 0.24, bloom: 0.8 }, // Eclipse
  9: { ...DAY, exposure: 1.03, highlights: 0xffc8a8, tint: 0.22 }, // Un año después
};
export const NEUTRAL: Grade = { ...DAY, tint: 0.1 };

// Exposición antes del tono (en HDR) y etalonaje después (en LDR), más un destello para los aciertos
class ExposureEffect extends Effect {
  constructor() {
    super('Exposure', `uniform float exposure;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = vec4(inputColor.rgb * exposure, inputColor.a); }`, {
      uniforms: new Map([['exposure', new THREE.Uniform(1)]]),
    });
  }
}

/**
 * Estilo pintado en pantalla: un filtro de óleo (Kuwahara generalizado) que convierte el detalle fino
 * en manchas planas sin perder los bordes, más fuerte en el fondo que en los personajes cercanos, y
 * un contorno de tinta cálida en las siluetas (donde la profundidad salta).
 */
class PaintEffect extends Effect {
  constructor() {
    super(
      'Paint',
      `uniform float strength, ink, spread;
      vec3 squash(vec3 c) { return c / (1.0 + c); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
        float dist = -getViewZ(depth);
        // Cerca (personajes) no se toca para que se lean las caras; el fondo lejano queda pintado
        float k = strength * smoothstep(9.0, 34.0, dist);
        vec3 col = inputColor.rgb;
        if (k > 0.01) {
          vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
          vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
          vec2 st = texelSize * spread;
          for (int j = -3; j <= 3; j++) {
            for (int i = -3; i <= 3; i++) {
              vec3 c = squash(texture2D(inputBuffer, uv + vec2(float(i), float(j)) * st).rgb);
              vec3 c2 = c * c;
              if (i <= 0 && j <= 0) { m0 += c; s0 += c2; }
              if (i >= 0 && j <= 0) { m1 += c; s1 += c2; }
              if (i <= 0 && j >= 0) { m2 += c; s2 += c2; }
              if (i >= 0 && j >= 0) { m3 += c; s3 += c2; }
            }
          }
          m0 /= 16.0; m1 /= 16.0; m2 /= 16.0; m3 /= 16.0;
          vec3 v0 = abs(s0 / 16.0 - m0 * m0), v1 = abs(s1 / 16.0 - m1 * m1), v2 = abs(s2 / 16.0 - m2 * m2), v3 = abs(s3 / 16.0 - m3 * m3);
          vec4 sv = vec4(v0.r + v0.g + v0.b, v1.r + v1.g + v1.b, v2.r + v2.g + v2.b, v3.r + v3.g + v3.b) + 1e-4;
          float best = min(min(sv.x, sv.y), min(sv.z, sv.w));
          // Pesos suaves (no solo el mejor cuadrante): queda pintado, no a bloques
          vec4 w = best / sv; w *= w; w *= w;
          vec3 painted = (m0 * w.x + m1 * w.y + m2 * w.z + m3 * w.w) / (w.x + w.y + w.z + w.w);
          painted = painted / max(vec3(1e-3), 1.0 - painted);
          col = mix(col, painted, k);
        }
        // Tinta: donde lo de alrededor está mucho más lejos, este píxel es el borde de algo
        if (ink > 0.0 && dist < 80.0) {
          vec2 t = texelSize * max(1.0, spread * 0.75);
          float dl = -getViewZ(readDepth(uv - vec2(t.x, 0.0)));
          float dr = -getViewZ(readDepth(uv + vec2(t.x, 0.0)));
          float dd = -getViewZ(readDepth(uv - vec2(0.0, t.y)));
          float du = -getViewZ(readDepth(uv + vec2(0.0, t.y)));
          float e = (max(max(dl, dr), max(dd, du)) - dist) / dist;
          float line = smoothstep(0.035, 0.14, e) * (1.0 - smoothstep(35.0, 80.0, dist));
          col = mix(col, col * vec3(0.2, 0.13, 0.16), line * ink * 0.85);
        }
        outputColor = vec4(col, inputColor.a);
      }`,
      {
        attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
        uniforms: new Map([
          ['strength', new THREE.Uniform(0)],
          ['ink', new THREE.Uniform(0)],
          ['spread', new THREE.Uniform(1)],
        ]),
      },
    );
  }
}

class GradeEffect extends Effect {
  constructor() {
    super(
      'Grade',
      `uniform float saturation, contrast, tint, vignette, flash, letterbox, aspect, paper, lift;
      uniform vec3 shadowCol, lightCol, flashCol;
      float paperHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, saturation);
        c = (c - 0.5) * contrast + 0.5;
        // Sombras frías y luces cálidas (como el cine), sin tocar los medios
        vec3 tone = mix(shadowCol, lightCol, smoothstep(0.05, 0.85, l));
        c = mix(c, c * tone * 2.0, tint * (1.0 - abs(l - 0.5)));
        // Estilo pintado: los negros se levantan hacia el color de las sombras (nada queda negro del todo)
        c = c * (1.0 - lift) + shadowCol * 2.0 * lift;
        // Y grano de papel: un poco de textura de lámina, fija en la pantalla
        if (paper > 0.0) {
          vec2 px = uv * resolution;
          float g = paperHash(floor(px)) * 0.6 + paperHash(floor(px * 0.25) + 7.0) * 0.4;
          c *= 1.0 + (g - 0.5) * paper;
        }
        vec2 d = (uv - 0.5) * vec2(aspect, 1.0);
        c *= 1.0 - vignette * smoothstep(0.35, 1.05, length(d) * 1.25);
        c = mix(c, flashCol, flash);
        // Bandas negras de película (diálogos y escenas)
        float bar = letterbox * 0.12;
        c *= step(bar, uv.y) * step(uv.y, 1.0 - bar);
        outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
      }`,
      {
        uniforms: new Map<string, THREE.Uniform>([
          ['saturation', new THREE.Uniform(1)],
          ['contrast', new THREE.Uniform(1)],
          ['tint', new THREE.Uniform(0)],
          ['vignette', new THREE.Uniform(0.3)],
          ['paper', new THREE.Uniform(0)],
          ['lift', new THREE.Uniform(0)],
          ['flash', new THREE.Uniform(0)],
          ['letterbox', new THREE.Uniform(0)],
          ['aspect', new THREE.Uniform(1)],
          ['shadowCol', new THREE.Uniform(new THREE.Color(0.5, 0.5, 0.5))],
          ['lightCol', new THREE.Uniform(new THREE.Color(0.5, 0.5, 0.5))],
          ['flashCol', new THREE.Uniform(new THREE.Color(1, 1, 1))],
        ]),
      },
    );
  }
}

const half = (hex: number, out: THREE.Color) => out.setHex(hex).convertSRGBToLinear().multiplyScalar(0.5).addScalar(0.25);

export class Post {
  readonly composer: EffectComposer;
  private render: RenderPass;
  private ao: N8AOPostPass;
  private dof: DepthOfFieldEffect;
  private dofPass: EffectPass;
  private bloom: BloomEffect;
  private tone: ToneMappingEffect;
  private exposure = new ExposureEffect();
  private grade = new GradeEffect();
  private ca: ChromaticAberrationEffect;
  private paintFx = new PaintEffect();
  private paintPass: EffectPass;
  private target: Grade = NEUTRAL;
  private cur: Grade = { ...NEUTRAL };
  /** 0-1: profundidad de campo y bandas de cine (lo sube el bucle principal en los diálogos). */
  cinematic = 0;
  /** 0-1: cuánto se desenfoca el fondo (solo cuando hay alguien hablando en escena). */
  dofAmount = 0;
  /** Punto de enfoque en el mundo para la profundidad de campo. */
  readonly focus = new THREE.Vector3();
  private flash = 0;
  private flashCol = new THREE.Color();
  private aberr = 0;

  constructor(private renderer: THREE.WebGLRenderer, private camera: THREE.PerspectiveCamera, mobile: boolean) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    this.render = new RenderPass(new THREE.Scene(), camera);
    // Con 1×1 la media resolución salía de 0 píxeles y WebGL avisaba de texturas vacías al arrancar
    this.ao = new N8AOPostPass(new THREE.Scene(), camera, Math.max(2, window.innerWidth), Math.max(2, window.innerHeight));
    // A media resolución (con reescalado que respeta los bordes): casi igual de bonita y mucho más barata
    this.ao.setQualityMode(mobile ? 'Performance' : 'Medium');
    Object.assign(this.ao.configuration, { halfRes: true, aoRadius: 2.0, distanceFalloff: 1.0, intensity: 3.2, gammaCorrection: false });
    this.dof = new DepthOfFieldEffect(camera, { focusDistance: 0, focalLength: 0.05, bokehScale: 0, resolutionScale: 0.5 });
    this.dofPass = new EffectPass(camera, this.dof);
    this.dofPass.enabled = false;
    this.bloom = new BloomEffect({ mipmapBlur: true, intensity: 0.5, luminanceThreshold: 0.92, luminanceSmoothing: 0.2, radius: 0.7 });
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    this.ca = new ChromaticAberrationEffect({ offset: new THREE.Vector2(), radialModulation: true, modulationOffset: 0.2 });
    this.ca.blendMode.blendFunction = BlendFunction.NORMAL;
    this.composer.addPass(this.render);
    this.composer.addPass(this.ao);
    this.composer.addPass(this.dofPass);
    this.paintPass = new EffectPass(camera, this.paintFx);
    this.paintPass.enabled = false;
    this.composer.addPass(this.paintPass);
    this.composer.addPass(new EffectPass(camera, this.bloom, this.exposure, this.tone, this.grade, this.ca));
    this.composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: mobile ? SMAAPreset.MEDIUM : SMAAPreset.HIGH })));
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h, false);
    this.grade.uniforms.get('aspect')!.value = w / h;
    // Las pinceladas del filtro miden lo mismo en cualquier pantalla (más píxeles = muestras más separadas)
    this.paintFx.uniforms.get('spread')!.value = Math.max(1.3, (h * this.renderer.getPixelRatio()) / 440);
  }

  setGrade(g: Grade, instant = false) {
    this.target = g;
    if (instant) Object.assign(this.cur, { paint: 0, ink: 0, paper: 0, lift: 0 }, g);
  }

  /** Destello de pantalla (aciertos, fotos, sorpresas). */
  flashScreen(color: number, amount: number) {
    this.flashCol.setHex(color);
    this.flash = Math.max(this.flash, amount);
  }

  /** Aberración cromática momentánea (golpes, impactos, turbo). */
  kick(amount: number) {
    this.aberr = Math.max(this.aberr, amount);
  }

  /** Oclusión ambiental: se puede apagar si el móvil no llega. */
  set aoEnabled(on: boolean) {
    this.ao.enabled = on;
  }
  get aoEnabled() {
    return this.ao.enabled;
  }

  draw(scene: THREE.Scene, dt: number) {
    const r = this.renderer;
    // El tono lo decide cada capítulo en el renderer (AgX en HD, ACES en el resto)
    this.tone.mode = r.toneMapping === THREE.ACESFilmicToneMapping ? ToneMappingMode.ACES_FILMIC : ToneMappingMode.AGX;
    const k = Math.min(1, dt * 1.5);
    const c = this.cur, t = this.target;
    for (const key of ['exposure', 'saturation', 'contrast', 'tint', 'bloom', 'vignette'] as const) c[key] += (t[key] - c[key]) * k;
    for (const key of ['paint', 'ink', 'paper', 'lift'] as const) c[key] = (c[key] ?? 0) + ((t[key] ?? 0) - (c[key] ?? 0)) * k;
    c.shadows = t.shadows;
    c.highlights = t.highlights;
    const u = this.grade.uniforms;
    this.exposure.uniforms.get('exposure')!.value = c.exposure * r.toneMappingExposure;
    u.get('saturation')!.value = c.saturation;
    u.get('contrast')!.value = c.contrast;
    u.get('tint')!.value = c.tint;
    // Suave: más fuerte oscurecía la franja de arriba, donde van el objetivo y el botón de pausa
    u.get('vignette')!.value = c.vignette * 0.45 + this.cinematic * 0.08;
    half(c.shadows, u.get('shadowCol')!.value);
    half(c.highlights, u.get('lightCol')!.value);
    u.get('letterbox')!.value = this.cinematic;
    u.get('paper')!.value = c.paper ?? 0;
    u.get('lift')!.value = c.lift ?? 0;
    const pu = this.paintFx.uniforms;
    pu.get('strength')!.value = c.paint ?? 0;
    pu.get('ink')!.value = c.ink ?? 0;
    this.paintPass.enabled = (c.paint ?? 0) > 0.01 || (c.ink ?? 0) > 0.01;
    u.get('flash')!.value = this.flash;
    (u.get('flashCol')!.value as THREE.Color).copy(this.flashCol);
    this.flash = Math.max(0, this.flash - dt * 2.8);
    this.bloom.intensity = c.bloom;
    this.ca.offset.set(this.aberr * 0.006, this.aberr * 0.003);
    this.aberr = Math.max(0, this.aberr - dt * 4);
    // Profundidad de campo: enfoca a quien habla y desenfoca el fondo
    this.dofPass.enabled = this.cinematic * this.dofAmount > 0.02;
    if (this.dofPass.enabled) {
      const dist = this.camera.position.distanceTo(this.focus);
      this.dof.cocMaterial.worldFocusDistance = dist;
      this.dof.cocMaterial.worldFocusRange = Math.max(1.5, dist * 0.5);
      this.dof.bokehScale = 3.2 * this.cinematic * this.dofAmount;
    }
    this.render.mainScene = scene;
    this.ao.scene = scene;
    this.composer.render(dt);
  }
}
