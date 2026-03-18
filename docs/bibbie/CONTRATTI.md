# BIBBIA: Contratti e Budget

> Fonte di verita per le regole dei contratti, il calcolo del budget, del bilancio e il flusso della fase CONTRATTI nel mercato ricorrente.
> Ultima revisione: 2026-03-18

---

## 1. STRUTTURA DI UN CONTRATTO

Ogni giocatore sotto contratto ha:

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `salary` (ingaggio) | Intero, >= 1 | Costo annuale del giocatore |
| `duration` (durata) | Intero, 1-4 | Semestri rimanenti |
| `rescissionClause` (clausola) | Intero, calcolato | salary * moltiplicatore(duration) |
| `initialSalary` | Intero | Ingaggio al momento della creazione. MAI modificato. |

### 1.1 Notazione

Un contratto si esprime come **ingaggio x durata**. Esempio: `4x4` = ingaggio 4, durata 4 semestri.

---

## 2. CLAUSOLA RESCISSORIA

### 2.1 Moltiplicatori

| Durata (semestri) | Moltiplicatore |
|-------------------|---------------|
| 4 | 11 |
| 3 | 9 |
| 2 | 7 |
| 1 | 3 |

### 2.2 Formula

```
clausola = ingaggio * moltiplicatore(durata)
```

### 2.3 Tabella Esempi

| Contratto | Clausola | Prezzo Rubata (clausola + ingaggio) |
|-----------|----------|-------------------------------------|
| 4x4 | 44 | 48 |
| 4x3 | 36 | 40 |
| 4x2 | 28 | 32 |
| 4x1 | 12 | 16 |
| 10x4 | 110 | 120 |
| 10x3 | 90 | 100 |
| 20x4 | 220 | 240 |

---

## 3. CONTRATTO DEFAULT

Quando un giocatore viene acquistato tramite asta (primo mercato, svincolati), riceve un contratto default.

### 3.1 Formula Ingaggio Default

```
ingaggio_default = Math.max(1, Math.round(costo_asta / 10))
```

Arrotondamento standard (half-up): 0.5 arrotonda verso l'alto.

### 3.2 Tabella Fasce

| Costo Asta | Ingaggio Default |
|------------|-----------------|
| 1 - 4 | 1 |
| 5 - 14 | 1 |
| 15 - 24 | 2 |
| 25 - 34 | 3 |
| 35 - 44 | 4 |
| 45 - 54 | 5 |
| 55 - 64 | 6 |
| 65 - 74 | 7 |
| 75 - 84 | 8 |
| 85 - 94 | 9 |
| 95 - 104 | 10 |

### 3.3 Durata Default

**Sempre 3 semestri**, indipendentemente dal costo d'asta o dal tipo di acquisto.

### 3.4 Verifica Budget

Per poter fare un'offerta in asta, il manager deve avere bilancio sufficiente per il costo totale:

```
bilancio_richiesto >= prezzo_offerta + ingaggio_default
```

**Esempio:** Per offrire 75 per Esposito (ingaggio default 8), serve bilancio >= 83.

---

## 4. MODIFICA CONTRATTO POST-ACQUISTO

Dopo ogni acquisto (primo mercato, rubata, svincolati), il manager puo modificare il contratto.

### 4.1 Regole di Modifica

| Regola | Dettaglio |
|--------|-----------|
| Ingaggio | Puo solo **AUMENTARE** (no diminuzione) |
| Durata | Puo solo **AUMENTARE** (no diminuzione) |
| Durata massima | 4 semestri |
| Aumento durata | Richiede **PRIMA** un aumento di ingaggio |
| Spalma | **NON disponibile** post-acquisto |
| Taglio | **NON disponibile** post-acquisto |

### 4.2 Impatto sul Bilancio

Il costo totale dell'operazione e:

```
costo_totale = prezzo_asta + ingaggio_effettivo
```

Dove `ingaggio_effettivo` e l'ingaggio dopo eventuale modifica.

