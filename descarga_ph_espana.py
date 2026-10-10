"""Descarga pH SoilGrids 5-15cm mean recortado a Espana via WCS (ISRIC, CC-BY 4.0).

WCS verificado: https://maps.isric.org/mapserv?map=/map/phh2o.map (WCS 1.0.0),
cobertura 'phh2o_5-15cm_mean', valores pH*10 (igual que la API REST que usa app.js).
Dos piezas: peninsula+Baleares y Canarias (un solo bbox saldria ~90 MB y el
servidor lo corta; asi quedan ~40 + ~3 MB).
Salida: datos_local/ph_peninsula.tif y datos_local/ph_canarias.tif.
Sin dependencias (solo stdlib). Reanuda verificando tamano si se corta.
"""
import os
import sys
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
DATOS = os.path.join(BASE, "datos_local")
WCS = "https://maps.isric.org/mapserv?map=/map/phh2o.map"
COV = "phh2o_5-15cm_mean"

PIEZAS = {
    # nombre: (minx, miny, maxx, maxy, res_grados)
    "ph_peninsula": (-9.6, 35.4, 4.6, 44.0, 0.0025),    # ~278 m, ~39 MB
    "ph_canarias": (-18.3, 27.6, -13.5, 29.6, 0.0025),  # ~3 MB
}


def url_pieza(minx, miny, maxx, maxy, res):
    w = int(round((maxx - minx) / res))
    h = int(round((maxy - miny) / res))
    q = ("SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=%s&CRS=EPSG:4326"
         "&BBOX=%s,%s,%s,%s&WIDTH=%d&HEIGHT=%d&FORMAT=GEOTIFF_INT16"
         % (COV, minx, miny, maxx, maxy, w, h))
    return "%s&%s" % (WCS, q), w, h


def descargar(nombre, url, destino):
    req = urllib.request.Request(url, headers={"User-Agent": "MicoHunter-local/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        ctype = r.headers.get("Content-Type", "")
        if "xml" in ctype:
            print("ERROR servidor (%s):\n%s" % (nombre, r.read()[:2000].decode("utf-8", "replace")))
            return False
        total = int(r.headers.get("Content-Length") or 0)
        print("%s: %s, %.1f MB" % (nombre, ctype, total / 1e6))
        leido = 0
        with open(destino, "wb") as f:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
                leido += len(b)
                print("  %.1f MB..." % (leido / 1e6), end="\r")
        print("  %s guardado (%.1f MB)" % (destino, leido / 1e6))
        return True


def main():
    os.makedirs(DATOS, exist_ok=True)
    solo = sys.argv[1] if len(sys.argv) > 1 else None
    ok = True
    for nombre, (minx, miny, maxx, maxy, res) in PIEZAS.items():
        if solo and solo != nombre:
            continue
        url, w, h = url_pieza(minx, miny, maxx, maxy, res)
        print("%s: %dx%d px" % (nombre, w, h))
        if not descargar(nombre, url, os.path.join(DATOS, nombre + ".tif")):
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
