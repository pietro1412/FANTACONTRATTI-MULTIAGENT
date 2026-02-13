# BIBBIA: Fase RUBATA - Clausola Rescissoria e Asta

> Documentazione completa del sistema di rubata, asta e trasferimento contratti.
> Ultima revisione: 2026-02-05

---

## 1. PANORAMICA FASE RUBATA

### 1.1 Cos'è la Fase RUBATA
La fase RUBATA è una delle fasi del `MERCATO_RICORRENTE`. Durante questa fase:
- Ogni giocatore con contratto attivo viene esposto al **tabellone rubata**, ordinato per manager
- Qualsiasi manager può **dichiarare una rubata** su un giocatore altrui pagando la **clausola rescissoria + ingaggio**
- Se qualcuno dichiara la rubata, si apre un'**asta al rialzo** tra tutti i manager
- Il vincitore dell'asta acquisisce il giocatore, trasferendo roster e contratto
- Dopo ogni transazione, **tutti** i manager devono **confermare** (acknowledge) prima di procedere

### 1.2 Quando si Attiva
La fase RUBATA si attiva quando:
- Una `MarketSession` ha `status = 'ACTIVE'` e `currentPhase = 'RUBATA'`
- Viene verificato in: `src/services/rubata.service.ts:47-56`

### 1.3 Flusso Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FASE RUBATA                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. SETUP (Admin)                                                    │
│     ├── setRubataOrder(): definisce ordine manager                   │
│     ├── generateRubataBoard(): genera tabellone ordinato             │
│     └── updateRubataTimers(): configura timer offerta/asta           │
│                                                                      │
│  2. READY CHECK (tutti i manager)                                    │
│     └── Ogni manager si dichiara pronto → OFFERING                   │
│                                                                      │
│  3. OFFERING (timer offerta, default 30s)                            │
│     ├── Timer scorre per il giocatore corrente                       │
│     ├── Se qualcuno dichiara rubata → AUCTION_READY_CHECK            │
│     └── Se timer scade senza offerte → avanza al prossimo giocatore  │
│                                                                      │
│  4. AUCTION_READY_CHECK (attesa pronti pre-asta)                     │
│     ├── Annuncio: "X vuole rubare Y a Z per N M"                     │
│     └── Quando tutti pronti → AUCTION                                │
│                                                                      │
│  5. AUCTION (timer asta, default 15s, reset ad ogni rilancio)        │
│     ├── Rilanci al rialzo (amount > currentPrice)                    │
│     ├── Ogni rilancio resetta il timer                               │
│     └── Timer scade → closeCurrentRubataAuction()                    │
│                                                                      │
│  6. PENDING_ACK (conferma transazione)                               │
│     ├── TUTTI i manager devono confermare (acknowledge)              │
│     ├── Opzionale: prophecy (commento social)                        │
│     ├── Vincitore: può modificare contratto (solo aumento)           │
│     └── Quando tutti confermano → READY_CHECK (prossimo giocatore)   │
│                                                                      │
│  7. LOOP → torna a 2 per il prossimo giocatore                      │
│                                                                      │
│  8. COMPLETED quando tutti i giocatori sono stati esaminati          │
│                                                                      │
│  STATI SPECIALI:                                                     │
│     ├── PAUSED: admin può pausare durante OFFERING o AUCTION         │
│     └── WAITING: stato iniziale prima di READY_CHECK                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. MACCHINA A STATI

### 2.1 Tutti gli Stati

| Stato | Descrizione | Timer |
|-------|-------------|-------|
| `WAITING` | Stato iniziale, in attesa dell'admin | No |
| `READY_CHECK` | Manager si dichiarano pronti per il prossimo giocatore | No |
| `OFFERING` | Timer offerta attivo, chiunque può dichiarare rubata | Si (default 30s) |
| `AUCTION_READY_CHECK` | Rubata dichiarata, attesa pronti per l'asta | No |
| `AUCTION` | Asta al rialzo in corso | Si (default 15s, reset a ogni bid) |
| `PENDING_ACK` | Asta chiusa, tutti devono confermare | No |
| `PAUSED` | Admin ha messo in pausa (da OFFERING o AUCTION) | No (salva tempo rimanente) |
| `COMPLETED` | Tutti i giocatori esaminati, fase conclusa | No |

### 2.2 Transizioni

```
WAITING ──[generateRubataBoard()]──► READY_CHECK
                                          │
READY_CHECK ──[tutti pronti]──────► OFFERING
                                      │    │
                 [timer scade, no offerte]  [makeRubataOffer()]
                         │                  │
                [ultimo giocatore?]    AUCTION_READY_CHECK
                    │         │             │
                   Si        No        [tutti pronti]
                    │         │             │
              COMPLETED   OFFERING     AUCTION
                                        │    │
                             [timer scade]   [rilancio]
                                  │          │
                           PENDING_ACK  (reset timer, resta AUCTION)
                                  │
                         [tutti confermano]
                                  │
                        [ultimo giocatore?]
                           │         │
                          Si        No
                           │         │
                     COMPLETED   READY_CHECK

OFFERING ──[pauseRubata()]──► PAUSED ──[tutti pronti]──► OFFERING (ripresa)
AUCTION  ──[pauseRubata()]──► PAUSED ──[tutti pronti]──► AUCTION (ripresa)
```

