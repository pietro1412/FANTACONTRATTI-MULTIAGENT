# HANDOFF — FantaContratti Dynasty Platform

> File di passaggio per prendere in carico lo sviluppo. Generato: 2026-07-27.
> Aggiornato: 2026-08-21 — pulizia repository + consolidamento documentale (Fase 1.0). Questo è ora l'**unico documento di stato corrente** (sostituisce `PROJECT-STATUS.md` e `COMPLETAMENTO-BACKLOG.md`, archiviati in `docs/archive/`).
> Aggiornato: 2026-08-24 — `REVIEW_PRE_BETA` (38 commit di rework grafico) mergiato in `develop` e deployato su preview Vercel per la verifica pre-lancio beta 8 manager. `main`/prod invariato. Dettagli: `docs/reviews/verifica-pre-lancio-8-manager-2026-08-24.md`.
> Aggiornato: 2026-08-26 — sessione dedicata alla fase Scambi: piccoli fix UI (età sempre visibile, destinatario modificabile) + scoperta e fix di un bug di dominio (Monte Ingaggi calcolato live invece che fissato al consolidamento Fase 3 Contratti, come da Bibbie). Nuovo campo `LeagueMember.totalSalaries`, backfillato su tutte le leghe reali PRIMA del deploy codice. Deployato in `main`/prod (commit `d97ff6a`). **Checklist di verifica per Pietro**: `docs/reviews/verifica-pre-lancio-8-manager-2026-08-24.md` sezione "Sessione Scambi + fix Monte Ingaggi (2026-08-26)".
> Aggiornato solo su conferma dello stato effettivo — non lasciare sezioni storiche mescolate a quelle vive: se una parte diventa superata, spostarla in `docs/archive/` invece di lasciarla qui contraddittoria.

---

## 1. Informazioni generali

| Campo | Valore |
|-------|--------|
| **Nome progetto** | FantaContratti |
| **Descrizione** | Piattaforma web per fantasy football dinastico con contratti pluriennali |
| **Autore** | Pietro |
| **License** | MIT |
| **Deploy** | Vercel (regione fra1), dominio custom (configurato in Vercel) |
| **DB** | PostgreSQL su Neon (production), Docker locale (sviluppo) |
| **Repo** | `https://github.com/pietro1412/FANTACONTRATTI-MULTIAGENT.git` |

---

## 2. Stack tecnico

| Layer | Tecnologia | Versione |
|-------|-----------|----------|
| Frontend | React + TypeScript + Vite | 19 / 5.9 / 7.3 |
| Styling | TailwindCSS | 3.4 |
| Backend | Express | 5.2 |
| ORM | Prisma | 5.22 |
| DB | PostgreSQL (Neon prod, Docker locale) | — |
| Realtime | Pusher | 5.2 |
| Auth | JWT (access + refresh rotation) + bcryptjs | — |
| Test | Vitest + RTL + Playwright | 4.0 / 16.3 / 1.57 |
| Build API | esbuild (→ `api/index.mjs`) | 0.27 |
| PWA | vite-plugin-pwa | 1.2 |
| Validazione | Zod | 4.2 |

---

## 3. Stato Git (verificato 2026-08-21)

### Branch attuale (aggiornato 2026-08-24)
- **HEAD su `develop`** — `REVIEW_PRE_BETA` (38 commit di rework grafico esteso: Rose/Giocatori/Statistiche unificati, Contratti ContractInline, TeamLogo, tipografia, cockpit) è stato pushato su origin e **mergiato fast-forward in `develop`** (`91addae` → `9757e23`, nessun conflitto). Deployato su preview Vercel per verifica pre-lancio beta 8 manager, vedi `docs/reviews/verifica-pre-lancio-8-manager-2026-08-24.md`.
- **`main` NON toccato** — resta a `91addae`, invariato finché la verifica (Fasi 4-6 del piano) non dà esito Go.
- Working tree pulito.

