// Lo común de los juegos del final (vóley, agility, hípica, surf), con el HUD y los textos de los niveles normales
// (4.4.8): el rótulo de misión al empezar y al acabar, los contadores en chips (x/N y corazones) y los comentarios en el
// bocadillo de Gas, pegado a su cabeza (como en cualquier capítulo).
import { audio } from '../../core/audio';
import { bark, missionCard, type Hud } from '../../ui/ui';

/** «¡AL TUBO!» → «¡Al tubo!» (como hablan en los bocadillos). */
const say = (t: string) => t.toLowerCase().replace(/\p{L}/u, (c) => c.toUpperCase());

export class Show {
  private hud: Hud | null = null;
  constructor(_label?: string) {}

  bind(h: Hud) {
    this.hud = h;
  }

  /** Al empezar: el rótulo de misión de siempre (título y qué hay que hacer). */
  intro(title: string, _vs: string, how: string, _secs?: number) {
    missionCard(title, how);
  }

  /** Los contadores de arriba, en chips como en los capítulos. */
  score(html: string) {
    this.hud?.setCounters(html);
  }

  /** Lo que pasa, comentado por Gas en su bocadillo. */
  call(text: string, _good = true, _secs?: number) {
    bark('Gas', say(text));
  }

  /** Conseguido: el rótulo de misión cumplida. */
  win(text: string) {
    missionCard(say(text), '', true);
    audio.fanfare();
    audio.cheer(0.5);
  }

  dispose() {
    this.hud?.setCounters('');
  }
}
