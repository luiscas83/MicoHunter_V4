"""Descarga MFE offline por teselas via WFS IEPNB (solo stdlib + requests).

Por tesela pide las 36 formaciones + ff_uso (atributos recortados a los que
usa la app: nom_sp1..3, nm_o1..3, nm_fccarb, descr_forarb + CLAMFE/LULUCF
para ff_uso), redondea coords a 5 decimales y guarda
datos_local/mfe/mfe_lonXX_latYY.json. Reanuda (salta teselas existentes).
Uso:
  python descarga_mfe.py -3 41     # tesela lon -3..-2, lat 41..42 (Soria)
  python descarga_mfe.py nacional  # toda Espana en teselas 1x1 (lento, ~1 h)
"""
import gzip
import json
import os
import re
import sys
import urllib.parse
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(BASE, "datos_local", "mfe")
WFS = "https://geoserver.iepnb.es/geoserver/foto_fija_mfe/ows"
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
PROP_FORM = ("geom,nom_sp1,nom_sp2,nom_sp3,nm_fccarb,descr_forarb")
PROP_USO = ("geom,nom_sp1,nm_fccarb,descr_clamfe,agrupacion_clamfe,"
            "nb_lulucf_nivel1,nb_lulucf_nivel2,nb_lulucf_nivel3,id_lulucf")


def pedir(capa, bbox, prop, intentos=3, maxfeatures=None):
    import time
    par = {"SERVICE": "WFS", "VERSION": "1.0.0",
        "REQUEST": "GetFeature", "TYPENAME": "foto_fija_mfe:" + capa,
        "BBOX": bbox, "SRSNAME": "EPSG:4326",
        "OUTPUTFORMAT": "application/json", "PROPERTYNAME": prop}
    if maxfeatures:
        par["MAXFEATURES"] = str(maxfeatures)
    q = urllib.parse.urlencode(par)
    err = None
    for i in range(intentos):
        try:
            req = urllib.request.Request(
                WFS + "?" + q, headers={"User-Agent": "MicoHunter-local/1.0"})
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)
        except Exception as e:
            err = e
            time.sleep(2 * (i + 1))
    raise err


def dp(anillo, tol=0.00025):
    """Douglas-Peucker iterativo (~25 m). El anillo sigue cerrado."""
    pts = [(p[0], p[1]) for p in anillo]
    if len(pts) < 4 or pts[0] != pts[-1]:
        cuerpo, cerrado = pts, False
    else:
        cuerpo, cerrado = pts[:-1], True
    n = len(cuerpo)
    if n < 3:
        return anillo
    keep = bytearray(n)
    keep[0] = keep[n - 1] = 1
    pila = [(0, n - 1)]
    t2 = tol * tol
    while pila:
        a, b = pila.pop()
        ax, ay = cuerpo[a]
        bx, by = cuerpo[b]
        dx, db = bx - ax, by - ay
        den = dx * dx + db * db
        dmax, imax = 0.0, -1
        for i in range(a + 1, b):
            px, py = cuerpo[i]
            if den:
                t = ((px - ax) * dx + (py - ay) * db) / den
                t = 0.0 if t < 0 else (1.0 if t > 1 else t)
                ex, ey = ax + t * dx, ay + t * db
            else:
                ex, ey = ax, ay
            d = (px - ex) ** 2 + (py - ey) ** 2
            if d > dmax:
                dmax, imax = d, i
        if dmax > t2:
            keep[imax] = 1
            pila.append((a, imax))
            pila.append((imax, b))
    out = [list(cuerpo[i]) for i in range(n) if keep[i]]
    if cerrado:
        out.append(out[0])
    return out


def simplificar_geom(g):
    return simplificar_geom_tol(g, 0.00025)  # ~25 m para formaciones


def simplificar_geom_tol(g, tol):
    t = g.get("type")
    if t == "Polygon":
        return {"type": t, "coordinates": [dp(a, tol)
                                           for a in g["coordinates"]]}
    if t == "MultiPolygon":
        return {"type": t, "coordinates": [[dp(a, tol) for a in p]
                                           for p in g["coordinates"]]}
    return g


def redondear(o):
    if isinstance(o, float):
        return round(o, 4)  # ~11 m; el MFE es 1:25000, sin perdida practica
    if isinstance(o, list):
        return [redondear(v) for v in o]
    if isinstance(o, dict):
        return {k: redondear(v) for k, v in o.items()}
    return o


def trozos(lon, lat, n):
    paso = 1.0 / n
    for ix in range(n):
        for iy in range(n):
            x0, y0 = lon + ix * paso, lat + iy * paso
            yield "%s,%s,%s,%s" % (x0, y0, x0 + paso, y0 + paso)


def fetch_formacion(capa, lon, lat):
    """Capa de formacion: tesela entera o 4 mitades si el servidor corta."""
    bb = "%s,%s,%s,%s" % (lon, lat, lon + 1, lat + 1)
    try:
        j = pedir(capa, bb, PROP_FORM)
        return j.get("features", [])
    except Exception:
        print("  %s en 4 mitades…" % capa)
        out = []
        for q in trozos(lon, lat, 2):
            out += pedir(capa, q, PROP_FORM).get("features", [])
        return out


