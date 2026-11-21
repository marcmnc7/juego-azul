// Los «conecta» en pantalla: un marco común (la noche de fondo, el papel crema encima, como el crucigrama y la carta)
// y cada juego dentro. Al acabar, «¡Hecho!» y de vuelta al mapa (se guarda como hecho).
import { audio } from '../core/audio';
import { vibrate } from '../core/gfx';
import { MEMORIES } from '../data/memories';
import { PUZZLES, WHO_SAID, SOUP_WORDS, TIMELINE, FILL, HANGMAN, EMOJI_ROUNDS, type PuzzleInfo } from '../data/puzzles';
import { crossword, clearScreens } from './ui';

const root = () => document.getElementById('ui')!;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
const shuffle = <T>(a: T[]) => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const puzzleDate = (p: PuzzleInfo) => new Date(p.day[0], p.day[1], p.day[2]);
export const puzzleDay = (p: PuzzleInfo) => `${p.day[2]} ${MONTHS[p.day[1]]}`;

/** El marco: cabecera (conecta, título, de qué va), el cuerpo del juego y un pie con Volver. */
function frame(p: PuzzleInfo, onBack: () => void) {
  clearScreens();
  const o = el('div', 'screen pz-screen');
  const card = el('div', 'letter pz-card');
  const head = el('div', 'pz-head');
  head.append(el('div', 'pz-kicker', `${p.icon} Conecta · ${puzzleDay(p)}`), el('h2', '', p.title), el('p', 'pz-sub', p.sub));
  const body = el('div', 'pz-body');
  const status = el('div', 'pz-status');
  card.append(head, status, body);
  const back = el('button', 'link-btn pz-back', '‹ Volver');
  back.onclick = onBack;
  o.append(card, back);
  root().append(o);
  return { o, card, body, status };
}

/** Pantalla de hecho, dentro de la misma tarjeta. */
function done(f: ReturnType<typeof frame>, line: string, onDone: () => void) {
  audio.fanfare();
  vibrate([30, 40, 60]);
  f.body.innerHTML = '';
  f.status.textContent = '';
  const w = el('div', 'pz-done');
  w.append(el('div', 'pz-done-ico', '💙'), el('h3', '', '¡Hecho!'), el('p', '', line));
  const b = el('button', 'big-btn', 'Volver al mapa');
  b.onclick = onDone;
  w.append(b);
  f.body.append(w);
}

export function runPuzzle(id: string, onDone: () => void, onBack: () => void) {
  const p = PUZZLES.find((x) => x.id === id)!;
  if (p.kind === 'crucigrama') return crossword(onDone, onBack, '¡Hecho! 💙');
  const f = frame(p, onBack);
  ({ quien, sopa, orden, parejas, completa, ahorcado, emojis } as Record<string, (f: ReturnType<typeof frame>, end: (l: string) => void) => void>)[p.kind](f, (l) => done(f, l, onDone));
}

// ---------------- ¿Quién lo dijo? ----------------
function quien(f: ReturnType<typeof frame>, end: (l: string) => void) {
  const items = shuffle(WHO_SAID).slice(0, 10);
  let i = 0, ok = 0;
  const show = () => {
    f.body.innerHTML = '';
    f.status.textContent = `${i + 1} de ${items.length} · ${ok} bien`;
    const it = items[i];
    const q = el('div', 'pz-quote', `<span>«${it.text}»</span>`);
    const row = el('div', 'pz-row');
    for (const who of ['Azul', 'Gas'] as const) {
      const b = el('button', 'pz-opt ' + (who === 'Azul' ? 'azul' : 'gas'), who === 'Azul' ? '💙 Azul' : '🧡 Gas');
      b.onclick = () => {
        const good = who === it.who;
        if (good) ok++;
        b.classList.add(good ? 'good' : 'bad');
        row.querySelectorAll('button').forEach((x) => ((x as HTMLButtonElement).disabled = true));
        (good ? audio.pickup : audio.boo).call(audio);
        f.body.append(el('p', 'pz-when', `${good ? '¡Sí!' : 'Nop:'} lo escribió ${it.who === 'Azul' ? 'Azul' : 'Gas'} · ${it.when}`));
        setTimeout(() => (++i < items.length ? show() : end(`${ok} de ${items.length}. ${ok >= 8 ? 'Brutal: te sabes el chat de memoria.' : 'Tonses habrá que releer el chat 😜'}`)), 1500);
      };
      row.append(b);
    }
    f.body.append(q, row);
  };
  show();
}

