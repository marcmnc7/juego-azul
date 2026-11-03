import { audio } from '../core/audio';
import { vibrate } from '../core/gfx';
import { CHATS, type ChatFrag } from '../data/chats';
import { MINIS } from '../data/story';
import { phoneChat, toast } from './ui';
import { cardUrl } from './cards';

// Minijuegos en HTML: la mochila de la Costa Brava, «La princesa» en las rocas del eclipse y los
// cuatro interludios cortos entre capítulos (el avión en el radar, la moto perdida, el agility de Joy
// y el vóley). Todos acaban llamando a onDone.

const root = document.getElementById('ui')!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// ---------------- La mochila (Costa Brava) ----------------

export interface PackItem {
  icon: string;
  label: string;
  /** Está en la lista que pasó Gas. */
  ok: boolean;
}

/** Meter en la mochila lo de la lista de Gas y nada más. Devuelve los intentos de colar algo de más. */
export function packBag(items: PackItem[], onDone: (extras: number) => void) {
  const o = el('div', 'screen pack-screen');
  const need = items.filter((i) => i.ok).length;
  let got = 0;
  let extras = 0;
  const count = el('div', 'eyebrow', `🎒 0/${need}`);
  o.append(el('h1', '', MINIS.pack.title), el('p', '', MINIS.pack.hint), count);
  const grid = el('div', 'pack-grid');
  const order = [...items].sort(() => Math.random() - 0.5);
  for (const it of order) {
    const b = el('button', 'pack-item', `<span class="pi-icon">${it.icon}</span><span class="pi-label">${it.label}</span>`);
    b.onclick = () => {
      if (b.classList.contains('in')) return;
      if (it.ok) {
        b.classList.add('in');
        got++;
        audio.pickup();
        vibrate(15);
        count.textContent = `🎒 ${got}/${need}`;
        if (got === need) {
          audio.fanfare();
          setTimeout(() => {
            o.remove();
            onDone(extras);
          }, 700);
        }
      } else {
        extras++;
        audio.boo();
        vibrate([40, 30, 40]);
        b.classList.remove('nope');
        void b.offsetWidth;
        b.classList.add('nope');
        toast(MINIS.pack.nope);
      }
    };
    grid.append(b);
  }
  o.append(grid);
  root.append(o);
}

// ---------------- La princesa (Love Letter) ----------------

interface Card {
  v: number;
  name: string;
  icon: string;
  text: string;
}

const CARDS: Card[] = [
  { v: 1, name: 'Guardia', icon: '🛡️', text: 'Adivina la carta del otro (no vale Guardia). Si aciertas, queda fuera.' },
  { v: 2, name: 'Sacerdote', icon: '📿', text: 'Mira la carta del otro.' },
  { v: 3, name: 'Barón', icon: '⚔️', text: 'Comparad cartas: la más baja queda fuera.' },
  { v: 4, name: 'Doncella', icon: '🌸', text: 'Hasta tu próximo turno nadie te puede atacar.' },
  { v: 5, name: 'Príncipe', icon: '🤴', text: 'Alguien (tú también) descarta su carta y roba otra.' },
  { v: 6, name: 'Rey', icon: '👑', text: 'Intercambiáis las cartas.' },
  { v: 7, name: 'Condesa', icon: '💃', text: 'Si la tienes con el Rey o el Príncipe, tienes que jugarla.' },
  { v: 8, name: 'Princesa', icon: '👸', text: 'Si la descartas, quedas fuera.' },
];
const card = (v: number) => CARDS[v - 1];

/** Lo que pasa en la escena 3D mientras se juega (las rocas, con los dos sentados frente a frente). */
export interface LoveLetterStage {
  /** Alguien juega una carta: vuela de su mano a su montón de descartes. */
  play(who: 'me' | 'gas', v: number): void;
  /** A quién le toca (la cámara lo mira por encima del hombro del otro). */
  turn(who: 'me' | 'gas'): void;
  /** Cartas que tiene cada uno en la mano. */
  hands(me: number, gas: number): void;
  /** Ronda nueva: se recoge todo. */
  reset(): void;
  end(iWin: boolean): void;
}

/**
 * Una partida de Love Letter contra Gas, con las reglas de dos jugadores. Ella empieza con la Princesa
 * y Gas juega con la cabeza en otra parte (el eclipse), así que ganar está en su mano. Si pierde,
 * revancha; a la tercera, Gas se rinde (el eclipse no espera). Se juega sobre la escena: se ve a los dos
 * en las rocas y la interfaz solo pone las cartas.
 */
