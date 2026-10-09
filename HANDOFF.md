# Relevo de sesión — App predicción setas (Boleto + Níscalo)

## Qué es
Web estática (sin backend) que estima el potencial de fructificación de
*Boletus edulis* y *Lactarius deliciosus* en un punto del mapa, de 0 a 100,
con doble lectura (hoy → pico +15/+21 d; hace 15/21 d → cosecha hoy).

## Archivos
- `index.html` — 6 pestañas: Dashboard, Meteorología, Especie, Mis setales, Metodología, Leyenda (Análisis eliminada).
- `app.js` — motor JS + 5 fuentes + render. Puerto del Python.
- `boletus_engine.py` — motor de referencia (boleto + níscalo + oronja, espejo del JS).
- `styles.css` — tema arena.
- `img/boletus.jpg` (Pixabay), `img/niscalo.webp` (sporas.io).

## Motor (no tocar pesos sin avisar)
`score = clima × terreno × suelo × flora × temporada × 100`
- Clima: 0.40·P14 + 0.20·reserva P30 + 0.20·T_aire + 0.10·T_suelo18cm + 0.10·HR. Veto: helada / calor ≥28 / viento >45.
- Boleto: T aire ópt 13,2 ºC · P14 30-100 mm · pH 4,5-6,5 · alt 600-1800 · Sep–Nov pico Oct · lag 15 · veto frío 0 ºC.
- Níscalo: T aire 12–18 ºC (útil 5–20) · P14 25-80 mm · pH 4,5–8,0 · alt 100–1600 · Sep–Dic pico Nov (oct .9) · lag 21 · veto frío −3 ºC · solo pinar (mixto con pino vale).
- Chantarela: T aire 15–20 ºC (útil 8–26) · P14 30-100 mm (exceso progresivo) · pH 4–5,5 estricto · alt 50–1500 (pref 100–1400) · Jun–Nov pico Sep · lag 10 · solo veto helada 0 ºC (sin veto viento/calor) · pinar/hayedo/robledal/castañar/mixto + hospedadores.
- Hábitat en 9 categorías: Pinar, Hayedo, Robledal, Castañeral, Quercíneas (encina/carrasca/alcornoque/quejigos meridionales: solo oronja), Pradera, Pasto, Bosque mixto, Matorral (+Urbano como veto, 0,70 si sin datos).

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
- Tarjetas iguales (v1.24): fuera la lupa fija y los emoticonos del banner del boleto; ambas tarjetas con texto plano y color de fondo por nivel.
- Anillos lado a lado (v1.25): izquierda futuro (+15/+21 d), derecha verde cosecha hoy, cada uno con su número (`ringPct2`/`ringPctN2`); fuera concéntricos y `RING_C2`.
- Un solo anillo (v1.27): el doble número confundía (88 junto a 25); vuelve un anillo por tarjeta (futuro) con pie de días restantes; la cosecha de hoy queda en texto. Fuera 2º anillo, `RING_C2`, `.rings-row` y `.ring-fill2`.
- Metodología, Leyenda y pie reescritos (v1.28): análisis exhaustivo con los números reales del motor (escalas por especie, veto, trigger, fuentes con umbrales y cachés); pie con todas las fuentes incl. AEMET y fotos.
- «Ahora» unificado (v1.29): con estación, temp/HR/viento-ahora salen del directo AEMET (viento m/s→km/h); sin estación, del modelo.
- Fuera la fila «Ahora en estación» (v1.30): redundante con el «ahora» unificado.
- Estimación en el veredicto (v1.31): fuera el pie «Futuro +N d» del anillo; el banner dice «N días estimados para fructificación».
- Fuera la línea «Grados día necesarios» de las fichas (v1.32): resto confuso sin sentido en este motor.
- Niveles en claro (v1.33): excelente / bueno / flojo / mal (antes óptimo / caliente / tibio / frío) en motor JS+Python y Leyenda.
- Niveles (v1.34): flojo→regular, mal→nulo.
- Resumen por tarjeta (v1.35): `resumenCond()` (✓ cumplen / ~ a medias / ✗ fallan + veto + causa de cosecha con lluvia o veto de hace 15/21 d) en `.verdict-box` al final de cada tarjeta; cazado y corregido `floraCat`→`floraTxt` en níscalo vía harness.
- Cotos en el desplegable (v1.36): `cotos.js` con 32 zonas reguladas geocodificadas a municipio orientativo (MicoCyL, MicoAragón, Navarra, Madrid, Poblet); optgroups en el desplegable, al elegir va al punto y calcula. Polígono al pinchar pendiente (el visor micologiacyl usa WMS sin GeoJSON localizado).
- Oronja (v1.37): tercera especie (Amanita caesarea, foto `img/oronja.webp` de sporas.io) con umbrales V2+cestaysetas (lag 30 ESTIMADO, veto +2 ºC, solo quercíneas/castaño, jul–oct pico sep); tarjeta + ficha con confusiones mortales + selector + leyenda/metodología; Open-Meteo a 65 d pasados y suelo a 40 d para el retro30; `CAESAREA` en referencia Python.
- Cotos por comunidades (v1.38): campo `ccaa` y grupos en el desplegable (CyL, Aragón, Navarra, Madrid, Cataluña).
- Oronja v1.39 (calibrada con bibliografía, sin validación de campo): lag 30→21 (primer flush 15–22 tras tormentas; MicoAragón, Charito, sporas.io), pH neutro 0,6→0,4, junio 0,1→0,2, hayedo 0→0,2; retro de oronja comparte lectura a 21 d (fuera `retro30`/`r30`/`restO`); textos y versión.
- Hábitat binario estricto (v1.40): la especie vale 1 en su hábitat y 0 fuera, sin ranking (boleto: hayedo 0,95→1, robledal/castañar 0,9→1, matorral 0,1→0; oronja: mixto/quercíneas 0,9→1, haya 0,2→0); sin-hábitat sigue neutro 0,70.
- Etiqueta Quercíneas (v1.41) + revisión dehesa: encina/carrasca/alcornoque/quejigos meridionales ya no caen a Matorral; oronja 1, boleto/níscalo 0; la dehesa con `nom_sp1` *Quercus* ya puntuaba 1 por regex (verificado, sin cambio).
- Etiqueta con acompañantes (v1.42, solo visible): «Hayedo + abetal», «Matorral + fresneda»…; la puntuación no cambia (`categoria` intacta).
- Sin cálculo inicial (v1.43): al abrir solo se pinta el mapa (vista Soria); el cálculo arranca al pulsar mapa/GPS/setal.
- Chantarela v1.44 (valores iniciales, sin calibrar ni foto): `CHAN_LAG=10` con `retro10`/`r10`/`restC` (disparador 60 mm); solo veto helada; `floraChantarella` + hospedadores; tarjeta + ficha (placeholder 🍄) + selector + leyenda/metodología; paridad JS↔PY verificada en 10 casos.
- Disparador por episodio (v1.45): `restantes()` fija el primer día de la racha (antes, el más reciente reiniciaba la cuenta a diario); sin racha todo igual.
- Línea de cálculo en tarjetas (v1.46): cada tarjeta explica su lag (cosecha con lo de hace 10/15/21 d + anillo al pico).
- Cotos al monte (v1.47): los 32 puntos pasan del pueblo al monte con arbolado verificado (MFE ff_uso); siguen orientativos.
- Polígonos reales CyL (v1.48): WFS Cesefor (`montes_micocyl`, 636 polígonos) con centroides reales en 17 acotados + capa perezosa `cotos_poly.js` (613 polígonos simplificados) que se dibuja al elegir coto. Urbión, Montes de Soria, SO-50003, Triollo y Barbadillo van por otras asociaciones (sin polígono).
- Botón Cotos (v1.49): conmuta la capa con todos los polígonos (carga perezosa, popup al tocar con enlace al permiso).
- v1.50: cotos en rojo + fix `window.COTOS_POLY` + enlaces de permiso verificados (Poblet sin enlace: sin permiso desde 2018).
- Peguerinos AV-50009 (v1.51): nuevo coto (Monte 80, pinar verificado) con enlace al ayuntamiento.
- Todas las CCAA con coto (v1.52): 64 cotos en 13 CCAA (Álava 5, Rioja 12+4 pueblo, Boal, Miera, Alto Tajo, Serradilla, Madrid 6, Baza, Bayárcal, Tenerife, Gran Canaria). Galicia, Valencia, Murcia, Baleares: sin cotos de pago verificables.
- MUP en azul (v1.53): contorno y nº del Monte de Utilidad Pública al pulsar (IDECyL, solo CyL) + fila en Suelo y clima.
- MUP Navarra + Aragón (v1.54): IDENA (`FOREST_Pol_MUP1912`) e ICEAragón (`RMA_MUP`); La Rioja sin WFS usable.
- Cotos ordenados A–Z por CCAA (v1.55).
- CCAA A–Z sin "de pago" (v1.56). Regla: cada cambio versiona.
- Botón MUP (v1.57): capa bajo demanda con los MUP visibles (CyL/Navarra/Aragón) + popup con nº, nombre y titular.
- Fix MUP (v1.58): `srsName=EPSG:4326` (venían en UTM y no se veían) + JSONP para Aragón (sin CORS) + exigir zoom ≥ 9.
- MUP auto (v1.59): con la capa activa se recarga al mover el mapa; apagada no pide nada.
- Respaldo MITECO-IEPF (v1.60): `mup_extra.js` (2.483 MUP de 12 provincias, 1,9 MB perezoso) para CCAA sin WFS; en Nájera no hay MUP (verificado).
- Fuera botón MUP (v1.61): el MUP sale al pulsar; eliminada la capa global (+ un `return` colado que mataba el WFS).
- Fila Coto (v1.62): si el punto cae en un acotado (polígonos), sale con enlace al permiso.
- Anillo con texto (v1.63): "Condiciones … de fructificación" + dashboard a 2 columnas.
- Anillo en presente (v1.64, a prueba): el anillo muestra la cosecha de hoy; el futuro pasa al banner.
- Fecha del disparador (v1.65): cada tarjeta muestra día/mes en que se dieron las condiciones ("Disparador: 7 oct").
- Margen AEMET (v1.66): disparador y cuenta 2 días atrás por el lag del pluviómetro (solo rama AEMET).
- Tarjetas a la izquierda + objetivo (v1.67): valores alineados a la izquierda con su "obj." al lado.
- Fuera la línea de cálculo de las tarjetas (v1.68).
- Veredicto con objetivos (v1.69): en Cumple/A medias/Falla cada parámetro muestra actual + obj.
- Detalle con obj. (v1.70): Altitud, pH, Estación y Hábitat como "valor / obj." + insignia.
- Ajuste detalle (v1.71): valores del detalle a la derecha, sin obj. en Hábitat y obj. sin negrita.
- Fuera veredicto (v1.72): eliminado el bloque Cumple/A medias/Falla de las tarjetas.
- Anillo claro (v1.73): etiqueta fija "Hoy" y banner como "Próximo pico: ...".
- Anillos como GitHub (v1.74): anillo a futuro + nivel, banner 4 estados (revertido v1.73).
- Banner cercano (v1.75): "¡Hoy tenemos setas para recoger!" / "Hoy no tenemos cosecha en el campo".
- Banner v1.76: textos ajustados ("Previsión en ~X días" / "Condiciones inadecuadas").
- Ventana en condiciones (v1.77): fila "Ventana de fructificación" bajo Humedad.
- Ventana con obj. (v1.78): "valor / obj. Abierta" + insignia.
- Foto chantarela (v1.79): `img/chantarela.jpg` (Wikimedia Commons).
- Foto chantarela sporas (v1.80): `img/chantarela.webp` (sporas.io).
- Banner por mensaje (v1.81): hay setas verde, previsión amarillo, inadecuadas rojo.
- Fuera Ventana (v1.82): eliminada la fila de condiciones.
- Grupos + causa (v1.83): "Hoy → futuro" / "El punto" / "Cosecha hoy · hace X días"; NO cosecha con causa (lluvia/mm, helada, calor, viento); fix aro N/O/C a futuro.
- Simple (v1.84): fuera cabeceras; Disparador + Cosecha hoy suben arriba del detalle.
- Leyenda y Metodología al día (v1.85): anillo a futuro, 4 mensajes del banner con colores, sin veredicto ni "sin foto".
- Doble score explícito (v1.86): "Cosecha hoy" muestra su número (SÍ · 65/100 · ...) con su insignia.
- Porqué automático (v1.87): línea bajo el banner ("No hay cosecha hoy porque..." / "Hay setas hoy y viene pico porque hay agua + ...").
- Híbrido lluvia (v1.88): AEMET + modelo en el hueco sin validar + hoy en directo; fuera el margen de 2 días.
- Fix hueco híbrido (v1.89): usa días de calendario; Open-Meteo rellena solo días entre último validado y ayer (hoy no se duplica).
- Meteo 30 días (v1.90): fuera previsión 7 días; observado a 30 días (modelo + * pluviómetro).
- Meteo previsión (v1.91): "Hoy por horas" pasa a "Previsión 7 días".
- Margen temp ±3 ºC (v1.92): perdón hacia el óptimo en aire (4 especies, JS+PY).
- Fuera exceso (v1.93): P14 en meseta desde el óptimo, sin penalizar encharque (4 especies, JS+PY).
- Sin píldoras (v1.94): fuera Bien/Flojo/Mal; el valor va coloreado (verde/ámbar/rojo).
- Obj. en etiqueta (v1.95): "Lluvia 14 días (obj. 60–100 mm)"; valor solo número + color.
- Fix Cosecha (v1.96): la nota iba dentro del paréntesis y pintaba "0"; pasa como 3er argumento.
- Tolerancia pH ±0,5 (v1.97): perdón hacia el óptimo (4 especies, JS+PY). Red local pendiente.
- Reintentos SoilGrids (v1.98): 3 intentos con espera creciente + 30 s timeout; pH sigue online.
- Obj. pH con tolerancia (v1.99): "obj. 4–6 ±0,5" en la etiqueta.
- Timeout SoilGrids 12 s (v2.00): medido 30 s y fallando; el resto (MFE/AEMET/OM) va rápido.
- Leyenda colores (v2.01): línea al final de las tarjetas (verde/ámbar/rojo).
- Aviso de fallo (v2.03): si falla suelo/hábitat/altitud/pluviómetro, aviso con el parámetro.
- Polígonos Rioja (v2.04): 18 acotados oficiales IDErioja (CC BY 4.0) en `cotos_poly.js`.
- Recolección restringida (v2.05): 70 zonas PNSG (reserva + uso restringido) en rojo sólido con botón.
- Permisos Rioja (v2.06): los 13 cotos enlazan a micocebollera emisión de permisos.
- Cotos en azul (v2.07): contornos de acotados en #2471a3; PNSG sigue rojo sólido.
- Coto elegido en amarillo (v2.08): la capa global sigue azul.
- 6 cotos Rioja al listado (v2.09): Villoslada, Lumbreras, Castroviejo, Sojuela, Daroca, La Estrella (punto centroide, enlace larioja.org).
- Fixes v1.38: textos con oronja (intro Metodología + Doble lectura en Leyenda) y `boletus_engine.py` con `score_niscalo()`/`score_oronja()` espejo del JS (paridad verificada: 100/100/100 en casos óptimos).
- Días restantes al pico (v1.26): `restantes()` busca el disparador (último día con 14 d ≥60/50 mm) en `hist45` (modelo) o `serie45`+hoy parcial (pluviómetro, con corrección del lag); banner y pies de anillo (`ringCap`/`ringCapN`) muestran +N real con fallback al plazo entero. Pesos intactos.
- Tarjeta Suelo y clima: Lluvia 14 días y Reserva 30 días en doble unidad `X mm = X L/m²` (1 mm = 1 L/m²); fix `forecastBody` ausente que rompía el cálculo (guardas nulas + `app.js?v=1.06`).
- Lluvia AEMET OpenData (`app.js?v=1.12`): Open-Meteo subestimaba en sierra (Rascafría 1–4 oct 2026: modelo 9,9 mm vs pluviómetro 55,6 mm). Con clave integrada (ofuscada: invertida + base64 en `AEMET_KX`, se reconstruye con `aemetBuiltin()`; sin campo en la web: si caduca se sustituye en código), la lluvia P14/P30 y tmin/tmax salen SOLO del pluviómetro más cercano (≤25 km, serie 60 d), sin mezclas: las ventanas terminan en el último dato del pluviómetro (lag ~3 d); si la estación lleva >10 d desactualizada, se vuelve al modelo. Fila «Estación meteo» en Suelo y clima (nombre + distancia + motivo del fallback en hover); el parte en directo (`aemetAhora`, caché 30 min) alimenta las filas del «ahora», lo de hoy y `prov.hoyParcial`. Lo de hoy parcial se suma a P14/P30 (`prov.hoyParcial`, todo AEMET); los días pasados sin validar no se pueden recuperar de ninguna fuente oficial. Pestaña Meteorología (`app.js?v=1.18`): hoy hora a hora (temp/lluvia/HR/viento, previsión horaria Open-Meteo) + previsión 7 d + observado 7 d con acumulada, estilo x-y.es con `.param-table` propio; la lluvia observada marcada `*` es del pluviómetro (`prov.semana`). Del pluviómetro salen también `tmed`, `hrMedia` (ojo: en mayúsculas en los datos) y `racha` en km/h (verificado contra el modelo) para temp/HR/viento + retro; del modelo solo quedan suelo 18 cm y altitud. Ojo técnico: `AEMET_BASE` es `.../opendata` sin `/api` (los paths ya lo traen; con doble `/api/api/` daba 404); AEMET sirve ISO-8859-15 (hace falta `TextDecoder`, `response.json()` rompería) y coords en DMS compacto (`405323N`); `getJSON`/`getJSONLatin` con un reintento ante fallos de red o 5xx (no ante 4xx). La ofuscación no es seguridad real (el navegador usa la clave en claro); si el repo es público, cualquiera puede extraerla.

## Para ejecutar
Sin build: `python3 -m http.server` en la carpeta y abrir `http://localhost:8000`
(o abrir `index.html` directamente; Leaflet y las APIs necesitan internet).

## Ideas pendientes (no empezadas)
- Avisos "hoy es el día" con fecha de disparador guardada por punto.
- Capa MFE de frondosas/edad para el bonus de pinar joven del níscalo.
- Más especies (flujo: investigar → preguntar umbrales → tarjeta + ficha + análisis).
- Cotos en el desplegable: hecho (v1.36). Pendiente el polígono al pinchar: el visor micologiacyl usa WMS de Cesefor sin GeoJSON localizado.
