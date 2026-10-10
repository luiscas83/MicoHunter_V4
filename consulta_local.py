"""Consulta local de pH, habitat y altitud por punto (lat,lon).

Local primero, remoto como respaldo (mismas fuentes que app.js):
 - pH: datos_local/phh2o_5-15cm_espana.tif (SoilGrids 5-15cm mean /10) si existe,
       si no REST SoilGrids (igual que fetchSuelo en app.js).
 - altitud: datos_local/mdt_espana.tif si existe,
       si no api.open-meteo.com/v1/elevation (igual que la app).
 - habitat: datos_local/cache.json si el punto ya se consulto,
       si no MFE GetFeatureInfo (36 formaciones + ff_uso, igual que app.js).
       El vectorial MFE offline (.gpkg) es GBs: se cubre via cache
       (1a vez online, resto offline). Ver datos_local/README.md.

Sin dependencias obligatorias (solo stdlib + requests).
Para leer .tif locales: pip install numpy tifffile.
Uso:
  python consulta_local.py 41.934 -2.792
  python consulta_local.py 41.934 -2.792 --local
  python consulta_local.py --lote puntos.csv
"""
import csv
import json
import math
import os
import re
import sys
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

BASE = os.path.dirname(os.path.abspath(__file__))
DATOS = os.path.join(BASE, "datos_local")
CACHE_F = os.path.join(DATOS, "cache.json")
# Piezas nacionales: (fichero, minlon, minlat, maxlon, maxlat)
TIFS_PH = [("ph_peninsula.tif", -9.6, 35.4, 4.6, 44.0),
           ("ph_canarias.tif", -18.3, 27.6, -13.5, 29.6)]
TIFS_MDT = [("mdt_peninsula.tif", -9.6, 35.4, 4.6, 44.0),
            ("mdt_canarias.tif", -18.3, 27.6, -13.5, 29.6)]
# Nombres antiguos (una sola pieza): se aceptan si existen
TIF_PH = os.path.join(DATOS, "phh2o_5-15cm_espana.tif")
TIF_MDT = os.path.join(DATOS, "mdt_espana.tif")

MFE_BASE = "https://geoserver.iepnb.es/geoserver/foto_fija_mfe"
FORMACIONES = ["robledales_qrobur_qpetraea", "abedulares", "avellanedas",
 "robledales_roble_pubescente", "quejigares", "hayedos", "castanares",
 "fresnedas", "acebedas", "encinares", "alcornocales", "abetales", "pinsapares",
 "sabinares_juniperus_phoenicea", "sabinares_albares", "enebrales",
 "pinar_pino_albar", "pinar_pino_negro", "pinar_pino_pinonero",
 "pinar_pino_carrasco", "pinar_pino_salgareno",
 "pinar_pino_pinaster_reg_mediterranea", "pinar_pino_pinaster_reg_atlantica",
 "pinar_pino_radiata", "frondosas_aloctonas_invasoras",
 "coniferas_aloctonas_gestion", "mezcla_coniferas_autoc_aloctonas",
 "mezcla_coniferas_frondosas_autoc_aloctonas",
 "frondosas_aloctonas_con_autoctonas", "bosque_ribereno", "dehesas",
 "choperas_plataneras_produccion", "eucaliptales", "repoblacion_quercus_rubra",
 "otras_coniferas_aloctonas_produccion", "otras_especies_produccion_mezcla"]
CAT_NOBLE = ["Pinar", "Hayedo", "Robledal", "Castañeral", "Quercíneas"]


def categoria_de_especie(n):
    """Espejo de categoriaDeEspecie en app.js."""
    t = (n or "").lower()
    if re.search(r"pinus|larix|pseudotsuga|cedrus|cupressus", t):
        return ("Pinar", 1)
    if re.search(r"fagus", t):
        return ("Hayedo", 1)
    if re.search(r"quercus (robur|petraea|pyrenaica|pubescens|humilis|faginea|rubra)", t):
        return ("Robledal", 1)
    if re.search(r"quercus", t):
        return ("Quercíneas", 0)
    if re.search(r"castanea", t):
        return ("Castañeral", 1)
    return ("Matorral", 0)


def get_json(url, timeout=12):
    req = urllib.request.Request(url, headers={"User-Agent": "MicoHunter-local/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", errors="replace"))