// ---------------- Sopa de letras ----------------
function sopa(f: ReturnType<typeof frame>, end: (l: string) => void) {
  const N = 10;
  const words = SOUP_WORDS.slice();
  const grid: string[][] = [];
  const pos = new Map<string, [number, number][]>();
  const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1]];
  for (let attempt = 0; attempt < 200; attempt++) {
    for (let r = 0; r < N; r++) grid[r] = Array(N).fill('');
    pos.clear();
    let okAll = true;
    for (const w of shuffle(words)) {
      let placed = false;
      for (let t = 0; t < 300 && !placed; t++) {
        const [dr, dc] = DIRS[Math.floor(Math.random() * DIRS.length)];
        const r0 = Math.floor(Math.random() * N), c0 = Math.floor(Math.random() * N);
        const cells: [number, number][] = [];
        let fits = true;
        for (let k = 0; k < w.length; k++) {
          const r = r0 + dr * k, c = c0 + dc * k;
          if (r < 0 || c < 0 || r >= N || c >= N || (grid[r][c] && grid[r][c] !== w[k])) {
            fits = false;
            break;
          }
          cells.push([r, c]);
        }
        if (!fits) continue;
        cells.forEach(([r, c], k) => (grid[r][c] = w[k]));
        pos.set(w, cells);
        placed = true;
      }
      if (!placed) {
        okAll = false;
        break;
      }
    }
    if (okAll) break;
  }
  const ABC = 'ABCDEFGHIJLMNOPRSTUVYZ';
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) grid[r][c] = ABC[Math.floor(Math.random() * ABC.length)];
  const g = el('div', 'pz-soup');
  g.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  const cellEl: HTMLElement[][] = [];
  for (let r = 0; r < N; r++) {
    cellEl[r] = [];
    for (let c = 0; c < N; c++) {
      const d = el('button', 'pz-sc', grid[r][c]);
      d.onclick = () => tap(r, c);
      g.append(d);
      cellEl[r][c] = d;
    }
  }
  const list = el('div', 'pz-words');
  const tags = new Map<string, HTMLElement>();
  for (const w of words) {
    const t = el('span', '', w);
    tags.set(w, t);
    list.append(t);
  }
  const found = new Set<string>();
  let start: [number, number] | null = null;
  const status = () => (f.status.textContent = `${found.size} de ${words.length} · toca la primera letra y luego la última`);
  const tap = (r: number, c: number) => {
    if (!start) {
      start = [r, c];
      cellEl[r][c].classList.add('sel');
      return;
    }
    const [r0, c0] = start;
    cellEl[r0][c0].classList.remove('sel');
    start = null;
    // Vale cualquier línea recta que diga una palabra que falte, en un sentido u otro (NANIT está dentro de BONANIT:
    // antes, si se marcaba esa y no la que había colocado el juego, decía que no)
    const dr = Math.sign(r - r0), dc = Math.sign(c - c0), len = Math.max(Math.abs(r - r0), Math.abs(c - c0)) + 1;
    const straight = (r !== r0 || c !== c0) && (r0 === r || c0 === c || Math.abs(r - r0) === Math.abs(c - c0));
    const line: [number, number][] = straight ? Array.from({ length: len }, (_, k) => [r0 + dr * k, c0 + dc * k] as [number, number]) : [];
    const text = line.map(([rr, cc]) => grid[rr][cc]).join('');
    for (const w of words) {
      if (found.has(w)) continue;
      if (straight && (text === w || [...text].reverse().join('') === w)) {
        const cells = line;
        found.add(w);
        cells.forEach(([rr, cc]) => cellEl[rr][cc].classList.add('found'));
        tags.get(w)!.classList.add('done');
        audio.chime(found.size % 8);
        vibrate(20);
        status();
        if (found.size === words.length) setTimeout(() => end('Todas. Bonanit, amore 😌'), 700);
        return;
      }
    }
    audio.boo();
  };
  status();
  f.body.append(g, list);
}

