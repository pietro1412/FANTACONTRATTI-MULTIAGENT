# HANDOFF — FantaContratti Dynasty Platform

> File di passaggio per prendere in carico lo sviluppo. Generato: 2026-07-27.
> Aggiornato: 2026-08-13 (Sprint B UI completo, branch allineati su `2cf6d06`).
> Aggiornato solo su conferma dello stato effettivo.

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

## 3. Stato Git

### Branch attuale
- **HEAD su `opencode_luglio`** (commit `2cf6d06`)
- `main` = `develop` = `opencode_luglio` = `2cf6d06` (**allineati — divergenza risolta 2026-08-13**)
- Working tree pulito
- Script dev committati: `scripts/avvia-piattaforma.ps1` (launcher idempotente API :3003 + client :5174), `scripts/setup-scambi-test.ts` (seed dati scambi per test), `scripts/_create-sim-league.ts`, `scripts/_stress-test*.mjs`

### Branch locali
| Branch | Stato |
|--------|-------|
| `opencode_luglio` | ✅ HEAD, attivo, == `main` |
| `develop` | ✅ allineato a `main` |
| `main` | ✅ produzione, aggiornato |
| `feature/1.x-prod-hardening` | Locale, da valutare |
| `MOBILE-ANDROID` | Locale, stato da valutare |

### Branch remote
- `origin/develop`, `origin/main`, `origin/opencode_luglio`, `origin/feature/1.x-prod-hardening`, `origin/feature/2.x-mobile-admin-features`, `origin/MOBILE-ANDROID`

### ⚠️ Divergenza develop/main
**Risolto il 2026-08-13**: `develop` è stato riallineato a `main` (fast-forward a `2cf6d06`). Nessuna divergenza residua.

### Branch fusi (eliminabili)
Il branch `feature/1.x-gap-analysis` (che conteneva Sprint A+B) **non esiste più** — è stato fuso in `develop`. Gli 9 sprint branch elencati nel PROJECT-STATUS come "da eliminare" sono già stati puliti.

### Stash (10)
10 stash presenti su branch storici ormai fusi. Candidati alla pulizia:
```
stash@{0}: feature/1.x-fantastrategy-hub — stash before branch alignment
stash@{1-9}: WIP su branch vari (master, fix/*, feature/*)
```

---

## 4. Architettura applicativa

### Struttura sorgente
```
src/
├── api/                  # Backend Express (app.ts, index.ts, vercel-entry.ts)
│   ├── middleware/        # auth, request-logger, turnstile (3 file)
│   └── routes/           # 22 route file (~261 endpoint)
├── components/           # 19 sottocartelle + 13 file radice
│   ├── ui/               # 36 componenti UI condivisi
│   ├── auction-room-v2/  # 20 file (layout asta attivo)
│   ├── rubata/           # 19 file
│   ├── finance/          # 11 file
│   ├── players/          # 12 file
│   ├── league-detail/    # 13 file
│   ├── cockpit/          # CockpitShell (1 file)
│   └── ... (altre feature)
├── hooks/                # 10 custom hooks
├── modules/              # Solo identity/ (DDD residuo, isola cablata)
├── pages/                # 30 pagine/route
├── services/             # 30 service file (business logic)
├── shared/               # domain/, infrastructure/, types/service-result.ts
├── types/                # 5 file
└── utils/                # 14 file
```

**Totale**: 414 file .ts/.tsx in `src/`, 69 test in `src/__tests__/`.

### Database (Prisma)
17 schema modulari attivi in `prisma/schemas/`:
`_base`, `admin`, `app-log`, `auction`, `chat`, `contract-history`, `feedback`, `identity`, `league`, `market-session`, `movement`, `player`, `prize`, `roster`, `rubata`, `svincolati`, `trade`

Dopo modifiche: `db:build-schema` → merge in `schema.generated.prisma` → `db:generate` → `db:push`.