def leer_pixel_tif(path, lat, lon):
    """Lee un GeoTIFF local por lat/lon. Requiere numpy+tifffile."""
    import numpy as np
    import tifffile
    with tifffile.TiffFile(path) as tif:
        page = tif.pages[0]
        a = page.asarray()
        tag_x = page.tags.get("ModelPixelScaleTag")
        tag_t = page.tags.get("ModelTiepointTag")
        if tag_x is None or tag_t is None:
            raise RuntimeError("TIFF sin georreferencia (falta ModelPixelScale/Tiepoint)")
        sx, sy = float(tag_x.value[0]), float(tag_x.value[1])
        tp = tag_t.value  # [I,J,K, X,Y,Z]
        x0, y0 = float(tp[3]), float(tp[4])
        # apoyo basico: supone norte-arriba sin rotacion
        col = int((lon - x0) / sx)
        row = int((y0 - lat) / sy)
        if row < 0 or col < 0 or row >= a.shape[-2] or col >= a.shape[-1]:
            return None
        v = a[row, col]
        if isinstance(v, np.ndarray):
            v = float(v.flat[0])
        else:
            v = float(v)
        nodata = page.tags.get("GDAL_NODATA")
        if nodata is not None:
            m = re.search(r"-?\d+", str(nodata.value))
            if m and v == float(m.group(0)):
                return None
        if "mdt" in os.path.basename(path).lower() and v < -1000:
            return None  # oceano en Terrarium (batimetria)
        if "ph" in os.path.basename(path).lower() and v <= 0:
            return None
        return v


def leer_pieza(piezas, lat, lon):
    """Elige la pieza nacional que contiene el punto y lee el pixel."""
    for nombre, minx, miny, maxx, maxy in piezas:
        if minx <= lon <= maxx and miny <= lat <= maxy:
            p = os.path.join(DATOS, nombre)
            if os.path.exists(p):
                try:
                    return leer_pixel_tif(p, lat, lon)
                except Exception as e:
                    raise RuntimeError("%s: %s" % (nombre, e))
            return None
    return None  # fuera de Espana (p. ej. sur de Francia en el bbox)


def fetch_ph_remoto(lat, lon):
    url = ("https://rest.isric.org/soilgrids/v2.0/properties/query?lon=%s&lat=%s"
           "&property=phh2o&depth=5-15cm&value=mean" % (lon, lat))
    j = get_json(url, 12)
    for layer in j.get("properties", {}).get("layers", []):
        if layer.get("name") == "phh2o":
            v = layer.get("depths", [{}])[0].get("values", {}).get("mean")
            if v is not None:
                return round(v / 10, 2), "SoilGrids-remoto"
    return None, "SoilGrids-remoto(fallo)"


def fetch_alt_remoto(lat, lon):
    try:
        j = get_json("https://api.open-meteo.com/v1/elevation?latitude=%s&longitude=%s"
                     % (lat, lon), 15)
        e = (j.get("elevation") or [None])[0]
        return (int(round(e)) if e is not None else None, "OpenMeteo-elevation")
    except Exception:
        return None, "OpenMeteo-elevation(fallo)"


def mfe_url(capa, lat, lon):
    d = 0.0011
    q = dict(SERVICE="WMS", VERSION="1.1.1", REQUEST="GetFeatureInfo",
             LAYERS=capa, QUERY_LAYERS=capa, STYLES="", SRS="EPSG:4326",
             BBOX="%s,%s,%s,%s" % (lon - d, lat - d, lon + d, lat + d),
             WIDTH=101, HEIGHT=101, FORMAT="image/png",
             INFO_FORMAT="application/json", FEATURE_COUNT=3, X=50, Y=50)
    return "%s/%s/wms?%s" % (MFE_BASE, capa, urllib.parse.urlencode(q))


def mfe_gfi(capa, lat, lon):
    try:
        j = get_json(mfe_url(capa, lat, lon), 12)
        f = (j.get("features") or [None])[0]
        return (capa, f.get("properties") if f else None)
    except Exception:
        return (capa, None)


