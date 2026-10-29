import { GIFTS, Gift } from '../data/gifts';
import { LEVELS, Line, FINAL_LETTER, CROSSWORD, type CrossClue } from '../data/story';
import { MINI_GAMES } from './minis';
import { audio } from '../core/audio';
import type { SaveData } from '../core/save';
import type { LevelResult } from '../world/level';
import { vibrate } from '../core/gfx';
import { MEMORIES, memoriesFor, STICKERS, LETTER_PHOTOS, Memory } from '../data/memories';
import type { ChatFrag } from '../data/chats';
import { cinema } from '../core/cinema';

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

/** Portada. Si se le pasa la carga, el botón espera (con porcentaje) a que todo esté listo, para que luego cada capítulo abra al momento. */
export function titleScreen(onStart: () => void, loading?: { done: Promise<unknown>; progress: () => number }) {
  clearScreens();
  const s = el('div', 'screen title-screen');
  s.append(
    el('div', 'eyebrow', 'De Gas, para ti'),
    el('h1', 'display', 'Feliz cumpleaños,<br><em>Azul</em>'),
    sticker(STICKERS.oso, 'title-sticker'),
    el('p', 'lead', 'Un pequeño juego sobre nuestra historia. Cada capítulo que completes desbloquea un regalo de verdad.'),
  );
  const b = el('button', 'big-btn', 'Empezar ▸') as HTMLButtonElement;
  b.onclick = () => {
    audio.unlock();
    onStart();
  };
  if (loading) {
    let ready = false;
    b.disabled = true;
    b.classList.add('loading');
    const tick = () => {
      if (ready || !b.isConnected) return;
      b.innerHTML = `Preparando… ${Math.round(loading.progress() * 100)}%`;
      b.style.setProperty('--p', `${loading.progress() * 100}%`);
      setTimeout(tick, 150);
    };
    tick();
    void loading.done.finally(() => {
      ready = true;
      b.disabled = false;
      b.classList.remove('loading');
      b.innerHTML = 'Empezar ▸';
    });
  }
  s.append(b, el('p', 'fine', 'Mejor con el móvil en horizontal y el sonido activado 🔊'));
  root.append(s);
}

export interface MapOptions {
  test: boolean;
  onPlay: (level: number) => void;
  /** La carta final (después del crucigrama). */
  onLetter: () => void;
  onReset: () => void;
}

/** Cumpleaños: el último capítulo se abre ese día y cada uno de los anteriores, un día antes. */
const BIRTHDAY = new Date(2026, 10, 28); // 28 de noviembre (en JavaScript los meses empiezan en 0)
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function openDay(i: number) {
  const d = new Date(BIRTHDAY);
  d.setDate(d.getDate() - (LEVELS.length - 1 - i));
  return d;
}

