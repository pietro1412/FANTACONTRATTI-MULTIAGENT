# SESSION-CONTEXT.md

> Contesto persistente per sessioni Claude Code successive.
> Ultimo aggiornamento: 2026-02-06

---

## 1. STATO SPRINT STABILIZZAZIONE

Branch: `fix/sprint-1-formule-critiche` (da `develop`)

| Sprint | Commit | Stato | Issue risolte | Test |
|--------|--------|-------|---------------|------|
| 1 | `0b96aae` | DONE | P0-1, P0-2, P0-4, P0-5, P0-6, P2-1 | 15 |
| 2 | `9198800` | DONE | P0-3, P0-8 | 7 |
| 3 | `54078c4` | DONE | P0-7, P0-9, P0-10 | 15 |
| 4 | `b900783` | DONE | P1-1 a P1-7 | 20 |
| 5 | — | TODO | M-1 a M-15 (feature mancanti) | — |

**Totale: 57 test strutturali, tutti verdi. 10 file modificati, +1367/-92 righe.**

### Dettaglio per sprint

#### Sprint 1 — Fix Formule Critiche
- **P0-1**: `duration = 2` → `duration = 3` in 4 punti di `auction.service.ts`
- **P0-2**: `Math.round(rawSalary * 2) / 2` → `calculateDefaultSalary()` (intero, min 1)
- **P0-4**: Moltiplicatore `1:3` gia corretto (fix precedente `a788df0`)
- **P0-5**: Rimossa `calculateRescissionClause` locale SBAGLIATA in `routes/contracts.ts`
- **P0-6**: `Math.round(salary * duration * 2)` → `calculateRescissionClause()` in `auction.service.ts`
- **P2-1**: Fix formule in `svincolati.service.ts` (salary + rescission)

#### Sprint 2 — Fix Critici Finanziari
- **P0-3**: Rimosso decremento budget da `renewContract` (rinnovo tocca solo monte ingaggi)
- **P0-8**: Pagamento venditore rubata: da `payment` (intero) a `sellerPayment = payment - contractSalary` (solo OFFERTA)

#### Sprint 3 — Rubata + Consolidamento
- **P0-7**: PENDING_ACK gia corretto (usa `acknowledgedMembers`, non `auction.status`)
- **P0-9**: Aggiunto consolidation guard a `renewContract` e `releasePlayer`
- **P0-10**: Schema `preConsolidation*` gia presente in Prisma

#### Sprint 4 — Validazioni P1
- **P1-1/P1-2**: Budget check ora usa bilancio (`budget - monteIngaggi`) in auction, svincolati, rubata
- **P1-3**: `advanceSvincolatiToNextTurn` salta `finishedMembers` oltre a `passedMembers`
- **P1-4**: Rubata auto-advance da OFFERING va a `READY_CHECK` (non direttamente a OFFERING)
- **P1-5**: Gia corretto — `modifyContractPostAcquisition` blocca spalma
- **P1-6**: `nominateFreeAgent` controlla `bilancio >= 2` (non `currentBudget < 1`)
- **P1-7**: Gia corretto — `Contracts.tsx` residuo include `totalIndemnities`
- **Skippato**: `completeRubataWithTransactions` auto-bot budget (troppo invasivo, solo path admin)

---

## 2. DECISIONI PRESE

### Contraddizioni Bibbie (risolte 2026-02-06)

Le 3 contraddizioni apparenti si risolvono distinguendo **Budget** (cash DB: `currentBudget`) da **Bilancio** (`Budget - Monte Ingaggi`):

| # | Contraddizione | Decisione | Motivazione |
|---|---------------|-----------|-------------|
| **C-1** | Venditore rubata riceve "solo OFFERTA" vs "prezzo intero" | **Prezzo intero a bilancio** | OFFERTA va a budget, risparmio ingaggio va a monte ingaggi. L'effetto netto su bilancio e il prezzo intero. |
| **C-2** | Budget -= "solo prezzo asta" vs "prezzo + ingaggio" | **Prezzo + ingaggio a bilancio** | Budget -= solo prezzo asta (OFFERTA). Monte ingaggi += ingaggio. L'impatto su bilancio e la somma. |
| **C-3** | Verifica usa "bilancio" vs "currentBudget" | **Bilancio** | Tutte le verifiche pre-operazione usano `bilancio = budget - monteIngaggi`. |

### Modello finanziario confermato

```
Budget (currentBudget)     = cash disponibile (solo OFFERTA entra/esce)
Monte Ingaggi              = SUM(salary) dei contratti attivi
Bilancio                   = Budget - Monte Ingaggi (calcolato on-the-fly)

Verifica pre-bid:          bilancio >= offerta + ingaggio_default
Rinnovo:                   solo monte ingaggi (NO decremento budget)
Rubata venditore:          budget += OFFERTA (clausola + rilanci - ingaggio)
Rubata acquirente:         budget -= OFFERTA, monte ingaggi += nuovo ingaggio
```

