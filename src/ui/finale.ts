// El final del año (21 nov): después del regalo del cap. 9, llega Barcelona y lo que les gusta hacer juntos — el
// vóley, Joy en el parque (agility) y la hípica de saltos —, y al acabar, los créditos.
import { audio } from '../core/audio';
import { ANIVERSARIO, FINALE } from '../data/story';
import { dialogue, clearScreens, phoneChat, hud, closeDialogue, pauseState } from './ui';
import { stage } from '../core/stage';
import { CHATS } from '../data/chats';
import { voley, joyTraining } from './minis';
import { ridingMission } from '../world/missions/riding';

const root = () => document.getElementById('ui')!;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

const STEP_KEY = 'azul-finale-step';
const getStep = () => {
  try {
    return Number(localStorage.getItem(STEP_KEY)) || 0;
  } catch {
    return 0;
  }
};
const setStep = (n: number) => {
  try {
    if (n) localStorage.setItem(STEP_KEY, String(n));
    else localStorage.removeItem(STEP_KEY);
  } catch {
    /* sin almacenamiento: se empieza desde el principio */
  }
};

/**
 * Los hobbies compartidos, uno detrás de otro, y el final con créditos. Hay un botón de pausa (como en los
 * capítulos) para salir a medias: al volver se sigue por el juego en el que estaba.
 */
export function hobbiesFinale(onDone: () => void, onExit: () => void = onDone) {
  clearScreens();
  let gone = false;
  pauseState.on = false;
  pauseState.n = 0;
  pauseState.title = 'Lo que nos gusta';
  // (el HUD solo pone el botón de pausa: la barra de arriba la lleva cada misión)
  const h = hud(
    () => {},
    () => {
      gone = true;
      closeDialogue();
      stage.end();
      root().querySelectorAll('.phone-overlay, .fin-screen').forEach((n) => n.remove());
      h.remove();
      onExit();
    },
    '',
  );
  h.root.style.display = 'none';
  const steps: ((next: () => void) => void)[] = [
    (next) => dialogue(FINALE.barcelona, () => dialogue(ANIVERSARIO.september, next)),
    (next) => voley(next),
    (next) => dialogue(ANIVERSARIO.october, () => joyTraining(next)),
    (next) => phoneChat(CHATS.caballos, () => dialogue(FINALE.horses, next)),
    (next) => ridingMission(next),
  ];
  const run = (i: number) => {
    if (gone) return;
    setStep(i);
    if (i >= steps.length) {
      setStep(0);
      h.remove();
      dialogue(FINALE.end, () => credits(onDone));
      return;
    }
    steps[i](() => run(i + 1));
  };
  run(Math.min(getStep(), steps.length - 1));
}

/** Créditos que suben despacio y, al final, «Gracias por este año» con el corazón azul (sin escena post-créditos). */
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
  const skip = el('button', 'fin-skip', 'Seguir ›');
  o.append(roll, skip);
  root().append(o);
  audio.fanfare();
  let gone = false;
  const thanks = () => {
    if (gone) return;
    gone = true;
    roll.remove();
    skip.remove();
    const t = el('div', 'fin-thanks', 'Gracias por este año<i>💙</i>');
    const b = el('button', 'hm-btn fin-btn', 'Volver al mapa');
    b.onclick = () => {
      o.remove();
      onDone();
    };
    o.append(t, b);
    audio.chime(3);
  };
  // (los créditos tardan lo que dura la animación; «Seguir» los salta)
  roll.addEventListener('animationend', thanks, { once: true });
  skip.onclick = thanks;
}