export function princesaGame(onWin: (rounds: number) => void, stage?: LoveLetterStage) {
  const o = el('div', 'princesa-screen ll');
  root.append(o);
  let rounds = 0;
  const T = MINIS.princesa;
  const play = () => {
    rounds++;
    o.innerHTML = '';
    stage?.reset();
    const deck: number[] = [];
    for (const [v, n] of [[1, 5], [2, 2], [3, 2], [4, 2], [5, 2], [6, 1], [7, 1]] as const) for (let i = 0; i < n; i++) deck.push(v);
    deck.sort(() => Math.random() - 0.5);
    // Dos jugadores: una boca abajo fuera y tres boca arriba
    deck.pop();
    const faceUp = [deck.pop()!, deck.pop()!, deck.pop()!];
    let me = [8];
    let gas = [deck.pop()!];
    let meSafe = false;
    let gasSafe = false;
    const discards: { me: number[]; gas: number[] } = { me: [], gas: [] };
    let over = false;

    const top = el('div', 'll-top');
    const title = el('div', 'll-title', `${T.title} <span>Ronda ${rounds}</span>`);
    const gasInfo = el('div', 'll-gas');
    top.append(title, gasInfo);
    const log = el('div', 'pr-log ll-log', T.start);
    const bottom = el('div', 'll-bottom');
    const help = el('div', 'pr-help ll-help');
    const meRow = el('div', 'pr-row me');
    // Abajo, juntos: lo que pasa, qué hace cada carta y tu mano. El centro de la pantalla queda para ellos dos
    bottom.append(log, help, meRow);
    o.append(top, bottom);

    const mini = (v: number | null) => {
      const i = el('img', 'll-mini');
      i.src = cardUrl(v);
      i.alt = v === null ? 'Carta' : card(v).name;
      return i;
    };
    const cardEl = (v: number) => {
      const c = el('div', 'pr-card');
      const img = el('img', 'll-face');
      img.src = cardUrl(v);
      img.alt = card(v).name;
      img.draggable = false;
      c.append(img, el('span', 'pr-name', card(v).name));
      return c;
    };
    const render = () => {
      gasInfo.innerHTML = '';
      gasInfo.append(el('b', '', `Gas${gasSafe ? ' 🌸' : ''}`));
      for (let i = 0; i < gas.length; i++) gasInfo.append(mini(null));
      if (discards.gas.length) {
        const d = el('div', 'll-disc');
        for (const v of discards.gas) d.append(mini(v));
        gasInfo.append(d);
      }
      const up = el('div', 'll-up', `🂠 ${deck.length} · fuera:`);
      for (const v of faceUp) up.append(mini(v));
      gasInfo.append(up);
      meRow.innerHTML = '';
      const forced = me.includes(7) && (me.includes(5) || me.includes(6));
      me.forEach((v, i) => {
        const c = cardEl(v);
        if (me.length === 2 && !over) {
          c.classList.add('playable');
          if (forced && v !== 7) c.classList.add('blocked');
          c.onclick = () => {
            if (forced && v !== 7) {
              toast(T.countess);
              return;
            }
            playMine(i);
          };
        }
        meRow.append(c);
      });
      if (discards.me.length) {
        const d = el('div', 'll-disc mine');
        for (const v of discards.me) d.append(mini(v));
        meRow.append(d);
      }
      if (meSafe) meRow.append(el('div', 'll-safe', '🌸'));
      // En el móvil no hay "hover": las dos cartas se explican siempre encima
      help.innerHTML = me.length === 2 && !over ? me.map((v) => `<b>${card(v).name}</b>: ${card(v).text}`).join('<br>') : '';
      stage?.hands(me.length, gas.length);
    };
    const say = (t: string) => {
      log.textContent = t;
      audio.talk();
    };
    const end = (iWin: boolean, why: string) => {
      over = true;
      render();
      // A la tercera ronda perdida, Gas se rinde: ya empieza el eclipse
      const concede = !iWin && rounds >= 3;
      say(concede ? `${why} ${T.concede}` : why);
      stage?.end(iWin || concede);
      const b = el('button', 'big-btn', iWin || concede ? T.winBtn : T.again);
      if (iWin) {
        audio.fanfare();
        vibrate([30, 40, 60]);
      } else audio.boo();
      b.onclick = () => {
        if (iWin || concede) {
          o.remove();
          onWin(rounds);
        } else play();
      };
      bottom.append(b);
    };
    const draw = (who: 'me' | 'gas') => {
      if (!deck.length) return false;
      (who === 'me' ? me : gas).push(deck.pop()!);
      return true;
    };
    const compareEnd = () => {
      const a = me[0];
      const b = gas[0];
      const msg = `Se acaba el mazo. Tú: ${card(a).name} · Gas: ${card(b).name}.`;
      if (a !== b) end(a > b, `${msg} ${a > b ? T.win : T.lose}`);
      else {
        const sa = discards.me.reduce((x, y) => x + y, 0);
        const sb = discards.gas.reduce((x, y) => x + y, 0);
        end(sa >= sb, `${msg} Empate: ${sa >= sb ? T.win : T.lose}`);
      }
    };
    const afterTurn = (next: 'me' | 'gas') => {
      if (over) return;
      if (!deck.length) {
        compareEnd();
        return;
      }
      stage?.turn(next);
      if (next === 'me') {
        meSafe = false;
        draw('me');
        render();
      } else {
        gasSafe = false;
        draw('gas');
        render();
        setTimeout(gasTurn, 1400);
      }
    };
    /** Aplica el efecto de una carta. Devuelve true si la partida ha terminado. */
    const effect = (who: 'me' | 'gas', v: number, guess = 0): boolean => {
      const mine = who === 'me';
      const other = mine ? gas : me;
      const otherSafe = mine ? gasSafe : meSafe;
      const nm = mine ? 'Tú' : 'Gas';
      if (otherSafe && [1, 2, 3, 6].includes(v)) {
        say(`${nm}: ${card(v).name}… pero ${mine ? 'Gas tiene' : 'tienes'} la Doncella. No pasa nada.`);
        return false;
      }
      switch (v) {
        case 1:
          if (other[0] === guess) {
            end(mine, mine ? `Guardia: «¿${card(guess).name}?» ¡Bingo! ${MINIS.princesa.win}` : `Gas: «¿${card(guess).name}?» Acierta. ${MINIS.princesa.lose}`);
            return true;
          }
          say(mine ? `Guardia: «¿${card(guess).name}?» No era.` : `Gas: «¿Tienes ${card(guess).name}?» No.`);
          return false;
        case 2:
          say(mine ? `Sacerdote: Gas tiene ${card(other[0]).name} ${card(other[0]).icon}.` : MINIS.princesa.gasPeeks);
          return false;
        case 3: {
          const a = (mine ? me : gas)[0];
          const b = other[0];
          if (a === b) {
            say('Barón: empate. Nadie cae.');
            return false;
          }
          const iWin = mine ? a > b : b > a;
          end(iWin, `Barón: ${card(me[0]).name} contra ${card(gas[0]).name}. ${iWin ? MINIS.princesa.win : MINIS.princesa.lose}`);
          return true;
        }
        case 4:
          if (mine) meSafe = true;
          else gasSafe = true;
          say(`${nm}: Doncella. ${mine ? 'Estás' : 'Está'} a salvo una ronda.`);
          return false;
        case 5: {
          // El Príncipe: ella lo apunta a Gas si puede; Gas siempre a sí mismo
          const target = mine ? (gasSafe ? me : gas) : gas;
          const lost = target.pop()!;
          (target === me ? discards.me : discards.gas).push(lost);
          if (lost === 8) {
            end(target !== me, target === me ? MINIS.princesa.princessOut : MINIS.princesa.win);
            return true;
          }
          if (!deck.length) target.push(0); // sin mazo: la carta apartada (no se usa, cuenta como 0)
          else target.push(deck.pop()!);
          if (target[0] === 0) target[0] = 1;
          say(`Príncipe: ${target === me ? 'descartas tu' : 'Gas descarta su'} ${card(lost).name} y ${target === me ? 'robas' : 'roba'} otra.`);
          return false;
        }
        case 6: {
          const t = me[0];
          me[0] = gas[0];
          gas[0] = t;
          say(`Rey: os cambiáis las cartas. Ahora tienes ${card(me[0]).name}.`);
          return false;
        }
        case 7:
          say(`${nm}: Condesa. Nada más.`);
          return false;
        default:
          end(!mine, mine ? MINIS.princesa.princessOut : MINIS.princesa.win);
          return true;
      }
    };
    const playMine = (i: number) => {
      const v = me.splice(i, 1)[0];
      discards.me.push(v);
      stage?.play('me', v);
      help.textContent = '';
      if (v === 1 && !gasSafe) {
        render();
        // Elegir qué carta crees que tiene Gas
        const pick = el('div', 'pr-guess');
        pick.append(el('div', '', T.guess));
        for (const g of CARDS.slice(1)) {
          const b = el('button', 'll-guess');
          b.append(mini(g.v), el('span', '', g.name));
          b.onclick = () => {
            pick.remove();
            if (!effect('me', 1, g.v)) afterTurn('gas');
          };
          pick.append(b);
        }
        o.append(pick);
        return;
      }
      if (!effect('me', v)) afterTurn('gas');
      else render();
    };
    const gasTurn = () => {
      if (over) return;
      // Gas, con la cabeza en el eclipse: nunca juega el Rey ni el Príncipe contra ella
      const [a, b] = gas;
      let idx: number;
      if (gas.includes(7) && (gas.includes(5) || gas.includes(6))) idx = gas.indexOf(7);
      else {
        const rank = (v: number) => (v === 6 ? 9 : v === 3 ? 8 : v === 8 ? 10 : v);
        idx = rank(a) <= rank(b) ? 0 : 1;
      }
      const v = gas.splice(idx, 1)[0];
      discards.gas.push(v);
      stage?.play('gas', v);
      const guesses = [2, 3, 4, 5, 6, 7].filter((g) => g !== me[0]);
      const guess = guesses[Math.floor(Math.random() * guesses.length)];
      if (!effect('gas', v, guess)) afterTurn('me');
      else render();
    };
    // Empieza ella
    stage?.turn('me');
    draw('me');
    render();
  };
  play();
}