---

## 3. FILE MODIFICATI (Sprint 1-4)

| File | Sprint | Tipo modifica |
|------|--------|---------------|
| `src/services/contract.service.ts` | 1, 2, 3 | Aggiunto `calculateDefaultSalary`, rimosso budget decrement renewal, consolidation guard |
| `src/services/auction.service.ts` | 1, 4 | Fix duration/salary/rescission in 4 punti, bilancio check |
| `src/services/svincolati.service.ts` | 1, 4 | Fix salary/rescission, bilancio check, finishedMembers skip, nomination threshold |
| `src/services/rubata.service.ts` | 2, 4 | Seller payment OFFERTA, bilancio check in 5 funzioni, OFFERING→READY_CHECK |
| `src/api/routes/contracts.ts` | 1 | Rimossa funzione locale errata, usa import da contract.service |
| `docs/GAP-ANALYSIS-REPORT.md` | 3 | Aggiornato changelog |
| `tests/unit/formule-sprint{1-4}.test.ts` | 1-4 | 57 test strutturali |

---

## 4. FORMULE DI RIFERIMENTO

```typescript
// Ingaggio default (intero, minimo 1)
calculateDefaultSalary(auctionPrice: number): number {
  return Math.max(1, Math.round(auctionPrice / 10))
}

// Clausola rescissoria (moltiplicatori per durata semestri)
DURATION_MULTIPLIERS = { 4: 11, 3: 9, 2: 7, 1: 3 }
calculateRescissionClause(salary: number, duration: number): number {
  return salary * (DURATION_MULTIPLIERS[duration] ?? 3)
}

// Durata default primo mercato
duration = 3  // semestri (NON 2)
```

---

## 5. TEST PRE-ESISTENTI ROTTI (non causati da noi)

| File | Failures | Causa | Issue |
|------|----------|-------|-------|
| `src/components/__tests__/Navigation.test.tsx` | 8 | UI mismatch post-refactor | #239 |
| `src/components/__tests__/LayoutF.test.tsx` | 1 | Layout component mismatch | correlata a #239 |

Full suite: 1097/1106 passed (9 pre-existing failures).

---

## 6. PROSSIMI PASSI

### Immediati (in ordine)
1. ~~Creare `docs/SESSION-CONTEXT.md`~~ (questo file)
2. **PR sprint 1-4** verso `develop`
3. **Setup ambiente locale**: Docker + PostgreSQL + `.env.test` + seed
4. **Test API/service** con DB locale reale (vitest + Prisma)
5. **Test E2E Playwright** flussi critici

### Da decidere
- **Sprint 5** (M-1 a M-15 feature mancanti) — prima o dopo i test?
- **Evolutive tracciate** nel project EVOLUTIVE su GitHub — quando iniziare?
- Suggerimento: completare test sprint 1-4 → Sprint 5 → test Sprint 5 → evolutive

---

## 7. AMBIENTE

### Attuale
- **DB**: Neon PostgreSQL remoto (`.env` punta a `ep-patient-frost-...neon.tech`)
- **Dev**: `npm run dev` (Vite + Express via concurrently)
- **Test**: Vitest (jsdom) — solo test strutturali e FE component
- **E2E**: Playwright configurato, 1 test base (`home.spec.ts`)
- **Docker**: Installato v28.4.0, Desktop NON avviato
- **PostgreSQL locale**: NON installato

### Necessario per test completi
- Docker Desktop avviato
- `docker-compose.yml` con PostgreSQL locale (porta 5433 per non conflitto)
- `.env.test` con `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/fantacontratti_test`
- `db:push` + `db:seed` su DB locale
- Vitest config per test API/integration (environment: node, non jsdom)
- Playwright E2E su dev server con DB locale

---

## 8. STACK TECNOLOGICO

| Layer | Tecnologia |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Backend | Express 5 + TypeScript (tsx) |
| ORM | Prisma 5 |
| DB | PostgreSQL (Neon in prod) |
| Realtime | Pusher |
| Deploy | Vercel |
| Test Unit | Vitest 4 |
| Test E2E | Playwright |
| Auth | JWT (access + refresh) |

---

## 9. CREDENZIALI TEST

Vedi `CLAUDE.md` per utenti test (superadmin, admin lega, 7 manager).

---

## 10. RIFERIMENTI

| Doc | Contenuto |
|-----|-----------|
| `CLAUDE.md` | Istruzioni progetto, branching, credenziali |
| `docs/GAP-ANALYSIS-REPORT.md` | Report completo bug e feature mancanti |
| `docs/bibbie/FINANZE.md` | Modello finanziario (Budget/Monte Ingaggi/Bilancio) |
| `docs/bibbie/CONTRATTI.md` | Regole contrattuali |
| `docs/bibbie/PRIMO-MERCATO.md` | Asta primo mercato |
| `docs/bibbie/SVINCOLATI.md` | Asta svincolati |
| `docs/bibbie/RUBATA.md` | Fase rubata |