### Pagine principali (30)
`AdminPanel`, `AuctionRoom`, `Contracts`, `CreateLeague`, `Dashboard`, `FeedbackHub`, `History`, `LeagueDetail`, `LeagueFinancials`, `Login`, `Movements`, `Players`, `PrizePhasePage`, `Profile`, `Prophecies`, `Register`, `Rose`, `Rubata`, `Rules`, `StrategieRubata`, `SuperAdmin`, `Svincolati`, `Trades`, + pagine auth/utility.

### Service critici (business logic)
| File | Responsabilità |
|------|---------------|
| `contract.service.ts` | Contratti, clausole, rinnovi, spalma, consolidamento, KEEP/RELEASE |
| `auction.service.ts` | Motore asta (primo mercato, timer, reopen) |
| `rubata.service.ts` | Fase rubata |
| `svincolati.service.ts` | Fase svincolati |
| `prize-phase.service.ts` | Fase premi e indennizzi |
| `trade.service.ts` | Scambi tra manager |

### API unica frontend
`src/services/api.ts` con `request<T>()` — oggetti domain-grouped (`tradeApi`, `leagueApi`, etc.). Mai fetch diretto nei componenti.

---

## 5. Salute tecnica

| Check | Stato |
|-------|-------|
| Typecheck (`tsc --noEmit`) | ✅ 0 errori |
| Test (1712) | ✅ Tutti verdi (77 file, ~75s) |
| Build (`npm run build` + `build:api`) | ✅ Verificata 2026-08-13 |
| Lint | ✅ 0 errori (1204 warning pre-esistenti, nessuno nuovo) |
| CI/CD | GitHub Actions: lint + typecheck + test + build su PR (`.github/workflows/pr-validation.yml`) |
| Deploy | Vercel automatico su push a `develop`/`main` |

---

## 6. Stato implementazione — cosa è fatto e cosa manca

### ✅ COMPLETATO (Sprint A + B + Polish UX)

**Sprint A — Pulizia & coerenza:**
- Dead code `src/modules/` rimosso (9 moduli + barrel)
- Pagina Indennizzi + route residui rimossi (T5-D)
- Riserva 1 credito uniformata a Bibbie (T6-1, T7-1)
- Bug minori: msg semestri, route pause, reset preConsolidation, indennizzo custom, legacy svincolati
- Bibbie aggiornate (esteri, bilancio, statistiche JSON, rinnovo post-trade)

**Sprint B — Feature di gioco (backend completo):**
- Statistiche `duelsWon` + `foulsCommitted` (T8-2)
- Auto-scadenza offerte di scambio attivata (T3-3)
- Eventi Pusher real-time Svincolati backend (T7-2)
- Lega Pubblica/Privata: schema + service + validation (T1-1 backend)
- Riepilogo eventi apertura per-manager (T2-3)
- Correzioni admin post-finalize premi (T4-1)
- Annulla-fine-asta / reopen (T1-2)

**Polish UX web (2026-06-06):**
- Componenti condivisi: `Textarea`, `Tabs`, `ErrorState`
- WCAG: separatori decorativi `aria-hidden`
- Modal shared: `AuctionConfirmModal` migrata
- Cockpit pattern: `CockpitShell`, `TimerDisplay`, `BidControlsShared`, `BidChips`, `ManagerListRow`, `MemberReadyChips`, `Monogram`, `PanelTabs`
- Assiomi UI 1-10 implementati (tabelle proporzionate, mobile no-truncation, stile Finanze, nome cliccabile, carriera in modale, label ingaggio/durata, grafici chiari)
- Navigazione unificata (P1), barra-fase (P2), help+glossario (P3), Players mobile (P4)

**Hardening:**
- Factory `createApp()` condivisa dev/prod + hardening produzione
- CORS dev accetta IP LAN
- E2E parametrizzati (env + baseURL)
- Runbook rilascio beta + guida onboarding beta

### ⬜ MANCANTE — Sprint B UI (da implementare)

**Completato il 2026-08-13** (commit `e91901b` + sessione corrente):

