# GAP ANALYSIS REPORT - Bibbie vs Codice

> Analisi sistematica delle discrepanze tra le 5 Bibbie di dominio e il codice effettivo.
> Data: 2026-02-06 | Branch: develop

---

## RIEPILOGO ESECUTIVO

| Severita | Conteggio | Descrizione |
|----------|-----------|-------------|
| **P0 - CRITICO** | 10 | Bug che corrompono dati finanziari o contrattuali |
| **P1 - ALTO** | 7 | Bug che permettono operazioni non valide |
| **P2 - MEDIO** | 6 | Comportamenti diversi con impatto limitato |
| **MANCANTI** | 15 | Funzionalita descritte nelle Bibbie ma non implementate |
| **TOTALE** | 38 | |

---

## P0 - BUG CRITICI (corrompono dati)

### P0-1: Durata default contratto primo mercato = 2 invece di 3

**Bibbia**: CONTRATTI.md sez. 3.3 e PRIMO-MERCATO.md sez. 3.1
> `durata_default = 3` (sempre 3 semestri)

**Codice**: `auction.service.ts` righe 668, 1008, 1458, 4858
```typescript
const duration = 2  // SBAGLIATO: dovrebbe essere 3
```

**Impatto**: TUTTI i contratti del primo mercato vengono creati con durata 2 invece di 3. Effetto a cascata su clausole rescissorie, decrementi, scadenze.

---

### P0-2: Formula ingaggio default primo mercato con arrotondamento a 0.5

**Bibbia**: CONTRATTI.md sez. 3.1
> `ingaggio_default = Math.max(1, Math.round(costo_asta / 10))` — arrotondamento intero

**Codice**: `auction.service.ts` righe 1006-1007, 1456-1457, 4856-4857
```typescript
const salary = Math.max(1, Math.round(rawSalary * 2) / 2)  // arrotonda a 0.5
```

**Impatto**: Genera ingaggi frazionari (3.5, 7.5, etc.) che violano il vincolo "Intero, >= 1". Solo la riga 667 (`closeAuctionSession`) usa la formula corretta.

**Nota**: Svincolati usa `Math.ceil(price * 0.1)` — diverso dalla Bibbia ma almeno produce interi. Per prezzo=14: Bibbia=1, svincolati=2, primo mercato=1.5.

---

### P0-3: Rinnovo contratto DECREMENTA il budget (DEVE essere invariato)

**Bibbia**: CONTRATTI.md sez. 5.1 e 7.2, FINANZE.md sez. 6
> "Il rinnovo NON scala il budget — regola FONDAMENTALE"

**Codice**: `contract.service.ts` righe 516-526 (`renewContract`)
```typescript
const renewalCost = Math.max(0, newValue - currentValue)
await prisma.leagueMember.update({
  data: { currentBudget: { decrement: renewalCost } }  // SBAGLIATO
})
```

**Impatto**: Ogni manager che rinnova paga due volte: una dal budget (errato) e una dal monte ingaggi (corretto). Presente anche nel consolidamento (riga 930-936) con formula diversa (`salaryDiff` vs `valueDiff`).

---

### P0-4: Moltiplicatore clausola rescissoria durata 1 = 4 nel modulo domain (deve essere 3)

**Bibbia**: CONTRATTI.md sez. 2.3
> Moltiplicatori: `{4:11, 3:9, 2:7, 1:3}`

**Codice errato**: `modules/roster/domain/services/contract-calculator.service.ts` riga 18
```typescript
1: 4  // SBAGLIATO: deve essere 3
```

**Codice corretto**: `services/contract.service.ts` riga 16
```typescript
1: 3  // OK
```

**Impatto**: Qualsiasi calcolo tramite il modulo Clean Architecture produce clausole sbagliate (+33% per durata 1). I test unitari (`contract-calculator.service.test.ts`) validano il valore errato.

---

### P0-5: Funzione locale `calculateRescissionClause` in routes con moltiplicatori completamente errati

**Bibbia**: CONTRATTI.md sez. 2.3
> Moltiplicatori: `{4:11, 3:9, 2:7, 1:3}`

**Codice**: `api/routes/contracts.ts` righe 648-651
```typescript
const multipliers = { 1: 1, 2: 1.5, 3: 1.75, 4: 2 }  // COMPLETAMENTE SBAGLIATI
```

**Impatto**: Export Excel e ricevute PDF post-consolidamento mostrano clausole rescissorie gravemente errate. Esempio: contratto 10x4 → Bibbia=110, codice=20.

---

### P0-6: Formula clausola rescissoria in `completeAllRosterSlots` errata

**Codice**: `auction.service.ts` riga 4859
```typescript
const rescissionClause = Math.round(salary * duration * 2)  // formula inventata
```

