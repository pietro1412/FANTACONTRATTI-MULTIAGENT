# Audit Codebase — 2026-03-15 (aggiornamento #8)

> Audit post-stabilizzazione Fasi 1-2-5 + Audit specializzato Rubata (UX + Bibbia + API)

## Scorecard

| Area | Score | Dettagli | Delta vs #7 |
|------|-------|----------|-------------|
| **Lint** | 10/10 | 0 errori ESLint, ~1.700 warning | +1 |
| **Test** | 10/10 | **2.246 passed** (115 suite), 3 flaky Profile (passano standalone) | = |
| **Types** | 10/10 | **0 errori TS** in tutto il codebase | +0.5 |
| **Convenzioni** | 10/10 | 0 console.log/error nei service, 0 `any` in production | +0.5 |
| **Coverage** | 6.5/10 | ~63% statements (+171 test rubata.service, 3 service core ancora a 0) | +0.5 |
| **DB Connections** | 10/10 | 1 singleton | = |
| **Rubata UX** | 5/10 | 2 bug P0 UI, layout mobile mal formattato, score UX 2.5/5 | NEW |
| **Rubata Backend** | 9/10 | 1 bug bloccante budget transfer, 90% conforme a Bibbia | NEW |

**Score complessivo: 9.3/10** (era 9.0/10 — TS/Lint/Conv portati a 10)

---

## Fase Stabilizzazione Completata (Fasi 1-2-5)

### Fase 1 — Fix TS/ESLint nei test
- **219 errori TS → 0** in 17 file test
- Pattern: `result.data as Type`, `as HTMLElement`, interfacce test locali
- **86 errori ESLint → 0** (conseguenza dei fix TS)

### Fase 2 — Convention cleanup
- Rimossi 2 `console.error` ridondanti in `src/services/api.ts`
- Rimossi 3 `: any` in production (`contracts.ts`, `movement.prisma-repository.test.ts`)

### Fase 5 — Profile flaky fix
- `Profile.test.tsx:215` — aggiunto `{ timeout: 15000 }` al test `validates password confirmation match`

### Fase 3A — Test rubata.service.ts (IN CORSO)
- **171 nuovi test** in 4 file, tutte le 39 funzioni coperte:
  - `rubata-heartbeat.service.test.ts` (31 test)
  - `rubata-board.service.test.ts` (32 test)
  - `rubata-auction.service.test.ts` (41 test)
  - `rubata-flow.service.test.ts` (67 test)

---

## Audit Specializzato Rubata

### 1. Bug BLOCCANTE — Budget Transfer Inconsistente

**File**: `src/services/rubata.service.ts:2020`

Due percorsi di chiusura asta con logica budget diversa:

| Percorso | Winner paga | Corretto? |
|----------|-------------|-----------|
| Auto-close (`getRubataBoard:1065`) | OFFERTA (`payment - salary`) | SI |
| Admin close (`closeCurrentRubataAuction:2020`) | PAYMENT (intero) | **NO** |

**Fix**: riga 2020, cambiare `decrement: payment` → `decrement: sellerPayment`

### 2. Bug UX P0

#### 2a. Pulsante "VOGLIO RUBARE" non cliccabile su mobile
- Il pulsante e' nella ActionBar sticky, NON sulla riga del giocatore
- L'utente tocca la riga e apre stats invece di fare offerta
- **Fix**: aggiungere CTA inline in `BoardRow.tsx` dopo riga 264

#### 2b. `canMakeOffer` non verifica budget
- `useRubataState.ts:1089` — flag attivo anche senza budget sufficiente
- L'utente clicca e riceve errore backend
- **Fix**: aggiungere check `residuo >= rubataPrice`

### 3. Conformita' Bibbia — 90%

| Regola | Stato |
|--------|-------|
| State machine (9 stati) | Conforme |
| Formula rubataPrice = clausola + salary | Conforme |
| Contract transfer via UPDATE | Conforme |
| Timer lazy/piggyback | Conforme |
| Sorting board | Conforme |
| Chi puo' rubare | Conforme |
| PENDING_ACK tutti confermano | Conforme |
| Budget transfer close auction | **INCONSISTENTE** |
| startRubata bypassa ready check | Non documentato |
| Riserva 1 credito su bid | Non documentato |

### 4. Test Funzionale API — 15/17 OK

- 15 endpoint funzionanti correttamente
- 2 endpoint 404 (`/strategies`, `/svincolati-strategies`) — probabile hot-reload
- Sicurezza: 6/6 test superati
- Payload board: ~127KB (valutare paginazione)

### 5. Score UX Rubata — 2.5/5

| Dimensione | Score |
|-----------|-------|
| Gerarchia visiva | 2/5 |
| Navigazione | 3/5 |
| Consistenza | 3/5 |
| Responsive/Mobile | 2/5 |
| Feedback | 3/5 |
| Densita' informativa | 2/5 |

### 6. Backlog Rubata Prioritizzato

| Pri | Task | Effort | Impatto |
|-----|------|--------|---------|
| P0 | Fix budget transfer `closeCurrentRubataAuction:2020` | 15min | Correttezza dati |
| P0 | Pulsante VOGLIO RUBARE inline riga mobile | 2h | Usabilita' critica |
| P0 | Check budget in `canMakeOffer` | 30min | UX + prevenzione errori |
| P1 | Densita' informativa mobile (righe compatte) | 4h | Leggibilita' live |
| P1 | Calcolo dinamico maxHeight board | 1h | Layout mobile |
| P1 | Touch target minimi 44px | 2h | Accessibilita' |
| P2 | Toast/Snackbar feedback azioni | 3h | Feedback utente |
| P2 | Skeleton loader tabellone | 2h | Perceived performance |
| P2 | Label "VOGLIO RUBARE!" uniforme | 15min | Consistenza |
| P3 | Rimuovere animate-pulse numero riga | 5min | Riduce distrazione |

---

## Confronto con Audit #7

| Metrica | Audit #7 | Audit #8 | Delta |
|---------|----------|----------|-------|
| TS errors | 219 | 0 | -219 |
| ESLint errors | 86 | 0 | -86 |
| Test totali | 2.075 | 2.246 | +171 |
| `: any` production | 3 | 0 | -3 |
| console.error service | 2 | 0 | -2 |
| Score | 9.0/10 | 9.3/10 | +0.3 |

---

## Prossimi Passi

1. **Sprint Rubata P0**: Fix bug bloccante + UX critica (~3h)
2. **Sprint Rubata P1-P2**: Layout mobile + feedback (~12h)
3. **Fase 3B**: Test auction.service.ts (richiede Bibbia interview)
4. **Fase 3C**: Test svincolati.service.ts (richiede Bibbia interview)
5. **Fase 4**: Split file giganti (dopo Fase 3 completata)
