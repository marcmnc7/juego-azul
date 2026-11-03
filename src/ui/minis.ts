import { audio } from '../core/audio';
import { vibrate } from '../core/gfx';
import { CHATS, type ChatFrag } from '../data/chats';
import { MINIS } from '../data/story';
import { phoneChat, toast, missionCard } from './ui';
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
/** La mochila del viaje en moto, como misión: el panel encima de la escena (se ve la moto detrás). */
export function packBag(items: PackItem[], onDone: (extras: number) => void) {
  const o = el('div', 'pack-screen panel-overlay');
  missionCard(MINIS.pack.title, MINIS.pack.hint);
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
          missionCard(MINIS.pack.title, '', true);
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



/** Un fragmento partido en dos: lo de antes del juego y lo de después. */
function split(f: ChatFrag, n: number): [ChatFrag, ChatFrag] {
  return [{ ...f, msgs: f.msgs.slice(0, n) }, { ...f, msgs: f.msgs.slice(n) }];
}


/**
 * 9 de julio: Azul sigue en el móvil el vuelo de Gas de Barcelona a Menorca, como en una app de radar de
 * vuelos. Es una misión dentro del capítulo: el móvil aparece sobre la escena (se sigue viendo el jardín
 * detrás) y hay que seguir el avión con el dedo todo el vuelo.
 */
export function radar(onDone: () => void) {
  const T = MINIS.radar;
  const W = 360, H = 440;
  const o = el('div', 'phone-overlay radar-overlay');
  const ph = el('div', 'phone radar-phone');
  const bar = el('div', 'phone-bar radar-bar', `<span class="pb-avatar">✈</span><span class="pb-name"><b>VY3717 · BCN → MAH</b><small class="rd-live">En vuelo · 34.000 ft</small></span>`);
  const cv = el('canvas', 'radar-canvas') as HTMLCanvasElement;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr;
  cv.height = H * dpr;
  const foot = el('div', 'radar-foot', T.hint);
  ph.append(bar, cv, foot);
  o.append(ph);
  root.append(o);
  missionCard(T.title, T.hint);
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const live = bar.querySelector('.rd-live') as HTMLElement;
  // Mapa: costa catalana arriba a la izquierda, Mallorca abajo y Menorca a la derecha
  const BCN = { x: 74, y: 92 };
  const MAH = { x: 322, y: 232 };
  const coast: [number, number][] = [[0, 0], [70, 0], [62, 34], [70, 66], [86, 96], [74, 124], [52, 170], [40, 230], [22, 300], [0, 360]];
  const mallorca: [number, number][] = [[150, 300], [178, 278], [214, 282], [246, 296], [262, 318], [250, 346], [222, 352], [198, 368], [170, 350], [152, 326]];
  const menorca: [number, number][] = [[276, 224], [298, 214], [322, 216], [336, 226], [330, 240], [306, 244], [284, 240]];
  const ibiza: [number, number][] = [[58, 388], [76, 376], [90, 386], [80, 404], [62, 402]];
  const land = (pts: [number, number][], closeToEdge = false) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (closeToEdge) ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = '#2c4c3c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,220,190,.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  const DUR = 14;
  let t = 0;
  let on = 0;
  let finger: { x: number; y: number } | null = null;
  let done = false;
  const trail: { x: number; y: number }[] = [];
  const posAt = (k: number) => {
    const e = k * k * (3 - 2 * k);
    // Un arco suave (ruta de verdad: por el norte de Mallorca)
    const x = BCN.x + (MAH.x - BCN.x) * e;
    const y = BCN.y + (MAH.y - BCN.y) * e - Math.sin(e * Math.PI) * 26;
    return { x, y };
  };
  const label = (s: string, x: number, y: number, size = 12, color = '#cfeee0') => {
    ctx.font = `700 ${size}px Outfit, system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(s, x, y);
  };
  const plane = (x: number, y: number, a: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#3a2a00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(4, -2.5);
    ctx.lineTo(-2, -13);
    ctx.lineTo(-6, -13);
    ctx.lineTo(-3, -2.5);
    ctx.lineTo(-10, -2);
    ctx.lineTo(-13, -7);
    ctx.lineTo(-15, -7);
    ctx.lineTo(-13, 0);
    ctx.lineTo(-15, 7);
    ctx.lineTo(-13, 7);
    ctx.lineTo(-10, 2);
    ctx.lineTo(-3, 2.5);
    ctx.lineTo(-6, 13);
    ctx.lineTo(-2, 13);
    ctx.lineTo(4, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  const pos = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  cv.onpointerdown = (e) => {
    cv.setPointerCapture(e.pointerId);
    finger = pos(e);
  };
  cv.onpointermove = (e) => {
    if (finger) finger = pos(e);
  };
  cv.onpointerup = cv.onpointercancel = () => (finger = null);
  let last = performance.now();
  const loop = () => {
    if (!o.isConnected) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!done) t += dt;
    const k = Math.min(1, t / DUR);
    const p = posAt(k);
    const q = posAt(Math.min(1, k + 0.01));
    if (!done && finger && Math.hypot(finger.x - p.x, finger.y - p.y) < 44) on += dt;
    if (trail.length === 0 || Math.hypot(trail[trail.length - 1].x - p.x, trail[trail.length - 1].y - p.y) > 3) trail.push(p);
    // Mar con su rejilla
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0d2c4e');
    g.addColorStop(1, '#14406c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(140,190,255,.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    land(coast, true);
    land(mallorca);
    land(menorca);
    land(ibiza);
    label('Barcelona', BCN.x + 34, BCN.y - 8);
    label('Mallorca', 206, 324, 11, 'rgba(207,238,224,.7)');
    label('Menorca', 306, 260);
    for (const a of [BCN, MAH]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(a.x, a.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Ruta prevista (discontinua) y lo ya volado (amarillo)
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const s = posAt(i / 40);
      if (i) ctx.lineTo(s.x, s.y);
      else ctx.moveTo(s.x, s.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    trail.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)));
    ctx.stroke();
    // El dedo: verde si está encima del avión
    if (finger) {
      const near = Math.hypot(finger.x - p.x, finger.y - p.y) < 44;
      ctx.strokeStyle = near ? 'rgba(125,255,176,.9)' : 'rgba(255,255,255,.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(finger.x, finger.y, 40, 0, Math.PI * 2);
      ctx.stroke();
    }
    plane(p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x));
    const pct = Math.round((on / DUR) * 100);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(10, H - 38, 110, 28);
    label(`👀 ${pct}%`, 65, H - 18, 15, '#ffffff');
    live.textContent = done ? 'Aterrizado en Menorca' : `En vuelo · ${Math.round(34000 - Math.max(0, k - 0.7) * 100000).toLocaleString('es-ES')} ft`;
    if (k >= 1 && !done) {
      done = true;
      toast(pct >= 70 ? T.good(pct) : T.ok(pct));
      missionCard(T.title, '', true);
      setTimeout(() => {
        o.remove();
        phoneChat(CHATS.loveLanguage, onDone);
      }, 1600);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

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