### Branch locali
| Branch | Stato |
|--------|-------|
| `develop` | ✅ HEAD attivo, allineato a `REVIEW_PRE_BETA` (`9757e23`), avanti a `main` di 38 commit |
| `REVIEW_PRE_BETA` | Confluito in `develop` (fast-forward) — da valutare se cancellare dopo la promozione a `main` |
| `main` | ✅ produzione, fermo a `91addae` in attesa dell'esito della verifica pre-lancio |

### Branch remoti da valutare
`origin/feature/1.x-raccolta-evidenze-beta` e `origin/fix/smoke-beta-prod` sono ancora su GitHub (stessa situazione: già mergiati) — non cancellati automaticamente perché tocca stato condiviso. Eliminabili con `git push origin --delete <nome>` quando confermato.

### Stash
Nessuno (ripulito).

---

## 4. Architettura applicativa

### Struttura sorgente
```
src/
├── api/                  # Backend Express (app.ts, index.ts, vercel-entry.ts)
│   ├── middleware/        # auth, request-logger, turnstile (3 file)
│   └── routes/           # ~15 route file (~261 endpoint)
├── components/           # sottocartelle per feature + file radice
│   ├── ui/               # componenti UI condivisi
│   ├── auction-room-v2/  # layout asta attivo
│   ├── auction-room/     # legacy — ancora importato da Svincolati.tsx, consolidamento da fare (debito noto)
│   ├── rubata/, finance/, players/, league-detail/, cockpit/, ...
├── hooks/                # custom hooks
├── modules/              # Solo identity/ (DDD residuo, isola cablata — confermato, nessun altro modulo residuo)
├── pages/                # ~34 pagine/route
├── services/             # ~27 service file (business logic)
├── shared/               # domain/, infrastructure/, types/service-result.ts
├── types/                # types condivisi
└── utils/                # utility
```

**Totale**: 344 file `.ts`/`.tsx` in `src/` (esclusi test), 71 file di test in `src/__tests__/`.

### Database (Prisma)
Schema modulare in `prisma/schemas/` (16 file): `_base`, `admin`, `app-log`, `auction`, `chat`, `contract-history`, `feedback`, `identity`, `league`, `market-session`, `movement`, `player`, `prize`, `roster`, `rubata`, `svincolati`, `trade`.

Dopo modifiche: `db:build-schema` → merge in `schema.generated.prisma` → `db:generate` → `db:push`.

### Service critici (business logic — non modificare senza conferma)
| File | Righe | Responsabilità |
|------|-------|---------------|
| `auction.service.ts` | ~5870 | Motore asta (primo mercato, timer, reopen) |
| `rubata.service.ts` | ~4240 | Fase rubata |
| `svincolati.service.ts` | ~2520 | Fase svincolati |
| `contract.service.ts` | ~2240 | Contratti, clausole, rinnovi, spalma, consolidamento, KEEP/RELEASE |
| `prize-phase.service.ts` | — | Fase premi e indennizzi |

I 5 service più grandi del progetto sono anche i 5 dichiarati critici — complessità concentrata lì, nessun marker di incompletezza al loro interno (verificato via grep TODO/FIXME/501: zero occorrenze in tutto `src/`).

### API unica frontend
`src/services/api.ts` con `request<T>()` — oggetti domain-grouped (`tradeApi`, `leagueApi`, etc.). Mai fetch diretto nei componenti.

---

## 5. Salute tecnica (verificata 2026-08-21)

| Check | Stato |
|-------|-------|
| Typecheck (`tsc --noEmit`) | ✅ 0 errori |
| Test (`npm run test:all`) | ✅ **1776 test, 83 file, tutti verdi** (verificato 2026-08-26) |
| Build (`npm run build`) | ✅ OK (bundle PWA generato, 70 entry precache) |
| Lint | ✅ 0 errori, 1232 warning pre-esistenti (`no-non-null-assertion`, nessuna nuova regressione) |
| `: any` / `as any` in `src/` | 1 sola occorrenza (`src/api/routes/contracts.ts`) — tipizzazione molto disciplinata |
| `console.log`/`console.error` nei service | 2, entrambe in `app-log.service.ts` (il service di logging stesso — intenzionale) |
| CI/CD | GitHub Actions: lint + typecheck + test + build su PR (`.github/workflows/pr-validation.yml`) |
| Deploy | Vercel automatico su push a `develop`/`main` |

