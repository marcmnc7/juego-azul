import { GIFTS, Gift } from '../data/gifts';
import { LEVELS, Line, FINAL_LETTER, CROSSWORD } from '../data/story';
import { audio } from '../core/audio';
import type { SaveData } from '../core/save';
import type { LevelResult } from '../world/level';
import { vibrate } from '../core/gfx';
import { MEMORIES, memoriesFor, STICKERS, LETTER_PHOTOS, Memory } from '../data/memories';

// Interfaz HTML encima del canvas: pantallas, HUD, diálogos y vales.
const root = document.getElementById('ui')!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function clearScreens() {
  root.querySelectorAll('.screen, .gift-overlay').forEach((e) => e.remove());
}

export function titleScreen(onStart: () => void) {
  clearScreens();
  const s = el('div', 'screen');
  s.append(
    el('div', 'hearts', '💙 💙 💙'),
    el('h1', '', 'Feliz cumpleaños,<br>Azul'),
    sticker(STICKERS.oso, 'title-sticker'),
    el('p', '', 'Un pequeño juego sobre nuestra historia, de Gas para ti. Cada capítulo que completes desbloquea un regalo de verdad.'),
  );
  const b = el('button', 'big-btn', 'Empezar');
  b.onclick = () => {
    audio.unlock();
    onStart();
  };
  s.append(b, el('p', '', '<small>Mejor con el móvil en horizontal y el sonido activado 🔊</small>'));
  root.append(s);
}

export interface MapOptions {
  test: boolean;
  onPlay: (level: number) => void;
  onReset: () => void;
}

export function mapScreen(save: SaveData, opts: MapOptions) {
  clearScreens();
  const back = () => mapScreen(save, opts);
  const s = el('div', 'screen');
  if (opts.test) s.append(el('div', 'test-banner', '🛠 Modo prueba: todo desbloqueado'));
  s.append(el('h1', '', 'Nuestra historia'));
  const list = el('div', 'levels');
  const done = new Set(save.levelsDone);
  LEVELS.forEach((lv, i) => {
    const unlocked = opts.test || i === 0 || done.has(LEVELS[i - 1].id);
    const card = el('button', 'level-card' + (unlocked ? '' : ' locked'));
    const state = done.has(lv.id) ? '✓ Completado · jugar otra vez' : unlocked ? '▶ Jugar' : '🔒 Completa el anterior';
    card.append(el('div', 'emoji', lv.emoji), el('div', 'name', `${lv.id}. ${lv.name}`), el('div', 'place', lv.place), el('div', 'state', state));
    if (unlocked) card.onclick = () => opts.onPlay(lv.id);
    list.append(card);
  });
  const allDone = opts.test || LEVELS.every((l) => done.has(l.id));
  const fin = el('button', 'level-card final' + (allDone ? '' : ' locked'));
  fin.append(el('div', 'emoji', '💌'), el('div', 'name', 'La sorpresa final'), el('div', 'place', 'Cuando termines todos los capítulos'), el('div', 'state', allDone ? '▶ Abrir' : '🔒'));
  if (allDone) fin.onclick = () => crossword(() => finalLetter(back), back);
  list.append(fin);
  s.append(list);
  const g = el('button', 'link-btn', `🎁 Mis regalos (${save.giftsUnlocked.length}/${GIFTS.length})`);
  g.onclick = () => giftList(save, back);
  const seen = MEMORIES.filter((m) => opts.test || done.has(m.level)).length;
  const a = el('button', 'link-btn', `📷 Nuestro álbum (${seen}/${MEMORIES.length})`);
  a.onclick = () => album(save, opts.test, back);
  s.append(g, a);
  if (opts.test) {
    const r = el('button', 'link-btn', 'Borrar el progreso guardado');
    r.onclick = opts.onReset;
    s.append(r);
  }
  root.append(s);
}

/** Quita tildes y espacios para comparar respuestas (la Ñ se respeta). */
function norm(t: string) {
  return t
    .toUpperCase()
    .replace(/Ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[\u0300-\u036f\s]/g, '')
    .replace(/\u0001/g, 'Ñ');
}