export function mapScreen(save: SaveData, opts: MapOptions) {
  clearScreens();
  const back = () => mapScreen(save, opts);
  const s = el('div', 'screen map-screen');
  if (opts.test) s.append(el('div', 'test-banner', '🛠 Modo prueba: todo desbloqueado'));
  s.append(el('div', 'eyebrow', `${save.levelsDone.length} de ${LEVELS.length} capítulos`), el('h1', 'display', 'Nuestra historia'));
  const list = el('div', 'levels');
  const done = new Set(save.levelsDone);
  LEVELS.forEach((lv, i) => {
    const day = openDay(i);
    const early = Date.now() < day.getTime();
    const unlocked = opts.test || (!early && (i === 0 || done.has(LEVELS[i - 1].id)));
    const card = el('button', 'level-card' + (unlocked ? '' : ' locked'));
    const state = done.has(lv.id)
      ? '✓ Completado'
      : unlocked
        ? '<span class="blink">▶</span> Jugar'
        : early
          ? `🔒 Se abre el ${day.getDate()} de ${MONTHS[day.getMonth()]}`
          : '🔒 Termina el anterior';
    if (done.has(lv.id)) card.classList.add('done');
    card.append(el('div', 'num', String(lv.id).padStart(2, '0')), el('div', 'emoji', lv.emoji), el('div', 'name', lv.name), el('div', 'place', lv.place), el('div', 'state', state));
    if (unlocked) card.onclick = () => opts.onPlay(lv.id);
    list.append(card);
  });
  const allDone = opts.test || LEVELS.every((l) => done.has(l.id));
  const fin = el('button', 'level-card final' + (allDone ? '' : ' locked'));
  fin.append(el('div', 'num', '♥'), el('div', 'emoji', '💌'), el('div', 'name', 'La sorpresa final'), el('div', 'place', 'Cuando termines todos los capítulos'), el('div', 'state', allDone ? '▶ Abrir' : '🔒 Bloqueado'));
  if (allDone) fin.onclick = () => crossword(opts.onLetter, back);
  list.append(fin);
  s.append(list);
  const g = el('button', 'link-btn', `🎁 Mis regalos (${save.giftsUnlocked.length}/${GIFTS.length})`);
  g.onclick = () => giftList(save, back);
  const seen = MEMORIES.filter((m) => opts.test || done.has(m.level)).length;
  const a = el('button', 'link-btn', `📷 Nuestro álbum (${seen}/${MEMORIES.length})`);
  a.onclick = () => album(save, opts.test, back);
  const games = MINI_GAMES.filter((m) => opts.test || done.has(m.chapter));
  const mg = el('button', 'link-btn', `🎮 Minijuegos (${games.length}/${MINI_GAMES.length})`);
  mg.onclick = () => miniList(save, opts.test, back);
  const links = el('div', 'link-row');
  links.append(g, a, mg);
  s.append(links);
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

/** Crucigrama de verdad antes de la carta: casillas cruzadas, y las del círculo forman el mensaje. */
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
  const clues = CROSSWORD.clues;
  // Numeración clásica: por orden de lectura de las casillas donde empieza alguna palabra
  const starts = [...new Set(clues.map((c) => c.row * 100 + c.col))].sort((x, y) => x - y);
  const num = (c: CrossClue) => starts.indexOf(c.row * 100 + c.col) + 1;
  const cellsOf = (c: CrossClue) => [...c.answer].map((_, k) => (c.dir === 'A' ? [c.row, c.col + k] : [c.row + k, c.col]) as [number, number]);
  const key = (r: number, c: number) => r * 100 + c;
  const cells = new Map<number, { div: HTMLElement; ch: string; words: number[]; val: string; mark: boolean }>();
  const grid = el('div', 'cw-grid');
  grid.style.setProperty('--cols', String(CROSSWORD.cols));
  grid.style.setProperty('--rows', String(CROSSWORD.rows));
  clues.forEach((c, wi) =>
    cellsOf(c).forEach(([r, col], k) => {
      let cell = cells.get(key(r, col));
      if (!cell) {
        const div = el('div', 'cw-c');
        div.style.gridRow = String(r + 1);
        div.style.gridColumn = String(col + 1);
        grid.append(div);
        cell = { div, ch: c.answer[k], words: [], val: '', mark: false };
        cells.set(key(r, col), cell);
      }
      cell.words.push(wi);
      if (k === c.mark) {
        cell.mark = true;
        cell.div.classList.add('mark');
      }
    }),
  );
  for (const n of starts) {
    const c = cells.get(n)!;
    c.div.append(el('i', 'cw-n', String(starts.indexOf(n) + 1)));
  }
  for (const c of cells.values()) c.div.append(el('b', 'cw-v'));
  const bar = el('div', 'cw-bar');
  const input = el('input', 'cw-key') as HTMLInputElement;
  input.autocapitalize = 'characters';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Escribe aquí');
  const list = el('div', 'cw-list');
  const items: HTMLElement[] = [];
  for (const dir of ['A', 'D'] as const) {
    const col = el('div', 'cw-col', `<h3>${dir === 'A' ? 'Horizontales' : 'Verticales'}</h3>`);
    clues
      .map((c, i) => ({ c, i }))
      .filter((x) => x.c.dir === dir)
      .sort((x, y) => num(x.c) - num(y.c))
      .forEach(({ c, i }) => {
        const it = el('button', 'cw-item', `<b>${num(c)}</b> ${c.clue} <small>(${c.answer.length})</small>`);
        it.onclick = () => select(i, 0);
        items[i] = it;
        col.append(it);
      });
    list.append(col);
  }
  const solved = new Set<number>();
  let cur = 0;
  let pos = 0;
  const paint = () => {
    for (const c of cells.values()) {
      c.div.classList.remove('sel', 'cur');
      (c.div.querySelector('.cw-v') as HTMLElement).textContent = c.val;
    }
    cellsOf(clues[cur]).forEach(([r, c], k) => {
      const cell = cells.get(key(r, c))!;
      cell.div.classList.add('sel');
      if (k === pos) cell.div.classList.add('cur');
    });
    items.forEach((it, i) => it.classList.toggle('on', i === cur));
    const c = clues[cur];
    bar.innerHTML = `<b>${num(c)} ${c.dir === 'A' ? '→' : '↓'}</b> ${c.clue}`;
  };
  const select = (wi: number, k: number) => {
    cur = wi;
    pos = Math.max(0, Math.min(clues[wi].answer.length - 1, k));
    paint();
    input.focus({ preventScroll: true });
  };
  for (const [k, cell] of cells) {
    cell.div.onclick = () => {
      const r = Math.floor(k / 100);
      const c = k % 100;
      // Si la casilla es de dos palabras, tocarla otra vez cambia de sentido
      const opts = cell.words;
      const wi = opts.includes(cur) && opts.length > 1 && cellsOf(clues[cur]).some(([rr, cc], j) => rr === r && cc === c && j === pos) ? opts.find((w) => w !== cur)! : opts.includes(cur) ? cur : opts[0];
      const idx = cellsOf(clues[wi]).findIndex(([rr, cc]) => rr === r && cc === c);
      select(wi, idx);
    };
  }
  const check = () => {
    clues.forEach((c, wi) => {
      if (solved.has(wi)) return;
      const ok = cellsOf(c).every(([r, col], k) => cells.get(key(r, col))!.val === c.answer[k]);
      if (!ok) return;
      solved.add(wi);
      cellsOf(c).forEach(([r, col]) => cells.get(key(r, col))!.div.classList.add('ok'));
      items[wi].classList.add('ok');
      if (c.hiddenIdx >= 0) {
        slots[c.hiddenIdx].textContent = c.answer[c.mark];
        slots[c.hiddenIdx].classList.add('on');
      }
      audio.chime(solved.size % 8);
      vibrate(30);
    });
    if (solved.size === clues.length) {
      input.blur();
      audio.fanfare();
      hidden.classList.add('done');
      finish.hidden = false;
      toast(CROSSWORD.solved);
    }
  };
  const write = (ch: string) => {
    const [r, c] = cellsOf(clues[cur])[pos];
    const cell = cells.get(key(r, c))!;
    if (!cell.div.classList.contains('ok')) cell.val = ch;
    audio.talk();
    if (pos < clues[cur].answer.length - 1) pos++;
    paint();
    check();
  };
  input.oninput = () => {
    const v = norm(input.value);
    input.value = '';
    for (const ch of v) if (/[A-ZÑ]/.test(ch)) write(ch);
  };
  input.onkeydown = (e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const [r, c] = cellsOf(clues[cur])[pos];
      const cell = cells.get(key(r, c))!;
      if (cell.val && !cell.div.classList.contains('ok')) cell.val = '';
      else if (pos > 0) {
        pos--;
        const [r2, c2] = cellsOf(clues[cur])[pos];
        const c2c = cells.get(key(r2, c2))!;
        if (!c2c.div.classList.contains('ok')) c2c.val = '';
      }
      paint();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') select(cur, pos + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') select(cur, pos - 1);
  };
  const hint = el('button', 'cw-hint', '💡 Pista');
  hint.onclick = () => {
    // Pone la primera letra que falte o esté mal de la palabra elegida
    const c = clues[cur];
    const k = cellsOf(c).findIndex(([r, col], j) => cells.get(key(r, col))!.val !== c.answer[j]);
    if (k < 0) return;
    pos = k;
    write(c.answer[k]);
  };
  const finish = el('button', 'big-btn', 'Abrir la carta 💌');
  finish.hidden = true;
  finish.onclick = onSolved;
  const tools = el('div', 'cw-tools');
  tools.append(bar, hint);
  card.append(hidden, tools, grid, input, list);
  const back = el('button', 'link-btn', 'Volver');
  back.onclick = onBack;
  o.append(card, finish, back);
  root.append(o);
  paint();
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
  const f = el('figure', 'polaroid' + (m.sticker ? ' is-sticker' : '') + (m.chat ? ' is-chat' : '') + (m.pending ? ' is-pending' : ''));
  f.style.setProperty('--tilt', `${tilt}deg`);
  if (m.chat) {
    const c = el('div', 'mini-chat');
    for (const msg of m.chat) {
      c.append(el('div', 'bubble' + (msg.me ? ' me' : ''), `<span class="bt">${msg.text}</span><span class="bm">${msg.t}</span>`));
    }
    f.append(c);
  } else if (m.pending || !m.src) {
    f.append(el('div', 'photo-slot', '📷<br><small>Foto pendiente</small>'));
  } else {
    const img = el('img') as HTMLImageElement;
    img.src = m.src;
    img.alt = m.caption;
    img.draggable = false;
    img.decoding = 'async';
    f.append(img);
  }
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