**Conclusione**: il motore di gioco è tecnicamente sano. Non ci sono bug bloccanti noti né feature incomplete marcate nel codice. Il lavoro aperto è su UI/navigazione (vedi §6) e su un piccolo debito di consolidamento (`auction-room` v1/v2).

---

## 6. Stato implementazione — cosa è fatto e cosa manca

### ✅ COMPLETATO
- **Sprint A** (pulizia & coerenza): dead code `src/modules/` rimosso, riserva-1-credito uniformata a Bibbie, bug minori chiusi, Bibbie aggiornate.
- **Sprint B** (feature di gioco, backend + UI): statistiche estese, auto-scadenza offerte scambio, Pusher real-time Svincolati, Lega Pubblica/Privata (toggle + badge), controfferta completa, indicatore trattativa ai terzi.
- **Polish UX web**: componenti condivisi (`Textarea`/`Tabs`/`ErrorState`), WCAG separatori, pattern cockpit (`CockpitShell`, `TimerDisplay`, `BidControlsShared`, ecc.), **10 Assiomi UI/UX** implementati (vedi CLAUDE.md), navigazione unificata + barra-fase + glossario + Players mobile card.
- **Hardening produzione**: factory `createApp()` condivisa dev/prod, via debug da prod, JWT fail-fast, deploy hardening già **in produzione** dal 2026-07-12 (smoke prod verde: helmet attivo, route montate, login reale funzionante).
- **Raccolta evidenze beta (Livello 2)**: reporter errori globali frontend, contesto sessione nelle segnalazioni, workflow conferma fix, creazione issue GitHub dal superadmin (richiede env `GH_PAT` su Vercel — verificare se impostata), smoke suite beta dedicata (`tests/e2e/smoke-beta.spec.ts`). **Confluito in `main`** (branch eliminato oggi, zero commit esclusivi residui).
- **Rework grafico "less is more"** (in corso su `REVIEW_PRE_BETA`, non ancora mergiato): dashboard minimalista, font unico Helvetica, fix contratti Rose/Giocatori.

### ⬜ MANCANTE / APERTO

| Area | Cosa manca | Blocco |
|------|-----------|--------|
| Sprint C — Formula indennizzo ESTERO | Default arbitrario 50M, formula definitiva non fornita | **In attesa input Pietro** |
| Tema colore | 10 mockup pronti (`docs/reviews/mockups/24-themes/`), nessuna scelta fatta | In attesa decisione Pietro |
| `auction-room` v1 | Ancora importato da `Svincolati.tsx`, coesiste con `auction-room-v2` attivo | Consolidamento da fare |
| Semplificazione UI/IA | Verifica live mai fatta su diversi lotti già codificati (assiomi, navigazione); LeagueDetail ha un WIP di semplificazione da riprendere | In corso — vedi piano Fase 1.1 |
| App mobile nativa (`MOBILE-ANDROID`) | 14/24 schermate stub, API URL hardcoded, tema non allineato | Scope di settimane, non prioritario per la beta web |
| Split `Contracts.tsx` / migrazione modali inline (~7 pagine) | Debito minore, non bloccante | Da valutare |

---

## 7. Decisioni aperte (richiedono input da Pietro)

1. **Formula indennizzo ESTERO** — unico blocco residuo per chiudere Sprint C. Default oggi: 50M.
2. **Tema colore** — 10 mockup pronti, nessuno scelto.
3. **Branch remoti mergiati** (`origin/feature/1.x-raccolta-evidenze-beta`, `origin/fix/smoke-beta-prod`) — confermare cancellazione su GitHub.
4. ~~`REVIEW_PRE_BETA` → merge strategy~~ **RISOLTO 2026-08-24**: mergiato in `develop` e deployato su preview per la verifica pre-lancio beta 8 manager (decisione Pietro: merge in develop invece di branch isolato, per aggiornare il preview "ufficiale"). Resta aperto solo il **Go/No-Go per promuovere a `main`**, condizionato all'esito delle Fasi 4-6 di `docs/reviews/verifica-pre-lancio-8-manager-2026-08-24.md`.

