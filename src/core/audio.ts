// Música y efectos sintetizados con WebAudio (sin archivos de audio: todo cabe en un HTML).
// La melodía de cada canción se armoniza sola (un acorde por compás), con colchón de cuerdas, bajo,
// batería completa y una sala con reverb y eco: suena a banda sonora y no a maquinita.
import type { Cue } from './juice';
import { bytes } from './assets';

/** A qué volumen van las canciones, por debajo de los sonidos del juego. */
const TRACK_VOL = 0.78;

type Note = [number | null, number]; // [semitonos desde La4 o null = silencio, duración en corcheas]

interface Song {
  notes: Note[];
  eighth: number; // segundos por corchea
  wave: OscillatorType;
  octave: number; // semitonos extra
  drum: (beat: number) => number; // volumen del golpe en cada corchea (0 = nada)
  bass?: boolean;
  /** Tonalidad (semitonos desde La) y corcheas por compás, para armonizar. */
  key: number;
  bar: number;
  minor?: boolean;
}

// Jaleo: imita de lejos el fabiol y el tamborí, en 6/8.
const JALEO: Song = {
  key: 5,
  bar: 6,
  eighth: 0.16,
  wave: 'triangle',
  octave: 12,
  drum: (b) => (b % 6 === 0 ? 0.5 : b % 3 === 0 ? 0.3 : 0),
  notes: [
    [5, 1], [9, 1], [12, 1], [14, 2], [12, 1], [9, 1], [12, 1], [9, 1], [5, 3],
    [7, 1], [10, 1], [14, 1], [16, 2], [14, 1], [12, 1], [10, 1], [9, 1], [7, 3],
    [5, 1], [9, 1], [12, 1], [17, 2], [16, 1], [14, 1], [12, 1], [14, 1], [16, 3],
    [17, 1], [16, 1], [14, 1], [12, 1], [10, 1], [9, 1], [7, 1], [9, 1], [5, 4], [null, 2],
  ],
};

// Canción de carretera: alegre, en 4/4.
const ROAD: Song = {
  key: 3,
  bar: 8,
  eighth: 0.17,
  wave: 'square',
  octave: 0,
  bass: true,
  drum: (b) => (b % 4 === 0 ? 0.45 : b % 4 === 2 ? 0.25 : 0),
  notes: [
    [3, 2], [7, 1], [10, 1], [12, 2], [10, 2], [7, 2], [10, 1], [12, 1], [15, 4],
    [8, 2], [12, 1], [15, 1], [17, 2], [15, 2], [12, 2], [10, 1], [8, 1], [7, 4],
    [3, 2], [7, 1], [10, 1], [12, 2], [15, 2], [17, 2], [15, 1], [12, 1], [10, 4],
    [8, 2], [10, 2], [12, 2], [10, 1], [8, 1], [7, 2], [5, 2], [3, 4],
  ],
};

// Nana de verano para la noche en casa: lenta, suave y sin batería.
const NIGHT: Song = {
  key: 0,
  bar: 8,
  eighth: 0.3,
  wave: 'sine',
  octave: 12,
  bass: true,
  drum: () => 0,
  notes: [
    [0, 2], [4, 2], [7, 2], [11, 4], [9, 2], [7, 4],
    [5, 2], [9, 2], [12, 2], [14, 4], [12, 2], [9, 4],
    [4, 2], [7, 2], [11, 2], [12, 4], [11, 2], [7, 4],
    [5, 2], [4, 2], [2, 2], [0, 6], [null, 2],
  ],
};

export type SongName = 'jaleo' | 'road' | 'night';
const SONGS: Record<SongName, Song> = { jaleo: JALEO, road: ROAD, night: NIGHT };

/** Acordes diatónicos (I ii iii IV V vi) como grados de la escala mayor. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const CHORD_PREF = [1, 0.55, 0.35, 0.9, 0.85, 0.7];
/**
 * Un acorde por compás: el triada de la tonalidad que más notas de la melodía cubre (pesadas por
 * duración), con preferencia por I, IV y V. Devuelve la raíz (semitonos) y si es menor.
 */
