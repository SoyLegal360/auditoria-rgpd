# Verificación de citas legales — Herramienta de auditoría RGPD

> Revisión jurídica de TODAS las citas normativas que la herramienta emite en informes a clientes.
> Metodología: 3 niveles (VERIFICADO / NO VERIFICABLE / ERRÓNEO) contra fuente oficial (BOE, EUR-Lex/DOUE, AEPD).
> Fecha: 2026-06-26.

## Fuentes oficiales usadas (canónicas)

| Norma | Fuente | Verificación |
|---|---|---|
| RGPD (Reglamento UE 2016/679) | [DOUE L 119 de 4.5.2016, PDF oficial](https://www.boe.es/doue/2016/119/L00001-00088.pdf) · [EUR-Lex CELEX:32016R0679](https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R0679) | Texto íntegro leído (88 págs.), búsqueda normalizada |
| LSSI-CE (Ley 34/2002) | [BOE-A-2002-13758 consolidado](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) · [PDF consolidado](https://www.boe.es/buscar/pdf/2002/BOE-A-2002-13758-consolidado.pdf) | Texto íntegro leído, arts. 10/22/27/28 transcritos |
| LOPDGDD (LO 3/2018) | [BOE-A-2018-16673 consolidado](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673) · [PDF consolidado](https://www.boe.es/buscar/pdf/2018/BOE-A-2018-16673-consolidado.pdf) | Texto íntegro leído, arts. 7/8/34 transcritos |
| Guía AEPD cookies | [Nota de prensa actualización guía cookies](https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa/aepd-actualiza-guia-cookies-para-adaptarla-a-nuevas-directrices-cepd) · [Guía PDF (vigente: mayo 2024)](https://www.aepd.es/guias/guia-cookies.pdf) | Verificado criterio aceptar/rechazar igual visibilidad |
| RFC correo | [RFC 7208 (SPF)](https://datatracker.ietf.org/doc/html/rfc7208) · [RFC 6376 (DKIM)](https://datatracker.ietf.org/doc/html/rfc6376) · [RFC 7489 (DMARC)](https://datatracker.ietf.org/doc/html/rfc7489) | Verificados (especificaciones técnicas, no normativa jurídica) |

---

## Tabla de citas

| Cita | Dónde aparece | Estado | Justificación | Enlace oficial |
|---|---|---|---|---|
| **Art. 32 RGPD** (HTTPS/SSL/cabeceras/mixed-content) | `finding-meta.ts` (https, ssl-exp, HSTS, x-content-type, CSP, referrer-policy, mixed-content); `audit.ts` L157 | ✅ VERIFICADO | Art. 32 = "Seguridad del tratamiento"; menciona literalmente "la seudonimización y el **cifrado** de datos personales" como medida técnica. Aplicar HTTPS/cifrado al 32 es correcto. (Ver "Matices" sobre cabeceras) | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **Art. 22 LSSI / RGPD** (cookies en primera carga) | `finding-meta.ts` (cookies-load); `audit.ts` L192 | ✅ VERIFICADO | Art. **22.2** LSSI regula expresamente los "dispositivos de almacenamiento y recuperación de datos en equipos terminales" (cookies) y exige consentimiento previo e información clara. Cita correcta. | [BOE LSSI](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) |
| **Art. 6 RGPD / Art. 22 LSSI** (trackers) | `finding-meta.ts` (trackers) | ✅ VERIFICADO | Art. 6 = "Licitud del tratamiento" (bases jurídicas, incl. consentimiento e interés legítimo); art. 22.2 LSSI = cookies/rastreadores. Combinación correcta. | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **Art. 22 LSSI / Guía AEPD** (banner) | `finding-meta.ts` (banner) | ✅ VERIFICADO (⚠️ matiz fecha) | Art. 22.2 LSSI + criterio AEPD de aceptar/rechazar/configurar con igual visibilidad. El criterio se incorporó en 2023; el PDF **vigente de la guía es de mayo 2024**. "Guía AEPD 2023" es sustancialmente correcto pero conviene citar la versión actual. | [Guía AEPD cookies](https://www.aepd.es/guias/guia-cookies.pdf) |
| **Art. 13 RGPD** (form-embed, privacidad) | `finding-meta.ts` (form-embed, privacidad) | ✅ VERIFICADO | Art. 13 = "Información que deberá facilitarse cuando los datos... se obtengan del interesado". Correcto para política de privacidad y cláusula de formulario. | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **Arts. 6 y 49 RGPD** (embeds de terceros) | `finding-meta.ts` (embeds) | ✅ VERIFICADO | Art. 6 = licitud; Art. 49 = "Excepciones para situaciones específicas" (transferencias internacionales). Coherente para embeds de YouTube/Maps/Fonts que implican transferencia a EE.UU. | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **Art. 10 LSSI-CE** (aviso legal) | `finding-meta.ts` (aviso-legal); `legal.ts` SYSTEM_PROMPT L246 | ✅ VERIFICADO | Art. 10.1 exige: a) nombre/denominación, domicilio y **dirección de correo electrónico**; b) datos del **Registro Mercantil** "en su caso"; e) **NIF**. El reparto email (10.1.a) / NIF (10.1.e) / registrales (10.1.b) es EXACTO. | [BOE LSSI art. 10](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) |
| **Art. 22 LSSI-CE** (política de cookies) | `finding-meta.ts` (cookies-pol) | ✅ VERIFICADO | Art. 22.2 LSSI = base de la obligación de cookies. Correcto. | [BOE LSSI](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) |
| **Art. 7 RGPD** (consentimiento en formularios) | `finding-meta.ts` (form-consent) | ✅ VERIFICADO | Art. 7 = "Condiciones para el consentimiento" (incluye que sea afirmativo/no premarcado, base del considerando 32). Correcto. | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **RFC 7208 (SPF)** | `finding-meta.ts` (spf) | ✅ VERIFICADO | RFC 7208 = Sender Policy Framework. Correcto. Etiquetado "Seg. correo" (fuera del núcleo RGPD): correcto. | [RFC 7208](https://datatracker.ietf.org/doc/html/rfc7208) |
| **RFC 6376 (DKIM)** | `finding-meta.ts` (dkim) | ✅ VERIFICADO | RFC 6376 = DomainKeys Identified Mail. Correcto. | [RFC 6376](https://datatracker.ietf.org/doc/html/rfc6376) |
| **RFC 7489 (DMARC)** | `finding-meta.ts` (dmarc) | ✅ VERIFICADO | RFC 7489 = DMARC (marzo 2015). Correcto. | [RFC 7489](https://datatracker.ietf.org/doc/html/rfc7489) |
| **Arts. 13-14 RGPD** (checklist privacidad) | `legal.ts` SYSTEM_PROMPT L244 | ✅ VERIFICADO | Art. 13 (datos obtenidos del interesado) y Art. 14 (datos no obtenidos del interesado) = información a facilitar. Correcto. | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **Art. 37 RGPD** (designación DPD) | `legal.ts` SYSTEM_PROMPT L250; `chat-kb.ts` L133, L223, L251 | ✅ VERIFICADO | Art. 37 = "Designación del delegado de protección de datos". Correcto. | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **Art. 34.1 LOPDGDD** (lista obligados DPD) | `legal.ts` SYSTEM_PROMPT L250 | ✅ VERIFICADO | Art. 34.1 enumera exactamente: colegios profesionales, centros docentes/universidades, operadores de comunicaciones a gran escala, prestadores que elaboren perfiles a gran escala, entidades de crédito, establecimientos financieros de crédito, aseguradoras, empresas de inversión, distribuidoras/comercializadoras de energía, etc. La lista del prompt coincide. | [BOE LOPDGDD art. 34](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673) |
| **Arts. 44-49 RGPD** (transferencias intl.) | `legal.ts` SYSTEM_PROMPT L251 | ✅ VERIFICADO | Capítulo V del RGPD = "Transferencias de datos personales a terceros países"; arts. 44 (principio general) a 49 (excepciones). Correcto. | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **Art. 9 RGPD** (categorías especiales) | `legal.ts` SYSTEM_PROMPT L250, L257 | ✅ VERIFICADO | Art. 9 = "Tratamiento de categorías especiales de datos personales" (salud, ideología, etc.). Correcto. | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **Arts. 27-28 LSSI** (T&C ecommerce) | `legal.ts` SYSTEM_PROMPT L247 | ✅ VERIFICADO | Art. 27 = "Obligaciones previas a la contratación"; Art. 28 = "Información posterior a la celebración del contrato". Correcto para T&C de ecommerce. | [BOE LSSI](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) |
| **RDL 1/2007** (consumidores) | `legal.ts` SYSTEM_PROMPT L247 | ✅ VERIFICADO (identificación) | Es el Real Decreto Legislativo 1/2007, texto refundido Ley General para la Defensa de Consumidores y Usuarios. Sustenta desistimiento 14 días y modelo de formulario (arts. 102 y ss.). Identificación correcta. | [BOE-A-2007-20555](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555) |
| **Art. 10.1.a LSSI** (email aviso legal) | `legal.ts` SYSTEM_PROMPT L253; `crossRefNote` L359 | ✅ VERIFICADO | 10.1.a incluye "su dirección de correo electrónico y cualquier otro dato que permita... comunicación directa y efectiva". El email se ubica en 10.1.a. Correcto. | [BOE LSSI art. 10](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) |
| **Art. 10.1.b LSSI** (datos registrales) | `legal.ts` SYSTEM_PROMPT L252; `refineElements` L380 | ✅ VERIFICADO | 10.1.b = datos de inscripción en el Registro Mercantil "en su caso". Aplicar solo a sociedades inscribibles es jurídicamente correcto. | [BOE LSSI art. 10](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) |
| **Art. 10.1.e LSSI** (NIF) | `legal.ts` SYSTEM_PROMPT L252-253; `crossRefNote` L365 | ✅ VERIFICADO | 10.1.e = "El número de identificación fiscal que le corresponda". El NIF se ubica en 10.1.e (obligatorio siempre, también autónomos). Correcto. | [BOE LSSI art. 10](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) |
| **Art. 13.1.a RGPD** (identidad y datos de contacto del responsable) | `legal.ts` SYSTEM_PROMPT L253; `crossRefNote` L361, L367 | ✅ VERIFICADO | 13.1.a dice literalmente "**la identidad y los datos de contacto del responsable**". El matiz de la herramienta es CORRECTO: el RGPD pide "datos de contacto" e "identidad", no el email ni el NIF de forma literal. | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **Art. 13.1.b RGPD** (DPD en su caso) | (implícito en checklist L244 y matiz aviso/privacidad) | ✅ VERIFICADO | 13.1.b = "en su caso, los datos de contacto del delegado de protección de datos". Correcto. | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **Art. 8 LOPDGDD** (menores, ≥14 años) | `legal.ts` SYSTEM_PROMPT L257 | ❌ ERRÓNEO | El consentimiento de menores (14 años) es el **art. 7 LOPDGDD**, no el art. 8. El **art. 8** LOPDGDD regula "Tratamiento de datos por obligación legal, interés público o ejercicio de poderes públicos". **Corregir a "art. 7 LOPDGDD".** | [BOE LOPDGDD art. 7](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673) |

### Citas adicionales detectadas en `chat-kb.ts` (base de conocimiento del asistente ClaudIA — también llega a clientes)

| Cita | Dónde aparece | Estado | Justificación | Enlace oficial |
|---|---|---|---|---|
| **Art. 15 RGPD** (acceso) | `chat-kb.ts` L245 | ✅ VERIFICADO | "Derecho de acceso del interesado". | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **Art. 16 RGPD** (rectificación) | `chat-kb.ts` L245 | ✅ VERIFICADO | "Derecho de rectificación". | id. |
| **Art. 17 RGPD** (supresión / olvido) | `chat-kb.ts` L245 | ✅ VERIFICADO | "Derecho de supresión ('el derecho al olvido')". | id. |
| **Art. 18 RGPD** (limitación) | `chat-kb.ts` L245 | ✅ VERIFICADO | "Derecho a la limitación del tratamiento". | id. |
| **Art. 20 RGPD** (portabilidad) | `chat-kb.ts` L245 | ✅ VERIFICADO | "Derecho a la portabilidad de los datos". | id. |
| **Art. 21 RGPD** (oposición) | `chat-kb.ts` L245 | ✅ VERIFICADO | "Derecho de oposición". | id. |
| **Art. 22 RGPD** (decisiones automatizadas/perfiles) | `chat-kb.ts` L245 | ✅ VERIFICADO | "Decisiones individuales automatizadas, incluida la elaboración de perfiles". OJO: es art. 22 **del RGPD** (distinto del art. 22 LSSI de cookies); la herramienta lo distingue bien. | id. |
| **Art. 12 RGPD** (transparencia, plazo 1 mes) | `chat-kb.ts` L246 | ✅ VERIFICADO | Art. 12.3 fija "en el plazo de un mes a partir de la recepción de la solicitud" (prorrogable 2 meses). Correcto. | id. |
| **Art. 6 RGPD** (bases jurídicas) | `chat-kb.ts` L247 | ✅ VERIFICADO | "Licitud del tratamiento": consentimiento, contrato, obligación legal, interés legítimo. Correcto. | id. |
| **Art. 13 RGPD** (info en privacidad web) | `chat-kb.ts` L248 | ✅ VERIFICADO | Correcto. | id. |
| **LSSI art. 10** (info del prestador en aviso legal) | `chat-kb.ts` L248, L255 | ✅ VERIFICADO | Correcto (titular, NIF/CIF, datos de contacto). | [BOE LSSI](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) |
| **Art. 30 RGPD** (registro de actividades) | `chat-kb.ts` L249 | ✅ VERIFICADO | "Registro de las actividades de tratamiento". Correcto. | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **Art. 28 RGPD** (encargado del tratamiento) | `chat-kb.ts` L249 | ✅ VERIFICADO | "Encargado del tratamiento" (contrato del 28.3). OJO: art. 28 **del RGPD** (distinto del art. 28 LSSI). Contexto correcto. | id. |
| **Art. 33 RGPD** (brecha, 72h a la AEPD) | `chat-kb.ts` L250 | ✅ VERIFICADO | Art. 33.1: notificación "a la autoridad de control competente... a más tardar 72 horas". Correcto. | id. |
| **Art. 37 RGPD / art. 34 LOPDGDD** (DPD obligatorio) | `chat-kb.ts` L133, L223, L251 | ✅ VERIFICADO | Correcto. | [BOE LOPDGDD](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673) |
| **Art. 22.2 LSSI** (cookies, consentimiento previo) | `chat-kb.ts` L256 | ✅ VERIFICADO | Correcto (transcrito arriba). | [BOE LSSI](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) |
| **Sanciones 20 M€ / 4%** (RGPD) | `chat-kb.ts` L268 | ✅ VERIFICADO | Art. 83.5 RGPD: "20 000 000 EUR como máximo o... una cuantía equivalente al 4 % como máximo del volumen de negocio total anual global". Correcto. | [DOUE PDF](https://www.boe.es/doue/2016/119/L00001-00088.pdf) |
| **RGPD = Reglamento UE 2016/679 / LOPDGDD = LO 3/2018** | `chat-kb.ts` L244 | ✅ VERIFICADO | Identificadores correctos. | EUR-Lex / BOE |
| **Art. 26 RIA (AI Act, Reglamento UE 2024/1689)** | `chat-kb.ts` L155, L261, L263 | 🟡 NO VERIFICABLE (fuera de alcance del encargo) | Identificación del AI Act (Reglamento UE 2024/1689, en vigor desde ago-2024) y art. 26 (obligaciones de los responsables del despliegue de IA de alto riesgo) es plausible y consistente, pero no se ha contrastado el literal en esta auditoría (encargo centrado en RGPD/LSSI/LOPDGDD). Recomendable verificar contra [EUR-Lex CELEX:32024R1689](https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32024R1689) antes de publicar. | [EUR-Lex AI Act](https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32024R1689) |

---

## Correcciones recomendadas

### 1. ERROR — `src/lib/legal.ts`, SYSTEM_PROMPT, línea 257

Cita actual:
> "tratamiento de datos de menores (**art. 8 LOPDGDD**: consentimiento ≥14 años y control de edad)"

Es incorrecto: el consentimiento de menores está en el **art. 7 LOPDGDD** (texto oficial: *"El tratamiento de los datos personales de un menor de edad únicamente podrá fundarse en su consentimiento cuando sea mayor de catorce años"*). El art. 8 LOPDGDD regula el tratamiento por obligación legal / interés público / ejercicio de poderes públicos.

Corrección sugerida:
> "tratamiento de datos de menores (**art. 7 LOPDGDD**: consentimiento ≥14 años y control de edad)"

Base oficial: [LOPDGDD art. 7, BOE-A-2018-16673](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673).

Impacto: el prompt guía al modelo; un cliente avispado o su abogado podrían detectar la cita errónea en el informe. Cambio de un solo carácter ("8"→"7"), sin más implicaciones.

### 2. MATIZ menor (no error) — `finding-meta.ts`, clave `banner`

Texto: "(Guía AEPD 2023)". El criterio de aceptar/rechazar/configurar con igual visibilidad se incorporó en 2023, pero el PDF **vigente** de la Guía de cookies de la AEPD está fechado en **mayo 2024**. Sugerencia: usar "Guía AEPD sobre cookies (vigente)" o "Guía AEPD cookies 2024" para evitar que la contraparte alegue que se cita una versión superada. No es un error de fondo.

### 3. PENDIENTE (fuera de alcance del encargo) — citas del AI Act en `chat-kb.ts`

Las referencias al Reglamento UE 2024/1689 y su art. 26 no se han verificado en esta auditoría (encargo limitado a RGPD/LSSI/LOPDGDD). Antes de que el asistente las emita a clientes, conviene contrastar el literal contra EUR-Lex.

---

## Notas de método (flancos a vigilar)

- **El reparto email/NIF (LSSI art. 10) vs datos de contacto/identidad (RGPD art. 13.1.a) es el punto crítico del entregable y está PLENAMENTE VERIFICADO contra el texto oficial.** El email vive en LSSI 10.1.a; el NIF en LSSI 10.1.e; el RGPD 13.1.a solo pide "la identidad y los datos de contacto del responsable" (no email ni NIF literales). La función `crossRefNote` aplica esta distinción correctamente.
- **No confundir los dos "art. 22" ni los dos "art. 28":** la herramienta usa "art. 22 LSSI" para cookies y "art. 22 RGPD" para decisiones automatizadas; "art. 28 LSSI" para info postcontractual y "art. 28 RGPD" para el encargado. En todos los casos el contexto de uso es el correcto.
- **Art. 32 RGPD para cabeceras HTTP (HSTS, CSP, X-Content-Type-Options, Referrer-Policy):** es defendible (son medidas técnicas de seguridad del tratamiento del art. 32.1), pero es una interpretación amplia. No es un error de cita, pero la contraparte podría discutir que el RGPD no exige nominalmente esas cabeceras concretas. Las cabeceras "bonus" ya están fuera del núcleo de puntuación, lo que mitiga el riesgo.
- El art. 22.2 LSSI aún remite en su literal consolidado a la "Ley Orgánica 15/1999" (derogada), porque el legislador no actualizó la remisión tras la LOPDGDD; esto NO afecta a las citas de la herramienta, que son correctas.