// ---------------- En orden ----------------
function orden(f: ReturnType<typeof frame>, end: (l: string) => void) {
  let order = shuffle(TIMELINE.map((_, i) => i));
  while (order.every((v, i) => v === i)) order = shuffle(order);
  const list = el('div', 'pz-list');
  let tries = 0;
  const paint = (checked = false) => {
    list.innerHTML = '';
    order.forEach((ti, i) => {
      const t = TIMELINE[ti];
      const row = el('div', 'pz-item' + (checked ? (ti === i ? ' good' : ' bad') : ''));
      row.append(el('span', 'pz-item-ico', t.emoji), el('span', 'pz-item-txt', t.text));
      const up = el('button', 'pz-mv', '▲'), dn = el('button', 'pz-mv', '▼');
      up.disabled = i === 0;
      dn.disabled = i === order.length - 1;
      up.onclick = () => ([order[i - 1], order[i]] = [order[i], order[i - 1]], audio.pickup(), paint());
      dn.onclick = () => ([order[i + 1], order[i]] = [order[i], order[i + 1]], audio.pickup(), paint());
      row.append(up, dn);
      list.append(row);
    });
  };
  const check = el('button', 'big-btn', 'Comprobar');
  check.onclick = () => {
    tries++;
    const right = order.filter((v, i) => v === i).length;
    paint(true);
    if (right === order.length) {
      setTimeout(() => end(tries === 1 ? 'A la primera. Te lo sabes todo, amore.' : `En ${tries} intentos. Heavy, pero lo tienes.`), 900);
    } else {
      f.status.textContent = `${right} de ${order.length} en su sitio · mueve las rojas`;
      audio.boo();
    }
  };
  f.status.textContent = 'De la primera a la última · ▲▼ para mover';
  paint();
  f.body.append(list, check);
}

// ---------------- Parejas ----------------
function parejas(f: ReturnType<typeof frame>, end: (l: string) => void) {
  // (solo fotos de capítulos ya abiertos: antes podían salir las de Sant Joan, que se juega después)
  const after = PUZZLES.find((p) => p.kind === 'parejas')?.after ?? 9;
  const pics = shuffle(MEMORIES.filter((m) => m.src && !m.sticker && !m.chat && m.level <= after)).slice(0, 6);
  const deck = shuffle([...pics, ...pics].map((m, i) => ({ m, i })));
  const g = el('div', 'pz-cards');
  let open: { c: HTMLElement; m: (typeof pics)[number] }[] = [];
  let pairs = 0, moves = 0, lock = false;
  const status = () => (f.status.textContent = `${pairs} de ${pics.length} parejas · ${moves} intentos`);
  for (const d of deck) {
    const c = el('button', 'pz-card-f');
    const img = el('img') as HTMLImageElement;
    img.src = d.m.src!;
    img.alt = '';
    c.append(el('span', 'pz-card-back', '💙'), img);
    c.onclick = () => {
      if (lock || c.classList.contains('up')) return;
      c.classList.add('up');
      audio.pop();
      open.push({ c, m: d.m });
      if (open.length < 2) return;
      moves++;
      const [a, b] = open;
      open = [];
      if (a.m === b.m) {
        pairs++;
        a.c.classList.add('done');
        b.c.classList.add('done');
        audio.chime(pairs);
        status();
        if (pairs === pics.length) setTimeout(() => end(`${moves} intentos. ${moves <= 10 ? 'Memoria de elefante (y de tierna).' : 'Brutal igualmente.'}`), 800);
      } else {
        lock = true;
        status();
        setTimeout(() => {
          a.c.classList.remove('up');
          b.c.classList.remove('up');
          lock = false;
        }, 900);
      }
    };
    g.append(c);
  }
  status();
  f.body.append(g);
}