// ---------------- Interludios entre capítulos ----------------

export interface MiniGame {
  id: string;
  /** Capítulo en el que va metido. */
  chapter: number;
  icon: string;
  title: string;
  run: (onDone: () => void) => void;
}

interface CanvasGame {
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  down?(x: number, y: number): void;
  move?(x: number, y: number): void;
  up?(): void;
}

/** Lienzo a pantalla completa con título e instrucciones. El juego llama a finish() al acabar. */
function canvasScreen(title: string, hint: string, make: (w: number, h: number, finish: () => void) => CanvasGame, onDone: () => void) {
  const o = el('div', 'screen mini-screen');
  const W = 720;
  const H = 405;
  const cv = el('canvas', 'mini-canvas') as HTMLCanvasElement;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr;
  cv.height = H * dpr;
  const hintEl = el('p', 'mini-hint', hint);
  const skip = el('button', 'link-btn mini-skip', 'Saltar ›');
  o.append(el('h1', '', title), cv, hintEl, skip);
  root.append(o);
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  let done = false;
  const g = make(W, H, () => {
    if (done) return;
    done = true;
    setTimeout(() => {
      o.remove();
      onDone();
    }, 900);
  });
  skip.onclick = () => {
    if (done) return;
    done = true;
    o.remove();
    onDone();
  };
  const pos = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] as const;
  };
  cv.onpointerdown = (e) => {
    cv.setPointerCapture(e.pointerId);
    g.down?.(...pos(e));
  };
  cv.onpointermove = (e) => g.move?.(...pos(e));
  cv.onpointerup = cv.onpointercancel = () => g.up?.();
  let last = performance.now();
  const loop = () => {
    if (!o.isConnected) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!done) g.update(dt);
    ctx.clearRect(0, 0, W, H);
    g.draw(ctx);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/** Un fragmento partido en dos: lo de antes del juego y lo de después. */
