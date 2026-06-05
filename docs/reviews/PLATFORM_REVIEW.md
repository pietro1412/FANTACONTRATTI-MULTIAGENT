# Fantacontratti - Analisi Completa della Piattaforma

> Documento generato automaticamente. Revisione funzionale e tecnica approfondita.
> Data: 2026-02-12 | Branch: `develop` | Ultimo commit: `ad77531`

---

## Indice

1. [Executive Summary](#1-executive-summary)
2. [Architettura Generale](#2-architettura-generale)
3. [Modello Dati (Database)](#3-modello-dati)
4. [Fasi di Mercato e Regole di Business](#4-fasi-di-mercato)
5. [Sistema Contratti](#5-sistema-contratti)
6. [Sistema Scambi (Trade)](#6-sistema-scambi)
7. [Sistema Aste](#7-sistema-aste)
8. [Rubata](#8-rubata)
9. [Svincolati](#9-svincolati)
10. [Sistema Premi e Indennizzi](#10-sistema-premi-e-indennizzi)
11. [Statistiche Giocatori e API-Football](#11-statistiche-giocatori)
12. [Layer API (278 Endpoint)](#12-layer-api)
13. [Frontend (37 Pagine, 100+ Componenti)](#13-frontend)
14. [Infrastruttura e Sicurezza](#14-infrastruttura-e-sicurezza)
15. [Real-Time e Notifiche Push](#15-real-time-e-notifiche)
16. [Deployment e Configurazione](#16-deployment)
17. [Formule Finanziarie](#17-formule-finanziarie)
18. [Matrice di Validazione Operazioni](#18-matrice-validazione)
19. [Metriche e Numeri Chiave](#19-metriche)

---

## 1. Executive Summary

**Fantacontratti** e' una piattaforma web per la gestione di leghe di fantacalcio "dynasty" con contratti pluriennali. A differenza del fantacalcio classico, i giocatori vengono acquistati tramite aste in tempo reale e vincolati con contratti che hanno durata, ingaggio e clausola rescissoria.

### Stack Tecnologico
| Layer | Tecnologia |
|-------|-----------|
| Frontend | React 19 + TypeScript + Tailwind CSS + Vite 7.3 |
| Backend API | Express.js 5 + Node.js (Serverless su Vercel) |
| Database | PostgreSQL 16 (Neon in produzione, Docker in sviluppo) |
| ORM | Prisma 5.22 con schema modulare (18 file) |
| Real-Time | Pusher WebSocket (eventi batchati) |
| Notifiche | Web Push (VAPID) |
| Autenticazione | JWT + Refresh Token con rotazione e rilevamento furto |
| Deploy | Vercel (regione Frankfurt) con cron job integrati |

### Numeri Chiave
| Metrica | Valore |
|---------|--------|
| Modelli DB | 40 |
| Enum DB | 19 |
| Endpoint API | 278 |
| Route File | 22 |
| Pagine Frontend | 37 |
| Componenti React | 100+ |
| Fasi di Mercato | 8 |
| Servizi Backend | 30 |

### Ruoli Utente
| Ruolo | Scope | Funzionalita' Principali |
|-------|-------|-------------------------|
| **SuperAdmin** | Piattaforma | Gestione giocatori, utenti, leghe, import quotazioni, sync API-Football |
| **Admin Lega** | Singola lega | Gestione fasi, membri, aste, premi, export dati |
| **Manager** | Singola lega | Partecipa ad aste, gestisce rosa/contratti, propone scambi |

---

## 2. Architettura Generale

### 2.1 Diagramma di Alto Livello

```
                    +-----------+
                    |  Vercel   |
                    |  CDN/Edge |
                    +-----+-----+
                          |
            +-------------+-------------+
            |                           |
    +-------v-------+         +--------v--------+
    |   Frontend     |         |   API Server    |
    |   React SPA    |         |   Express.js    |
    |   (dist/)      |         |   (api/index.mjs)|
    +-------+--------+         +--------+--------+
            |                           |
            |    WebSocket (Pusher)     |
            +<--------->+<------------>+
            |           |              |
            |    +------v------+  +----v-----+
            |    | Pusher Cloud|  | Neon DB  |
            |    +-------------+  |PostgreSQL|
            |                     +----+-----+
            |                          |
    +-------v--------+         +------v------+
    | Service Worker |         |API-Football |
    | (Web Push)     |         | (External)  |
    +----------------+         +-------------+
```

### 2.2 Flusso di Autenticazione

```
1. Login: POST /api/auth/login
   -> Verifica credenziali (bcrypt)
   -> Genera accessToken (JWT, 15 min)
   -> Genera refreshToken (JWT, 7 giorni, famiglia)
   -> Salva hash refreshToken in DB
   -> Set cookie httpOnly "refreshToken"
   -> Risposta: { accessToken, user }

2. Ogni richiesta API:
   -> Header: Authorization: Bearer {accessToken}
   -> Middleware verifica JWT
   -> Se scaduto: client chiama POST /api/auth/refresh
     -> Verifica refreshToken dal cookie
     -> Controlla famiglia token (anti-furto)
     -> Genera nuovi token (stessa famiglia)
     -> Risposta: { accessToken }

3. Rilevamento furto token:
   -> Se refreshToken gia' usato (replay attack)
   -> Revoca intera famiglia di token
   -> Utente costretto a ri-loggarsi
```

### 2.3 Pattern Architetturali

- **Monorepo**: Frontend e backend nello stesso repository
- **API proxy in dev**: Vite proxia `/api` verso `localhost:3003`
- **Serverless in prod**: Express bundlato come singola function Vercel
- **Schema modulare Prisma**: 18 file `.prisma` in `prisma/schemas/`, generati in `schema.generated.prisma`
- **Lazy loading**: Pagine React caricate on-demand con `React.lazy()`
- **Virtual scrolling**: Per liste 1000+ giocatori (`@tanstack/react-virtual`)
- **Batch Pusher events**: Eventi raggruppati ogni 100ms per ridurre API call

---

## 3. Modello Dati

### 3.1 Mappa Entita' Principali

```
User ──1:N──> LeagueMember ──N:1──> League
                   │
                   ├──1:N──> PlayerRoster ──N:1──> SerieAPlayer
                   │              │
                   │              ├──1:1──> PlayerContract
                   │              └──1:1──> DraftContract
                   │
                   ├──1:N──> AuctionBid ──N:1──> Auction
                   ├──1:N──> Prophecy
                   └──1:N──> RubataPreference

League ──1:N──> MarketSession
                    │
                    ├──1:N──> Auction ──1:N──> AuctionBid
                    ├──1:N──> TradeOffer
                    ├──1:N──> PlayerMovement
                    ├──1:N──> ContractConsolidation
                    ├──1:N──> IndemnityDecision
                    ├──1:1──> PrizePhaseConfig ──1:N──> PrizeCategory ──1:N──> SessionPrize
                    └──1:N──> ChatMessage
```

### 3.2 Modelli Principali (40 totali)

#### Identita' e Autenticazione
| Modello | Scopo | Campi Chiave |
|---------|-------|-------------|
| **User** | Account utente | email, username, passwordHash, isSuperAdmin, failedLoginAttempts, lockedUntil |
| **RefreshToken** | Token di refresh | tokenHash (SHA-256), familyId (anti-furto), isRevoked, expiresAt |
| **PushSubscription** | Sottoscrizioni push | endpoint, p256dh, auth |
| **NotificationPreference** | Preferenze notifiche | pushEnabled, tradeOffers, contractExpiry, auctionStart, phaseChange |

#### Lega e Membri
| Modello | Scopo | Campi Chiave |
|---------|-------|-------------|
| **League** | Container lega | name, initialBudget (def 500), slots per ruolo, inviteCode, status (DRAFT/ACTIVE/ARCHIVED) |
| **LeagueMember** | Iscrizione utente-lega | role (ADMIN/MANAGER), teamName, currentBudget, rubataOrder, status (PENDING/ACTIVE/SUSPENDED/LEFT) |
| **LeagueInvite** | Inviti via email | email, token, status (PENDING/ACCEPTED/EXPIRED/CANCELLED), expiresAt |

#### Giocatori
| Modello | Scopo | Campi Chiave |
|---------|-------|-------------|
| **SerieAPlayer** | Registro giocatori Serie A | name, team, position (P/D/C/A), quotation, age, listStatus (IN_LIST/NOT_IN_LIST), exitReason, apiFootballId |
| **ApiFootballPlayerCache** | Cache ricerche API-Football | id (apiFootballId), name, team, photo |
| **PlayerMatchRating** | Rating partita per partita | playerId, apiFixtureId, matchDate, season, rating, minutesPlayed, goals, assists |
| **ApiFootballSyncLog** | Log job di sincronizzazione | jobType, status, fixturesProcessed, apiCallsUsed |
| **ApiFootballFixtureSync** | Tracciamento fixture sincronizzate | apiFixtureId, round, matchDate, playersProcessed |
| **QuotazioniUpload** | Storico import liste | fileName, playersCreated/Updated/NotInList |

#### Rosa e Contratti
| Modello | Scopo | Campi Chiave |
|---------|-------|-------------|
| **PlayerRoster** | Proprieta' giocatore | acquisitionPrice, acquisitionType (FIRST_MARKET/RUBATA/SVINCOLATI/TRADE), status (ACTIVE/RELEASED/TRADED) |
| **PlayerContract** | Termini contrattuali | salary, duration, initialSalary, initialDuration, rescissionClause, draftSalary/Duration/Released |
| **DraftContract** | Bozza per nuovi acquisti | salary, duration (staging area pre-consolidamento) |

#### Sessione di Mercato
| Modello | Scopo | Campi Chiave |
|---------|-------|-------------|
| **MarketSession** | Container sessione | type (PRIMO_MERCATO/MERCATO_RICORRENTE), currentPhase (8 fasi), auctionMode (REMOTE/IN_PRESENCE) |
| | | turnOrder, rubataBoard, svincolatiTurnOrder (JSON arrays) |
| | | rubataState, svincolatiState (state machine interne) |
| | | readyMembers, pendingNomination* (ready-check condiviso) |
| **ContractConsolidation** | Lock consolidamento per manager | sessionId + memberId (unique) |
| **IndemnityDecision** | Decisioni su giocatori usciti | decisions: JSON [{rosterId, decision: KEEP/RELEASE}] |

#### Aste
| Modello | Scopo | Campi Chiave |
|---------|-------|-------------|
| **Auction** | Singola asta | type (FREE_BID/RUBATA), basePrice, currentPrice, winnerId, status (7 stati incluso APPEAL_*) |
| **AuctionBid** | Singola offerta | bidderId, amount, isWinning, isCancelled |
| **AuctionAcknowledgment** | Conferma risultato | memberId, prophecy (commento opzionale) |
| **AuctionObjective** | Lista desideri pre-asta | priority (1-3), maxPrice, status (ACTIVE/ACQUIRED/MISSED/REMOVED) |
| **AuctionAppeal** | Ricorso su risultato | content, status (PENDING/ACCEPTED/REJECTED), resolvedBy |

#### Scambi
| Modello | Scopo | Campi Chiave |
|---------|-------|-------------|
| **TradeOffer** | Proposta di scambio | offeredPlayers (JSON), requestedPlayers (JSON), offeredBudget, requestedBudget, involvedPlayers (anti-reverse), parentOfferId (catena controfferte) |

#### Movimenti e Storico
| Modello | Scopo | Campi Chiave |
|---------|-------|-------------|
| **PlayerMovement** | Audit trail trasferimenti | movementType (11 tipi), fromMember, toMember, price, old/newSalary/Duration/Clause |
| **Prophecy** | Commenti sui movimenti | authorRole (BUYER/SELLER), content |
| **ContractHistory** | Audit trail contratti | eventType (14 tipi), previous*/new* snapshot, cost/income |
| **ManagerSessionSnapshot** | Snapshot finanziari | snapshotType (SESSION_START/PHASE_START/PHASE_END), budget, totalSalaries, balance |

#### Sistema Premi
| Modello | Scopo | Campi Chiave |
|---------|-------|-------------|
| **PrizePhaseConfig** | Config fase premi | baseReincrement (def 100), isFinalized |
| **PrizeCategory** | Categoria premio | name, isSystemPrize |
| **SessionPrize** | Premio assegnato | amount, leagueMemberId |

#### Chat e Feedback
| Modello | Scopo | Campi Chiave |
|---------|-------|-------------|
| **ChatMessage** | Chat durante aste | content, isSystem |
| **UserFeedback** | Bug report/suggerimenti | title, description, category (BUG/SUGGERIMENTO/DOMANDA/ALTRO), status (APERTA/IN_LAVORAZIONE/RISOLTA) |
| **FeedbackResponse** | Risposte admin | content, statusChange |
| **FeedbackNotification** | Notifiche feedback | type (STATUS_CHANGE/NEW_RESPONSE), isRead |
| **AuditLog** | Log azioni admin | action, entityType, entityId, oldValues, newValues |

### 3.3 Enum Principali (19 totali)

| Enum | Valori | Uso |
|------|--------|-----|
| **Position** | P, D, C, A | Ruolo giocatore (Portiere, Difensore, Centrocampista, Attaccante) |
| **MarketPhase** | ASTA_LIBERA, OFFERTE_PRE_RINNOVO, PREMI, CONTRATTI, CALCOLO_INDENNIZZI, RUBATA, ASTA_SVINCOLATI, OFFERTE_POST_ASTA_SVINCOLATI | Fasi della sessione di mercato |
| **MarketType** | PRIMO_MERCATO, MERCATO_RICORRENTE | Tipo sessione |
| **AcquisitionType** | FIRST_MARKET, RUBATA, SVINCOLATI, TRADE | Come il giocatore e' stato acquisito |
| **TradeStatus** | PENDING, ACCEPTED, REJECTED, COUNTERED, CANCELLED, EXPIRED | Stato offerta di scambio |
| **AuctionStatus** | PENDING, ACTIVE, COMPLETED, CANCELLED, NO_BIDS, APPEAL_REVIEW, AWAITING_APPEAL_ACK, AWAITING_RESUME | Stato asta |
| **MovementType** | FIRST_MARKET, TRADE, RUBATA, SVINCOLATI, RELEASE, CONTRACT_RENEW, RETIREMENT, RELEGATION_RELEASE, RELEGATION_KEEP, ABROAD_COMPENSATION, ABROAD_KEEP | Tipi di movimento |
| **PlayerExitReason** | RITIRATO, RETROCESSO, ESTERO | Motivo uscita dalla lista |
| **ContractEventType** | SESSION_START_SNAPSHOT, DURATION_DECREMENT, AUTO_RELEASE_EXPIRED, RENEWAL, SPALMA, RELEASE_NORMAL, RELEASE_ESTERO, RELEASE_RETROCESSO, KEEP_ESTERO, KEEP_RETROCESSO, INDEMNITY_RECEIVED | Tipi evento contrattuale |

---

## 4. Fasi di Mercato

### 4.1 Primo Mercato (Draft Iniziale)

Il Primo Mercato e' la fase inaugurale di una lega. I manager acquisiscono giocatori tramite asta a turni.

**Fasi del Primo Mercato:**
```
ASTA_LIBERA (unica del primo mercato)
    |
    v
Fine -> Tutti gli slot rosa compilati
```

**Meccanica:**
1. L'admin imposta l'ordine dei turni per ogni ruolo (P, D, C, A)
2. Il manager di turno nomina un giocatore del ruolo corrente
3. Tutti confermano di essere pronti (ready-check)
4. L'asta parte con timer configurabile (default 30s)
5. Ogni manager puo' fare un'offerta >= prezzo corrente + 1
6. Quando il timer scade, il miglior offerente vince
7. Tutti devono confermare il risultato (acknowledgment)
8. Si passa al prossimo turno

**Regole Slot Rosa:**
- Portieri: 3 (default)
- Difensori: 8 (default)
- Centrocampisti: 8 (default)
- Attaccanti: 6 (default)
- Totale: 25 giocatori

### 4.2 Mercato Ricorrente (Sessioni Successive)

Il Mercato Ricorrente avviene dopo il primo mercato e segue un ciclo di 8 fasi:

```
OFFERTE_PRE_RINNOVO
    |  (Scambi tra manager)
    v
PREMI
    |  (Distribuzione premi + budget reincrement)
    v
CONTRATTI
    |  (Rinnovi, rilasci, spalma)
    v
CALCOLO_INDENNIZZI
    |  (Gestione giocatori usciti: ritirati, retrocessi, esteri)
    v
RUBATA
    |  (Aste forzate su giocatori in rosa)
    v
ASTA_SVINCOLATI
    |  (Aste su giocatori liberi)
    v
OFFERTE_POST_ASTA_SVINCOLATI
    |  (Ultimo round di scambi)
    v
FINE SESSIONE
```

### 4.3 Transizioni di Fase

Ogni transizione e' gestita dal servizio `auction.service.ts` tramite `setMarketPhase()`:

| Da | A | Pre-condizioni | Azioni automatiche |
|----|---|---------------|-------------------|
| OFFERTE_PRE_RINNOVO | PREMI | Admin decide | Invalida offerte pendenti |
| PREMI | CONTRATTI | Admin finalizza premi | Decremento durata contratti (-1), auto-release durata=0, snapshot SESSION_START |
| CONTRATTI | CALCOLO_INDENNIZZI | Tutti hanno consolidato | Verifica budget, lock contratti |
| CALCOLO_INDENNIZZI | RUBATA | Tutti hanno deciso | Processa rilasci/mantenimenti |
| RUBATA | ASTA_SVINCOLATI | Admin completa | Genera board giocatori |
| ASTA_SVINCOLATI | OFFERTE_POST | Admin completa | Chiude aste pendenti |
| OFFERTE_POST | FINE | Admin decide | Invalida offerte pendenti |

### 4.4 Decremento Automatico Durata Contratti

Quando si entra nella fase CONTRATTI:

```typescript
// Per ogni contratto attivo nella lega:
contract.duration -= 1

// Se duration diventa 0:
//   - Auto-release del giocatore
//   - PlayerMovement tipo AUTO_RELEASE_EXPIRED
//   - Budget non impattato (giocatore semplicemente liberato)
//   - ContractHistory entry tipo DURATION_DECREMENT + AUTO_RELEASE_EXPIRED
```

---

## 5. Sistema Contratti

### 5.1 Struttura Contratto

Ogni giocatore in rosa ha un contratto con:
- **Ingaggio (salary)**: Costo annuale in crediti
- **Durata (duration)**: Semestri rimanenti (1-4 tipico)
- **Clausola Rescissoria (rescissionClause)**: Penale per rilascio anticipato

### 5.2 Creazione Contratto Iniziale

Alla fine di un'asta, il vincitore deve creare un contratto per il giocatore acquisito:

```
Ingaggio iniziale = prezzo di acquisto (acquisitionPrice)
Durata iniziale = scelta dal manager (1-4 semestri)
Clausola = ingaggio * moltiplicatore_clausola
```

### 5.3 Rinnovo Contratto

Durante la fase CONTRATTI, il manager puo' rinnovare:

**Regole fondamentali:**
1. L'ingaggio NON puo' diminuire: `newSalary >= currentSalary`
2. La durata NON puo' diminuire: `newDuration >= currentDuration`
3. Per AUMENTARE la durata, DEVI prima aumentare l'ingaggio
4. I giocatori acquisiti tramite TRADE non possono essere rinnovati nella stessa sessione

**Calcolo costo rinnovo:**
```
costoDelta = (newSalary - currentSalary) * newDuration
```

Se il costo delta e' > 0, viene detratto dal budget del manager.

### 5.4 Spalma

Lo "Spalma" permette di ridurre l'ingaggio annuale aumentando la durata:

**Regole:**
```
newSalary * newDuration >= initialSalary (ingaggio originale del primo contratto)
```

Esempio: Giocatore con ingaggio iniziale 30, attualmente salary=30, duration=1
- Spalma a: salary=15, duration=2 -> 15*2=30 >= 30 OK
- Spalma a: salary=10, duration=2 -> 10*2=20 < 30 NON VALIDO

### 5.5 Rilascio (Svincolo)

Durante la fase CONTRATTI, il manager puo' rilasciare un giocatore:

**Costo rilascio:**
```
Se duration <= 1:
  costo = 0 (contratto in scadenza, rilascio gratuito)

Se duration > 1:
  costo = Math.ceil((salary * duration) / 2)
```

Il costo viene detratto dal budget. Il giocatore torna disponibile come svincolato.

### 5.6 Consolidamento

Il consolidamento e' l'operazione atomica che applica tutte le modifiche ai contratti di un manager:

**Flusso:**
1. Manager prepara le modifiche in "bozza" (draftSalary, draftDuration, draftReleased)
2. Quando pronto, chiama "Consolida"
3. Il sistema in una transazione atomica:
   - Salva snapshot pre-consolidamento (preConsolidationBudget, preConsolidationSalary)
   - Applica tutti i rinnovi
   - Processa tutti i rilasci
   - Crea contratti per giocatori appena acquisiti (DraftContract -> PlayerContract)
   - Verifica che il budget non vada in negativo
   - Se ok, crea record ContractConsolidation come "lock"
   - Se fallisce, rollback completo

**Vincolo chiave:** Il monte ingaggi post-consolidamento NON puo' superare il budget disponibile.

### 5.7 Gestione Giocatori Usciti (Indennizzi)

Nella fase CALCOLO_INDENNIZZI, i manager devono decidere per ogni giocatore con exitReason:

| Exit Reason | Opzioni | Se RELEASE | Se KEEP |
|-------------|---------|-----------|---------|
| RETROCESSO | KEEP o RELEASE | Rilascio gratuito + indennizzo | Mantieni, nessun costo extra |
| ESTERO | KEEP o RELEASE | Rilascio gratuito + indennizzo | Mantieni, nessun costo extra |
| RITIRATO | Solo RELEASE | Rilascio gratuito + indennizzo | N/A |

**Calcolo Indennizzo:**
```
indemnity = rescissionClause del giocatore rilasciato
```
L'indennizzo viene accreditato al budget del manager.

---

## 6. Sistema Scambi

### 6.1 Fasi Disponibili

Gli scambi sono possibili solo durante:
- `OFFERTE_PRE_RINNOVO`
- `OFFERTE_POST_ASTA_SVINCOLATI`

### 6.2 Struttura Offerta

```typescript
{
  offeredPlayers: string[]    // ID giocatori offerti
  requestedPlayers: string[]  // ID giocatori richiesti
  offeredBudget: number       // Budget offerto (0-N)
  requestedBudget: number     // Budget richiesto (0-N)
  message?: string            // Messaggio opzionale
  durationHours: number       // Validita' (default 24h)
}
```

### 6.3 Ciclo di Vita

```
PENDING ──accept──> ACCEPTED (esecuzione scambio)
    |
    ├──reject──> REJECTED
    |
    ├──counter──> COUNTERED (crea nuova offerta figlia)
    |
    ├──cancel──> CANCELLED (dal mittente)
    |
    └──timeout──> EXPIRED
```

### 6.4 Rilevamento Conflitti

Quando un'offerta viene accettata, il sistema:

1. **Ri-verifica proprieta'**: Controlla che tutti i giocatori siano ancora nelle rose corrette
2. **Auto-invalida conflitti**: Se un giocatore coinvolto nell'offerta accettata e' presente in altre offerte PENDING, quelle offerte vengono automaticamente invalidate
3. **Notifica push**: I proprietari delle offerte invalidate ricevono notifica

### 6.5 Regola Anti-Reverse

Il campo `involvedPlayers` (unione di offeredPlayers + requestedPlayers) impedisce scambi circolari nella stessa sessione. Se A offre il giocatore X a B, B non puo' offrire X indietro ad A nella stessa sessione.

### 6.6 Esecuzione Scambio (Transazione Atomica)

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Trasferimento giocatori offerti: sender -> receiver
  // 2. Trasferimento giocatori richiesti: receiver -> sender
  // 3. Aggiornamento contratti (cambio proprietario)
  // 4. Trasferimento budget
  // 5. Registrazione PlayerMovement per ogni giocatore
  // 6. Marca offerta come ACCEPTED
  // 7. Auto-invalida offerte conflittuali
})
```

---

## 7. Sistema Aste

### 7.1 Tipi di Asta

| Tipo | Fase | Meccanica |
|------|------|-----------|
| **FREE_BID** | ASTA_LIBERA, ASTA_SVINCOLATI | Asta aperta, tutti possono offrire |
| **RUBATA** | RUBATA | Asta forzata su giocatore gia' in rosa |

### 7.2 Flusso Asta Standard

```
1. NOMINATION
   - Manager di turno (o admin) nomina giocatore
   - Pending: giocatore visibile ma non confermato

2. READY CHECK
   - Tutti i manager devono confermare di essere pronti
   - Admin puo' forzare ready di tutti

3. BIDDING
   - Timer parte (configurabile, default 30s)
   - Ogni offerta >= prezzo corrente + 1
   - Ogni offerta resetta il timer
   - Validazione budget: offerta <= budget disponibile - 1

4. CLOSE
   - Timer scade senza nuove offerte
   - Migliore offerente vince
   - Se nessuna offerta: NO_BIDS

5. ACKNOWLEDGMENT
   - Tutti i manager devono confermare il risultato
   - Possibilita' di aggiungere "profezia" (commento)
   - Admin puo' forzare ack di tutti

6. APPEAL (opzionale)
   - Un manager puo' fare ricorso
   - Admin accetta o rifiuta
   - Se accettato: asta riaperta
```

### 7.3 Timer e Sincronizzazione

- Server invia `timerExpiresAt` (timestamp assoluto) con ogni bid
- Client sincronizza orologio con `GET /api/time` all'avvio
- Hook `useServerTime` calcola offset client-server
- Pusher evento `timer-update` per keep-alive sincronizzazione
- Timer critico: bypass del batch Pusher (invio immediato)

### 7.4 Heartbeat e Connessione

```
Client -> Server: POST /heartbeat (ogni 30s)
Server: mappa in-memory { memberId -> lastHeartbeat }
Timeout: 45s (1.5x intervallo client)
Uso: impedire avanzamento se member disconnesso
```

### 7.5 Modalita' Asta

| Modalita' | Descrizione |
|-----------|-------------|
| **REMOTE** | Ogni asta richiede ready-check di tutti i partecipanti |
| **IN_PRESENCE** | Admin gestisce tutto, skip ready-check (sessioni dal vivo) |

---

## 8. Rubata

### 8.1 Concetto

La "Rubata" e' una fase in cui i manager possono "rubare" giocatori dalle rose degli altri. E' un'asta forzata dove il proprietario attuale deve difendere il suo giocatore.

### 8.2 Board-Based System

1. **Generazione Board**: L'admin genera la lista di tutti i giocatori "rubabili" (quelli in rosa di altri manager)
2. **Ordine**: L'admin imposta l'ordine dei turni tra i manager
3. **Per ogni giocatore nella board:**
   - Ready-check di tutti i manager
   - Il manager di turno puo' fare un'offerta iniziale
   - Se offerta fatta: si apre asta tra tutti (incluso proprietario)
   - Se nessuna offerta: si passa al prossimo
   - Timer configurabile (offerta: 30s default, asta: 15s default)

### 8.3 State Machine Rubata

```
WAITING -> READY_CHECK -> OFFERING -> AUCTION_READY_CHECK -> AUCTION -> PENDING_ACK
    ^                                                                       |
    |                       PAUSED (admin puo' mettere in pausa)            |
    +----------------------------------------------------------------------+
                                                                   COMPLETED
```

### 8.4 Preferenze Rubata

I manager possono preparare strategie prima della rubata:
- **Watchlist**: Giocatori da osservare (categorie: DA_RUBARE, SOTTO_OSSERVAZIONE, POTENZIALE_ACQUISTO, SCAMBIO, DA_VENDERE)
- **Auto-Pass**: Giocatori su cui non fare mai offerta
- **Max Bid**: Offerta massima per giocatore
- **Priority**: Priorita' (1-alta, 2-media, 3-bassa)

---

## 9. Svincolati

### 9.1 Concetto

La fase Svincolati permette ai manager di acquistare giocatori liberi (non in nessuna rosa) tramite asta a turni.

### 9.2 Meccanica

1. **Setup**: Admin imposta ordine turni e timer
2. **Turno**: Manager di turno nomina un giocatore svincolato
3. **Conferma**: Nominatore conferma la scelta
4. **Ready-check**: Tutti pronti
5. **Asta**: Offerte aperte con timer
6. **Acknowledgment**: Conferma risultato
7. **Prossimo turno** o **Pass**: Manager puo' passare il turno

### 9.3 State Machine Svincolati

```
SETUP -> READY_CHECK -> NOMINATION -> AUCTION -> PENDING_ACK -> (next turn)
                                                                     |
                                                              COMPLETED
```

### 9.4 Regole Speciali

- Manager puo' dichiarare "finito" (non vuole piu' nominare)
- Se tutti i manager hanno passato o finito: fase completata
- Validazione slot rosa: non puoi acquistare se hai gia' riempito gli slot del ruolo
- Validazione budget: bilancio (budget - monte_ingaggi) deve essere sufficiente

---

## 10. Sistema Premi e Indennizzi

### 10.1 Fase Premi

La fase PREMI permette all'admin di:
1. Definire un **reincremento base** per tutti i manager (default: 100 crediti)
2. Creare **categorie premio** (es. "Miglior Portiere", "Campione d'Inverno")
3. Assegnare **importi** per categoria per manager
4. **Finalizzare**: applica reincremento + premi ai budget dei manager

### 10.2 Indennizzi Personalizzati

L'admin puo' definire indennizzi custom per giocatori specifici nella fase premi (es. compensazione per giocatore andato all'estero).

### 10.3 Flusso Consolidamento Premi

```
1. Admin inizializza fase premi (POST /sessions/:id/prizes/init)
2. Admin crea categorie e assegna importi
3. Admin opzionalmente consolida indennizzi
4. Admin finalizza (POST /sessions/:id/prizes/finalize)
   -> Aggiorna currentBudget di ogni manager:
      newBudget = currentBudget + baseReincrement + sum(prizeAmounts) + indemnities
5. Fase premi completata, si puo' passare a CONTRATTI
```

---

## 11. Statistiche Giocatori

### 11.1 Fonti Dati

| Fonte | Priorita' | Dati |
|-------|----------|------|
| **PlayerMatchRating** (DB) | 1 (primaria) | Rating partita per partita, gol, assist, minuti |
| **apiFootballStats** (JSON blob) | 2 (fallback) | Statistiche stagionali aggregate da API-Football |

### 11.2 Statistiche Calcolate (ComputedSeasonStats)

```typescript
{
  season: "2025-2026"
  appearances: 23        // Presenze (minutesPlayed > 0)
  totalMinutes: 2070     // Somma minuti giocati
  avgRating: 6.85        // Media rating (arrotondata a 2 decimali)
  totalGoals: 5          // Somma gol
  totalAssists: 3        // Somma assist
  startingXI: 20         // Titolarita' (minutesPlayed >= 60)
  matchesInSquad: 25     // Convocazioni totali
}
```

### 11.3 Auto-Tag Giocatori

Il sistema calcola automaticamente tag per ogni giocatore:

| Tag | Icona | Condizione |
|-----|-------|-----------|
| TITOLARE | 11 | >= 60 min nel 70%+ delle presenze (min 3 presenze) |
| TOP_PERFORMER | * | Rating medio >= 7.0 (min 3 partite con rating) |
| IN_CRESCITA | + | Rating ultime 3 > media stagionale + 0.2 |
| IN_CALO | - | Rating ultime 3 < media stagionale - 0.3 |
| GOLEADOR | F | Gol >= 1.5x media del ruolo |
| GIOVANE | G | Eta' < 25 |
| ANZIANO | V | Eta' > 30 |
| RIGORISTA | P | Ha segnato rigori (da apiFootballStats.penalty.scored) |
| INFORTUNATO | X | Attualmente infortunato (da apiFootballStats.injured) |

### 11.4 Integrazione API-Football

**Sincronizzazione Match Ratings:**
- Cron job ogni 6 ore: `GET /api/cron/sync-api-football`
- Endpoint manuale: `POST /api/superadmin/api-football/sync-match-ratings`
- Quota: 100 chiamate API/giorno (`API_FOOTBALL_DAILY_LIMIT`)
- Processo: Fetch fixture della stagione corrente -> per ogni partita non ancora sincronizzata -> fetch statistiche giocatori -> upsert PlayerMatchRating

**Matching Giocatori:**
- I giocatori importati dalle quotazioni vengono matchati ai giocatori API-Football
- Match automatico per nome/squadra, con proposte per casi ambigui
- Match manuale disponibile dal pannello SuperAdmin

---

## 12. Layer API

### 12.1 Overview Endpoint

Il backend espone **278 endpoint** organizzati in **22 route file**:

| Route File | Endpoint | Dominio |
|-----------|----------|---------|
| auth.ts | 7 | Autenticazione (login, register, refresh, reset password) |
| users.ts | 6 | Profilo utente (foto, password, settings) |
| leagues.ts | 18 | Gestione leghe (CRUD, join, members, financials) |
| players.ts | 5 | Database giocatori (lista, dettaglio, stats, match-history) |
| auctions.ts | 50 | Primo Mercato (sessioni, nomination, bidding, ack, appeal, pause, bot) |
| contracts.ts | 18 | Contratti (CRUD, renew, release, consolidation, export) |
| trades.ts | 8 | Scambi (create, accept, reject, counter, history) |
| rubata.ts | 37 | Rubata (board, order, bidding, preferences, strategies, heartbeat) |
| svincolati.ts | 31 | Svincolati (pool, nomination, bidding, turn-order, pass, finished) |
| admin.ts | 9 | Admin lega (export, audit, stats, reset, prizes) |
| invites.ts | 7 | Inviti email (create, accept, reject, cancel) |
| movements.ts | 5 | Log movimenti (history, prophecy) |
| superadmin.ts | 24 | Super Admin (quotazioni, players, API-Football, users, leagues) |
| prizes.ts | 11 | Fase premi (init, categories, amounts, finalize, indemnities) |
| history.ts | 12 | Storico (sessions, timeline, trades, prophecies, player career) |
| indemnity.ts | 4 | Indennizzi (affected players, decisions, status) |
| time.ts | 1 | Sincronizzazione orario server |
| objectives.ts | 5 | Obiettivi pre-asta (CRUD, summary) |
| feedback.ts | 10 | Feedback (submit, list, respond, notifications) |
| contract-history.ts | 5 | Storico contratti (history, snapshots, prospetto) |
| push.ts | 5 | Push notifications (subscribe, preferences, vapid-key) |
| cron.ts | 1 | Cron job (sync API-Football) |

### 12.2 Middleware Stack

```
Request
  |-> CORS (origin: FRONTEND_URL, credentials: true)
  |-> Helmet (security headers, CSP disabilitato)
  |-> express.json() (body parsing, limit 50mb)
  |-> cookie-parser
  |-> Input Sanitization (rimozione tag HTML ricorsiva)
  |-> Rate Limiter Generale (2000 req/15min per IP)
  |-> Rate Limiter Auth (20 req/15min su /auth/login e /auth/register)
  |-> Route matching
  |   |-> authMiddleware (verifica JWT)
  |   |-> optionalAuthMiddleware (JWT opzionale)
  |   |-> verifyTurnstile (CAPTCHA Cloudflare su register)
  |-> Route handler
  |-> Error handler globale
Response
```

### 12.3 Pattern Risposta Standard

```typescript
// Successo
{ success: true, data: { ... } }
{ success: true, message: "Operazione completata" }

// Errore validazione
{ success: false, message: "Dati non validi", errors: [{message, path}] }

// Errore auth
{ success: false, message: "Token non valido o scaduto" }

// Errore business
{ success: false, message: "Budget insufficiente" }

// Errore server
{ success: false, message: "Errore interno del server" }
```

---

## 13. Frontend

### 13.1 Pagine (37 totali)

#### Autenticazione (4)
| Pagina | Route | Descrizione |
|--------|-------|-------------|
| Login | `/login` | Email/username + password |
| Register | `/register` | Registrazione con CAPTCHA Turnstile |
| ForgotPassword | `/forgot-password` | Recovery via email |
| ResetPassword | `/reset-password` | Reset con token |

#### Core (3)
| Pagina | Route | Descrizione |
|--------|-------|-------------|
| Dashboard | `/dashboard` | Hub principale: leghe, inviti, attivita' |
| Profile | `/profile` | Settings utente, foto, push preferences |
| CreateLeague | `/leagues/new` | Creazione nuova lega |

#### Gestione Lega (3)
| Pagina | Route | Descrizione |
|--------|-------|-------------|
| LeagueDetail | `/leagues/:id` | Hub lega: membri, KPI, movimenti, fasi |
| InviteDetail | `/invite/:token` | Accettazione invito |
| AdminPanel | `/leagues/:id/admin` | 4 tab: Fasi, Membri, Richieste, Export |

#### Aste e Mercato (7)
| Pagina | Route | Descrizione |
|--------|-------|-------------|
| AuctionRoom | `/leagues/:id/auction/:sessionId` | Asta in tempo reale con drag-drop |
| Svincolati | `/leagues/:id/svincolati` | Asta svincolati a turni |
| Rubata | `/leagues/:id/rubata` | Fase rubata con board |
| StrategieRubata | `/leagues/:id/strategie-rubata` | Pianificazione strategie |
| Rose | `/leagues/:id/rose` | Visualizzazione rose |
| AllPlayers | `/leagues/:id/players` | Database giocatori (virtual scroll) |
| Trades | `/leagues/:id/trades` | 4 tab: Crea, Ricevute, Inviate, Storico |

#### Contratti (2)
| Pagina | Route | Descrizione |
|--------|-------|-------------|
| Contracts | `/leagues/:id/contracts` | Gestione contratti (rinnovo, spalma, rilascio, consolida) |
| Indemnity | `/leagues/:id/indemnity` | Decisioni KEEP/RELEASE su usciti |

#### Analytics (7)
| Pagina | Route | Descrizione |
|--------|-------|-------------|
| History | `/leagues/:id/history` | Sessioni, timeline, carriera giocatori |
| Movements | `/leagues/:id/movements` | Log trasferimenti con filtri |
| PlayerStats | `/leagues/:id/stats` | Radar chart, confronto giocatori |
| LeagueFinancials | `/leagues/:id/financials` | Dashboard finanziaria 3 livelli (panoramica -> squadre -> dettaglio) |
| Prophecies | `/leagues/:id/prophecies` | Profezie/commenti sui movimenti |
| ManagerDashboard | `/leagues/:id/manager` | Dashboard personale con widget drag-drop |
| PrizePhasePage | `/leagues/:id/prizes` | Gestione premi (admin) |

#### Riferimento (3)
| Pagina | Route | Descrizione |
|--------|-------|-------------|
| Rules | `/rules` | Regolamento completo (pubblico) |
| PatchNotes | `/leagues/:id/patch-notes` | Changelog versioni |
| FeedbackHub | `/leagues/:id/feedback` | Bug report e suggerimenti |

#### Admin (1)
| Pagina | Route | Descrizione |
|--------|-------|-------------|
| SuperAdmin | `/superadmin` | Import quotazioni, DB giocatori, leghe, utenti, API-Football |

### 13.2 Librerie UI Chiave

| Libreria | Uso |
|----------|-----|
| **Tailwind CSS 3.4** | Styling utility-first, tema dark, responsive |
| **Recharts 3.7** | Grafici (Line, Bar, Radar, Waterfall, Area, Gantt-like) |
| **Lucide React 0.563** | Icone SVG tree-shakeable |
| **dnd-kit 6.3** | Drag-and-drop (ordine turni, widget dashboard) |
| **Pusher-js 8.4** | WebSocket client per real-time |
| **Zod 4.2** | Validazione form e schema |
| **@tanstack/react-virtual 3.13** | Virtual scrolling per liste 1000+ |
| **canvas-confetti 1.9** | Animazione celebrativa |
| **xlsx 0.18** | Export Excel |

### 13.3 Gestione Stato

| Livello | Tecnologia | Esempio |
|---------|-----------|---------|
| Globale (Auth) | React Context | `useAuth()` -> user, login, logout |
| Pagina | useState/useEffect | Dati caricati al mount, filtri locali |
| Dominio | Custom Hooks | `useAuctionRoomState`, `useRubataState`, `useSvincolatiState` |
| Real-Time | Pusher subscribe | Channel `league-{id}`, bind su eventi |
| Sincronizzazione | `useServerTime` | Offset client-server per timer |
| Gesture | `usePullToRefresh`, `useSwipeGesture` | Touch events mobile |

### 13.4 Componenti Principali (100+)

**Per Dominio:**
- `auction-room-v2/` (15+): Layout, CenterStage, PlayerCard, BiddingPanel, ReadyCheckPanel, AcknowledgmentPanel, FinancialDashboard, StatusBar, MobileBottomBar
- `trades/` (12+): ManagerGrid, PlayersTable, DealRosterPanel, DealAssetCard, DealFinanceBar, TradeActivityFeed
- `rubata/` (8+): RubataStepper, TimerPanel, BidPanel, PreferenceModal, AdminControls
- `finance/` (8+): FinanceDashboard, TeamComparison, ContractExpiryGantt, WaterfallChart, KPICard
- `league-detail/` (8): Header, AdminBanner, ManagersSidebar, PhaseStepper, FinancialKPIs
- `admin/` (4): PhasesTab, MembersTab, RequestsTab, ExportTab (tutti lazy-loaded)
- `history/` (3): SessionView, TimelineView, PlayerCareerPanel
- `ui/` (18): Button, Input, Card, Badge, Modal, BottomSheet, DataTable, Skeleton, RadarChart, Turnstile

**Componenti Trasversali:**
- `Navigation.tsx`: Top bar con breadcrumb, menu utente, notifiche
- `BottomNavBar.tsx`: Tab bar mobile (5 tab, auto-hide on scroll)
- `CommandPalette.tsx`: Cmd+K navigazione rapida
- `PlayerStatsModal.tsx`: Modal dettaglio giocatore (stats + radar)
- `ContractModifier.tsx`: Editor contratto inline
- `ShareButton.tsx`: Condivisione link
- `PullToRefresh.tsx`: Pull-to-refresh gesture

### 13.5 Performance Frontend

| Ottimizzazione | Implementazione |
|---------------|----------------|
| Code Splitting | `React.lazy()` su tutte le pagine tranne Login/Dashboard |
| Virtual Scrolling | `@tanstack/react-virtual` su AllPlayers (1000+ righe) |
| Tree Shaking | Import nominati (Lucide, Recharts) |
| Asset Caching | 1 anno cache su `/assets/*` (hash immutabili) |
| PWA | Service Worker con Workbox (cache Google Fonts, API, immagini) |
| Lazy Data | `requestIdleCallback` per dati secondari (FinancialKPIs) |

---

## 14. Infrastruttura e Sicurezza

### 14.1 Stack di Sicurezza

| Layer | Meccanismo |
|-------|-----------|
| Trasporto | HTTPS obbligatorio (Vercel) |
| Auth | JWT + Refresh Token con rotazione famiglia |
| Headers | Helmet (X-Frame-Options, X-Content-Type, HSTS, Referrer-Policy) |
| CORS | Origin whitelistato (FRONTEND_URL), credentials: true |
| Rate Limiting | 2000/15min generale, 20/15min auth |
| Account Lockout | 5 tentativi: 15min, 10: 1h, 20: 24h |
| Input | Rimozione ricorsiva tag HTML da tutti i body |
| CAPTCHA | Cloudflare Turnstile su registrazione |
| Cookie | httpOnly + Secure + SameSite: strict |
| Database | Query parametrizzate (Prisma ORM) |
| Segreti | Solo in variabili d'ambiente, mai nel codice |

### 14.2 Lockout Account

```
Tentativi falliti | Durata blocco
5+               | 15 minuti
10+              | 1 ora
20+              | 24 ore
```

Reset automatico dopo scadenza blocco. Reset su login riuscito.

### 14.3 Token Theft Detection

```
1. Login genera refreshToken con familyId="abc"
2. Attacker intercetta refreshToken
3. Vittima fa refresh -> nuovo token con familyId="abc" (vecchio revocato)
4. Attacker usa vecchio token -> RILEVATO (token gia' usato)
5. Sistema revoca TUTTA la famiglia "abc"
6. Vittima e attacker entrambi forzati a ri-loggarsi
```

---

## 15. Real-Time e Notifiche

### 15.1 Pusher WebSocket

**Canali:**
- `auction-{sessionId}`: Eventi asta (bid, nomination, ready, close, timer)
- `league-{leagueId}`: Eventi lega (trade, phase change, indemnity)
- `presence-auction-{sessionId}`: Tracking presenza online

**Eventi principali (20+):**

| Evento | Canale | Trigger |
|--------|--------|---------|
| `bid-placed` | auction | Nuova offerta in asta |
| `nomination-pending` | auction | Giocatore nominato (pre-conferma) |
| `nomination-confirmed` | auction | Nominazione confermata, asta parte |
| `auction-closed` | auction | Asta chiusa (venduto/invenduto) |
| `member-ready` | auction | Manager si dichiara pronto |
| `timer-update` | auction | Aggiornamento timer (sincronizzazione) |
| `pause-requested` | auction | Richiesta pausa da manager |
| `rubata-steal-declared` | auction | Offerta rubata iniziale |
| `rubata-bid-placed` | auction | Bid su asta rubata |
| `rubata-state-changed` | auction | Cambio stato rubata |
| `svincolati-state-changed` | auction | Cambio stato svincolati |
| `svincolati-nomination` | auction | Giocatore nominato svincolati |
| `svincolati-bid-placed` | auction | Bid su svincolato |
| `trade-offer-received` | league | Nuova offerta di scambio |
| `trade-updated` | league | Cambio stato offerta |
| `indemnity-decision-submitted` | league | Decisione indennizzo |
| `indemnity-all-decided` | league | Tutti hanno deciso |

**Batching:**
- Intervallo: 100ms
- Max batch: 100 eventi
- Eccezione: eventi timer inviati immediatamente (bypass batch)

### 15.2 Web Push Notifications

**Tipi di notifica:**

| Tipo | Titolo | Preferenza Utente |
|------|--------|------------------|
| Nuova offerta scambio | "Nuova offerta di scambio" | tradeOffers |
| Offerta decaduta | "Offerta decaduta" | tradeOffers |
| Cambio fase | "Cambio fase" | phaseChange |
| Inizio sessione | "Nuova sessione di mercato" | auctionStart |
| Contratto in scadenza | "Contratto in scadenza" | contractExpiry |

**Gestione sottoscrizioni:**
- Sottoscrizione salvata in DB (endpoint, p256dh, auth)
- Cleanup automatico sottoscrizioni scadute (HTTP 404/410)
- Preferenze per-utente configurabili da Profile

---

## 16. Deployment

### 16.1 Vercel Configuration

```json
{
  "regions": ["fra1"],
  "framework": "vite",
  "functions": {
    "api/index.mjs": { "memory": 1024, "maxDuration": 30 }
  },
  "crons": [{
    "path": "/api/cron/sync-api-football",
    "schedule": "0 */6 * * *"
  }]
}
```

### 16.2 Build Pipeline

```
npm install
  -> prisma generate (genera client ORM)
  -> prisma db push (applica migrazioni)
  -> build:api (esbuild -> api/index.mjs)
  -> vite build (frontend -> dist/)

Routing Vercel:
  /api/* -> api/index.mjs (serverless function)
  /assets/* -> CDN statico (cache 1 anno)
  /* -> index.html (SPA routing)
```

### 16.3 Variabili d'Ambiente Necessarie

```
# Database
DATABASE_URL=postgresql://...
DATABASE_URL_UNPOOLED=postgresql://...  (per migrazioni)

# Auth
JWT_ACCESS_SECRET=<min 32 chars>
JWT_REFRESH_SECRET=<min 32 chars>

# Frontend
FRONTEND_URL=https://fantacontratti.app

# Real-Time
PUSHER_APP_ID, VITE_PUSHER_KEY, PUSHER_SECRET, VITE_PUSHER_CLUSTER

# Push
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY, RESEND_FROM_EMAIL

# External
API_FOOTBALL_KEY

# Security
TURNSTILE_SECRET_KEY (opzionale)
```

### 16.4 Database

| Ambiente | Provider | Porta |
|----------|---------|-------|
| Produzione | Neon PostgreSQL (serverless, SSL) | Cloud |
| Sviluppo | Docker PostgreSQL 16 Alpine | localhost:5433 |
| Test | Docker PostgreSQL 16 Alpine (tmpfs) | localhost:5434 |

---

## 17. Formule Finanziarie

### 17.1 Budget Iniziale
```
Ogni manager inizia con: league.initialBudget (default 500)
```

### 17.2 Costo Acquisizione Asta
```
costo = prezzo_offerta_vincente (basePrice >= 1)
budget -= costo
```

### 17.3 Costo Rinnovo Contratto
```
costoDelta = (newSalary - currentSalary) * newDuration
// Solo se > 0 viene detratto dal budget
```

### 17.4 Costo Rilascio (Svincolo)
```
Se duration <= 1:
  costo = 0

Se duration > 1:
  costo = Math.ceil((salary * duration) / 2)
```

### 17.5 Clausola Rescissoria
```
clausola = salary * moltiplicatore_clausola
// moltiplicatore definito a livello di lega/admin
```

### 17.6 Spalma
```
Vincolo: newSalary * newDuration >= initialSalary
// Non genera costi aggiuntivi
```

### 17.7 Bilancio (usato per validazione offerte)
```
bilancio = currentBudget - somma_ingaggi_tutti_contratti_attivi
```

### 17.8 Indennizzo
```
indennizzo = rescissionClause del giocatore rilasciato per cause esterne
// Accreditato al budget del manager
```

### 17.9 Reincremento Base (Fase Premi)
```
budget += baseReincrement (default 100 per tutti)
budget += sum(premi_individuali)
budget += sum(indennizzi)
```

---

## 18. Matrice Validazione Operazioni

| Operazione | Sessione Attiva | Fase | Membro Attivo | Check Budget | Proprieta' | Note |
|-----------|:-:|------|:-:|:-:|:-:|------|
| Crea contratto | - | CONTRATTI | Si | - | Si | Non deve esistere gia' |
| Rinnova contratto | - | CONTRATTI | Si | Si | Si | Trade-acquired: bloccato |
| Rilascia giocatore | - | CONTRATTI | Si | Si | Si | Costo: (sal*dur)/2 o 0 |
| Consolida contratti | - | CONTRATTI | Si | Si | - | Atomico, tutti usciti decisi |
| Crea offerta scambio | Si | OFFERTE* | Si | Si | Si | Anti-reverse check |
| Accetta scambio | Si | OFFERTE* | Si | Si (ri-check) | Si (ri-check) | Auto-invalida conflitti |
| Nomina giocatore (Primo) | Si | ASTA_LIBERA | Si | - | - | Ruolo corretto |
| Offerta asta (Primo) | Si | ASTA_LIBERA | Si | Si | - | >= corrente + 1 |
| Offerta asta (Rubata) | Si | RUBATA | Si | Si | - | >= corrente + 1 |
| Offerta svincolato | Si | ASTA_SVINCOLATI | Si | Si (bilancio) | - | Slot disponibile |
| Decisione indennizzo | Si | CALCOLO_INDENNIZZI | Si | - | Si | KEEP o RELEASE |

*OFFERTE_PRE_RINNOVO o OFFERTE_POST_ASTA_SVINCOLATI

---

## 19. Metriche e Numeri Chiave

### Database
| Metrica | Valore |
|---------|--------|
| Modelli totali | 40 |
| Enum totali | 19 |
| Vincoli unique | 20+ |
| Indici database | 40+ |
| Modelli con campi JSON | 8 |
| Relazioni foreign key | 80+ |
| Cascade delete | 15+ |
| File schema modulari | 18 |

### API
| Metrica | Valore |
|---------|--------|
| Endpoint totali | 278 |
| Route file | 22 |
| Endpoint aste (primo mercato) | 50 |
| Endpoint rubata | 37 |
| Endpoint svincolati | 31 |
| Endpoint superadmin | 24 |
| Endpoint contratti | 18 |
| Endpoint leghe | 18 |

### Frontend
| Metrica | Valore |
|---------|--------|
| Pagine totali | 37 (27 attive, 10 deprecated/test) |
| Componenti React | 100+ in 13 domini |
| React version | 19.2 |
| Bundle iniziale (stima) | ~200KB gzipped |
| Bundle totale (lazy) | ~500KB JS |
| Breakpoint responsive | md: 768px |

### Servizi Backend
| Metrica | Valore |
|---------|--------|
| File servizio | 30 |
| Funzioni esportate | 200+ |
| Fasi mercato | 8 |
| Tipi movimento | 11 |
| Tipi evento contrattuale | 14 |
| Auto-tag giocatori | 9 |
| Tipi notifica push | 5 |

### Sicurezza
| Metrica | Valore |
|---------|--------|
| Rate limit generale | 2000 req/15min |
| Rate limit auth | 20 req/15min |
| Lockout (5 tentativi) | 15 minuti |
| Lockout (10 tentativi) | 1 ora |
| Lockout (20 tentativi) | 24 ore |
| Access token TTL | 15 minuti |
| Refresh token TTL | 7 giorni |

---

## Appendice A: Struttura Directory Chiave

```
FANTACONTRATTI-MULTIAGENT/
├── prisma/
│   ├── schemas/                 # 18 file .prisma modulari
│   │   ├── _base.prisma         # Enum condivisi
│   │   ├── identity.prisma      # User, RefreshToken, PushSubscription
│   │   ├── league.prisma        # League, LeagueMember, LeagueInvite
│   │   ├── player.prisma        # SerieAPlayer, Cache, MatchRating
│   │   ├── roster.prisma        # PlayerRoster, PlayerContract, DraftContract
│   │   ├── market-session.prisma # MarketSession, Consolidation, Indemnity
│   │   ├── auction.prisma       # Auction, Bid, Ack, Appeal, Objective
│   │   ├── trade.prisma         # TradeOffer
│   │   ├── movement.prisma      # PlayerMovement, Prophecy
│   │   ├── rubata.prisma        # RubataPreference
│   │   ├── prize.prisma         # Prize*, PrizeCategory, SessionPrize
│   │   ├── chat.prisma          # ChatMessage
│   │   ├── feedback.prisma      # UserFeedback, Response, Notification
│   │   └── contract-history.prisma # ContractHistory, ManagerSessionSnapshot
│   └── schema.generated.prisma  # Schema compilato
│
├── src/
│   ├── api/
│   │   ├── index.ts             # Express setup, middleware, CORS, rate limiting
│   │   ├── middleware/
│   │   │   ├── auth.ts          # authMiddleware, optionalAuthMiddleware
│   │   │   └── turnstile.ts     # Cloudflare CAPTCHA
│   │   └── routes/              # 22 file route (278 endpoint)
│   │
│   ├── services/                # 30 file servizio (business logic)
│   │   ├── auth.service.ts      # Login, register, lockout
│   │   ├── auction.service.ts   # Aste, nomination, bidding, phase transitions
│   │   ├── contract.service.ts  # Contratti, rinnovo, spalma, rilascio, consolidamento
│   │   ├── trade.service.ts     # Scambi, conflitti, auto-invalidation
│   │   ├── rubata.service.ts    # Rubata, board, offerte
│   │   ├── svincolati.service.ts # Svincolati, turni, nomination
│   │   ├── league.service.ts    # Leghe, membri, join
│   │   ├── movement.service.ts  # Movimenti, storico
│   │   ├── player-stats.service.ts # Stats calcolate, auto-tag
│   │   ├── api-football.service.ts # Integrazione API-Football
│   │   ├── notification.service.ts # Web Push
│   │   ├── pusher.service.ts    # Real-time events
│   │   └── ...
│   │
│   ├── pages/                   # 37 pagine React
│   ├── components/              # 100+ componenti in 13+ sottocartelle
│   ├── hooks/                   # Custom hooks (useAuth, useServerTime, etc.)
│   ├── utils/                   # JWT, password, validation
│   └── shared/infrastructure/   # Cron, BatchedPusherService
│
├── vercel.json                  # Deploy config (Frankfurt, cron, routing)
├── docker-compose.yml           # PostgreSQL dev + test
├── vite.config.ts               # Frontend build (PWA, proxy, aliases)
└── package.json                 # Dependencies, scripts
```

---

## Appendice B: Comandi Sviluppo

```bash
# Avvio
npm run dev                    # Frontend + API concorrente
npm run dev:api               # Solo API (watch mode)
npm run dev:client            # Solo Frontend (Vite)

# Database
npm run docker:up             # Avvia PostgreSQL Docker
npm run db:local:setup        # Docker + migrations + seed
npx prisma studio --schema=prisma/schema.generated.prisma  # GUI database

# Build
npm run build                 # Frontend Vite
npm run build:api            # API esbuild -> api/index.mjs
npm run vercel-build         # Full build (Prisma + API + Frontend)

# Test
npm run test                 # Unit test (Vitest)
npm run test:e2e             # E2E (Playwright)
npm run test:integration     # Integration con DB test

# Sync Dati
npm run sync:api-football    # Sincronizza stats API-Football
```

---

> Fine documento. Per domande o approfondimenti su sezioni specifiche, fare riferimento ai file sorgente indicati.
