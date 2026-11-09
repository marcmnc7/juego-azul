import type * as THREE from 'three';
import { vibrate } from './gfx';
import { comicBurst } from './comic';

// "Juice": lo que hace que un acierto se sienta. Una micro-pausa (hit-stop), un golpe de zoom, un
// destello y un pelín de aberración cromática, coordinados. Cada sonido de premio dispara su efecto
// (ver audio.onCue en main.ts), así todos los capítulos lo tienen sin tocar su lógica.

export type Cue = 'perfect' | 'luck' | 'pickup' | 'fanfare' | 'hit' | 'splash' | 'chime' | 'pop' | 'cheer';

/** Onomatopeyas de tebeo para cada efecto (las de recoger y los pops, que son muy seguidos, sin palabra). */
const WORDS: Partial<Record<Cue, string[]>> = {
  perfect: ['¡TOMA!', '¡BRAVO!', '¡GENIAL!'],
  luck: ['¡UF!', '¡POR POCO!'],
  hit: ['¡PAF!', '¡ZAS!', '¡PUM!', '¡CATAPUM!'],
  splash: ['¡SPLASH!', '¡CHOF!', '¡PLAF!', '¡SPLOSH!'],
  fanfare: ['¡TACHÁN!'],
  cheer: ['¡BIEN!', '¡OLÉ!'],
};

interface Fx {
  flashScreen(color: number, amount: number): void;
  kick(amount: number): void;
}

class Juice {
  private stop = 0;
  private zoom = 0;
  private zoomV = 0;
  private shakeT = 0;
  private shakeA = 0;
  fx: Fx | null = null;

  /** Congela la acción unos milisegundos: el impacto "pesa". */
  hitstop(sec: number) {
    this.stop = Math.max(this.stop, sec);
  }

  /** Empujón de zoom que vuelve con muelle. */
  punch(amount: number) {
    this.zoomV += amount * 9;
  }

  shake(amount: number, sec = 0.25) {
    this.shakeA = Math.max(this.shakeA, amount);
    this.shakeT = Math.max(this.shakeT, sec);
  }

  /** Cómic: dibuja la onomatopeya del golpe (la pone la interfaz, ver main.ts). */
  onWord: ((word: string, cue: Cue) => void) | null = null;
  private lastWord = 0;

  cue(c: Cue) {
    const fx = this.fx;
    {
      const words = WORDS[c];
      // (sin amontonar: una cada medio segundo como mucho)
      const now = performance.now();
      if (words && now - this.lastWord > 500) {
        this.lastWord = now;
        this.onWord?.(words[Math.floor(Math.random() * words.length)], c);
      }
      if (c === 'perfect' || c === 'hit') comicBurst(1);
      else if (c === 'splash' || c === 'luck' || c === 'fanfare') comicBurst(0.6);
    }
    switch (c) {
      case 'perfect':
        this.hitstop(0.09);
        this.punch(0.07);
        fx?.flashScreen(0xffe7a0, 0.35);
        fx?.kick(0.6);
        vibrate([18, 30, 18]);
        break;
      case 'luck':
        this.hitstop(0.05);
        this.punch(0.045);
        fx?.flashScreen(0xfff3c8, 0.18);
        vibrate(14);
        break;
      case 'pickup':
      case 'chime':
        this.punch(0.025);
        fx?.flashScreen(0xffffff, 0.06);
        vibrate(8);
        break;
      case 'fanfare':
        this.punch(0.04);
        fx?.flashScreen(0xfff0d0, 0.22);
        break;
      case 'hit':
        this.hitstop(0.06);
        this.shake(0.18);
        fx?.kick(1);
        fx?.flashScreen(0xff6040, 0.12);
        vibrate(40);
        break;
      case 'splash':
        this.punch(0.03);
        this.shake(0.08);
        fx?.kick(0.3);
        break;
      case 'pop':
        this.punch(0.012);
        break;
      case 'cheer':
        break;
    }
  }

  /** Devuelve el dt de juego (casi parado durante el hit-stop). */
  scaleDt(dt: number) {
    if (this.stop <= 0) return dt;
    this.stop -= dt;
    return dt * 0.06;
  }

  /** Se aplica después de que el capítulo coloque la cámara. */
  apply(cam: THREE.PerspectiveCamera, dt: number, cinematicZoom: number) {
    // Muelle críticamente amortiguado hacia 0
    this.zoomV += (-this.zoom * 160 - this.zoomV * 18) * dt;
    this.zoom += this.zoomV * dt;
    const z = 1 + this.zoom + cinematicZoom;
    if (Math.abs(cam.zoom - z) > 1e-4) {
      cam.zoom = z;
      cam.updateProjectionMatrix();
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeA * Math.min(1, this.shakeT * 5);
      cam.position.x += (Math.random() - 0.5) * a;
      cam.position.y += (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeA = 0;
    }
  }
}

export const juice = new Juice();