**Impatto**: I contratti creati tramite auto-fill hanno clausole sbagliate. Per salary=8, duration=2: codice=32, corretto=56.

---

### P0-7: Rubata — PENDING_ACK auto-advance basato su auction.status (sempre true)

**Bibbia**: RUBATA.md sez. 10.1

**Codice**: `rubata.service.ts` righe 1184-1214
```typescript
if (referencedAuction.status === 'COMPLETED') { ... }  // SEMPRE true dopo chiusura
```

**Impatto**: La fase PENDING_ACK viene potenzialmente saltata senza che tutti i manager confermino la transazione. La rubata procede senza acknowledgment.

---

### P0-8: Rubata — pagamento al venditore include l'ingaggio (deve essere solo OFFERTA)

**Bibbia**: RUBATA.md sez. 3.7, FINANZE.md sez. 3.2 e 10 punto 4
> "Il venditore riceve solo l'OFFERTA (clausola + rilanci), NON il prezzo totale"

**Codice**: `rubata.service.ts` righe 607-619, 1032-1042, 1945-1957
```typescript
const payment = auction.currentPrice  // include clausola + ingaggio + rilanci
// Venditore riceve TUTTO (ingaggio incluso)
```

**Impatto**: Il venditore riceve soldi in piu (la componente ingaggio). L'acquirente paga dal budget anche l'ingaggio che dovrebbe andare solo nel monte ingaggi.

**NOTA**: La Bibbia RUBATA si contraddice internamente (sez. 3.7 dice "solo OFFERTA", sez. 4.4 e esempi 14.x dicono "prezzo intero"). DA RISOLVERE nella Bibbia prima di fixare il codice.

---

### P0-9: `renewContract` e `releasePlayer` standalone bypassano il flusso consolidamento

**Bibbia**: CONTRATTI.md sez. 5 e 7

**Codice**:
- `contract.service.ts:568-721` (`renewContract`): modifica contratto immediatamente, senza bozze/preConsolidation/ContractHistory
- `contract.service.ts:565-666` (`releasePlayer`): elimina contratto immediatamente, fuori transazione, senza check ESTERO/RETROCESSO gratuito

**Impatto**: Due percorsi paralleli (standalone vs consolidamento) con regole diverse. Le funzioni standalone violano privacy, atomicita e regole di business.

---

### P0-10: Schema Prisma mancante dei campi `preConsolidation*` + nessun congelamento implementato

**Bibbia**: CONTRATTI.md sez. 4.5-4.6

**Codice**:
- `prisma/schemas/league.prisma`: manca `preConsolidationBudget`
- `prisma/schemas/roster.prisma`: manca `preConsolidationSalary`, `preConsolidationDuration`
- `league.service.ts:947-1182` (`getLeagueFinancials`): mostra sempre valori REALI, nessun congelamento
- Nessun reset dei campi `preConsolidation` al cambio fase

**Impatto**: La privacy strategica durante la fase CONTRATTI non esiste. Tutti vedono in tempo reale le modifiche contrattuali degli altri.

---

## P1 - BUG ALTI (operazioni non valide permesse)

### P1-1: Verifica budget pre-offerta NON include ingaggio default

**Bibbia**: PRIMO-MERCATO.md sez. 3.2, SVINCOLATI.md sez. 5.2
> `bilancio >= offerta + ingaggio_default`

**Codice** (3 servizi):
- `auction.service.ts:1250`: `if (amount > member.currentBudget)` — solo offerta
- `svincolati.service.ts:331`: `if (amount > bidder.currentBudget)` — solo offerta
- `rubata.service.ts:1497`: `if (rubataPrice > member.currentBudget)` — solo budget, non bilancio

**Impatto**: Manager possono vincere aste senza potersi permettere l'ingaggio risultante → budget negativi.

---

### P1-2: Verifica usa `currentBudget` invece di `bilancio` (Budget - Monte Ingaggi)

**Bibbia**: FINANZE.md sez. 10 punto 5
> "il sistema verifica che il bilancio sia sufficiente"

**Codice**: Tutti i check usano `currentBudget` senza sottrarre il monte ingaggi.

**Impatto**: Un manager con bilancio negativo (monte ingaggi > budget) puo comunque fare offerte.

---

### P1-3: Svincolati — `declareSvincolatiFinished` non rimuove dalla rotazione turni

**Bibbia**: SVINCOLATI.md sez. 6.1
> "Rinuncia definitiva: il manager smette di partecipare anche per tutti i turni futuri"

**Codice**: `svincolati.service.ts:1373-1379`
La rotazione turni (`advanceSvincolatiToNextTurn`) salta solo i `passedMembers`, NON i `finishedMembers`. Inoltre `undoSvincolatiFinished()` permette di annullare — contraddice "definitiva".

