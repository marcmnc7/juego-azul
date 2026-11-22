// El final del año (21 nov): después del regalo del cap. 9, llega Barcelona y lo que les gusta hacer juntos — el
// vóley, Joy en el parque (agility) y la hípica de saltos —, y al acabar, los créditos.
import { audio } from '../core/audio';
import { ANIVERSARIO, FINALE } from '../data/story';
import { setCastChapter, setGasNamed, clearScreens, phoneChat, hud, closeDialogue, pauseState, debugPanel, isTestMode } from './ui';
import { parkMission } from '../world/missions/park';
import { stage } from '../core/stage';
import { CHATS } from '../data/chats';
import { beachMission } from '../world/missions/beach';
import type { Line } from '../data/story';
import { ridingMission } from '../world/missions/riding';

const root = () => document.getElementById('ui')!;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/**
 * Rótulo de cada parte del final (4.4.5), con el mismo diseño que los juegos de palabras del mapa: la tarjeta crema
 * sobre el azul de noche, la etiqueta con el icono y la fecha, el título y su línea, lo que se cuenta dentro, frase a
 * frase (toca para seguir), el botón dorado y «‹ Volver». El chat de esos días sale encima; el juego, al cerrarlo.
 */
function storyCard(o: { kicker: string; title: string; sub: string; icon: string; lines: Line[]; go?: string }, onGo: (card: HTMLElement) => void, onBack: () => void) {
  const scr = el('div', 'screen pz-screen fn-screen');
  const card = el('div', 'letter pz-card fn-pz');
  const head = el('div', 'pz-head');
  head.append(el('div', 'pz-kicker', `${o.icon} ${o.kicker}`), el('h2', '', o.title), el('p', 'pz-sub', o.sub));
  const body = el('div', 'pz-body fn-body');
  body.append(el('div', 'fn-ico', o.icon));
  const story = el('div', 'fn-story');
  body.append(story);
  const btn = el('button', 'hm-btn fn-go', 'Toca para seguir');
  btn.disabled = true;
  card.append(head, body, btn);
  const back = el('button', 'link-btn pz-back', '‹ Volver');
  back.onclick = (e) => {
    e.stopPropagation();
    onBack();
  };
  scr.append(card, back);
  root().append(scr);
  audio.whoosh();
  let i = -1;
  const next = () => {
    if (i >= o.lines.length - 1) return;
    i++;
    const l = o.lines[i];
    story.append(el('p', l.who === 'Narrador' ? 'fn-narr' : 'fn-quote', l.who === 'Narrador' ? l.text : `<b>${l.who === 'Margaux' ? 'Azul' : l.who}</b>${l.text}`));
    story.scrollTop = story.scrollHeight;
    audio.talk();
    if (i >= o.lines.length - 1) {
      btn.disabled = false;
      btn.textContent = o.go ?? 'Jugar';
    }
  };
  card.onpointerdown = (e) => {
    if ((e.target as HTMLElement).closest('.fn-go')) return;
    next();
  };
  btn.onclick = (e) => {
    e.stopPropagation();
    if (btn.disabled) return;
    btn.disabled = true;
    onGo(scr);
  };
  setTimeout(next, 600);
  return scr;
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
  // (ya es después del cap. 9: Gas y Azul, también en los chats)
  setCastChapter(9);
  setGasNamed(true);
  let gone = false;
  pauseState.on = false;
  pauseState.n = 0;
  pauseState.title = 'Lo que nos gusta';
  // (el HUD solo pone el botón de pausa: la barra de arriba la lleva cada misión)
  const leave = () => {
    gone = true;
    closeDialogue();
    stage.end();
    root().querySelectorAll('.phone-overlay, .fin-screen, .fn-screen').forEach((n) => n.remove());
    h.remove();
    onExit();
  };
  const h = hud(() => {}, () => leave(), '');
  h.root.style.display = 'none';
  // (el del final no tiene acción propia: cada juego trae la suya)
  h.setIcon('');
  // Cada paso, con su «siguiente». En modo prueba, «Saltar a una fase» (en la pausa) lleva a cualquiera de ellos,
  // también al circuito de agility sin pasar por los trucos
  // (cada juego, con su rótulo; el chat de esos días sale encima del rótulo y el juego empieza al cerrarlo)
  const withCard = (card: Parameters<typeof storyCard>[0], chat: Parameters<typeof phoneChat>[0] | null, game: (done: () => void) => void) => (next: () => void) =>
    storyCard(
      card,
      (c) => {
        const play = () => {
          c.remove();
          game(next);
        };
        if (chat) phoneChat(chat, play);
        else play();
      },
      leave,
    );
  const steps: ((next: () => void) => void)[] = [
    (next) => storyCard({ kicker: 'Después de Ferreries', title: 'Barcelona', sub: 'Lo que nos gusta', icon: '🏙️', lines: FINALE.barcelona, go: 'Seguir' }, (c) => (c.remove(), next()), leave),
    withCard({ kicker: 'Septiembre', title: 'Vóley playa', sub: 'Lo que nos gusta · 1 de 3', icon: '🏐', lines: ANIVERSARIO.september }, CHATS.voley, beachMission),
    withCard({ kicker: 'Octubre', title: 'Joy, campeón', sub: 'Lo que nos gusta · 2 de 3', icon: '🐕', lines: ANIVERSARIO.october }, CHATS.agility, (d) => parkMission(d)),
    withCard({ kicker: 'Noviembre', title: 'A caballo', sub: 'Lo que nos gusta · 3 de 3', icon: '🐎', lines: FINALE.horses }, CHATS.caballos, ridingMission),
  ];
  let token = 0;
  let closeDebug: (() => void) | null = null;
  const end = () => {
    closeDebug?.();
    closeDebug = null;
  };
  const exit0 = onExit;
  onExit = () => {
    end();
    exit0();
  };
  const run = (i: number) => {
    if (gone) return;
    const my = ++token;
    setStep(i);
    if (i >= steps.length) {
      setStep(0);
      end();
      h.remove();
      storyCard({ kicker: 'Y ahora', title: 'Fin de este año', sub: 'Lo que nos gusta', icon: '💙', lines: FINALE.end, go: 'Seguir' }, (c) => (c.remove(), credits(onDone)), leave);
      return;
    }
    steps[i](() => my === token && run(i + 1));
  };
  if (isTestMode())
    closeDebug = debugPanel([
      { label: '1 · Barcelona', run: () => run(0) },
      { label: '2 · Vóley playa', run: () => run(1) },
      { label: '2b · Vóley, directo', run: () => { const my = ++token; setStep(1); beachMission(() => my === token && run(2)); } },
      { label: '3 · Joy: los trucos', run: () => run(2) },
      {
        label: '3b · Joy: el circuito de agility',
        run: () => {
          const my = ++token;
          setStep(2);
          parkMission(() => my === token && run(3), true);
        },
      },
      { label: '4 · A caballo (chat e hípica)', run: () => run(3) },
      { label: '5 · Hípica, directa', run: () => { const my = ++token; setStep(3); ridingMission(() => my === token && run(4)); } },
      { label: '6 · Final y créditos', run: () => run(4) },
    ]);
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
