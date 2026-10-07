# Relevo de sesión — App predicción setas (Boleto + Níscalo)

## Qué es
Web estática (sin backend) que estima el potencial de fructificación de
*Boletus edulis* y *Lactarius deliciosus* en un punto del mapa, de 0 a 100,
con doble lectura (hoy → pico +15/+21 d; hace 15/21 d → cosecha hoy).

## Archivos
- `index.html` — 5 pestañas: Dashboard, Especie, Mis setales, Metodología, Leyenda (Análisis eliminada).
- `app.js` — motor JS + 5 fuentes + render. Puerto del Python.
- `boletus_engine.py` — motor de referencia (boleto + constantes `NISCALO`).
- `styles.css` — tema arena.
- `img/boletus.jpg` (Pixabay), `img/niscalo.webp` (sporas.io).

## Motor (no tocar pesos sin avisar)
`score = clima × terreno × suelo × flora × temporada × 100`
- Clima: 0.40·P14 + 0.20·reserva P30 + 0.20·T_aire + 0.10·T_suelo18cm + 0.10·HR. Veto: helada / calor ≥28 / viento >45.
- Boleto: T aire ópt 13,2 ºC · P14 30-100 mm · pH 4,5-6,5 · alt 600-1800 · Sep–Nov pico Oct · lag 15 · veto frío 0 ºC.
- Níscalo: T aire 12–18 ºC (útil 5–20) · P14 25-80 mm · pH 4,5–8,0 · alt 100–1600 · Sep–Dic pico Oct · lag 21 · veto frío −3 ºC · solo pinar (mixto con pino vale).
- Hábitat en 8 categorías: Pinar, Hayedo, Robledal, Castañeral, Pradera, Pasto, Bosque mixto, Matorral (+Urbano como veto, 0,70 si sin datos).

## Fuentes por punto (todo auto, el usuario no mete nada)
1. Open-Meteo: daily 55 d atrás + hoy + 8 previsión (¡hoy = len−8, no el último!); hourly suelo 18 cm 30 d; `current` para "ahora".
2. SoilGrids 2.0: pH/SOC/arena/limo/arcilla a 5–15 cm.
3. MFE (GeoServer IEPNB): 36 formaciones por GetFeatureInfo (~120 m) + `ff_uso` con LULUCF. Solo España.
4. Overpass: SOLO conteo edificios 150 m (≥10 = urbano). Falla a menudo (throttling): es opcional con try/catch.
5. Nominatim: topónimo con degradado a coordenadas.

## Decisiones tomadas con el usuario
- Sin entrada manual de parámetros; neutros: hábitat desc. 0,70 · sin pH suelo 1.
- Etiquetas tarjeta: Lluvia 14 días, Reserva lluvia 30 días, Temp aire/suelo, Humedad relativa, Veto (nombre del veto + explicación en hover), insignias Bien/Flojo/Mal.
- Detalle: Altitud, pH del suelo, Estación (mes con mayúscula), Cosecha hoy (SI/NO + causa en llano), Hábitat (solo categoría, detalle en hover).
- Fichas de Especie estilo dashboard + selectores con estado que ocultan tarjetas (localStorage).
- Retiradas todas las menciones a sporas.io.

## Para ejecutar
Sin build: `python3 -m http.server` en la carpeta y abrir `http://localhost:8000`
(o abrir `index.html` directamente; Leaflet y las APIs necesitan internet).

## Ideas pendientes (no empezadas)
- Avisos "hoy es el día" con fecha de disparador guardada por punto.
- Capa MFE de frondosas/edad para el bonus de pinar joven del níscalo.
- Más especies (flujo: investigar → preguntar umbrales → tarjeta + ficha + análisis).
