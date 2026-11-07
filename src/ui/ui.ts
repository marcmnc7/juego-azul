import { GIFTS, Gift } from '../data/gifts';
import { LEVELS, Line, FINAL_LETTER, CROSSWORD, type CrossClue } from '../data/story';
import { MINI_GAMES } from './minis';
import { audio } from '../core/audio';
import type { SaveData } from '../core/save';
import type { LevelResult } from '../world/level';
import { vibrate } from '../core/gfx';
import { MEMORIES, memoriesFor, STICKERS, LETTER_PHOTOS, Memory } from '../data/memories';
import { KEEPSAKES, keepsakesFor, QUIZ, TEASERS, type Keepsake } from '../data/extras';
import type { ChatFrag } from '../data/chats';
import { cinema } from '../core/cinema';
import { stage } from '../core/stage';

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

/**
 * Modo prueba sin tocar la dirección (la app instalada no deja añadir #test): cinco toques seguidos en el
 * elemento lo encienden o lo apagan, y se queda guardado en este navegador o en esta app.
 */
function testTaps(target: HTMLElement) {
  let taps: number[] = [];
  target.onpointerdown = () => {
    const now = performance.now();
    taps = [...taps.filter((t) => now - t < 2500), now];
    if (taps.length < 5) return;
    taps = [];
    let on = false;
    try {
      on = localStorage.getItem('margaux-test') !== '1';
      if (on) localStorage.setItem('margaux-test', '1');
      else localStorage.removeItem('margaux-test');
    } catch {
      return;
    }
    toast(on ? '🛠 Modo prueba activado' : 'Modo prueba desactivado');
    setTimeout(() => location.reload(), 900);
  };
}

/**
 * En el navegador del móvil no se juega: se pide abrirlo desde la pantalla de inicio (a pantalla completa, sin
 * barras y sin conexión). Con el modo prueba se puede seguir en el navegador.
 */
export function installGate(ios: boolean) {
  clearScreens();
  const s = el('div', 'screen install-gate');
  const eyebrow = el('div', 'eyebrow', 'De Gas, para ti');
  testTaps(eyebrow);
  const steps = ios
    ? [
        ['1', 'Toca <b>Compartir</b> <span class="ig-icon">⎋</span> abajo en Safari'],
        ['2', 'Elige <b>Añadir a pantalla de inicio</b> <span class="ig-icon">＋</span>'],
        ['3', 'Ábrelo desde el icono del <b>osito</b> 🐻'],
      ]
    : [
        ['1', 'Abre el menú <b>⋮</b> del navegador'],
        ['2', 'Elige <b>Añadir a pantalla de inicio</b> o <b>Instalar</b>'],
        ['3', 'Ábrelo desde el icono del <b>osito</b> 🐻'],
      ];
  const list = el('div', 'ig-steps');
  for (const [n, t] of steps) list.append(el('div', 'ig-step', `<span class="ig-n">${n}</span><span>${t}</span>`));
  s.append(
    eyebrow,
    el('h1', 'display', 'Para<br><em>Azul</em>'),
    sticker(STICKERS.oso, 'title-sticker'),
    el('p', 'lead', 'Este juego se abre desde la pantalla de inicio: así va a pantalla completa y sin barras.'),
    list,
    el('p', 'fine', 'Solo hay que hacerlo una vez.'),
  );
  root.append(s);
}

/**
 * Calendario de adviento de la portada: los nueve días (del 20 al 28 de noviembre), hechos, el de hoy y los que
 * faltan, y debajo la cuenta atrás en vivo hasta el siguiente capítulo.
 */
function adventCalendar(save: SaveData) {
  const wrap = el('div', 'advent');
  const row = el('div', 'advent-days');
  const done = new Set(save.levelsDone);
  const nextI = LEVELS.findIndex((l) => !done.has(l.id));
  const today = new Date();
  LEVELS.forEach((lv, i) => {
    const d = openDay(i);
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    const cls = done.has(lv.id) ? ' done' : i === nextI && Date.now() >= d.getTime() ? ' ready' : Date.now() >= d.getTime() ? ' open' : '';
    const t = el('div', 'advent-day' + cls + (isToday ? ' today' : '') + (i === LEVELS.length - 1 ? ' last' : ''), `<b>${d.getDate()}</b><span>${done.has(lv.id) ? '✓' : i === LEVELS.length - 1 ? '🎂' : Date.now() >= d.getTime() ? lv.emoji : '🔒'}</span>`);
    row.append(t);
  });
  const line = el('div', 'advent-count');
  wrap.append(row, line);
  const tick = () => {
    if (!wrap.isConnected) return;
    line.innerHTML = countdownLine(save);
    setTimeout(tick, 1000);
  };
  // (primero se pinta, luego se engancha a la portada)
  line.innerHTML = countdownLine(save);
  setTimeout(tick, 1000);
  return wrap;
}

