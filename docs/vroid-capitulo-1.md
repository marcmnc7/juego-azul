# Fichas de VRoid · Capítulo 1 (Jaleo d'ases, Ferreries)

Para que todo el capítulo tenga el mismo estilo que Azul. Cada ficha dice qué tocar en VRoid Studio; el orden es el de importancia (lo que más se ve primero).

**Partid siempre del mismo punto:** para las chicas, duplicad el proyecto de **Azul** (`Azul.vroid`); para los chicos, el de **GasFerreries** o un modelo masculino de ejemplo de VRoid. Así todos comparten proporciones y estilo de cara, y el reparto se ve coherente.

---

## Al exportar (para todos)

**Archivo → Exportar como VRM**, con estas opciones:

| Opción | Valor |
|---|---|
| Versión | **VRM 1.0** |
| Resolución de texturas (atlas) | **1024 × 1024** (Gas y Azul: 2048) |
| Reducir polígonos | Pelo: **reducir** · cuerpo: sin tocar |
| Borrar mallas transparentes | **Sí** |
| Número de materiales | **No fusionar** la ropa (para poder cambiar colores en el juego) |
| Huesos | Reducir los del pelo si lo ofrece |

Guardad cada `.vrm` en **Escritorio → characters** con el nombre de la ficha (p. ej. `Carme-Ferre1.vrm`) y avisad: yo lo aligero con `scripts/vrm_slim.py`, lo meto en su sitio y lo pruebo.

---

## 1 · Gas (Marc) — el más importante

Aparece en la escena de la mirada, el baile y el beso: se le ve de cerca.

**Cuerpo**
- Hombre, 1,80 m. Hombros algo más anchos que el modelo base y cintura recta (sin marcar). Cuello un poco más grueso.
- Manos y pies tamaño adulto masculino (los modelos base salen pequeños).

**Cara** (aquí falló el VRM anterior: salía muy femenina)
- Ojos **más pequeños y alargados** que los de Azul; nada de pestañas largas ni sombra de ojos.
- Cejas **más gruesas y rectas**, castaño oscuro.
- Mandíbula y barbilla algo más marcadas; nariz un poco más definida.
- Boca más ancha y de labios finos, sin color de pintalabios.
- **Bigote fino y perilla**: en el editor de texturas de la piel de la cara, en una capa nueva, pintad con pincel suave en castaño oscuro (`#3a2618`) un bigote fino sobre el labio y una perilla corta en la barbilla. Sin barba en las mejillas.

**Pelo**
- Castaño oscuro (`#84593a`), **rizado y con volumen arriba**, corto en los lados y la nuca.
- Nada de flequillo largo sobre los ojos ni mechones por los hombros (el VRM anterior los tenía).

**Ropa (el día del jaleo)**
- **Camiseta del Barça**: camiseta de manga corta; en su textura, importad como capa `docs/vroid/barca_rayas.png` (franjas verticales azul y granate). Si las franjas salen torcidas en algún panel, bastan las del pecho y la espalda.
- **Pantalón corto** azul marino (`#1f2a44`), por encima de la rodilla.
- Zapatillas blancas.

**Comprobad antes de exportar:** de frente y de perfil, ¿se le reconoce como un chico de 30 años con bigote fino y perilla? Si duda, ojos más pequeños y cejas más gruesas.

Archivo: `Gas-Ferre1.vrm`

---

## 2 · Carme — amiga de Azul, en el bar de Sa Font

Baila con Azul y tiene diálogo: se le ve a media distancia y en primer plano en las conversaciones.

**Cuerpo:** mujer, 1,64 m, complexión parecida a Azul (que no parezcan clones: algo menos de altura y hombros un poco más estrechos).

**Cara:** ojos **azules** (`#3a6ea8`), algo más redondos que los de Azul; expresión alegre. Cejas rubias claras.

**Pelo:** **rubio claro** (`#f3dc8f`), **corto** (a la altura de la mandíbula, tipo bob), con raya al lado. Que se distinga de Azul de un vistazo: Azul melena por los hombros miel, Carme corto y rubio claro.

**Ropa:** el **mismo mono negro** de una pieza que Azul ese día (camiseta de tirantes negra + pantalón corto negro ajustado si no hay mono), zapatillas negras. Así van conjuntadas, como en la historia.

Archivo: `Carme-Ferre1.vrm`

---

## 3 · Tòfol — el del bar, el que da las misiones

Está detrás de la barra y habla mucho (varios diálogos): se le ve de cerca.

**Cuerpo:** hombre de unos **60 años**, 1,72 m. Algo de barriga (cintura y vientre más anchos), hombros caídos. Brazos fuertes.

**Cara:** ojos más pequeños y caídos, bolsas ligeras (pintadas en la textura con un tono algo más oscuro que la piel), cejas grises pobladas. Piel más morena (`#d9a27c`).

**Pelo y barba:** **gris** (`#9a9a9a`), corto, con entradas. **Barba corta gris** que cubra mandíbula y bigote (pintada en la textura de la cara, como la perilla de Gas, pero más extensa).

**Ropa:** camiseta **blanca** de manga corta, pantalón corto azul grisáceo (`#3b4a6b`), alpargatas o zapatillas oscuras. **El delantal verde lo pone el juego**: no hace falta en VRoid.

Archivo: `Tofol-Ferre1.vrm`

---

## 4 · La fabiolera — toca el fabiol delante de la iglesia

Se la ve de pie a media distancia, tocando.

**Cuerpo:** mujer, 1,62 m, complexión normal.

**Cara:** ojos castaños, expresión tranquila.

**Pelo:** castaño (`#5a3a22`) recogido en **moño** bajo (el sombrero va encima: que el moño no sea muy alto).

**Ropa:** camisa o blusa **negra** de manga larga, **pantalón blanco** (`#f3f0ea`) largo, zapatos negros. **El bombín y el tamborí los pone el juego.**

Archivo: `Fabiolera-Ferre1.vrm`

---

## 5 · Los de las pistolas de agua (4)

Rodean la plaza disparando agua; se les ve a media distancia. Todos con pantalón corto.

| # | Quién | Pelo | Camiseta | Pantalón | Archivo |
|---|---|---|---|---|---|
| A | Chica | Castaño, **melena larga** | Blanca | Corto vaquero | `Pistola-A.vrm` |
| B | Chico | Moreno oscuro, corto | Verde azulado (`#1b998b`) | Corto negro | `Pistola-B.vrm` |
| C | Chica | Negro, **coleta** | Amarilla (`#f4d35e`) | Corto marrón | `Pistola-C.vrm` |
| D | Chico | Castaño claro, corto | Roja (`#d7263d`) | Corto vaquero | `Pistola-D.vrm` |

Para ir rápido: A y C desde el proyecto de **Vecina**, B y D desde el de **Gas** (cambiando pelo y cara un poco para que no se parezcan a él).

---

## 6 · La multitud (opcional, más adelante)

Los ~200 de la plaza y las calles son una multitud "horneada" que se dibuja de golpe para que el móvil aguante. Pasarla a VRoid es un trabajo de programación aparte (y caro de rendimiento), así que de momento se queda como está. Si se hace, bastarán **4 plantillas** sencillas (chica joven, chico joven, mujer mayor, hombre mayor) con ropa lisa clara, y el juego les cambia los colores a cada uno.

---

## Lo que ya está hecho

- **Azul** (`Azul-Ferre1.vrm`): integrada y probada en el capítulo 1.