---

### P1-4: Rubata — auto-advance da OFFERING salta READY_CHECK

**Bibbia**: RUBATA.md sez. 1.3, 2.2
> Dopo ogni giocatore → READY_CHECK → OFFERING

**Codice**: `rubata.service.ts:957`
Quando il timer OFFERING scade senza offerte, va direttamente a `OFFERING` per il prossimo giocatore, saltando READY_CHECK.

---

### P1-5: Rubata — `modifyContractPostAcquisition` permette SPALMA

**Bibbia**: RUBATA.md sez. 4.6
> "Spalma NON disponibile post-acquisizione"

**Codice**: `contract.service.ts:1647-1653`
Riusa `isValidRenewal()` che ammette spalma per `currentDuration === 1`.

---

### P1-6: Svincolati — soglia budget nomination >= 1 invece di >= 2

**Bibbia**: SVINCOLATI.md sez. 5.2 e 7
> Minimo bilancio per partecipare: 2 (offerta 1 + ingaggio 1)

**Codice**: `svincolati.service.ts:1016-1018`
```typescript
if (member.currentBudget < 1)  // SBAGLIATO: dovrebbe essere < 2
```

---

### P1-7: Formula residuo in Contracts.tsx manca indennizzi

**Codice**: `pages/Contracts.tsx:534-536`
```typescript
residuoContratti = memberBudget - projectedSalaries - totalReleaseCost  // manca + totalIndemnities
```

**Impatto**: Residuo sottostimato per manager con giocatori ESTERO da rilasciare.

---

## P2 - COMPORTAMENTI DIVERSI (impatto limitato)

### P2-1: Tre formule diverse per ingaggio default tra servizi
- `auction.service.ts:667`: `Math.round(price * 0.1)` — corretta
- `auction.service.ts:1007`: `Math.round(rawSalary * 2) / 2` — arrotonda a 0.5
- `svincolati.service.ts:509`: `Math.ceil(price * 0.1)` — arrotonda per eccesso

### P2-2: Fallback multiplier clausola inconsistente
- `contract.service.ts:24`: `?? 3`
- `contract.service.ts:917`: `|| 7`
- `contract-calculator.service.ts:67`: `?? 4`

### P2-3: Consolidamento calcola costo rinnovo come `salaryDiff` vs `valueDiff`
Due formule diverse per lo stesso concetto tra `renewContract()` e `consolidateContracts()`.

### P2-4: `recordMovement` fuori dalla `$transaction` in rubata e svincolati
Se fallisce, il trasferimento e completato ma senza record storico.

### P2-5: Indennizzo ESTERO con cap a clausola rescissoria non documentato
`indemnity-phase.service.ts:434`: `Math.min(rescissionClause, indennizzoEstero)` — la Bibbia non menziona questo cap.

### P2-6: Due sistemi paralleli per svincolati (legacy service + modulo CA non connesso)
Il modulo CA usa fase `'SVINCOLATI'` invece di `'ASTA_SVINCOLATI'` e tipo `'SVINCOLATI'` invece di `'FREE_BID'`.

---

## FUNZIONALITA MANCANTI

### Asta (Primo Mercato + Svincolati)

| # | Funzionalita | Bibbia | Dove implementare |
|---|-------------|--------|-------------------|
| M-1 | **Pausa timer admin** | PRIMO-MERCATO sez. 5.2, SVINCOLATI sez. 3.3 | `auction.service.ts`, `svincolati.service.ts` |
| M-2 | **Rettifiche admin** (annulla asta, annulla chiamata, rettifica transazione) | PRIMO-MERCATO sez. 5.3, SVINCOLATI sez. 3.4 | Parziale: appeal system esiste, ma manca rettifica diretta |
| M-3 | **Esclusione manager per budget insufficiente** | PRIMO-MERCATO sez. 8 | `auction.service.ts` — advanceToNextTurn |

### Svincolati

| # | Funzionalita | Bibbia | Dove implementare |
|---|-------------|--------|-------------------|
| M-4 | **Ordine chiamata automaticamente inverso a rubata** | SVINCOLATI sez. 2.1 | `svincolati.service.ts` — setSvincolatiTurnOrder |
| M-5 | **Fine fase automatica: nessun budget >= 2** | SVINCOLATI sez. 7 | `svincolati.service.ts` — advanceSvincolatiToNextTurn |
| M-6 | **Fine fase automatica: niente svincolati disponibili** | SVINCOLATI sez. 7 | `svincolati.service.ts` — advanceSvincolatiToNextTurn |
| M-7 | **Tracciamento rinunce e correzioni admin** | SVINCOLATI sez. 8 | Sistema audit/log |

### Rubata

