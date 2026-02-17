# Audit Codebase — 2026-02-17

> Audit generato automaticamente con `/audit`. Nessun file modificato.

## Scorecard

| Area | Score | Dettagli |
|------|-------|----------|
| **Lint** | 2/10 | 4.379 errori, 570 warning (ESLint) |
| **Test** | 8/10 | 1.136 passed, 15 failed (2 file), 62/64 test suite verdi |
| **Types** | 3/10 | ~950 errori TS (strict mode), concentrati in 15 file |
| **Convenzioni** | 6/10 | ServiceResult x18, 89 console.log, 77 deep import, 12 `any` |
| **Coverage** | 7/10 | Non calcolabile per 2 test suite fallite, ma 1.136 test attivi |

**Score complessivo: 5.2/10**

---

## Step 1 — Qualita' Codice

### ESLint: 4.379 errori, 570 warning

681 errori auto-fixabili con `--fix`. Principali:
- `@typescript-eslint/no-unsafe-call` nei test (beforeAll non tipizzato)
- `@typescript-eslint/no-unused-vars` sparsi
- `vitest.integration.config.ts` non parsabile (manca `tsconfig.node.json`)

### Test: 1.136 passed, 15 failed

| File | Fail | Causa |
|------|------|-------|
| `tests/unit/formule-finanze.test.ts` | 13 | Test cercano stringhe/interfacce nel source code che sono state refactorate (es. `'Budget Iniziale'`, `interface FinancialsData`) |
| `tests/unit/formule-sprint5.test.ts` | 2 | Stessa causa — test leggono il file sorgente e cercano pattern non piu' presenti |

**Root cause**: questi test verificano la *struttura del codice sorgente* (string matching su file .tsx) anziche' il *comportamento*. Dopo il refactoring UI sono diventati fragili.

### TypeScript: ~950 errori (strict mode)

**Top 5 errori per tipo:**

| Codice | Count | Descrizione |
|--------|-------|-------------|
| TS18048 | 234 | `'x' is possibly 'undefined'` — null check mancanti |
| TS2345 | 192 | Argument type mismatch |
| TS2322 | 125 | Type assignment mismatch |
| TS2532 | 88 | Object possibly undefined |
| TS6133 | 64 | Declared but never read (unused vars) |

**Top 5 file per errori:**

| File | Errori | Note |
|------|--------|------|
| `src/pages/TestStrategyFormats.tsx` | 95 | File di test/debug, probabilmente da eliminare |
| `src/services/history.service.ts` | 49 | Query builder con `any` |
| `src/pages/AllPlayers.tsx` | 40 | Props/state typing |
| `src/services/rubata.service.ts` | 39 | Business logic complessa |
| `src/modules/svincolati/.../svincolati.routes.ts` | 38 | Routing types mismatch |

---

## Step 2 — Inconsistenze

### ServiceResult ridichiarato: 18 file

L'interfaccia `ServiceResult` e' copiata identica in 18 service file anziche' importata da un modulo condiviso.

**File coinvolti:** admin, auction, bot, contract, contract-history, feedback, history, indemnity-phase, invite, league, movement, objectives, prize-phase, rubata, superadmin, svincolati, trade, user.

**Fix**: creare `src/shared/types/service-result.ts` e sostituire tutte le dichiarazioni con un import.

### console.log/error nei services: 89 occorrenze in 16 file

| Service | Count |
|---------|-------|
| api-football.service.ts | 16 |
| bot.service.ts | 14 |
| pusher.service.ts | 13 |
| auction.service.ts | 10 |
| league.service.ts | 9 |
| Altri (11 file) | 27 |

**Fix**: sostituire con logger strutturato (es. pino/winston) o rimuovere.

### Import path relativi profondi: 77 occorrenze in 37 file

Concentrati quasi interamente in `src/modules/*/application/use-cases/` dove la struttura DDD crea nesting profondo (4+ livelli).

**Fix**: configurare alias `@modules/`, `@shared/` in tsconfig.json.

### Uso di `any`: 12 occorrenze in 3 file