| ID | Feature | Stato |
|----|---------|-------|
| T1-1 UI | Toggle Pubblica/Privata in creazione lega + badge ricerca | ✅ FATTO — `CreateLeague.tsx` toggle + badge in `Dashboard.tsx` |
| T3-1 | Indicatore "trattativa in corso" ai terzi | ✅ FATTO — chip su rose altrui in `Rose.tsx` (solo visibilità, no dettagli) + conteggio in `Trades.tsx` |
| T3-2 | Controfferta UI completa in `Trades.tsx` | ✅ FATTO — `CounterOfferModal`; il giro contro-controofferta è garantito dal backend (`counterOffer` crea nuova offerta PENDING scambiata) |
| T7-2 UI | Collegare eventi Pusher Svincolati a `useSvincolatiState` | ✅ FATTO — handler completi in `useSvincolatiState.ts` (6 eventi, optimistic update + reconcile) |

### ⬜ MANCANTE — Sprint C (bloccato / da decidere)

| ID | Feature | Blocco |
|----|---------|--------|
| T4-2 + T5-A | Formula indennizzo ESTERO | **In attesa input da Pietro** — oggi default 50M |
| T8-1 | Stato fine mercato esplicito | Basso impatto, da valutare |
| Nice-to-have | OAuth, ordine chiamata random, admin-solo, vincoli creazione lega | Rinvio post-beta |

### ⬜ MANCANTE — Altri ritardi

- **Split `Contracts.tsx`** (#15): file grande, task dedicato
- **Migrazione modali inline**: ~7 pagine con modali non-condivise (alto rischio regressione)
- **App mobile nativa** (`MOBILE-ANDROID`): 14/24 schermate stub, API URL hardcoded, tema non allineato (scope settimane)

---

## 7. Decisioni aperte (richiedono input da Pietro)

1. **Formula indennizzo ESTERO** — Blocca T4-2 e T5-A. Senza formula, il default resta 50M. **Unico blocco rimasto a Sprint C.**
2. ~~Riallineamento develop/main~~ — **RISOLTO 2026-08-13** (FF-merge, branch allineati su `2cf6d06`).
3. **Stash** — 10 stash storici. Eliminare tutti o verificarne qualcuno?
4. **Branch `MOBILE-ANDROID`** — Stato attuale? Proseguire o archiviare?
5. **Branch `feature/1.x-prod-hardening`** — 1 commit avanti develop (ora contenuto). Mergiare o eliminare?

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
npm run test:e2e         # Playwright

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
| `docs/PROJECT-STATUS.md` | Stato consolidato + roadmap |
| `docs/COMPLETAMENTO-BACKLOG.md` | Backlog dettagliato per fase di gioco |
| `docs/SESSION-CONTEXT.md` | Storico decisioni (fermo a 2026-02-06) |
| `docs/GAP-ANALYSIS-REPORT.md` | Bug e feature mancanti |
| `docs/bibbie/` | 10 documenti regolamento + INDEX |
| `docs/reviews/` | Report UX/mobile + 43 mockup HTML |
| `docs/guides/` | Onboarding beta, runbook, quotazioni |

### Gerarchia fonti di verità
1. Regole di gioco → `docs/bibbie/`
2. Architettura/convenzioni → `CLAUDE.md`
3. Stato & roadmap → `docs/PROJECT-STATUS.md` + `docs/COMPLETAMENTO-BACKLOG.md`
4. Storici (non aggiornare) → `docs/SESSION-CONTEXT.md`, `docs/GAP-ANALYSIS-REPORT.md`

---

## 10. Note operative

- **Dev server**: Claude riavvia autonomamente il dev server quando serve (basso rischio, autorizzato permanentemente).
- **Prisma stale (#29)**: dopo `db:generate`, riavviare il processo API (`tsx watch` non ricarica `@prisma/client` rigenerato).
- **Convenzioni codice**: italiano nei messaggi utente, inglese nel codice, `@/` aliases per import, NO `any`, NO useReducer/Redux/Zustand.
- **Errori frontend**: toast via `useToast()` per azioni, banner inline solo per errori bloccanti con recovery.
- **Commit**: Conventional Commits (`feat|fix|refactor|docs|style|test(scope): msg`).