def fetch_habitat_remoto(lat, lon):
    with ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(lambda c: mfe_gfi(c, lat, lon), FORMACIONES))
    hits = [(c, p) for c, p in res if p]
    esp = {}
    for capa, p in hits:
        for k in ("1", "2", "3"):
            n = p.get("nom_sp" + k)
            if n and "sin especie" not in n.lower() and n not in esp:
                esp[n] = {"oc": p.get("nm_o" + k, 0),
                          "fcc": p.get("nm_fccarb"),
                          "form": p.get("descr_forarb") or capa}
    notas = {}
    for n in esp:
        cat, nota = categoria_de_especie(n)
        notas[cat] = max(notas.get(cat, -1), nota)
    nobles = [c for c in notas if c in CAT_NOBLE]
    if nobles:
        if len(nobles) >= 2:
            categoria = "Bosque mixto"
            nota = max(notas[c] for c in nobles)
        else:
            categoria = nobles[0]
            nota = notas[categoria]
    elif hits:
        categoria, nota = "Matorral", 0
    else:
        # sin formaciones: probar ff_uso (igual que app.js:mfeUso, resumido)
        try:
            j = get_json(mfe_url("ff_uso", lat, lon), 12)
            f = (j.get("features") or [None])[0]
            p = f.get("properties") if f else None
            if p:
                txt = " ".join([p.get("descr_clamfe") or "",
                                p.get("agrupacion_clamfe") or "",
                                p.get("nb_lulucf_nivel1") or ""]).lower()
                if re.search(r"artificial|asentamiento|urbano", txt):
                    return {"categoria": None, "nota": None, "fuente": "MFE ff_uso",
                            "detalle": "artificial/urbano", "especies": []}
                n = p.get("nom_sp1")
                if n and "sin especie" not in n.lower():
                    cat, nota = categoria_de_especie(n)
                    return {"categoria": cat, "nota": nota, "fuente": "MFE ff_uso",
                            "detalle": "arbolado ff_uso: %s" % n,
                            "especies": [n]}
                return {"categoria": None, "nota": None, "fuente": "MFE ff_uso",
                        "detalle": txt[:120] or "sin uso aprovechable", "especies": []}
        except Exception:
            pass
        return {"categoria": None, "nota": None, "fuente": "MFE",
                "detalle": "sin bosque MFE: habitat sin determinar", "especies": []}
    comp_txt = [(r"abies", "abetal"), (r"fraxinus", "fresneda"),
                (r"betula", "abedular"), (r"corylus", "avellaneda")]
    comp = []
    for n in esp:
        if categoria_de_especie(n)[0] != "Matorral":
            continue
        for rx, nombre in comp_txt:
            if re.search(rx, n, re.I) and nombre not in comp:
                comp.append(nombre)
    etiqueta = categoria + (" + " + " + ".join(comp[:2]) if comp else "")
    return {"categoria": categoria, "nota": nota, "fuente": "MFE",
            "detalle": etiqueta,
            "especies": sorted(esp)[:12], "componentes": nobles}


