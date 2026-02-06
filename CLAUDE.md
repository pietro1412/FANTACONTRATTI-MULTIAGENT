# CLAUDE.md - Fantacontratti

## Roadmap Stabilizzazione (PREREQUISITO)

**PRIMA di sviluppare nuove evolutive**, completare il piano in [`docs/ROADMAP-STABILIZZAZIONE.md`](docs/ROADMAP-STABILIZZAZIONE.md).

Priorita:
1. **P1 - Performance DB**: PrismaClient singleton, indici, N+1 fix, polling reduction, cache
2. **P2 - Bug critici**: Clausola rescissoria 1→3, recordMovement tx, formula rinnovo, budget race condition
3. **P3 - Strutturali**: Split componenti giganti, bundle optimization, standardizzazione error states
4. **P4 - Branch**: Risolvere branch strategy sovrapposti, merge/abbandono feature pendenti

Quick win (step 1-5 del piano): ~5h per 80% miglioramento performance.

## Quick Reference

```bash
npm run dev          # Frontend :5173 + API :3003
npm run verify       # lint + typecheck + test (pre-PR)
npm run build        # Vite production build
npm run db:build-schema  # Merge split prisma schemas
npm run db:rebuild   # build-schema + db:push
npm run db:studio    # Prisma Studio GUI
```

## Architettura

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Express 5 (serverless su Vercel)
- **DB**: Neon PostgreSQL, Prisma ORM
- **Real-time**: Pusher (WebSocket events + adaptive polling)
- **Email**: Resend
- **Deploy**: Vercel (`vercel-build` = prisma generate + db push + build-api + vite build)
- **Schema**: Split in `prisma/schemas/*.prisma`, merged con `npm run db:build-schema` in `prisma/schema.generated.prisma`

### Domini e Bibbie

Ogni dominio ha una "Bibbia" (`docs/bibbie/`) = fonte di verita.
**LEGGERE la Bibbia corrispondente PRIMA di modificare logica di dominio.**

| Dominio | Bibbia | Servizi chiave | Schema Prisma |
|---------|--------|----------------|---------------|
| Contratti & Budget | `docs/bibbie/CONTRATTI.md` | contract.service | roster.prisma |
| Rubata | `docs/bibbie/RUBATA.md` | rubata.service | rubata.prisma, auction.prisma |
| Movimenti | (in CONTRATTI) | movement.service | movement.prisma |

### Regole Business Critiche

- **Rinnovo**: aumenta monte ingaggi, NON decrementa budget
- **Taglio**: `ceil(salary * duration / 2)`
- **Clausola rescissoria**: `{4:11, 3:9, 2:7, 1:3}` moltiplicatori
- **initialSalary**: MAI modificato dopo creazione contratto
- **recordMovement**: singolo oggetto `{leagueId, marketSessionId, playerId, fromMemberId, toMemberId, movementType, price}`
- **Rubata timer**: lazy/piggyback (no server timer, chiusura inside `getRubataBoard()` al polling)
- **Rubata trasferimento**: aggiorna record contratto/roster esistente, NON ricrea
- **ESTERO/RETROCESSO release**: serve BOTH `draftReleased: true` AND `draftExitDecision: 'RELEASE'`

## Branching & Workflow

| Branch | Scopo | Deploy |
|--------|-------|--------|
| `master` | Produzione stabile | Vercel Production |
| `develop` | Integrazione feature | Vercel Preview |
| `feature/1.x-*` | Web feature | - |
| `feature/2.x-*` | Mobile feature | - |

### Workflow Feature

1. Issue su GitHub -> Project EVOLUTIVE -> **Backlog**
2. Attivazione: branch da `develop`, spostare in **In Progress**
3. Sviluppo con commit convenzionali
4. `npm run verify` prima di PR
5. PR verso `develop` con checklist
6. Review + merge -> test su Preview
7. `develop` -> `master` per rilascio

### Convenzioni Commit

- `feat:` nuova funzionalita
- `fix:` bug fix
- `refactor:` refactoring
- `test:` test
- `docs:` documentazione
- `chore:` maintenance

