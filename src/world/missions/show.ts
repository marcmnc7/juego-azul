// Lo común de los tres juegos del final (vóley, agility, hípica): presentación de «retransmisión». Un rótulo de
// entrada con el «Azul vs …», un marcador de tele arriba, rótulos grandes para lo que pasa (las onomatopeyas del
// cómic están apagadas) y el confeti del final.
import { audio } from '../../core/audio';
import { cssConfetti } from '../../ui/ui';

const ui = () => document.getElementById('ui')!;
function el(cls: string, html = '') {
  const e = document.createElement('div');
  e.className = cls;
  e.innerHTML = html;
  return e;
}

export class Show {
  private board = el('sw-board');
  private callEl: HTMLElement | null = null;
  private callT = 0;

  constructor(private kicker: string) {
    ui().append(this.board);
  }

  /** El rótulo de entrada: el título, el «quién contra quién» y una línea de lo que hay que hacer. */
  intro(title: string, vs: string, how: string, secs = 3.6) {
    const c = el('sw-intro', `<small>${this.kicker}</small><b>${title}</b><i>${vs}</i><p>${how}</p>`);
    ui().append(c);
    audio.whoosh();
    setTimeout(() => audio.chime(3), 300);
    setTimeout(() => c.classList.add('out'), secs * 1000);
    setTimeout(() => c.remove(), secs * 1000 + 600);
  }

  /** El marcador de arriba (html libre: nombres, puntos, corazones). */
  score(html: string) {
    if (this.board.innerHTML !== html) this.board.innerHTML = html;
  }

  /** Un rótulo grande en el centro (¡PUNTO!, ¡LIMPIO!…). good: verde/dorado; si no, rojo. */
  call(text: string, good = true, secs = 1.1) {
    this.callEl?.remove();
    const c = el('sw-call' + (good ? ' good' : ' bad'), `<span>${text}</span>`);
    ui().append(c);
    this.callEl = c;
    clearTimeout(this.callT);
    this.callT = window.setTimeout(() => c.remove(), secs * 1000);
  }

  /** Fin con premio: confeti y el rótulo. */
  win(text: string) {
    const c = el('sw-win', `<span>${text}</span>`);
    ui().append(c);
    cssConfetti(c, 110);
    audio.fanfare();
    audio.cheer(0.6);
    setTimeout(() => c.remove(), 3600);
  }

  dispose() {
    this.board.remove();
    this.callEl?.remove();
    ui().querySelectorAll('.sw-intro, .sw-win').forEach((n) => n.remove());
  }
}