def fetch_uso(lon, lat):
    """ff_uso: trozos de 0,25 o 0,125 si el servidor corta."""
    bb = "%s,%s,%s,%s" % (lon, lat, lon + 1, lat + 1)
    if not pedir("ff_uso", bb, PROP_USO, maxfeatures=1).get("features"):
        print("  ff_uso: sin teselas en el ambito")
        return []
    for n in (4, 8, 16):
        try:
            out = []
            for q in trozos(lon, lat, n):
                out += pedir("ff_uso", q, PROP_USO).get("features", [])
            print("  ff_uso: %d poligonos (trozos 1/%d)" % (len(out), n))
            return out
        except Exception as e:
            print("  ff_uso 1/%d: corte (%s), afino…" % (n, str(e)[:60]))
    raise RuntimeError("ff_uso imposible en tesela %s,%s" % (lon, lat))


def guardar_f(feats, capa, tol):
    out = []
    for f in feats:
        if (f.get("geometry") or {}).get("coordinates"):
            f["geometry"] = simplificar_geom_tol(f["geometry"], tol)
            f["_capa"] = capa
            out.append(f)
    return out
def tesela(lon, lat):
    os.makedirs(DIR, exist_ok=True)
    dest = os.path.join(DIR, "mfe_lon%+d_lat%+d.json.gz" % (lon, lat))
    if os.path.exists(dest):
        print("tesela %d,%d ya existe, salto" % (lon, lat))
        return dest
    feats, fallos = [], []
    for c in FORMACIONES:
        try:
            feats += guardar_f(fetch_formacion(c, lon, lat), c, 0.00025)
        except Exception as e:
            fallos.append(c)
            print("  %s: fallo %s" % (c, str(e)[:80]))
    try:
        feats += guardar_f(fetch_uso(lon, lat), "ff_uso", 0.001)
    except Exception as e:
        fallos.append("ff_uso")
        print("  ff_uso: fallo %s" % str(e)[:80])
    return guardar_tesela(lon, lat, feats, fallos)


def guardar_tesela(lon, lat, feats, fallos=None):
    dest = os.path.join(DIR, "mfe_lon%+d_lat%+d.json.gz" % (lon, lat))
    data = redondear({"tesela": [lon, lat], "_fallos": fallos or [],
                      "features": feats})
    raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
    with open(dest, "wb") as f:
        f.write(gzip.compress(raw, compresslevel=6))
    print("tesela %d,%d: %d poligonos, %.1f MB -> %.2f MB gz"
          % (lon, lat, len(feats), len(raw) / 1e6,
             os.path.getsize(dest) / 1e6))
    return dest


def reparar(trabajadores=8):
    """Re-descarga las capas que falten en cada tesela (cortes del servidor).
    Solo anade; nunca borra. Idempotente y reanudable."""
    import glob
    from concurrent.futures import ThreadPoolExecutor

    def una(dest):
        m = re.search(r"lon([+-]?\d+)_lat([+-]?\d+)",
                      os.path.basename(dest))
        lon, lat = int(m.group(1)), int(m.group(2))
        op = gzip.open
        with op(dest, "rb") as f:
            doc = json.loads(f.read().decode("utf-8"))
        feats = doc["features"]
        presentes = set(f.get("_capa") for f in feats)
        if "_fallos" in doc:
            faltan = [c for c in doc["_fallos"] if c not in presentes]
        elif os.path.getsize(dest) < 2000:
            return dest, "mar-ok"
        else:
            # teselas antiguas sin registro: reintenta lo ausente
            faltan = [c for c in FORMACIONES + ["ff_uso"]
                      if c not in presentes]
        if os.path.getsize(dest) < 2000:
            return dest, "mar-ok"
        if not faltan:
            return dest, "ok"
        print("tesela %d,%d: faltan %s" % (lon, lat, ",".join(faltan)))
        siguen = []
        for c in faltan:
            try:
                if c == "ff_uso":
                    feats += guardar_f(fetch_uso(lon, lat), c, 0.001)
                else:
                    feats += guardar_f(fetch_formacion(c, lon, lat), c,
                                       0.00025)
            except Exception as e:
                siguen.append(c)
                print("  %s: sigue fallando %s" % (c, str(e)[:80]))
        presentes = set(f.get("_capa") for f in feats)
        siguen = [c for c in siguen if c not in presentes]
        return guardar_tesela(lon, lat, feats, siguen), "reparada"

    dests = sorted(glob.glob(os.path.join(DIR, "mfe_lon*.json.gz")))
    with ThreadPoolExecutor(max_workers=trabajadores) as ex:
        res = list(ex.map(una, dests))
    from collections import Counter
    print(Counter(r for _, r in res))


def nacional(trabajadores=4):
    from concurrent.futures import ThreadPoolExecutor
    # malla 1x1 sobre pen+Baleares, Ceuta/Melilla y Canarias
    teselas = [(lon, lat) for lon in range(-10, 5) for lat in range(35, 44)]
    teselas += [(lon, lat) for lon in range(-19, -13)
                for lat in range(27, 30)]
    with ThreadPoolExecutor(max_workers=trabajadores) as ex:
        dests = list(ex.map(lambda t: tesela(*t), teselas))
    mb = sum(os.path.getsize(d) / 1e6 for d in dests)
    print("nacional: %d teselas, %.0f MB" % (len(dests), mb))


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "nacional":
        nacional()
    elif len(sys.argv) == 2 and sys.argv[1] == "reparar":
        reparar()
    elif len(sys.argv) == 3:
        tesela(int(sys.argv[1]), int(sys.argv[2]))
    else:
        print(__doc__)
