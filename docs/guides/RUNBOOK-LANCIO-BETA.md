# Runbook — Lancio Beta (cerchia ridotta)

> Passi operativi per portare in produzione l'hardening e aprire la beta agli amici.
> Ordine da seguire. I passi ⚙️ **richiedono azione manuale** (dashboard Vercel/Neon); i passi 🤖 sono comandi.

Stato al 2026-07-07: hardening completo, verificato in locale prod-mode, mergiato in `develop` e pushato (preview Vercel in rigenerazione). Restano i passi sotto.

---

## 0. Cosa è già fatto

- ✅ Factory condivisa `createApp()` (`src/api/app.ts`): dev e prod non possono più divergere.
- ✅ Endpoint debug rimosso in prod, JWT **fail-fast** (crash se manca il secret), route `logs`/`push`/`feedback`/`contract-history`/`cron` montate ovunque, `--accept-data-loss` tolto dal `vercel-build`.
- ✅ `npm run test:all` verde (1707 test), `tsc` pulito.
- ✅ Smoke locale prod-mode: health 200, `/api/debug/timing` → 404, login+JWT ok, route montate ok, fail-fast JWT confermato.
- ✅ `develop` = `feature/1.x-prod-hardening` pushato → **preview Vercel** in aggiornamento.

---

## 1. ⚙️ Pre-flight: variabili d'ambiente su Vercel

Verificare che TUTTE le env siano presenti su Vercel per gli scope **Production** e **Preview** (Settings → Environment Variables). Con l'hardening, **se mancano i JWT secret l'app in prod NON parte** (fail-fast, voluto).

**Bloccanti (senza queste l'app non parte / è rotta):**
- `DATABASE_URL` — Postgres Neon (usare la connection string pooled)
- `JWT_ACCESS_SECRET` — stringa random lunga (≥32 char). ⚠️ fail-fast se assente in prod
- `JWT_REFRESH_SECRET` — stringa random lunga, diversa dalla precedente
- `FRONTEND_URL` — URL pubblico del frontend (per CORS allowlist + link email)

**Real-time (asta/rubata/svincolati live):**
- `PUSHER_APP_ID`, `PUSHER_SECRET`, `VITE_PUSHER_KEY`, `VITE_PUSHER_CLUSTER`

**Email (inviti + reset password):**
- `EMAIL_PROVIDER` (`gmail` | `resend`)
- se gmail: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- se resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

**Push notifiche (degradano a 503 se assenti, non bloccanti):**
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`

**Cron API-Football + anti-bot (non bloccanti per il flusso beta):**
- `CRON_SECRET`, `API_FOOTBALL_KEY`, `API_FOOTBALL_DAILY_LIMIT`, `TURNSTILE_SECRET_KEY`, `LOG_LEVEL`

> Riferimento locale: confrontare con `.env.vercel` / `.env` in locale per non dimenticarne nessuna.

## 2. ⚙️ Sicurezza dato: PITR su Neon

- Verificare che il branch Neon di produzione abbia il **Point-in-Time Restore** attivo (piano che lo consente) e annotare la finestra di retention.
- Il `vercel-build` fa `prisma db push` (senza `--accept-data-loss`): se una migrazione fosse distruttiva, il build **fallisce** invece di perdere dati. Bene così. Con schemi additivi passa liscio.

## 3. Smoke su PREVIEW (dopo il push di `develop`)

Aprire l'URL di preview del deploy `develop` (dashboard Vercel → Deployments) e provare i flussi critici **su URL reale**:

- [ ] `GET /api/health` → `{status:"ok"}`
- [ ] Registrazione nuovo utente (email arriva?)
- [ ] Login
- [ ] Invito a una lega + accettazione + scelta nome squadra
- [ ] `GET /api/debug/timing` → **404** (deve essere rimosso in prod)
- [ ] Una fase live (anche solo aprire una stanza asta) per validare Pusher

Se qualcosa non va → **non** procedere al deploy in produzione; sistemare su `develop`.

## 4. 🤖 Deploy in PRODUZIONE

Solo dopo che lo smoke preview è verde:

```bash
npm run deploy:main
```

Questo fa: backup dati critici → `checkout main` → `pull` → `merge develop` → `push origin main` → torna su `develop`. Il push su `main` triggera il deploy di produzione su Vercel.

## 5. Post-deploy: smoke in PRODUZIONE

Ripetere i check del punto 3 sull'URL di produzione. In più:
- [ ] Monitorare **Vercel → Logs** (runtime) per errori 500 nei primi minuti
- [ ] `GET /api/logs/recent` (come admin) o Vercel logs per il canale strutturato

## 6. 🤖 Rollback (se qualcosa esplode in prod)

Il deploy precedente resta su Vercel: la via più rapida è **Promote** dell'ultimo deploy sano dalla dashboard (Deployments → deploy verde precedente → Promote to Production). In alternativa via git:

```bash
git checkout main
git revert --no-edit HEAD        # annulla l'ultimo merge di rilascio
git push origin main             # ridispiega la versione precedente
git checkout develop
```

Backup dati: `scripts/backup-critical-data.cjs` (girato in automatico da `predeploy`). Per ripristino dati usare il PITR Neon (punto 2).

## 7. Beta: canale feedback

- Gli amici segnalano dalla pagina **Feedback** in-app (`/api/feedback`).
- Triage delle segnalazioni come **superadmin** (`admin@fantacontratti.it`).
- Guida di ingresso da condividere: `docs/guides/GUIDA-ONBOARDING-BETA.md` (sostituire `<URL>` con l'URL di produzione).

---

## Residui noti (non bloccanti per la beta)

- Formula indennizzo **ESTERO**: default 50M in attesa di input Pietro.
- Rate-limit in-memory è per-istanza serverless (ok per beta chiusa; passare a store condiviso — es. Upstash — prima di scalare).
- GDPR/policy registrazione rimandati (ok cerchia amici, bloccanti per apertura pubblica).