/** Crucigrama antes de la carta: las letras marcadas forman el mensaje escondido. */
export function crossword(onSolved: () => void, onBack: () => void) {
  clearScreens();
  const o = el('div', 'screen crossword-screen');
  const card = el('div', 'letter crossword');
  card.append(sticker(STICKERS.juzgamos, 'cw-sticker'), el('h2', '', CROSSWORD.title), el('p', 'cw-intro', CROSSWORD.intro));
  const hidden = el('div', 'cw-hidden');
  const slots: HTMLElement[] = [];
  for (const ch of CROSSWORD.hidden) {
    const sl = el('span', ch === ' ' ? 'gap' : 'slot', ch === ' ' ? '' : '?');
    if (ch !== ' ') slots.push(sl);
    hidden.append(sl);
  }
  card.append(hidden);
  const solved = new Set<number>();
  const rows: HTMLElement[] = [];
  const finish = el('button', 'big-btn', 'Abrir la carta 💌');
  finish.hidden = true;
  finish.onclick = onSolved;
  CROSSWORD.clues.forEach((c, i) => {
    const row = el('div', 'cw-row');
    const boxes = el('div', 'cw-boxes');
    const cells: HTMLElement[] = [];
    for (let k = 0; k < c.answer.length; k++) {
      const b = el('span', 'cw-cell' + (k === c.mark ? ' mark' : ''));
      cells.push(b);
      boxes.append(b);
    }
    const input = el('input', 'cw-input') as HTMLInputElement;
    input.maxLength = c.answer.length + 4;
    input.autocapitalize = 'characters';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', c.clue);
    const paint = () => {
      const v = norm(input.value);
      cells.forEach((b, k) => (b.textContent = v[k] ?? ''));
    };
    input.oninput = () => {
      paint();
      if (norm(input.value) === c.answer && !solved.has(i)) {
        solved.add(i);
        row.classList.add('ok');
        input.disabled = true;
        slots[i].textContent = c.answer[c.mark];
        slots[i].classList.add('on');
        audio.talk();
        vibrate(30);
        const next = rows.find((_, j) => !solved.has(j));
        (next?.querySelector('input') as HTMLInputElement | null)?.focus();
        if (solved.size === CROSSWORD.clues.length) {
          input.blur();
          audio.fanfare();
          hidden.classList.add('done');
          finish.hidden = false;
          toast(CROSSWORD.solved);
        }
      }
    };
    const hint = el('button', 'cw-hint', 'Pista');
    hint.onclick = () => {
      if (solved.has(i)) return;
      // Rellena la primera letra que falte o esté mal
      const v = norm(input.value).slice(0, c.answer.length);
      let k = 0;
      while (k < v.length && v[k] === c.answer[k]) k++;
      input.value = c.answer.slice(0, k + 1);
      input.dispatchEvent(new Event('input'));
    };
    boxes.onclick = () => input.focus();
    row.append(el('div', 'cw-clue', `${i + 1}. ${c.clue} <small>(${c.answer.length})</small>`), hint, boxes, input);
    rows.push(row);
    card.append(row);
  });
  const back = el('button', 'link-btn', 'Volver');
  back.onclick = onBack;
  o.append(card, finish, back);
  root.append(o);
}

export function finalLetter(onClose: () => void) {
  clearScreens();
  audio.fanfare();
  const o = el('div', 'screen letter-screen');
  const card = el('div', 'letter');
  const strip = el('div', 'polaroid-strip');
  LETTER_PHOTOS.forEach((src, i) => strip.append(polaroid({ level: 0, src, caption: '' }, [-6, 3, -2][i], false)));
  card.append(strip, el('div', 'hearts', '💙'), el('h2', '', FINAL_LETTER.title));
  for (const p of FINAL_LETTER.paragraphs) card.append(el('p', '', p));
  card.append(el('div', 'signature', FINAL_LETTER.signature), sticker(STICKERS.carita, 'letter-sticker'));
  const b = el('button', 'big-btn', 'Volver');
  b.onclick = onClose;
  o.append(card, b);
  root.append(o);
}

