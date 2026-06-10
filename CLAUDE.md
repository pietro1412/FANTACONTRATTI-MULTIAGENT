# CLAUDE.md — FantaContratti Dynasty Platform

> Piattaforma web per fantasy football dinastico con contratti pluriennali.
> Questo file è la source of truth per ogni sessione Claude Code.

## Stack

- **Frontend**: React 19 + TypeScript 5.9 + Vite 7 + TailwindCSS 3.4
- **Backend**: Express 5 (serverless su Vercel, region fra1)
- **Database**: PostgreSQL + Prisma 5.22 (16 schema modulari in prisma/schemas/)
- **Real-time**: Pusher (WebSocket)
- **Auth**: JWT (access token in memoria) + bcryptjs + refresh token rotation
- **Test**: Vitest 4 + React Testing Library + Playwright 1.57
- **Validazione**: Zod 4
- **State management**: React Context (solo AuthContext) + useState + custom hooks
- **PWA**: vite-plugin-pwa

## Comandi

```bash
# Sviluppo
npm run dev              # API + Client in parallelo (usa .env)
npm run dev:local        # Come dev ma su DB locale Docker (.env.local) — uso tipico in sviluppo
npm run dev:client       # Solo frontend (Vite)
npm run dev:api          # Solo backend (hot reload)

# Database
npm run db:build-schema  # Merge schema modulari → schema.generated.prisma
npm run db:generate      # Prisma generate client
npm run db:local:setup   # Avvia DB Docker + push schema + seed (setup completo locale)
npm run db:migrate       # Prisma migrate dev
npm run db:push          # Prisma db push (no migration)
npm run db:studio        # GUI database
npm run db:seed          # Seed players (utenti/lega test: scripts/init-production.ts)

# Test
npm run test             # Vitest watch mode
npm run test:all         # Esecuzione singola
npm run test:coverage    # Con coverage
npm run test:e2e         # Playwright

# Qualità
npm run lint             # ESLint
npm run lint:fix         # ESLint + autofix
npm run format           # Prettier

# Build & Deploy
npm run build            # Vite build frontend
npm run build:api        # esbuild → api/index.mjs
npm run deploy:main      # Backup + merge develop → main + push
```

### Dev server — gestione autonoma (Claude)

