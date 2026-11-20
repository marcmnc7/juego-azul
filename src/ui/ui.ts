import { GIFTS, Gift } from '../data/gifts';
import { LEVELS, Line, FINAL_LETTER, CROSSWORD, type CrossClue } from '../data/story';
import { audio } from '../core/audio';
import { save as persist, type SaveData } from '../core/save';
import { PUZZLES } from '../data/puzzles';
import { runPuzzle, puzzleDate, puzzleDay } from './puzzles';
import type { LevelResult } from '../world/level';
import { vibrate } from '../core/gfx';
import { MEMORIES, memoriesFor, STICKERS, LETTER_PHOTOS, Memory } from '../data/memories';
import { KEEPSAKES, keepsakesFor, QUIZ, TEASERS, type Keepsake } from '../data/extras';
import type { ChatFrag } from '../data/chats';
import { cinema } from '../core/cinema';
import { stage } from '../core/stage';
import { tryApply } from '../core/updater';
import { BUILD } from '../core/release';
import { GATE, openDay, now, faking, daysUntil, longDate, left, MONTHS } from '../core/calendar';
import cover1 from '../assets/covers/c1.jpg';
import cover2 from '../assets/covers/c2.jpg';
import cover3 from '../assets/covers/c3.jpg';
import cover4 from '../assets/covers/c4.jpg';
import cover5 from '../assets/covers/c5.jpg';
import cover6 from '../assets/covers/c6.jpg';
import cover7 from '../assets/covers/c7.jpg';
import cover8 from '../assets/covers/c8.jpg';
import cover9 from '../assets/covers/c9.jpg';

/** Portada de cada capítulo: una imagen del propio juego (scripts de captura en docs/PLAN-reparto-vroid.md). */
const COVERS = [cover1, cover2, cover3, cover4, cover5, cover6, cover7, cover8, cover9];

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
  // (con la misma portada que la cuenta atrás y la de Empezar: antes era una pantalla del estilo antiguo)
  const { s, slot } = cover('ig-screen');
  const steps = ios
    ? [
        ['1', 'Toca <b>Compartir</b> <span class="ig-icon">⎋</span> abajo en Safari'],
        ['2', 'Elige <b>Añadir a pantalla de inicio</b> <span class="ig-icon">＋</span>'],
        ['3', 'Ábrelo desde su icono en la pantalla de inicio'],
      ]
    : [
        ['1', 'Abre el menú <b>⋮</b> del navegador'],
        ['2', 'Elige <b>Añadir a pantalla de inicio</b> o <b>Instalar</b>'],
        ['3', 'Ábrelo desde su icono en la pantalla de inicio'],
      ];
  const list = el('div', 'ig-steps');
  for (const [n, t] of steps) list.append(el('div', 'ig-step', `<span class="ig-n">${n}</span><span>${t}</span>`));
  slot.append(list);
  s.append(el('p', 'hm-fine', 'Se abre desde la pantalla de inicio. Solo hay que hacerlo una vez.'));
  root.append(s);
}

/**
 * La portada, la misma antes y después del día de entrada (antes eran dos pantallas que no se parecían): cielo de
 * noche con estrellas y lucecitas que caen, «De Gas», «Para Azul» y, debajo, la cuenta atrás o el botón de Empezar,
 * en el mismo sitio y del mismo ancho, y una línea pequeña.
 */
function cover(cls: string) {
  clearScreens();
  const s = el('div', 'screen hm-title ' + cls);
  const sky = el('div', 'cd-sky');
  for (let i = 0; i < 46; i++) {
    const st = el('i', 'cd-star');
    st.style.left = `${Math.random() * 100}%`;
    st.style.top = `${Math.random() * 70}%`;
    st.style.animationDelay = `${Math.random() * 4}s`;
    st.style.setProperty('--sz', `${1 + Math.random() * 2.2}px`);
    sky.append(st);
  }
  for (let i = 0; i < 18; i++) {
    const f = el('i', 'cd-fall');
    f.style.left = `${Math.random() * 100}%`;
    f.style.animationDelay = `${-Math.random() * 12}s`;
    f.style.animationDuration = `${9 + Math.random() * 8}s`;
    sky.append(f);
  }
  const eyebrow = el('div', 'hm-eyebrow', 'De Gas');
  testTaps(eyebrow);
  const slot = el('div', 'hm-slot');
  s.append(sky, el('div', 'hm-glow'), eyebrow, el('h1', 'hm-display', 'Para <em>Azul</em>'), slot);
  return { s, slot };
}

/** Portada. Si se le pasa la carga, el botón espera (con porcentaje) a que todo esté listo, para que luego cada capítulo abra al momento. */
export function titleScreen(onStart: () => void, loading?: { done: Promise<unknown>; progress: () => number }, _save?: SaveData) {
  void _save;
  const { s, slot } = cover('');
  const b = el('button', 'hm-btn', 'Empezar') as HTMLButtonElement;
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
      b.innerHTML = 'Empezar';
    });
  }
  slot.append(b);
  s.append(el('p', 'hm-fine', 'Mejor con el sonido activado'));
  root.append(s);
}

/** ¿Todavía es pronto para entrar? (antes del 26 de noviembre solo se ve la cuenta atrás) */
export const beforeGate = () => now() < GATE.getTime();

/** Cuenta atrás hasta el día en que se puede entrar, en la misma portada. Cuando llega a cero, sigue sola. */
export function countdownScreen(onOpen: () => void) {
  const { s, slot } = cover('cd-screen');
  const units: [string, string][] = [['d', 'días'], ['h', 'horas'], ['m', 'min'], ['s', 'seg']];
  const clock = el('div', 'cd-clock');
  const cells: Record<string, HTMLElement> = {};
  for (const [k, label] of units) {
    const c = el('div', 'cd-cell');
    cells[k] = el('b', '', '00');
    c.append(cells[k], el('span', '', label));
    clock.append(c);
  }
  slot.append(clock);
  s.append(el('p', 'hm-fine', 'Paciencia. Merecerá la pena.'));
  const pad = (n: number) => String(n).padStart(2, '0');
  const tick = () => {
    if (!s.isConnected) return;
    const l = left(GATE);
    cells.d.textContent = pad(l.d);
    cells.h.textContent = pad(l.h);
    cells.m.textContent = pad(l.m);
    cells.s.textContent = pad(l.s);
    if (l.done) return void setTimeout(onOpen, 600);
    setTimeout(tick, 1000);
  };
  root.append(s);
  tick();
}

export interface MapOptions {
  test: boolean;
  onPlay: (level: number) => void;
  /** La carta final (después del crucigrama). */
  onLetter: () => void;
  onReset: () => void;
}

type Tab = 'story' | 'album';
let lastTab: Tab = 'story';

