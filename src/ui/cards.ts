// Cartas de Love Letter dibujadas a mano por código (ilustraciones propias, no las del juego): pergamino
// con marco rojo y dorado, el número en un medallón, el emblema de cada personaje y su nombre en una
// cinta. El dorso, rojo con una carta lacrada con un corazón. Sirven para la interfaz (imágenes) y para
// las cartas de la escena 3D (texturas).

export const CARD_W = 250;
export const CARD_H = 350;

const RED = '#9e1b2c';
const RED_D = '#6a0f1c';
const GOLD = '#d9a93a';
const GOLD_L = '#f4d27a';
const INK = '#3a2418';

export const CARD_NAMES = ['Guardia', 'Sacerdote', 'Barón', 'Doncella', 'Príncipe', 'Rey', 'Condesa', 'Princesa'];

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Marco común: borde rojo, filete dorado y adornos en las esquinas. */
function frame(c: CanvasRenderingContext2D, w: number, h: number, fill: CanvasGradient | string) {
  roundRect(c, 0, 0, w, h, 18);
  c.fillStyle = RED;
  c.fill();
  roundRect(c, 9, 9, w - 18, h - 18, 12);
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = GOLD;
  c.stroke();
  roundRect(c, 15, 15, w - 30, h - 30, 9);
  c.lineWidth = 1.2;
  c.strokeStyle = 'rgba(217,169,58,.7)';
  c.stroke();
  // Florituras en las esquinas
  c.strokeStyle = GOLD;
  c.lineWidth = 2;
  for (const [x, y, sx, sy] of [[22, 22, 1, 1], [w - 22, 22, -1, 1], [22, h - 22, 1, -1], [w - 22, h - 22, -1, -1]]) {
    c.beginPath();
    c.moveTo(x, y + sy * 26);
    c.quadraticCurveTo(x, y, x + sx * 26, y);
    c.moveTo(x + sx * 6, y + sy * 16);
    c.quadraticCurveTo(x + sx * 6, y + sy * 6, x + sx * 16, y + sy * 6);
    c.stroke();
  }
}

function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x, y + s * 0.35);
  c.bezierCurveTo(x - s * 0.9, y - s * 0.35, x - s * 0.35, y - s * 0.95, x, y - s * 0.45);
  c.bezierCurveTo(x + s * 0.35, y - s * 0.95, x + s * 0.9, y - s * 0.35, x, y + s * 0.35);
  c.fill();
}