| File | Count | Contesto |
|------|-------|----------|
| `movement.service.ts` | 1 | Query builder dinamico |
| `history.service.ts` | 3 | Query builder dinamico |
| `auction.prisma-repository.test.ts` | 8 | Mock Prisma nei test |

**Rischio basso** — quasi tutti in query builder o test mock.

### TODO/FIXME: 4 in 2 file

- `trade.service.ts`: 3 TODO su codice commentato post-Prisma generate
- `svincolati/.../get-svincolati-state.use-case.ts`: 1 TODO integrazione asta

### Empty catch blocks: 0

Nessun catch vuoto trovato.

---

## Step 3 — Coverage

Non calcolabile in questa sessione: le 2 test suite fallite (`formule-finanze.test.ts`, `formule-sprint5.test.ts`) impediscono il report coverage completo. Target configurato: 95%.

**Stima**: con 1.136 test attivi su 64 suite (62 verdi), la coverage effettiva e' alta sulle aree coperte ma potrebbe avere gap nei moduli DDD (`src/modules/`).

---

## Step 4 — Top 10 Issue per Priorita'

| # | Priorita' | Issue | Impatto | Fix stimato |
|---|-----------|-------|---------|-------------|
| 1 | **P0** | 15 test falliti (2 suite) | CI rotta, coverage non calcolabile | Riscrivere test per verificare comportamento, non struttura codice |
| 2 | **P0** | `tsconfig.node.json` mancante | `vitest.integration.config.ts` non parsabile, lint error | Creare il file o aggiornare il riferimento |
| 3 | **P1** | ~950 errori TypeScript strict | Type safety compromessa, possibili runtime error | Prioritizzare i 5 file peggiori (vedi tabella sopra) |
| 4 | **P1** | ServiceResult x18 file | Manutenzione difficile, rischio drift tra definizioni | Estrarre tipo condiviso, find-replace in 18 file |
| 5 | **P1** | `TestStrategyFormats.tsx` (95 errori TS) | File debug/test in src/pages, non dovrebbe esistere | Eliminare o spostare fuori da src/ |
| 6 | **P2** | 89 console.log/error nei services | Log non strutturati, rumore in produzione | Sostituire con logger o rimuovere |
| 7 | **P2** | 77 deep relative imports | Leggibilita' ridotta, refactoring fragile | Configurare alias @modules/ @shared/ |
| 8 | **P2** | 4.379 errori ESLint | Qualita' codice, 681 auto-fixabili | Eseguire `npm run lint:fix`, poi fix manuali |
| 9 | **P3** | 12 `: any` in production code | Type safety locale | Tipizzare query builder con Prisma types |
| 10 | **P3** | 3 TODO in trade.service.ts | Codice commentato da attivare post-Prisma generate | Verificare se Prisma e' stato rigenerato e rimuovere TODO |

---

## Suggerimenti per il Prossimo Sprint

### Sprint Quick Win (1-2 giorni)
1. Fixare i 15 test falliti (riscrivere come test comportamentali)
2. Eliminare `TestStrategyFormats.tsx`
3. Eseguire `npm run lint:fix` (681 errori auto-fix)
4. Creare `tsconfig.node.json` mancante
5. Estrarre `ServiceResult` in tipo condiviso

### Sprint Consolidamento (3-5 giorni)
6. Risolvere i top 5 file con errori TypeScript
7. Rimuovere/sostituire console.log nei services
8. Configurare alias import per modules/
9. Risolvere i 3 TODO in trade.service.ts
10. Raggiungere 0 errori su `npx tsc --noEmit`

---

## Confronto con Audit Precedente

Nessun audit precedente trovato in `docs/AUDIT.md`. Questo e' il **baseline audit** — i prossimi audit confronteranno i progressi rispetto a questi numeri.

| Metrica | Baseline (17/02/2026) |
|---------|----------------------|
| ESLint errori | 4.379 |
| ESLint warning | 570 |
| Test passed | 1.136 |
| Test failed | 15 |
| TS errori (strict) | ~950 |
| ServiceResult duplicati | 18 |
| console.log/error | 89 |
| Deep imports | 77 |
| `: any` | 12 |
| TODO/FIXME | 4 |
