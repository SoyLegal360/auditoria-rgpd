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

## Próximos pasos — FASE 2 (pendiente)
1. **Cualificación de leads con IA + email** (lo que pidió José):
   - Form de captura de email tras el informe → `POST /api/lead`.
   - Usar **Claude API** (Anthropic) — modelo recomendado `claude-sonnet-4-6` (o `claude-opus-4-8`
     para máxima calidad) para: (a) redactar recomendaciones personalizadas, (b) puntuar el lead.
   - Enviar email a José con el lead cualificado vía **Resend**.
   - Claves necesarias (env): `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `NOTIFY_EMAIL`.
2. **Desplegar en Vercel** + conectar subdominio `app.soylegal360.es`
   (el DNS de soylegal360.es se gestiona por API de Hostinger; ver más abajo).
3. **Fase 3**: navegador headless (Playwright + @sparticuz/chromium) para detectar cookies/
   rastreadores reales **antes del consentimiento** (lo más potente y diferencial).
4. Pulir marca/diseño; informe en PDF; CTA Calendly; guardar leads en BD; monitorización recurrente.

## Contexto de dominios/infra (hecho hoy, 2026-06-06)
- soylegal360.es: alojada en **Hostinger** (web HTML estática, no WordPress).
  Se añadieron por API de Hostinger: SPF `v=spf1 include:_spf.google.com ~all` y DMARC `v=DMARC1; p=none;`.
- soylegal360.com: registrado en **Dondominio**; redirige **301 → www.soylegal360.es**
  (se devolvieron los nameservers a Dondominio para activar su servicio de redirección).
- API de Hostinger: base `https://developers.hostinger.com`, auth `Authorization: Bearer <token>`.
  Token expuesto en chat el 2026-06-06 → **conviene regenerarlo** en hPanel → Perfil → API.