def en_poli(lat, lon, coords):
    """Ray-casting como enPoli en app.js. coords: lista de poligonos."""
    dentro = False
    for poly in coords:
        for anillo in poly:
            n = len(anillo)
            j = n - 1
            for i in range(n):
                xi, yi = anillo[i][0], anillo[i][1]
                xj, yj = anillo[j][0], anillo[j][1]
                if ((yi > lat) != (yj > lat)) and \
                   (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
                    dentro = not dentro
                j = i
    return dentro


_TILES_MFE = {}
DIR_MFE = os.path.join(DATOS, "mfe")


def cargar_tesela_mfe(lon, lat):
    import gzip
    clave = (lon, lat)
    if clave not in _TILES_MFE:
        if len(_TILES_MFE) >= 6:
            _TILES_MFE.pop(next(iter(_TILES_MFE)))
        p = os.path.join(DIR_MFE, "mfe_lon%+d_lat%+d.json.gz" % (lon, lat))
        if not os.path.exists(p):  # compat nombre antiguo sin .gz
            p = os.path.join(DIR_MFE, "mfe_lon%+d_lat%+d.json" % (lon, lat))
        if not os.path.exists(p):
            return None
        op = gzip.open if p.endswith(".gz") else open
        with op(p, "rb") as f:
            d = f.read()
            if isinstance(d, bytes):
                d = d.decode("utf-8")
            _TILES_MFE[clave] = json.loads(d).get("features", [])
    return _TILES_MFE[clave]


def contiene(feat, lat, lon):
    g = feat.get("geometry") or {}
    t = g.get("type")
    c = g.get("coordinates") or []
    if t == "Polygon":
        return en_poli(lat, lon, [c])
    if t == "MultiPolygon":
        return en_poli(lat, lon, c)
    return False


def clasificar_uso(p):
    """Espejo de mfeUso en app.js."""
    txt = " ".join([(p.get("descr_clamfe") or ""),
                    (p.get("agrupacion_clamfe") or ""),
                    (p.get("nb_lulucf_nivel1") or "")]).lower()
    if re.search(r"artificial|asentamiento|urbano", txt):
        return None, None, "artificial"
    if re.search(r"dehesa", txt):
        return "Pasto", 0, "dehesa"
    if re.search(r"matorral", txt):
        return "Matorral", 0, "matorral"
    if re.search(r"arbustiva", txt):
        return "Pasto", 0, "pastizal arbustivo"
    if re.search(r"herbácea|herbacea|prado|pradera", txt):
        return "Pradera", 0, "pradera"
    if re.search(r"past|puerto", txt):
        return "Pasto", 0, "pasto"
    if re.search(r"cultiv|agr", txt):
        return "Pradera", 0, "cultivo"
    if re.search(r"agua|humedal|improductivo", txt):
        return "Pradera", 0, "agua/improductivo"
    if re.search(r"forestal", txt):
        n = p.get("nom_sp1")
        if n and "sin especie" not in n.lower():
            cat, nota = categoria_de_especie(n)
            return cat, nota, "arbolado (ff_uso)"
    return None, None, (txt[:120] or "sin uso aprovechable")


def fetch_habitat_local(lat, lon):
    """Habitat 100% offline desde teselas MFE. Misma logica que el remoto."""
    lon0, lat0 = math.floor(lon), math.floor(lat)
    teselas = []
    for dx in (0, -1, 1):
        for dy in (0, -1, 1):
            t = cargar_tesela_mfe(lon0 + dx, lat0 + dy)
            if t:
                teselas.append(t)
    if not teselas:
        return None
    principal = teselas[0]
    # 1) formaciones que contienen el punto (tesela propia + vecinas)
    hits = []
    for t in teselas:
        for f in t:
            if f.get("_capa") == "ff_uso":
                continue
            g = f.get("geometry") or {}
            c = g.get("coordinates") or []
            if not c:
                continue
            xs = [p[0] for poly in (c if g.get("type") == "MultiPolygon" else [c])
                  for anillo in poly for p in anillo]
            ys = [p[1] for poly in (c if g.get("type") == "MultiPolygon" else [c])
                  for anillo in poly for p in anillo]
            if not xs or not (min(xs) <= lon <= max(xs)
                              and min(ys) <= lat <= max(ys)):
                continue
            if contiene(f, lat, lon):
                hits.append(f)
    if hits:
        esp = {}
        for f in hits:
            p = f.get("properties", {})
            for k in ("nom_sp1", "nom_sp2", "nom_sp3"):
                n = p.get(k)
                if n and "sin especie" not in n.lower() and n not in esp:
                    esp[n] = {"fcc": p.get("nm_fccarb"),
                              "form": p.get("descr_forarb")
                              or f.get("_capa", "")}
        notas = {}
        for n in esp:
            cat, nota = categoria_de_especie(n)
            notas[cat] = max(notas.get(cat, -1), nota)
        nobles = [c for c in notas if c in CAT_NOBLE]
        if nobles:
            if len(nobles) >= 2:
                categoria = "Bosque mixto"
                nota = max(notas[c] for c in nobles)
            else:
                categoria = nobles[0]
                nota = notas[categoria]
        else:
            categoria, nota = "Matorral", 0
        comp_txt = [(r"abies", "abetal"), (r"fraxinus", "fresneda"),
                    (r"betula", "abedular"), (r"corylus", "avellaneda")]
        comp = []
        for n in esp:
            if categoria_de_especie(n)[0] != "Matorral":
                continue
            for rx, nombre in comp_txt:
                if re.search(rx, n, re.I) and nombre not in comp:
                    comp.append(nombre)
        etiqueta = categoria + (" + " + " + ".join(comp[:2]) if comp else "")
        return {"categoria": categoria, "nota": nota, "fuente": "MFE-local",
                "detalle": etiqueta, "especies": sorted(esp)[:12],
                "componentes": nobles}
    # 2) fallback ff_uso (propia + vecinas)
    for t in teselas:
        for f in t:
            if f.get("_capa") != "ff_uso":
                continue
            if contiene(f, lat, lon):
                p = f.get("properties", {})
                cat, nota, clase = clasificar_uso(p)
                if clase == "artificial":
                    return {"categoria": None, "nota": None,
                            "fuente": "MFE-local",
                            "detalle": "artificial/urbano", "especies": []}
                if cat:
                    det = ("arbolado ff_uso: %s" % p.get("nom_sp1")
                           if clase.startswith("arbolado") else clase)
                    esp = [p.get("nom_sp1")] if p.get("nom_sp1") else []
                    return {"categoria": cat, "nota": nota,
                            "fuente": "MFE-local", "detalle": det,
                            "especies": esp}
                return {"categoria": None, "nota": None,
                        "fuente": "MFE-local", "detalle": clase,
                        "especies": []}
    # formaciones sin especies aprovechables pero con tesela (== Matorral remoto
    # cuando hits existen; aqui sin hits ni uso: sin determinar)
    return {"categoria": None, "nota": None, "fuente": "MFE-local",
            "detalle": "sin bosque MFE ni uso aprovechable", "especies": []}


def cargar_cache():
    try:
        with open(CACHE_F, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def guardar_cache(cache):
    os.makedirs(DATOS, exist_ok=True)
    with open(CACHE_F, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=1)


def consultar(lat, lon, solo_local=False):
    clave = "%s,%s" % (round(lat, 4), round(lon, 4))
    cache = cargar_cache()
    out = {"lat": lat, "lon": lon, "fuentes": {}}

    # 1) pH
    ph, fph = None, None
    if os.path.exists(TIF_PH):
        try:
            v = leer_pixel_tif(TIF_PH, lat, lon)
            if v is not None:
                ph, fph = round(v / 10, 2), "SoilGrids-local"
        except Exception as e:
            out.setdefault("avisos", []).append("TIFF pH ilegible (%s)" % e)
    if ph is None:
        try:
            v = leer_pieza(TIFS_PH, lat, lon)
            if v is not None:
                ph, fph = round(v / 10, 2), "SoilGrids-local"
        except Exception as e:
            out.setdefault("avisos", []).append("TIFF pH ilegible (%s): pip install numpy tifffile" % e)
    if ph is None and clave in cache and "ph" in cache[clave]:
        ph, fph = cache[clave]["ph"], "cache-local"
    if ph is None and not solo_local:
        ph, fph = fetch_ph_remoto(lat, lon)
    out["ph"] = ph
    out["fuentes"]["ph"] = fph or "sin-datos"

    # 2) altitud
    alt, falt = None, None
    if os.path.exists(TIF_MDT):
        try:
            v = leer_pixel_tif(TIF_MDT, lat, lon)
            if v is not None:
                alt, falt = int(round(v)), "MDT-local"
        except Exception as e:
            out.setdefault("avisos", []).append("TIFF MDT ilegible (%s)" % e)
    if alt is None:
        try:
            v = leer_pieza(TIFS_MDT, lat, lon)
            if v is not None:
                alt, falt = int(round(v)), "MDT-local"
        except Exception as e:
            out.setdefault("avisos", []).append("TIFF MDT ilegible (%s)" % e)
    if alt is None and clave in cache and "altitud" in cache[clave]:
        alt, falt = cache[clave]["altitud"], "cache-local"
    if alt is None and not solo_local:
        alt, falt = fetch_alt_remoto(lat, lon)
    out["altitud"] = alt
    out["fuentes"]["altitud"] = falt or "sin-datos"

    # 3) habitat: tesela MFE local > cache > remoto
    hab = None
    try:
        hab = fetch_habitat_local(lat, lon)
    except Exception as e:
        out.setdefault("avisos", []).append("MFE local: %s" % e)
    if hab is None and clave in cache and "habitat" in cache[clave]:
        hab = dict(cache[clave]["habitat"])
        hab["fuente"] = "cache-local"
    if hab is None and not solo_local:
        hab = fetch_habitat_remoto(lat, lon)
    out["habitat"] = hab
    out["fuentes"]["habitat"] = (hab or {}).get("fuente", "sin-datos")

    # guardar en cache lo remoto
    if not solo_local and (ph is not None or alt is not None or hab):
        reg = cache.get(clave, {})
        if ph is not None and fph and "remoto" in fph:
            reg["ph"] = ph
        if alt is not None and falt and "elevation" in str(falt):
            reg["altitud"] = alt
        if hab and hab.get("fuente") in ("MFE", "MFE ff_uso"):
            reg["habitat"] = hab
        if reg:
            cache[clave] = reg
            guardar_cache(cache)
            out["fuentes"]["cache"] = "guardado en datos_local/cache.json"
    return out


def main(argv):
    solo_local = "--local" in argv
    args = [a for a in argv[1:] if not a.startswith("--")]
    puntos = []
    if "--lote" in argv:
        i = argv.index("--lote")
        with open(argv[i + 1], encoding="utf-8") as f:
            for row in csv.reader(f):
                if len(row) >= 2:
                    puntos.append((float(row[0]), float(row[1])))
    elif len(args) >= 2:
        puntos.append((float(args[0]), float(args[1])))
    else:
        print(__doc__)
        return 2
    for lat, lon in puntos:
        print(json.dumps(consultar(lat, lon, solo_local), ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