// ---------------- Completa la frase ----------------
function completa(f: ReturnType<typeof frame>, end: (l: string) => void) {
  const items = shuffle(FILL);
  let i = 0, ok = 0;
  const show = () => {
    f.body.innerHTML = '';
    f.status.textContent = `${i + 1} de ${items.length} · ${ok} bien`;
    const it = items[i];
    const q = el('div', 'pz-quote', `<span>«${it.before} <b class="pz-gap">____</b> ${it.after}»</span><small>${it.who}</small>`);
    const row = el('div', 'pz-col');
    for (const opt of shuffle(it.options.slice())) {
      const b = el('button', 'pz-opt', opt);
      b.onclick = () => {
        const good = opt === it.options[0];
        if (good) ok++;
        b.classList.add(good ? 'good' : 'bad');
        row.querySelectorAll('button').forEach((x) => {
          (x as HTMLButtonElement).disabled = true;
          if (x.textContent === it.options[0]) x.classList.add('good');
        });
        (good ? audio.pickup : audio.boo).call(audio);
        q.querySelector('.pz-gap')!.textContent = it.options[0];
        setTimeout(() => (++i < items.length ? show() : end(`${ok} de ${items.length}. ${ok >= 7 ? 'Literal, como en el chat.' : 'Flipas lo que se olvida, ¿eh?'}`)), 1400);
      };
      row.append(b);
    }
    f.body.append(q, row);
  };
  show();
}

// ---------------- El ahorcado ----------------
function ahorcado(f: ReturnType<typeof frame>, end: (l: string) => void) {
  const items = HANGMAN;
  let i = 0, won = 0;
  const show = () => {
    f.body.innerHTML = '';
    const it = items[i];
    const got = new Set<string>([' ']);
    let lives = 6;
    const word = el('div', 'pz-hang');
    const hint = el('p', 'pz-when', `Pista: ${it.hint}`);
    const life = el('div', 'pz-lives');
    const kb = el('div', 'pz-kb');
    const paint = () => {
      // (cada palabra junta, que no se parta entre líneas)
      word.innerHTML = it.phrase.split(' ').map((w) => `<span class="pz-hw">${[...w].map((ch) => `<b>${got.has(ch) ? ch : ''}</b>`).join('')}</span>`).join('');
      life.textContent = '💙'.repeat(lives) + '🤍'.repeat(6 - lives);
      f.status.textContent = `Frase ${i + 1} de ${items.length}`;
    };
    const next = (ok: boolean) => {
      if (ok) won++;
      kb.querySelectorAll('button').forEach((x) => ((x as HTMLButtonElement).disabled = true));
      for (const ch of it.phrase) got.add(ch);
      paint();
      setTimeout(() => (++i < items.length ? show() : end(`${won} de ${items.length} frases. ${won >= 4 ? 'Épico.' : 'Durísimo, lo sé 😅'}`)), 1500);
    };
    for (const ch of 'ABCDEFGHIJLMNÑOPQRSTUVXYZ') {
      const b = el('button', 'pz-key', ch);
      b.onclick = () => {
        b.disabled = true;
        if (it.phrase.includes(ch)) {
          got.add(ch);
          b.classList.add('good');
          audio.pickup();
          paint();
          if ([...it.phrase].every((x) => got.has(x))) next(true);
        } else {
          lives--;
          b.classList.add('bad');
          audio.boo();
          paint();
          if (lives <= 0) next(false);
        }
      };
      kb.append(b);
    }
    paint();
    f.body.append(word, hint, life, kb);
  };
  show();
}

// ---------------- En emojis ----------------
function emojis(f: ReturnType<typeof frame>, end: (l: string) => void) {
  const items = shuffle(EMOJI_ROUNDS);
  let i = 0, ok = 0;
  const show = () => {
    f.body.innerHTML = '';
    f.status.textContent = `${i + 1} de ${items.length} · ${ok} bien`;
    const it = items[i];
    const opts = shuffle([it.answer, ...shuffle(EMOJI_ROUNDS.filter((x) => x !== it).map((x) => x.answer)).slice(0, 2)]);
    const q = el('div', 'pz-emoji', it.emojis);
    const row = el('div', 'pz-col');
    for (const o of opts) {
      const b = el('button', 'pz-opt', o);
      b.onclick = () => {
        const good = o === it.answer;
        if (good) ok++;
        b.classList.add(good ? 'good' : 'bad');
        row.querySelectorAll('button').forEach((x) => {
          (x as HTMLButtonElement).disabled = true;
          if (x.textContent === it.answer) x.classList.add('good');
        });
        (good ? audio.pickup : audio.boo).call(audio);
        setTimeout(() => (++i < items.length ? show() : end(`${ok} de ${items.length}. ${ok === items.length ? 'Toppp.' : 'Muy bien, tierna.'}`)), 1200);
      };
      row.append(b);
    }
    f.body.append(q, row);
  };
  show();
}