function sticker(src: string, cls: string) {
  const i = el('img', 'sticker ' + cls) as HTMLImageElement;
  i.src = src;
  i.alt = '';
  i.draggable = false;
  return i;
}

/** Foto del chat como polaroid con su pie escrito a mano. */
function polaroid(m: Memory, tilt: number, withCaption = true) {
  const f = el('figure', 'polaroid' + (m.sticker ? ' is-sticker' : ''));
  f.style.setProperty('--tilt', `${tilt}deg`);
  const img = el('img') as HTMLImageElement;
  img.src = m.src;
  img.alt = m.caption;
  img.draggable = false;
  img.decoding = 'async';
  f.append(img);
  if (withCaption) f.append(el('figcaption', '', m.caption));
  return f;
}

const TILTS = [-5, 4, -2, 6, -4];

/** Al acabar un capítulo: sus fotos caen sobre la mesa y pasan al álbum. */
export function memories(level: number, onClose: () => void) {
  const list = memoriesFor(level);
  if (!list.length) return onClose();
  clearScreens();
  const o = el('div', 'screen memories-screen');
  o.append(el('h1', '', 'Recuerdo desbloqueado 📸'));
  const table = el('div', 'polaroid-table');
  list.forEach((m, i) => {
    const p = polaroid(m, TILTS[i % TILTS.length]);
    p.style.animationDelay = `${0.15 + i * 0.25}s`;
    table.append(p);
  });
  const b = el('button', 'big-btn', 'Guardar en el álbum');
  b.onclick = onClose;
  o.append(table, b);
  root.append(o);
  audio.pop();
}

export function album(save: SaveData, test: boolean, onClose: () => void) {
  clearScreens();
  const o = el('div', 'screen memories-screen album');
  o.append(el('h1', '', 'Nuestro álbum'));
  const done = new Set(save.levelsDone);
  const grid = el('div', 'polaroid-table');
  MEMORIES.forEach((m, i) => {
    if (test || done.has(m.level)) grid.append(polaroid(m, TILTS[i % TILTS.length]));
    else {
      const f = el('figure', 'polaroid locked', `<div class="ph">?</div><figcaption>Capítulo ${m.level}</figcaption>`);
      f.style.setProperty('--tilt', `${TILTS[i % TILTS.length]}deg`);
      grid.append(f);
    }
  });
  const b = el('button', 'big-btn', 'Volver');
  b.onclick = onClose;
  o.append(grid, b);
  root.append(o);
}

function voucher(g: Gift, locked = false) {
  const v = el('div', 'voucher' + (locked ? ' locked' : ''));
  if (locked) {
    v.append(el('div', 'label', 'Bloqueado'), el('div', 'icon', '❔'), el('h2', '', '???'), el('p', '', 'Sigue jugando para descubrirlo.'));
  } else {
    v.append(el('div', 'label', 'Vale regalo'), el('div', 'icon', g.icon), el('h2', '', g.title), el('p', '', g.description), el('div', 'redeem', g.howToRedeem));
  }
  return v;
}

