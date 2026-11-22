// El final del año (21 nov): después del regalo del cap. 9, llega Barcelona y lo que les gusta hacer juntos — el
// vóley, Joy en el parque (agility) y la hípica de saltos —, y al acabar, los créditos.
import { audio } from '../core/audio';
import { MEMORIES } from '../data/memories';
import { SONG_OF } from '../core/songs';
import { FINALE } from '../data/story';
import { setCastChapter, setGasNamed, clearScreens, phoneChat, hud, closeDialogue, pauseState, debugPanel, isTestMode } from './ui';
import { parkMission } from '../world/missions/park';
import { stage } from '../core/stage';
import { CHATS } from '../data/chats';
import { beachMission } from '../world/missions/beach';
import { ridingMission } from '../world/missions/riding';
import { surfMission } from '../world/missions/surf';

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
function storyCard(o: { kicker: string; title: string; sub: string; icon: string; how: string; go?: string }, onGo: (card: HTMLElement) => void, onBack: () => void) {
  const scr = el('div', 'screen pz-screen fn-screen');
  const card = el('div', 'letter pz-card fn-pz');
  const head = el('div', 'pz-head');
  head.append(el('div', 'pz-kicker', `${o.icon} ${o.kicker}`), el('h2', '', o.title), el('p', 'pz-sub', o.sub));
  const body = el('div', 'pz-body fn-body');
  // (4.4.8: sin frases de narrador; solo su dibujo y cómo se juega)
  body.append(el('div', 'fn-ico', o.icon), el('p', 'fn-how', o.how));
  const btn = el('button', 'hm-btn fn-go', o.go ?? 'Jugar');
  card.append(head, body, btn);
  const back = el('button', 'link-btn pz-back', '‹ Volver');
  back.onclick = (e) => {
    e.stopPropagation();
    onBack();
  };
  scr.append(card, back);
  root().append(scr);
  audio.whoosh();
  btn.onclick = (e) => {
    e.stopPropagation();
    btn.disabled = true;
    onGo(scr);
  };
  return scr;
}

export type Hobby = 'voley' | 'agility' | 'hipica' | 'surf';

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
    voley: { kicker: 'Septiembre', title: 'Vóley playa', sub: 'Lo que nos gusta · 1 de 4', icon: '🏐', how: 'Un partido contra Gas, a 5 puntos. Ponte bajo la pelota y dale a tiempo; luego remata arriba del todo, apuntando adonde no esté él.' },
    agility: { kicker: 'Octubre', title: 'Agility con Joy', sub: 'Lo que nos gusta · 2 de 4', icon: '🐕', how: 'Primero, las órdenes de Gas en el césped. Luego, el recorrido: lleva a Joy por cada obstáculo. Tres faltas y eliminada.' },
    hipica: { kicker: 'Noviembre', title: 'Salto a caballo', sub: 'Lo que nos gusta · 3 de 4', icon: '🐎', how: 'Doce obstáculos. Lleva el galope y bate en su punto: ni muy pronto ni muy tarde. Tres faltas y eliminada.' },
    surf: { kicker: 'Y lo que viene', title: 'Surf', sub: 'Lo que nos gusta · 4 de 4', icon: '🏄', how: 'Cuando llegue la ola, rema y ponte de pie a tiempo. Luego, delante de la espuma, sin que te pille. Tres olas buenas.' },
  }[which];
  const CHAT = { voley: CHATS.voley, agility: CHATS.agility, hipica: CHATS.caballos, surf: null }[which];
  let token = 0;
  const finish = (my: number) => () => {
    if (gone || my !== token) return;
    end();
    onDone();
  };
  const game = (done: () => void, course = false) => (which === 'voley' ? beachMission(done) : which === 'agility' ? parkMission(done, course) : which === 'hipica' ? ridingMission(done) : surfMission(done));
  const play = (direct = false, course = false) => {
    const my = ++token;
    if (direct) return game(finish(my), course);
    storyCard(
      CARD,
      (c) => {
        const go = () => {
          c.remove();
          if (my === token && !gone) game(finish(my));
        };
        if (CHAT) phoneChat(CHAT, go);
        else go();
      },
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
  // (4.4.8) Mientras suben los nombres, las fotos del año: polaroids que suben despacio a los dos lados, giradas,
  // una detrás de otra (las del álbum, en orden), y la canción del capítulo 9 de fondo
  const pics = el('div', 'fin-pics');
  // (unas cuantas, repartidas por todo el año: pocas a la vez, en los bordes, sin tapar los nombres)
  const all = MEMORIES.filter((m) => m.src && !m.sticker && !m.chat && !m.pending);
  const shots = Array.from({ length: Math.min(16, all.length) }, (_, i) => all[Math.floor((i * all.length) / Math.min(16, all.length))]);
  shots.forEach((m, i) => {
    const p = el('div', 'fin-pic' + (i % 2 ? ' r' : ' l'));
    const img = el('img') as HTMLImageElement;
    img.src = m.src!;
    img.alt = '';
    img.loading = 'lazy';
    p.append(img);
    p.style.setProperty('--d', `${2 + i * 2.2}s`);
    p.style.setProperty('--r', `${(i % 2 ? 1 : -1) * (4 + (i * 7) % 9)}deg`);
    p.style.setProperty('--x', `${(i * 37) % 22}%`);
    pics.append(p);
  });
  const title = el('div', 'fin-open', '<small>Un regalo de Gas</small>Para <i>Azul</i>');
  o.append(pics, title, roll, skip);
  root().append(o);
  audio.fanfare();
  if (SONG_OF[9]) audio.playTrack(SONG_OF[9], 2.5);
  let gone = false;
  const thanks = () => {
    if (gone) return;
    gone = true;
    roll.remove();
    skip.remove();
    const t = el('div', 'fin-thanks', 'Gracias por este año<i>💙</i>');
    const b = el('button', 'hm-btn fin-btn', 'Volver al mapa');
    b.onclick = () => {
      audio.stopTrack();
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
