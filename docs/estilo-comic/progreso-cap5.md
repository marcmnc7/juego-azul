# Progreso · Capítulo 5 «MotoTrip4life» (F4)

Primera pasada el 10-nov-2026, **solo por lectura de código** (sin navegador): todo está pendiente de captura.
Perfil `dia`. Filas del inventario `inventario-cap4-cap5.md`, capítulo 5.

**Ojo:** el capítulo es la **Costa Brava** (L'Escala → Cap de Creus, sábado 2 de mayo de 2026), no Menorca: así lo
dicen `LEVELS`, `MOTO` y los chats. Se ha dejado así.

**Estado:** código = hecho en el código, falta verlo · auto = base común · ver = hay que mirarlo en captura · pendiente.

## Luz y cielo
| Objeto | Estado | Cómo |
|---|---|---|
| Hora | código | Hora dorada en la carretera y mediodía en la cala no casaban: los dos, tarde de sol alto del suroeste (a la espalda) |
| Cielo, niebla | código | Cúpula como la del cap. 1, niebla 0xcfe2ee de 110 a 520 m (hay que ver el mar lejos) |
| Hemisférica | código | 1,0 × `hemiScale` 0,35, como el cap. 1, en la carretera y en la cala |
| Sol | código | 2,1 (el tope) en las dos escenas |
| Cielo físico | auto | Ya no existe |
| Luces de punto o foco | — | No había ninguna; el destello aditivo de la foto, quitado (de día no hay flash): `comicFlash` y «¡CLIC!» |

## Carretera de la costa
| Objeto | Estado | Cómo |
|---|---|---|
| Ladera / arcén / acantilado | código, ver | Tres mallas: hierba, tierra y piedra; hacia Cap de Creus, más seca y gris poco a poco |
| Asfalto | código | 2 × 3 m + arcén de 0,6; apartaderos en los miradores y en el Camí de Ronda |
| Líneas | código, ver | Planas con `paintMat`: bordes seguidos (discontinuos en los apartaderos), centro discontinuo en recta y continuo en curva, con aviso |
| Mar | auto | Agua de tebeo de `makeSea` |
| Bionda | código | Colores de metal (antes caían en «losas»); abierta en los apartaderos |
| Pretil de los miradores | código, ver | Piedra seca, tapa el hueco bajo el asfalto |
| Bancales, olivos, pinos, matas, rocas | auto | Sin pinos ni bancales dentro de las casas de L'Escala |
| Casas de L'Escala | código, ver | Tejado de teja a dos aguas y ventanas con persianas |
| Cadaqués, montañas | auto | — |
| Faro | código | Linterna = cristal, cúpula = metal |
| Señales | código, ver | Fin de L'Escala, destinos, 50, curvas peligrosas, Mirador, Parc Natural, Camí de Ronda, «Carretera tallada»: colores planos, letra Fredoka, borde de tinta y chapa gris por detrás |
| Moto, coches, motos de frente | código | `comicBent` también en los de baja calidad |
| Cascos | pendiente (D6b, común) | Se ven como decorado: hace falta que `toToon` respete `userData.person` |
| Partículas 📷 y polvo | auto | Dibujos con tinta de `fx.ts` |

## Cala de las ranas (`StoneSkip`)
| Objeto | Estado | Cómo |
|---|---|---|
| Cielo, mar, rocas | auto | — |
| Ondas | código | Aro blanco con raya de tinta |
| Los dos de pie | código, ver | Altura medida con un rayo sobre la losa |

## Paneles 2D (pendiente, `ui/style.css`)
`.wind-arrow`, `.side-count`, `.gauge`, `.pack-screen`: sin versión de tebeo.
