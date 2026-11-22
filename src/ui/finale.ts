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

export type Hobby = 'voley' | 'agility' | 'hipica';

/**
 * Uno de los tres juegos del final (cada uno, su bolita en el mapa): su rótulo (con lo que se cuenta), el chat de esos
 * días y el juego. Al acabar el último (la hípica), el rótulo del final y los créditos. Con pausa para salir a medias
 * y, en modo prueba, «Saltar a una fase» (con rótulo y chat, el juego directo y, en el agility, el circuito).
 */
export function hobbyGame(which: Hobby, onDone: () => void, onExit: () => void = onDone) {
  clearScreens();
  // (ya es después del cap. 9: Gas y Azul, también en los chats)
  setCastChapter(9);
  setGasNamed(true);
  let gone = false;
  pauseState.on = false;
  pauseState.n = 0;
  pauseState.title = 'Lo que nos gusta';
  let closeDebug: (() => void) | null = null;
  const end = () => {
    closeDebug?.();
    closeDebug = null;
    h.remove();
  };
  const leave = () => {
    gone = true;
    closeDialogue();
    stage.end();
    root().querySelectorAll('.phone-overlay, .fin-screen, .fn-screen').forEach((n) => n.remove());
    end();
    onExit();
  };
  // (el HUD solo pone el botón de pausa: la barra de arriba y el botón de acción los lleva cada juego)
  const h = hud(() => {}, () => leave(), '');
  h.root.style.display = 'none';
  h.setIcon('');
  const CARD = {
    voley: { kicker: 'Septiembre', title: 'Vóley playa', sub: 'Lo que nos gusta · 1 de 3', icon: '🏐', lines: [...FINALE.barcelona, ...ANIVERSARIO.september] },
    agility: { kicker: 'Octubre', title: 'Joy, campeón', sub: 'Lo que nos gusta · 2 de 3', icon: '🐕', lines: ANIVERSARIO.october },
    hipica: { kicker: 'Noviembre', title: 'A caballo', sub: 'Lo que nos gusta · 3 de 3', icon: '🐎', lines: FINALE.horses },
  }[which];
  const CHAT = { voley: CHATS.voley, agility: CHATS.agility, hipica: CHATS.caballos }[which];
  let token = 0;
  const finish = (my: number) => () => {
    if (gone || my !== token) return;
    end();
    if (which !== 'hipica') return onDone();
    // (el último: el final del año y los créditos)
    storyCard({ kicker: 'Y ahora', title: 'Fin de este año', sub: 'Lo que nos gusta', icon: '💙', lines: FINALE.end, go: 'Seguir' }, (c) => (c.remove(), credits(onDone)), onDone);
  };
  const game = (done: () => void, course = false) => (which === 'voley' ? beachMission(done) : which === 'agility' ? parkMission(done, course) : ridingMission(done));
  const play = (direct = false, course = false) => {
    const my = ++token;
    if (direct) return game(finish(my), course);
    storyCard(
      CARD,
      (c) =>
        phoneChat(CHAT, () => {
          c.remove();
          if (my === token && !gone) game(finish(my));
        }),
      leave,
    );
  };
  if (isTestMode())
    closeDebug = debugPanel([
      { label: '1 · Rótulo y chat', run: () => play() },
      { label: '2 · El juego, directo', run: () => play(true) },
      ...(which === 'agility' ? [{ label: '3 · El circuito, directo', run: () => play(true, true) }] : []),
    ]);
  play();
}

/** (modo prueba) El primero de los tres. */
export function hobbiesFinale(onDone: () => void) {
  hobbyGame('voley', onDone);
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
