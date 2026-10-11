# Test 50 puntos (local vs online) — 2026-10-11

Herramienta: `test_50.py` (50 puntos: 45 cotos + Madrid, Soria, Teide,
Valnera, dehesa). Recomprobación de raros: `test_recheck.py`.
Detalle punto a punto: `datos_local/test_50.json` (se genera al correr).

## Resultado honesto

- **pH 50/50**: difs. de remuestreo ≤0,3 (tolerancia del motor ±0,5 → neutras).
  Ojo: el REST de SoilGrids falló a ratos (devolvía nulo); reintentado, todo
  coincide. Sin pH el motor es neutro (1), con pH normal también suele ser 1.
- **Altitud 48/50** estrictos (±30 m/5 %); **50/50 neutros** (misma banda del
  motor en los 50). Terrarium z9 subestima picos (Teide 3617 vs 3718, −3 %).
- **Hábitat ~35/50** en categoría exacta:
  - 6 de linde (mixto vs simple noble o viceversa): el GFI online contesta
    distinto entre peticiones (FEATURE_COUNT=3, primera tesela del ráster).
    Referencia inestable; el local determinista vale igual o más.
  - 9 roces de caja (el punto cae fuera, bosque a <122 m): el WMS online no
    los ve (geometría de visualización simplificada), el vectorial local sí.
    Son cotos de monte → el local es más verosímil. 5 cambian score.
  - 3 huecos iniciales por capa `melojares` ausente → **corregido**
    (37 capas ahora).

## Decisiones de paridad (motor intacto)

- Ventana ±122 m como el GetFeatureInfo (malla 3×3 + arista-caja).
- Caja expandida +25 m (tolerancia del Douglas-Peucker: un solape de 9 m
  lo borra el simplificado).
- `melojares` añadida (Q. pyrenaica pura → Robledal; sin riesgo de mixto
  para los 4 motores).
- `ff_uso` simplificado a ~100 m: grietas posibles en lindes; la ventana lo
  compensa casi siempre.
