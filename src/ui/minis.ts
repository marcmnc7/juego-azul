import { audio } from '../core/audio';
import { vibrate } from '../core/gfx';
import { CHATS, type ChatFrag } from '../data/chats';
import { MINIS } from '../data/story';
import { phoneChat, toast } from './ui';
import { cardUrl } from './cards';
import { parkingMission } from '../world/missions/parking';
import { beachMission } from '../world/missions/beach';
import { parkMission } from '../world/missions/park';

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
  const [before, after] = split(CHATS.motoPerdida, 2);
  // Misión en el aparcamiento de verdad (3D): entre filas de motos, con la linterna del móvil
  phoneChat(before, () => parkingMission(() => phoneChat(after, onDone)));
}

/** 6 de octubre: Joy, campeona de agility. Toca para saltar las vallas. */

/** 6 de octubre: «Este perro seria increiblemente bueno en agility». Primero trucos, luego el circuito. */
export function joyTraining(onDone: () => void) {
  // Misión en el parque (3D): los trucos con las órdenes de Gas y luego el circuito de agility
  phoneChat(CHATS.agility, () => parkMission(onDone));
}


/** 2 de septiembre: vóley con Gas. Toca cuando la pelota llega a tus manos. */
export function voley(onDone: () => void) {
  // Misión en la playa (3D): ella a un lado de la red, Gas al otro
  phoneChat(CHATS.voley, () => beachMission(onDone));
}

/** En orden real: el avión (9/7), la moto (2/8), el vóley (2/9) y el agility (6/10). */
export const MINI_GAMES: MiniGame[] = [
  { id: 'radar', chapter: 7, icon: '✈️', title: MINIS.radar.title, run: radar },
  { id: 'moto', chapter: 8, icon: '🏍️', title: MINIS.moto.title, run: lostMoto },
  { id: 'voley', chapter: 9, icon: '🏐', title: MINIS.voley.title, run: voley },
  { id: 'joy', chapter: 9, icon: '🐕', title: MINIS.tricks.title, run: joyTraining },
];
