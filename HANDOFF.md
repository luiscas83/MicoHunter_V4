# Relevo de sesión — App predicción setas (Boleto + Níscalo)

## Qué es
Web estática (sin backend) que estima el potencial de fructificación de
*Boletus edulis* y *Lactarius deliciosus* en un punto del mapa, de 0 a 100,
con doble lectura (hoy → pico +15/+21 d; hace 15/21 d → cosecha hoy).

## Archivos
- `index.html` — 6 pestañas: Dashboard, Meteorología, Especie, Mis setales, Metodología, Leyenda (Análisis eliminada).
- `app.js` — motor JS + 5 fuentes + render. Puerto del Python.
- `boletus_engine.py` — motor de referencia (boleto + constantes `NISCALO`).
- `styles.css` — tema arena.
- `img/boletus.jpg` (Pixabay), `img/niscalo.webp` (sporas.io).

## Motor (no tocar pesos sin avisar)
`score = clima × terreno × suelo × flora × temporada × 100`
- Clima: 0.40·P14 + 0.20·reserva P30 + 0.20·T_aire + 0.10·T_suelo18cm + 0.10·HR. Veto: helada / calor ≥28 / viento >45.
- Boleto: T aire ópt 13,2 ºC · P14 30-100 mm · pH 4,5-6,5 · alt 600-1800 · Sep–Nov pico Oct · lag 15 · veto frío 0 ºC.
- Níscalo: T aire 12–18 ºC (útil 5–20) · P14 25-80 mm · pH 4,5–8,0 · alt 100–1600 · Sep–Dic pico Nov (oct .9) · lag 21 · veto frío −3 ºC · solo pinar (mixto con pino vale).
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
- Fichas de Especie estilo guía (`app.js?v=1.19`): sombra en foto y tarjetas (`.mushroom-photo`, `#fichaGrid .card`), identificación + confusiones tóxicas en `.toxi-box` + cocina + aviso de seguridad, con guía sporas.io como fuente (autorizada de nuevo por el usuario; antes se habían retirado sus menciones). Pantalla de carga `#loader` (spinner + velo) visible durante `predecir()` con `finally`.
- Decidido (v1.20): pico del níscalo en noviembre (motor y textos), según sporas.io.
- Fichas sin bloque «Parámetros publicados» (v1.21).
- Doble anillo por tarjeta (v1.22): exterior = futuro (pico +15/+21 d), interior verde = cosecha hoy (`rR`/`rNR`) + línea «Cosecha hoy: X»; explicado en Leyenda.
- Fix tableta (v1.23): el `styles.css` iba con `?v=1.04` desde el inicio y la tableta aplicaba CSS viejo al anillo nuevo (círculo negro + número ilegible). Versión del CSS igualada a la app y `fill="none"` de respaldo en los círculos nuevos. Regla: versionar el CSS en cada cambio que lo toque.
- Caché por punto (v1.23): `calcCache` (máx. 50 puntos) reutiliza el cálculo si tiene menos de 10 min (`pintar(hit.calc, edad)` sin red ni loader; «Datos de hace X min»); si no, recarga todo. Verificado: 2ª llamada en 1 ms con mismos valores.
- Tarjeta Suelo y clima: Lluvia 14 días y Reserva 30 días en doble unidad `X mm = X L/m²` (1 mm = 1 L/m²); fix `forecastBody` ausente que rompía el cálculo (guardas nulas + `app.js?v=1.06`).
- Lluvia AEMET OpenData (`app.js?v=1.12`): Open-Meteo subestimaba en sierra (Rascafría 1–4 oct 2026: modelo 9,9 mm vs pluviómetro 55,6 mm). Con clave integrada (ofuscada: invertida + base64 en `AEMET_KX`, se reconstruye con `aemetBuiltin()`; sin campo en la web: si caduca se sustituye en código), la lluvia P14/P30 y tmin/tmax salen SOLO del pluviómetro más cercano (≤25 km, serie 60 d), sin mezclas: las ventanas terminan en el último dato del pluviómetro (lag ~3 d); si la estación lleva >10 d desactualizada, se vuelve al modelo. Fila «Estación meteo» en Suelo y clima (nombre + distancia + motivo del fallback en hover) y fila «Ahora en estación» con el parte horario en directo (`aemetAhora`: temp/HR/viento ahora + lluvia acumulada de hoy; caché 30 min). Lo de hoy parcial se suma a P14/P30 (`prov.hoyParcial`, todo AEMET); los días pasados sin validar no se pueden recuperar de ninguna fuente oficial. Pestaña Meteorología (`app.js?v=1.18`): hoy hora a hora (temp/lluvia/HR/viento, previsión horaria Open-Meteo) + previsión 7 d + observado 7 d con acumulada, estilo x-y.es con `.param-table` propio; la lluvia observada marcada `*` es del pluviómetro (`prov.semana`). Del pluviómetro salen también `tmed`, `hrMedia` (ojo: en mayúsculas en los datos) y `racha` en km/h (verificado contra el modelo) para temp/HR/viento + retro; del modelo solo quedan suelo 18 cm y altitud. Ojo técnico: `AEMET_BASE` es `.../opendata` sin `/api` (los paths ya lo traen; con doble `/api/api/` daba 404); AEMET sirve ISO-8859-15 (hace falta `TextDecoder`, `response.json()` rompería) y coords en DMS compacto (`405323N`); `getJSON`/`getJSONLatin` con un reintento ante fallos de red o 5xx (no ante 4xx). La ofuscación no es seguridad real (el navegador usa la clave en claro); si el repo es público, cualquiera puede extraerla.

## Para ejecutar
Sin build: `python3 -m http.server` en la carpeta y abrir `http://localhost:8000`
(o abrir `index.html` directamente; Leaflet y las APIs necesitan internet).

## Ideas pendientes (no empezadas)
- Avisos "hoy es el día" con fecha de disparador guardada por punto.
- Capa MFE de frondosas/edad para el bonus de pinar joven del níscalo.
- Más especies (flujo: investigar → preguntar umbrales → tarjeta + ficha + análisis).
