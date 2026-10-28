import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  Effect,
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

class GradeEffect extends Effect {
  constructor() {
    super(
      'Grade',
      `uniform float saturation, contrast, tint, vignette, flash, letterbox, aspect;
      uniform vec3 shadowCol, lightCol, flashCol;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, saturation);
        c = (c - 0.5) * contrast + 0.5;
        // Sombras frías y luces cálidas (como el cine), sin tocar los medios
        vec3 tone = mix(shadowCol, lightCol, smoothstep(0.05, 0.85, l));
        c = mix(c, c * tone * 2.0, tint * (1.0 - abs(l - 0.5)));
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
    this.ao = new N8AOPostPass(new THREE.Scene(), camera, 1, 1);
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
    this.composer.addPass(new EffectPass(camera, this.bloom, this.exposure, this.tone, this.grade, this.ca));
    this.composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: mobile ? SMAAPreset.MEDIUM : SMAAPreset.HIGH })));
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h, false);
    this.grade.uniforms.get('aspect')!.value = w / h;
  }

  setGrade(g: Grade, instant = false) {
    this.target = g;
    if (instant) Object.assign(this.cur, g);
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
    c.shadows = t.shadows;
    c.highlights = t.highlights;
    const u = this.grade.uniforms;
    this.exposure.uniforms.get('exposure')!.value = c.exposure * r.toneMappingExposure;
    u.get('saturation')!.value = c.saturation;
    u.get('contrast')!.value = c.contrast;
    u.get('tint')!.value = c.tint;
    u.get('vignette')!.value = c.vignette + this.cinematic * 0.15;
    half(c.shadows, u.get('shadowCol')!.value);
    half(c.highlights, u.get('lightCol')!.value);
    u.get('letterbox')!.value = this.cinematic;
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