### 2.3 Timer Close Lazy/Piggyback

**IMPORTANTE:** Non esiste un timer server-side che chiude automaticamente le aste. La chiusura avviene **inside `getRubataBoard()`** quando un client fa polling.

**Codice:** `rubata.service.ts:912-1175`

```
Quando un client chiama getRubataBoard():
  1. Se OFFERING + timer scaduto + nessuna asta → avanza al prossimo giocatore
  2. Se AUCTION + timer scaduto → esegue closeCurrentRubataAuction() inline
  3. Se PENDING_ACK + tutti hanno confermato → avanza a READY_CHECK
```

Questo significa che il timer non si chiude da solo — si chiude quando **qualsiasi client** fa il prossimo poll. Con il polling adattivo (800ms-5000ms), la latenza è minima.

---

## 3. FORMULE DI CALCOLO

### 3.1 Prezzo Rubata (rubataPrice)

```
RUBATA_PRICE = clausolaRescissoria + ingaggio
             = (ingaggio × moltiplicatore) + ingaggio
```

**Codice:** `rubata.service.ts:855`
```typescript
rubataPrice: contract.rescissionClause + contract.salary
```

### 3.2 Clausola Rescissoria

```
CLAUSOLA = ingaggio × moltiplicatore(durata)

Moltiplicatori:
- 4 semestri → 11
- 3 semestri → 9
- 2 semestri → 7
- 1 semestre → 3
```

**Codice:** `src/services/contract.service.ts:21-38`

### 3.3 Tabella Prezzi Rubata Completa

| Ingaggio | Durata | Clausola | Prezzo Rubata |
|----------|--------|----------|---------------|
| 10M | 4s | 110M | **120M** |
| 10M | 3s | 90M | **100M** |
| 10M | 2s | 70M | **80M** |
| 10M | 1s | 30M | **40M** |
| 20M | 4s | 220M | **240M** |
| 20M | 3s | 180M | **200M** |
| 20M | 2s | 140M | **160M** |
| 20M | 1s | 60M | **80M** |

### 3.4 Calcolo Residuo Budget (Box Budget)

```
RESIDUO = currentBudget - totalSalaries
```

Dove:
- `currentBudget`: `LeagueMember.currentBudget` (aggiornato in tempo reale dopo ogni rubata)
- `totalSalaries`: somma di `PlayerContract.salary` di tutti i contratti attivi del manager

**Codice:** `rubata.service.ts:1308-1317`

### 3.5 Tempo Rimanente

```
REMAINING = timerDuration - elapsed
elapsed = floor((now - rubataTimerStartedAt) / 1000)
timerDuration = OFFERING ? rubataOfferTimerSeconds : rubataAuctionTimerSeconds
```

**Codice:** `rubata.service.ts:1252-1264`

### 3.6 Scomposizione Prezzo Rubata: OFFERTA + INGAGGIO

**CRITICO:** Il prezzo totale della rubata si scompone SEMPRE in due parti:

```
PREZZO TOTALE = OFFERTA + INGAGGIO

- OFFERTA: parte dalla clausola, sale con i rilanci. Si trasferisce come budget.
- INGAGGIO: salario originale del giocatore. Fisso, NON cambia con i rilanci.
```

**Esempio con rilanci:**

| Azione | Totale | = Offerta | + Ingaggio |
|--------|--------|-----------|------------|
| B dichiara rubata | 48 | 44 (clausola) | 4 |
| C rilancia | 49 | 45 | 4 |
| B rilancia | 50 | 46 | 4 |

### 3.7 Impatto Finanziario

**Venditore (perde il giocatore):**
```
Budget += OFFERTA (solo la parte offerta, non il totale)
Monte Ingaggi: giocatore esce (effetto al prossimo consolidamento)
Bilancio += OFFERTA + INGAGGIO_RISPARMIATO
```

**Acquirente (vince il giocatore):**
```
Budget -= OFFERTA (solo la parte offerta)
Monte Ingaggi: giocatore entra con nuovo ingaggio (effetto al prossimo consolidamento)
Bilancio -= OFFERTA + NUOVO_INGAGGIO (originale o modificato)
```

**Verifica zero-sum (senza modifica):**
- Venditore: +offerta +ingaggio = +totale
- Acquirente: -offerta -ingaggio = -totale
- Netto: 0. Nessun soldo dal nulla.

**Con modifica contratto:**
- Il costo aggiuntivo (delta ingaggio) è sostenuto solo dall'acquirente
- NON va al venditore

Vedi **Bibbia FINANZE.md** sezione 3 per il modello completo con esempi numerici.

---

## 4. REGOLE DI BUSINESS

### 4.1 Chi Può Dichiarare Rubata
- Qualsiasi manager attivo **tranne** il proprietario del giocatore
- **NON può rubare un giocatore che era suo a inizio mercato ricorrente** ma che ha cambiato squadra nella fase 1 (offerte e scambi). Il manager deve vedere chiaramente che il giocatore non è rubabile perché ceduto nella fase precedente.
- Il manager deve avere bilancio sufficiente: `bilancio >= rubataPrice` (clausola + ingaggio)
- Lo stato deve essere `OFFERING` e il timer non deve essere scaduto
- Non deve esserci già un'asta in corso per quel giocatore

