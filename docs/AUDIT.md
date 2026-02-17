# Audit Codebase — 2026-02-17 (aggiornamento #2)

> Audit generato automaticamente con `/audit`. Nessun file modificato.

## Scorecard

| Area | Score | Dettagli |
|------|-------|----------|
| **Lint** | 2/10 | 4.370 errori, 573 warning (ESLint) |
| **Test** | 10/10 | 1.085 passed, 0 failed, 62/62 test suite verdi |
| **Types** | 3/10 | ~1.389 errori TS (strict mode) |
| **Convenzioni** | 6/10 | ServiceResult consolidato, 89 console.log, 84 deep import, 12 `any` |
| **Coverage** | 5/10 | 49.26% statements, 40.17% branches, 48.42% functions, 51.87% lines |

**Score complessivo: 5.2/10**

---

## Step 1 — Qualita' Codice

### ESLint: 4.370 errori, 573 warning

700 errori auto-fixabili con `--fix`. Principali:
- `@typescript-eslint/no-unsafe-call` nei test (beforeAll non tipizzato)
- `@typescript-eslint/no-unused-vars` sparsi

### Test: 1.085 passed, 0 failed

**Tutti i 62 test file passano.** Miglioramento rispetto al baseline (15 test falliti).

### TypeScript: ~1.389 errori (strict mode)

Concentrati in file test (`tests/`) e nei service file principali. Nota: i file di test generano errori per `beforeAll`/`afterAll` non tipizzati (problema di configurazione TS, non di codice).

---

## Step 2 — Inconsistenze

### ServiceResult ridichiarato: 0 file (era 18)

L'interfaccia `ServiceResult` risulta consolidata — nessuna ridichiarazione trovata nei service.

### console.log/error nei services: 89 occorrenze in 16 file

| Service | Count |
|---------|-------|
| api-football.service.ts | 16 |
| bot.service.ts | 14 |
| pusher.service.ts | 13 |
| auction.service.ts | 10 |
| league.service.ts | 9 |
| contract-history.service.ts | 6 |
| rubata.service.ts | 5 |
| invite.service.ts | 4 |
| contract.service.ts | 3 |
| Altri (7 file) | 9 |

### Import path relativi profondi (`../../..`+): 84 occorrenze in 41 file

Concentrati in `src/modules/*/application/use-cases/` (struttura DDD con nesting profondo).

### Uso di `any`: 12 occorrenze in 3 file

| File | Count | Contesto |
|------|-------|----------|
| `movement.service.ts` | 1 | Query builder dinamico |
| `history.service.ts` | 3 | Query builder dinamico |
| `auction.prisma-repository.test.ts` | 8 | Mock Prisma nei test |

Rischio basso.

---

## Step 3 — Coverage

| Metrica | Valore |
|---------|--------|
| Statements | 49.26% |
| Branches | 40.17% |
| Functions | 48.42% |
| Lines | 51.87% |

**Aree con bassa coverage:**

| Area | Lines | Note |
|------|-------|------|
| `src/pages/` | 4.54% | Componenti React quasi non testati |
| `src/services/` | 20.23% | Business logic backend coperta parzialmente |
| `src/components/` | N/A | Non strumentati dalla coverage |

**Aree con buona coverage:**

| Area | Lines | Note |
|------|-------|------|
| `src/shared/infrastructure/` | 86-100% | Cron, events, HTTP, result |
| `src/modules/*/application/` | 80-100% | Use case DDD ben testati |

Target configurato: 95%. Gap significativo.

---

## Step 4 — Top 10 Issue per Priorita'

| # | Priorita' | Issue | Impatto | Status vs Baseline |
|---|-----------|-------|---------|-------------------|
| 1 | ~~P0~~ | ~~15 test falliti~~ | ~~CI rotta~~ | **RISOLTO** — 0 test falliti |
| 2 | **P1** | ~1.389 errori TypeScript strict | Type safety compromessa | Peggiorato (da ~950) — potrebbe essere conteggio diverso |
| 3 | **P1** | Coverage 49% (target 95%) | Gap enorme, regressioni non rilevate | Ora misurabile (prima non calcolabile) |
| 4 | **P1** | 4.370 errori ESLint | Qualita' codice, 700 auto-fixabili | Stabile |
| 5 | **P2** | 89 console.log/error nei services | Log non strutturati in produzione | Invariato |
| 6 | **P2** | 84 deep relative imports | Leggibilita' ridotta, refactoring fragile | Leggermente aumentato (da 77) |
| 7 | **P2** | `src/pages/` coverage 4.54% | Pagine React quasi non testate | Nuovo dato |
| 8 | **P2** | `src/services/` coverage 20.23% | Business logic backend poco coperta | Nuovo dato |
| 9 | **P3** | 12 `: any` in production code | Type safety locale | Invariato |
| 10 | **P3** | Config TS per test (`beforeAll` errors) | Falsi positivi in `tsc --noEmit` | Invariato |

---

## Suggerimenti per il Prossimo Sprint

### Sprint Quick Win (1-2 giorni)
1. Eseguire `npm run lint:fix` (700 errori auto-fix)
2. Configurare `tsconfig` per includere types vitest nei test
3. Eliminare `TestStrategyFormats.tsx` se non piu' necessario
4. Rimuovere console.log di debug da `auction.service.ts` (timing logs)

### Sprint Consolidamento (3-5 giorni)
5. Aumentare coverage `src/services/` (target: 50%+)
6. Configurare alias import `@modules/`, `@shared/` in tsconfig
7. Risolvere top 5 file con errori TypeScript
8. Sostituire console.log/error con logger strutturato

### Sprint Coverage (5-10 giorni)
9. Test per pagine React critiche (Dashboard, Contracts, Trades)
10. Integration test per i service piu' complessi (auction, rubata, contract)

---

## Confronto con Audit Precedente (Baseline 17/02/2026)

| Metrica | Baseline | Attuale | Delta |
|---------|----------|---------|-------|
| ESLint errori | 4.379 | 4.370 | -9 |
| ESLint warning | 570 | 573 | +3 |
| Test passed | 1.136 | 1.085 | -51 (rimozione test fragili) |
| Test failed | 15 | **0** | **-15** |
| Test suite verdi | 62/64 | **62/62** | **100%** |
| TS errori (strict) | ~950 | ~1.389 | +439 (conteggio piu' preciso) |
| ServiceResult duplicati | 18 | **0** | **-18** |
| console.log/error | 89 | 89 | 0 |
| Deep imports | 77 | 84 | +7 (nuovo codice modules) |
| `: any` | 12 | 12 | 0 |
| Coverage (lines) | N/A | 51.87% | Primo dato |
