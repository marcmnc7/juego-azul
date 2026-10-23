// Música y efectos sintetizados con WebAudio (sin archivos de audio: todo cabe en un HTML).
type Note = [number | null, number]; // [semitonos desde La4 o null = silencio, duración en corcheas]

interface Song {
  notes: Note[];
  eighth: number; // segundos por corchea
  wave: OscillatorType;
  octave: number; // semitonos extra
  drum: (beat: number) => number; // volumen del golpe en cada corchea (0 = nada)
  bass?: boolean;
}

// Jaleo: imita de lejos el fabiol y el tamborí, en 6/8.
const JALEO: Song = {
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
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate * 0.3;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    window.setInterval(() => this.schedule(), 50);
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

  startMusic(name: SongName = 'jaleo') {
    if (!this.ctx) return;
    this.song = SONGS[name];
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.beat = 0;
  }

  stopMusic() {
    this.playing = false;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const sg = this.song;
    while (this.nextTime < ctx.currentTime + 0.25) {
      const [semi, dur] = sg.notes[this.step % sg.notes.length];
      if (semi !== null) {
        this.tone(440 * Math.pow(2, (semi + sg.octave) / 12), this.nextTime, dur * sg.eighth * 0.92, sg.wave, sg.wave === 'square' ? 0.08 : 0.22, this.musicGain);
        if (sg.bass) this.tone(440 * Math.pow(2, (semi - 24) / 12), this.nextTime, dur * sg.eighth, 'triangle', 0.25, this.musicGain);
      }
      for (let i = 0; i < dur; i++) {
        const v = sg.drum(this.beat);
        if (v) this.drum(this.nextTime + i * sg.eighth, v);
        this.beat++;
      }
      this.nextTime += dur * sg.eighth;
      this.step++;
    }
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

  kickAt(t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.8, t);
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
    notes.forEach((n, i) => this.tone(440 * Math.pow(2, n / 12), t + i * gap, 0.25, type, vol));
  }

  pickup() { this.sfx([12, 16, 19], 0.06); }
  luck() { this.sfx([19, 24, 28, 31], 0.05, 'triangle'); }
  talk() { this.sfx([7], 0, 'square', 0.04); }
  bark() { this.sfx([-2, -5], 0.09, 'sawtooth', 0.12); }
  boo() { this.sfx([0, -3, -7], 0.12, 'triangle', 0.25); }
  hit() {
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
  fanfare() { this.sfx([7, 12, 16, 19, 24, 19, 24, 28], 0.11, 'triangle', 0.3); }
  perfect() { this.sfx([24, 28, 31, 36], 0.04, 'square', 0.08); this.sfx([19, 24, 28, 31], 0.05, 'triangle'); }
  warn() { this.sfx([5, 5], 0.1, 'square', 0.06); }
  whoosh() { if (this.ctx) this.noiseSwell(0.5, 0.35, 600, 2400); }
  pop() { this.sfx([24, 31], 0.03, 'sine', 0.25); }
  splash() { if (this.ctx) this.noiseSwell(0.9, 0.5, 400, 3000); }
  /** Campanita de estrella: cada una un poco más aguda. */
  chime(step: number) { this.sfx([12 + step * 2, 19 + step * 2], 0.08, 'sine', 0.22); }

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
}

export const audio = new Audio();