**Esempi:**
```
Compro a 75, lascio default (8x3):   costo = 75 + 8 = 83
Compro a 75, modifico a 9x3:         costo = 75 + 9 = 84
Compro a 75, modifico a 9x4:         costo = 75 + 9 = 84
Compro a 75, modifico a 12x4:        costo = 75 + 12 = 87
```

**NOTA:** La durata NON impatta il costo immediato. L'ingaggio e il costo semestrale.

---

## 5. PANORAMICA FASE CONTRATTI

### 5.1 Cos'e la Fase CONTRATTI

La fase CONTRATTI e una delle fasi del `MERCATO_RICORRENTE`. Durante questa fase, ogni manager puo:
- **Rinnovare** contratti esistenti (aumentare ingaggio)
- **Spalmare** contratti con durata 1 (ridistribuire l'ingaggio su piu semestri)
- **Tagliare** giocatori dalla rosa (pagando un costo)
- **Gestire giocatori usciti** (ESTERO/RETROCESSO) con decisione KEEP o RELEASE

### 5.2 Quando si Attiva

La fase CONTRATTI si attiva quando una sessione di mercato ricorrente e attiva e la fase corrente e `CONTRATTI`.

### 5.3 Flusso Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FASE CONTRATTI                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. AVVIO FASE                                                   │
│     ├── Decremento automatico durata (-1 a tutti)               │
│     └── Giocatori durata=0 → SVINCOLATI                         │
│                                                                  │
│  2. OPERAZIONI MANAGER                                           │
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
│  5. VISUALIZZAZIONE FINANZE                                      │
│     ├── PRE-consolidamento di tutti: dati CONGELATI             │
│     └── POST-consolidamento di tutti: dati AGGIORNATI           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. OPERAZIONI SUI CONTRATTI

### 6.1 Rinnovo

- Aumenta l'ingaggio e/o la durata
- Impatta il monte ingaggi (aumenta)
- **NON decrementa il budget** - regola FONDAMENTALE
- Clausola ricalcolata con nuovi valori

**Regole di validita:**
1. **Durata massima**: 4 semestri
2. **Ingaggio non puo diminuire** (tranne spalma)
3. **Durata non puo diminuire**
4. **Per aumentare la durata, DEVI aumentare l'ingaggio**

**Effetto sul monte ingaggi:**
```
DELTA_INGAGGIO = nuovoIngaggio - vecchioIngaggio
```

Il rinnovo NON scala il budget. L'aumento di ingaggio va ad aumentare il **monte ingaggi**, che a consolidamento avvenuto impatta sul **bilancio** (non sul budget).

Esempio: Se rinnovi da 15M a 18M, il tuo budget resta invariato, ma il monte ingaggi aumenta di 3M e quindi il bilancio peggiora di 3M.

### 6.2 Spalma

- Redistribuisce il peso del contratto nel tempo
- Disponibile solo in fase rinnovo (NON post-acquisto)
- Attivabile SOLO se `durata = 1`

**Formula di validita:**
```
nuovoIngaggio x nuovaDurata >= ingaggioIniziale
```

**Esempio:**
- Contratto attuale: 40M x 1s (ingaggio iniziale: 40M)
- Spalma valido: 10M x 4s = 40M >= 40M iniziale (OK)
- Spalma invalido: 8M x 4s = 32M < 40M (KO)

**Effetto:** Lo spalma riduce l'ingaggio annuale (da 40M a 10M in questo esempio) distribuendo il costo su piu semestri. Il budget NON viene impattato, solo il monte ingaggi diminuisce.

### 6.3 Taglio

Il taglio svincola un giocatore dalla rosa, con un costo scalato dal budget. Per la formula del costo taglio, la tabella esempi e le eccezioni (ESTERO/RETROCESSO), vedi **Bibbia FINANZE.md** sezione 8.

### 6.4 Giocatori Usciti (ESTERO/RETROCESSO)

**IMPORTANTE:** I giocatori usciti (ESTERO o RETROCESSO) **NON possono essere tagliati** con il costo taglio classico. Le uniche opzioni sono RELEASE o KEEP.

Per gli importi degli indennizzi e le regole finanziarie di ESTERO e RETROCESSO, vedi **Bibbia FINANZE.md** sezione 9.

**Regole contrattuali:**
- **RELEASE:** Il giocatore esce dalla rosa. Per ESTERO si riceve indennizzo; per RETROCESSO il rilascio e gratuito.
- **KEEP:** Il giocatore resta in rosa. Il suo ingaggio entra nel monte ingaggi. Puo essere rinnovato o spalmato (se durata=1). Nessun indennizzo.

**Nota:** Un giocatore ESTERO/RETROCESSO mantenuto in rosa si comporta come un giocatore normale per quanto riguarda rinnovi e spalma.

### 6.5 Scadenza Naturale

- All'apertura del mercato ricorrente, la durata decrementa di 1
- Se durata arriva a 0: giocatore si svincola automaticamente
- L'evento deve essere tracciato e visibile al manager

---

## 7. DECREMENTO DURATA

### 7.1 Quando Avviene

Il decremento della durata avviene **all'apertura del mercato ricorrente**, NON alla fine.

### 7.2 Cosa Succede

1. Tutti i contratti attivi: `durata -= 1`
2. Ricalcolo clausole rescissorie con nuove durate
3. Contratti con durata 0: giocatore diventa svincolato (tracciare)
4. Giocatori ESTERO o RETROCESSO: gestiti separatamente (vedi Bibbia GIOCATORI)
5. La situazione contrattuale deve essere chiara ad ogni manager

---

## 8. BUDGET E BILANCIO

Per le definizioni complete di Budget, Monte Ingaggi e Bilancio, e per la tabella di tutte le operazioni che modificano il budget, vedi **Bibbia FINANZE.md** sezioni 1 e 6.

### 8.3 Bilancio nella Rubata

Vedi **Bibbia FINANZE.md** sezione 3 per il modello completo di scomposizione offerta + ingaggio.

### 8.4 Formula Residuo (durante fase CONTRATTI)

```
RESIDUO = Budget - Ingaggi - Tagli + Indennizzi
```

**Dove:**
- **Budget**: budget corrente (o preConsolidationBudget se consolidato)
- **Ingaggi**: somma degli ingaggi di tutti i contratti attivi (proiettati con bozze)
- **Tagli**: somma dei costi di taglio `CEIL(ingaggio x durata / 2)`
- **Indennizzi**: somma degli indennizzi ESTERO ricevuti

### 8.5 Formula Bilancio (tabellone finanze)

**Durante fase CONTRATTI (non tutti consolidati):**
```
BILANCIO = Budget (congelato) - Contratti (congelati)
```

**Dopo che TUTTI hanno consolidato:**
```
BILANCIO = Budget - Contratti - Tagli + Indennizzi
```

**Nota importante:** I valori **Tagli**, **Indennizzi** e la **nuova somma Ingaggi** vengono mostrati SOLO quando TUTTI i manager hanno consolidato. Fino ad allora, il tabellone Finanze mostra i dati "congelati" (pre-consolidamento).

---

## 9. CAMPO initialSalary

Il campo `initialSalary` registra l'ingaggio al momento della creazione del contratto.

**Regola:** MAI modificato dopo la creazione, indipendentemente da rinnovi o aumenti successivi.

Serve per:
- Storico del contratto
- Calcoli retroattivi (formula spalma)
- Audit delle operazioni

---

## 10. TRASFERIMENTO CONTRATTO

### 10.1 Nella Rubata

La rubata **TRASFERISCE** il record contratto e roster esistente. NON elimina e ricrea.

- `salary`, `duration`, `rescissionClause`, `initialSalary` restano invariati
- Solo `leagueMemberId` cambia (dal venditore al vincitore)
- Il vincitore puo poi modificare il contratto (increase-only)

### 10.2 Negli Scambi (Fase 1/6)

Il contratto viene trasferito come nella rubata. NON incide sul bilancio corrente: l'impatto si vedra al prossimo consolidamento.

---

## 11. PERSISTENZA DATI

### 11.1 Tabelle Coinvolte

| Tabella | Scopo |
|---------|-------|
| `PlayerContract` | Contratto attivo (salary, duration, clausola) |
| `ContractHistory` | Storico di ogni singolo evento contrattuale (immutabile) |
| `ContractConsolidation` | Record consolidamento per sessione |
| `ManagerSessionSnapshot` | Foto finanziaria del manager in momenti chiave |
| `LeagueMember.preConsolidationBudget` | Budget "congelato" pre-consolidamento |
| `PlayerContract.preConsolidationSalary/Duration` | Valori pre-rinnovo (per privacy durante CONTRATTI) |

### 11.2 ContractHistory - Tipi Evento (ContractEventType)

| Evento | Descrizione | Quando |
|--------|-------------|--------|
| `SESSION_START_SNAPSHOT` | Snapshot iniziale sessione | Apertura sessione |
| `DURATION_DECREMENT` | Decremento automatico durata | Apertura sessione |
| `AUTO_RELEASE_EXPIRED` | Svincolo automatico (durata 0) | Apertura sessione |
| `RENEWAL` | Rinnovo con aumento | Consolidamento |
| `SPALMA` | Applicazione spalma | Consolidamento |
| `RELEASE_NORMAL` | Taglio normale | Consolidamento |
| `RELEASE_ESTERO` | Rilascio giocatore estero | Consolidamento |
| `RELEASE_RETROCESSO` | Rilascio giocatore retrocesso | Consolidamento |
| `KEEP_ESTERO` | Mantenimento giocatore estero | Consolidamento |
| `KEEP_RETROCESSO` | Mantenimento giocatore retrocesso | Consolidamento |
| `INDEMNITY_RECEIVED` | Indennizzo ricevuto | Consolidamento |

### 11.3 ContractHistory - Campi per Evento

| Evento | previousSalary | newSalary | cost | income |
|--------|:-:|:-:|:-:|:-:|
| `RENEWAL` | Vecchio ingaggio | Nuovo ingaggio | delta (se > 0) | - |
| `SPALMA` | Vecchio ingaggio | Nuovo ingaggio | - | - |
| `RELEASE_NORMAL` | Ingaggio | - | (ing x dur)/2 | - |
| `RELEASE_ESTERO` | Ingaggio | - | - | indennizzo |
| `RELEASE_RETROCESSO` | Ingaggio | - | 0 | - |
| `KEEP_ESTERO` | Ingaggio | - | - | - |
| `KEEP_RETROCESSO` | Ingaggio | - | - | - |
| `INDEMNITY_RECEIVED` | - | - | - | importo |
| `DURATION_DECREMENT` | - | - | - | - |
| `AUTO_RELEASE_EXPIRED` | Ingaggio | - | - | - |
| `SESSION_START_SNAPSHOT` | Ingaggio | - | - | - |

### 11.4 ManagerSessionSnapshot - Foto Finanziaria

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

**Vincolo:** Un solo snapshot per tipo/manager/sessione.

---

## 12. CONGELAMENTO DATI (Privacy durante fase CONTRATTI)

### 12.1 Perche Congelare

Durante la fase CONTRATTI, i manager non devono vedere le modifiche degli altri fino a quando TUTTI hanno consolidato. Questo per:
- Privacy delle strategie
- Evitare vantaggi informativi

### 12.2 Come Funziona il Congelamento

1. **Manager consolida:** vengono salvati i valori pre-consolidamento (budget, ingaggi, durate) nei campi `preConsolidation*`.
2. **Tabellone finanze durante CONTRATTI:** per i manager che hanno consolidato si mostrano i valori congelati (`preConsolidation*`); per quelli non consolidati si mostrano i valori correnti (che non sono ancora cambiati). Risultato: TUTTI vedono i valori "congelati".
3. **Fine fase CONTRATTI (admin avanza):** i campi `preConsolidation*` vengono resettati a null. Il tabellone mostra i valori reali aggiornati.

### 12.3 Dati Congelati vs Aggiornati

| Campo | PRE (congelato) | POST (aggiornato) |
|-------|-----------------|-------------------|
| Budget | preConsolidationBudget | currentBudget |
| Ingaggio | preConsolidationSalary | salary |
| Durata | preConsolidationDuration | duration |
| Slot | Include rilasciati | Solo attivi |
| Tagli | Non mostrati | Mostrati |
| Indennizzi | Non mostrati | Mostrati |

---

## 13. TIMELINE CONSOLIDAMENTO

```
T0: APERTURA SESSIONE MERCATO_RICORRENTE
│
├── Decremento durata di tutti i contratti (-1)
│   ├── ContractHistory: DURATION_DECREMENT per ogni contratto
│   └── ContractHistory: AUTO_RELEASE_EXPIRED per durata=0
│
└── Creazione snapshot SESSION_START per ogni manager
    (budget, totalSalaries, balance, contractCount)

T1: TRANSIZIONE A FASE CONTRATTI
│
└── Creazione snapshot PHASE_START per ogni manager
    (budget, totalSalaries, balance, contractCount)

T2: MANAGER X CONSOLIDA
│
├── Salva preConsolidationBudget
│
├── Per ogni RINNOVO/SPALMA:
│   ├── Salva preConsolidationSalary/Duration
│   ├── Aggiorna contratto (salary, duration, clausola)
│   └── ContractHistory: RENEWAL o SPALMA
│
├── Per ogni RELEASE ESTERO:
│   ├── ContractHistory: RELEASE_ESTERO (con income)
│   ├── ContractHistory: INDEMNITY_RECEIVED
│   ├── Elimina contratto
│   └── Budget += indennizzo
│
├── Per ogni RELEASE RETROCESSO:
│   ├── ContractHistory: RELEASE_RETROCESSO (costo 0)
│   └── Elimina contratto
│
├── Per ogni RELEASE NORMALE:
│   ├── ContractHistory: RELEASE_NORMAL (con cost)
│   ├── Elimina contratto
│   └── Budget -= costo taglio
│
├── Per ogni KEEP:
│   └── ContractHistory: KEEP_ESTERO o KEEP_RETROCESSO
│
├── Crea ContractConsolidation record
│
└── Creazione snapshot PHASE_END
    (tutti i campi, inclusi totali calcolati)

T3: FINE FASE CONTRATTI (admin avanza)
│
└── Reset preConsolidation* = null
    └── Tabellone mostra dati reali aggiornati
```

### 13.1 Ordine Operazioni nel Consolidamento

1. **Salva preConsolidationBudget** nel LeagueMember
2. **Applica rinnovi/spalma:**
   - Aggiorna contratto (salary, duration, clausola)
   - Salva preConsolidationSalary/Duration per privacy
   - Crea ContractHistory (RENEWAL o SPALMA)
   - **Nota:** Il rinnovo NON scala il budget, solo il monte ingaggi cambia
3. **Applica rilasci giocatori usciti (ESTERO/RETROCESSO):**
   - Crea ContractHistory (RELEASE_ESTERO/RETROCESSO)
   - Elimina contratto
   - Aggiorna roster status = RELEASED
   - Incrementa budget (per indennizzi ESTERO)
4. **Applica tagli normali:**
   - Crea ContractHistory (RELEASE_NORMAL)
   - Elimina contratto
   - Aggiorna roster status = RELEASED
   - **Decrementa budget** (costo taglio = ingaggio x durata / 2)
5. **Registra decisioni KEEP** per giocatori usciti mantenuti
6. **Verifica vincoli** (tutti hanno contratto, max 29 giocatori)
7. **Crea ContractConsolidation** record
8. **Crea ManagerSessionSnapshot** (PHASE_END) con totali calcolati

---

## 14. VISTE STORICO E STATISTICHE

### 14.1 Vista Manager

Storico completo delle operazioni di un singolo manager in una sessione.

**Dati disponibili:**
- Budget iniziale (da snapshot PHASE_START) -> Budget finale (da snapshot PHASE_END)
- Lista di tutti gli eventi: rinnovi, spalma, tagli, indennizzi, decisioni KEEP
- Per ogni rinnovo: valori PRE e POST (ingaggio, durata, clausola)
- Totali: costi tagli, indennizzi ricevuti, variazione monte ingaggi
- Conteggi: contratti rinnovati, giocatori rilasciati

### 14.2 Vista Giocatore Serie A

Storico di un giocatore attraverso tutte le sessioni e le squadre della lega.

**Dati disponibili:**
- Tutti i contratti che il giocatore ha avuto (acquisti, rinnovi, spalma)
- Le squadre della lega a cui e appartenuto
- Evoluzione ingaggio nel tempo (quanto e cresciuto/diminuito)
- Quando e stato acquistato, rinnovato, spalmato, rilasciato
- Quante sessioni e rimasto nella stessa squadra
- Se e stato scambiato tra manager (tracciato via PlayerMovement)

**Esempio dati per sessione:**

| Sessione | Squadra | Evento | Ingaggio | Durata | Clausola |
|----------|---------|--------|----------|--------|----------|
| Feb 2026 | RUGGERI FC | RENEWAL | 15->18M | 2->3s | 162M |
| Set 2025 | RUGGERI FC | DURATION_DEC | 15M | 3->2s | 105M |
| Feb 2025 | RUGGERI FC | RENEWAL | 12->15M | 2->3s | 135M |
| Lug 2024 | RUGGERI FC | ACQUISTO | 12M | 3s | 108M |

### 14.3 Vista Timeline Lega

Tutti gli eventi di tutti i manager in una sessione, in ordine cronologico.

**Dati disponibili:**
- Eventi raggruppati per manager con colori diversi
- Manager non consolidati: eventi nascosti per privacy (durante fase CONTRATTI)
- Dopo che tutti consolidano: visibilita completa
- Filtro per tipo evento (RENEWAL, SPALMA, RELEASE, KEEP)

### 14.4 Riepilogo Sessione - Confronto Manager

Tabella di confronto di tutti i manager pre/post consolidamento.

**Colonne:** Manager | Budget Iniz. | Indennizzi | Tagli | Budget Fin. | Ingaggi Pre | Delta Rinnovi | Ingaggi Post | Bilancio | Status

**Dati derivati:**
- `Budget Finale = Budget Iniziale + Indennizzi - Tagli`
- `Delta Rinnovi = Ingaggi Post - Ingaggi Pre` (somma degli aumenti/diminuzioni ingaggio)
- `Bilancio = Budget Finale - Ingaggi Post`
- Manager non consolidati: dati nascosti (?)

### 14.5 Prospetto Real-Time (durante CONTRATTI)

Prospetto aggiornato in tempo reale durante la fase CONTRATTI, visibile solo al manager stesso.

**Dati:**
- Budget iniziale (da snapshot)
- Operazioni gia consolidate (da ContractHistory)
- Operazioni in bozza (da draftSalary, draftDuration, draftReleased)
- Voci dettagliate: ogni indennizzo, taglio, rinnovo come line item
- Calcolo residuo in tempo reale

### 14.6 Statistiche Possibili

Dalle tabelle ContractHistory e ManagerSessionSnapshot si possono derivare:

**Statistiche Manager:**
- Totale speso in rinnovi per sessione e cumulativo
- Numero medio di rinnovi per sessione
- Giocatori mantenuti piu a lungo
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
- Giocatori piu rinnovati della lega
- Manager che spendono di piu in rinnovi

---

## 15. LIMITE ROSA

Max **29** giocatori dopo il consolidamento.

---

## 16. ESEMPI PRATICI

### 16.1 Esempio Rinnovo

**Situazione iniziale:**
- Budget: 312M
- Monte ingaggi: 220M
- Contratto Barella: 15M x 2s

**Rinnovo:**
- Nuovo: 18M x 3s
- Aumento ingaggio: 18 - 15 = +3M

**Dopo consolidamento:**
- Budget: **312M** (invariato!)
- Monte ingaggi: **223M** (+3M)
- Bilancio: 312 - 223 = **89M** (era 312 - 220 = 92M, quindi -3M)
- Contratto: 18M x 3s
- ContractHistory: eventType=RENEWAL, previousSalary=15, newSalary=18

### 16.2 Esempio Spalma

**Situazione iniziale:**
- Budget: 200M
- Monte ingaggi: 150M (di cui Vlahovic 40M)
- Contratto Vlahovic: 40M x 1s (ingaggio iniziale: 40M)

**Spalma:**
- Nuovo: 10M x 4s (totale = 10 x 4 = 40M >= 40M iniziale, OK)
- Risparmio ingaggio annuale: 40 - 10 = 30M

**Dopo consolidamento:**
- Budget: **200M** (invariato!)
- Monte ingaggi: **120M** (150 - 40 + 10 = -30M)
- Bilancio: 200 - 120 = **80M** (era 200 - 150 = 50M, quindi +30M!)
- Contratto: 10M x 4s
- ContractHistory: eventType=SPALMA, previousSalary=40, newSalary=10

### 16.3 Esempio Taglio + Indennizzo

**Situazione:**
- Budget iniziale: 312M
- Ingaggi totali: 227M
- Tagli: Lookman (10M x 4s) + altri = 30M totale costo tagli
- Indennizzo ESTERO Lookman: 75M

**Calcolo Residuo:**
```
Residuo = 312 - 227 - 30 + 75 = 130M
```

---

## 17. CHECKLIST FUNZIONALE

- [ ] Rinnovo aumenta monte ingaggi (NON scala il budget)
- [ ] Spalma riduce monte ingaggi (NON scala il budget)
- [ ] Taglio NORMALE costa `CEIL(ingaggio x durata / 2)` e scala il budget
- [ ] ESTERO: solo RELEASE (indennizzo) o KEEP (rosa) - NO taglio classico
- [ ] RETROCESSO: solo RELEASE (gratuito) o KEEP (rosa) - NO taglio classico
- [ ] KEEP: giocatore resta in rosa, ingaggio nel monte, puo rinnovare/spalmare
- [ ] Max 29 giocatori
- [ ] Finanze "congelate" (ingaggi, tagli, indennizzi) fino a consolidamento TOTALE
- [ ] Post-consolidamento di TUTTI: mostra nuovi ingaggi, tagli e indennizzi

---

## CHANGELOG

| Data | Modifica |
|------|----------|
| 2026-02-03 | Creazione documento CONTRATTI.md originale (solo Budget/Bilancio) |
| 2026-02-04 | Creazione documento BIBBIA-CONTRATTI.md iniziale |
| 2026-02-04 | Correzioni post-revisione: rinnovo non scala budget, esempio spalma corretto (40M x 1s), giocatori usciti non possono essere tagliati, KEEP = resta in rosa con ingaggio nel monte |
| 2026-02-04 | Bug fix: rimossa logica che decrementava erroneamente il budget per i rinnovi |
| 2026-02-04 | Ampliata persistenza: schema completo ContractHistory, ManagerSessionSnapshot (3 tipi), campi preConsolidation*, timeline creazione record |
| 2026-02-04 | Aggiunte viste storico: vista manager, giocatore, lega, sessione, confronto pre/post, prospetto real-time, statistiche possibili |
| 2026-02-06 | Riscrittura CONTRATTI.md: aggiunto regole contratto, formula default, modifica post-acquisto, decremento durata, trasferimento contratto, allineamento con modello FINANZE |
| 2026-03-18 | Unificazione CONTRATTI.md e BIBBIA-CONTRATTI.md in documento unico |
| 2026-03-18 | Rimosso duplicazioni con FINANZE.md, aggiunti rimandi (sezioni 8.1-8.2, 6.3, 6.4) |
| 2026-03-18 | Gap analysis: confermato che KEEP/RELEASE giocatori usciti avviene in fase CONTRATTI (non in fase separata CALCOLO_INDENNIZZI). Codice allineato. |
