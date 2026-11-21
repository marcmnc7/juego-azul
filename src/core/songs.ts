import velda from '../assets/music/c1_velda.m4a';
import blunt from '../assets/music/c2_blunt.m4a';
import careless from '../assets/music/c3_careless.m4a';
import devega from '../assets/music/c4_devega.m4a';
import fito from '../assets/music/c4_fito.m4a';
import jeanl from '../assets/music/c5_jeanl.m4a';
import royce from '../assets/music/c7_royce.m4a';
import dondeVuelvo from '../assets/music/c8_dondevuelvo.m4a';
import quevedo from '../assets/music/c9_quevedo.m4a';

// La canción de cada capítulo. El 4, la de Fito desde el principio; la de De Vega, que era la del viaje del 4, ahora
// es la de Sant Joan (el 6 no tenía).
export const SONG_OF: Record<number, string> = { 1: velda, 2: blunt, 3: careless, 4: fito, 5: jeanl, 6: devega, 7: royce, 8: dondeVuelvo, 9: quevedo };
export const FITO_SONG = fito;