/** Carta cerrada con lacre: el emblema del dorso y de la Princesa. */
function letter(c: CanvasRenderingContext2D, x: number, y: number, s: number, paper = '#f6ead0') {
  c.save();
  c.translate(x, y);
  c.rotate(-0.08);
  roundRect(c, -s, -s * 0.66, s * 2, s * 1.32, s * 0.08);
  c.fillStyle = paper;
  c.fill();
  c.strokeStyle = '#b08a52';
  c.lineWidth = 2;
  c.stroke();
  c.beginPath();
  c.moveTo(-s, -s * 0.62);
  c.lineTo(0, s * 0.12);
  c.lineTo(s, -s * 0.62);
  c.stroke();
  c.fillStyle = RED;
  c.beginPath();
  c.arc(0, s * 0.08, s * 0.3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#d23a48';
  heart(c, 0, s * 0.1, s * 0.34);
  c.restore();
}

function crown(c: CanvasRenderingContext2D, x: number, y: number, s: number, points: number, gems: boolean) {
  c.beginPath();
  c.moveTo(x - s, y + s * 0.5);
  for (let i = 0; i <= points * 2; i++) {
    const t = i / (points * 2);
    const px = x - s + t * s * 2;
    const py = i % 2 === 0 ? y - s * 0.55 : y + s * 0.05;
    c.lineTo(px, py);
  }
  c.lineTo(x + s, y + s * 0.5);
  c.closePath();
  const g = c.createLinearGradient(0, y - s, 0, y + s * 0.5);
  g.addColorStop(0, GOLD_L);
  g.addColorStop(1, GOLD);
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = '#8a6420';
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = '#8a6420';
  c.fillRect(x - s, y + s * 0.38, s * 2, s * 0.14);
  if (gems)
    for (let i = 0; i < points; i++) {
      c.fillStyle = i % 2 ? '#2e6fd0' : RED;
      c.beginPath();
      c.arc(x - s + ((i + 0.5) / points) * s * 2, y + s * 0.22, s * 0.1, 0, Math.PI * 2);
      c.fill();
    }
}

/** El emblema de cada personaje, en el centro de la carta. */
function emblem(c: CanvasRenderingContext2D, v: number, x: number, y: number) {
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  switch (v) {
    case 1: {
      // Guardia: lanza y escudo
      c.strokeStyle = '#6b4a2a';
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(x + 34, y + 70);
      c.lineTo(x + 34, y - 60);
      c.stroke();
      c.fillStyle = '#9aa2ac';
      c.beginPath();
      c.moveTo(x + 34, y - 88);
      c.lineTo(x + 46, y - 58);
      c.lineTo(x + 22, y - 58);
      c.fill();
      c.fillStyle = RED;
      c.beginPath();
      c.moveTo(x - 46, y - 40);
      c.lineTo(x + 14, y - 40);
      c.lineTo(x + 14, y + 6);
      c.quadraticCurveTo(x + 14, y + 52, x - 16, y + 66);
      c.quadraticCurveTo(x - 46, y + 52, x - 46, y + 6);
      c.closePath();
      c.fill();
      c.strokeStyle = GOLD;
      c.lineWidth = 4;
      c.stroke();
      c.beginPath();
      c.moveTo(x - 16, y - 30);
      c.lineTo(x - 16, y + 50);
      c.moveTo(x - 38, y + 2);
      c.lineTo(x + 6, y + 2);
      c.stroke();
      break;
    }
    case 2: {
      // Sacerdote: libro abierto y vela
      c.fillStyle = '#f8f0dc';
      c.strokeStyle = INK;
      c.lineWidth = 2.5;
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.moveTo(x, y + 10);
        c.quadraticCurveTo(x + sx * 30, y - 6, x + sx * 62, y + 4);
        c.lineTo(x + sx * 62, y + 58);
        c.quadraticCurveTo(x + sx * 30, y + 48, x, y + 64);
        c.closePath();
        c.fill();
        c.stroke();
        for (let k = 0; k < 4; k++) {
          c.beginPath();
          c.moveTo(x + sx * 10, y + 22 + k * 9);
          c.lineTo(x + sx * 50, y + 18 + k * 9);
          c.stroke();
        }
      }
      c.fillStyle = '#fbf3de';
      c.fillRect(x - 8, y - 70, 16, 56);
      c.strokeStyle = '#b08a52';
      c.lineWidth = 2;
      c.strokeRect(x - 8, y - 70, 16, 56);
      c.fillStyle = '#ffb340';
      c.beginPath();
      c.ellipse(x, y - 82, 7, 13, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 3: {
      // Barón: balanza
      c.strokeStyle = GOLD;
      c.fillStyle = GOLD;
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(x, y + 66);
      c.lineTo(x, y - 62);
      c.moveTo(x - 60, y - 44);
      c.lineTo(x + 60, y - 40);
      c.stroke();
      c.fillRect(x - 28, y + 62, 56, 9);
      for (const [sx, dy] of [[-60, -44], [60, -40]]) {
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x + sx, y + dy);
        c.lineTo(x + sx - 22, y + dy + 46);
        c.moveTo(x + sx, y + dy);
        c.lineTo(x + sx + 22, y + dy + 46);
        c.stroke();
        c.beginPath();
        c.ellipse(x + sx, y + dy + 48, 26, 8, 0, 0, Math.PI);
        c.fill();
      }
      c.beginPath();
      c.arc(x, y - 66, 7, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 4: {
      // Doncella: una rosa
      c.strokeStyle = '#2f6b3a';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(x, y + 76);
      c.quadraticCurveTo(x - 10, y + 30, x, y - 8);
      c.stroke();
      c.fillStyle = '#3e8a46';
      for (const [lx, ly, a] of [[-20, 36, -0.7], [18, 18, 0.7]]) {
        c.beginPath();
        c.ellipse(x + lx, y + ly, 16, 7, a, 0, Math.PI * 2);
        c.fill();
      }
      for (let r = 3; r >= 0; r--) {
        c.fillStyle = ['#7a0f22', '#a8162e', '#cf2a44', '#e8566a'][r];
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + r;
          c.beginPath();
          c.ellipse(x + Math.cos(a) * r * 6, y - 30 + Math.sin(a) * r * 5, 16 + r * 4, 12 + r * 3, a, 0, Math.PI * 2);
          c.fill();
        }
      }
      break;
    }
    case 5: {
      // Príncipe: corona pequeña con pluma
      c.fillStyle = '#2e6fd0';
      c.beginPath();
      c.moveTo(x + 10, y - 10);
      c.quadraticCurveTo(x + 64, y - 70, x + 30, y - 96);
      c.quadraticCurveTo(x + 40, y - 50, x + 2, y - 14);
      c.fill();
      crown(c, x, y + 14, 46, 3, true);
      break;
    }
    case 6: {
      // Rey: corona grande y cetro
      c.strokeStyle = GOLD;
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(x + 52, y + 72);
      c.lineTo(x + 52, y - 40);
      c.stroke();
      c.fillStyle = RED;
      c.beginPath();
      c.arc(x + 52, y - 48, 11, 0, Math.PI * 2);
      c.fill();
      crown(c, x - 12, y, 58, 5, true);
      break;
    }
    case 7: {
      // Condesa: abanico
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI * 0.85 + (k / 8) * Math.PI * 0.7;
        c.fillStyle = k % 2 ? '#2a1a3a' : '#5b2a6e';
        c.beginPath();
        c.moveTo(x, y + 52);
        c.arc(x, y + 52, 92, a, a + (Math.PI * 0.7) / 9 + 0.02);
        c.closePath();
        c.fill();
      }
      c.strokeStyle = GOLD;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x, y + 52, 92, -Math.PI * 0.85, -Math.PI * 0.15 + 0.08);
      c.stroke();
      c.fillStyle = GOLD;
      c.beginPath();
      c.arc(x, y + 52, 9, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 8: {
      // Princesa: diadema con un corazón y la carta de amor
      letter(c, x, y + 34, 50);
      c.strokeStyle = GOLD;
      c.lineWidth = 5;
      c.beginPath();
      c.arc(x, y - 30, 46, Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
      c.fillStyle = GOLD_L;
      for (let k = 0; k < 5; k++) {
        const a = Math.PI * 1.15 + (k / 4) * Math.PI * 0.7;
        c.beginPath();
        c.arc(x + Math.cos(a) * 46, y - 30 + Math.sin(a) * 46, k === 2 ? 0 : 5, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#e8566a';
      heart(c, x, y - 76, 26);
      break;
    }
  }
  c.restore();
}

const cache = new Map<string, HTMLCanvasElement>();

/** La carta v (1-8) o el dorso (null), dibujada a CARD_W × CARD_H. */
export function cardCanvas(v: number | null) {
  const key = String(v);
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = CARD_W;
  cv.height = CARD_H;
  const c = cv.getContext('2d')!;
  const w = CARD_W, h = CARD_H;
  if (v === null) {
    const g = c.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h * 0.7);
    g.addColorStop(0, '#b8283a');
    g.addColorStop(1, RED_D);
    frame(c, w, h, g);
    // Rombos dorados de fondo
    c.strokeStyle = 'rgba(244,210,122,.22)';
    c.lineWidth = 1;
    for (let k = -h; k < w + h; k += 22) {
      c.beginPath();
      c.moveTo(k, 18);
      c.lineTo(k - h, h);
      c.moveTo(k, 18);
      c.lineTo(k + h, h);
      c.stroke();
    }
    letter(c, w / 2, h / 2 - 6, 58);
    c.fillStyle = GOLD_L;
    c.font = 'italic 700 26px Georgia, serif';
    c.textAlign = 'center';
    c.fillText('Love Letter', w / 2, h - 46);
  } else {
    const g = c.createRadialGradient(w / 2, h * 0.42, 10, w / 2, h * 0.42, h * 0.75);
    g.addColorStop(0, '#fff8e6');
    g.addColorStop(1, '#ecd7a8');
    frame(c, w, h, g);
    // Arco del retrato
    c.fillStyle = 'rgba(158,27,44,.08)';
    roundRect(c, 32, 54, w - 64, h - 150, 60);
    c.fill();
    c.strokeStyle = 'rgba(158,27,44,.35)';
    c.lineWidth = 2;
    c.stroke();
    emblem(c, v, w / 2, h * 0.43);
    // Medallón con el número
    c.fillStyle = RED;
    c.beginPath();
    c.arc(42, 44, 25, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = GOLD;
    c.lineWidth = 3.5;
    c.stroke();
    c.fillStyle = GOLD_L;
    c.font = '700 30px Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(v), 42, 46);
    // Cinta con el nombre
    const by = h - 62;
    c.fillStyle = RED;
    c.beginPath();
    c.moveTo(20, by - 18);
    c.lineTo(w - 20, by - 18);
    c.lineTo(w - 34, by);
    c.lineTo(w - 20, by + 18);
    c.lineTo(20, by + 18);
    c.lineTo(34, by);
    c.closePath();
    c.fill();
    c.strokeStyle = GOLD;
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#fff4d8';
    c.font = '700 25px Georgia, serif';
    c.fillText(CARD_NAMES[v - 1], w / 2, by + 1);
  }
  cache.set(key, cv);
  return cv;
}

const urls = new Map<string, string>();
/** La misma carta como imagen para la interfaz. */
export function cardUrl(v: number | null) {
  const key = String(v);
  let u = urls.get(key);
  if (!u) urls.set(key, (u = cardCanvas(v).toDataURL('image/png')));
  return u;
}
