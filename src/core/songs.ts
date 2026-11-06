import velda from '../assets/music/c1_velda.m4a';
import blunt from '../assets/music/c2_blunt.m4a';
import careless from '../assets/music/c3_careless.m4a';
import devega from '../assets/music/c4_devega.m4a';
import fito from '../assets/music/c4_fito.m4a';
import jeanl from '../assets/music/c5_jeanl.m4a';
import royce from '../assets/music/c7_royce.m4a';
import dondeVuelvo from '../assets/music/c8_dondevuelvo.m4a';
import quevedo from '../assets/music/c9_quevedo.m4a';

// La canción de cada capítulo. El 4 tiene dos: la del viaje y, ya en el estadio, la del concierto.
// El 6 (Sant Joan) no tiene canción: suena el jaleo de siempre.
export const SONG_OF: Record<number, string> = { 1: velda, 2: blunt, 3: careless, 4: devega, 5: jeanl, 7: royce, 8: dondeVuelvo, 9: quevedo };
export const FITO_SONG = fito;