/** Modal en el centro (ajustes, cómo se juega): se cierra tocando fuera o con ✕. */
function sheet(build: (body: HTMLElement, close: () => void) => void, cls = '') {
  const back = el('div', 'ap-sheet-back');
  const sh = el('div', 'ap-sheet ' + cls);
  const x = el('button', 'ap-x', '✕');
  x.setAttribute('aria-label', 'Cerrar');
  const body = el('div', 'ap-sheet-body');
  sh.append(x, body);
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
  build(body, close);
  return close;
}

type Shot = { src?: string; chat?: Memory['chat']; caption: string; sticker?: boolean; video?: string; level: number };
/**
 * Final de un capítulo, por momentos y a pantalla completa (pensado para el móvil en horizontal), con un solo botón:
 * 1) superado: la portada cae como una polaroid, el título y las estrellas que se estampan una a una;
 * 2) el regalo: un sobre lacrado que se abre y saca el vale de papel con su talón troquelado;
 * 3) lo nuevo del álbum, en abanico (fotos, vídeo y chats); 4) el siguiente capítulo, borroso, con su fecha.
 */
export function chapterComplete(n: number, result: LevelResult | undefined, gift: Gift | null, nextTeaser: number | null, onClose: () => void) {
  clearScreens();
  const lv = LEVELS[n - 1];
  const o = el('div', 'screen wn-screen');
  const bg = el('img', 'wn-bg') as HTMLImageElement;
  bg.src = COVERS[n - 1];
  bg.alt = '';
  const sparks = el('div', 'wn-sparks');
  for (let i = 0; i < 26; i++) {
    const sp = el('i');
    sp.style.left = `${(i * 37) % 100}%`;
    sp.style.setProperty('--d', `${6 + (i % 5) * 1.7}s`);
    sp.style.setProperty('--delay', `${-(i * 0.73) % 8}s`);
    sp.style.setProperty('--sz', `${2 + (i % 3)}px`);
    sparks.append(sp);
  }
  const stage = el('div', 'wn-stage');
  const foot = el('div', 'wn-foot');
  const dots = el('div', 'wn-dots');
  const btn = el('button', 'hm-btn wn-btn', 'Seguir');
  foot.append(dots, btn);
  o.append(bg, el('div', 'wn-shade'), sparks, stage, foot);

  type Beat = { el: HTMLElement; enter?: () => void; label: () => string; next?: () => boolean };
  const beats: Beat[] = [];

  // 1 · Superado
  {
    const b = el('section', 'wn-beat wn-done');
    const pol = el('figure', 'wn-polaroid');
    const pi = el('img') as HTMLImageElement;
    pi.src = COVERS[n - 1];
    pi.alt = '';
    pol.append(pi, el('figcaption', '', lv.place));
    const txt = el('div', 'wn-txt');
    txt.append(el('div', 'wn-kicker', `Capítulo ${n} · superado`), el('h1', 'wn-title', lv.name));
    if (result) {
      const stars = el('div', 'wn-stars');
      for (let i = 0; i < 3; i++) {
        const st = el('span', i < result.stars ? 'on' : '');
        st.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z"/></svg>';
        st.style.animationDelay = `${0.9 + i * 0.28}s`;
        stars.append(st);
      }
      const stats = el('div', 'wn-stats');
      result.stats.forEach(([k, v], i) => {
        const c = el('div', 'wn-stat', `<b>${v}</b><span>${k}</span>`);
        c.style.animationDelay = `${1.8 + i * 0.12}s`;
        stats.append(c);
      });
      txt.append(stars, stats);
      setTimeout(() => {
        for (let i = 0; i < result.stars; i++) setTimeout(() => audio.pickup(), i * 280);
      }, 900);
    }
    b.append(pol, txt);
    beats.push({ el: b, label: () => (gift ? 'Ver tu regalo' : 'Seguir') });
  }

  // 2 · El regalo
  let giftOpen = !gift;
  if (gift) {
    const b = el('section', 'wn-beat wn-gift');
    const kick = el('div', 'wn-kicker', 'Tu regalo de este capítulo');
    const env = el('button', 'wn-env');
    env.append(el('div', 'wn-env-back'), el('div', 'wn-env-front'), el('div', 'wn-env-flap'), el('div', 'wn-env-seal', '♥'));
    const hint = el('p', 'wn-hint', 'Toca el sobre para abrirlo');
    const ticket = el('div', 'wn-ticket');
    const stub = el('div', 'wn-stub');
    stub.append(el('div', 'wn-stub-icon', gift.icon), el('div', 'wn-stub-num', `Nº ${String(n).padStart(2, '0')}`));
    const main = el('div', 'wn-tmain');
    // El título, letra a letra (cada palabra junta, para que no se parta al cambiar de línea)
    const T0 = 3.0, STEP = 0.05;
    let k = 0;
    const title = el('h2', 'wn-ttitle' + (gift.title.length > 55 ? ' long' : ''));
    gift.title.split(' ').forEach((w, wi) => {
      if (wi) title.append(document.createTextNode(' '));
      const ws = el('span', 'wn-w');
      for (const ch of w) {
        const c = el('span', 'wn-ch', ch);
        c.style.setProperty('--d', `${(T0 + k++ * STEP).toFixed(2)}s`);
        ws.append(c);
      }
      title.append(ws);
    });
    const after = T0 + k * STEP + 0.3;
    const desc = el('p', 'wn-tdesc', gift.description);
    const redeem = el('div', 'wn-tredeem', gift.howToRedeem);
    desc.style.setProperty('--d', `${after.toFixed(2)}s`);
    redeem.style.setProperty('--d', `${(after + 0.9).toFixed(2)}s`);
    main.append(el('div', 'wn-tlabel', 'Tu vale regalo'), title, desc, redeem);
    ticket.append(stub, main);
    const revealAt = (after + 1.6) * 1000;
    const saved = el('p', 'wn-hint wn-saved', 'Queda guardado en la ficha del capítulo');
    b.append(kick, env, hint, ticket, saved);
    // Se descubre despacio: el sobre se abre, el vale sube muy borroso y se va enfocando, y el título sale letra a
    // letra; luego lo demás y, al final, la fiesta. Tocar el botón a medias lo enseña entero de golpe.
    let revealed = false;
    let party = 0;
    const finish = () => {
      if (revealed) return;
      revealed = true;
      clearTimeout(party);
      b.classList.add('revealed');
      audio.cheer(0.35);
      cssConfetti(o, 90);
      vibrate([20, 30, 50]);
      refresh();
    };
    const open = () => {
      if (giftOpen) return;
      giftOpen = true;
      b.classList.add('open');
      audio.pop();
      vibrate([30, 40, 60]);
      setTimeout(() => audio.chime(1), 2400);
      party = window.setTimeout(finish, revealAt);
      refresh();
    };
    env.onclick = open;
    beats.push({
      el: b,
      label: () => (!giftOpen ? 'Abrir el sobre' : revealed ? 'Seguir' : 'Verlo ya'),
      next: () => {
        if (!giftOpen) return open(), false;
        if (!revealed) {
          b.classList.add('fast');
          return finish(), false;
        }
        return true;
      },
    });
  }

  // 3 · Lo nuevo del álbum
  const photos: Shot[] = memoriesFor(n);
  if (photos.length) {
    const b = el('section', 'wn-beat wn-album');
    b.append(el('div', 'wn-kicker', `Nuevo en tu álbum · ${shotsLabel(photos)}`));
    const fan = el('div', 'wn-fan');
    const shown = photos.slice(0, 5);
    shown.forEach((m, i) => {
      const t = el('button', 'wn-photo' + (m.chat ? ' chat' : '') + (m.sticker ? ' sticker' : ''));
      const mid = (shown.length - 1) / 2;
      t.style.setProperty('--r', `${(i - mid) * 7}deg`);
      t.style.setProperty("--x", `${(i - mid) * 82}%`);
      t.style.setProperty('--y', `${Math.abs(i - mid) * 6}%`);
      t.style.animationDelay = `${0.15 + i * 0.12}s`;
      t.append(thumb(m));
      t.onclick = () => lightbox(photos, i);
      fan.append(t);
    });
    b.append(fan, el('p', 'wn-hint', 'Toca para verlos'));
    beats.push({ el: b, label: () => (nextTeaser ? 'Seguir' : 'Volver al menú') });
  }

  // 4 · El siguiente
  if (nextTeaser) {
    const nlv = LEVELS[nextTeaser - 1];
    const d = openDay(nextTeaser - 1);
    const days = daysUntil(d);
    const b = el('section', 'wn-beat wn-next');
    const card = el('div', 'wn-ncard');
    const ni = el('img') as HTMLImageElement;
    ni.src = COVERS[nextTeaser - 1];
    ni.alt = '';
    card.append(ni, el('div', 'wn-lock', days <= 0 ? '✦' : '🔒'));
    const txt = el('div', 'wn-txt');
    const quote = TEASERS[nextTeaser] ? (TEASERS[nextTeaser].startsWith('«') ? TEASERS[nextTeaser] : `«${TEASERS[nextTeaser]}»`) : nlv.name;
    txt.append(el('div', 'wn-kicker', `Capítulo ${nextTeaser}`));
    if (days <= 0) txt.append(el('h1', 'wn-title', 'Ya puedes jugarlo'));
    else {
      // Solo lo que falta, al minuto (sin decir qué día es)
      txt.append(el('div', 'wn-ct-label', 'Se abre dentro de'));
      const ct = el('div', 'wn-ct');
      const cell = (k: string) => {
        const c = el('div', 'wn-ct-cell');
        const v = el('b', '', '0');
        c.append(v, el('span', '', k));
        ct.append(c);
        return v;
      };
      const [dd, hh, mm] = [cell('días'), cell('horas'), cell('min')];
      let first = true;
      const tick = () => {
        // (la primera vez la pantalla aún no está montada: solo se para cuando ya se ha cerrado)
        if (!first && !o.isConnected) return clearInterval(iv);
        first = false;
        const l = left(d);
        dd.textContent = String(l.d);
        hh.textContent = String(l.h).padStart(2, '0');
        mm.textContent = String(l.m).padStart(2, '0');
      };
      const iv = window.setInterval(tick, 10000);
      tick();
      txt.append(ct);
    }
    txt.append(el('p', 'wn-quote', quote));
    b.append(card, txt);
    beats.push({ el: b, label: () => 'Volver al menú' });
  }

  let cur = 0;
  beats.forEach((bt, i) => {
    stage.append(bt.el);
    dots.append(el('i', i === 0 ? 'on' : ''));
  });
  const refresh = () => {
    btn.textContent = beats[cur].label();
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === cur));
  };
  const show = (i: number) => {
    beats.forEach((bt, k) => {
      bt.el.classList.toggle('in', k === i);
      bt.el.classList.toggle('past', k < i);
    });
    cur = i;
    beats[i].enter?.();
    refresh();
  };
  btn.onclick = () => {
    const bt = beats[cur];
    if (bt.next && !bt.next()) return;
    if (cur < beats.length - 1) {
      audio.whoosh();
      show(cur + 1);
    } else onClose();
  };
  dots.hidden = beats.length < 2;
  root.append(o);
  setTimeout(() => show(0), 30);
  audio.fanfare();
  setTimeout(() => cssConfetti(o, 50), 700);
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
    } else if (m.video) {
      const v = el('video') as HTMLVideoElement;
      v.src = m.video;
      v.poster = m.src ?? '';
      v.controls = true;
      v.playsInline = true;
      v.autoplay = true;
      v.className = 'ap-video';
      stageEl.append(v);
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
    stageEl.querySelector('video')?.pause();
    i = Math.max(0, Math.min(items.length - 1, i + d));
    show();
  };
  prev.onclick = (e) => (e.stopPropagation(), go(-1));
  next.onclick = (e) => (e.stopPropagation(), go(1));
  const close = () => {
    stageEl.querySelector('video')?.pause();
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
 * Menú principal: el capítulo que toca, con su portada bien grande (si aún no se ha abierto, borrosa y con la cuenta
 * atrás), y debajo el calendario con los nueve capítulos. El álbum y los ajustes, arriba.
 */
export function mapScreen(save: SaveData, opts: MapOptions, tab: Tab = lastTab) {
  const switching = !!root.querySelector('.hm-screen');
  clearScreens();
  lastTab = tab;
  const done = new Set(save.levelsDone);
  const s = el('div', 'screen hm-screen' + (switching ? ' still' : ''));
  const head = el('header', 'hm-head');
  const brand = el('div', 'hm-brand');
  brand.append(el('div', 'hm-logo', 'Para <em>Azul</em>'), el('div', 'hm-sub', opts.test && !faking() ? 'Modo prueba · todo abierto' : `${save.levelsDone.length} de ${LEVELS.length} capítulos`));
  const btns = el('div', 'hm-head-btns');
  if (tab === 'album') {
    const back = el('button', 'hm-icon', '‹');
    back.setAttribute('aria-label', 'Volver');
    back.onclick = () => mapScreen(save, opts, 'story');
    btns.append(back);
  } else {
    const seen = MEMORIES.filter((m) => opts.test || done.has(m.level)).length + (save.found?.length ?? 0);
    const alb = el('button', 'hm-icon hm-album', `<span>📷</span>${seen ? `<i>${seen}</i>` : ''}`);
    alb.setAttribute('aria-label', 'Álbum');
    alb.onclick = () => mapScreen(save, opts, 'album');
    btns.append(alb);
  }
  const gear = el('button', 'hm-icon', '⚙︎');
  gear.setAttribute('aria-label', 'Ajustes');
  gear.onclick = () => settingsSheet(opts);
  btns.append(gear);
  head.append(brand, btns);
  const body = el('main', 'hm-body');
  if (tab === 'album') {
    body.append(el('h2', 'hm-h2', 'Nuestro álbum'));
    albumTab(body, save, opts.test);
  } else storyTab(body, save, opts);
  s.append(head, body);
  root.append(s);
}

function chapterState(i: number, save: SaveData, test: boolean) {
  const done = new Set(save.levelsDone);
  const lv = LEVELS[i];
  const day = openDay(i);
  const early = now() < day.getTime();
  // (en modo prueba todo está abierto, salvo si se está fingiendo otro día para ver el calendario)
  const open = test && !faking();
  const unlocked = open || (!early && (i === 0 || done.has(LEVELS[i - 1].id)));
  return { lv, day, early: early && !open, unlocked, done: done.has(lv.id) };
}

/** Cuenta atrás en vivo (días, horas, minutos y segundos) hasta d, dentro de el. */
function liveCountdown(d: Date) {
  const box = el('div', 'hm-count');
  const pad = (n: number) => String(n).padStart(2, '0');
  const tick = () => {
    if (!box.isConnected && box.dataset.on) return;
    box.dataset.on = '1';
    const l = left(d);
    box.innerHTML = l.d > 0 ? `<b>${l.d}</b><span>${l.d === 1 ? 'día' : 'días'}</span><b>${pad(l.h)}</b><span>h</span><b>${pad(l.m)}</b><span>min</span>` : `<b>${pad(l.h)}</b><span>h</span><b>${pad(l.m)}</b><span>min</span><b>${pad(l.s)}</b><span>s</span>`;
    setTimeout(tick, 1000);
  };
  tick();
  return box;
}

/**
 * El menú de los capítulos, como un mapa: cada capítulo es una parada (su portada en una baldosa, la fecha y el
 * nombre) y un camino de puntos las une, subiendo y bajando, de la primera a la sorpresa final. Lo hecho, en color y
 * con el camino encendido; lo que toca, más grande, latiendo y con su botón; lo cerrado, con la portada y el nombre
 * borrosos y el candado. Se desliza de lado y arranca centrado en el que toca.
 */
function storyTab(body: HTMLElement, save: SaveData, opts: MapOptions) {
  body.classList.add('mp-body');
  const states = LEVELS.map((_, i) => chapterState(i, save, opts.test));
  const allDone = LEVELS.every((l) => save.levelsDone.includes(l.id));
  const nextI = allDone ? LEVELS.length : states.findIndex((c) => !c.done);
  const allOpen = opts.test && !faking();
  const wrap = el('div', 'mp-wrap');
  const track = el('div', 'mp-track');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('mp-path');
  const pathOn = document.createElementNS(NS, 'path');
  const pathOff = document.createElementNS(NS, 'path');
  pathOn.classList.add('on');
  pathOff.classList.add('off');
  svg.append(pathOff, pathOn);
  track.append(svg);
  const nodes: HTMLElement[] = [];
  states.forEach((c, i) => {
    const show = c.unlocked || c.done;
    const isNext = i === nextI;
    const n = el('button', 'mp-node' + (c.done ? ' done' : show ? ' open' : ' locked') + (isNext ? ' next' : ''));
    const tile = el('div', 'mp-tile');
    const im = el('img') as HTMLImageElement;
    im.src = COVERS[i];
    im.alt = '';
    im.loading = 'lazy';
    tile.append(im, el('span', 'mp-badge', c.done ? '✓' : show ? c.lv.emoji : '🔒'));
    const tag = i === 0 ? '🎂 ' : i === LEVELS.length - 1 ? '🎄 ' : '';
    const sub = c.done ? 'Completado' : show ? 'Listo para jugar' : c.early ? (daysUntil(c.day) === 1 ? 'Se abre mañana' : `Faltan ${daysUntil(c.day)} días`) : 'Termina el anterior';
    const lab = el('div', 'mp-label', `<small>${tag}${c.day.getDate()} ${MONTHS[c.day.getMonth()].slice(0, 3)} · Cap. ${c.lv.id}</small><b>${c.lv.name}</b><i>${sub}</i>`);
    n.append(tile, lab);
    if (isNext && c.early) n.append(liveCountdown(c.day));
    n.onclick = () => {
      if (!show) {
        n.classList.remove('nope');
        void n.offsetWidth;
        n.classList.add('nope');
        vibrate(20);
        return;
      }
      // La baldosa es el botón: el que toca (o cualquiera aún sin hacer) empieza al tocarla; uno ya hecho abre su
      // ficha (su vale, sus fotos y «Volver a jugar»)
      if (c.done) chapterSheet(c.lv.id, save, opts);
      else opts.onPlay(c.lv.id);
    };
    nodes.push(n);
    track.append(n);
  });
  const finOpen = allDone || opts.test;
  const fin = el('button', 'mp-node final' + (finOpen ? ' open' : ' locked') + (allDone ? ' next' : ''));
  fin.append(el('div', 'mp-tile heart', '💌'), el('div', 'mp-label', `<small>♥ · Al final</small><b>La sorpresa final</b><i>${finOpen ? 'Tu carta' : 'Cuando termines los nueve'}</i>`));
  // (al final, solo la carta: el crucigrama es ahora uno de los juegos de entre capítulos)
  if (finOpen) fin.onclick = () => opts.onLetter();
  nodes.push(fin);
  track.append(fin);
  // Los «conecta»: un punto más pequeño a medio camino entre dos capítulos, con su día; se abren ese día
  const minis = PUZZLES.map((pz) => {
    const open = allOpen || now() >= puzzleDate(pz).getTime();
    const doneIt = !!save.minis?.includes(pz.id);
    const b = el('button', 'mp-mini' + (doneIt ? ' done' : open ? ' open' : ' locked'));
    b.append(el('span', 'mp-mini-dot', doneIt ? '✓' : open ? pz.icon : '🔒'), el('span', 'mp-mini-lab', `<b>${open || doneIt ? pz.title : 'Conecta'}</b><i>${puzzleDay(pz)}</i>`));
    b.onclick = (e) => {
      e.stopPropagation();
      if (!open) {
        b.classList.remove('nope');
        void b.offsetWidth;
        b.classList.add('nope');
        vibrate(20);
        return;
      }
      audio.unlock();
      runPuzzle(
        pz.id,
        () => {
          save.minis = [...new Set([...(save.minis ?? []), pz.id])];
          persist(save);
          mapScreen(save, opts, 'story');
        },
        () => mapScreen(save, opts, 'story'),
      );
    };
    track.append(b);
    return { b, after: pz.after };
  });
  wrap.append(track);
  body.append(wrap);

  // Dónde va cada parada. Con el móvil en vertical, el camino baja haciendo eses (de arriba abajo, deslizando hacia
  // abajo); en horizontal, va de lado subiendo y bajando. El camino de puntos pasa por sus centros.
  const WAVE = [0.62, 0.3, 0.58, 0.26, 0.6, 0.32, 0.56, 0.28, 0.6, 0.38];
  const SWAY = [0.3, 0.7, 0.32, 0.68, 0.3, 0.7, 0.34, 0.66, 0.3, 0.5];
  const layout = () => {
    if (!wrap.isConnected) return void window.removeEventListener('resize', layout);
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const tall = H > W * 1.05;
    wrap.classList.toggle('tall', tall);
    const pts: [number, number][] = [];
    let TW: number, TH: number;
    if (tall) {
      const tileH = Math.max(80, Math.min(130, W * 0.3));
      const gap = tileH * 2.25;
      const pad = tileH * 0.9 + 10;
      track.style.setProperty('--tile', `${tileH}px`);
      nodes.forEach((n, i) => {
        const x = W * SWAY[i], y = pad + i * gap;
        n.style.left = `${x}px`;
        n.style.top = `${y}px`;
        pts.push([x, y]);
      });
      TW = W;
      TH = pad * 2 + (nodes.length - 1) * gap + tileH;
      track.style.width = '';
      track.style.height = `${TH}px`;
    } else {
      const tileH = Math.max(64, Math.min(120, H * 0.27));
      const gap = tileH * 1.95;
      const pad = Math.max(90, W * 0.18);
      track.style.setProperty('--tile', `${tileH}px`);
      nodes.forEach((n, i) => {
        const x = pad + i * gap;
        const y = 20 + (H - 40 - tileH * 1.9) * WAVE[i] + tileH / 2;
        n.style.left = `${x}px`;
        n.style.top = `${y}px`;
        pts.push([x, y]);
      });
      TW = pad * 2 + (nodes.length - 1) * gap;
      TH = H;
      track.style.width = `${TW}px`;
      track.style.height = '';
    }
    // Cada «conecta», en el punto medio del tramo entre su capítulo y el siguiente
    {
      const tl = tall ? Math.max(80, Math.min(130, W * 0.3)) : Math.max(64, Math.min(120, H * 0.27));
      const hw2 = tl * 0.72, hh2 = tl * 0.56;
      for (const mn of minis) {
        const [x0, y0] = pts[mn.after - 1], [x1, y1] = pts[mn.after];
        let mx: number, my: number;
        if (tall) {
          const sx = x0 + Math.sign(x1 - x0 || 1) * hw2, ey = y1 - hh2;
          mx = (sx + 7 * x1) / 8;
          my = (7 * y0 + ey) / 8;
        } else {
          const sx = x0 + hw2, ex = x1 - hw2;
          mx = (sx + ex) / 2;
          my = (y0 + y1) / 2;
        }
        mn.b.style.left = `${mx}px`;
        mn.b.style.top = `${my}px`;
      }
    }
    svg.setAttribute('width', String(TW));
    svg.setAttribute('height', String(TH));
    svg.setAttribute('viewBox', `0 0 ${TW} ${TH}`);
    // Cada tramo sale del lado de una baldosa y llega a la siguiente por arriba (en vertical) o por su lado (en
    // horizontal): así no pasa nunca por encima del rótulo, que va debajo de la baldosa
    const tile = parseFloat(track.style.getPropertyValue('--tile')) || 100;
    const hw = tile * 0.72, hh = tile * 0.56;
    const seg = (from: number, to: number) => {
      let d = '';
      for (let i = from + 1; i <= to; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        if (tall) {
          const sx = x0 + Math.sign(x1 - x0 || 1) * hw, ey = y1 - hh;
          d += ` M ${sx} ${y0} C ${x1} ${y0}, ${x1} ${y0}, ${x1} ${ey}`;
        } else {
          const sx = x0 + hw, ex = x1 - hw;
          const mx = (sx + ex) / 2;
          d += ` M ${sx} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${ex} ${y1}`;
        }
      }
      return d.trim();
    };
    const lit = Math.min(nodes.length - 1, Math.max(0, nextI));
    pathOff.setAttribute('d', seg(0, nodes.length - 1));
    pathOn.setAttribute('d', lit > 0 ? seg(0, lit) : '');
    const focus = pts[lit];
    if (tall) wrap.scrollTop = Math.max(0, focus[1] - H * 0.45);
    else wrap.scrollLeft = Math.max(0, focus[0] - W / 2);
  };
  requestAnimationFrame(layout);
  window.addEventListener('resize', layout);
  // Al día: si hay una versión nueva descargada, se aplica aquí (en el mapa)
  tryApply();
}

/**
 * La ficha de un capítulo, a pantalla completa y con el aire de la home (antes, un panel que subía desde abajo): la
 * portada grande con su nombre, lo que lleva hecho, una frase de lo que viene, su vale si ya lo ha ganado y Jugar.
 */
function chapterSheet(id: number, save: SaveData, opts: MapOptions) {
  const lv = LEVELS[id - 1];
  const doneIt = save.levelsDone.includes(id);
  const kp = keepsakesFor(id);
  const found = kp.filter((k) => save.found?.includes(k.id)).length;
  const photos = memoriesFor(id);
  const o = el('div', 'screen cp-screen');
  const hero = el('header', 'cp-hero');
  const img = el('img', 'cp-cover') as HTMLImageElement;
  img.src = COVERS[id - 1];
  img.alt = '';
  const ht = el('div', 'cp-hero-txt');
  ht.append(el('div', 'cp-chip', `Capítulo ${id} · ${longDate(openDay(id - 1))}`), el('h1', 'cp-title', lv.name), el('p', 'cp-place', lv.place));
  hero.append(img, el('div', 'cp-shade'), ht);
  const back = el('button', 'cp-back', '‹');
  back.setAttribute('aria-label', 'Volver');
  const body = el('main', 'cp-body');
  // Cómo se juega (una frase, la de cada capítulo) y, debajo, lo que se lleva. La frase va arriba: abajo quedaba
  // tapada por el botón de Jugar en el móvil apaisado
  if (!doneIt) body.append(el('div', 'cp-kicker', 'De qué va'), el('p', 'cp-how', lv.how));
  body.append(el('div', 'cp-kicker', doneIt ? 'Lo que te llevaste' : 'Lo que te llevas'));
  const list = el('div', 'cp-list');
  const item = (icon: string, title: string, sub: string, cls = '') => {
    const r = el('div', 'cp-item ' + cls);
    r.append(el('div', 'cp-ico', icon), el('div', 'cp-item-txt', `<b>${title}</b><span>${sub}</span>`));
    list.append(r);
    return r;
  };
  const gift = GIFTS.find((g) => g.level === id && save.giftsUnlocked.includes(g.id));
  if (gift) {
    const ticket = el('div', 'wn-ticket cp-ticket');
    const stub = el('div', 'wn-stub');
    stub.append(el('div', 'wn-stub-icon', gift.icon), el('div', 'wn-stub-num', `Nº ${String(id).padStart(2, '0')}`));
    const main = el('div', 'wn-tmain');
    main.append(el('div', 'wn-tlabel', 'Tu vale regalo'), el('h2', 'wn-ttitle' + (gift.title.length > 55 ? ' long' : ''), gift.title), el('p', 'wn-tdesc', gift.description), el('div', 'wn-tredeem', gift.howToRedeem));
    ticket.append(stub, main);
    list.append(ticket);
  } else if (GIFTS.some((g) => g.level === id)) {
    const r = item('♥', 'Un regalo de verdad', 'Se abre al terminar el capítulo', 'sealed');
    r.querySelector('.cp-ico')!.classList.add('seal');
  }
  if (photos.length) item('📸', `${shotsLabel(photos)} para tu álbum`, doneIt ? 'Ya están en el álbum' : 'De aquellos días: se guardan al terminar');
  if (kp.length) item('✨', `${kp.length} recuerdos escondidos`, `${found} de ${kp.length} encontrados · son polaroids que brillan: acércate`);
  if (doneIt) item('✓', 'Completado', 'Puedes volver a jugarlo cuando quieras', 'done');
  body.append(list);
  const play = el('button', 'hm-btn cp-play', doneIt ? 'Volver a jugar' : 'Jugar');
  const foot = el('div', 'cp-foot');
  foot.append(play);
  body.append(foot);
  const close = () => {
    o.classList.add('out');
    setTimeout(() => o.remove(), 220);
  };
  back.onclick = close;
  play.onclick = () => {
    o.remove();
    opts.onPlay(id);
  };
  o.append(hero, body, back);
  root.append(o);
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
    } else card.append(el('div', 'ap-photo-lock', `✨<small>Escondido en el capítulo ${k.chapter}</small>`));
    g2.append(card);
  });
  body.append(g2);
}

