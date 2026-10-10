"""MDT nacional a partir de Terrarium (AWS elevation-tiles-prod, publico, CC-BY).

Terrarium codifica elevacion Copernicus en PNG: e = R*256+G+B/256-32768.
Zoom 9 (~75 m) remuestreado a rejilla EPSG:4326 de 0.0025 grados (~278 m,
la misma que ph_*_espana.tif). Oceano (e < -1000) -> nodata -32768.
Salida: datos_local/mdt_peninsula.tif y datos_local/mdt_canarias.tif.
Verificado: Soria 41.934,-2.792 -> 1450 m (Open-Meteo/Copernicus: 1421).
Sin GDAL (solo requests/pillow/numpy/tifffile).
"""
import io
import math
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import requests
from PIL import Image
import numpy as np
import tifffile

BASE = os.path.dirname(os.path.abspath(__file__))
DATOS = os.path.join(BASE, "datos_local")
Z = 9
RES = 0.0025
NODATA = -32768
TILE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/%d/%d/%d.png" % (Z, 0, 0)
TILE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

PIEZAS = {
    "mdt_peninsula": (-9.6, 35.4, 4.6, 44.0),
    "mdt_canarias": (-18.3, 27.6, -13.5, 29.6),
}

SESS = requests.Session()
SESS.headers["User-Agent"] = "MicoHunter-local/1.0"


def merc_xy(lat, lon):
    n = 2 ** Z
    x = (lon + 180.0) / 360.0 * n
    r = math.radians(lat)
    y = (1.0 - math.log(math.tan(r) + 1.0 / math.cos(r)) / math.pi) / 2.0 * n
    return x, y


def merc_lat(y):
    n = 2 ** Z
    t = math.pi * (1.0 - 2.0 * y / n)
    return math.degrees(math.atan(math.sinh(t)))


def descarga_tile(x, y):
    url = TILE.format(z=Z, x=x, y=y)
    for _ in range(3):
        try:
            r = SESS.get(url, timeout=60)
            if r.status_code == 200:
                im = np.asarray(Image.open(io.BytesIO(r.content))).astype(np.float32)
                e = im[:, :, 0] * 256.0 + im[:, :, 1] + im[:, :, 2] / 256.0 - 32768.0
                e[e < -1000] = np.nan
                return x, y, e
            return x, y, None
        except Exception:
            continue
    return x, y, None


def construir(nombre, minx, miny, maxx, maxy):
    w = int(round((maxx - minx) / RES))
    h = int(round((maxy - miny) / RES))
    print("%s: rejilla %dx%d" % (nombre, w, h))
    # rango de tiles que cubre el bbox (+1 de margen)
    x0, y1 = merc_xy(miny, minx)
    x1, y0 = merc_xy(maxy, maxx)
    xs = range(int(math.floor(x0)), int(math.floor(x1)) + 1)
    ys = range(int(math.floor(y0)), int(math.floor(y1)) + 1)
    print("  %d tiles z%d" % (len(xs) * len(ys), Z))
    tiles = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        for x, y, e in ex.map(lambda t: descarga_tile(*t),
                              [(x, y) for y in ys for x in xs]):
            if e is not None:
                tiles[(x, y)] = e
    print("  descargados %d/%d" % (len(tiles), len(xs) * len(ys)))
    n = 2 ** Z
    grid = np.full((h, w), np.nan, np.float32)
    # por filas de la rejilla destino: lat -> y mercator -> tile+fila
    lats = maxy - (np.arange(h) + 0.5) * RES
    for i in range(h):
        xt, yt = merc_xy(lats[i], 0)  # yt interesa; x se calcula por columna
        ty = int(math.floor(yt))
        py = int((yt - ty) * 256)
        if py >= 256:
            py = 255
        # columnas: lon -> x mercator
        lons = minx + (np.arange(w) + 0.5) * RES
        txs = np.floor((lons + 180.0) / 360.0 * n).astype(int)
        pxs = (((lons + 180.0) / 360.0 * n - txs) * 256).astype(int)
        pxs[pxs >= 256] = 255
        for tx in np.unique(txs):
            t = tiles.get((tx, ty))
            if t is None:
                continue
            m = txs == tx
            grid[i, m] = t[py, pxs[m]]
    ok = np.isfinite(grid)
    print("  celdas con dato: %.1f%%" % (100.0 * ok.sum() / ok.size))
    out = np.where(ok, np.round(grid), NODATA).astype(np.int16)
    dest = os.path.join(DATOS, nombre + ".tif")
    tifffile.imwrite(dest, out, extratags=[
        (33550, "d", 3, (RES, RES, 0.0)),
        (33922, "d", 6, (0.0, 0.0, 0.0, minx, maxy, 0.0)),
        (42113, "s", 0, "-32768"),
    ], compression="deflate")
    print("  %s (%.1f MB)" % (dest, os.path.getsize(dest) / 1e6))


def main():
    os.makedirs(DATOS, exist_ok=True)
    solo = sys.argv[1] if len(sys.argv) > 1 else None
    ok = True
    for nombre, bb in PIEZAS.items():
        if solo and solo != nombre:
            continue
        try:
            construir(nombre, *bb)
        except Exception as e:
            print("ERROR %s: %s" % (nombre, e))
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
