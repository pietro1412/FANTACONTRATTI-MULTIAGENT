# BIBBIA: Fase CONTRATTI - Rinnovo e Bilancio

> Documentazione completa del sistema di rinnovo contratti e calcolo bilancio.
> Ultima revisione: 2026-02-04

---

## 1. PANORAMICA FASE CONTRATTI

### 1.1 Cos'è la Fase CONTRATTI
La fase CONTRATTI è una delle fasi del `MERCATO_RICORRENTE`. Durante questa fase, ogni manager può:
- **Rinnovare** contratti esistenti (aumentare ingaggio)
- **Spalmare** contratti con durata 1 (ridistribuire l'ingaggio su più semestri)
- **Tagliare** giocatori dalla rosa (pagando un costo)
- **Gestire giocatori usciti** (ESTERO/RETROCESSO) con decisione KEEP o RELEASE

### 1.2 Quando si Attiva
La fase CONTRATTI si attiva quando:
- Una `MarketSession` ha `status = 'ACTIVE'` e `currentPhase = 'CONTRATTI'`
- Viene verificato in: `src/services/contract.service.ts:46-55`

### 1.3 Flusso Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FASE CONTRATTI                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. AVVIO FASE                                                   │
│     ├── Decremento automatico durata (-1 a tutti)               │
│     └── Giocatori durata=0 → SVINCOLATI                         │
│                                                                  │
│  2. OPERAZIONI MANAGER (pagina Contracts.tsx)                   │
│     ├── Rinnovi: ingaggio ↑ (opzionale: durata ↑)               │
│     ├── Spalma: se durata=1, ridistribuisci su 2-4 semestri     │
│     ├── Tagli: marca giocatori per rilascio                     │
│     └── Giocatori usciti: KEEP o RELEASE                        │
│                                                                  │
│  3. SALVATAGGIO BOZZE                                           │
│     └── draftSalary, draftDuration, draftReleased               │
│                                                                  │
│  4. CONSOLIDAMENTO (definitivo, irreversibile)                  │
│     ├── Salva preConsolidationBudget                            │
│     ├── Applica rinnovi → ContractHistory (RENEWAL/SPALMA)      │
│     ├── Applica tagli → ContractHistory (RELEASE_*)             │
│     ├── Applica indennizzi → ContractHistory (INDEMNITY)        │
│     ├── Crea ContractConsolidation record                       │
│     └── Crea ManagerSessionSnapshot (PHASE_END)                 │
│                                                                  │
│  5. VISUALIZZAZIONE FINANZE (LeagueFinancials.tsx)              │
│     ├── PRE-consolidamento di tutti: dati CONGELATI             │
│     └── POST-consolidamento di tutti: dati AGGIORNATI           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. FORMULE DI CALCOLO

### 2.1 Formula Residuo (pagina Contracts.tsx)

```
RESIDUO = Budget - Ingaggi - Tagli + Indennizzi
```

**Dove:**
- **Budget**: `memberBudget` (o `preConsolidationBudget` se consolidato)
- **Ingaggi**: `projectedSalaries` - somma degli ingaggi di tutti i contratti attivi
- **Tagli**: `totalReleaseCost` - somma dei costi di taglio `(ingaggio × durata) / 2`
- **Indennizzi**: `totalIndemnities` - somma degli indennizzi ESTERO ricevuti

**Codice di riferimento:** `src/pages/Contracts.tsx:615-618`
```typescript
const residuoContratti = useMemo(() => {
  return memberBudget - projectedSalaries - totalReleaseCost + totalIndemnities
}, [memberBudget, projectedSalaries, totalReleaseCost, totalIndemnities, localReleases, exitDecisions])
```

### 2.2 Formula Bilancio (pagina LeagueFinancials.tsx)

**Durante fase CONTRATTI (non tutti consolidati):**
```
BILANCIO = Budget (congelato) - Contratti (congelati)
```

**Dopo che TUTTI hanno consolidato:**
```
BILANCIO = Budget - Contratti - Tagli + Indennizzi
```

**Nota importante:** I valori **Tagli**, **Indennizzi** e la **nuova somma Ingaggi** vengono mostrati SOLO quando TUTTI i manager hanno consolidato. Fino ad allora, il tabellone Finanze mostra i dati "congelati" (pre-consolidamento).

### 2.3 Calcolo Costo Taglio

```
COSTO_TAGLIO = Math.ceil((ingaggio × durata) / 2)
```

**Codice:** `src/services/contract.service.ts:40-43`

### 2.4 Calcolo Clausola Rescissoria

```
CLAUSOLA = ingaggio × moltiplicatore(durata)

Moltiplicatori:
- 4 semestri → 11
- 3 semestri → 9
- 2 semestri → 7
- 1 semestre → 3
```

**Codice:** `src/services/contract.service.ts:21-38`

### 2.5 Effetto Rinnovo sul Monte Ingaggi

```
DELTA_INGAGGIO = nuovoIngaggio - vecchioIngaggio
```

**Importante:** Il rinnovo NON scala il budget. L'aumento di ingaggio va ad aumentare il **monte ingaggi**, che a consolidamento avvenuto impatta sul **bilancio** (non sul budget).

Esempio: Se rinnovi da 15M a 18M, il tuo budget resta invariato, ma il monte ingaggi aumenta di 3M e quindi il bilancio peggiora di 3M.

---

## 3. REGOLE DI BUSINESS

### 3.1 Regole Rinnovo (isValidRenewal)

**Codice:** `src/services/contract.service.ts:62-105`

1. **Durata massima**: 4 semestri
2. **Ingaggio non può diminuire** (tranne spalma)
3. **Durata non può diminuire**
4. **Per aumentare la durata, DEVI aumentare l'ingaggio**

### 3.2 Regole Spalma

Attivabile SOLO se `durata = 1`:
```
nuovoIngaggio × nuovaDurata >= ingaggioIniziale
```

**Esempio:**
- Contratto attuale: 40M × 1s (ingaggio iniziale: 40M)
- Spalma valido: 10M × 4s = 40M ≥ 40M ✓
- Spalma invalido: 8M × 4s = 32M < 40M ✗

**Effetto:** Lo spalma riduce l'ingaggio annuale (da 40M a 10M in questo esempio) distribuendo il costo su più semestri. Il budget NON viene impattato, solo il monte ingaggi diminuisce.

### 3.3 Giocatori Usciti (ESTERO/RETROCESSO)

**IMPORTANTE:** I giocatori usciti (ESTERO o RETROCESSO) **NON possono essere tagliati** con il costo taglio classico. Le uniche opzioni sono:

**ESTERO:**
- **RELEASE (Lasciare libero):** Il giocatore esce dalla rosa. Ricevi indennizzo (da `SessionPrize`).
- **KEEP (Mantenere in rosa):** Il giocatore resta in rosa. Il suo ingaggio entra nel monte ingaggi. Può essere rinnovato o spalmato (se durata=1). Nessun indennizzo.

**RETROCESSO (Serie Inferiore):**
- **RELEASE (Lasciare libero):** Il giocatore esce dalla rosa gratuitamente (nessun costo).
- **KEEP (Mantenere in rosa):** Il giocatore resta in rosa. Il suo ingaggio entra nel monte ingaggi. Può essere rinnovato o spalmato (se durata=1).

**Nota:** Un giocatore ESTERO/RETROCESSO mantenuto in rosa si comporta come un giocatore normale per quanto riguarda rinnovi e spalma.

### 3.4 Limite Rosa

Max `29` giocatori dopo il consolidamento.

---

## 4. PERSISTENZA DATI

### 4.1 Tabelle Coinvolte

| Tabella | Scopo |
|---------|-------|
| `PlayerContract` | Contratto attivo (salary, duration, clausola) |
| `ContractHistory` | Storico di ogni singolo evento contrattuale |
| `ContractConsolidation` | Record consolidamento per sessione |
| `ManagerSessionSnapshot` | Foto finanziaria del manager in momenti chiave |
| `LeagueMember.preConsolidationBudget` | Budget "congelato" pre-consolidamento |
| `PlayerContract.preConsolidationSalary/Duration` | Valori pre-rinnovo (per privacy durante CONTRATTI) |

### 4.2 ContractHistory - Schema Completo

Ogni operazione su un contratto genera un record permanente e immutabile.

**Campi salvati per ogni evento:**

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `contractId` | String? | ID contratto (null se contratto eliminato) |
| `playerId` | String | Giocatore coinvolto |
| `leagueMemberId` | String | Manager che ha effettuato l'operazione |
| `marketSessionId` | String | Sessione di mercato |
| `eventType` | Enum | Tipo di evento (vedi sotto) |
| `previousSalary` | Int? | Ingaggio PRIMA del cambio |
| `previousDuration` | Int? | Durata PRIMA del cambio |
| `previousClause` | Int? | Clausola PRIMA del cambio |
| `newSalary` | Int? | Ingaggio DOPO il cambio |
| `newDuration` | Int? | Durata DOPO il cambio |
| `newClause` | Int? | Clausola DOPO il cambio |
| `cost` | Int? | Costo dell'operazione (taglio, rinnovo) |
| `income` | Int? | Entrata (indennizzo ESTERO) |
| `notes` | String? | Descrizione testuale dell'operazione |
| `createdAt` | DateTime | Timestamp |

**Codice:** `prisma/schemas/contract-history.prisma:12-50`

### 4.3 ContractHistory - Tipi Evento

```typescript
enum ContractEventType {
  SESSION_START_SNAPSHOT    // Snapshot iniziale sessione
  DURATION_DECREMENT        // Decremento automatico durata
  AUTO_RELEASE_EXPIRED      // Svincolo automatico (durata 0)
  RENEWAL                   // Rinnovo con aumento
  SPALMA                    // Applicazione spalma
  RELEASE_NORMAL            // Taglio normale
  RELEASE_ESTERO            // Rilascio giocatore estero
  RELEASE_RETROCESSO        // Rilascio giocatore retrocesso
  KEEP_ESTERO               // Mantenimento giocatore estero
  KEEP_RETROCESSO           // Mantenimento giocatore retrocesso
  INDEMNITY_RECEIVED        // Indennizzo ricevuto
}
```

**Cosa traccia ogni evento:**

| Evento | previousSalary | newSalary | cost | income | Quando |
|--------|:-:|:-:|:-:|:-:|--------|
| `RENEWAL` | Vecchio ingaggio | Nuovo ingaggio | delta (se > 0) | - | Consolidamento |
| `SPALMA` | Vecchio ingaggio | Nuovo ingaggio | - | - | Consolidamento |
| `RELEASE_NORMAL` | Ingaggio | - | (ing×dur)/2 | - | Consolidamento |
| `RELEASE_ESTERO` | Ingaggio | - | - | indennizzo | Consolidamento |
| `RELEASE_RETROCESSO` | Ingaggio | - | 0 | - | Consolidamento |
| `KEEP_ESTERO` | Ingaggio | - | - | - | Consolidamento |
| `KEEP_RETROCESSO` | Ingaggio | - | - | - | Consolidamento |
| `INDEMNITY_RECEIVED` | - | - | - | importo | Consolidamento |
| `DURATION_DECREMENT` | - | - | - | - | Apertura sessione |
| `AUTO_RELEASE_EXPIRED` | Ingaggio | - | - | - | Apertura sessione |
| `SESSION_START_SNAPSHOT` | Ingaggio | - | - | - | Apertura sessione |

### 4.4 ManagerSessionSnapshot - Foto Finanziaria

Snapshot dello stato finanziario del manager catturato in 3 momenti chiave della sessione.

**3 tipi di snapshot:**

| Tipo | Momento | Scopo |
|------|---------|-------|
| `SESSION_START` | Apertura mercato (dopo decremento durata) | Baseline iniziale sessione |
| `PHASE_START` | Inizio fase CONTRATTI (dopo premi) | Valori iniziali per confronto |
| `PHASE_END` | Dopo consolidamento del manager | Stato finale post-operazioni |

**Campi salvati:**

| Campo | SESSION_START | PHASE_START | PHASE_END |
|-------|:---:|:---:|:---:|
| `budget` | budget corrente | budget corrente | budget post-consolidamento |
| `totalSalaries` | somma ingaggi | somma ingaggi | somma ingaggi post-rinnovi |
| `balance` | budget - salaries | budget - salaries | budget - salaries |
| `contractCount` | n. contratti | n. contratti | n. contratti post-tagli |
| `totalIndemnities` | - | - | somma indennizzi ESTERO |
| `totalReleaseCosts` | - | - | somma costi tagli |
| `totalRenewalCosts` | - | - | somma aumenti rinnovi |
| `releasedCount` | - | - | n. giocatori rilasciati |
| `renewedCount` | - | - | n. contratti rinnovati |

**Vincolo:** `@@unique([leagueMemberId, marketSessionId, snapshotType])` - Un solo snapshot per tipo/manager/sessione.

**Codice:** `prisma/schemas/contract-history.prisma:68-108`

### 4.5 Campi preConsolidation* - Privacy Durante CONTRATTI

Campi temporanei salvati al consolidamento e resettati a fine fase. Servono a "congelare" i dati visibili agli altri manager.

| Campo | Modello | Quando Salvato | Quando Resettato |
|-------|---------|----------------|------------------|
| `preConsolidationBudget` | LeagueMember | `consolidateContracts()` | Admin avanza da CONTRATTI |
| `preConsolidationSalary` | PlayerContract | `consolidateContracts()` (per ogni rinnovo) | Admin avanza da CONTRATTI |
| `preConsolidationDuration` | PlayerContract | `consolidateContracts()` (per ogni rinnovo) | Admin avanza da CONTRATTI |

**Logica di salvataggio** (`contract.service.ts:1060-1125`):
```typescript
// 1. Salva budget prima di modificarlo
preConsolidationBudget = member.currentBudget

// 2. Per ogni rinnovo, salva valori originali prima di aggiornarli
preConsolidationSalary = contract.preConsolidationSalary ?? contract.salary
preConsolidationDuration = contract.preConsolidationDuration ?? contract.duration
// Poi aggiorna salary e duration ai nuovi valori
```

**Reset a fine fase** (`auction.service.ts:538-553`):
```typescript
// Quando admin avanza dalla fase CONTRATTI
await prisma.leagueMember.updateMany({ data: { preConsolidationBudget: null } })
await prisma.playerContract.updateMany({ data: { preConsolidationSalary: null, preConsolidationDuration: null } })
```

### 4.6 Timeline Creazione Record

```
T0: APERTURA SESSIONE MERCATO_RICORRENTE
│
├─► decrementContractDurations() [auction.service.ts]
│   ├─► ContractHistory: DURATION_DECREMENT per ogni contratto
│   └─► ContractHistory: AUTO_RELEASE_EXPIRED per durata=0
│
└─► createSessionStartSnapshots() [contract-history.service.ts:131-180]
    └─► ManagerSessionSnapshot: SESSION_START per ogni manager
        (budget, totalSalaries, balance, contractCount)

T1: TRANSIZIONE A FASE CONTRATTI
│
└─► createPhaseStartSnapshot() [contract-history.service.ts:680-728]
    └─► ManagerSessionSnapshot: PHASE_START per ogni manager
        (budget, totalSalaries, balance, contractCount)

T2: MANAGER X CONSOLIDA [contract.service.ts:consolidateContracts()]
│
├─► Salva preConsolidationBudget
│
├─► Per ogni RINNOVO/SPALMA:
│   ├─► Salva preConsolidationSalary/Duration
│   ├─► Aggiorna contratto (salary, duration, clausola)
│   └─► ContractHistory: RENEWAL o SPALMA
│
├─► Per ogni RELEASE ESTERO:
│   ├─► ContractHistory: RELEASE_ESTERO (con income)
│   ├─► ContractHistory: INDEMNITY_RECEIVED
│   ├─► Elimina PlayerContract
│   └─► Budget += indennizzo
│
├─► Per ogni RELEASE RETROCESSO:
│   ├─► ContractHistory: RELEASE_RETROCESSO (costo 0)
│   └─► Elimina PlayerContract
│
├─► Per ogni RELEASE NORMALE:
│   ├─► ContractHistory: RELEASE_NORMAL (con cost)
│   ├─► Elimina PlayerContract
│   └─► Budget -= costo taglio
│
├─► Per ogni KEEP:
│   └─► ContractHistory: KEEP_ESTERO o KEEP_RETROCESSO
│
├─► Batch create ContractHistory entries
│
└─► createPhaseEndSnapshot() [contract-history.service.ts:731-804]
    └─► ManagerSessionSnapshot: PHASE_END
        (tutti i campi, inclusi totali calcolati da ContractHistory)

T3: FINE FASE CONTRATTI (admin avanza)
│
└─► Reset preConsolidation* = null [auction.service.ts:538-553]
    └─► Tabellone mostra dati reali aggiornati
```

### 4.7 Cosa Succede al Consolidamento

**Ordine operazioni in `consolidateContracts()`:**

1. **Salva `preConsolidationBudget`** nel `LeagueMember`
2. **Applica rinnovi/spalma:**
   - Aggiorna `PlayerContract` (salary, duration, clausola)
   - Salva `preConsolidationSalary/Duration` per privacy
   - Crea `ContractHistory` (RENEWAL o SPALMA)
   - **Nota:** Il rinnovo NON scala il budget, solo il monte ingaggi cambia
3. **Applica rilasci giocatori usciti (ESTERO/RETROCESSO):**
   - Crea `ContractHistory` (RELEASE_ESTERO/RETROCESSO)
   - Elimina `PlayerContract`
   - Aggiorna `PlayerRoster.status = RELEASED`
   - Incrementa budget (per indennizzi ESTERO)
4. **Applica tagli normali:**
   - Crea `ContractHistory` (RELEASE_NORMAL)
   - Elimina `PlayerContract`
   - Aggiorna `PlayerRoster.status = RELEASED`
   - **Decrementa budget** (costo taglio = ingaggio×durata/2)
5. **Registra decisioni KEEP** per giocatori usciti mantenuti
6. **Verifica vincoli** (tutti hanno contratto, max 29 giocatori)
7. **Crea `ContractConsolidation`** record
8. **Crea `ManagerSessionSnapshot`** (PHASE_END) con totali calcolati da ContractHistory

---

## 5. LOGICA "CONGELAMENTO" DATI

### 5.1 Perché Congelare

Durante la fase CONTRATTI, i manager non devono vedere le modifiche degli altri fino a quando TUTTI hanno consolidato. Questo per:
- Privacy delle strategie
- Evitare vantaggi informativi

### 5.2 Come Funziona il Congelamento

**`getLeagueFinancials()` in `league.service.ts:1098-1360`:**

```
1. Manager CONSOLIDA
   └── Salva preConsolidationBudget = currentBudget (es. 312M)
   └── Per ogni rinnovo:
       └── Salva preConsolidationSalary = salary attuale (es. 15M)
       └── Aggiorna salary = nuovo valore (es. 18M)

2. TABELLONE FINANZE (durante CONTRATTI)
   └── Se consolidato → mostra preConsolidationSalary (15M) ← CONGELATO
   └── Se NON consolidato → mostra salary (invariato)
   └── Risultato: TUTTI vedono valori "congelati"

3. FINE FASE CONTRATTI (admin avanza)
   └── Reset: preConsolidation* = null
   └── Tabellone mostra valori reali aggiornati
```

**Codice chiave:**
```typescript
// Verifica se TUTTI i manager hanno consolidato
const allMembersConsolidated = inContrattiPhase
  ? members.every(m => consolidationMap.has(m.id))
  : false

// Budget display
if (inContrattiPhase && isConsolidated && member.preConsolidationBudget != null) {
  displayBudget = member.preConsolidationBudget  // congelato
} else {
  displayBudget = member.currentBudget            // reale
}

// Salary display
if (inContrattiPhase && isConsolidated && contract.preConsolidationSalary != null) {
  displaySalary = contract.preConsolidationSalary  // congelato
} else {
  displaySalary = contract.salary                   // reale
}
```

### 5.3 Dati Congelati vs Aggiornati

| Campo | PRE (congelato) | POST (aggiornato) |
|-------|-----------------|-------------------|
| Budget | `preConsolidationBudget` | `currentBudget` |
| Ingaggio | `preConsolidationSalary` | `salary` |
| Durata | `preConsolidationDuration` | `duration` |
| Slot | Include rilasciati | Solo attivi |
| Tagli | Non mostrati | Mostrati |
| Indennizzi | Non mostrati | Mostrati |

---

## 6. VISTE STORICO E STATISTICHE

### 6.1 Vista Manager

Storico completo delle operazioni di un singolo manager in una sessione.

**Dati disponibili:**
- Budget iniziale (da snapshot PHASE_START) → Budget finale (da snapshot PHASE_END)
- Lista di tutti gli eventi: rinnovi, spalma, tagli, indennizzi, decisioni KEEP
- Per ogni rinnovo: valori PRE e POST (ingaggio, durata, clausola)
- Totali: costi tagli, indennizzi ricevuti, variazione monte ingaggi
- Conteggi: contratti rinnovati, giocatori rilasciati

**API:** `GET /api/leagues/:id/sessions/:sid/manager-snapshot`
**Service:** `getManagerSessionSummary()` in `contract-history.service.ts:277-385`

### 6.2 Vista Giocatore Serie A

Storico di un giocatore attraverso tutte le sessioni e le squadre della lega.

**Dati disponibili:**
- Tutti i contratti che il giocatore ha avuto (acquisti, rinnovi, spalma)
- Le squadre della lega a cui è appartenuto
- Evoluzione ingaggio nel tempo (quanto è cresciuto/diminuito)
- Quando è stato acquistato, rinnovato, spalmato, rilasciato
- Quante sessioni è rimasto nella stessa squadra
- Se è stato scambiato tra manager (da tracciare via PlayerMovement)

**Dati tracciati per sessione:**

| Sessione | Squadra | Evento | Ingaggio | Durata | Clausola |
|----------|---------|--------|----------|--------|----------|
| Feb 2026 | RUGGERI FC | RENEWAL | 15→18M | 2→3s | 162M |
| Set 2025 | RUGGERI FC | DURATION_DEC | 15M | 3→2s | 105M |
| Feb 2025 | RUGGERI FC | RENEWAL | 12→15M | 2→3s | 135M |
| Lug 2024 | RUGGERI FC | ACQUISTO | 12M | 3s | 108M |

**Query base:**
```sql
SELECT ch.*, p.name, p.team, lm.teamName
FROM "ContractHistory" ch
JOIN "SerieAPlayer" p ON ch."playerId" = p.id
JOIN "LeagueMember" lm ON ch."leagueMemberId" = lm.id
WHERE ch."playerId" = 'xxx'
ORDER BY ch."createdAt" ASC
```

### 6.3 Vista Timeline Lega

Tutti gli eventi di tutti i manager in una sessione, in ordine cronologico.

**Dati disponibili:**
- Eventi raggruppati per manager con colori diversi
- Manager non consolidati: eventi nascosti per privacy (durante fase CONTRATTI)
- Dopo che tutti consolidano: visibilità completa
- Filtro per tipo evento (RENEWAL, SPALMA, RELEASE, KEEP)

**API:** `GET /api/leagues/:id/sessions/:sid/contract-history` (vista admin con tutti i manager)
**Service:** `getFullSessionContractHistory()` in `contract-history.service.ts:227-273`

### 6.4 Riepilogo Sessione - Confronto Manager

Tabella di confronto di tutti i manager pre/post consolidamento.

**Colonne:**
| Manager | Budget Iniz. | Indennizzi | Tagli | Budget Fin. | Ingaggi Pre | Delta Rinnovi | Ingaggi Post | Bilancio | Status |

**Dati derivati:**
- `Budget Finale = Budget Iniziale + Indennizzi - Tagli`
- `Delta Rinnovi = Ingaggi Post - Ingaggi Pre` (somma degli aumenti/diminuzioni ingaggio)
- `Bilancio = Budget Finale - Ingaggi Post`
- Manager non consolidati: dati nascosti (?)

### 6.5 Confronto Pre/Post Rinnovo

Vista dettagliata di ogni contratto modificato nella sessione.

**Per ogni contratto:**
- Giocatore e squadra della lega
- Tipo operazione: RENEWAL, SPALMA, RELEASE_NORMAL, RELEASE_ESTERO, RELEASE_RETROCESSO
- Valori PRE: ingaggio, durata, clausola
- Valori POST: ingaggio, durata, clausola (o importo indennizzo/costo taglio)
- Impatto: variazione ingaggio, costo/entrata per il budget

### 6.6 Storico Sessioni Passate

Riepiloghi di tutte le sessioni MERCATO_RICORRENTE completate.

**Per ogni sessione:**
- Confronto snapshot PHASE_START vs PHASE_END
- Variazioni: budget, monte ingaggi, bilancio
- Totali operazioni: quanti rinnovi, quanti tagli, quanti indennizzi
- Andamento nel tempo

**API:** `GET /api/leagues/:id/contract-history/historical`
**Service:** `getHistoricalSessionSummaries()` in `contract-history.service.ts:588-675`

### 6.7 Prospetto Real-Time (Durante CONTRATTI)

Prospetto aggiornato in tempo reale durante la fase CONTRATTI, visibile solo al manager stesso.

**Dati:**
- Budget iniziale (da snapshot)
- Operazioni già consolidate (da ContractHistory)
- Operazioni in bozza (da draftSalary, draftDuration, draftReleased)
- Voci dettagliate: ogni indennizzo, taglio, rinnovo come line item
- Calcolo residuo in tempo reale

**API:** `GET /api/leagues/:id/contract-prospetto`
**Service:** `getContractPhaseProspetto()` in `contract-history.service.ts:389-584`

### 6.8 Statistiche Possibili

Dalle tabelle ContractHistory e ManagerSessionSnapshot si possono derivare:

**Statistiche Manager:**
- Totale speso in rinnovi per sessione e cumulativo
- Numero medio di rinnovi per sessione
- Giocatori mantenuti più a lungo
- Budget medio a fine sessione (trend)

**Statistiche Giocatore:**
- Evoluzione ingaggio nel tempo (grafico)
- Numero sessioni nella stessa squadra
- Numero volte rinnovato/spalmato
- Clausola rescissoria nel tempo

**Statistiche Lega:**
- Monte ingaggi totale per sessione (trend)
- Numero tagli per sessione
- Totale indennizzi distribuiti
- Giocatori più rinnovati della lega
- Manager che spendono di più in rinnovi

---

## 7. API ENDPOINTS STORICO

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/leagues/:id/sessions/:sid/contract-history` | GET | Eventi ContractHistory del manager (o tutti per admin) |
| `/api/leagues/:id/sessions/:sid/manager-snapshot` | GET | Riepilogo sessione con snapshot e totali |
| `/api/leagues/:id/contract-prospetto` | GET | Prospetto real-time durante fase CONTRATTI |
| `/api/leagues/:id/contract-history/historical` | GET | Storico di tutte le sessioni passate |

**Codice:** `src/api/routes/contract-history.ts`

---

## 8. ESEMPI PRATICI

### 8.1 Esempio Rinnovo

**Situazione iniziale:**
- Budget: 312M
- Monte ingaggi: 220M
- Contratto Barella: 15M × 2s

**Rinnovo:**
- Nuovo: 18M × 3s
- Aumento ingaggio: 18 - 15 = +3M

**Dopo consolidamento:**
- Budget: **312M** (invariato!)
- Monte ingaggi: **223M** (+3M)
- Bilancio: 312 - 223 = **89M** (era 312 - 220 = 92M, quindi -3M)
- Contratto: 18M × 3s
- `ContractHistory`: eventType=RENEWAL, previousSalary=15, newSalary=18

### 8.2 Esempio Spalma

**Situazione iniziale:**
- Budget: 200M
- Monte ingaggi: 150M (di cui Vlahovic 40M)
- Contratto Vlahovic: 40M × 1s (ingaggio iniziale: 40M)

**Spalma:**
- Nuovo: 10M × 4s (totale = 10×4 = 40M ≥ 40M iniziale ✓)
- Risparmio ingaggio annuale: 40 - 10 = 30M

**Dopo consolidamento:**
- Budget: **200M** (invariato!)
- Monte ingaggi: **120M** (150 - 40 + 10 = -30M)
- Bilancio: 200 - 120 = **80M** (era 200 - 150 = 50M, quindi +30M!)
- Contratto: 10M × 4s
- `ContractHistory`: eventType=SPALMA, previousSalary=40, newSalary=10

### 8.3 Esempio Taglio + Indennizzo (Caso Pietro)

**Situazione:**
- Budget iniziale: 312M
- Ingaggi totali: 227M
- Tagli: Lookman (10M×4s) + altri = 30M totale costo tagli
- Indennizzo ESTERO Lookman: 75M

**Calcolo Residuo:**
```
Residuo = 312 - 227 - 30 + 75 = 130M
```

---

## 9. FILE CHIAVE

| File | Responsabilità |
|------|----------------|
| `src/services/contract.service.ts` | Logica business contratti, consolidamento |
| `src/pages/Contracts.tsx` | UI gestione contratti manager |
| `src/services/league.service.ts` | `getLeagueFinancials()` - dati finanze |
| `src/pages/LeagueFinancials.tsx` | UI tabellone finanze |
| `src/services/contract-history.service.ts` | Persistenza storico |
| `prisma/schemas/contract-history.prisma` | Schema ContractHistory |

---

## 10. VERIFICHE E TEST

### 10.1 Checklist Funzionale

- [ ] Rinnovo aumenta monte ingaggi (NON scala il budget)
- [ ] Spalma riduce monte ingaggi (NON scala il budget)
- [ ] Taglio NORMALE costa `(ingaggio × durata) / 2` e scala il budget
- [ ] ESTERO: solo RELEASE (indennizzo) o KEEP (rosa) - NO taglio classico
- [ ] RETROCESSO: solo RELEASE (gratuito) o KEEP (rosa) - NO taglio classico
- [ ] KEEP: giocatore resta in rosa, ingaggio nel monte, può rinnovare/spalmare
- [ ] Max 29 giocatori
- [ ] Finanze "congelate" (ingaggi, tagli, indennizzi) fino a consolidamento TOTALE
- [ ] Post-consolidamento di TUTTI: mostra nuovi ingaggi, tagli e indennizzi

### 10.2 Query di Verifica

```sql
-- Verifica ContractHistory per sessione
SELECT * FROM "ContractHistory"
WHERE "marketSessionId" = 'xxx'
ORDER BY "createdAt";

-- Verifica snapshot manager
SELECT * FROM "ManagerSessionSnapshot"
WHERE "marketSessionId" = 'xxx';

-- Verifica consolidamenti
SELECT * FROM "ContractConsolidation"
WHERE "sessionId" = 'xxx';
```

---

## 11. MOCKUP VISTE

Per un mockup visuale di tutte le viste descritte nella sezione 6, aprire:
`docs/contract-history-mockup.html`

Contiene 5 tab interattive con dati di esempio:
1. Vista Manager (timeline eventi, budget, monte ingaggi)
2. Vista Giocatore (storico contratti, squadre, evoluzione ingaggio)
3. Timeline Lega (eventi di tutti i manager)
4. Riepilogo Sessione (tabella confronto pre/post tutti i manager)
5. Confronto Pre/Post (cards dettagliate per ogni contratto modificato)

---

## 12. CHANGELOG

| Data | Modifica |
|------|----------|
| 2026-02-04 | Creazione documento iniziale |
| 2026-02-04 | Correzioni post-revisione: rinnovo non scala budget, esempio spalma corretto (40M×1s), giocatori usciti non possono essere tagliati, KEEP = resta in rosa con ingaggio nel monte |
| 2026-02-04 | Bug fix: rimosso codice in contract.service.ts:1127-1132 che decrementava erroneamente il budget per i rinnovi |
| 2026-02-04 | Ampliata sezione 4 (Persistenza): schema completo ContractHistory, ManagerSessionSnapshot (3 tipi), campi preConsolidation*, timeline creazione record |
| 2026-02-04 | Aggiunta sezione 6 (Viste Storico): vista manager, giocatore, lega, sessione, confronto pre/post, prospetto real-time, statistiche possibili |
| 2026-02-04 | Aggiunta sezione 7 (API Endpoints) e sezione 11 (Mockup Viste) con link al file HTML |
