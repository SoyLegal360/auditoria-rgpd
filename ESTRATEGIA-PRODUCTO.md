# 📐 Estrategia de producto — Herramienta de Auditoría RGPD (SoyLegal360)

> Documento de estrategia acordado (junio 2026). Decisiones de modelo, embudo y monetización.
> Complementa a `HANDOFF.md` (estado técnico). Releer antes de planificar el build.

## 1. Qué es (y qué no)
Herramienta web **pública** que audita el cumplimiento RGPD de la web de un visitante, da un
resultado **instantáneo** y capta/cualifica el lead. Es de **SoyLegal360** (consultora RGPD,
abogadas colegiadas, S.L. B-88653225).

El score automático es un **commodity** (hay escáneres RGPD gratis a montones). El foso NO es la
nota; son tres cosas:
1. **Instantáneo + derecho español** (AEPD/LSSI/LOPDGDD) con riesgo económico real.
2. **Certificación humana** en lo que se cobra (lo que ningún automático ofrece).
3. **Monitorización continua** que justifica la suscripción.

## 2. Modelo: HÍBRIDO
Lead-gen como columna vertebral **+** capa de pago productizada encima. La herramienta alimenta la
consultoría Y monetiza al segmento self-serve.

**Posicionamiento dentro del catálogo (es una escalera, no canibalización):**
| Nivel | Producto | Rol |
|---|---|---|
| Diagnóstico exprés (esta herramienta) | Escaneo automático instantáneo | Gancho / TOF |
| Auditoría web gratuita (ya existe) | Manual, abogada, 48h | Prueba de rigor / lead caliente |
| **Adaptación Web RGPD — desde 390€** | 6 documentos a medida + certificados | **Conversión principal** |
| Protección Legal Continua — 49€/mes | Vigilancia continua | Retención / LTV |

## 3. El embudo acordado
1. **Solo el dominio.** Cero fricción para el resultado.
2. **Resultado en pantalla al instante**: nota + semáforo + 3-5 deficiencias + **riesgo económico
   anclado a sanción real** (600€/5.000€/25.000€…), sin alarmismo.
3. **Email para desbloquear el informe completo + plan** (la captura):
   - Pide **solo email** (+ como mucho 1 campo de cualificación: sector / "¿formularios o tienda?").
   - **PDF de marca** (dominio, hallazgos, riesgos, prioridades) por email = activo + carrot.
   - **A la vez**: lead **cualificado al CRM** (auditoría + señales inferidas del escaneo).
   - Resto de datos (para los textos) → solo **tras pagar**, en el intake = minimización (on-brand).
4. **CTA contextual según el escaneo:**
   | Detección | Destino |
   |---|---|
   | Falta **1** documento | Documento suelto **~120€** |
   | Faltan varios / web compleja (tienda, login, muchos formularios) | **Adaptación Web RGPD — desde 390€** (entrada plana; ajuste por complejidad en la llamada de ventas) |
   | Quiere mantenerlo / falla cookies | **PLC 49€/mes** |
   | Caso complejo de negocio (empleados, ficheros, videovigilancia) | Consultoría / adaptación empresa |
5. **Re-auditoría periódica automática** para suscriptores → "tu web ha cambiado / nueva obligación
   (p. ej. IA Act)" → retención y recompra.

**UX del escaneo profundo**: el profundo tarda ~15-40s → **score superficial instantáneo en
pantalla + informe profundo asíncrono** (se procesa en background y llega por email/enlace).

## 4. Monetización: NO hay SKU de textos nuevo
**Tu pack "Adaptación Web RGPD — desde 390€" YA ES el pack de textos** (Aviso Legal, Privacidad,
Cookies + Cookiebot, formularios con consentimiento, +2 = 6 documentos a medida). Crear un pack de
textos más barato lo canibalizaría. Por tanto:

- **"Claude redacta + abogada certifica" = motor de PRODUCCIÓN del pack de 390€**, no un producto
  nuevo. Claude redacta en plantilla → la abogada **certifica en ~15-20 min** (no 2h). El escaneo
  profundo **auto-rellena el intake** (tabla de cookies real, encargados, transferencias).
  → **Mismo precio, mucho más margen y velocidad.**
- **Documento suelto ~120€**: SOLO cuando el escaneo detecta que falta 1 documento.
- **Precio del pack**: entrada plana **"desde 390€"** (sin precio dinámico en la herramienta).
- **Pasarela**: Stripe para lo productizado. El "instantáneo" es el diagnóstico, **no** el
  entregable legal (este se entrega tras certificación, 48-72h).

**Las tres palancas reales** (ninguna depende de un SKU nuevo):
1. **Volumen** de leads cualificados al pack de 390€.
2. **Margen** (Claude produce, abogada certifica en minutos).
3. **Canal de agencias / freelancers web** (B2B2B) — posible mayor palanca de crecimiento.

## 5. Requisito técnico: "en profundidad" exige el motor profundo
El motor ACTUAL es superficial (solo home; comprueba que la *palabra* "política de privacidad"
existe; los rastreadores por JS se le escapan). Para que "textos en profundidad y cookies" sea
verdad hace falta:
- **Navegador headless** (Playwright / @sparticuz/chromium) → cookies/rastreadores reales
  **antes del consentimiento**.
- **Claude leyendo las páginas legales reales** contra una **checklist RGPD** (responsable, base
  jurídica, derechos, conservación, transferencias…) → salida estructurada. *Prompt caching* de la
  checklist.
- **Persistencia real** (Vercel Postgres/KV) — no `/tmp`.

Claude aporta valor **analizando calidad y redactando**, NO calculando la nota.

## 6. Cumplimiento propio (no negociable)
Una herramienta RGPD no puede tratar mal los leads: base jurídica + info de privacidad propia,
persistencia segura (no `/tmp`), disclaimer "diagnóstico orientativo automático, no sustituye
asesoramiento". Hacerlo impecable es además argumento de venta.

## 7. Hoja de ruta por fases
- **Fase A** — Motor profundo + lead-gen: persistencia (Postgres/KV) + headless (cookies reales) +
  análisis Claude de textos + PDF de marca + lead al CRM. (UX: instantáneo + profundo asíncrono.)
- **Fase B** — Capa de pago: intake (auto-rellenado por el escaneo) → Stripe → Claude redacta →
  **cola de revisión/certificación de la abogada** → entrega. Documento suelto ~120€ y pack 390€.
- **Fase C** — Recurrente: monitorización + re-auditoría + sello renovable → LTV (PLC).

## 8. Hilos pendientes de decidir (no profundizados aún)
- **Canal de agencias (B2B2B)**: marca blanca/referidos, comisiones, flujo. (Potencial mayor palanca.)
- **Capacidad de certificación de la abogada**: throughput/semana, plantillas, plazos; el precio
  modula la demanda. Es el **techo real** del modelo de pago.
- **Cookies → recurrente**: CMP (Cookiebot), bundle con PLC, mecánica del sello.

## 9. Anclajes (catálogo y sanciones)
PLC 49€/mes+IVA · consulta 90€ · Adaptación Web RGPD desde 390€ · Pack Presencia Legal/7 días 590€
(web presencia autónomos, no compite) · B2C 99/199/290/490€ · sanciones de referencia
600€/5.000€/25.000€/500.000€.