| # | Funzionalita | Bibbia | Dove implementare |
|---|-------------|--------|-------------------|
| M-8 | **Regola ex-giocatore** (non puoi rubare chi hai ceduto in fase 1) | RUBATA sez. 4.1 | `rubata.service.ts` — makeRubataOffer |
| M-9 | **COMPLETED dopo ultimo PENDING_ACK** | RUBATA sez. 2.2 | `rubata.service.ts` — acknowledgeRubataTransaction |
| M-10 | **Box budget con residuo nel board** | RUBATA sez. 3.4 | `rubata.service.ts` — getRubataBoard |

### Contratti / Finanze

| # | Funzionalita | Bibbia | Dove implementare |
|---|-------------|--------|-------------------|
| M-11 | **Ricalcolo formale monte ingaggi al consolidamento** | FINANZE sez. 2.1 | `contract.service.ts` — consolidateContracts |
| M-12 | **CHECK constraint DB: `currentBudget >= 0`** | FINANZE sez. 10.2 | Schema Prisma |
| M-13 | **Movement per svincolo automatico da scadenza** | CONTRATTI sez. 5.4 | `auction.service.ts` — decrementContractDurations |
| M-14 | **`releasePlayer` con costo 0 per ESTERO/RETROCESSO** | CONTRATTI sez. 5.2 | `contract.service.ts` — releasePlayer |
| M-15 | **Validazione post-acquisizione dedicata (no spalma)** | RUBATA sez. 4.6, CONTRATTI sez. 4.1 | `contract.service.ts` — nuova funzione |

---

## CONTRADDIZIONI INTERNE ALLE BIBBIE

Da risolvere PRIMA di fixare il codice:

| # | Bibbia | Sezioni | Contraddizione |
|---|--------|---------|----------------|
| C-1 | RUBATA | 3.7 vs 4.4 vs 14.x | Venditore riceve "solo OFFERTA" (3.7) vs "prezzo intero" (4.4, esempi) |
| C-2 | FINANZE | 6 vs 2.1/5.1 | Budget -= "solo prezzo asta" (tab. 6) vs "prezzo + ingaggio" (sez. 2.1, 5.1) |
| C-3 | RUBATA | 4.1 vs 4.2 | Dichiarazione usa "bilancio" (4.1) vs rilancio usa "currentBudget" (4.2) |

---

## PIANO DI INTERVENTO SUGGERITO

### Sprint 1: Fix critici formule (P0-1 a P0-6)
1. Unificare formula contratto default: `Math.max(1, Math.round(price / 10))`, durata `3`
2. Eliminare `calculateRescissionClause` locale in routes
3. Fix moltiplicatore `1: 3` nel modulo domain + aggiornare test
4. Fix formula auto-fill `completeAllRosterSlots`

### Sprint 2: Fix critici finanziari (P0-3, P0-8, P0-9)
1. Rimuovere decremento budget da `renewContract`
2. Risolvere contraddizione Bibbia C-1 e C-2, poi fixare payment rubata
3. Deprecare/disabilitare path standalone (renewContract, releasePlayer)

### Sprint 3: Fix critici rubata + congelamento (P0-7, P0-9, P0-10) -- COMPLETATO
1. P0-7: PENDING_ACK auto-advance -- VERIFICATO CORRETTO. Il codice usa gia `acknowledgedMembers` (non `auction.status`). Il bug originale del GAP report (`referencedAuction.status`) non esiste piu nel codice attuale.
2. P0-9: Consolidation guard aggiunto a `renewContract` e `releasePlayer` -- blocca modifiche standalone dopo consolidamento.
3. P0-10: Schema `preConsolidation*` -- VERIFICATO PRESENTE in `league.prisma`, `roster.prisma` e `schema.generated.prisma`.

### Sprint 4: Validazioni (P1-1 a P1-7)
1. Budget check con ingaggio: `bilancio >= offerta + ingaggio_default`
2. Bilancio vs budget in validazioni
3. Fix svincolati finished/rotation
4. Fix READY_CHECK in rubata
5. Validazione post-acquisizione dedicata

### Sprint 5: Funzionalita mancanti (M-1 a M-15)
Prioritizzare: M-1 (pausa timer), M-8 (ex-giocatore), M-5/M-6 (fine fase auto)

---

## CHANGELOG

| Data | Modifica |
|------|----------|
| 2026-02-06 | Sprint 3: P0-7 verificato CORRETTO (no fix needed), P0-9 consolidation guard aggiunto, P0-10 schema verificato presente |
| 2026-02-06 | Sprint 2: P0-3 budget decrement rimosso, P0-8 seller payment fix |
| 2026-02-06 | Sprint 1: fix formule critiche contratti |
| 2026-02-06 | Creazione report da gap analysis parallela su 5 domini |
