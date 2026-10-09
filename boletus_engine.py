"""
Motor predicción setas (boleto + níscalo + oronja) - referencia Python.
Espejo de app.js: mismos pesos y umbrales. No tocar pesos sin avisar.
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
    # Binario v1.40: hábitat de la especie -> 1, resto -> 0 (sin ranking).
    # Bosque mixto = 1 si trae componente válido (lo calcula el llamante).
    "Pinar": 1.0,
    "Hayedo": 1.0,
    "Robledal": 1.0,
    "Castañeral": 1.0,
    "Quercíneas": 0.0,   # encina, alcornoque y quejigos meridionales: solo oronja
    "Pradera": 0.0,
    "Pasto": 0.0,
    "Bosque mixto": 1.0,
    "Matorral": 0.0,
}

# Níscalo (Lactarius deliciosus): mismos pesos, otros umbrales (valores del usuario)
# Oronja (Amanita caesarea): calibrada v1.39 con bibliografía, sin validación de campo
CAESAREA_LAG = 21  # primer flush 15-22 d tras tormentas (hasta 40-50 en terreno duro/seco, no modelado)
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
# Chantarela (Cantharellus cibarius): valores iniciales v1.44, sin calibrar de campo
CHANTARELLA_LAG = 10  # flush 7-14 d tras tormentas, posible hasta 15-21, se pierde >21 d
CHANTARELLA = {
    "t_aire_opt": (15, 20), "t_aire_util": (8, 26),
    "p14": (30, 100),        # óptimo 60-100 mm, exceso progresivo sin corte brusco
    "p30_reserva": (40, 120),
    "ph": (4.0, 5.5),        # acidófila estricta
    "altitud": (50, 1500),   # preferencia 100-1400
    "temporada": {6: 0.6, 7: 0.8, 8: 0.9, 9: 1.0, 10: 0.9, 11: 0.4},  # Jun-Nov, pico Sep
    "veto_tmin": 0,          # helada veta fructificación; sin veto de viento ni de máxima aislada
    "flora": "pinar, hayedo, robledal, castañar y mixto + hospedadores (quercus, fagus, castanea, pinus, picea, betula, corylus)",
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
    """Lluvia acumulada 14 días. Óptimo desde 60mm, sin penalizar el exceso (v1.93)."""
    if p < 30:
        return 0.0
    if p < 60:
        return 0.3 + 0.4 * (p - 30) / 30  # 0.3 -> 0.7
    return 1.0


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
    """Media 7d. Óptimo 13.2C (biorxiv 2025). Límites duros 6 y 28. Margen ±3C (v1.92)."""
    if t < 6 or t > 28:
        return 0.0
    e = t - 3 if t > 16.2 else (t + 3 if t < 10.2 else 13.2)
    import math
    return math.exp(-((e - 13.2) ** 2) / (2 * 5.0 ** 2))


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
    """Ácido a neutro. Tolerancia ±0,5 (v1.97)."""
    e = ph + 0.5 if ph < 4.5 else (ph - 0.5 if ph > 6.5 else ph)
    if 4.5 <= e <= 6.5:
        return 1.0
    if 6.5 < e <= 7.2:
        return 0.5
    if 4.0 <= e < 4.5:
        return 0.6
    return 0.0


def f_temporada(mes):
    if mes in (9, 10, 11):
        return 1.0 if mes == 10 else 0.85
    if mes in (8, 12):
        return 0.4
    return 0.1  # primavera anecdótica, no campaña


# --- Níscalo (Lactarius deliciosus): espejo de fTA2/fP14_2/fPH2/fAlt2/fMes2 en app.js ---
def f_t_aire_niscalo(t):
    if t < 5 or t > 24:
        return 0.0
    e = t + 3 if t < 12 else (t - 3 if t > 18 else t)  # margen ±3C (v1.92)
    if 12 <= e <= 18:
        return 1.0
    if 8 <= e < 12:
        return 0.5 + 0.5 * (e - 8) / 4
    if 5 <= e < 8:
        return 0.2 + 0.3 * (e - 5) / 3
    if 18 < e <= 20:
        return 1.0 - 0.5 * (e - 18) / 2
    return 0.5 - 0.4 * (e - 20) / 4  # 20-24


def f_p14_niscalo(p):
    if p < 25:
        return 0.0
    if p < 50:
        return 0.3 + 0.4 * (p - 25) / 25
    return 1.0  # sin penalizar el exceso (v1.93)


def f_ph_niscalo(ph):
    e = ph + 0.5 if ph < 4.5 else (ph - 0.5 if ph > 8 else ph)  # tolerancia ±0,5 (v1.97)
    if e < 4:
        return 0.2
    if e < 4.5:
        return 0.2 + 0.8 * (e - 4) / 0.5
    if e <= 8:
        return 1.0
    if e <= 8.5:
        return 1.0 - 0.6 * (e - 8) / 0.5
    return 0.0


def f_altitud_niscalo(h):
    if 100 <= h <= 1600:
        return 1.0
    if 0 <= h < 100:
        return 0.6
    if 1600 < h <= 1900:
        return 1.0 - (h - 1600) / 300
    return 0.0


def f_temporada_niscalo(mes):
    return {11: 1.0, 10: 0.9, 9: 0.85, 12: 0.6, 8: 0.3}.get(mes, 0.1)


def flora_niscalo(cat, componentes=None):
    """Solo pinar; mixto con pino vale. Espejo de floraNiscalo en app.js."""
    if cat == "Pinar":
        return 1.0
    if cat == "Bosque mixto" and componentes and "Pinar" in componentes:
        return 1.0
    return 0.0


# --- Oronja (Amanita caesarea): espejo de fTA3/fP14_3/fPH3/fAlt3/fMes3 en app.js ---
def f_t_aire_oronja(t):
    if t < 10 or t > 28:
        return 0.0
    e = t + 3 if t < 16 else (t - 3 if t > 24 else t)  # margen ±3C (v1.92)
    if 16 <= e <= 24:
        return 1.0
    if 12 <= e < 16:
        return 0.4 + 0.6 * (e - 12) / 4
    if 24 < e <= 28:
        return 1.0 - 0.7 * (e - 24) / 4
    return 0.2  # 10-12


def f_p14_oronja(p):
    if p < 30:
        return 0.0
    if p < 50:
        return 0.3 + 0.4 * (p - 30) / 20
    return 1.0  # sin penalizar el exceso (v1.93)


def f_ph_oronja(ph):
    e = ph + 0.5 if ph < 4 else (ph - 0.5 if ph > 6 else ph)  # tolerancia ±0,5 (v1.97)
    if 4 <= e <= 6:
        return 1.0
    if 6 < e <= 7:
        return 0.4  # rara en neutros (MicoAragón)
    if 3.5 <= e < 4:
        return 0.6
    return 0.0


def f_altitud_oronja(h):
    if 200 <= h <= 1200:
        return 1.0
    if 1200 < h <= 1500:
        return 1.0 - 0.5 * (h - 1200) / 300
    if 100 <= h < 200:
        return 0.6
    return 0.0


def f_temporada_oronja(mes):
    return {9: 1.0, 8: 0.9, 10: 0.85, 7: 0.5, 6: 0.2}.get(mes, 0.1)


def flora_oronja(cat, especies=None):
    """Binario v1.40: robledal/castañar/mixto/quercíneas 1; resto 0. Espejo de floraOronja."""
    import re
    esp = " ".join(especies or []).lower()
    host = bool(re.search(r"quercus|castanea", esp))
    if cat in ("Robledal", "Castañeral", "Quercíneas"):
        return 1.0
    if cat == "Bosque mixto" or host:
        return 1.0
    return 0.0


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


def score_niscalo(p14d, p30d, t_aire_7d, t_suelo, hr_7d, altitud, ph, flora,
                  componentes=None, tmin_7d=10, tmax_7d=18, viento_fuerte=False, mes=11):
    """Espejo de scoreNiscalo en app.js. Veto helada <= -3, calor >= 28, viento."""
    veto = (tmin_7d <= -3) or (tmax_7d >= 28) or bool(viento_fuerte)
    s_p = f_p14_niscalo(p14d)
    s_r = f_reserva(p30d)
    s_ta = f_t_aire_niscalo(t_aire_7d)
    s_ts = f_t_suelo(t_suelo)
    s_hr = f_hr(hr_7d)
    clima = 0.40 * s_p + 0.20 * s_r + 0.20 * s_ta + 0.10 * s_ts + 0.10 * s_hr
    if veto:
        clima = 0.0
    terreno = f_altitud_niscalo(altitud)
    suelo = f_ph_niscalo(ph)
    flora_s = flora_niscalo(flora, componentes) if isinstance(flora, str) else 0.0
    temp = f_temporada_niscalo(mes)
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
        "ventana_pico_dias": NISCALO_LAG if out >= 40 else None,
        "nivel": "nulo" if out < 25 else ("regular" if out < 50 else ("bueno" if out < 75 else "excelente")),
    }


def score_oronja(p14d, p30d, t_aire_7d, t_suelo, hr_7d, altitud, ph, flora,
                 especies=None, tmin_7d=10, tmax_7d=24, viento_fuerte=False, mes=9):
    """Espejo de scoreOronja en app.js. Veto helada <= +2, calor >= 28, viento."""
    veto = (tmin_7d <= 2) or (tmax_7d >= 28) or bool(viento_fuerte)
    s_p = f_p14_oronja(p14d)
    s_r = f_reserva(p30d)
    s_ta = f_t_aire_oronja(t_aire_7d)
    s_ts = f_t_suelo(t_suelo)
    s_hr = f_hr(hr_7d)
    clima = 0.40 * s_p + 0.20 * s_r + 0.20 * s_ta + 0.10 * s_ts + 0.10 * s_hr
    if veto:
        clima = 0.0
    terreno = f_altitud_oronja(altitud)
    suelo = f_ph_oronja(ph)
    flora_s = flora_oronja(flora, especies) if isinstance(flora, str) else 0.0
    temp = f_temporada_oronja(mes)
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
        "ventana_pico_dias": CAESAREA_LAG if out >= 40 else None,
        "nivel": "nulo" if out < 25 else ("regular" if out < 50 else ("bueno" if out < 75 else "excelente")),
    }


# --- Chantarela (Cantharellus cibarius): espejo de fTA4/fP14_4/fPH4/fAlt4/fMes4 en app.js ---
def f_t_aire_chantarella(t):
    if t < 8 or t > 26:
        return 0.0
    e = t + 3 if t < 15 else (t - 3 if t > 20 else t)  # margen ±3C (v1.92)
    if 15 <= e <= 20:
        return 1.0
    if 12 <= e < 15:
        return 0.5 + 0.5 * (e - 12) / 3
    if 20 < e <= 23:
        return 1.0 - 0.5 * (e - 20) / 3
    if 8 <= e < 12:
        return 0.2 + 0.3 * (e - 8) / 4
    return 0.5 - 0.3 * (e - 23) / 3  # 23-26


def f_p14_chantarella(p):
    if p < 30:
        return 0.0
    if p < 60:
        return (p - 30) / 30
    return 1.0  # sin penalizar el exceso (v1.93)


def f_ph_chantarella(ph):
    e = ph + 0.5 if ph < 4 else (ph - 0.5 if ph > 5.5 else ph)  # tolerancia ±0,5 (v1.97)
    if 4 <= e <= 5.5:
        return 1.0
    if 5.5 < e <= 6:
        return 0.5
    if 3.5 <= e < 4:
        return 0.6
    return 0.0


def f_altitud_chantarella(h):
    if 100 <= h <= 1400:
        return 1.0
    if 50 <= h < 100:
        return (h - 50) / 50
    if 1400 < h <= 1500:
        return 1.0 - (h - 1400) / 100
    return 0.0


def f_temporada_chantarella(mes):
    return {9: 1.0, 8: 0.9, 10: 0.9, 7: 0.8, 6: 0.6, 11: 0.4}.get(mes, 0.1)


def flora_chantarella(cat, especies=None):
    """Pinar/hayedo/robledal/castañar/mixto 1 + hospedadores 1; resto 0. Espejo de floraChantarella."""
    if cat in ("Pinar", "Hayedo", "Robledal", "Castañeral", "Bosque mixto"):
        return 1.0
    import re
    esp = " ".join(especies or []).lower()
    if re.search(r"quercus|fagus|castanea|pinus|picea|betula|corylus", esp):
        return 1.0
    return 0.0


def score_chantarella(p14d, p30d, t_aire_7d, t_suelo, hr_7d, altitud, ph, flora,
                      especies=None, tmin_7d=10, tmax_7d=24, mes=9):
    """Espejo de scoreChantarella en app.js. Solo veto helada <= 0; sin veto de viento ni de máxima."""
    veto = tmin_7d <= 0
    s_p = f_p14_chantarella(p14d)
    s_r = f_reserva(p30d)
    s_ta = f_t_aire_chantarella(t_aire_7d)
    s_ts = f_t_suelo(t_suelo)
    s_hr = f_hr(hr_7d)
    clima = 0.40 * s_p + 0.20 * s_r + 0.20 * s_ta + 0.10 * s_ts + 0.10 * s_hr
    if veto:
        clima = 0.0
    terreno = f_altitud_chantarella(altitud)
    suelo = f_ph_chantarella(ph)
    flora_s = flora_chantarella(flora, especies) if isinstance(flora, str) else 0.0
    temp = f_temporada_chantarella(mes)
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
        "ventana_pico_dias": CHANTARELLA_LAG if out >= 40 else None,
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