---

## 8. Comandi principali

```bash
# Sviluppo
npm run dev              # API + Client in parallelo (.env)
npm run dev:local        # Su DB locale Docker (.env.local)

# Launcher alternativo (idempotente, non uccide processi altrui)
powershell -File scripts/avvia-piattaforma.ps1   # API :3003 + client :5174

# Database
npm run db:build-schema  # Merge schema modulari
npm run db:generate      # Prisma generate
npm run db:push          # Applica a DB

# Test
npm run test             # Vitest watch
npm run test:all         # Singola esecuzione
npm run test:e2e         # Playwright (dev server locale)
npm run test:e2e:beta    # Smoke suite su istanza già attiva (vedi sotto)

# Smoke beta (preview/prod, read-only, 6 test)
#   $env:E2E_BASE_URL="https://<preview>.vercel.app"
#   $env:E2E_MANAGER_EMAIL="..."; $env:E2E_MANAGER_PASSWORD="..."
#   $env:E2E_LEAGUE_URL="https://<app>/leagues/<id>"   # serve per i test 4-5
#   npx playwright test --config=playwright.beta.config.ts

# Qualità
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit

# Deploy
npm run deploy:main      # Backup + merge develop → main + push
```

### Porte locali
- API: `:3003`
- Client Vite: `:5174` (la `:5173` è occupata da un altro progetto — nessun fallback)
- DB Docker: `:5433`

### Credenziali test
| Ruolo | Email | Password |
|-------|-------|----------|
| Super Admin | admin@fantacontratti.it | SuperAdmin2025! |
| Admin Lega | pietro@test.it | Pietro2025! |
| Manager | `<nome>@test.it` | `<Nome>2025!` |

(Manager: michele, mirko, emmanuele, diego, marco, marcolino, emiliano)

---

## 9. Documentazione di riferimento

| File | Contenuto |
|------|-----------|
| `CLAUDE.md` | Istruzioni sempre attive, convenzioni, regole |
| `docs/HANDOFF.md` | **Questo file** — unico documento di stato corrente |
| `docs/bibbie/` | 10 documenti regolamento + INDEX |
| `docs/reviews/` | Report UX/mobile + mockup HTML (incl. `mockups/24-themes/` in attesa di scelta) |
| `docs/guides/` | Onboarding beta, runbook lancio, quotazioni |
| `docs/archive/` | Storico non aggiornato: `PROJECT-STATUS.md`, `COMPLETAMENTO-BACKLOG.md`, `SESSION-CONTEXT.md`, `GAP-ANALYSIS-REPORT.md`, `milestones/`, `sprint-briefs/`, `html/` |

### Gerarchia fonti di verità
1. Regole di gioco → `docs/bibbie/`
2. Architettura/convenzioni → `CLAUDE.md`
3. Stato & roadmap → `docs/HANDOFF.md` (questo file)
4. Storici (non aggiornare) → `docs/archive/`

---

## 10. Note operative

- **Dev server**: Claude riavvia autonomamente il dev server quando serve (basso rischio, autorizzato permanentemente).
- **Prisma stale (#29)**: dopo `db:generate`, riavviare il processo API (`tsx watch` non ricarica `@prisma/client` rigenerato).
- **Convenzioni codice**: italiano nei messaggi utente, inglese nel codice, `@/` aliases per import, NO `any`, NO useReducer/Redux/Zustand.
- **Errori frontend**: toast via `useToast()` per azioni, banner inline solo per errori bloccanti con recovery.
- **Commit**: Conventional Commits (`feat|fix|refactor|docs|style|test(scope): msg`).