### GitHub Project: EVOLUTIVE

| Colonna | Descrizione |
|---------|-------------|
| Backlog | Evolutive proposte, in attesa di priorita |
| Todo | Evolutive approvate, pronte per sviluppo |
| In Progress | Evolutive in lavorazione |
| Done | Evolutive completate |

**Labels**: `1.x-web`, `2.x-mobile`, `enhancement`, `bug`

## Testing

```bash
npm run test           # Vitest (watch mode)
npm run verify         # lint + typecheck + test run
npm run test:coverage  # Con coverage report
npm run test:e2e       # Playwright E2E
```

- Pre-existing failures: Navigation.test.tsx (issue #239)
- OGNI feature DEVE avere test unitari per la logica di servizio
- Copertura target: 80% su file modificati
- **TDD per bug fix e logica business**: scrivere il test che fallisce PRIMA di scrivere il fix
- **Refactor puri** (import, indici, select, polling): test esistenti sufficienti
- **Frontend e flussi E2E**: da coprire con Playwright (approccio da definire)

## CI/CD

- **PR validation**: lint + typecheck + test + build (GitHub Actions)
- **Pre-commit**: lint-staged (eslint + prettier su file staged)
- **Branch protection**: develop e master richiedono PR validation

## Struttura Progetto

```
src/
  api/
    routes/          # Express route handlers
    middleware/       # Auth, error handling
  services/          # Business logic (contract, rubata, auction, movement, ...)
  modules/           # Clean Architecture modules (admin, chat, league, ...)
  components/        # React components
  pages/             # React pages
  hooks/             # React custom hooks
  lib/               # Utilities, API client
  types/             # TypeScript types
prisma/
  schemas/           # Split schema files (*.prisma)
  schema.generated.prisma  # Merged schema (auto-generated)
scripts/
  build-api.mjs      # API build script
  build-schema.ts    # Schema merge script
  archive/           # One-off scripts (analyze, debug, check)
  db/                # Database scripts (seed, backup, restore)
  ops/               # Operational scripts (fix, reset, setup)
  test/              # Test/validation scripts
docs/
  bibbie/            # Fonti di verita per regole di dominio
  architecture/      # Docs tecnici
  guides/            # Guide operative
  archive/           # Docs datati/business
  sprint-briefs/     # Sprint briefs
  milestones/        # Milestone reports
```

## Multi-Agent Guidelines

Quando lavori con sub-agent, rispetta i confini di dominio:

### Stream Paralleli Sicuri

| Stream | Dominio | Parallelizzabile |
|--------|---------|-----------------|
| A | Analytics, Watchlist, Seasonality | INDIPENDENTE |
| B | Chat, Notifiche, Feedback | INDIPENDENTE |
| C | Admin, League Management | INDIPENDENTE |
| D | UI/UX, Frontend Components | INDIPENDENTE |
| E | Core Business (contract, auction, rubata, movement) | SEQUENZIALE - supervisione umana |

### Regole

- **Stream E** (core) va fatto nella sessione principale con supervisione
- **NON modificare** servizi hub (movement, contract) senza coordinamento
- Ogni agente lavora su UN dominio alla volta
- **Leggere la Bibbia** del dominio PRIMA di iniziare
- **`npm run verify`** DOPO ogni modifica
- Usare `Plan Mode` per ogni feature non-triviale

## Credenziali Test (Locale)

### Super Admin
- Email: `superadmin` / Password: `Password123!`

### Admin Lega
- Email: `pietro1412@gmail.com` / Password: `M0ntemilett0!`

### Manager Lega
| Email | Password | Team |
|-------|----------|------|
| mario@test.com | test123 | FC Mario |
| luigi@test.com | test123 | AC Luigi |
| peach@test.com | test123 | AS Peach |
| toad@test.com | test123 | US Toad |
| yoshi@test.com | test123 | SS Yoshi |
| bowser@test.com | test123 | Inter Bowser |
| wario@test.com | test123 | Juventus Wario |
