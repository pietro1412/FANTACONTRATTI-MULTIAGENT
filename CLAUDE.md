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
npm run dev              # API + Client in parallelo
npm run dev:client       # Solo frontend
npm run dev:api          # Solo backend (hot reload)

# Database
npm run db:build-schema  # Merge schema modulari → schema.generated.prisma
npm run db:generate      # Prisma generate client
npm run db:migrate       # Prisma migrate dev
npm run db:push          # Prisma db push (no migration)
npm run db:studio        # GUI database
npm run db:seed          # Seed dati test

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
├── modules/              # 🆕 Domain-driven modules (nuovo layer)
│   ├── admin, auction, identity, league, movement,
│   ├── prize, roster, rubata, svincolati, trade
├── pages/                # 36 pagine React
├── services/             # 29 service file (business logic backend)
├── shared/               # Codice condiviso (domain, infrastructure, utils)
├── types/                # TypeScript types
└── utils/                # Utility (JWT, password, helpers)
```

### Due layer coesistenti

Il progetto ha due architetture che coesistono:
- **Vecchio**: `src/services/` + `src/pages/` + `src/components/` (la maggior parte del codice)
- **Nuovo**: `src/modules/` (DDD, il target per nuovo codice)

**Regola**: il nuovo codice va in `src/modules/` quando possibile. Non spostare codice vecchio senza un task esplicito di migrazione.

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

## Credenziali Test (seed locale)

| Ruolo | Email | Password |
|-------|-------|----------|
| Super Admin | admin@fantacontratti.it | SuperAdmin2025! |
| Admin Lega | pietro@test.it | Pietro2025! |
| Manager 1-7 | manager[1-7]@test.it | Manager[1-7]2025! |

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
- `src/services/contract.service.ts` — Contratti, clausole, rinnovi, spalma
- `src/services/rubata.service.ts` — Fase rubata (39 funzioni)
- `src/services/svincolati.service.ts` — Fase svincolati (31 funzioni)
- `src/services/auction.service.ts` — Motore asta (47 funzioni)
- `src/services/indemnity-phase.service.ts` — Fase indennizzi
- `src/services/prize-phase.service.ts` — Fase premi

## Problemi Noti (non introdurne di nuovi)

- `ServiceResult` ridichiarata in 18 file → da consolidare in un tipo condiviso
- Import path misti (`@/` vs `../`) → usare `@/` per nuovo codice
- Global error handler non utilizzato (route handlers non chiamano `next(err)`)
- ~36 `console.log` residui nei services → da rimuovere
- `auction-room/` e `auction-room-v2/` coesistono → v2 è quella attiva
- Nessun ErrorBoundary React
- Nessuna logging library strutturata

## Documenti di Riferimento

- `docs/bibbie/` — 11 documenti di regolamento ("Bibbie")
- `docs/SESSION-CONTEXT.md` — Contesto sessioni precedenti con decisioni prese
- `fantacontratti-prompt-v2-final.md` — Prompt originale (riferimento storico, schema DB obsoleto)