function harmonize(sg: Song): Array<{ root: number; minor: boolean; third: number }> {
  const bars: number[][] = [];
  let pos = 0;
  for (const [semi, dur] of sg.notes) {
    const b = Math.floor(pos / sg.bar);
    (bars[b] ??= new Array(12).fill(0));
    if (semi !== null) bars[b][(((semi - sg.key) % 12) + 12) % 12] += dur;
    pos += dur;
  }
  const out: Array<{ root: number; minor: boolean; third: number }> = [];
  let prev = -1;
  for (const w of bars) {
    let best = 0, bestScore = -1;
    for (let d = 0; d < 6; d++) {
      const tones = [MAJOR[d], MAJOR[(d + 2) % 7], MAJOR[(d + 4) % 7]];
      const score = tones.reduce((a, t) => a + (w?.[t] ?? 0), 0) + CHORD_PREF[d] * 1.5 + (d === prev ? 0.4 : 0);
      if (score > bestScore) (bestScore = score), (best = d);
    }
    prev = best;
    const root = MAJOR[best];
    const third = (MAJOR[(best + 2) % 7] - root + 12) % 12;
    out.push({ root: sg.key + root, minor: third === 3, third });
  }
  return out;
}

export type Bed = 'plaza' | 'sea' | 'night' | 'wind' | 'none';

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private noise!: AudioBuffer;
  private nextTime = 0;
  private step = 0;
  private beat = 0;
  private song: Song = JALEO;
  muted = false;
  private playing = false;
  private pos = 0;
  private chords: ReturnType<typeof harmonize> = [];
  private reverb!: ConvolverNode;
  private delay!: DelayNode;
  /** Cada sonido de premio avisa (main.ts lo usa para destellos, zoom y vibración). */
  onCue: ((c: Cue) => void) | null = null;
  private cue(c: Cue) {
    this.onCue?.(c);
  }

  /** Debe llamarse dentro de un gesto del usuario (iOS). */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    // Sala: reverb (respuesta al impulso generada) y un eco suave en estéreo, en paralelo con la señal seca
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    this.master.disconnect();
    this.master.connect(comp).connect(this.ctx.destination);
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.6);
    const wet = this.ctx.createGain();
    wet.gain.value = 0.32;
    this.reverb.connect(wet).connect(this.master);
    this.delay = this.ctx.createDelay(1);
    this.delay.delayTime.value = 0.32;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.28;
    const dl = this.ctx.createBiquadFilter();
    dl.type = 'lowpass';
    dl.frequency.value = 2400;
    const dWet = this.ctx.createGain();
    dWet.gain.value = 0.18;
    this.delay.connect(dl).connect(fb).connect(this.delay);
    dl.connect(dWet).connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.master);
    const send = this.ctx.createGain();
    send.gain.value = 0.55;
    this.musicGain.connect(send).connect(this.reverb);
    const len = this.ctx.sampleRate * 0.3;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    window.setInterval(() => this.schedule(), 50);
    // Una canción que se pidió antes del primer toque
    const want = this.trackWant;
    if (want) {
      this.trackWant = null;
      this.playTrack(want);
    }
  }

  /** Tras una llamada o bloquear el móvil, iOS deja el audio suspendido: se reanuda con el siguiente toque. */
  resume() {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }

  /** Reloj de audio en segundos (o reloj normal si no hay audio). */
  time() {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
  }

  // ---------- Las canciones de verdad ----------
  // Se descodifican enteras con Web Audio: el contexto ya está desbloqueado por el primer toque, así que en iOS
  // pueden arrancar en cualquier momento. Mientras suena una, la música sintetizada del capítulo no suena.
  private track: { src: AudioBufferSourceNode; gain: GainNode; buf: AudioBuffer; at: number } | null = null;
  private trackWant: string | null = null;
  private trackToken = 0;
  private trackOn = false;

  /** Suena esta canción en bucle (fundiendo la anterior). Si ya está sonando, sigue por donde iba. */
  playTrack(url: string) {
    if (this.trackWant === url) return;
    this.trackWant = url;
    this.trackOn = true;
    this.playing = false;
    if (!this.ctx) return; // arranca al desbloquear el audio
    const tok = ++this.trackToken;
    this.fadeTrack();
    void bytes(url)
      .then((b) => this.ctx!.decodeAudioData(b))
      .then((buf) => {
        if (tok !== this.trackToken || !this.ctx) return;
        const ctx = this.ctx;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(TRACK_VOL, ctx.currentTime + 1.4);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(gain).connect(this.master);
        const at = ctx.currentTime + 0.03;
        src.start(at);
        this.track = { src, gain, buf, at };
      })
      .catch((e) => {
        console.warn('[audio] no se pudo cargar la canción', e);
        if (tok === this.trackToken) this.trackOn = false;
      });
  }

  /** Funde la canción que suena y vuelve a dejar sonar la música del capítulo. */
  stopTrack() {
    this.trackToken++;
    this.trackWant = null;
    this.trackOn = false;
    this.fadeTrack();
  }

  private fadeTrack() {
    const t = this.track;
    if (!t || !this.ctx) return;
    this.track = null;
    const now = this.ctx.currentTime;
    t.gain.gain.cancelScheduledValues(now);
    t.gain.gain.setValueAtTime(t.gain.gain.value, now);
    t.gain.gain.linearRampToValueAtTime(0, now + 1.2);
    t.src.stop(now + 1.3);
  }

  /**
   * Los golpes de la canción en los próximos `secs` segundos, para jugar encima de ella: en qué momento del reloj de
   * audio caen y en qué carril (0 graves, 1 medios, 2 agudos). Null si aún no está sonando ninguna.
   */
  trackHits(secs: number, from = 2.2) {
    const tr = this.track;
    if (!tr || !this.ctx) return null;
    const { buf, at } = tr;
    const sr = buf.sampleRate;
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    const hop = 512;
    const start = Math.floor(((this.ctx.currentTime - at + from) * sr) % buf.length);
    const frames = Math.floor((secs * sr) / hop);
    const fl = 1 - Math.exp((-2 * Math.PI * 220) / sr), fh = 1 - Math.exp((-2 * Math.PI * 2400) / sr);
    let lo = 0, hi = 0;
    const e = [new Float32Array(frames), new Float32Array(frames), new Float32Array(frames)];
    for (let f = 0; f < frames; f++) {
      let a = 0, b = 0, c = 0;
      for (let i = 0; i < hop; i++) {
        const k = (start + f * hop + i) % buf.length;
        const s = (L[k] + R[k]) * 0.5;
        lo += (s - lo) * fl;
        hi += (s - hi) * fh;
        a += lo * lo;
        b += (hi - lo) * (hi - lo);
        c += (s - hi) * (s - hi);
      }
      e[0][f] = Math.log1p(a * 200);
      e[1][f] = Math.log1p(b * 200);
      e[2][f] = Math.log1p(c * 600);
    }
    const flux = new Float32Array(frames);
    const best = new Uint8Array(frames);
    for (let f = 1; f < frames; f++) {
      let top = 0;
      for (let b = 0; b < 3; b++) {
        const d = Math.max(0, e[b][f] - e[b][f - 1]);
        flux[f] += d;
        if (d > top) {
          top = d;
          best[f] = b;
        }
      }
    }
    const span = Math.round((0.7 * sr) / hop);
    const find = (mul: number, gap: number) => {
      const out: { t: number; lane: number }[] = [];
      let lastT = -9;
      for (let f = 2; f < frames - 2; f++) {
        if (flux[f] < flux[f - 1] || flux[f] < flux[f + 1]) continue;
        let sum = 0, n = 0;
        for (let k = Math.max(0, f - span); k < Math.min(frames, f + span); k++) (sum += flux[k]), n++;
        if (flux[f] < (sum / n) * mul + 0.02) continue;
        const t = (f * hop) / sr;
        if (t - lastT < gap) continue;
        lastT = t;
        // (casi todo golpe de canción cae en graves: que no se queden siempre en el mismo carril)
        const c = out.length;
        const lane = c >= 2 && out[c - 1].lane === best[f] && out[c - 2].lane === best[f] ? (best[f] + 1 + (f % 2)) % 3 : best[f];
        out.push({ t: this.ctx!.currentTime + from + t, lane });
      }
      return out;
    };
    // Que se pueda jugar: ni más de dos y pico por segundo, ni casi nada
    for (const [mul, gap] of [[1.5, 0.36], [1.3, 0.4], [1.9, 0.42], [2.4, 0.46]] as const) {
      const r = find(mul, gap);
      if (r.length <= secs * 2.4 && r.length >= secs * 1.1) return r;
    }
    return find(1.5, 0.45);
  }

  startMusic(name: SongName = 'jaleo') {
    if (!this.ctx || this.trackOn) return;
    this.song = SONGS[name];
    this.chords = harmonize(this.song);
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.beat = 0;
    this.pos = 0;
  }

  stopMusic() {
    this.playing = false;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const sg = this.song;
    const total = sg.notes.reduce((a, n) => a + n[1], 0);
    while (this.nextTime < ctx.currentTime + 0.25) {
      if (this.step % sg.notes.length === 0) this.pos = 0;
      const [semi, dur] = sg.notes[this.step % sg.notes.length];
      if (semi !== null) {
        const f = 440 * Math.pow(2, (semi + sg.octave) / 12);
        const len = dur * sg.eighth * 0.92;
        this.lead(f, this.nextTime, len, sg.wave === 'square' ? 0.07 : 0.16);
      }
      // Lo que cae en este trozo: compás nuevo (acorde y bajo) y la batería de cada corchea
      for (let i = 0; i < dur; i++) {
        const p = this.pos + i;
        const t = this.nextTime + i * sg.eighth;
        if (p % sg.bar === 0) {
          const c = this.chords[Math.floor(p / sg.bar) % this.chords.length];
          const barLen = Math.min(sg.bar, total - p) * sg.eighth;
          if (c) this.pad(c.root, c.third, t, barLen);
        }
        if (sg.bass) {
          const c = this.chords[Math.floor(p / sg.bar) % this.chords.length];
          const on = sg.bar === 6 ? p % 3 === 0 : p % 2 === 0;
          if (c && on) this.tone(440 * Math.pow(2, (c.root - 24 + (p % sg.bar === sg.bar / 2 ? 7 : 0)) / 12), t, sg.eighth * 1.6, 'triangle', 0.22, this.musicGain);
        }
        const v = sg.drum(this.beat);
        if (v) {
          if (v >= 0.4) this.kickAt(t, v);
          else this.drum(t, v * 1.4, 1500);
        }
        if (v || sg.drum(0)) this.hat(t + (this.beat % 2 ? 0.012 : 0), this.beat % 2 ? 0.05 : 0.08);
        this.beat++;
      }
      this.pos += dur;
      this.nextTime += dur * sg.eighth;
      this.step++;
    }
  }

  /** Voz principal: dos osciladores desafinados con filtro que se abre y cierra (más cálido que un pitido). */
  private lead(freq: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(freq * 6, t);
    f.frequency.exponentialRampToValueAtTime(freq * 2, t + Math.max(0.05, dur));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.setTargetAtTime(vol * 0.6, t + 0.03, 0.12);
    g.gain.setTargetAtTime(0, t + dur, 0.06);
    f.connect(g);
    g.connect(this.musicGain);
    g.connect(this.delay);
    for (const [type, det] of [['triangle', -6], ['sawtooth', 7]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = type === 'sawtooth' ? 0.35 : 1;
      o.connect(og).connect(f);
      o.start(t);
      o.stop(t + dur + 0.4);
    }
  }

  /** Colchón de cuerdas: el acorde del compás con ataque lento. */
  private pad(root: number, third: number, t: number, dur: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1100;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + Math.min(0.35, dur * 0.3));
    g.gain.setTargetAtTime(0, t + dur - 0.05, 0.15);
    f.connect(g).connect(this.musicGain);
    for (const iv of [0, third, 7, 12]) {
      for (const det of [-9, 9]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 440 * Math.pow(2, (root - 12 + iv) / 12);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.8);
      }
    }
  }

  private hat(t: number, vol: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    s.connect(f).connect(g).connect(this.musicGain);
    s.start(t, Math.random() * 0.2);
    s.stop(t + 0.06);
  }

  /** Respuesta al impulso de una sala: ruido estéreo que decae. */
  private impulse(sec: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return b;
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, dest?: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private drum(t: number, vol: number, freq = 220) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    s.connect(f).connect(g).connect(this.musicGain);
    s.start(t);
  }

  /** Para el minijuego de ritmo: guitarra (diente de sierra filtrado) en un instante exacto. */
  guitarAt(semi: number, t: number, dur: number) {
    if (!this.ctx) return;
    const f = 440 * Math.pow(2, semi / 12);
    this.tone(f, t, dur, 'sawtooth', 0.09, this.musicGain);
    this.tone(f * 1.5, t, dur, 'sawtooth', 0.05, this.musicGain); // quinta: suena a power chord
    this.tone(f / 2, t, dur, 'triangle', 0.22, this.musicGain);
  }

  kickAt(t: number, vol = 0.8) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.22);
  }

  snareAt(t: number) {
    if (this.ctx) this.drum(t, 0.6, 1800);
  }

  private sfx(notes: number[], gap: number, type: OscillatorType = 'sine', vol = 0.3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    notes.forEach((n, i) => {
      this.tone(440 * Math.pow(2, n / 12), t + i * gap, 0.25, type, vol);
      this.tone(440 * Math.pow(2, n / 12), t + i * gap, 0.4, 'sine', vol * 0.5, this.reverb);
    });
  }

  pickup() { this.cue('pickup'); this.sfx([12, 16, 19], 0.06); }
  luck() { this.cue('luck'); this.sfx([19, 24, 28, 31], 0.05, 'triangle'); }
  talk() { this.sfx([7], 0, 'square', 0.04); }
  bark() { this.sfx([-2, -5], 0.09, 'sawtooth', 0.12); }
  boo() { this.sfx([0, -3, -7], 0.12, 'triangle', 0.25); }
  hit() {
    this.cue('hit');
    if (!this.ctx) return;
    this.drum(this.ctx.currentTime, 0.9);
    this.sfx([-12, -17], 0.08, 'sawtooth', 0.12);
  }
  /** Golpe físico (vaso de plástico, pelota, salpicón): ruido corto filtrado. Agudo = objeto ligero. */
  private lastKnock = 0;
  knock(vol: number, freq = 1800, len = 0.08) {
    if (!this.ctx || !this.noise || vol < 0.02) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (t - this.lastKnock < 0.035) return;
    this.lastKnock = t;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq * (0.9 + Math.random() * 0.2);
    f.Q.value = 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.6, vol) * 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + len + 0.02);
  }
  fanfare() { this.cue('fanfare'); this.sfx([7, 12, 16, 19, 24, 19, 24, 28], 0.11, 'triangle', 0.3); }
  perfect() { this.cue('perfect'); this.sfx([24, 28, 31, 36], 0.04, 'square', 0.08); this.sfx([19, 24, 28, 31], 0.05, 'triangle'); }
  warn() { this.sfx([5, 5], 0.1, 'square', 0.06); }
  whoosh() { if (this.ctx) this.noiseSwell(0.5, 0.35, 600, 2400); }
  pop() { this.cue('pop'); this.sfx([24, 31], 0.03, 'sine', 0.25); }
  splash() { this.cue('splash'); if (this.ctx) this.noiseSwell(0.9, 0.5, 400, 3000); }
  /** Campanita de estrella: cada una un poco más aguda. */
  chime(step: number) { this.cue('chime'); this.sfx([12 + step * 2, 19 + step * 2], 0.08, 'sine', 0.22); }

  /** Ovación del público: ruido filtrado que sube y baja. */
  cheer(vol = 0.5) {
    if (this.ctx) this.noiseSwell(1.6, vol, 900, 1400);
  }

  private noiseSwell(dur: number, vol: number, f0: number, f1: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.crowdBuffer();
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.linearRampToValueAtTime(f1, t + dur * 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  private crowd: AudioBuffer | null = null;
  private crowdBuffer() {
    const ctx = this.ctx!;
    if (this.crowd) return this.crowd;
    const len = ctx.sampleRate * 2;
    this.crowd = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.crowd.getChannelData(0);
    // Ruido "rosa" aproximado con modulaciones lentas: suena a gente hablando a lo lejos
    let b = 0;
    for (let i = 0; i < len; i++) {
      b = 0.97 * b + 0.03 * (Math.random() * 2 - 1);
      const mod = 0.6 + 0.4 * Math.sin(i / 2300) * Math.sin(i / 5100);
      d[i] = b * 6 * mod;
    }
    return this.crowd;
  }

  private amb: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  /** Murmullo de fondo (fiesta o concierto). 0 lo apaga. */
  ambience(vol: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.amb && vol > 0) {
      const src = ctx.createBufferSource();
      src.buffer = this.crowdBuffer();
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 700;
      f.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(f).connect(gain).connect(this.master);
      src.start();
      this.amb = { src, gain };
    }
    if (this.amb) {
      this.amb.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.4);
      if (vol <= 0) {
        const a = this.amb;
        this.amb = null;
        a.src.stop(ctx.currentTime + 1.5);
      }
    }
  }

  private bedNodes: { stop: (t: number) => void; gain: GainNode } | null = null;
  private bedName: Bed = 'none';
  /** Ambiente de fondo de cada capítulo (mar, grillos, viento o plaza), todo sintetizado. */
  bed(name: Bed, vol = 0.5) {
    if (!this.ctx || name === this.bedName) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (this.bedNodes) {
      const old = this.bedNodes;
      old.gain.gain.setTargetAtTime(0, t, 0.6);
      old.stop(t + 3);
      this.bedNodes = null;
    }
    if (this.bedName === 'plaza') this.ambience(0);
    this.bedName = name;
    if (name === 'none') return;
    if (name === 'plaza') {
      this.ambience(vol * 0.5);
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(vol, t, 1.2);
    gain.connect(this.master);
    const srcs: AudioScheduledSourceNode[] = [];
    const noise = () => {
      const s = ctx.createBufferSource();
      s.buffer = this.brown();
      s.loop = true;
      s.start(t, Math.random() * 3);
      srcs.push(s);
      return s;
    };
    const lfo = (hz: number, depth: number, target: AudioParam) => {
      const o = ctx.createOscillator();
      o.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.value = depth;
      o.connect(g).connect(target);
      o.start(t);
      srcs.push(o);
    };
    if (name === 'sea' || name === 'wind' || name === 'night') {
      // Olas (o viento): ruido grave que crece y rompe cada pocos segundos
      const f = ctx.createBiquadFilter();
      f.type = name === 'wind' ? 'bandpass' : 'lowpass';
      f.frequency.value = name === 'wind' ? 500 : 650;
      const g = ctx.createGain();
      g.gain.value = name === 'night' ? 0.15 : 0.5;
      noise().connect(f).connect(g).connect(gain);
      lfo(name === 'wind' ? 0.13 : 0.09, name === 'night' ? 0.1 : 0.35, g.gain);
      lfo(0.07, name === 'wind' ? 300 : 250, f.frequency);
    }
    if (name === 'night') {
      // Grillos: un tono agudo que tiembla rápido y canta a ratos
      for (const [hz, rate] of [[4300, 1.3], [4700, 0.9]]) {
        const o = ctx.createOscillator();
        o.frequency.value = hz;
        const trill = ctx.createGain();
        trill.gain.value = 0;
        const chirp = ctx.createGain();
        chirp.gain.value = 0;
        const pan = ctx.createStereoPanner();
        pan.pan.value = hz > 4500 ? 0.6 : -0.5;
        o.connect(trill).connect(chirp).connect(pan).connect(gain);
        o.start(t);
        srcs.push(o);
        const tr = ctx.createOscillator();
        tr.type = 'square';
        tr.frequency.value = 28;
        const trg = ctx.createGain();
        trg.gain.value = 0.02;
        tr.connect(trg).connect(trill.gain);
        tr.start(t);
        srcs.push(tr);
        const ch = ctx.createOscillator();
        ch.type = 'square';
        ch.frequency.value = rate;
        const chg = ctx.createGain();
        chg.gain.value = 0.5;
        ch.connect(chg).connect(chirp.gain);
        ch.start(t);
        srcs.push(ch);
      }
    }
    this.bedNodes = { gain, stop: (at) => srcs.forEach((s) => s.stop(at)) };
  }

  private brownBuf: AudioBuffer | null = null;
  private brown() {
    const ctx = this.ctx!;
    if (this.brownBuf) return this.brownBuf;
    const len = ctx.sampleRate * 4;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    return (this.brownBuf = b);
  }
}

export const audio = new Audio();
