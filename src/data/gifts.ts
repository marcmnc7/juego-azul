// Regalos reales que se desbloquean en el juego.
import vuelosTenerife from '../assets/regalos/vuelos-tenerife.jpg';

// Marc: cambia aquí el texto de cada regalo. Nada más hace falta tocar.
export interface Gift {
  id: string;
  level: number; // capítulo que lo desbloquea
  icon: string;
  title: string;
  description: string;
  howToRedeem: string;
  /** Una foto que va con el vale (los billetes ya comprados…): sale en el vale y se abre en grande al tocarla. */
  photo?: { src: string; caption: string };
}

export const GIFTS: Gift[] = [
  {
    id: 'vuelos-carnaval',
    level: 1,
    icon: '🎭',
    title: 'Vuelos para… ¡el Carnaval de Tenerife 2027!',
    description: 'Volvemos a Canarias, esta vez a disfrazarnos. Ve pensando el disfraz.',
    howToRedeem: 'Los billetes corren de mi cuenta. Enséñale este vale a Gas.',
    photo: { src: vuelosTenerife, caption: 'Ya están comprados: del 17 al 24 de febrero ✈️' },
  },
  {
    id: 'masaje15',
    level: 2,
    icon: '💆\u200d♀️',
    title: 'Un masaje con aceite y música… ¡de 15 min!',
    description: 'Quince minutos enteros para ti, sin prisas.',
    howToRedeem: 'Tú eliges el día y la hora. Enséñale este vale a Gas.',
  },
  {
    id: 'mascarillas-niacinamida',
    level: 3,
    icon: '🧖\u200d♀️',
    title: '4 mascarillas faciales con… ¡niacinamida!',
    description: 'Para repetir el plan: mascarilla, sofá y nada más que hacer.',
    howToRedeem: 'Enséñale este vale a Gas y elegid la noche.',
  },
  {
    id: 'carbonara-marc',
    level: 4,
    icon: '🍝',
    title: 'Una carbonara… ¡made in Marc!',
    description: 'Guanciale, huevo, pecorino y nada de nata. Hecha por mí, para ti.',
    howToRedeem: 'El día que tú elijas. Enséñale este vale a Gas.',
  },
  {
    id: 'cafe-cama',
    level: 5,
    icon: '☕',
    title: '3 vales para obligarme a llevarte un buen café a la cama por la mañana… ¡durante 3 días!',
    description: 'Tú te quedas en la cama; yo subo con el café.',
    howToRedeem: 'Cada vale, una mañana. Enséñaselo a Gas la noche antes.',
  },
  {
    id: 'direkte',
    level: 6,
    icon: '🍽️',
    title: 'Un menú degustación todo pagado en el restaurante… ¡Direkte.cat!',
    description: 'Una cena de las buenas, sin mirar la cuenta.',
    howToRedeem: 'Te daré el vale impreso. Elegimos el día juntos.',
  },
  {
    id: 'peluqueria',
    level: 7,
    icon: '💇\u200d♀️',
    title: 'Tu próxima sesión de peluquería con tinte rubio… ¡te sale gratis!',
    description: 'Rubia, como siempre. Esta vez invito yo.',
    howToRedeem: 'Pide cita cuando quieras y enséñale este vale a Gas.',
  },
  {
    id: 'mueblebar',
    level: 8,
    icon: '🍸',
    title: 'El mueblebar prometido… ¡solo me queda elegirlo!',
    description: 'Lo prometido es deuda. Ya está decidido: solo falta elegir cuál.',
    howToRedeem: 'Enséñale este vale a Gas.',
  },
  {
    id: 'casco',
    level: 9,
    icon: '🏍️',
    title: 'Un casco de moto nuevo… ¡para ti!',
    description: 'El de ahora está viejo y roto: te toca uno nuevo, a tu medida, para todos los viajes que nos quedan.',
    howToRedeem: 'Enséñale este vale a Gas.',
  },
];

export const giftForLevel = (level: number) => GIFTS.find((g) => g.level === level);