function split(f: ChatFrag, n: number): [ChatFrag, ChatFrag] {
  return [{ ...f, msgs: f.msgs.slice(0, n) }, { ...f, msgs: f.msgs.slice(n) }];
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size = 18, color = '#fff', align: CanvasTextAlign = 'center') {
  ctx.font = `600 ${size}px Outfit, system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** 9 de julio: seguir con el dedo el avión de Gas en el radar, de Barcelona a Mahón. */
export function radar(onDone: () => void) {
  const T = MINIS.radar;
  canvasScreen(T.title, T.hint, (W, H, finish) => {
    const from = { x: 140, y: 120 };
    const to = { x: 590, y: 270 };
    const DUR = 14;
    let t = 0;
    let on = 0;
    let finger: { x: number; y: number } | null = null;
    let sweep = 0;
    const plane = { x: from.x, y: from.y };
    return {
      update(dt) {
        t += dt;
        sweep += dt * 2;
        const k = Math.min(1, t / DUR);
        const e = k * k * (3 - 2 * k);
        plane.x = from.x + (to.x - from.x) * e + Math.sin(k * 9) * 18;
        plane.y = from.y + (to.y - from.y) * e + Math.sin(k * 6 + 1) * 14;
        if (finger && Math.hypot(finger.x - plane.x, finger.y - plane.y) < 46) on += dt;
        if (k >= 1) {
          const pct = Math.round((on / DUR) * 100);
          toast(pct >= 70 ? T.good(pct) : T.ok(pct));
          audio.fanfare();
          finish();
        }
      },
      draw(c) {
        c.fillStyle = '#04140c';
        c.fillRect(0, 0, W, H);
        c.strokeStyle = 'rgba(80,255,150,.15)';
        for (let r = 60; r < 420; r += 60) {
          c.beginPath();
          c.arc(W / 2, H / 2, r, 0, Math.PI * 2);
          c.stroke();
        }
        c.save();
        c.translate(W / 2, H / 2);
        c.rotate(sweep);
        const gr = c.createLinearGradient(0, 0, 400, 0);
        gr.addColorStop(0, 'rgba(80,255,150,.35)');
        gr.addColorStop(1, 'rgba(80,255,150,0)');
        c.fillStyle = gr;
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, 420, -0.25, 0);
        c.fill();
        c.restore();
        // Costa de Barcelona y Menorca
        c.fillStyle = '#1d4a33';
        c.beginPath();
        c.moveTo(0, 40);
        c.quadraticCurveTo(110, 60, 150, 130);
        c.quadraticCurveTo(170, 200, 120, 405);
        c.lineTo(0, 405);
        c.fill();
        c.beginPath();
        c.ellipse(610, 275, 70, 26, -0.15, 0, Math.PI * 2);
        c.fill();
        text(c, 'BCN', from.x - 30, from.y - 22, 14, '#7dffb0');
        text(c, 'MAH', to.x + 20, to.y + 40, 14, '#7dffb0');
        // Ruta
        c.setLineDash([6, 8]);
        c.strokeStyle = 'rgba(125,255,176,.4)';
        c.beginPath();
        c.moveTo(from.x, from.y);
        c.lineTo(to.x, to.y);
        c.stroke();
        c.setLineDash([]);
        if (finger) {
          c.strokeStyle = 'rgba(255,255,255,.7)';
          c.lineWidth = 3;
          c.beginPath();
          c.arc(finger.x, finger.y, 46, 0, Math.PI * 2);
          c.stroke();
          c.lineWidth = 1;
        }
        text(c, '✈️', plane.x, plane.y, 34);
        text(c, 'VY 3717 · Gas', plane.x, plane.y - 30, 12, '#7dffb0');
        const pct = Math.round((on / DUR) * 100);
        text(c, `👀 ${pct}%`, 20, 24, 18, '#fff', 'left');
      },
      down(x, y) {
        finger = { x, y };
      },
      move(x, y) {
        if (finger) finger = { x, y };
      },
      up() {
        finger = null;
      },
    };
  }, () => phoneChat(CHATS.loveLanguage, onDone));
}

/** 2 de agosto: Gas no sabe dónde ha dejado la moto en el parking. Linterna y a buscar. */
export function lostMoto(onDone: () => void) {
  const T = MINIS.moto;
  const [before, after] = split(CHATS.motoPerdida, 2);
  phoneChat(before, () =>
    canvasScreen(T.title, T.hint, (W, H, finish) => {
      const colors = ['#c23030', '#1f3a6b', '#e0e0e0', '#1b1d22', '#2f6b46', '#d9a020', '#1b1d22', '#7a3fa0'];
      const motos: { x: number; y: number; c: string; helmet: boolean }[] = [];
      for (let r = 0; r < 4; r++)
        for (let i = 0; i < 8; i++) motos.push({ x: 70 + i * 82, y: 70 + r * 88, c: colors[(i * 3 + r * 5) % colors.length], helmet: false });
      const target = motos[13 + Math.floor(Math.random() * 12)];
      target.c = '#1b1d22';
      target.helmet = true;
      let light = { x: W / 2, y: H / 2 };
      let taps = 0;
      let found = false;
      const moto = (c: CanvasRenderingContext2D, m: (typeof motos)[number]) => {
        c.fillStyle = '#111';
        c.beginPath();
        c.arc(m.x - 22, m.y + 12, 11, 0, Math.PI * 2);
        c.arc(m.x + 22, m.y + 12, 11, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = m.c;
        c.beginPath();
        c.roundRect(m.x - 24, m.y - 8, 48, 16, 6);
        c.fill();
        c.fillStyle = '#222';
        c.fillRect(m.x - 6, m.y - 14, 22, 7);
        if (m.helmet) {
          c.fillStyle = '#1b1d22';
          c.beginPath();
          c.arc(m.x + 4, m.y - 20, 10, Math.PI, 0);
          c.fill();
          c.fillStyle = '#4f7cff';
          c.fillRect(m.x - 2, m.y - 24, 12, 4);
        }
      };
      return {
        update() {},
        draw(c) {
          c.fillStyle = '#3a3a40';
          c.fillRect(0, 0, W, H);
          c.strokeStyle = '#f2f2ee';
          c.lineWidth = 2;
          for (const m of motos) c.strokeRect(m.x - 38, m.y - 36, 76, 72);
          for (const m of motos) moto(c, m);
          // Oscuridad con el círculo de la linterna
          c.save();
          c.fillStyle = found ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,.93)';
          c.beginPath();
          c.rect(0, 0, W, H);
          c.arc(light.x, light.y, 70, 0, Math.PI * 2, true);
          c.fill();
          c.restore();
          text(c, `🔦 ${taps}`, 20, 22, 18, '#fff', 'left');
        },
        down(x, y) {
          light = { x, y };
          const hit = motos.find((m) => Math.abs(m.x - x) < 34 && Math.abs(m.y - y) < 32);
          if (!hit) return;
          taps++;
          if (hit === target) {
            found = true;
            audio.fanfare();
            vibrate([30, 40, 60]);
            toast(T.found);
            finish();
          } else {
            audio.boo();
            toast(T.nope);
          }
        },
        move(x, y) {
          light = { x, y };
        },
      };
    }, () => phoneChat(after, onDone)),
  );
}

/** 6 de octubre: Joy, campeona de agility. Toca para saltar las vallas. */
/** Antes del circuito: enseñarle trucos. Gas dice la orden y hay que tocar el gesto que toca. */
function tricks(onDone: () => void) {
  const T = MINIS.tricks;
  canvasScreen(T.title, T.hint, (W, H, finish) => {
    const CMDS = T.commands;
    const order = Array.from({ length: 6 }, (_, i) => (i + Math.floor(Math.random() * 4)) % CMDS.length);
    let i = 0;
    let t = 0;
    let pose = -1;
    let poseT = 0;
    let ok = 0;
    let msg = '';
    let msgT = 0;
    const BW = 150;
    const by = H - 70;
    const bx = (k: number) => W / 2 - (CMDS.length * BW) / 2 + k * BW + BW / 2;
    const next = () => {
      i++;
      t = 0;
      if (i >= order.length) {
        toast(T.done(ok));
        audio.fanfare();
        finish();
      }
    };
    return {
      update(dt) {
        t += dt;
        poseT = Math.max(0, poseT - dt);
        msgT = Math.max(0, msgT - dt);
        if (poseT === 0) pose = -1;
        if (i < order.length && t > 3.2) {
          msg = T.slow;
          msgT = 1;
          audio.boo();
          next();
        }
      },
      draw(c) {
        const g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#bfe6ff');
        g.addColorStop(1, '#eaf6ff');
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
        c.fillStyle = '#7cc46a';
        c.fillRect(0, 250, W, H - 250);
        // Gas a la izquierda con el bocadillo de la orden
        c.fillStyle = '#e07b39';
        c.fillRect(150, 160, 34, 70);
        c.fillStyle = '#2d2d3a';
        c.fillRect(150, 230, 34, 40);
        c.fillStyle = '#e8b894';
        c.beginPath();
        c.arc(167, 140, 20, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#2b1d14';
        c.fillRect(148, 118, 38, 12);
        if (i < order.length) {
          c.fillStyle = '#fff';
          c.beginPath();
          c.roundRect(200, 70, 190, 54, 14);
          c.fill();
          text(c, `«${CMDS[order[i]].say}»`, 295, 104, 22, '#1b1f33');
        }
        // Joy en la postura
        const jx = 470;
        const jy = 255;
        c.fillStyle = '#1d1b1f';
        if (pose === 1) {
          c.beginPath();
          c.ellipse(jx, jy - 12, 38, 12, 0, 0, Math.PI * 2);
          c.fill();
          c.beginPath();
          c.arc(jx + 40, jy - 18, 13, 0, Math.PI * 2);
          c.fill();
        } else {
          const rot = pose === 3 ? Math.sin(poseT * 12) * 0.9 : 0;
          c.save();
          c.translate(jx, jy - 30);
          c.scale(pose === 3 ? Math.cos(poseT * 10) : 1, 1);
          c.rotate(rot * 0.1);
          c.beginPath();
          c.ellipse(0, pose === 0 ? 6 : 0, 30, 16, pose === 0 ? -0.5 : 0, 0, Math.PI * 2);
          c.fill();
          c.beginPath();
          c.arc(30, pose === 0 ? -22 : -12, 13, 0, Math.PI * 2);
          c.fill();
          c.fillRect(-22, 8, 7, pose === 0 ? 10 : 22);
          c.fillRect(pose === 2 ? 22 : 16, pose === 2 ? -6 : 8, 7, pose === 2 ? 10 : 22);
          if (pose === 2) c.fillRect(24, -10, 18, 6);
          c.fillStyle = '#d7263d';
          c.fillRect(20, pose === 0 ? -14 : -4, 10, 4);
          c.restore();
        }
        if (pose >= 0) text(c, '🦴', jx + 60, jy - 70, 26);
        // Botones de gesto
        CMDS.forEach((cmd, k) => {
          c.fillStyle = 'rgba(27,31,51,.85)';
          c.beginPath();
          c.roundRect(bx(k) - 64, by - 34, 128, 64, 16);
          c.fill();
          text(c, `${cmd.icon} ${cmd.label}`, bx(k), by + 6, 18, '#fff');
        });
        text(c, `🦴 ${ok}/${order.length}`, 20, 24, 18, '#1b1f33', 'left');
        if (msgT > 0) text(c, msg, W / 2, 40, 20, '#d7263d');
      },
      down(x, y) {
        if (i >= order.length || y < by - 40) return;
        const k = CMDS.findIndex((_, j) => Math.abs(x - bx(j)) < 64);
        if (k < 0) return;
        if (k === order[i]) {
          ok++;
          pose = k;
          poseT = 1.1;
          audio.pickup();
          vibrate(15);
        } else {
          msg = T.wrong;
          msgT = 1;
          audio.boo();
        }
        next();
      },
    };
  }, onDone);
}

/** 6 de octubre: «Este perro seria increiblemente bueno en agility». Primero trucos, luego el circuito. */
export function joyTraining(onDone: () => void) {
  phoneChat(CHATS.agility, () => tricks(() => agility(onDone)));
}

function agility(onDone: () => void) {
  const T = MINIS.agility;
  {
    canvasScreen(T.title, T.hint, (W, H, finish) => {
      const GROUND = 320;
      let x = 0;
      let y = 0;
      let vy = 0;
      let speed = 260;
      let hits = 0;
      let passed = 0;
      let stun = 0;
      const obs: { x: number; kind: 'valla' | 'tunel' | 'rueda'; hit: boolean }[] = [];
      const kinds = ['valla', 'valla', 'rueda', 'tunel', 'valla', 'valla', 'rueda', 'valla', 'tunel', 'valla'] as const;
      kinds.forEach((k, i) => obs.push({ x: 700 + i * 420 + Math.random() * 80, kind: k, hit: false }));
      const end = obs[obs.length - 1].x + 400;
      let t = 0;
      return {
        update(dt) {
          t += dt;
          stun = Math.max(0, stun - dt);
          x += (stun > 0 ? speed * 0.3 : speed) * dt;
          speed = Math.min(380, speed + dt * 6);
          vy += 1500 * dt;
          y = Math.min(0, y + vy * dt);
          if (y === 0) vy = 0;
          for (const o of obs) {
            const sx = o.x - x;
            if (o.hit || sx > 140 || sx < 100) continue;
            // Joy está en x≈120. La valla y la rueda se saltan; el túnel se pasa por dentro (sin saltar)
            const jumping = y < -30;
            const ok = o.kind === 'tunel' ? !jumping : jumping;
            if (!ok) {
              o.hit = true;
              hits++;
              stun = 0.6;
              audio.boo();
              vibrate(60);
            } else if (sx < 104) {
              o.hit = true;
              passed++;
              audio.pickup();
            }
          }
          if (x > end) {
            toast(T.done(hits));
            audio.fanfare();
            finish();
          }
        },
        draw(c) {
          const sky = c.createLinearGradient(0, 0, 0, H);
          sky.addColorStop(0, '#8fd0ff');
          sky.addColorStop(1, '#dff3ff');
          c.fillStyle = sky;
          c.fillRect(0, 0, W, H);
          c.fillStyle = '#5fb04a';
          c.fillRect(0, GROUND, W, H - GROUND);
          for (let i = -1; i < 12; i++) {
            const gx = ((i * 80 - x * 0.5) % 960 + 960) % 960 - 80;
            c.fillStyle = 'rgba(255,255,255,.25)';
            c.fillRect(gx, GROUND + 18, 40, 4);
          }
          for (const o of obs) {
            const sx = o.x - x;
            if (sx < -80 || sx > W + 80) continue;
            if (o.kind === 'valla') {
              c.fillStyle = '#ff5c8a';
              c.fillRect(sx - 3, GROUND - 46, 6, 46);
              c.fillRect(sx + 27, GROUND - 46, 6, 46);
              c.fillStyle = '#fff';
              c.fillRect(sx - 3, GROUND - 40, 36, 7);
            } else if (o.kind === 'rueda') {
              c.strokeStyle = '#ffcf5c';
              c.lineWidth = 8;
              c.beginPath();
              c.arc(sx + 15, GROUND - 52, 24, 0, Math.PI * 2);
              c.stroke();
              c.lineWidth = 1;
            } else {
              c.fillStyle = '#4f7cff';
              c.beginPath();
              c.ellipse(sx + 30, GROUND - 26, 60, 30, 0, Math.PI, 0);
              c.fill();
            }
          }
          // Joy: perra negra con collar rojo
          const jy = GROUND + y;
          const leg = Math.sin(t * 22) * (y === 0 ? 6 : 2);
          c.fillStyle = '#1d1b1f';
          c.beginPath();
          c.ellipse(120, jy - 26, 26, 14, 0, 0, Math.PI * 2);
          c.fill();
          c.beginPath();
          c.arc(146, jy - 38, 12, 0, Math.PI * 2);
          c.fill();
          c.fillRect(100 + leg, jy - 16, 6, 16);
          c.fillRect(134 - leg, jy - 16, 6, 16);
          c.fillRect(92, jy - 34, 10, 4);
          c.fillStyle = '#d7263d';
          c.fillRect(136, jy - 30, 10, 4);
          if (stun > 0) text(c, '💫', 140, jy - 64, 22);
          text(c, `🐾 ${passed}/${obs.length}`, 20, 24, 18, '#1b1f33', 'left');
        },
        down() {
          if (y === 0 && stun <= 0) {
            vy = -620;
            audio.pop();
          }
        },
      };
    }, onDone);
  }
}

/** 2 de septiembre: vóley con Gas. Toca cuando la pelota llega a tus manos. */
export function voley(onDone: () => void) {
  const T = MINIS.voley;
  phoneChat(CHATS.voley, () =>
    canvasScreen(T.title, T.hint, (W, H, finish) => {
      const GROUND = 330;
      const ME = { x: 170 };
      const GAS = { x: 560 };
      let ball = { x: GAS.x, y: 200, vx: 0, vy: 0 };
      let toMe = true;
      let t = 0;
      let flight = 0;
      let dur = 1.3;
      let passes = 0;
      let misses = 0;
      let tapped = false;
      let msgT = 0;
      let msg = '';
      const launch = (fromX: number, toX: number) => {
        dur = Math.max(0.85, 1.35 - passes * 0.04);
        ball = { x: fromX, y: GROUND - 120, vx: (toX - fromX) / dur, vy: -420 };
        flight = 0;
        tapped = false;
      };
      launch(GAS.x, ME.x);
      return {
        update(dt) {
          t += dt;
          msgT = Math.max(0, msgT - dt);
          flight += dt;
          // Parábola: vuelve a la altura de las manos al final del vuelo
          const g = (2 * 420) / dur;
          ball.x += ball.vx * dt;
          ball.y = GROUND - 120 - 420 * flight + 0.5 * g * flight * flight;
          if (flight >= dur + 0.25) {
            if (toMe && !tapped) {
              misses++;
              msg = T.miss;
              msgT = 1;
              audio.boo();
              if (misses >= 3) {
                toast(T.done(passes));
                finish();
                return;
              }
              launch(GAS.x, ME.x);
            } else if (!toMe) {
              // Gas siempre la devuelve
              toMe = true;
              audio.knock(0.25, 500, 0.06);
              launch(GAS.x, ME.x);
            }
          }
        },
        draw(c) {
          const sky = c.createLinearGradient(0, 0, 0, H);
          sky.addColorStop(0, '#ffcf8a');
          sky.addColorStop(1, '#ffe9c9');
          c.fillStyle = sky;
          c.fillRect(0, 0, W, H);
          c.fillStyle = '#4fa3d8';
          c.fillRect(0, GROUND - 40, W, 14);
          c.fillStyle = '#f0d9a0';
          c.fillRect(0, GROUND, W, H - GROUND);
          c.fillStyle = '#333';
          c.fillRect(W / 2 - 3, GROUND - 150, 6, 150);
          c.fillStyle = 'rgba(255,255,255,.85)';
          c.fillRect(W / 2 - 2, GROUND - 150, 4, 60);
          // Ella (rubia, de azul) y Gas
          const person = (px: number, shirt: string, hair: string) => {
            c.fillStyle = shirt;
            c.fillRect(px - 14, GROUND - 90, 28, 46);
            c.fillStyle = '#f4d0b0';
            c.beginPath();
            c.arc(px, GROUND - 104, 15, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = hair;
            c.beginPath();
            c.arc(px, GROUND - 110, 15, Math.PI, 0);
            c.fill();
            c.fillStyle = '#2d2d3a';
            c.fillRect(px - 12, GROUND - 44, 9, 44);
            c.fillRect(px + 3, GROUND - 44, 9, 44);
          };
          person(ME.x, '#5aa9e6', '#f2d27a');
          person(GAS.x, '#e07b39', '#2b1d14');
          // Zona buena cuando viene hacia ella
          if (toMe) {
            const k = flight / dur;
            const good = k > 0.82 && k < 1.12;
            c.strokeStyle = good ? '#22c08a' : 'rgba(255,255,255,.6)';
            c.lineWidth = 4;
            c.beginPath();
            c.arc(ME.x, GROUND - 120, 30, 0, Math.PI * 2);
            c.stroke();
            c.lineWidth = 1;
          }
          text(c, '🏐', ball.x, ball.y, 30);
          text(c, `🤝 ${passes}`, 20, 24, 20, '#1b1f33', 'left');
          text(c, '❌'.repeat(misses), W - 20, 24, 18, '#1b1f33', 'right');
          if (msgT > 0) text(c, msg, W / 2, 70, 22, '#1b1f33');
        },
        down() {
          if (!toMe || tapped) return;
          const k = flight / dur;
          if (k > 0.82 && k < 1.12) {
            tapped = true;
            passes++;
            audio.knock(0.3, 700, 0.06);
            vibrate(20);
            toMe = false;
            if (passes >= 10) {
              toast(T.done(passes));
              audio.fanfare();
              finish();
              return;
            }
            launch(ME.x, GAS.x);
          } else {
            msg = k < 0.82 ? T.early : T.late;
            msgT = 0.8;
          }
        },
      };
    }, onDone),
  );
}

/** En orden real: el avión (9/7), la moto (2/8), el vóley (2/9) y el agility (6/10). */
export const MINI_GAMES: MiniGame[] = [
  { id: 'radar', chapter: 7, icon: '✈️', title: MINIS.radar.title, run: radar },
  { id: 'moto', chapter: 8, icon: '🏍️', title: MINIS.moto.title, run: lostMoto },
  { id: 'voley', chapter: 9, icon: '🏐', title: MINIS.voley.title, run: voley },
  { id: 'joy', chapter: 9, icon: '🐕', title: MINIS.tricks.title, run: joyTraining },
];
