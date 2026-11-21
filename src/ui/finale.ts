// El final del año (21 nov): después del regalo del cap. 9, llega Barcelona y lo que les gusta hacer juntos — el
// vóley, Joy en el parque (agility) y la hípica de saltos —, y al acabar, los créditos y una escena post-créditos.
import { audio } from '../core/audio';
import { ANIVERSARIO, FINALE } from '../data/story';
import { dialogue, clearScreens } from './ui';
import { voley, joyTraining } from './minis';
import { ridingMission } from '../world/missions/riding';

const root = () => document.getElementById('ui')!;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/** Los hobbies compartidos, uno detrás de otro, y el final con créditos. */
export function hobbiesFinale(onDone: () => void) {
  clearScreens();
  dialogue(FINALE.barcelona, () =>
    dialogue(ANIVERSARIO.september, () =>
      voley(() =>
        dialogue(ANIVERSARIO.october, () =>
          joyTraining(() => dialogue(FINALE.horses, () => ridingMission(() => dialogue(FINALE.end, () => credits(onDone))))),
        ),
      ),
    ),
  );
}

/** Créditos que suben despacio y, al acabar, la escena post-créditos y «Continuará… 2027». */
export function credits(onDone: () => void) {
  clearScreens();
  const o = el('div', 'fin-screen');
  const roll = el('div', 'fin-roll');
  roll.append(el('div', 'fin-end', 'Fin<small>de este año</small>'));
  for (const [k, v] of FINALE.credits) {
    const r = el('div', 'fin-row');
    if (k) r.append(el('b', '', k));
    if (v) r.append(el('span', '', v));
    roll.append(r);
  }
  roll.append(el('div', 'fin-heart', '💙'));
  const skip = el('button', 'fin-skip', 'Seguir ›');
  o.append(roll, skip);
  root().append(o);
  audio.fanfare();
  let gone = false;
  const post = () => {
    if (gone) return;
    gone = true;
    o.classList.add('out');
    setTimeout(() => {
      o.remove();
      // Escena post-créditos: pantalla negra, unas líneas, y lo que viene
      const p = el('div', 'fin-screen fin-post');
      p.append(el('div', 'fin-tag', 'Escena post-créditos'));
      root().append(p);
      setTimeout(
        () =>
          dialogue(FINALE.post, () => {
            const k = el('div', 'fin-keys', '🔑🔑');
            const c = el('div', 'fin-cont', 'Continuará…<small>2027</small>');
            const b = el('button', 'hm-btn fin-btn', 'Volver al mapa');
            b.onclick = () => {
              p.remove();
              onDone();
            };
            p.append(k, c, b);
            audio.chime(3);
          }),
        900,
      );
    }, 700);
  };
  // (los créditos tardan lo que dura la animación; «Seguir» los salta)
  roll.addEventListener('animationend', post, { once: true });
  skip.onclick = post;
}