/** «3 fotos», «3 fotos y un vídeo», «1 foto»… (lo del álbum de cada capítulo). */
function shotsLabel(list: Shot[]) {
  const v = list.filter((m) => m.video).length, f = list.length - v;
  const fs = f === 1 ? '1 foto' : `${f} fotos`, vs = v === 1 ? 'un vídeo' : `${v} vídeos`;
  return f && v ? `${fs} y ${vs}` : v ? (v === 1 ? '1 vídeo' : vs) : fs;
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
  if (m.video) {
    const w = el('div', 'vid-thumb');
    w.append(img, el('span', 'wn-play', '▶'));
    return w;
  }
  return img;
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
      b.append(reset, el('p', 'ap-note', 'Modo prueba: cinco toques en «De Gas» en la portada para quitarlo.'));
    }
    // La versión que tiene (para saber, si algo no cuadra, si está al día)
    const when = /^\d+$/.test(BUILD) ? new Date(Number(BUILD)) : null;
    const stamp = when ? `${when.getDate()} ${MONTHS[when.getMonth()].slice(0, 3)}, ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}` : BUILD;
    b.append(el('p', 'ap-note ap-version', `Versión del ${stamp}`));
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
      ['✦', 'Qué hacer', 'Mira alrededor y escucha a la gente: lo irás descubriendo.'],
      ['✨', 'Recuerdos escondidos', 'En cada capítulo hay polaroids escondidas que brillan: acércate y van a tu álbum.'],
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
export function crossword(onSolved: () => void, onBack: () => void, doneLabel = 'Abrir la carta 💌') {
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
  const finish = el('button', 'big-btn', doneLabel);
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


/** Al acabar un capítulo: sus fotos caen sobre la mesa y pasan al álbum. */

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
  // Su portada de fondo (la del menú), el número, el nombre y dónde y cuándo pasó
  const img = el('img', 'cc-cover') as HTMLImageElement;
  img.src = COVERS[n - 1];
  img.alt = '';
  c.append(img, el('div', 'cc-shade'), el('div', 'num', `Capítulo ${n}`), el('h1', '', lv.name), el('div', 'place', lv.place), load);
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

export function toast(text: string) {
  const t = el('div', 'toast', text);
  root.append(t);
  setTimeout(() => t.remove(), 1900);
}

/**
 * Onomatopeya de tebeo («¡SPLASH!», «¡PAF!») que salta en la parte de arriba-centro, girada, con su estallido
 * detrás, y se va. Solo en los capítulos de cómic.
 */
export function comicWord(text: string, kind: string) {
  // (los globos de onomatopeya con puntas, quitados de todos los niveles: Marc dice que solo molestan)
  if (!SHOW_POW) return;
  root.querySelectorAll('.pow').forEach((n) => n.remove());
  const w = el('div', `pow pow-${kind}`);
  w.append(el('span', '', text));
  const W = window.innerWidth, H = window.innerHeight;
  // Donde no tape un bocadillo, el diálogo ni un panel (antes caía encima del «¡Sienta!» de Gas en el parque)
  const busy = [...root.querySelectorAll('.bark, .trick-say, .dialogue, .gauge, .side-panel, .objective, .kp-pop, .rhythm')]
    .map((n) => n.getBoundingClientRect())
    .filter((r) => r.width > 4 && r.height > 4);
  const hw = Math.min(150, W * 0.3), hh = 50;
  let x = W / 2, y = H * 0.36;
  for (let i = 0; i < 12; i++) {
    const cx = W * (0.5 + (Math.random() - 0.5) * (i < 6 ? 0.36 : 0.6));
    const cy = H * (i < 6 ? 0.3 + Math.random() * 0.12 : 0.22 + Math.random() * 0.4);
    x = cx;
    y = cy;
    if (!busy.some((r) => cx + hw > r.left && cx - hw < r.right && cy + hh > r.top && cy - hh < r.bottom)) break;
  }
  w.style.left = `${x}px`;
  w.style.top = `${y}px`;
  w.style.setProperty('--rot', `${(Math.random() - 0.5) * 22}deg`);
  root.append(w);
  setTimeout(() => w.remove(), 1100);
}

let barkEnd = 0;
let barkRaf = 0;
let castChapter = 1;
/** El capítulo que se juega: decide cómo se llaman los dos en pantalla. */
export function setCastChapter(n: number) {
  castChapter = n;
}
/**
 * Hasta el capítulo de las zamburiñas (el 3) son Marc y Margaux; a partir del 4, Gas y Azul. Los textos usan uno u
 * otro nombre según dónde se escribieron: lo que se ve lo decide esto.
 */
export function shownName(who: string) {
  const early = castChapter <= 3;
  if (/^(Azul|Margaux)$/.test(who)) return early ? 'Margaux' : 'Azul';
  if (/^(Gas|Marc)$/.test(who)) return early ? 'Marc' : 'Gas';
  return who;
}

const SHOW_POW = false;

/** Una frase al andar: bocadillo sobre quien habla (o arriba, si no se le ve). No para nada ni recoge toques. */
export function bark(who: string, text: string, side?: 'l' | 'r', waited = 0) {
  // (los mensajes de móvil sueltos, el bocadillo verde con 📱, no salen en ningún nivel: los chats van en el móvil)
  if (text.startsWith('(WhatsApp) ') || text.startsWith('📱')) return;
  // Con un diálogo abierto, el comentario espera a que acabe (salían los dos a la vez, uno encima del otro)
  if (root.querySelector('.dialogue')) {
    if (waited < 8000) later(() => bark(who, text, side, waited + 300), 300);
    return;
  }
  root.querySelectorAll('.bark').forEach((n) => n.remove());
  cancelAnimationFrame(barkRaf);
  const wa = text.startsWith('(WhatsApp) ');
  const body = wa ? text.slice(11) : text;
  const t = el('div', 'bark ' + whoClass(who) + (wa ? ' wa' : ''));
  t.append(el('b', '', wa ? `📱 ${shownName(who)}` : shownName(who)), el('span', '', body));
  root.append(t);
  barkEnd = performance.now() + 2100 + Math.min(2400, body.length * 55);
  const place = () => {
    if (!t.isConnected) return;
    const left = barkEnd - performance.now();
    if (left <= 0) return void t.remove();
    t.style.opacity = String(Math.min(1, left / 300));
    const at = wa ? null : speakerAt(who);
    const W = window.innerWidth;
    if (at && at.below) {
      // Conduciendo: pegado al vehículo, a su lado y a la altura de la carrocería, con el rabito hacia el asiento de
      // quien habla (ni encima del coche ni lejos: la carretera de delante, despejada)
      const w = t.offsetWidth, h = t.offsetHeight, H = window.innerHeight;
      const sd = side ?? at.side ?? 'r';
      const gap = 34; // del asiento al borde del coche, más un respiro
      const want = sd === 'l' ? at.x - gap - w : at.x + gap;
      const left = Math.min(Math.max(want, 8), W - w - 8);
      t.style.left = `${left}px`;
      t.style.top = `${Math.min(Math.max(at.y + 6 - h / 2, 70), H - h - 10)}px`;
      t.style.setProperty('--tail-y', `${Math.min(h - 12, Math.max(12, at.y + 6 - (Math.min(Math.max(at.y + 6 - h / 2, 70), H - h - 10))))}px`);
      t.classList.remove('to-l', 'to-r');
      t.classList.add('anchored', 'below', sd === 'l' ? 'to-r' : 'to-l');
    } else if (at && at.y > 90) {
      t.classList.remove('below');
      const w = t.offsetWidth, h = t.offsetHeight;
      // De lado (dos que hablan uno junto al otro, como en el coche): el globo se abre hacia su lado y el rabito
      // apunta a quien habla
      const sd = side ?? at.side;
      const want = sd === 'l' ? at.x - w + 30 : sd === 'r' ? at.x - 30 : at.x - w / 2;
      const left = Math.min(Math.max(want, 10), W - w - 10);
      t.style.left = `${left}px`;
      t.style.top = `${Math.max(at.y - h - 16, 72)}px`;
      t.style.setProperty('--tail-x', `${Math.min(w - 16, Math.max(16, at.x - left))}px`);
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
  txt.append(el('b', '', `✨ Recuerdo escondido ${found}/${total} · al álbum`), el('span', '', k.caption));
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
let speakerAt: (who: string) => { x: number; y: number; side?: 'l' | 'r'; below?: boolean } | null = () => null;
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
  // (el comentario suelto que hubiera, fuera: el diálogo manda)
  root.querySelectorAll('.bark').forEach((n) => n.remove());
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
    who.textContent = wa ? `📱 ${shownName(ln.who)}` : shownName(ln.who);
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

/**
 * Hacer una foto de verdad: el visor del móvil encima de la escena (sin paneles), el encuadre se mueve con el pulso
 * y hay que disparar cuando lo que se quiere sale dentro. `target` da dónde está en pantalla (px) en cada momento.
 * Devuelve la calidad (1 = centrado, ~0.6 = dentro pero en el borde, 0 = fuera) y una función para cancelarlo.
 */
export function viewfinder(o: { title: string; target: () => { x: number; y: number } | null; sway?: number }, onResult: (quality: number) => void) {
  const w = el('div', 'vf');
  const frame = el('div', 'vf-frame');
  frame.append(el('i', 'c tl'), el('i', 'c tr'), el('i', 'c bl'), el('i', 'c br'), el('i', 'vf-cross'));
  const title = el('div', 'vf-title', o.title);
  const shot = el('button', 'vf-shot') as HTMLButtonElement;
  shot.setAttribute('aria-label', 'Hacer la foto');
  w.append(frame, title, shot);
  root.append(w);
  const sway = o.sway ?? 1;
  const t0 = performance.now();
  let raf = 0;
  let fx = 0, fy = 0;
  const loop = () => {
    const t = (performance.now() - t0) / 1000;
    // el pulso: dos ondas lentas que no se repiten igual
    fx = (Math.sin(t * 1.35) * 0.6 + Math.sin(t * 2.9 + 1) * 0.4) * 0.2 * sway;
    fy = (Math.sin(t * 1.7 + 2) * 0.6 + Math.sin(t * 3.4) * 0.4) * 0.16 * sway;
    // (el encuadre ronda lo que hay que fotografiar: a ratos le pasa por encima, a ratos se va)
    const p = o.target();
    const W = window.innerWidth, H = window.innerHeight;
    const bx = p ? Math.min(W * 0.8, Math.max(W * 0.2, p.x)) : W / 2, by = p ? Math.min(H * 0.75, Math.max(H * 0.25, p.y)) : H / 2;
    frame.style.left = `${bx + fx * W}px`;
    frame.style.top = `${by + fy * H}px`;
    raf = requestAnimationFrame(loop);
  };
  loop();
  const end = () => {
    cancelAnimationFrame(raf);
    w.remove();
  };
  shot.onpointerdown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const r = frame.getBoundingClientRect();
    const p = o.target();
    let q = 0;
    if (p) {
      const dx = Math.abs(p.x - (r.left + r.width / 2)) / (r.width / 2);
      const dy = Math.abs(p.y - (r.top + r.height / 2)) / (r.height / 2);
      const d = Math.max(dx, dy);
      if (d < 0.8) q = d < 0.35 ? 1 : 1 - ((d - 0.35) / 0.45) * 0.4;
    }
    w.classList.add('snap');
    setTimeout(() => {
      end();
      onResult(q);
    }, 260);
  };
  return end;
}

export interface GaugeOptions {
  title: string;
  zones: GaugeZone[];
  /** Segundos que tarda la aguja en recorrer la barra entera. */
  duration: number;
  button: string;
  /** Botón trampa que aparece a ratos (la nata). */
  trap?: { label: string; onPress: () => void };
  /** Cada fotograma, dónde va la aguja (0…1): para que la escena lo enseñe (el guanciale que se dora). */
  onTick?: (x: number) => void;
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
    o.onTick?.(x);
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
  const contact = shownName(frags[0].contact);
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
  // (varios trozos del mismo día: la fecha una sola vez; entre trozos, la hora si hay un salto, como en el chat real)
  let prevDate = '';
  let last = -1;
  for (const f of frags) {
    if (f.date !== prevDate) {
      items.push({ kind: 'date', text: f.date });
      last = -1;
    }
    prevDate = f.date;
    let prev: boolean | null = null;
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
    hint.textContent = 'Toca para seguir ▸';
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

const EMOJI = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u;
/** El icono de una acción: el emoji de su texto (o uno según lo que diga, si no lleva). */
function actionIcon(label: string) {
  const m = label.match(EMOJI);
  if (m) return m[0];
  if (/hablar|decir|saludar/i.test(label)) return '💬';
  if (/buu/i.test(label)) return '👻';
  return '✋';
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
export const pauseState = { on: false, title: '', n: 0 };
let pauseOpener: (() => void) | null = null;
/** El objetivo de la misión en marcha (en la pausa manda sobre el del capítulo). */
let missionObj = '';
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
  // Ayuda que llega poco a poco, para que primero mire y escuche: con cada objetivo nuevo solo destella la estrella;
  // a los 15 s (sin contar conversaciones) se lee el texto y, a los 40 s sin avanzar, la flecha. (No hay ayuda a demanda.)
  // (La flecha la decide cada capítulo con `Lost`: sale tras 40 s sin avanzar o al pedir pista.)
  const TEXT_AFTER = 15000;
  let textShown = false;
  let textTimer = 0;
  // (sin ayuda a demanda: tocarla solo vuelve a enseñar el objetivo si ya se puede leer)
  obj.onpointerdown = (e) => {
    e.stopPropagation();
    if (textShown) expand(4500);
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
    // Como las fichas del menú: la portada del capítulo, su nombre en la letra de los títulos y el botón dorado
    pause = el('div', 'pause');
    const card = el('div', 'pause-card');
    const art = el('div', 'pc-art');
    const acts = el('div', 'pc-acts');
    const n = pauseState.n;
    if (n) {
      const img = el('img', 'pc-cover') as HTMLImageElement;
      img.src = COVERS[n - 1];
      img.alt = '';
      art.append(img);
    }
    const txt = el('div', 'pc-txt');
    txt.append(el('div', 'hm-chip dark', n ? `Capítulo ${n} · En pausa` : 'En pausa'), el('h2', 'pc-title', n ? LEVELS[n - 1].name : pauseState.title || 'En pausa'));
    const shownObj = missionObj || lastObj;
    if (shownObj) txt.append(el('p', 'pause-obj', `<span>✦</span>${shownObj}`));
    art.append(txt);
    card.append(art, acts);
    const resume = el('button', 'hm-btn pc-go', 'Seguir');
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
    acts.append(resume, sound, help);
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
      acts.append(dbg);
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
    acts.append(leave);
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
  // (los contadores, en la misma barra que el objetivo: una sola fila arriba)
  top.append(obj, counters, el('div', 'spacer'));
  // El botón de pausa, aparte y siempre encima: los minijuegos, los chats y las misiones esconden la barra de arriba
  // (antes, con ella se iba la pausa: en el vóley o el agility del último capítulo no había forma de pausar)
  if (!mission) {
    menuBtn.classList.add('pause-fab');
    root.append(menuBtn);
  }

  const act = el('button', 'action-btn hidden' + (mission ? ' m-hud' : ''));
  act.onpointerdown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onAction();
  };
  // (la ayuda de los controles ya la dan los primeros pasos y «Cómo se juega»)
  void hintText;
  const hint = el('div', 'hint-move');
  root.append(top, act);
  return {
    root: top,
    setObjective: (t) => {
      if (t === lastObj) return;
      lastObj = t;
      if (mission) missionObj = t;
      objText.textContent = t;
      obj.classList.toggle('empty', !t);
      textShown = false;
      obj.classList.remove('open', 'fresh');
      clearTimeout(textTimer);
      if (!t) return;
      // En los minijuegos la instrucción hace falta ya; en el paseo, primero descubrir
      if (mission) return expand(5500);
      void obj.offsetWidth;
      obj.classList.add('fresh');
      const reveal = () => {
        if (textShown) return;
        // Mientras alguien habla no cuenta: se espera a que acabe la conversación
        if (document.querySelector('#ui .dialogue')) return void (textTimer = window.setTimeout(reveal, 3000));
        textShown = true;
        expand(5500);
      };
      textTimer = window.setTimeout(reveal, TEXT_AFTER);
    },
    setArrow: (a) => {
      // Sin dirección, la estrella; con dirección (perdida o tras pedir pista), la flecha que apunta
      const glyph = a === null ? '✦' : '⬆';
      if (arrow.textContent !== glyph) arrow.textContent = glyph;
      arrow.style.transform = a === null ? '' : `rotate(${a}rad)`;
    },
    setCounters: (h) => {
      if (counters.innerHTML !== h) counters.innerHTML = h;
    },
    setAction: (label, pulse) => {
      act.classList.toggle('hidden', !label);
      act.classList.toggle('pulse', !!pulse);
      // Solo el icono: el texto queda para la accesibilidad
      if (label && act.title !== label) {
        act.title = label;
        act.setAttribute('aria-label', label);
        act.textContent = actionIcon(label);
      }
    },
    remove: () => {
      clearTimeout(objTimer);
      closePause();
      if (pauseOpener === openIt) pauseOpener = null;
      if (mission) missionObj = '';
      top.remove();
      counters.remove();
      act.remove();
      hint.remove();
      menuBtn.remove();
    },
  };
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
  setTimeout(() => c.remove(), 2600);
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
    toast('✨ ¡Listo! Ya sabes moverte');
    this.wrap.classList.add('bye');
    setTimeout(() => this.wrap.remove(), 500);
  }

  dispose() {
    this.done = true;
    this.wrap.remove();
  }
}

/**
 * Fallo de una prueba: el capítulo se para y sale una tarjeta con lo que ha pasado y un solo botón, «Otra vez»,
 * que vuelve a empezar esa parte (no el capítulo). Sin ✕: para seguir hay que hacerlo bien.
 */
export function failCard(title: string, text: string, retry: () => void) {
  if (root.querySelector('.fail-back')) return;
  closeDialogue();
  root.querySelectorAll('.bark').forEach((n) => n.remove());
  pauseState.on = true;
  audio.knock(0.5, 140, 0.25);
  const back = el('div', 'ap-sheet-back fail-back');
  const sh = el('div', 'ap-sheet fail-card');
  const b = el('button', 'hm-btn pc-go', 'Otra vez');
  sh.append(el('div', 'ap-sheet-emoji', '😵'), el('h2', '', title), el('p', 'ap-sheet-place', text), b);
  back.append(sh);
  root.append(back);
  requestAnimationFrame(() => back.classList.add('on'));
  b.onclick = () => {
    back.classList.remove('on');
    setTimeout(() => back.remove(), 260);
    pauseState.on = false;
    fadeFlash(retry, 250);
  };
}