**Claude riavvia autonomamente il dev server quando serve, senza chiedere conferma** (es. dopo modifiche allo schema Prisma, o se l'API è caduta/non risponde). Azione a basso rischio e autorizzata in modo permanente.

- **Porte locali**: API `:3003` · client Vite `:5174` (la `5173` è occupata da un altro progetto, Vite non fa fallback) · DB Docker `fantacontratti-db` `:5433` (`.env.local`).
- **Avvio**: `npm run dev:local` fa partire l'API con `.env.local`; il client Vite va lanciato a parte: `npx vite --port 5174`.
- **Riavvio della sola API** (chirurgico): terminare il processo `tsx watch` in ascolto su `:3003` (incluso il parent tree) e rilanciare in background `bash scripts/with-env.sh .env.local npx tsx watch src/api/index.ts`, lasciando Vite intatto.
- **Client Prisma stale (#29)**: `tsx watch` NON ricarica `@prisma/client` rigenerato → dopo `db:generate`/modifiche schema, **riavviare il processo API** per evitare errori tipo "Unknown argument" da client in memoria vecchio.

## Architettura

```
src/
├── api/                  # Backend Express
│   ├── middleware/        # Auth, rate-limit, turnstile, sanitize
│   └── routes/           # ~15 file route (~261 endpoint totali)
├── components/           # Componenti React (per feature)
│   └── ui/               # Componenti UI riutilizzabili (Card, Button, etc.)
├── hooks/                # Custom React hooks (useAuth, useAuctionRoomState, etc.)
├── lib/                  # Librerie condivise
├── modules/              # Solo identity/ (isola DDD cablata: email, password-reset)
├── pages/                # ~34 pagine React
├── services/             # ~27 service file (business logic backend)
├── shared/               # Codice condiviso (domain, infrastructure, utils)
├── types/                # TypeScript types
└── utils/                # Utility (JWT, password, helpers)
```

### Architettura attiva

Il codice gira tutto sul layer **`src/services/` + `src/pages/` + `src/components/`** (più `src/api/routes/` per gli endpoint). È qui che va scritto il nuovo codice.

`src/modules/` conteneva un layer DDD sperimentale rimasto quasi tutto dead code: è stato rimosso (giugno 2026), resta solo `src/modules/identity/` — l'isola realmente cablata (email factory, user repository, bcrypt, use-case password-reset). Non reintrodurre moduli DDD senza un task esplicito.

## Convenzioni Codice

### TypeScript
- Strict mode
- Interfacce per props componenti (`interface XxxProps { ... }`)
- **NO `any`** — usare `unknown` se necessario (eccezioni: mock test con vi.mocked)
- Import: **usare `@/` aliases** per nuovo codice (non `../../../`)

### Componenti React
- 100% functional components + hooks
- Unico Context globale: AuthContext (non crearne altri)
- State locale: `useState` (pattern primario)
- Custom hooks grandi per state complesso (useAuctionRoomState, useRubataState, useSvincolatiState)
- `forwardRef` per componenti UI riutilizzabili (compound component pattern)
- **NO** useReducer, Redux, Zustand, Jotai

### API Calls
- **UNICO client**: `src/services/api.ts` con funzione `request<T>()`
- Oggetti domain-grouped: `tradeApi`, `leagueApi`, `auctionApi`, `contractApi`, etc.
- Risposta standardizzata: `ApiResponse<T>` con `{ success, message?, data?, errors? }`
- **MAI** fetch/axios diretto nei componenti

### Stili
- TailwindCSS inline (mobile-first: sm → md → lg)
- **NO** CSS modules, SCSS, styled-components
- `style={}` inline solo per valori dinamici (animazioni, chart, percentuali)
- Tema "Stadium Nights" definito in `src/index.css` con CSS Custom Properties
- ⚠️ Nota: le CSS vars e la palette Tailwind non sono ancora integrate — usare le classi Tailwind standard per nuovo codice

### Naming
| Dove | Convenzione | Esempio |
|------|-------------|---------|
| Pagine | PascalCase (no suffisso Page) | `Dashboard.tsx`, `Trades.tsx` |
| Componenti (file) | PascalCase | `Navigation.tsx` |
| Componenti (cartelle) | kebab-case | `auction-room/`, `trades/` |
| Services | kebab-case + `.service.ts` | `trade.service.ts` |
| Routes API | kebab-case | `contract-history.ts` |
| Hooks | camelCase + `use` prefix + `.ts` | `useRubataState.ts` |
| Types | kebab-case + `.types.ts` | `rubata.types.ts` |
| Utils | kebab-case | `db-retry.ts` |

### Lingua
- **Codice** (funzioni, variabili, interfacce): Inglese
- **Messaggi utente e errori**: Italiano
- **Concetti di dominio**: Italiano nei nomi (Rubata, Svincolati, Rose, Profezie)
- **Enum values**: Italiano (`OFFERTE_PRE_RINNOVO`, `ASTA_SVINCOLATI`)
- **Commenti**: Inglese preferito, Italiano accettabile

### Error Handling
- Route handlers: try/catch con `res.status(xxx).json({ success: false, message: '...' })`
- ServiceResult: **USARE il tipo condiviso** — NON ridichiararlo localmente
- `console.log` / `console.error`: **VIETATO nei service** — usare solo in dev/debug e rimuovere prima del commit

### Test
- Unit test: `src/__tests__/` o `tests/unit/`
- Integration test: `tests/integration/`
- E2E: `tests/e2e/` (Playwright, solo Chromium)
- Pattern: `describe('[Componente/Servizio]')` → `it('should [comportamento]')`
- Coverage target: 95% (configurato in vitest.config.ts)

## Commit Convention

```
feat|fix|refactor|docs|style|test(scope): messaggio breve
```

Esempi:
- `feat(rubata): add preference system for watchlist`
- `fix(contracts): correct spalma validation for duration=1`
- `refactor(services): extract shared ServiceResult type`

## Branching

- `main` — produzione
- `develop` — preview/staging
- `feature/1.x-*` — feature web
- `feature/2.x-*` — feature mobile

## Credenziali Test (seed locale via `scripts/init-production.ts`)

| Ruolo | Email | Password |
|-------|-------|----------|
| Super Admin | admin@fantacontratti.it | SuperAdmin2025! |
| Admin Lega | pietro@test.it | Pietro2025! |
| Manager | `<nome>@test.it` (michele, mirko, emmanuele, diego, marco, marcolino, emiliano) | `<Nome>2025!` |

Es. `michele@test.it` / `Michele2025!`. La lega "Fantacontratti Test" viene creata già pronta con tutti i membri.

## Database

Schema modulare in `prisma/schemas/` (16 file). Dopo modifiche:
```bash
npm run db:build-schema  # Merge → schema.generated.prisma
npm run db:generate      # Rigenera Prisma client
npm run db:push          # Applica al DB
```

**⚠️ MAI modificare `schema.generated.prisma` direttamente** — modificare i file in `prisma/schemas/`.

## File Business Logic Critici

Questi file contengono le regole di business core. **NON modificare senza conferma**:
- `src/services/contract.service.ts` — Contratti, clausole, rinnovi, spalma, consolidamento, KEEP/RELEASE esteri/retrocessi
- `src/services/rubata.service.ts` — Fase rubata
- `src/services/svincolati.service.ts` — Fase svincolati
- `src/services/auction.service.ts` — Motore asta (primo mercato, timer, reopen)
- `src/services/prize-phase.service.ts` — Fase premi e definizione indennizzi

> Nota: `indemnity-phase.service.ts` è stato svuotato (resta solo `autoReleaseRitiratiPlayers`); la logica indennizzi e KEEP/RELEASE vive ora in `contract.service.ts` (consolidamento) e `prize-phase.service.ts`.

## Problemi Noti (non introdurne di nuovi)

- Import path misti (`@/` vs `../`) → usare `@/` per nuovo codice
- Global error handler presente (`src/api/index.ts`) ma non sfruttato: i route handler usano try/catch locale invece di `next(err)`
- `auction-room/` (vecchia) e `auction-room-v2/` coesistono: la v2 è attiva (`AuctionRoomLayout`), ma `AuctionRoom.tsx` importa ancora 6 modali dalla vecchia → da consolidare

## Documenti di Riferimento

Gerarchia delle fonti di verità (in caso di conflitto, vince la fonte più in alto per il suo dominio):

- **Regole di gioco** → `docs/bibbie/` — **10 documenti** di regolamento ("Bibbie"). Ordine di lettura e dipendenze in `docs/bibbie/INDEX.md`.
- **Architettura, convenzioni, comandi** → questo file (`CLAUDE.md`).
- **Stato & roadmap** → `docs/PROJECT-STATUS.md` (stato consolidato) + `docs/COMPLETAMENTO-BACKLOG.md` (backlog per fase di gioco: cosa fatto/rinviato).
- **Storici** (solo reference, NON aggiornare) → `docs/SESSION-CONTEXT.md`, `docs/GAP-ANALYSIS-REPORT.md` (decisioni e gap fermi a febbraio 2026).
- **Archivio** (obsoleto) → `docs/archive/` (es. `fantacontratti-prompt-v2-final.md`, schema DB superato).