export function miniList(save: SaveData, test: boolean, onClose: () => void) {
  clearScreens();
  const back = () => miniList(save, test, onClose);
  const o = el('div', 'screen memories-screen album');
  o.append(el('h1', '', 'Minijuegos'));
  const done = new Set(save.levelsDone);
  const list = el('div', 'levels');
  MINI_GAMES.forEach((m) => {
    const open = test || done.has(m.chapter);
    const card = el('button', 'level-card' + (open ? '' : ' locked'));
    card.append(el('div', 'emoji', m.icon), el('div', 'name', open ? m.title : '???'), el('div', 'place', `Capítulo ${m.chapter}`), el('div', 'state', open ? '▶ Jugar' : '🔒 Bloqueado'));
    if (open) card.onclick = () => m.run(back);
    list.append(card);
  });
  const b = el('button', 'big-btn', 'Volver');
  b.onclick = onClose;
  o.append(list, b);
  root.append(o);
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
/** Rótulo del capítulo. Tapa la pantalla mientras el capítulo se monta y compila; se va cuando pasan 2 s y está listo. */
export function chapterCard(n: number, ready: Promise<unknown> = Promise.resolve()) {
  const lv = LEVELS[n - 1];
  const c = el('div', 'chapter-card');
  c.append(el('div', 'num', `Capítulo ${n}`), el('div', 'emoji', lv.emoji), el('h1', '', lv.name), el('div', 'place', lv.place));
  root.append(c);
  const minTime = new Promise((r) => setTimeout(r, 2100));
  // Por si algo falla al montar el capítulo, el rótulo nunca se queda más de 8 s
  const safe = Promise.race([ready.catch(() => {}), new Promise((r) => setTimeout(r, 8000))]);
  void Promise.all([minTime, safe]).then(() => {
    c.classList.add('out');
    setTimeout(() => c.remove(), 900);
  });
}

/** Fundido a negro y vuelta (transiciones entre momentos de la historia). */
export function fadeFlash(mid: () => void, hold = 300) {
  const f = el('div', 'fade');
  root.append(f);
  requestAnimationFrame(() => f.classList.add('on'));
  const e = epoch;
  setTimeout(() => {
    if (e === epoch) mid();
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

// Cada vez que se entra o se sale de un capítulo cambia la "época": los temporizadores
// del capítulo anterior que sigan pendientes ya no hacen nada (ni diálogos sueltos en el mapa
// ni capítulos que se completan solos).
let epoch = 0;
export function newEpoch() {
  epoch++;
  root.querySelectorAll('.gauge, .phone-overlay, .fade, .toast').forEach((n) => n.remove());
}
/** setTimeout que no se dispara si mientras tanto se ha salido del capítulo. */
export function later(fn: () => void, ms: number) {
  const e = epoch;
  return window.setTimeout(() => e === epoch && fn(), ms);
}

/** Dónde está en pantalla la cabeza de quien habla (en píxeles), o null si no se le ve. Lo pone main.ts. */
let speakerAt: (who: string) => { x: number; y: number } | null = () => null;
export function setSpeakerResolver(fn: typeof speakerAt) {
  speakerAt = fn;
}

const whoClass = (who: string) =>
  who === 'Narrador' ? 'who-narr' : /^(Azul|Margaux)$/.test(who) ? 'who-azul' : /^(Gas|Marc)$/.test(who) ? 'who-gas' : 'who-other';

/**
 * Muestra una secuencia de líneas con efecto máquina de escribir. Toca en cualquier sitio para avanzar.
 * El narrador habla en la caja de abajo; los personajes que se ven en pantalla, en un bocadillo sobre la cabeza.
 */
export function dialogue(lines: Line[], onDone: () => void) {
  closeDialogue();
  const box = el('div', 'dialogue');
  const who = el('div', 'who');
  const text = el('div', 'text');
  box.append(who, text, el('div', 'next', '▼'));
  const catcher = el('div', 'dialogue-catch');
  root.append(catcher, box);
  let i = 0;
  let shown = 0;
  let timer = 0;
  let raf = 0;
  // Las líneas que empiezan por «(WhatsApp)» se pintan como un mensaje del móvil
  const WA = '(WhatsApp) ';
  const body = (ln: Line) => (ln.text.startsWith(WA) ? ln.text.slice(WA.length) : ln.text);
  // Coloca el bocadillo sobre la cabeza de quien habla, sin salirse de la pantalla
  const place = () => {
    raf = requestAnimationFrame(place);
    const ln = lines[i];
    const at = ln && !ln.text.startsWith(WA) && ln.who !== 'Narrador' ? speakerAt(ln.who) : null;
    const W = window.innerWidth;
    if (at && at.y > 70) {
      box.classList.add('speech');
      const w = box.offsetWidth, h = box.offsetHeight;
      const left = Math.min(Math.max(at.x - w / 2, 12), W - w - 12);
      const top = Math.max(at.y - h - 18, 8);
      box.style.setProperty('--bx', `${left}px`);
      box.style.setProperty('--by', `${top}px`);
      box.style.setProperty('--tail', `${Math.min(Math.max(at.x - left, 22), w - 22)}px`);
    } else box.classList.remove('speech');
  };
  const show = () => {
    const ln = lines[i];
    const wa = ln.text.startsWith(WA);
    box.className = `dialogue ${whoClass(ln.who)}` + (wa ? ' wa' : '');
    who.textContent = wa ? `📱 ${ln.who}` : ln.who;
    const full = body(ln);
    shown = 0;
    text.textContent = '';
    clearInterval(timer);
    timer = window.setInterval(() => {
      shown++;
      text.textContent = full.slice(0, shown);
      if (shown % 3 === 0) audio.talk();
      if (shown >= full.length) clearInterval(timer);
    }, 22);
  };
  const advance = () => {
    // Un segundo toque que llega cuando el diálogo ya ha terminado no hace nada
    if (i >= lines.length) return;
    const full = body(lines[i]);
    if (shown < full.length) {
      shown = full.length;
      text.textContent = full;
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
  box.onpointerdown = catcher.onpointerdown = (e) => {
    e.stopPropagation();
    advance();
  };
  const cancel = () => {
    clearInterval(timer);
    cancelAnimationFrame(raf);
    box.remove();
    catcher.remove();
    window.removeEventListener('keydown', onKey);
    if (cancelDialogue === cancel) cancelDialogue = null;
  };
  cancelDialogue = cancel;
  window.addEventListener('keydown', onKey);
  show();
  place();
}

export interface GaugeZone {
  /** Hasta dónde llega la zona (0-1); empieza donde acaba la anterior. */
  to: number;
  label: string;
  color: string;
  good?: boolean;
}

export interface GaugeOptions {
  title: string;
  zones: GaugeZone[];
  /** Segundos que tarda la aguja en recorrer la barra entera. */
  duration: number;
  button: string;
  /** Botón trampa que aparece a ratos (la nata). */
  trap?: { label: string; onPress: () => void };
}

/**
 * Minijuego de punto justo: la aguja avanza por la barra y hay que tocar cuando está en la zona buena.
 * Devuelve la calidad (1 = en el centro de la zona buena, 0.6 = en el borde, 0 = fuera) y la zona.
 */
export function timingGauge(o: GaugeOptions, onResult: (quality: number, zone: GaugeZone) => void) {
  const w = el('div', 'gauge');
  w.append(el('div', 'gauge-title', o.title));
  const bar = el('div', 'gauge-bar');
  let from = 0;
  for (const z of o.zones) {
    const seg = el('div', 'gauge-seg' + (z.good ? ' good' : ''), `<span>${z.label}</span>`);
    seg.style.left = `${from * 100}%`;
    seg.style.width = `${(z.to - from) * 100}%`;
    seg.style.background = z.color;
    bar.append(seg);
    from = z.to;
  }
  const needle = el('div', 'gauge-needle');
  bar.append(needle);
  const btn = el('button', 'big-btn gauge-btn', o.button);
  w.append(bar, btn);
  let trap: HTMLButtonElement | null = null;
  if (o.trap) {
    trap = el('button', 'gauge-trap', o.trap.label) as HTMLButtonElement;
    trap.hidden = true;
    trap.onpointerdown = (e) => {
      e.stopPropagation();
      trap!.hidden = true;
      o.trap!.onPress();
    };
    w.append(trap);
  }
  root.append(w);
  let t0 = performance.now();
  // Si el móvil se va a segundo plano, la aguja se para en vez de contar como fallo
  let hiddenAt = 0;
  const onVis = () => {
    if (document.hidden) hiddenAt = performance.now();
    else if (hiddenAt) {
      t0 += performance.now() - hiddenAt;
      hiddenAt = 0;
    }
  };
  document.addEventListener('visibilitychange', onVis);
  let done = false;
  let raf = 0;
  let resultTimer = 0;
  const zoneAt = (x: number) => o.zones.find((z) => x <= z.to) ?? o.zones[o.zones.length - 1];
  const finish = (x: number) => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVis);
    const z = zoneAt(x);
    let q = 0;
    if (z.good) {
      const i = o.zones.indexOf(z);
      const a = i === 0 ? 0 : o.zones[i - 1].to;
      const mid = (a + z.to) / 2;
      q = 1 - (Math.abs(x - mid) / ((z.to - a) / 2)) * 0.4;
    }
    w.classList.add(q > 0 ? 'hit' : 'miss');
    vibrate(q > 0 ? 25 : [40, 30, 40]);
    resultTimer = later(() => {
      w.remove();
      onResult(q, z);
    }, 650);
  };
  const tick = () => {
    const x = Math.min(1, (performance.now() - t0) / 1000 / o.duration);
    needle.style.left = `${x * 100}%`;
    if (trap) trap.hidden = !(Math.sin(x * 19) > 0.55);
    if (x >= 1) finish(1);
    else raf = requestAnimationFrame(tick);
  };
  btn.onpointerdown = (e) => {
    e.stopPropagation();
    finish(Math.min(1, (performance.now() - t0) / 1000 / o.duration));
  };
  raf = requestAnimationFrame(tick);
  return () => {
    done = true;
    cancelAnimationFrame(raf);
    clearTimeout(resultTimer);
    document.removeEventListener('visibilitychange', onVis);
    w.remove();
  };
}

/** Pantalla de móvil con un chat de WhatsApp que se va escribiendo. Toca para cerrar al final. */
/**
 * WhatsApp en pantalla: uno o varios fragmentos literales del chat, mensaje a mensaje.
 * Tocar enseña el siguiente al momento; «Saltar» los enseña todos.
 */
export function phoneChat(input: ChatFrag | ChatFrag[], onDone: () => void) {
  const frags = Array.isArray(input) ? input : [input];
  const o = el('div', 'phone-overlay');
  const ph = el('div', 'phone');
  const contact = frags[0].contact;
  ph.append(
    el('div', 'phone-bar', `<span class="pb-back">‹</span><span class="pb-avatar">${contact[0]}</span><span class="pb-name"><b>${contact}</b><small>en línea</small></span><span class="pb-icons">📹 📞</span>`),
  );
  const chat = el('div', 'phone-chat');
  ph.append(chat);
  const skip = el('button', 'phone-skip', 'Saltar ⏭');
  const hint = el('div', 'phone-hint', 'Toca para seguir');
  o.append(ph, hint, skip);
  root.append(o);
  type Item = { kind: 'date'; text: string } | { kind: 'msg'; me: boolean; t: string; text: string; first: boolean };
  const items: Item[] = [];
  for (const f of frags) {
    items.push({ kind: 'date', text: f.date });
    let prev: boolean | null = null;
    for (const m of f.msgs) {
      items.push({ kind: 'msg', me: m.me, t: m.t, text: m.text, first: prev !== m.me });
      prev = m.me;
    }
  }
  let i = 0;
  let timer = 0;
  let typing: HTMLElement | null = null;
  const done = () => i >= items.length;
  const scroll = () => (chat.scrollTop = chat.scrollHeight);
  const show = (it: Item) => {
    if (it.kind === 'date') chat.append(el('div', 'chat-date', it.text));
    else {
      const b = el('div', 'bubble' + (it.me ? ' me' : '') + (it.first ? ' first' : ''), `<span class="bt">${it.text}</span><span class="bm">${it.t}${it.me ? ' <i class="ticks">✓✓</i>' : ''}</span>`);
      chat.append(b);
    }
  };
  const step = () => {
    clearTimeout(timer);
    typing?.remove();
    typing = null;
    if (done()) return finish();
    show(items[i++]);
    audio.pop();
    scroll();
    if (done()) return finish();
    const nx = items[i];
    if (nx.kind === 'msg' && !nx.me) {
      typing = el('div', 'bubble typing', '<i></i><i></i><i></i>');
      chat.append(typing);
      scroll();
    }
    // Ritmo de lectura: lo justo para leer cada mensaje, sin esperas largas entre uno y otro
    timer = window.setTimeout(step, nx.kind === 'date' ? 400 : 420 + Math.min(700, (nx.kind === 'msg' ? nx.text.length : 0) * 9));
  };
  const finish = () => {
    clearTimeout(timer);
    typing?.remove();
    hint.textContent = 'Toca para continuar ▸';
    hint.classList.add('ready');
    skip.hidden = true;
  };
  skip.onpointerdown = (e) => {
    e.stopPropagation();
    while (!done()) show(items[i++]);
    scroll();
    finish();
  };
  o.onpointerdown = (e) => {
    e.stopPropagation();
    if (!done()) return step();
    if (!hint.classList.contains('ready')) return;
    clearTimeout(timer);
    o.remove();
    onDone();
  };
  timer = window.setTimeout(step, 350);
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
    // Con click (no pointerdown): si no, el toque "fantasma" cae en lo que aparezca debajo, p. ej. el mapa
    b.onpointerdown = (e) => e.stopPropagation();
    b.onclick = (e) => {
      e.stopPropagation();
      list.hidden = true;
      // Saltar de fase cierra lo que hubiera abierto (chats, barras, minijuegos, escenas de cine) y anula sus temporizadores
      cinema.stop();
      closeDialogue();
      newEpoch();
      clearScreens();
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
