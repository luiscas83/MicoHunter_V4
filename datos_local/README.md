# Datos locales (pH, hábitat, altitud) — España offline

`consulta_local.py` responde `pH + hábitat + altitud` para un `lat,lon`
**sin internet** (tras la primera descarga). Verificado en Soria 41.934,-2.792:

| dato | local | online | fuente local |
|---|---|---|---|
| pH | 6,2 | 6,2 | SoilGrids WCS 5–15 cm |
| altitud | 1420 m | 1421 m | Terrarium z9 (Copernicus) |
| hábitat | Bosque mixto (Fagus/Pinus/Quercus) | idéntico | MFE WFS IEPNB |

## Ficheros

```
datos_local/
  ph_peninsula.tif  (~5 MB)   pH SoilGrids 5–15 cm, rejilla 0.0025 (~278 m)
  ph_canarias.tif   (~0.1 MB) idem Canarias
  mdt_peninsula.tif (~20 MB)  altitud int16, misma rejilla (océano = nodata)
  mdt_canarias.tif  (~0.4 MB) idem Canarias
  mfe/mfe_lonX_latY.json.gz   MFE por teselas 1x1 (formaciones + ff_uso,
                              geometría simplificada 25/100 m, ~0.2–5 MB c/u)
  cache.json                  caché de puntos (1ª consulta online, resto local)
```

Total nacional: **~300 MB** (pH+suelo 50 + MDT 20,5 + MFE 226). Todo generado,
nada a mano (`.gitignore` excluye `.tif` y `mfe/`).

## Scripts (raíz, solo stdlib + `requests/pillow/numpy/tifffile`)

```
python descarga_ph_espana.py            # WCS ISRIC pH (CC-BY 4.0), ~2 min
python descarga_ph_espana.py todo      # + soc/arena/limo/arcilla, ~10 min
python descarga_mdt_espana.py           # Terrarium AWS (Copernicus), ~10 min
python descarga_mfe.py -3 41            # una tesela MFE (WFS IEPNB), ~3 min
python descarga_mfe.py nacional         # 153 teselas, ~2 h, reanuda solas
python descarga_mfe.py reparar          # reintenta capas con cortes
python consulta_local.py 41.934 -2.792            # online 1ª vez, guarda caché
python consulta_local.py 41.934 -2.792 --local    # 100% offline
python consulta_local.py --lote puntos.csv        # csv lat,lon por línea
python servidor_local.py                # web en http://127.0.0.1:8134/
python estado_mfe.py                    # barra de progreso del pack MFE
python test_50.py                       # 50 puntos local vs online
```

## Notas

- pH: el TIFF es la misma capa que la API REST (`phh2o_5-15cm_mean`, pH×10);
  píxel verificado igual (Tenerife 7,2 = REST).
- Altitud: Terrarium z9 deriva de Copernicus (como Open-Meteo elevation);
  ±1–3 % en picos (Teide 3617 vs 3718). Las bandas del motor son anchas.
- Hábitat: misma lógica que `app.js` (`categoriaDeEspecie`, 36 formaciones +
  `ff_uso`, mixto, acompañantes). El WFS omite la geometría si no se pide:
  hay que incluir `geom` en `PROPERTYNAME`. `ff_uso` se descarga en trozos
  de 0,25° (la tesela entera supera el corte del servidor, ~150 MB).
- CNIG (MDT del IGN) no responde desde esta red; por eso el MDT es Terrarium.
  Con red al CNIG: series `T2002` (MDT200 2ª cob.) vía `archivosSerie`.
- Licencias: SoilGrids CC-BY 4.0 · IGN CC-BY 4.0 scne.es · MFE (MITECO).
