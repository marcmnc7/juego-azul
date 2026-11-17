// Regalos reales que se desbloquean en el juego.
// Marc: cambia aquí el texto de cada regalo. Nada más hace falta tocar.
export interface Gift {
  id: string;
  level: number; // capítulo que lo desbloquea
  icon: string;
  title: string;
  description: string;
  howToRedeem: string;
}

export const GIFTS: Gift[] = [
  {
    id: 'masaje',
    level: 1,
    icon: '💆‍♀️',
    title: 'Un masaje de 15 minutos',
    description: 'Con aceite y con música. Quince minutos enteros para ti, sin prisas.',
    howToRedeem: 'Tú eliges el día y la hora. Enséñale este vale a Gas.',
  },
  {
    id: 'carbonara',
    level: 2,
    icon: '🍝',
    title: 'Una carbonara made in Marc',
    description: 'Guanciale, huevo, pecorino y nada de nata. Hecha por mí, para ti.',
    howToRedeem: 'El día que tú elijas. Enséñale este vale a Gas.',
  },
  {
    id: 'mascarillas',
    level: 3,
    icon: '🧖‍♀️',
    title: 'Un pack de mascarillas para la cara',
    description: 'Para repetir el plan: mascarilla, sofá y nada más que hacer.',
    howToRedeem: 'Enséñale este vale a Gas y elegid la noche.',
  },
  {
    id: 'carnaval',
    level: 4,
    icon: '🎭',
    title: 'Billetes al Carnaval de Tenerife',
    description: 'Volvemos a Canarias, esta vez a disfrazarnos. Ve pensando el disfraz.',
    howToRedeem: 'Enséñale este vale a Gas y haz la maleta.',
  },
];

export const giftForLevel = (level: number) => GIFTS.find((g) => g.level === level);