**Codice:** `rubata.service.ts:1482-1639` (makeRubataOffer)

### 4.2 Chi Può Rilanciare
- Qualsiasi manager attivo **tranne** il proprietario (seller)
- Il rilancio deve essere strettamente maggiore di `currentPrice`
- Il manager deve avere **bilancio** sufficiente: `bilancio >= amount`
- Lo stato deve essere `AUCTION`

**Codice:** `rubata.service.ts:1643-1761` (bidOnRubataAuction)

### 4.3 Trasferimento Contratto (NON ricreazione)

**CRITICO:** La rubata **trasferisce** il record `PlayerContract` e `PlayerRoster` al vincitore. NON elimina e ricrea il contratto.

```typescript
// Trasferimento roster
await tx.playerRoster.update({
  where: { id: rosterEntry.id },
  data: {
    leagueMemberId: winningBid.bidderId,
    acquisitionType: 'RUBATA',
    acquisitionPrice: payment,
  },
})

// Trasferimento contratto
await tx.playerContract.update({
  where: { id: rosterEntry.contract.id },
  data: { leagueMemberId: winningBid.bidderId },
})
```

**Codice:** `rubata.service.ts:2001-2017` (closeCurrentRubataAuction)

Questo significa che:
- `salary`, `duration`, `rescissionClause`, `initialSalary` **restano invariati**
- Solo `leagueMemberId` cambia (dal venditore al vincitore)
- Il contratto mantiene tutta la sua storia

### 4.4 Trasferimento Budget (Atomico)

Il trasferimento economico è **atomico** (dentro una `$transaction`) e riguarda **solo la componente OFFERTA**:

```
OFFERTA = prezzo_finale - ingaggio (= clausola + eventuali rilanci)

Winner:  currentBudget -= OFFERTA
Seller:  currentBudget += OFFERTA
```

**Monte Ingaggi** si aggiorna automaticamente con il trasferimento del contratto:
- Winner: Monte Ingaggi += salary (giocatore entra in rosa)
- Seller: Monte Ingaggi -= salary (giocatore esce da rosa)

**Impatto su Bilancio** (Budget - Monte Ingaggi):
- Winner: bilancio -= OFFERTA + salary = prezzo_totale
- Seller: bilancio += OFFERTA + salary = prezzo_totale

**Codice:** `rubata.service.ts:1989-1999`

**Nota:** Il `prezzo_finale` può essere maggiore del `rubataPrice` iniziale se ci sono stati rilanci. I rilanci aumentano solo la componente OFFERTA, non l'ingaggio.

### 4.5 Conferma Obbligatoria (PENDING_ACK)