/** Confeti de papel por CSS sobre la interfaz. */
function cssConfetti(parent: HTMLElement, n = 70) {
  const colors = ['#d7263d', '#f4d35e', '#1b998b', '#2e86ab', '#ffffff', '#e2547a'];
  for (let i = 0; i < n; i++) {
    const c = el('i', 'confetto');
    c.style.left = `${50 + (Math.random() - 0.5) * 30}%`;
    c.style.background = colors[i % colors.length];
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 110}vw`);
    c.style.setProperty('--dy', `${-30 - Math.random() * 45}vh`);
    c.style.setProperty('--r', `${Math.random() * 1080 - 540}deg`);
    c.style.animationDelay = `${Math.random() * 0.15}s`;
    c.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    parent.append(c);
  }
}

/** Regalo: primero una caja que tiembla, al tocarla se abre con confeti y aparece el vale. */
export function showGift(g: Gift, onClose: () => void, result?: LevelResult) {
  clearScreens();
  const o = el('div', 'gift-overlay');
  const title = el('h1', 'gift-title', 'Tienes un regalo');
  const box = el('button', 'giftbox');
  box.append(el('div', 'lid'), el('div', 'base'), el('div', 'ribbon'));
  const tapHint = el('p', 'gift-hint', 'Toca la caja para abrirla');
  if (result) {
    const stars = el('div', 'stars');
    for (let i = 0; i < 3; i++) {
      const st = el('span', i < result.stars ? 'on' : '', '★');
      st.style.animationDelay = `${0.3 + i * 0.25}s`;
      stars.append(st);
    }
    const st = el('div', 'result-stats');
    for (const [k, v] of result.stats) st.append(el('div', '', `<span>${k}</span><b>${v}</b>`));
    o.append(el('div', 'result', ''), title);
    o.querySelector('.result')!.append(stars, st);
    setTimeout(() => result.stars > 0 && audio.pickup(), 300);
  } else o.append(title);
  o.append(box, tapHint);
  root.append(o);
  audio.fanfare();
  let opened = false;
  box.onclick = () => {
    if (opened) return;
    opened = true;
    box.classList.add('open');
    o.classList.add('opened');
    tapHint.remove();
    audio.pop();
    audio.cheer(0.35);
    vibrate([30, 40, 60]);
    cssConfetti(o);
    setTimeout(() => {
      box.remove();
      title.innerHTML = '¡Regalo desbloqueado!';
      const v = voucher(g);
      const b = el('button', 'big-btn', 'Guardar y seguir');
      b.onclick = () => {
        o.remove();
        onClose();
      };
      v.append(el('div', 'redeem', 'Haz una captura para tenerlo a mano 📸'), b);
      o.append(v);
    }, 650);
  };
}

/** Rótulo de capítulo a pantalla completa que se desvanece (tapa también la carga de la escena). */
export function chapterCard(n: number) {
  const lv = LEVELS[n - 1];
  const c = el('div', 'chapter-card');
  c.append(el('div', 'num', `Capítulo ${n}`), el('div', 'emoji', lv.emoji), el('h1', '', lv.name), el('div', 'place', lv.place));
  root.append(c);
  setTimeout(() => c.classList.add('out'), 2100);
  setTimeout(() => c.remove(), 3000);
}

/** Fundido a negro y vuelta (transiciones entre momentos de la historia). */
export function fadeFlash(mid: () => void, hold = 300) {
  const f = el('div', 'fade');
  root.append(f);
  requestAnimationFrame(() => f.classList.add('on'));
  setTimeout(() => {
    mid();
    setTimeout(() => {
      f.classList.remove('on');
      setTimeout(() => f.remove(), 500);
    }, hold);
  }, 450);
}

export function giftList(save: SaveData, onClose: () => void) {
  clearScreens();
  const o = el('div', 'gift-overlay');
  o.style.justifyContent = 'flex-start';
  o.append(el('h1', '', '<span style="color:white;font-size:26px">Mis regalos</span>'));
  const list = el('div', 'voucher-list');
  GIFTS.forEach((g) => list.append(voucher(g, !save.giftsUnlocked.includes(g.id))));
  o.append(list);
  const b = el('button', 'big-btn', 'Volver');
  b.onclick = () => {
    o.remove();
    onClose();
  };
  o.prepend(b);
  root.append(o);
}

export function toast(text: string) {
  const t = el('div', 'toast', text);
  root.append(t);
  setTimeout(() => t.remove(), 1900);
}

let cancelDialogue: (() => void) | null = null;
/** Cierra el diálogo abierto sin ejecutar su continuación (modo prueba). */
export function closeDialogue() {
  cancelDialogue?.();
  cancelDialogue = null;
}

/** Muestra una secuencia de líneas con efecto máquina de escribir. Toca para avanzar. */
export function dialogue(lines: Line[], onDone: () => void) {
  closeDialogue();
  const box = el('div', 'dialogue');
  const who = el('div', 'who');
  const text = el('div', 'text');
  box.append(who, text, el('div', 'next', 'toca para continuar ▸'));
  root.append(box);
  let i = 0;
  let shown = 0;
  let timer = 0;
  const show = () => {
    const ln = lines[i];
    who.textContent = ln.who;
    shown = 0;
    text.textContent = '';
    clearInterval(timer);
    timer = window.setInterval(() => {
      shown++;
      text.textContent = ln.text.slice(0, shown);
      if (shown % 3 === 0) audio.talk();
      if (shown >= ln.text.length) clearInterval(timer);
    }, 22);
  };
  const advance = () => {
    if (shown < lines[i].text.length) {
      shown = lines[i].text.length;
      text.textContent = lines[i].text;
      clearInterval(timer);
      return;
    }
    i++;
    if (i >= lines.length) {
      cancel();
      onDone();
    } else show();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') advance();
  };
  box.onpointerdown = (e) => {
    e.stopPropagation();
    advance();
  };
  const cancel = () => {
    clearInterval(timer);
    box.remove();
    window.removeEventListener('keydown', onKey);
    if (cancelDialogue === cancel) cancelDialogue = null;
  };
  cancelDialogue = cancel;
  window.addEventListener('keydown', onKey);
  show();
}

export interface DebugItem {
  label: string;
  run: () => void;
}

/** Botón 🛠 del modo prueba: saltar a cualquier fase del capítulo. */
export function debugPanel(items: DebugItem[]) {
  const btn = el('button', 'debug-btn', '🛠 Prueba');
  const list = el('div', 'debug-list');
  list.hidden = true;
  btn.onpointerdown = (e) => {
    e.stopPropagation();
    list.hidden = !list.hidden;
  };
  for (const it of items) {
    const b = el('button', '', it.label);
    b.onpointerdown = (e) => {
      e.stopPropagation();
      list.hidden = true;
      closeDialogue();
      it.run();
    };
    list.append(b);
  }
  root.append(btn, list);
  return () => {
    btn.remove();
    list.remove();
  };
}

export interface Hud {
  root: HTMLElement;
  setObjective(text: string): void;
  setArrow(angle: number | null): void;
  setCounters(html: string): void;
  setAction(label: string | null, pulse?: boolean): void;
  remove(): void;
}

export function hud(onAction: () => void, onMenu: () => void, hintText = 'Arrastra a la izquierda para andar · a la derecha para girar la cámara'): Hud {
  const top = el('div', 'hud-top');
  const obj = el('div', 'objective');
  const arrow = el('span', 'arrow', '⬆');
  const objText = el('span');
  obj.append(arrow, objText);
  const counters = el('div', 'counters');
  const mute = el('button', 'icon-btn', audio.muted ? '🔇' : '🔊');
  mute.onclick = () => {
    audio.setMuted(!audio.muted);
    mute.textContent = audio.muted ? '🔇' : '🔊';
  };
  const menu = el('button', 'icon-btn', '🗺️');
  menu.onclick = onMenu;
  top.append(obj, counters, el('div', 'spacer'), mute, menu);

  const act = el('button', 'action-btn hidden');
  act.onpointerdown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onAction();
  };
  const hint = el('div', 'hint-move', hintText);
  setTimeout(() => hint.remove(), 9000);
  root.append(top, act, hint);
  return {
    root: top,
    setObjective: (t) => (objText.textContent = t),
    setArrow: (a) => {
      arrow.style.visibility = a === null ? 'hidden' : 'visible';
      if (a !== null) arrow.style.transform = `rotate(${a}rad)`;
    },
    setCounters: (h) => (counters.innerHTML = h),
    setAction: (label, pulse) => {
      act.classList.toggle('hidden', !label);
      act.classList.toggle('pulse', !!pulse);
      if (label) act.textContent = label;
    },
    remove: () => {
      top.remove();
      act.remove();
      hint.remove();
    },
  };
}

export function rotateHint() {
  const r = el('div', 'rotate active', '<div class="phone">📱</div><div>Gira el móvil para jugar en horizontal</div>');
  r.style.pointerEvents = 'none';
  root.append(r);
}
