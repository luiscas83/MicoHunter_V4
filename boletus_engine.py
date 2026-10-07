"""
Motor predicción Boletus edulis - v1
Capas: clima vivo + terreno + suelo + flora x perfil especie = 0-100
Fuentes por punto:
 - Open-Meteo: lluvia diaria, T aire 2m/min/max, HR y suelo a 18 cm (micorriza).
   30 días atrás + hoy, ventana observada, no previsión.
 - SoilGrids 2.0 (ISRIC): textura, pH y C orgánico, horizonte 5-15 cm,
   rejilla 250 m (interpolado, no medición de campo).
 - MFE (MITECO): formaciones capa por capa + ff_uso (LULUCF). Fuente hábitat principal.
 - Overpass: SOLO conteo edificios 150 m si MFE y ff_uso no sirven (>=10 = urbano).
 - Nominatim: topónimo; si falla, coordenadas.
Basado en: Martínez-Peña 2012, Parladé 2017, Santolamazza-Carbone 2023,
biorxiv Predicting porcini 2025 (óptimo 13.2C).
Sin dependencias. Uso: import boletus_engine; boletus_engine.score(punto)
"""

FLORA_EDULIS = {
    # Categorías de hábitat simplificadas -> idoneidad 0-1 para edulis.
    # Bosque mixto = máx. de sus componentes (lo calcula el llamante).
    "Pinar": 1.0,       # Pinus sylvestris/nigra/uncinata/pinaster (otros pinos 0.9)
    "Hayedo": 0.95,     # Fagus sylvatica
    "Robledal": 0.9,    # Quercus robur/petraea/pyrenaica/pubescens/faginea/rubra
    "Castañeral": 0.9,  # Castanea sativa (castañeral)
    "Pradera": 0.0,     # prados herbáceos, cultivos, agua (ff_uso)
    "Pasto": 0.0,       # dehesa, pastizal arbustivo, pastos de puerto (ff_uso)
    "Bosque mixto": 1.0,
    "Matorral": 0.1,    # matorral, sabinar, abetal/encinar puros y resto
}

# Níscalo (Lactarius deliciosus): mismos pesos, otros umbrales (valores del usuario)
# Oronja (Amanita caesarea): umbrales V2 (sin calibrar) + cestaysetas; lag 30 ESTIMADO
CAESAREA_LAG = 30  # ciclo 18-21 hasta 40-50 d tras lluvias (pico ~30, estimado)
CAESAREA = {
    "t_aire_opt": (16, 24), "t_aire_util": (10, 28),
    "p14": (30, 80),         # estimado
    "p30_reserva": (25, 100),
    "ph": (4.0, 6.0),        # acidófila (estimado)
    "altitud": (200, 1200),  # hasta 1500 en los mejores casos
    "temporada": {7: 0.5, 8: 0.9, 9: 1.0, 10: 0.85},  # Jul-Oct, pico Sep
    "veto_tmin": 2,          # termófila, no aguanta heladas
    "flora": "robledal, castañar y quercíneas (encina, carrasca, alcornoque)",
}
NISCALO_LAG = 21  # primeros 7-15 d, pico ~21 d (boleto: 15)
NISCALO = {
    "t_aire_opt": (12, 18), "t_aire_util": (5, 20),  # banda óptima y rango útil ºC
    "p14": (25, 90),       # óptimo 25-80 mm, umbral 25 (boleto: 30-100)
    "p30_reserva": (25, 100),
    "ph": (4.5, 8.0),     # rango amplio
    "altitud": (100, 1600),
    "temporada": {9: 0.85, 10: 0.9, 11: 1.0, 12: 0.6},  # Sep-Dic, pico Nov
    "veto_tmin": -3,       # aguanta heladas flojas (boleto: 0)
    "flora": "solo pinar, cualquier edad; mixto con pino vale",
}


def _clamp01(x):
    return max(0.0, min(1.0, float(x)))


def f_p14d(p):
    """Lluvia acumulada 14 días. Óptimo 60-100mm."""
    if p < 30:
        return 0.0
    if p < 60:
        return 0.3 + 0.4 * (p - 30) / 30  # 0.3 -> 0.7
    if p <= 100:
        return 1.0
    if p <= 200:
        return 1.0 - 0.4 * (p - 100) / 100  # 1.0 -> 0.6
    return 0.3


def f_reserva(p30):
    """Reserva suelo proxy P30d (ventana observada 30d+hoy)."""
    if p30 < 30:
        return 0.2
    if p30 < 70:
        return 0.2 + 0.6 * (p30 - 30) / 40  # 0.2 -> 0.8
    if p30 < 110:
        return 0.8 + 0.2 * (p30 - 70) / 40  # 0.8 -> 1.0
    return 1.0