Dopo ogni transazione rubata:
1. **TUTTI** i manager attivi devono confermare (acknowledge)
2. La modale resta aperta finché non hanno confermato **tutti** (non solo l'utente corrente)
3. Ogni manager può opzionalmente lasciare una "profezia" (commento social)
4. Solo dopo che tutti hanno confermato si procede al prossimo giocatore

**Codice:** `rubata.service.ts:2819-2957` (acknowledgeRubataTransaction)

### 4.6 Modifica Contratto Post-Acquisizione

Il vincitore della rubata può **opzionalmente** modificare il contratto del giocatore appena acquisito, con regole **increase-only**:

| Regola | Dettaglio |
|--------|-----------|
| Ingaggio | Può solo **aumentare** (no diminuzione) |
| Durata | Può solo **aumentare** (no diminuzione) |
| Spalma | **NON disponibile** |
| Taglio | **NON disponibile** |
| Aumento durata | Richiede **prima** un aumento di ingaggio |
| Durata massima | 4 semestri |

**Validazione frontend:** `src/components/ContractModifier.tsx:38-48` (increaseOnly mode)

**Validazione backend:** `src/services/contract.service.ts:1915-1927`
```typescript
// Post-acquisition: only increase allowed (no spalma, no taglio)
if (newSalary < contract.salary) → errore
if (newDuration < contract.duration) → errore
if (newDuration > contract.duration && newSalary <= contract.salary) → errore
if (newDuration > MAX_DURATION) → errore
```

**Quando appare la modale:** Dopo che TUTTI i manager hanno confermato, il frontend rileva la transizione di stato da `PENDING_ACK` a `READY_CHECK` e mostra la modale al vincitore.

**Codice frontend:** `Rubata.tsx` — `pendingWinnerContractRef` + useEffect su `boardData.rubataState`

### 4.7 Ordinamento Tabellone

Il tabellone è ordinato per:
1. **Ordine rubata dei manager** (definito dall'admin con `setRubataOrder()`)
2. Per ogni manager, giocatori ordinati per **ruolo** (P→D→C→A) poi per **nome**

**Codice:** `rubata.service.ts:791-838` (generateRubataBoard)

```typescript
const positionOrder = { P: 1, D: 2, C: 3, A: 4 }
// Sort: position first, then name alphabetically
```

### 4.8 Timer e Reset

| Timer | Default | Reset? | Quando |
|-------|---------|--------|--------|
| Offer Timer | 30s | No | Parte all'inizio di OFFERING per ogni giocatore |
| Auction Timer | 15s | **Si** | Si resetta ad ogni rilancio (`bidOnRubataAuction`) |

**Timer configurabili dall'admin:** `rubata.service.ts:1425-1477` (updateRubataTimers)

---

## 5. PERSISTENZA DATI

### 5.1 Campi MarketSession (JSON)

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `rubataOrder` | Json (string[]) | Ordine dei manager per la rubata |
| `rubataBoard` | Json (BoardPlayer[]) | Tabellone completo con tutti i giocatori |
| `rubataBoardIndex` | Int | Indice del giocatore corrente nel tabellone |
| `rubataOfferTimerSeconds` | Int (default 30) | Durata timer offerta |
| `rubataAuctionTimerSeconds` | Int (default 15) | Durata timer asta |
| `rubataTimerStartedAt` | DateTime | Timestamp di avvio timer corrente |
| `rubataState` | String | Stato corrente della macchina a stati |
| `rubataReadyMembers` | Json (string[]) | Manager che si sono dichiarati pronti |
| `rubataAuctionReadyInfo` | Json | Info annuncio rubata durante AUCTION_READY_CHECK |
| `rubataPendingAck` | Json | Dati conferma dopo chiusura asta |
| `rubataPausedRemainingSeconds` | Int | Secondi rimanenti al momento della pausa |
| `rubataPausedFromState` | String | Stato da cui è stata messa in pausa |

**Schema Prisma:** `prisma/schemas/market-session.prisma:39-61`

### 5.2 Struttura rubataPendingAck (JSON)

```typescript
{
  auctionId: string
  playerId: string
  playerName: string
  playerTeam: string
  playerPosition: string
  winnerId: string | null
  winnerUsername: string | null
  sellerId: string
  sellerUsername: string
  finalPrice: number
  acknowledgedMembers: string[]  // Array di leagueMemberId
  prophecies?: Array<{
    memberId: string
    username: string
    content: string
    createdAt: string
  }>
}
```

### 5.3 Struttura rubataBoard Entry (JSON)

```typescript
{
  rosterId: string
  memberId: string           // proprietario
  playerId: string
  playerName: string
  playerPosition: 'P' | 'D' | 'C' | 'A'
  playerTeam: string
  playerQuotation: number
  playerAge: number | null
  playerApiFootballId: number | null
  playerApiFootballStats: unknown
  ownerUsername: string
  ownerTeamName: string | null
  rubataPrice: number        // clausola + ingaggio
  contractSalary: number
  contractDuration: number
  contractClause: number
  stolenById?: string | null      // popolato dopo rubata
  stolenByUsername?: string | null // popolato dopo rubata
  stolenPrice?: number | null     // popolato dopo rubata
}
```

### 5.4 Tabelle Relazionali Coinvolte

| Tabella | Scopo nella Rubata |
|---------|-------------------|
| `Auction` | Record asta (type='RUBATA', include bids, winner, seller) |
| `AuctionBid` | Singoli rilanci (amount, bidderId, isWinning) |
| `AuctionAppeal` | Ricorsi contro aste completate |
| `PlayerRoster` | Trasferito al vincitore (leagueMemberId, acquisitionType='RUBATA') |
| `PlayerContract` | Trasferito al vincitore (leagueMemberId cambia) |
| `PlayerMovement` | Record storico del trasferimento |
| `LeagueMember` | Budget aggiornato (currentBudget ±= payment) |
| `RubataPreference` | Preferenze strategiche pre-rubata |

### 5.5 PlayerMovement (Record Storico)

Dopo ogni rubata, viene registrato un `PlayerMovement`:

```typescript
await recordMovement({
  leagueId,
  playerId,
  movementType: 'RUBATA',
  fromMemberId: sellerId,
  toMemberId: buyerId,
  price: finalPrice,
  marketSessionId,
  auctionId,
  oldSalary, oldDuration, oldClause,   // contratto pre-trasferimento
  newSalary, newDuration, newClause,    // uguale (contratto non cambia)
})
```

**Codice:** `rubata.service.ts:2040-2055`

---

## 6. SISTEMA DI RICORSI (APPEAL)

### 6.1 Quando si Può Fare Ricorso

Qualsiasi manager può presentare ricorso contro un'asta completata, durante la fase PENDING_ACK.

### 6.2 Flusso Ricorso Accettato

```
RICORSO ACCETTATO (admin)
│
├── 1. Annulla il trasferimento:
│   ├── Elimina roster + contratto dal vincitore
│   ├── Ripristina budget vincitore (+= prezzo)
│   ├── Elimina PlayerMovement
│   └── Elimina AuctionAcknowledgment
│
├── 2. Mette asta in AWAITING_RESUME
│   ├── winnerId = null
│   ├── currentPrice rimane (asta riprende dall'ultima offerta)
│   └── Tutti devono confermare pronti per riprendere
│
└── 3. Asta riprende da dove era
```

**Codice:** `src/services/auction.service.ts:3829-3942`

### 6.3 Flusso Ricorso Respinto

```
RICORSO RESPINTO (admin)
│
├── 1. Appeal.status = 'REJECTED'
│
├── 2. Auction.status = AWAITING_APPEAL_ACK
│   └── Tutti i manager devono confermare la decisione
│
└── 3. Dopo conferma → la rubata procede normalmente
```

**Codice:** `src/services/auction.service.ts:3950-3975`

---

## 7. PAUSA E RIPRESA

### 7.1 Pausa

L'admin può mettere in pausa la rubata solo durante `OFFERING` o `AUCTION`.

**Cosa succede:**
- Salva `rubataPausedFromState` (stato da cui si è messa in pausa)
- Salva `rubataPausedRemainingSeconds` (tempo rimanente nel timer)
- Stato → `PAUSED`
- Timer fermato (`rubataTimerStartedAt = null`)

**Codice:** `rubata.service.ts:2153-2216`

### 7.2 Ripresa

Alla ripresa, tutti i manager devono dichiararsi pronti (READY_CHECK in PAUSED state).

**Quando tutti pronti:**
- Calcola `adjustedStartTime = now - (totalSeconds - remainingSeconds) * 1000`
- Stato → `rubataPausedFromState` (OFFERING o AUCTION)
- Timer riprende con il tempo rimanente salvato

**Codice:** `rubata.service.ts:2534-2563` (setRubataReady → resume logic)

---

## 8. REAL-TIME (PUSHER + POLLING)

### 8.1 Eventi Pusher

| Evento | Trigger | Payload |
|--------|---------|---------|
| `steal-declared` | Qualcuno dichiara rubata | bidder, player, basePrice |
| `bid-placed` | Rilancio in asta | bidder, amount, playerName |
| `auction-closed` | Asta chiusa | player, winner, finalPrice, wasUnsold |
| `ready-changed` | Manager si dichiara pronto | memberId, readyCount, totalMembers |

**Codice:** `src/services/pusher.service.ts`

### 8.2 Polling Adattivo

Il frontend (`Rubata.tsx`) usa polling con intervalli adattivi:

| Condizione | Intervallo |
|------------|------------|
| `OFFERING` o `AUCTION` (timer attivo) | **800ms** |
| Pusher connesso | **2500ms** |
| Pusher disconnesso | **1500ms** |
| Altri stati | **5000ms** |

Due endpoint vengono alternati per ridurre il carico:
- `getRubataBoard()` — full board con tutti i dati (ogni N poll)
- `getRubataStatus()` — solo stato + timer + auction info (poll leggeri)

### 8.3 Fetch PendingAck al Cambio Stato

**Fix critico (v1.5):** Quando il server auto-chiude un'asta dentro `getRubataBoard()`, lo stato transita a `PENDING_ACK` ma il client non ha ancora i dati `pendingAck`. Il frontend fa una fetch aggiuntiva:

```typescript
// Se stato è PENDING_ACK, fetch immediato dei dati pendingAck
if (data.rubataState === 'PENDING_ACK') {
  const ackRes = await rubataApi.getPendingAck(leagueId)
  if (ackRes.success) {
    setPendingAck(ackRes.data)
  }
}
```

Questo avviene sia in `loadFast()` che in `loadBoardOnly()`.

---

## 9. FUNZIONI PRINCIPALI

### 9.1 Backend — `rubata.service.ts`

| Funzione | Riga | Descrizione |
|----------|------|-------------|
| `registerRubataHeartbeat()` | 22 | Registra heartbeat per connessione manager |
| `getRubataConnectionStatus()` | 29 | Stato connessione dei manager (timeout 10s) |
| `setRubataOrder()` | 60 | Admin: imposta ordine dei manager |
| `getRubataOrder()` | 129 | Legge ordine corrente |
| `getCurrentRubataTurn()` | 168 | Turno corrente con stato giocatore |
| `getRubablePlayers()` | 251 | Lista giocatori rubabili per un manager |
| `putPlayerOnPlate()` | 316 | Mette giocatore in vendita (legacy) |
| `bidOnRubata()` | 424 | Rilancio su rubata (legacy) |
| `closeRubataAuction()` | 515 | Chiude asta rubata (legacy) |
| `skipRubataTurn()` | 682 | Salta turno manager (legacy) |
| `generateRubataBoard()` | 756 | Genera tabellone ordinato |
| `getRubataBoard()` | 883 | **CORE**: legge board + auto-advance + auto-close + memberBudgets |
| `startRubata()` | 1367 | Admin: avvia la rubata (stato → OFFERING, index=0) |
| `updateRubataTimers()` | 1425 | Admin: modifica durata timer |
| `makeRubataOffer()` | 1482 | Manager dichiara rubata → crea Auction → AUCTION_READY_CHECK |
| `bidOnRubataAuction()` | 1643 | Rilancio in asta (amount > currentPrice, reset timer) |
| `advanceRubataPlayer()` | 1765 | Admin: avanza al prossimo giocatore |
| `goBackRubataPlayer()` | 1839 | Admin: torna al giocatore precedente |
| `closeCurrentRubataAuction()` | 1896 | **CORE**: chiude asta, trasferisce contratto/roster/budget, crea PENDING_ACK |
| `pauseRubata()` | 2153 | Admin: mette in pausa |
| `resumeRubata()` | 2218 | Admin: richiede ripresa (trigger ready check) |
| `getRubataStatus()` | 2274 | Status leggero (solo stato + timer + auction) |
| `getRubataReadyStatus()` | 2362 | Lista manager pronti/non pronti |
| `setRubataReady()` | 2429 | Manager si dichiara pronto (gestisce tutte le transizioni) |
| `forceAllRubataReady()` | 2581 | Admin: forza tutti pronti |
| `getRubataPendingAck()` | 2703 | Legge dati PENDING_ACK + contractInfo per vincitore |
| `acknowledgeRubataTransaction()` | 2819 | Manager conferma transazione + prophecy |
| `forceAllRubataAcknowledge()` | 2959 | Admin: forza tutte le conferme |
| `simulateRubataOffer()` | 3006 | Admin: simula offerta di un manager |
| `simulateRubataBid()` | 3167 | Admin: simula rilancio di un manager |
| `completeRubataWithTransactions()` | 3281 | Admin: completa rubata con transazioni random |
| `getRubataPreferences()` | 3486 | Legge preferenze strategiche |
| `setRubataPreference()` | 3565 | Salva preferenza su un giocatore |
| `deleteRubataPreference()` | 3682 | Elimina preferenza |
| `getAllPlayersForStrategies()` | 3754 | Tutti i giocatori per vista strategie |
| `getAllSvincolatiForStrategies()` | 3944 | Svincolati per vista strategie |
| `getRubataPreviewBoard()` | 4074 | Preview tabellone (prima di generare) |
| `setRubataToPreview()` | 4159 | Admin: imposta stato PREVIEW |

### 9.2 Backend — `auction.service.ts` (Ricorsi)

| Funzione | Riga | Descrizione |
|----------|------|-------------|
| `resolveAppeal()` | 3787 | Admin: accetta o respinge ricorso |
| `acknowledgeAppealDecision()` | 3981 | Manager: conferma decisione ricorso |

### 9.3 Backend — `contract.service.ts`

| Funzione | Riga | Descrizione |
|----------|------|-------------|
| `modifyContractPostAcquisition()` | 1882 | Modifica contratto post-rubata (increase-only) |

### 9.4 Frontend — `Rubata.tsx`

Componente principale: `export function Rubata()` (riga 349)

| Aspetto | Dettaglio |
|---------|-----------|
| **Colonne tabellone** | #, Giocatore, Ruolo, Età, Proprietario, Ing., Dur., Claus., Rubata, Nuovo Prop., Strategia |
| **Mobile** | Cards responsive con badge ruolo, età, foto giocatore |
| **Box Budget** | Desktop: pannello collassabile sopra tabella. Mobile: footer fisso espandibile |
| **PENDING_ACK modal** | Resta aperta finché `!pendingAck.allAcknowledged`. Dopo conferma utente: "Hai confermato (X/N)" |
| **Contract modal** | Appare al vincitore DOPO che tutti confermano (watch `boardData.rubataState`) |
| **Polling** | `loadFast()` ogni 800ms-5000ms + `loadBoardOnly()` alternato |

---

## 10. EDGE CASES E BUG NOTI RISOLTI

### 10.1 PENDING_ACK Saltato (Bug #242, v1.5)

**Problema:** `getRubataBoard()` auto-advance controllava `auction.status === 'COMPLETED'` per saltare PENDING_ACK. Ma l'asta è **sempre** COMPLETED dopo la chiusura — questa condizione era sempre vera.

**Fix:** Controllare `acknowledgedMembers` array invece di auction status.

**Codice:** `rubata.service.ts:1177-1217`
```typescript
// CORRETTO: controllare se TUTTI hanno confermato
const allAcknowledged = allMembers.every(m =>
  pendingAck.acknowledgedMembers.includes(m.id)
)
if (allAcknowledged) {
  // Solo ora avanza a READY_CHECK
}
```

### 10.2 Modale Chiusa Prematuramente

**Problema:** Condizione `!pendingAck.userAcknowledged` faceva sparire la modale quando l'utente corrente confermava, prima che tutti avessero confermato.

**Fix:** Condizione cambiata in `!pendingAck.allAcknowledged`. Dopo la conferma, mostra "Hai confermato (X/N)" invece di chiudere.

### 10.3 Modale Contratto Non Apparsa

**Problema:** `useEffect` watchava `pendingAck?.allAcknowledged`, ma il backend clears `pendingAck` atomicamente con la transizione a `READY_CHECK`. Il frontend **mai** osserva `allAcknowledged = true`.

**Fix:** Watch `boardData.rubataState` tramite ref:
```typescript
// Salva contractInfo in ref durante acknowledge
pendingWinnerContractRef.current = contractInfo

// Quando lo stato transita fuori da PENDING_ACK, mostra modale
useEffect(() => {
  if (state !== 'PENDING_ACK' && pendingWinnerContractRef.current) {
    setPendingContractModification(pendingWinnerContractRef.current)
    pendingWinnerContractRef.current = null
  }
}, [boardData?.rubataState])
```

### 10.4 Budget Negativo Possibile

Il sistema **non impedisce** budget negativi. Un manager può rilanciare fino al suo budget corrente, ma se vince con un importo che lo porta in negativo (per errori di timing tra rilancio e check), il budget diventa negativo. Questo è gestibile dall'admin.

### 10.5 Proprietario Non Può Rilanciare

Il venditore (`sellerId`) **non può** partecipare all'asta per il proprio giocatore. Questo è enforced sia nel frontend (bottone disabilitato) che nel backend.

---

## 11. PREFERENZE STRATEGICHE

### 11.1 Cosa Sono

Prima della rubata, ogni manager può impostare preferenze sui giocatori:

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `isWatchlist` | boolean | Giocatore nella watchlist (interesse) |
| `isAutoPass` | boolean | Auto-passa (non fare offerte) |
| `maxBid` | number? | Bid massimo automatico |
| `priority` | number? | Priorità (ordinamento preferenze) |
| `notes` | string? | Note personali |

### 11.2 Modello Prisma

**Schema:** `prisma/schemas/rubata.prisma`

```prisma
model RubataPreference {
  id              String       @id @default(cuid())
  leagueMemberId  String
  playerId        String
  marketSessionId String
  isWatchlist     Boolean      @default(false)
  isAutoPass      Boolean      @default(false)
  maxBid          Int?
  priority        Int?
  notes           String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}
```

### 11.3 Utilizzo nel Tabellone

Nel tabellone desktop, la colonna "Strategia" mostra:
- Badge watchlist (stella)
- Badge auto-pass (skip)
- Max bid se impostato
- Note se presenti

---

## 12. API ENDPOINTS

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/rubata/:leagueId/order` | GET/POST | Ordine rubata |
| `/api/rubata/:leagueId/board` | GET | Tabellone completo (getRubataBoard) |
| `/api/rubata/:leagueId/board/generate` | POST | Genera tabellone |
| `/api/rubata/:leagueId/start` | POST | Avvia rubata |
| `/api/rubata/:leagueId/offer` | POST | Dichiara rubata |
| `/api/rubata/:leagueId/bid` | POST | Rilancia in asta |
| `/api/rubata/:leagueId/close-auction` | POST | Chiudi asta (admin) |
| `/api/rubata/:leagueId/advance` | POST | Avanza giocatore (admin) |
| `/api/rubata/:leagueId/go-back` | POST | Torna indietro (admin) |
| `/api/rubata/:leagueId/pause` | POST | Pausa (admin) |
| `/api/rubata/:leagueId/resume` | POST | Ripresa (admin) |
| `/api/rubata/:leagueId/status` | GET | Status leggero |
| `/api/rubata/:leagueId/ready` | POST | Dichiara pronto |
| `/api/rubata/:leagueId/ready/force` | POST | Forza tutti pronti (admin) |
| `/api/rubata/:leagueId/pending-ack` | GET | Dati conferma |
| `/api/rubata/:leagueId/acknowledge` | POST | Conferma transazione |
| `/api/rubata/:leagueId/acknowledge/force` | POST | Forza conferme (admin) |
| `/api/rubata/:leagueId/timers` | PUT | Modifica timer (admin) |
| `/api/rubata/:leagueId/preferences` | GET/POST/DELETE | Preferenze strategiche |
| `/api/rubata/:leagueId/complete-with-transactions` | POST | Completa con random (admin) |
| `/api/rubata/:leagueId/simulate-offer` | POST | Simula offerta (admin) |
| `/api/rubata/:leagueId/simulate-bid` | POST | Simula rilancio (admin) |
| `/api/contracts/modify-post-acquisition` | POST | Modifica contratto post-rubata |

**Route file:** `src/api/routes/rubata.ts`

---

## 13. FILE CHIAVE

| File | Responsabilità |
|------|----------------|
| `src/services/rubata.service.ts` | **CORE**: tutta la logica business rubata (~4200 righe) |
| `src/services/auction.service.ts` | Sistema ricorsi (`resolveAppeal`, `acknowledgeAppealDecision`) |
| `src/services/contract.service.ts` | `modifyContractPostAcquisition()` — modifica contratto post-rubata |
| `src/services/movement.service.ts` | `recordMovement()` — registra trasferimenti |
| `src/services/pusher.service.ts` | Eventi real-time (steal, bid, close, ready) |
| `src/pages/Rubata.tsx` | Frontend completo (~3200 righe) |
| `src/components/ContractModifier.tsx` | Modale modifica contratto (increaseOnly mode) |
| `src/api/routes/rubata.ts` | Definizione route API |
| `prisma/schemas/market-session.prisma` | Campi rubata nel MarketSession |
| `prisma/schemas/rubata.prisma` | Modello RubataPreference + schema target |
| `prisma/schemas/auction.prisma` | Modello Auction, AuctionBid, AuctionAppeal |

---

## 14. ESEMPI PRATICI

### 14.1 Esempio Rubata Senza Rilanci

**Situazione:**
- Giocatore: Barella, contratto 15M × 3s
- Clausola: 15 × 9 = 135M
- Prezzo rubata: 135 + 15 = **150M**

**Manager A dichiara rubata:**
- Nessun altro rilancia
- Timer asta scade → A vince a 150M

**Dopo la rubata (prezzo totale 150M = OFFERTA 135M + ingaggio 15M):**
- Manager A: budget -= 135M (OFFERTA), Monte Ingaggi += 15M → bilancio -= 150M
- Proprietario: budget += 135M (OFFERTA), Monte Ingaggi -= 15M → bilancio += 150M
- Contratto Barella (15M × 3s) trasferito invariato ad A

### 14.2 Esempio Rubata Con Rilanci

**Situazione:**
- Giocatore: Vlahovic, contratto 20M × 2s
- Clausola: 20 × 7 = 140M
- Prezzo rubata: 140 + 20 = **160M**

**Flusso:**
1. Manager B dichiara rubata a 160M → AUCTION_READY_CHECK
2. Tutti pronti → AUCTION (timer 15s)
3. Manager C rilancia a 165M → timer reset 15s
4. Manager B rilancia a 170M → timer reset 15s
5. Timer scade → B vince a 170M

**Dopo (prezzo totale 170M = OFFERTA 150M + ingaggio 20M):**
- Manager B: budget -= 150M (OFFERTA), Monte Ingaggi += 20M → bilancio -= 170M
- Proprietario: budget += 150M (OFFERTA), Monte Ingaggi -= 20M → bilancio += 170M
- Contratto Vlahovic (20M × 2s) trasferito invariato a B

### 14.3 Esempio Modifica Contratto Post-Rubata

**Manager B ha appena rubato Vlahovic (contratto 20M × 2s):**
- Modale appare dopo che tutti confermano
- B decide di aumentare: 22M × 3s
- Nuova clausola: 22 × 9 = 198M
- Nuovo prezzo rubata futuro: 198 + 22 = 220M

**Nota:** La modifica NON impatta il budget. L'aumento di ingaggio (da 20M a 22M) si rifletterà nel monte ingaggi alla prossima fase CONTRATTI.

---

## 15. VERIFICHE E TEST

### 15.1 Checklist Funzionale

- [ ] Tabellone generato con ordinamento corretto (manager order → ruolo → nome)
- [ ] Prezzo rubata = clausola + ingaggio
- [ ] Timer offerta: scade → avanza al prossimo giocatore
- [ ] Dichiarazione rubata: stato → AUCTION_READY_CHECK
- [ ] Tutti pronti: stato → AUCTION con timer
- [ ] Rilancio: amount > currentPrice, timer reset
- [ ] Timer asta scade: trasferimento + PENDING_ACK
- [ ] PENDING_ACK: modale resta aperta finché TUTTI confermano
- [ ] Vincitore: modale contratto appare DOPO conferma di tutti
- [ ] Modifica contratto: solo increase (no spalma, no taglio)
- [ ] Budget trasferito atomicamente (winner -=, seller +=)
- [ ] Contratto/roster trasferiti (NON ricreati)
- [ ] Pausa/Ripresa: salva e ripristina tempo rimanente
- [ ] Ricorso accettato: rollback completo + asta riprende
- [ ] Ricorso respinto: tutti confermano decisione, poi procede
- [ ] Box budget aggiornato in real-time (polling)

### 15.2 Test Lista Rubata (Manuale)

| # | Azione | Risultato Atteso |
|---|--------|-----------------|
| 1 | Admin genera tabellone | Board con tutti i giocatori, ordinati per manager/ruolo/nome |
| 2 | Admin avvia rubata | Stato READY_CHECK, tutti devono confermare |
| 3 | Tutti pronti | Stato OFFERING, timer parte per il primo giocatore |
| 4 | Timer scade senza offerte | Avanza al giocatore successivo |
| 5 | Manager dichiara rubata | Stato AUCTION_READY_CHECK, annuncio visibile |
| 6 | Tutti pronti per asta | Stato AUCTION, timer asta parte |
| 7 | Rilancio | Timer resettato, nuovo prezzo mostrato |
| 8 | Timer asta scade | Trasferimento eseguito, PENDING_ACK |
| 9 | Manager conferma | Mostra "Hai confermato (X/N)" |
| 10 | Tutti confermano | Modale si chiude, READY_CHECK per prossimo |
| 11 | Vincitore: modale contratto | Appare dopo step 10, permette solo aumento |
| 12 | Admin pausa durante asta | PAUSED, tempo salvato |
| 13 | Tutti pronti dopo pausa | Timer riprende dal tempo salvato |
| 14 | Ultimo giocatore esaminato | Stato COMPLETED |

---

## 16. CHANGELOG

| Data | Modifica |
|------|----------|
| 2026-02-05 | Creazione documento iniziale con tutta la documentazione della fase rubata |
| 2026-02-06 | Aggiunta regola ex-giocatore (4.1), scomposizione prezzo offerta+ingaggio (3.6-3.7), correzione verifica budget da currentBudget a bilancio |
