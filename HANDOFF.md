# 🤝 HANDOFF — Herramienta de Auditoría RGPD (SoyLegal360)

> Documento de traspaso para continuar el proyecto en otra sesión/cuenta de Claude.
> Última actualización: 2026-06-06.

## Qué es esto
Herramienta web **pública de lead-gen** que audita el cumplimiento RGPD de la web de un visitante
y capta el lead. Es un producto de **SoyLegal360** (empresa de RGPD de José; S.L. B-88653225).
No confundir con el proyecto aparte "misderechosARCO".

## Stack y ubicación
- **Next.js 16.2.7** (App Router, TypeScript, Tailwind, carpeta `src/`).
- Ubicación local: **`/Users/josemotos/dev/auditoria-rgpd`**.
- Destino de despliegue: **Vercel**, subdominio **`app.soylegal360.es`**.

## ⚠️ Gotchas de esta Mac (IMPORTANTE para ejecutar comandos)
1. La shell arranca con el **directorio de trabajo roto** (`pwd` = `.`, Node falla con
   `EPERM uv_cwd`). Solución: prefijar SIEMPRE los comandos con `cd /ruta/absoluta &&`.
2. `~/Documents` y `~/Desktop` están **protegidas por TCC** de macOS → Node falla ahí dentro.
   Por eso el proyecto vive en `~/dev` y NO en Documents/Desktop.
3. A veces hace falta ejecutar Bash con el sandbox desactivado para npm/instalación.

## Cómo arrancar
```bash
cd /Users/josemotos/dev/auditoria-rgpd && npm run dev   # http://localhost:3000
cd /Users/josemotos/dev/auditoria-rgpd && npm run build  # build de producción (validado, OK)
```

## Estado actual — FASE 1 COMPLETADA ✅
- `src/lib/audit.ts` — motor de auditoría. Comprueba:
  - **Seguridad**: HTTPS, caducidad SSL (vía `tls`), cabeceras HSTS / X-Content-Type-Options /
    CSP / Referrer-Policy.
  - **Cookies**: cookies en primera carga (Set-Cookie), rastreadores (GA, GTM, Meta Pixel,
    Hotjar, TikTok, LinkedIn, Ads), indicios de banner de consentimiento.
  - **Legal**: Política de Privacidad, Aviso Legal (LSSI-CE), Política de Cookies.
  - **Formularios**: casilla/texto de consentimiento.
  - **Correo**: SPF y DMARC (vía DNS TXT).
  - Devuelve puntuación 0-100 y nota A–E.
- `src/app/api/audit/route.ts` — endpoint `POST /api/audit` (runtime nodejs). Body `{ "url": "..." }`.
- `src/app/page.tsx` — landing pública con formulario + informe visual por categorías.
- **Probado** contra soylegal360.es → 68/100 (C); detecta GA, faltan cabeceras, SPF/DMARC OK.

## FASE 2 COMPLETADA ✅ (2026-06-06)
- `src/lib/lead.ts` — `qualifyLead(audit, contact)`: cualifica el lead con **Claude API**
  (modelo por env `ANTHROPIC_MODEL`, por defecto `claude-sonnet-4-6`; prompt caching activado).
  Devuelve `tier` (hot/warm/cold, interno) + `summary` y `recommendations` (públicos).
  **Caída elegante a reglas** si no hay `ANTHROPIC_API_KEY` (`source: "fallback"`).
- `src/lib/store.ts` — `saveLead()` escribe JSONL en `./data/leads.jsonl`. En Vercel el FS del
  proyecto es de solo lectura (EROFS) → cae a `os.tmpdir()` (escribible pero **EFÍMERO**).
- `src/app/api/lead/route.ts` — `POST /api/lead`: re-audita server-side, valida email +
  consentimiento, guarda el lead y devuelve SOLO lo público (no el `tier`).
- `src/app/page.tsx` — formulario de captura (nombre/teléfono/email + consentimiento) que
  muestra el plan de acción al visitante.
- `.env.example` documenta las claves. `/data` está en `.gitignore` (datos personales).

## Estado de despliegue (Vercel, 2026-06-06)
- Proyecto Vercel: **`soylegalprojects/auditoria-rgpd`** (cuenta `josemotos92-8046`). Vinculado.
- **Producción** (alias público `https://auditoria-rgpd.vercel.app`): tiene una versión ANTIGUA
  (Fase 2 sin el fix de EROFS → `/api/lead` da 500). Pendiente de promover el build bueno.
- **Preview** con el código actual (Fase 2 + fix EROFS, validado OK vía `vercel curl`): protegida
  por Vercel Authentication (401 sin login). Para promover a prod: `vercel --prod` (requiere OK del
  usuario; el clasificador lo bloquea si no se pidió).
- **Aún SIN** `ANTHROPIC_API_KEY` en Vercel → en prod la cualificación usa el respaldo por reglas.

## Próximos pasos — FASE 3 (pendiente)
1. **Persistencia real de leads** (lo efímero de /tmp NO vale para captar leads): migrar a
   **Vercel KV / Postgres** (Marketplace) o enviar el lead fuera (Notion/email).
2. **Aviso por email** del lead a José vía **Resend** (`RESEND_API_KEY`, `NOTIFY_EMAIL`).
3. **Configurar `ANTHROPIC_API_KEY`** en Vercel (`vercel env add`) para activar Claude en prod.
4. **Subdominio `app.soylegal360.es`** (DNS por API de Hostinger; ver abajo). REGENERAR el token.
5. Navegador headless (Playwright + @sparticuz/chromium) para detectar cookies/rastreadores
   reales **antes del consentimiento** (lo más diferencial).
6. Pulir marca/diseño; informe en PDF; CTA Calendly; monitorización recurrente.

## Contexto de dominios/infra (hecho hoy, 2026-06-06)
- soylegal360.es: alojada en **Hostinger** (web HTML estática, no WordPress).
  Se añadieron por API de Hostinger: SPF `v=spf1 include:_spf.google.com ~all` y DMARC `v=DMARC1; p=none;`.
- soylegal360.com: registrado en **Dondominio**; redirige **301 → www.soylegal360.es**
  (se devolvieron los nameservers a Dondominio para activar su servicio de redirección).
- API de Hostinger: base `https://developers.hostinger.com`, auth `Authorization: Bearer <token>`.
  Token expuesto en chat el 2026-06-06 → **conviene regenerarlo** en hPanel → Perfil → API.