def f_t_aire(t):
    """Media 7d. Óptimo 13.2C (biorxiv 2025). Límites duros 6 y 28."""
    if t < 6 or t > 28:
        return 0.0
    # gaussiana centrada 13.2, sigma ~5
    import math
    return math.exp(-((t - 13.2) ** 2) / (2 * 5.0 ** 2))


def f_t_suelo(ts):
    """Suelo 10cm. Ventana 10-18, trigger <15, veto >21."""
    if ts < 7 or ts > 21:
        return 0.0
    if 12 <= ts <= 16:
        return 1.0
    if 10 <= ts < 12:
        return 0.6 + 0.4 * (ts - 10) / 2
    if 16 < ts <= 18:
        return 1.0 - 0.3 * (ts - 16) / 2
    # 7-10 o 18-21
    if ts < 10:
        return 0.3 + 0.3 * (ts - 7) / 3
    return 0.5


def f_hr(hr):
    if hr >= 80:
        return 1.0
    if hr >= 75:
        return 0.8
    if hr >= 65:
        return 0.4 + 0.4 * (hr - 65) / 10
    return 0.0


def f_altitud(h):
    """Franja 600-1800m."""
    if 600 <= h <= 1800:
        return 1.0
    if 500 <= h < 600:
        return 0.5 + 0.5 * (h - 500) / 100
    if 1800 < h <= 2000:
        return 1.0 - 0.5 * (h - 1800) / 200
    if 400 <= h < 500:
        return 0.3
    return 0.0


def f_ph(ph):
    """Ácido a neutro."""
    if 4.5 <= ph <= 6.5:
        return 1.0
    if 6.5 < ph <= 7.2:
        return 0.5
    if 4.0 <= ph < 4.5:
        return 0.6
    return 0.0


def f_temporada(mes):
    if mes in (9, 10, 11):
        return 1.0 if mes == 10 else 0.85
    if mes in (8, 12):
        return 0.4
    return 0.1  # primavera anecdótica, no campaña


def score(p14d, p30d, t_aire_7d, t_suelo, hr_7d, altitud, ph, flora,
          tmin_7d=10, tmax_7d=18, viento_fuerte=False, mes=10):
    """
    Devuelve dict con score 0-100 + desglose + fecha pico estimada.
    veto helada/calor/viento: pone clima a 0 aunque llueva.
    """
    veto = (tmin_7d <= 0) or (tmax_7d >= 28) or bool(viento_fuerte)

    s_p = f_p14d(p14d)
    s_r = f_reserva(p30d)
    s_ta = f_t_aire(t_aire_7d)
    s_ts = f_t_suelo(t_suelo)
    s_hr = f_hr(hr_7d)

    clima = 0.40 * s_p + 0.20 * s_r + 0.20 * s_ta + 0.10 * s_ts + 0.10 * s_hr
    if veto:
        clima = 0.0

    terreno = f_altitud(altitud)
    suelo = f_ph(ph)
    flora_s = FLORA_EDULIS.get(flora, 0.0)
    temp = f_temporada(mes)

    prob = clima * terreno * suelo * flora_s * temp
    out = round(prob * 100, 1)
    return {
        "score": out,
        "clima": round(clima, 3),
        "detalle_clima": {"P14d": round(s_p, 3), "reserva": round(s_r, 3),
                          "T_aire": round(s_ta, 3), "T_suelo": round(s_ts, 3),
                          "HR": round(s_hr, 3), "veto": veto},
        "terreno_altitud": round(terreno, 3),
        "suelo_ph": round(suelo, 3),
        "flora": round(flora_s, 3),
        "temporada": round(temp, 3),
        "ventana_pico_dias": 15 if out >= 40 else None,
        "nivel": "nulo" if out < 25 else ("regular" if out < 50 else ("bueno" if out < 75 else "excelente")),
    }


if __name__ == "__main__":
    casos = [
        ("Soria pinar óptimo Oct", dict(p14d=80, p30d=150, t_aire_7d=13.2, t_suelo=14,
         hr_7d=82, altitud=1100, ph=5.0, flora="Pinar", tmin_7d=6, tmax_7d=19, mes=10)),
        ("Seco agosto", dict(p14d=10, p30d=25, t_aire_7d=20, t_suelo=20,
         hr_7d=55, altitud=1100, ph=5.0, flora="Pinar", mes=9)),
        ("Parque ciudad misma lluvia", dict(p14d=80, p30d=150, t_aire_7d=13.2, t_suelo=14,
         hr_7d=82, altitud=650, ph=7.5, flora="Pradera", mes=10)),
        ("Helada", dict(p14d=80, p30d=150, t_aire_7d=8, t_suelo=8,
         hr_7d=85, altitud=1200, ph=5.2, flora="Hayedo", tmin_7d=-2, tmax_7d=10, mes=11)),
    ]
    for nombre, kw in casos:
        r = score(**kw)
        print(f"{nombre}: {r['score']} ({r['nivel']}) pico={r['ventana_pico_dias']} | {r}")