/** «El capítulo 4 se abre en 2 días, 5 h y 13 min», «¡Hoy toca el capítulo 4!», o la sorpresa final. */
function countdownLine(save: SaveData) {
  const done = new Set(save.levelsDone);
  const i = LEVELS.findIndex((l) => !done.has(l.id));
  if (i < 0) return '💌 Todo completado: te espera la sorpresa final';
  const d = openDay(i);
  const ms = d.getTime() - Date.now();
  const lv = LEVELS[i];
  if (ms <= 0) return i > 0 && !done.has(LEVELS[i - 1].id) ? `Te queda pendiente el capítulo ${i}` : `<b>¡Ya puedes jugar el capítulo ${lv.id}!</b>`;
  const sec = Math.floor(ms / 1000);
  const dd = Math.floor(sec / 86400), hh = Math.floor((sec % 86400) / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const left = dd > 0 ? `${dd} ${dd === 1 ? 'día' : 'días'}, ${hh} h y ${mm} min` : `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  return `${i === 0 ? 'El primer capítulo' : `El capítulo ${lv.id}`} se abre en <b>${left}</b>`;
}

/** Portada. Si se le pasa la carga, el botón espera (con porcentaje) a que todo esté listo, para que luego cada capítulo abra al momento. */
export function titleScreen(onStart: () => void, loading?: { done: Promise<unknown>; progress: () => number }, save?: SaveData) {
  clearScreens();
  const s = el('div', 'screen title-screen');
  const eyebrow = el('div', 'eyebrow', 'De Gas, para ti');
  testTaps(eyebrow);
  s.append(
    eyebrow,
    el('h1', 'display', 'Para<br><em>Azul</em>'),
    sticker(STICKERS.oso, 'title-sticker'),
    el('p', 'lead', 'Un pequeño juego sobre nuestra historia. Cada capítulo que completes desbloquea un regalo de verdad.'),
  );
  if (save) s.append(adventCalendar(save));
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
  s.append(b, el('p', 'fine', 'Con el sonido activado 🔊'));
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

type Tab = 'story' | 'album' | 'gifts' | 'games';
let lastTab: Tab = 'story';

/** Hoja que sube desde abajo (detalles, ajustes): se cierra tocando fuera, con ✕ o deslizando hacia abajo. */
function sheet(build: (body: HTMLElement, close: () => void) => void, cls = '') {
  const back = el('div', 'ap-sheet-back');
  const sh = el('div', 'ap-sheet ' + cls);
  const grab = el('div', 'ap-grab');
  const x = el('button', 'ap-x', '✕');
  x.setAttribute('aria-label', 'Cerrar');
  const body = el('div', 'ap-sheet-body');
  sh.append(grab, x, body);
  back.append(sh);
  root.append(back);
  requestAnimationFrame(() => back.classList.add('on'));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    back.classList.remove('on');
    setTimeout(() => back.remove(), 260);
  };
  back.onclick = (e) => e.target === back && close();
  x.onclick = close;
  // Deslizar hacia abajo desde el asa
  let y0: number | null = null;
  grab.onpointerdown = (e) => {
    y0 = e.clientY;
    grab.setPointerCapture(e.pointerId);
  };
  grab.onpointerup = (e) => {
    if (y0 !== null && e.clientY - y0 > 50) close();
    y0 = null;
  };
  build(body, close);
  return close;
}

type Shot = { src?: string; chat?: Memory['chat']; caption: string; sticker?: boolean; level: number };
/**
 * Final de un capítulo, en una sola pantalla: estrellas y números, el regalo (una caja que hay que abrir), las
 * fotos que pasan al álbum y lo que viene mañana. Un único botón abajo para seguir.
 */
export function chapterComplete(n: number, result: LevelResult | undefined, gift: Gift | null, nextTeaser: number | null, onClose: () => void) {
  clearScreens();
  const o = el('div', 'screen app-screen done-screen');
  const body = el('main', 'ap-body');
  body.append(el('div', 'ap-kicker center', `Capítulo ${n} · ${LEVELS[n - 1].name}`), el('h1', 'gift-title', '¡Capítulo superado!'));
  if (result) body.append(resultBlock(result));
  const btn = el('button', 'big-btn ap-play', 'Seguir ▸');
  let giftOpen = !gift;
  if (gift) {
    const card = el('section', 'ap-card gift-card');
    card.append(el('div', 'ap-kicker', 'Tienes un regalo'));
    const box = el('button', 'giftbox');
    box.append(el('div', 'lid'), el('div', 'base'), el('div', 'ribbon'));
    const hint = el('p', 'gift-hint', 'Toca la caja para abrirla');
    card.append(box, hint);
    const open = () => {
      if (giftOpen) return;
      giftOpen = true;
      box.classList.add('open');
      hint.remove();
      audio.pop();
      audio.cheer(0.35);
      vibrate([30, 40, 60]);
      cssConfetti(o);
      setTimeout(() => {
        box.remove();
        card.querySelector('.ap-kicker')!.textContent = '¡Regalo desbloqueado!';
        const v = voucher(gift);
        v.append(el('div', 'redeem', 'Haz una captura para tenerlo a mano 📸 · también está en Regalos'));
        card.append(v);
        btn.textContent = 'Seguir ▸';
      }, 650);
    };
    box.onclick = open;
    btn.textContent = '🎁 Abrir el regalo';
    body.append(card);
  }
  const photos: Shot[] = memoriesFor(n);
  if (photos.length) {
    const card = el('section', 'ap-card');
    card.append(el('div', 'ap-kicker', `${photos.length === 1 ? 'Una foto' : `${photos.length} fotos`} para el álbum`));
    const strip = el('div', 'ap-strip');
    photos.forEach((m, i) => {
      const t = el('button', 'ap-photo');
      t.append(thumb(m), el('span', 'ap-photo-cap', m.caption));
      t.style.animationDelay = `${0.2 + i * 0.15}s`;
      t.onclick = () => lightbox(photos, i);
      strip.append(t);
    });
    card.append(strip);
    body.append(card);
  }
  if (nextTeaser && TEASERS[nextTeaser]) {
    const lv = LEVELS[nextTeaser - 1];
    const card = el('section', 'ap-card teaser-card');
    const d = openDay(nextTeaser - 1);
    const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(new Date().setHours(0, 0, 0, 0)).getTime()) / 86400000);
    card.append(el('div', 'ap-kicker', `Capítulo ${nextTeaser} · ${days <= 0 ? 'ya se puede jugar' : days === 1 ? 'mañana' : `el ${d.getDate()} de ${MONTHS[d.getMonth()]}`}`), el('div', 'teaser-row', `<span class="teaser-emoji">${lv.emoji}</span><span class="teaser-hint">«${TEASERS[nextTeaser]}»</span>`));
    body.append(card);
  }
  const foot = el('div', 'ap-foot');
  foot.append(btn);
  btn.onclick = () => {
    if (!giftOpen) return (o.querySelector('.giftbox') as HTMLButtonElement | null)?.click();
    onClose();
  };
  o.append(body, foot);
  root.append(o);
  audio.fanfare();
  cssConfetti(o, 40);
}

/** Visor de fotos a pantalla completa: deslizar o flechas para pasar, tocar fuera para cerrar. */
function lightbox(items: Shot[], start: number) {
  let i = start;
  const o = el('div', 'ap-light');
  const stageEl = el('div', 'ap-light-stage');
  const cap = el('div', 'ap-light-cap');
  const count = el('div', 'ap-light-count');
  const prev = el('button', 'ap-light-nav prev', '‹');
  const next = el('button', 'ap-light-nav next', '›');
  const x = el('button', 'ap-x light', '✕');
  o.append(stageEl, cap, count, prev, next, x);
  const show = () => {
    const m = items[i];
    stageEl.innerHTML = '';
    if (m.chat) {
      const c = el('div', 'mini-chat big');
      for (const msg of m.chat) c.append(el('div', 'bubble' + (msg.me ? ' me' : ''), `<span class="bt">${msg.text}</span><span class="bm">${msg.t}</span>`));
      stageEl.append(c);
    } else if (m.src) {
      const img = el('img') as HTMLImageElement;
      img.src = m.src;
      img.alt = m.caption;
      img.draggable = false;
      if (m.sticker) img.classList.add('sticker-img');
      stageEl.append(img);
    }
    cap.textContent = m.caption;
    count.textContent = `${i + 1} / ${items.length} · Capítulo ${m.level}`;
    prev.hidden = i === 0;
    next.hidden = i === items.length - 1;
  };
  const go = (d: number) => {
    i = Math.max(0, Math.min(items.length - 1, i + d));
    show();
  };
  prev.onclick = (e) => (e.stopPropagation(), go(-1));
  next.onclick = (e) => (e.stopPropagation(), go(1));
  const close = () => {
    o.classList.add('out');
    setTimeout(() => o.remove(), 200);
  };
  x.onclick = close;
  o.onclick = (e) => e.target === o && close();
  let sx: number | null = null;
  o.onpointerdown = (e) => (sx = e.clientX);
  o.onpointerup = (e) => {
    if (sx !== null && Math.abs(e.clientX - sx) > 50) go(e.clientX < sx ? 1 : -1);
    sx = null;
  };
  root.append(o);
  show();
}

/**
 * Menú principal, como una app: pestañas abajo (historia, álbum, regalos, minijuegos), el siguiente capítulo
 * bien grande arriba y el resto en una lista compacta; los detalles, en hojas que suben desde abajo.
 */
export function mapScreen(save: SaveData, opts: MapOptions, tab: Tab = lastTab) {
  // Al cambiar de pestaña no se vuelve a fundir toda la pantalla: solo entra el contenido
  const switching = !!root.querySelector('.app-screen:not(.done-screen)');
  clearScreens();
  lastTab = tab;
  const done = new Set(save.levelsDone);
  const s = el('div', 'screen app-screen' + (switching ? ' still' : ''));
  const head = el('header', 'ap-head');
  const brand = el('div', 'ap-brand');
  brand.append(el('div', 'ap-logo', 'Para <em>Azul</em>'), el('div', 'ap-sub', opts.test ? '🛠 Modo prueba · todo abierto' : `${save.levelsDone.length} de ${LEVELS.length} capítulos`));
  const gear = el('button', 'ap-icon', '⚙️');
  gear.setAttribute('aria-label', 'Ajustes');
  gear.onclick = () => settingsSheet(opts);
  head.append(brand, gear);
  const body = el('main', 'ap-body');
  const tabs = el('nav', 'ap-tabs');
  const seen = MEMORIES.filter((m) => opts.test || done.has(m.level)).length;
  const defs: [Tab, string, string, string][] = [
    ['story', '🗺️', 'Historia', ''],
    ['album', '📷', 'Álbum', `${seen + (save.found?.length ?? 0)}`],
    ['gifts', '🎁', 'Regalos', `${save.giftsUnlocked.length}`],
    ['games', '🎮', 'Juegos', ''],
  ];
  for (const [id, icon, label, badge] of defs) {
    void badge;
    const b = el('button', 'ap-tab' + (id === tab ? ' on' : ''), `<span class="ap-tab-i">${icon}</span><span>${label}</span>`);
    b.onclick = () => id !== tab && mapScreen(save, opts, id);
    tabs.append(b);
  }
  if (tab === 'story') storyTab(body, save, opts);
  else if (tab === 'album') albumTab(body, save, opts.test);
  else if (tab === 'gifts') giftsTab(body, save);
  else gamesTab(body, save, opts);
  s.append(head, body, tabs);
  root.append(s);
}

function chapterState(i: number, save: SaveData, test: boolean) {
  const done = new Set(save.levelsDone);
  const lv = LEVELS[i];
  const day = openDay(i);
  const early = Date.now() < day.getTime();
  const unlocked = test || (!early && (i === 0 || done.has(LEVELS[i - 1].id)));
  return { lv, day, early, unlocked, done: done.has(lv.id) };
}

function storyTab(body: HTMLElement, save: SaveData, opts: MapOptions) {
  const states = LEVELS.map((_, i) => chapterState(i, save, opts.test));
  const allDone = LEVELS.every((l) => save.levelsDone.includes(l.id));
  // El que toca: el primero sin hacer (abierto o por abrir)
  const nextI = states.findIndex((c) => !c.done);
  const hero = el('section', 'ap-hero');
  if (nextI < 0 || allDone) {
    hero.classList.add('final');
    hero.append(el('div', 'ap-kicker', 'Has llegado al final'), el('div', 'ap-hero-emoji', '💌'), el('h2', '', 'La sorpresa final'), el('p', '', 'Un crucigrama y, al resolverlo, la carta.'));
    const b = el('button', 'big-btn ap-play', 'Abrir ▸');
    b.onclick = () => crossword(opts.onLetter, () => mapScreen(save, opts, 'story'));
    hero.append(b);
  } else {
    const c = states[nextI];
    hero.append(el('div', 'ap-kicker', `${c.done ? 'Otra vez' : 'Siguiente'} · Capítulo ${c.lv.id}`), el('div', 'ap-hero-emoji', c.lv.emoji), el('h2', '', c.lv.name), el('p', '', c.unlocked ? c.lv.place : TEASERS[c.lv.id] ? `«${TEASERS[c.lv.id]}»` : c.lv.place));
    if (c.unlocked) {
      const b = el('button', 'big-btn ap-play', '▶ Jugar');
      b.onclick = () => opts.onPlay(c.lv.id);
      hero.append(b);
    } else {
      hero.classList.add('locked');
      hero.append(el('div', 'ap-countdown', c.early ? countdown(c.day) : '🔒 Termina el anterior'));
    }
  }
  body.append(hero);
  body.append(el('h3', 'ap-section', 'Todos los capítulos'));
  const list = el('div', 'ap-list');
  states.forEach((c, i) => {
    const kp = keepsakesFor(c.lv.id);
    const found = kp.filter((k) => save.found?.includes(k.id)).length;
    const row = el('button', 'ap-row' + (c.done ? ' done' : c.unlocked ? ' open' : ' locked') + (i === nextI ? ' next' : ''));
    const date = `<b>${c.day.getDate()}</b><small>${MONTHS[c.day.getMonth()].slice(0, 3)}</small>`;
    const state = c.done ? '<span class="ap-st ok">✓</span>' : c.unlocked ? '<span class="ap-st go">▶</span>' : '<span class="ap-st">🔒</span>';
    row.append(el('div', 'ap-date', date), el('div', 'ap-row-emoji', c.unlocked || c.done ? c.lv.emoji : '❔'));
    const txt = el('div', 'ap-row-txt');
    txt.append(el('div', 'ap-row-name', c.unlocked || c.done ? c.lv.name : `Capítulo ${c.lv.id}`), el('div', 'ap-row-sub', c.done ? `Completado${kp.length ? ` · 🔎 ${found}/${kp.length}` : ''}` : c.unlocked ? 'Listo para jugar' : c.early ? `Se abre el ${c.day.getDate()} de ${MONTHS[c.day.getMonth()]}` : 'Termina el anterior'));
    row.append(txt);
    row.insertAdjacentHTML('beforeend', state);
    row.onclick = () => {
      if (!c.unlocked && !c.done) {
        row.classList.remove('nope');
        void row.offsetWidth;
        row.classList.add('nope');
        vibrate(20);
        return;
      }
      chapterSheet(c.lv.id, save, opts);
    };
    list.append(row);
  });
  const fin = el('button', 'ap-row final' + (allDone || opts.test ? ' open' : ' locked'));
  fin.append(el('div', 'ap-date', '<b>♥</b>'), el('div', 'ap-row-emoji', '💌'));
  const ft = el('div', 'ap-row-txt');
  ft.append(el('div', 'ap-row-name', 'La sorpresa final'), el('div', 'ap-row-sub', allDone || opts.test ? 'Lista para abrir' : 'Cuando termines todos los capítulos'));
  fin.append(ft);
  fin.insertAdjacentHTML('beforeend', allDone || opts.test ? '<span class="ap-st go">▶</span>' : '<span class="ap-st">🔒</span>');
  if (allDone || opts.test) fin.onclick = () => crossword(opts.onLetter, () => mapScreen(save, opts, 'story'));
  list.append(fin);
  body.append(list);
}

/** «Mañana», «En 3 días», o las horas que faltan si es hoy. */
function countdown(day: Date) {
  const ms = day.getTime() - Date.now();
  if (ms <= 0) return 'Ya se puede abrir';
  const h = Math.ceil(ms / 3600000);
  const now = new Date();
  const days = Math.round((new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  if (days <= 0) return `⏳ Se abre en ${h} h`;
  if (days === 1) return '⏳ Se abre mañana';
  return `⏳ Se abre el ${day.getDate()} de ${MONTHS[day.getMonth()]} · faltan ${days} días`;
}

function chapterSheet(id: number, save: SaveData, opts: MapOptions) {
  const lv = LEVELS[id - 1];
  const doneIt = save.levelsDone.includes(id);
  sheet((b, close) => {
    const kp = keepsakesFor(id);
    const found = kp.filter((k) => save.found?.includes(k.id)).length;
    const photos = memoriesFor(id);
    b.append(el('div', 'ap-sheet-emoji', lv.emoji), el('div', 'ap-kicker', `Capítulo ${id}`), el('h2', '', lv.name), el('p', 'ap-sheet-place', lv.place));
    const facts = el('div', 'ap-facts');
    facts.append(el('div', '', `<b>${doneIt ? '✓' : '—'}</b><span>${doneIt ? 'Completado' : 'Sin jugar'}</span>`));
    if (kp.length) facts.append(el('div', '', `<b>${found}/${kp.length}</b><span>Recuerdos escondidos</span>`));
    if (photos.length) facts.append(el('div', '', `<b>${doneIt || opts.test ? photos.length : '?'}</b><span>Fotos para el álbum</span>`));
    b.append(facts);
    const play = el('button', 'big-btn ap-play', doneIt ? '↻ Volver a jugar' : '▶ Jugar');
    play.onclick = () => {
      close();
      opts.onPlay(id);
    };
    b.append(play);
  });
}

function albumTab(body: HTMLElement, save: SaveData, test: boolean) {
  const done = new Set(save.levelsDone);
  const photos: Shot[] = MEMORIES.filter((m) => test || done.has(m.level));
  body.append(el('h3', 'ap-section', `Fotos · ${photos.length}/${MEMORIES.length}`));
  const grid = el('div', 'ap-grid');
  MEMORIES.forEach((m) => {
    const open = test || done.has(m.level);
    const card = el('button', 'ap-photo' + (open ? '' : ' locked'));
    if (open) {
      card.append(thumb(m), el('span', 'ap-photo-cap', m.caption));
      card.onclick = () => lightbox(photos, photos.indexOf(m));
    } else card.append(el('div', 'ap-photo-lock', `🔒<small>Capítulo ${m.level}</small>`));
    grid.append(card);
  });
  body.append(grid);
  const found = KEEPSAKES.filter((k) => save.found?.includes(k.id));
  const fShots: Shot[] = found.map((k) => ({ level: k.chapter, src: k.src, chat: k.chat, caption: k.caption, sticker: k.sticker }));
  body.append(el('h3', 'ap-section', `Recuerdos escondidos · ${found.length}/${KEEPSAKES.length}`));
  const g2 = el('div', 'ap-grid');
  KEEPSAKES.forEach((k) => {
    const card = el('button', 'ap-photo' + (save.found?.includes(k.id) ? '' : ' locked'));
    if (save.found?.includes(k.id)) {
      const sh = fShots.find((f) => f.caption === k.caption)!;
      card.append(thumb(sh), el('span', 'ap-photo-cap', k.caption));
      card.onclick = () => lightbox(fShots, fShots.indexOf(sh));
    } else card.append(el('div', 'ap-photo-lock', `🔎<small>Escondido en el capítulo ${k.chapter}</small>`));
    g2.append(card);
  });
  body.append(g2);
}

function thumb(m: Shot) {
  if (m.chat) {
    const c = el('div', 'mini-chat');
    for (const msg of m.chat.slice(0, 4)) c.append(el('div', 'bubble' + (msg.me ? ' me' : ''), `<span class="bt">${msg.text}</span>`));
    return c;
  }
  if (!m.src) return el('div', 'ap-photo-lock', '📷<small>Foto pendiente</small>');
  const img = el('img', m.sticker ? 'sticker-img' : '') as HTMLImageElement;
  img.src = m.src;
  img.alt = m.caption;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.draggable = false;
  return img;
}

function giftsTab(body: HTMLElement, save: SaveData) {
  body.append(el('h3', 'ap-section', `Tus regalos · ${save.giftsUnlocked.length}/${GIFTS.length}`));
  const list = el('div', 'ap-list');
  GIFTS.forEach((g) => {
    const open = save.giftsUnlocked.includes(g.id);
    const row = el('button', 'ap-row gift' + (open ? ' open' : ' locked'));
    row.append(el('div', 'ap-row-emoji big', open ? g.icon : '🎁'));
    const t = el('div', 'ap-row-txt');
    t.append(el('div', 'ap-row-name', open ? g.title : 'Regalo sorpresa'), el('div', 'ap-row-sub', open ? 'Toca para verlo' : `Al terminar el capítulo ${g.level}`));
    row.append(t);
    row.insertAdjacentHTML('beforeend', open ? '<span class="ap-st go">›</span>' : '<span class="ap-st">🔒</span>');
    if (open)
      row.onclick = () =>
        sheet((b) => {
          b.append(voucher(g), el('p', 'ap-note', 'Haz una captura para tenerlo a mano 📸'));
        }, 'gift-sheet');
    list.append(row);
  });
  body.append(list);
}

function gamesTab(body: HTMLElement, save: SaveData, opts: MapOptions) {
  const done = new Set(save.levelsDone);
  body.append(el('h3', 'ap-section', 'Minijuegos para repetir'));
  const grid = el('div', 'ap-games');
  MINI_GAMES.forEach((m) => {
    const open = opts.test || done.has(m.chapter);
    const card = el('button', 'ap-game' + (open ? '' : ' locked'));
    card.append(el('div', 'ap-game-i', open ? m.icon : '🔒'), el('div', 'ap-row-name', open ? m.title : '???'), el('div', 'ap-row-sub', `Capítulo ${m.chapter}`));
    if (open) card.onclick = () => m.run(() => mapScreen(save, opts, 'games'));
    grid.append(card);
  });
  body.append(grid);
}

/** Ajustes: sonido, cómo se juega y, en modo prueba, borrar el progreso. */
function settingsSheet(opts: MapOptions) {
  sheet((b, close) => {
    b.append(el('h2', '', 'Ajustes'));
    const sound = el('button', 'ap-setting', '');
    const paint = () => (sound.innerHTML = `<span>🔊 Sonido</span><i class="ap-switch${audio.muted ? '' : ' on'}"></i>`);
    paint();
    sound.onclick = () => {
      audio.unlock();
      audio.setMuted(!audio.muted);
      paint();
    };
    const help = el('button', 'ap-setting', '<span>❓ Cómo se juega</span><span class="ap-st go">›</span>');
    help.onclick = () => {
      close();
      setTimeout(howToPlay, 280);
    };
    b.append(sound, help);
    if (opts.test) {
      const reset = el('button', 'ap-setting danger', '<span>🗑️ Borrar el progreso guardado</span>');
      let armed = false;
      reset.onclick = () => {
        if (!armed) {
          armed = true;
          reset.innerHTML = '<span>¿Seguro? Toca otra vez para borrarlo todo</span>';
          return;
        }
        close();
        opts.onReset();
      };
      b.append(reset, el('p', 'ap-note', 'Modo prueba: cinco toques en «De Gas, para ti» en la portada para quitarlo.'));
    }
  });
}

/** Los controles, con dibujitos: se abre desde ajustes y desde la pausa. */
export function howToPlay() {
  sheet((b) => {
    b.append(el('h2', '', 'Cómo se juega'));
    const rows: [string, string, string][] = [
      ['👈', 'Andar', 'Pon el pulgar en la mitad izquierda y deslízalo. No hace falta llegar al borde para correr.'],
      ['👉', 'Mirar', 'Arrastra en la mitad derecha para girar la cámara.'],
      ['🔴', 'Acción', 'Cuando hay algo que hacer, aparece un botón abajo a la derecha.'],
      ['✨', 'Por dónde', 'Sigue la columna de luz y la flecha del objetivo, arriba.'],
      ['🔎', 'Recuerdos', 'En cada capítulo hay fotos escondidas: acércate a lo que brilla.'],
      ['☰', 'Pausa', 'El botón de arriba a la derecha para el juego.'],
    ];
    const l = el('div', 'ap-help');
    for (const [i, t, d] of rows) l.append(el('div', 'ap-help-row', `<span class="ap-help-i">${i}</span><div><b>${t}</b><span>${d}</span></div>`));
    b.append(l);
  });
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
  o.append(grid);
  // Los que estaban escondidos por los escenarios
  const found = KEEPSAKES.filter((k) => save.found?.includes(k.id));
  o.append(el('h2', 'album-sub', `Recuerdos escondidos (${found.length}/${KEEPSAKES.length})`));
  const hidden = el('div', 'polaroid-table');
  KEEPSAKES.forEach((k, i) => {
    if (save.found?.includes(k.id)) hidden.append(polaroid({ level: k.chapter, src: k.src, chat: k.chat, caption: k.caption, sticker: k.sticker }, TILTS[i % TILTS.length]));
    else {
      const f = el('figure', 'polaroid locked', `<div class="ph">?</div><figcaption>Capítulo ${k.chapter}</figcaption>`);
      f.style.setProperty('--tilt', `${TILTS[i % TILTS.length]}deg`);
      hidden.append(f);
    }
  });
  const b = el('button', 'big-btn', 'Volver');
  b.onclick = onClose;
  o.append(hidden, b);
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

/** Las estrellas del capítulo, que entran una a una, y sus números. */
function resultBlock(result: LevelResult) {
  const res = el('div', 'result');
  const stars = el('div', 'stars');
  for (let i = 0; i < 3; i++) {
    const st = el('span', i < result.stars ? 'on' : '', '★');
    st.style.animationDelay = `${0.3 + i * 0.25}s`;
    stars.append(st);
  }
  const st = el('div', 'result-stats');
  for (const [k, v] of result.stats) st.append(el('div', '', `<span>${k}</span><b>${v}</b>`));
  res.append(stars, st);
  setTimeout(() => result.stars > 0 && audio.pickup(), 300);
  return res;
}

/** Final de un capítulo sin vale: sus estrellas y sus números, con confeti, antes de las fotos o del mapa. */
export function chapterResult(n: number, result: LevelResult, onClose: () => void) {
  clearScreens();
  const o = el('div', 'gift-overlay chapter-result');
  o.append(el('div', 'result-chapter', `Capítulo ${n} · ${LEVELS[n - 1].name}`), el('h1', 'gift-title', '¡Capítulo superado!'), resultBlock(result));
  const b = el('button', 'big-btn', 'Seguir');
  b.onclick = () => {
    o.remove();
    onClose();
  };
  o.append(b);
  root.append(o);
  audio.fanfare();
  cssConfetti(o, 40);
}

/** Al acabar un capítulo, lo que viene: cuándo se abre el siguiente y una pista. */
export function teaserCard(next: number, onClose: () => void) {
  const lv = LEVELS[next - 1];
  const hint = TEASERS[next];
  if (!lv || !hint) return onClose();
  clearScreens();
  const day = openDay(next - 1);
  const now = new Date();
  const left = Math.ceil((new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  const when = left <= 0 ? 'Ya lo puedes abrir' : left === 1 ? 'Mañana' : `El ${day.getDate()} de ${MONTHS[day.getMonth()]}`;
  const o = el('div', 'screen memories-screen teaser-screen');
  o.append(el('div', 'eyebrow', `${when} · Capítulo ${next}`), el('div', 'teaser-emoji', lv.emoji), el('p', 'teaser-hint', hint));
  const b = el('button', 'big-btn', 'Hasta entonces');
  b.onclick = onClose;
  o.append(b);
  root.append(o);
  audio.chime(1);
}

/** Regalo: primero una caja que tiembla, al tocarla se abre con confeti y aparece el vale. */
export function showGift(g: Gift, onClose: () => void, result?: LevelResult) {
  clearScreens();
  const o = el('div', 'gift-overlay');
  const title = el('h1', 'gift-title', 'Tienes un regalo');
  const box = el('button', 'giftbox');
  box.append(el('div', 'lid'), el('div', 'base'), el('div', 'ribbon'));
  const tapHint = el('p', 'gift-hint', 'Toca la caja para abrirla');
  if (result) o.append(resultBlock(result), title);
  else o.append(title);
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
export interface ChapterLoading {
  /** 0-1 y qué se está preparando. */
  progress(p: number, label?: string): void;
  /** Todo listo: el rótulo se va (sin bajar de un mínimo en pantalla, para que se lea). */
  done(): void;
}

/**
 * Rótulo del capítulo y pantalla de carga a la vez: el título y una barra que se llena mientras se monta el
 * escenario, se descodifica la canción y se preparan los shaders. Se va cuando el capítulo ya corre fluido.
 */
export function chapterCard(n: number): ChapterLoading {
  const lv = LEVELS[n - 1];
  const c = el('div', 'chapter-card');
  const bar = el('div', 'cc-bar');
  const fill = el('div', 'cc-fill');
  bar.append(fill);
  const label = el('div', 'cc-label', 'Preparando…');
  const load = el('div', 'cc-load');
  load.append(bar, label);
  c.append(el('div', 'num', `Capítulo ${n}`), el('div', 'emoji', lv.emoji), el('h1', '', lv.name), el('div', 'place', lv.place), load);
  root.append(c);
  const t0 = performance.now();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    fill.style.transform = 'scaleX(1)';
    label.textContent = '¡A jugar!';
    c.classList.add('ready');
    setTimeout(() => c.classList.add('out'), 260);
    setTimeout(() => c.remove(), 1000);
  };
  // Por si algo falla al montar el capítulo, el rótulo nunca se queda más de 15 s
  setTimeout(close, 15000);
  return {
    progress(p, text) {
      fill.style.transform = `scaleX(${Math.max(0.04, Math.min(1, p))})`;
      if (text) label.textContent = text;
    },
    done() {
      setTimeout(close, Math.max(0, 1800 - (performance.now() - t0)));
    },
  };
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

let barkEnd = 0;
let barkRaf = 0;
/** Una frase al andar: bocadillo sobre quien habla (o arriba, si no se le ve). No para nada ni recoge toques. */
export function bark(who: string, text: string) {
  root.querySelectorAll('.bark').forEach((n) => n.remove());
  cancelAnimationFrame(barkRaf);
  const wa = text.startsWith('(WhatsApp) ');
  const body = wa ? text.slice(11) : text;
  const t = el('div', 'bark ' + whoClass(who) + (wa ? ' wa' : ''));
  t.append(el('b', '', wa ? `📱 ${who}` : who), el('span', '', body));
  root.append(t);
  barkEnd = performance.now() + 2100 + Math.min(2400, body.length * 55);
  const place = () => {
    if (!t.isConnected) return;
    const left = barkEnd - performance.now();
    if (left <= 0) return void t.remove();
    t.style.opacity = String(Math.min(1, left / 300));
    const at = wa ? null : speakerAt(who);
    const W = window.innerWidth;
    if (at && at.y > 90) {
      const w = t.offsetWidth, h = t.offsetHeight;
      t.style.left = `${Math.min(Math.max(at.x - w / 2, 10), W - w - 10)}px`;
      t.style.top = `${Math.max(at.y - h - 14, 72)}px`;
      t.classList.add('anchored');
    } else {
      t.style.left = `${(W - t.offsetWidth) / 2}px`;
      t.style.top = 'calc(env(safe-area-inset-top) + 76px)';
      t.classList.remove('anchored');
    }
    barkRaf = requestAnimationFrame(place);
  };
  place();
  // (la pestaña oculta no pinta: que no se quede para siempre)
  setTimeout(() => t.remove(), 5000);
}

/** Has encontrado un recuerdo: la polaroid cae arriba unos segundos y se va al álbum. El juego sigue. */
export function keepsakePop(k: Keepsake, found: number, total: number) {
  root.querySelectorAll('.kp-pop').forEach((n) => n.remove());
  // Un aviso pequeño arriba (se está jugando, a veces conduciendo): la foto entera se ve luego en el álbum
  const o = el('div', 'kp-pop');
  let thumb: HTMLElement;
  if (k.src && !k.chat) {
    const img = el('img', 'kp-thumb') as HTMLImageElement;
    img.src = k.src;
    img.alt = '';
    thumb = img;
  } else thumb = el('div', 'kp-thumb', k.chat ? '💬' : '📷');
  const txt = el('div', 'kp-text');
  txt.append(el('b', '', `🔎 Recuerdo ${found}/${total} · al álbum`), el('span', '', k.caption));
  o.append(thumb, txt);
  root.append(o);
  setTimeout(() => o.classList.add('out'), 3600);
  setTimeout(() => o.remove(), 4100);
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
/** Cuántas de sus respuestas ha acertado a la primera en este capítulo. */
export const quizScore = { right: 0, total: 0 };

export function phoneChat(input: ChatFrag | ChatFrag[], onDone: () => void) {
  const asked = new Set<number>();
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
    let last = -1;
    for (const m of f.msgs) {
      // Un salto de horas entre dos mensajes se marca: en un chat real no se escribe todo de seguido
      const [h, mi] = m.t.split(':').map(Number);
      const now = h * 60 + mi;
      if (last >= 0 && ((now - last + 1440) % 1440) >= 30) {
        items.push({ kind: 'date', text: m.t });
        prev = null;
      }
      last = now;
      items.push({ kind: 'msg', me: m.me, t: m.t, text: m.text, first: prev !== m.me });
      prev = m.me;
    }
  }
  let i = 0;
  let timer = 0;
  let typing: HTMLElement | null = null;
  /** La pregunta que está en pantalla: hasta contestarla, el chat no avanza. */
  let asking: HTMLElement | null = null;
  const done = () => i >= items.length;
  const scroll = () => (chat.scrollTop = chat.scrollHeight);
  const show = (it: Item) => {
    if (it.kind === 'date') chat.append(el('div', 'chat-date', it.text));
    else {
      const b = el('div', 'bubble' + (it.me ? ' me' : '') + (it.first ? ' first' : ''), `<span class="bt">${it.text}</span><span class="bm">${it.t}${it.me ? ' <i class="ticks">✓✓</i>' : ''}</span>`);
      chat.append(b);
    }
  };
  /** Antes de un mensaje suyo señalado: qué contestó. El mensaje real no cambia, y hasta acertar no sale. */
  const ask = (it: Item & { kind: 'msg' }) => {
    clearTimeout(timer);
    const fake = QUIZ[it.text];
    const opts = [...fake, it.text].sort(() => Math.random() - 0.5);
    const q = el('div', 'quiz');
    q.append(el('div', 'quiz-q', '¿Qué le contestaste?'));
    let missed = false;
    quizScore.total++;
    for (const t of opts) {
      const b = el('button', 'quiz-opt', t);
      b.onpointerdown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (t === it.text) {
          if (!missed) quizScore.right++;
          audio.pickup();
          q.remove();
          asking = null;
          scroll();
          step();
        } else {
          missed = true;
          b.classList.add('wrong');
          b.disabled = true;
          audio.boo();
          vibrate(30);
        }
      };
      q.append(b);
    }
    asking = q;
    ph.append(q);
    scroll();
  };
  const step = () => {
    clearTimeout(timer);
    typing?.remove();
    typing = null;
    if (done()) return finish();
    const up = items[i];
    if (up.kind === 'msg' && up.me && QUIZ[up.text] && !asked.has(i)) {
      asked.add(i);
      return ask(up);
    }
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
    asking?.remove();
    asking = null;
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
    if (asking) return; // primero, contestar
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

/** Fases del capítulo en marcha (modo prueba): se saltan desde la pausa. */
let debugList: HTMLElement | null = null;

/** Modo prueba: saltar a cualquier fase del capítulo (desde el menú de pausa). */
export function debugPanel(items: DebugItem[]) {
  const list = el('div', 'debug-list');
  list.hidden = true;
  for (const it of items) {
    const b = el('button', '', it.label);
    b.onpointerdown = (e) => e.stopPropagation();
    b.onclick = (e) => {
      e.stopPropagation();
      // Saltar de fase cierra lo que hubiera abierto (chats, barras, minijuegos, escenas de cine) y anula sus temporizadores
      stage.end();
      cinema.stop();
      closeDialogue();
      newEpoch();
      clearScreens();
      it.run();
    };
    list.append(b);
  }
  root.append(list);
  debugList = list;
  return () => {
    list.remove();
    if (debugList === list) debugList = null;
  };
}

/** Pausa: el bucle principal no hace avanzar el capítulo mientras está abierta. title: el capítulo en marcha. */
export const pauseState = { on: false, title: '' };
let pauseOpener: (() => void) | null = null;
/** Abre la pausa del capítulo en marcha (al volver de segundo plano, p. ej.). */
export function openPause() {
  // Con una pantalla de menú delante (el final del capítulo, el mapa) no hay nada que pausar
  if (root.querySelector('.screen, .gift-overlay, .phone-overlay')) return;
  pauseOpener?.();
}

export interface Hud {
  root: HTMLElement;
  setObjective(text: string): void;
  setArrow(angle: number | null): void;
  setCounters(html: string): void;
  setAction(label: string | null, pulse?: boolean): void;
  remove(): void;
}

/**
 * HUD de juego, pensado para el móvil: el objetivo en una píldora translúcida arriba a la izquierda (entera al
 * cambiar, luego en una línea; se toca para verla otra vez), los contadores en columna a la derecha y un solo
 * botón de menú con el sonido y la vuelta al mapa. mission: el HUD de una misión (el del capítulo se esconde).
 */
export function hud(onAction: () => void, onMenu: () => void, hintText = 'Arrastra a la izquierda para andar · a la derecha para girar la cámara', mission = false): Hud {
  const top = el('div', 'hud-top' + (mission ? ' m-hud' : ''));
  const obj = el('div', 'objective');
  const arrow = el('span', 'arrow', '⬆');
  const objText = el('span', 'obj-text');
  obj.append(arrow, objText);
  let objTimer = 0;
  let lastObj = '';
  const expand = (ms: number) => {
    obj.classList.add('open');
    clearTimeout(objTimer);
    objTimer = window.setTimeout(() => obj.classList.remove('open'), ms);
  };
  obj.onpointerdown = (e) => {
    e.stopPropagation();
    expand(4000);
  };
  const counters = el('div', 'counters' + (mission ? ' m-hud' : ''));
  const menuBtn = el('button', 'icon-btn menu-btn', '<i></i><i></i>');
  menuBtn.setAttribute('aria-label', 'Pausa');
  // Pausa a pantalla completa: el capítulo se para; seguir, sonido, cómo se juega, (modo prueba) fases y salir
  let pause: HTMLElement | null = null;
  const closePause = () => {
    if (!pause) return;
    pause.classList.add('out');
    const p = pause;
    setTimeout(() => p.remove(), 200);
    pause = null;
    pauseState.on = false;
  };
  const openIt = () => {
    if (pause || !top.isConnected || root.querySelector('.screen, .gift-overlay')) return;
    pauseState.on = true;
    pause = el('div', 'pause');
    const card = el('div', 'pause-card');
    card.append(el('div', 'ap-kicker', 'Pausa'), el('h2', '', pauseState.title || 'En pausa'));
    if (lastObj) card.append(el('p', 'pause-obj', `<span>⬆</span>${lastObj}`));
    const resume = el('button', 'big-btn ap-play', '▶ Seguir');
    resume.onclick = closePause;
    const sound = el('button', 'ap-setting', '');
    const paintS = () => (sound.innerHTML = `<span>🔊 Sonido</span><i class="ap-switch${audio.muted ? '' : ' on'}"></i>`);
    paintS();
    sound.onclick = () => {
      audio.setMuted(!audio.muted);
      paintS();
    };
    const help = el('button', 'ap-setting', '<span>❓ Cómo se juega</span><span class="ap-st go">›</span>');
    help.onclick = () => howToPlay();
    card.append(resume, sound, help);
    if (debugList) {
      const dl = debugList;
      const dbg = el('details', 'pause-debug');
      dbg.append(el('summary', '', '🛠 Saltar a una fase'));
      const g = el('div', 'pause-debug-list');
      dl.querySelectorAll('button').forEach((src) => {
        const b = el('button', '', src.textContent ?? '');
        b.onclick = () => {
          closePause();
          src.click();
        };
        g.append(b);
      });
      dbg.append(g);
      card.append(dbg);
    }
    const leave = el('button', 'ap-setting danger', '<span>🗺️ Salir al menú</span>');
    let armed = false;
    leave.onclick = () => {
      if (!armed) {
        armed = true;
        leave.innerHTML = '<span>Se pierde lo que llevas del capítulo. Toca otra vez para salir</span>';
        return;
      }
      closePause();
      onMenu();
    };
    card.append(leave);
    pause.append(card);
    pause.onpointerdown = (e) => e.stopPropagation();
    root.append(pause);
  };
  menuBtn.onpointerdown = (e) => e.stopPropagation();
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    openIt();
  };
  if (!mission) pauseOpener = openIt;
  top.append(obj, el('div', 'spacer'));
  if (!mission) top.append(menuBtn);

  const act = el('button', 'action-btn hidden' + (mission ? ' m-hud' : ''));
  act.onpointerdown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onAction();
  };
  const hint = el('div', 'hint-move' + (mission ? ' m-hud' : ''), hintText);
  setTimeout(() => hint.remove(), 7000);
  root.append(top, counters, act, hint);
  return {
    root: top,
    setObjective: (t) => {
      if (t === lastObj) return;
      lastObj = t;
      objText.textContent = t;
      obj.classList.toggle('empty', !t);
      if (t) expand(5500);
    },
    setArrow: (a) => {
      arrow.style.display = a === null ? 'none' : '';
      if (a !== null) arrow.style.transform = `rotate(${a}rad)`;
    },
    setCounters: (h) => {
      if (counters.innerHTML !== h) counters.innerHTML = h;
    },
    setAction: (label, pulse) => {
      act.classList.toggle('hidden', !label);
      act.classList.toggle('pulse', !!pulse);
      if (label && act.textContent !== label) act.textContent = label;
    },
    remove: () => {
      clearTimeout(objTimer);
      closePause();
      if (pauseOpener === openIt) pauseOpener = null;
      top.remove();
      counters.remove();
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

/** Rótulo de misión que entra y se va solo: «MISIÓN · título» y el objetivo (o «MISIÓN CUMPLIDA»). */
export function missionCard(title: string, goal = '', done = false) {
  const c = el('div', 'mission-card' + (done ? ' done' : ''));
  c.append(el('div', 'm-kicker', done ? 'MISIÓN CUMPLIDA' : 'MISIÓN'), el('div', 'm-title', title));
  if (goal) c.append(el('div', 'm-goal', goal));
  root.append(c);
  if (done) {
    audio.fanfare();
    vibrate([30, 40, 60]);
  } else audio.chime(1);
  setTimeout(() => c.remove(), 3300);
}


/**
 * Primeros pasos (capítulo 1, solo la primera vez): una mano animada enseña a andar, a mirar alrededor y el botón
 * de acción. Cada paso se da por hecho cuando se hace de verdad. Mientras hay un diálogo o la pausa, se esconde.
 */
export class Tutorial {
  private wrap = el('div', 'tuto');
  private hand = el('div', 'tuto-hand', '👆');
  private ring = el('div', 'tuto-ring');
  private bubble = el('div', 'tuto-bubble');
  private step = 0;
  private stepAt = 0;
  private base = { stick: 0, cam: 0, action: 0 };
  done = false;
  static readonly KEY = 'margaux-tuto';
  static pending() {
    try {
      return localStorage.getItem(Tutorial.KEY) !== '1';
    } catch {
      return false;
    }
  }

  constructor(private usage: { stick: number; cam: number; action: number }) {
    this.wrap.append(this.ring, this.hand, this.bubble);
    root.append(this.wrap);
    this.go(0);
  }

  private go(n: number) {
    this.step = n;
    this.stepAt = performance.now();
    Object.assign(this.base, this.usage);
    this.wrap.className = `tuto step${n}`;
    const steps = [
      ['Para andar', 'Pon el pulgar aquí y deslízalo. No hace falta llegar al borde para correr.'],
      ['Para mirar alrededor', 'Arrastra el dedo por este lado de la pantalla.'],
      ['Cuando haya algo que hacer', 'Aparece este botón. Tócalo.'],
    ];
    const [t, d] = steps[n];
    this.bubble.innerHTML = `<small>${n + 1} de 3</small><b>${t}</b><span>${d}</span>`;
    this.place();
  }

  /** En el paso del botón, la mano va donde esté el botón de acción. */
  private place() {
    if (this.step !== 2) {
      this.hand.style.left = this.hand.style.top = this.ring.style.left = this.ring.style.top = '';
      return;
    }
    const b = root.querySelector('.action-btn:not(.hidden)') as HTMLElement | null;
    if (!b) return;
    const r = b.getBoundingClientRect();
    this.ring.style.left = `${r.left + r.width / 2}px`;
    this.ring.style.top = `${r.top + r.height / 2}px`;
    this.ring.style.width = `${r.width + 26}px`;
    this.ring.style.height = `${r.height + 26}px`;
    this.hand.style.left = `${r.left + r.width / 2 - 8}px`;
    this.hand.style.top = `${r.top - 30}px`;
  }

  /** Cada fotograma. busy: hay algo delante (diálogo, cine, pausa…): el tutorial espera escondido. */
  update(busy: boolean) {
    if (this.done) return;
    const hidden = busy || !!root.querySelector('.dialogue, .phone-overlay, .pause, .ap-sheet-back, .screen, .gauge, .pee-game, .gh-game');
    const actionShown = !!root.querySelector('.action-btn:not(.hidden)');
    this.wrap.classList.toggle('off', hidden || (this.step === 2 && !actionShown));
    if (hidden) {
      this.stepAt = performance.now();
      return;
    }
    const u = this.usage, b = this.base;
    if (this.step === 0 && u.stick - b.stick > 1.0) this.next();
    else if (this.step === 1 && u.cam - b.cam > 140) this.next();
    else if (this.step === 2) {
      this.place();
      if (u.action > b.action) this.next();
      // Si en un buen rato no sale ningún botón, se deja (ya lo verá)
      else if (!actionShown && performance.now() - this.stepAt > 45000) this.finish();
    }
  }

  private next() {
    audio.pickup();
    vibrate(15);
    if (this.step >= 2) return this.finish();
    this.wrap.classList.add('ok');
    const n = this.step + 1;
    setTimeout(() => !this.done && this.go(n), 450);
  }

  finish() {
    if (this.done) return;
    this.done = true;
    try {
      localStorage.setItem(Tutorial.KEY, '1');
    } catch {
      /* sin guardar: saldría otra vez */
    }
    toast('✨ ¡Listo! Sigue la luz para saber a dónde ir');
    this.wrap.classList.add('bye');
    setTimeout(() => this.wrap.remove(), 500);
  }

  dispose() {
    this.done = true;
    this.wrap.remove();
  }
}
