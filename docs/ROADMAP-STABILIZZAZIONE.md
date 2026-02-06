# Roadmap Stabilizzazione - Fantacontratti

> **PREREQUISITO**: Completare questo piano PRIMA di sviluppare nuove evolutive.
> Riferimento in CLAUDE.md alla sezione "Roadmap Stabilizzazione".

**Data analisi**: 2026-02-05
**Branch analisi**: feature/1.x-fantastrategy-hub
**Stato Neon**: Free tier raggiunto, ottimizzazione critica

---

## Indice

- [Diagnostica](#diagnostica)
- [P1 - Performance DB & Risorse](#p1---performance-db--risorse)
- [P2 - Bug Funzionali Critici](#p2---bug-funzionali-critici)
- [P3 - Miglioramenti Strutturali](#p3---miglioramenti-strutturali)
- [P4 - Branch e Feature Pendenti](#p4---branch-e-feature-pendenti)
- [P5 - Evolutive Potenziali](#p5---evolutive-potenziali)
- [Ordine di Esecuzione](#ordine-di-esecuzione)

---

## Diagnostica

| Area | Stato | Gravita |
|------|-------|---------|
| DB Performance | 756 query Prisma, N+1 critici, indici mancanti, no caching | **CRITICA** |
| Polling Frontend | 60-90 req/min durante aste, polling aggressivo anche con Pusher attivo | **CRITICA** |
| Bug Funzionali | 3 critici, 2 alti, 2 medi | **ALTA** |
| PrismaClient | Istanze multiple nei servizi invece del singleton da lib/prisma.ts | **ALTA** |
| Componenti Giganti | AuctionRoom 3138 LOC, Rubata 3074, SuperAdmin 2402 | **MEDIA** |
| Bundle Size | xlsx/pdfkit/dnd-kit non code-split, no manual chunks | **MEDIA** |
| Branch | 3 branch strategy sovrapposti, mobile 151 commit dietro | **MEDIA** |

---

## P1 - Performance DB & Risorse

> Impatto massimo sulla riduzione query al DB e consumo risorse Neon.

### 1.1 Consolidare PrismaClient singleton

- [x] **Stato**: COMPLETATO (2026-02-05)
- **Impatto**: Alto - elimina connessioni duplicate, previene exhaustion connection pool
- **Effort**: ~1h
- **Dettaglio**: ~32 file servizio migrati a `import { prisma } from '../lib/prisma'`
- **File coinvolti**: Tutti i file in `src/services/`, `src/modules/`, `src/api/routes/`
- **Verifica**: grep per `new PrismaClient` deve restituire solo `src/lib/prisma.ts`

### 1.2 Ridurre polling frontend

- [x] **Stato**: COMPLETATO (2026-02-05)
- **Impatto**: Altissimo - da 60-90 req/min a ~20-30 req/min (70% riduzione)
- **Effort**: ~2h
- **Dettaglio**:

| Componente | Attuale | Target (Pusher ON) | Target (Pusher OFF) | Target (Tab nascosto) |
|------------|---------|---------------------|----------------------|-----------------------|
| AuctionRoom.tsx (stato asta) | 2s | 10s | 5s | 30s |
| AuctionRoom.tsx (appeal) | 1.5s | 10s | 5s | 30s |
| AuctionRoom.tsx (heartbeat) | 3s | 10s | 10s | stop |
| Rubata.tsx (board) | 1-3s | 10s | 5s | 30s |
| Rubata.tsx (appeal) | 5s | 15s | 5s | 30s |
| Chat.tsx (messaggi) | 2s | 5s | 3s | 30s |

- **Azione aggiuntiva**: Implementare `Page Visibility API` per ridurre/stoppare polling quando tab in background
- **Verifica**: Monitorare req/min in dev tools Network durante sessione asta

### 1.3 Fix N+1 query critici

- [ ] **Stato**: DA FARE
- **Impatto**: Alto - riduzione 40-60% query su endpoint hot
- **Effort**: ~3h

#### 1.3.1 generateRubataBoard - rubata.service.ts (~linea 812)
- **Problema**: Loop con `findUnique` per ogni membro nell'ordine rubata
- **Fix**: Un solo `findMany({ where: { id: { in: rubataOrder } } })` + Map per lookup

#### 1.3.2 getReceivedOffers/getSentOffers - trade.service.ts (~linea 221, 453)
- **Problema**: `Promise.all(offers.map(...))` fa 2 query per ogni offerta (offeredPlayers + requestedPlayers)
- **Fix**: Raccogliere tutti gli ID, un singolo `findMany`, poi distribuire con Map

#### 1.3.3 getSessionTrades - history.service.ts (~linea 452)
- **Problema**: Stesso pattern N+1 del trade service
- **Fix**: Stesso approccio batch

#### 1.3.4 consolidateContracts - contract.service.ts (~linea 883-1060)
- **Problema**: Query sequenziali dentro transaction loop (findUnique + update per ogni rinnovo)
- **Fix**: Pre-fetch tutti i contratti/roster prima della transaction, nella tx fare solo UPDATE

### 1.4 Aggiungere indici mancanti

- [x] **Stato**: COMPLETATO (2026-02-05)
- **Impatto**: Alto - query 2-10x piu veloci
- **Effort**: ~30min

```prisma
// movement.prisma
model PlayerMovement {
  @@index([leagueId, createdAt])
}

// roster.prisma - upgrade da @@index([playerId]) esistente
model PlayerRoster {
  @@index([playerId, status])
}

// roster.prisma
model PlayerContract {
  @@index([leagueMemberId])
}

// base.prisma o league.prisma
model LeagueMember {
  @@index([leagueId, role])
}

// chat.prisma
model ChatMessage {
  @@index([marketSessionId, createdAt])
}

// trade.prisma
model TradeOffer {
  @@index([marketSessionId, status])
}

// movement.prisma
model Prophecy {
  @@index([leagueId, playerId])
}
```

- **Verifica**: `npm run db:build-schema && npm run db:push` senza errori

### 1.5 Ottimizzare select nelle query frequenti

- [ ] **Stato**: DA FARE
- **Impatto**: Medio - meno dati trasferiti per query
- **Effort**: ~2h

#### 1.5.1 getContracts - contract.service.ts (~linea 119-134)
- **Problema**: `include: { player: true }` carica tutti i campi (~15+)
- **Fix**: `player: { select: { id, name, position, team, quotation, listStatus, exitReason } }`

#### 1.5.2 getLeagueMovements - movement.service.ts (~linea 104-125)
- **Problema**: Deep include con dati non necessari (tutti i campi player, member)
- **Fix**: `select` mirato su player (id, name, position, team) e member (id, teamName, user.username)

#### 1.5.3 Pattern generale
- Cercare tutti i `include: { player: true }` e sostituire con select dei soli campi usati dal frontend

### 1.6 Cache in-memory per dati stabili

- [ ] **Stato**: DA FARE
- **Impatto**: Medio - elimina ~30+ query ripetute per "active session"
- **Effort**: ~2h
- **Dettaglio**: Pattern ripetuto 30+ volte in tutti i servizi:
  ```typescript
  const activeSession = await prisma.marketSession.findFirst({
    where: { leagueId, status: 'ACTIVE' },
  })
  ```
- **Fix**: Cache layer semplice con TTL:

| Dato | TTL | Invalidazione |
|------|-----|---------------|
| Active MarketSession per league | 30s | Su cambio fase/sessione |
| Lista membri attivi per league | 60s | Su join/leave |
| Lista giocatori per posizione/team | 5min | Su aggiornamento quotazioni |

- **Implementazione**: Map<string, { data, expiry }> in `src/lib/cache.ts`

---

## P2 - Bug Funzionali Critici

### 2.1 Fix clausola rescissoria durata=1

- [x] **Stato**: COMPLETATO (2026-02-05)
- **Severita**: CRITICO
- **Effort**: 15min
- **File**: `src/services/contract.service.ts:13-18`
- **Problema**: `DURATION_MULTIPLIERS[1] = 4` ma Bibbia RUBATA.md specifica `3`
- **Impatto**: Tutte le clausole per contratti 1 semestre sono 33% piu alte del dovuto
- **Fix**: Cambiare `1: 4` in `1: 3`
- **Verifica**: Eseguire `scripts/test/test-bibbia-contratti.ts`, tutti i test devono passare

### 2.2 Fix recordMovement in consolidateContracts

- [x] **Stato**: COMPLETATO (2026-02-05)
- **Severita**: CRITICO
- **Effort**: ~1h
- **File**: `src/services/contract.service.ts:1040-1123` + `src/services/movement.service.ts`
- **Problema**: `consolidateContracts()` chiamava `recordMovement(tx, {...})` con transaction come primo arg e nomi campi sbagliati (sessionId/type/amount)
- **Impatto**: Movimenti ESTERO/RETROCESSO non registrati durante consolidamento, dati storici persi
- **Fix opzioni**:
  1. Aggiungere parametro `tx?: PrismaTransaction` opzionale a `recordMovement`
  2. Oppure estrarre la creazione movimento nella transaction stessa

### 2.3 Allineare formula costo rinnovo

- [ ] **Stato**: DA FARE (richiede decisione business)
- **Severita**: CRITICO
- **Effort**: ~30min dopo decisione
- **File**: `src/services/contract.service.ts`
- **Problema**: Due percorsi con formule diverse:

| Percorso | Formula | Esempio 10M/2s -> 12M/3s |
|----------|---------|---------------------------|
| `renewContract()` (~linea 463) | `newValue - currentValue` | (12*3)-(10*2) = **16M** |
| `consolidateContracts()` (~linea 898) | `salaryDiff` | 12-10 = **2M** |
| Bibbia CONTRATTI.md | "NON decrementa budget" | **0M** |

- **Decisione necessaria**: Il rinnovo costa dal budget? Se no (come dice la Bibbia), entrambe le funzioni sono sbagliate.

### 2.4 Budget re-check in closeCurrentRubataAuction

- [ ] **Stato**: DA FARE
- **Severita**: ALTO
- **Effort**: ~30min
- **File**: `src/services/rubata.service.ts` (closeCurrentRubataAuction)
- **Problema**: Race condition - tra validazione bid e chiusura asta il budget puo cambiare, risultando in budget negativo
- **Fix**: Aggiungere controllo budget atomico dentro la transaction di chiusura prima del decremento

### 2.5 Validazione ESTERO/RETROCESSO release

- [ ] **Stato**: DA FARE
- **Severita**: MEDIO
- **Effort**: ~20min
- **File**: `src/services/contract.service.ts` (~linea 959-980)
- **Problema**: Per rilasciare un giocatore ESTERO/RETROCESSO servono ENTRAMBI `draftReleased: true` E `draftExitDecision: 'RELEASE'`, ma la validazione non lo rende esplicito
- **Fix**: Aggiungere validazione esplicita che controlla entrambi i flag

---

## P3 - Miglioramenti Strutturali

### 3.1 Split componenti giganti

- [ ] **Stato**: DA FARE
- **Impatto**: Medio - migliora DX, manutenibilita, test
- **Effort**: ~4-6h totali

| Componente | LOC | Split proposto |
|------------|-----|----------------|
| AuctionRoom.tsx | 3138 | AuctionRoom (orchestrator) + BiddingInterface + NominationPhase + ReadyCheck + AcknowledgmentModal + AppealInterface + ManagersStatusPanel |
| Rubata.tsx | 3074 | Rubata (orchestrator) + RubataOffering + RubataAuction + RubataPendingAck + RubataPostAcquisition |
| SuperAdmin.tsx | 2402 | SuperAdmin (tabs) + LeagueManagement + UserManagement + SystemSettings |

### 3.2 Bundle optimization

- [ ] **Stato**: DA FARE
- **Impatto**: Medio - riduce tempo caricamento iniziale
- **Effort**: ~1h
- **File**: `vite.config.ts`
- **Azioni**:
  1. Manual chunks: separare vendor-react, vendor-ui (dnd-kit), vendor-heavy (xlsx, pdfkit)
  2. Dynamic import per xlsx (usato solo in SuperAdmin) e pdfkit (usato per ricevute)

### 3.3 Standardizzare error/loading states

- [ ] **Stato**: DA FARE
- **Impatto**: Medio - migliora UX e consistenza
- **Effort**: ~2h
- **Azione**: Creare hook `useApiQuery<T>()` con pattern standardizzato loading/error/data
- **File**: `src/hooks/useApiQuery.ts` (nuovo)

### 3.4 Normalizzazione MarketSession (lungo termine)

- [ ] **Stato**: DA FARE (lungo termine)
- **Impatto**: Alto ma effort elevato
- **Effort**: ~8-12h
- **Problema**: MarketSession ha 40+ campi, di cui 20+ sono JSON blob (rubataBoard, turnOrder, readyMembers, etc.)
- **Fix**: Estrarre in tabelle relazionali separate (RubataBoard, SvincolatiTurnOrder, etc.)
- **Nota**: Lo schema ha gia TODO/commenti che suggeriscono questa normalizzazione

---

## P4 - Branch e Feature Pendenti

### 4.1 Branch strategy sovrapposti (decisione necessaria)

- [ ] **Stato**: IN ATTESA DECISIONE
- **Problema**: 3 branch creano versioni diverse dello stesso feature (FantaStrategy):

| Branch | Ahead/Behind develop | Contenuto principale |
|--------|----------------------|----------------------|
| `feature/1.x-fantastrategy-hub` (corrente) | +11/-33 | Hub DG, Plans, Seasonality, Alerts |
| `feature/1.x-hub-analytics` | +12/-33 | Estende hub con analytics WIP |
| `feature/1.x-feedback-strategie-improvements` | +11/-47 | Watchlist, Simulatore, KPI, PlayerForm |

- **Conflitti**: 78-81 file sovrapposti con develop, creano HubDG.tsx diversi
- **Decisione**: Quale branch e il "master" per strategy? Gli altri vanno cherry-picked o abbandonati

### 4.2 Mobile

- [ ] **Stato**: PARCHEGGIATO
- **Branch**: `feature/2.x-mobile-admin-features` (+20 commit, -151 behind, 0 conflitti)
- **Nota**: Tutto in `mobile/`, merge sicuro in qualsiasi momento, nessuna urgenza

### 4.3 Feature branch completati non mergiati

- [ ] **Stato**: IN ATTESA DECISIONE
- **Branch da valutare**:

| Branch | Commit | Descrizione | Azione suggerita |
|--------|--------|-------------|------------------|
| `feature/1.x-patch-notes` | 1 | Pagina Patch Notes | Merge o abbandona |
| `feature/1.x-finanze-mobile-responsive` | 3 | DonutChart/finanze responsive | Merge o abbandona |
| `fix/consolidation-movement-registration` | 1 | Fix recordMovement consolidation | Merge (fix critico) |
| `feature/vercel-analytics` | 3 | Vercel Web Analytics | Merge o abbandona |

### 4.4 Branch stale remoti

- [ ] **Stato**: DA FARE
- **Azione**: Pulire branch remoti gia mergiati o abbandonati
- ~15+ branch remoti con 0 commit ahead (gia mergiati)

---

## P5 - Evolutive Potenziali

> Da valutare DOPO completamento P1-P3.

| # | Evolutiva | Descrizione | Complessita | Priorita suggerita |
|---|-----------|-------------|-------------|-------------------|
| 1 | React Query/SWR | Sostituisce polling manuale con caching automatico, dedup, background refetch | Alta | Alta |
| 2 | Global state (Zustand) | Stato condiviso per notifiche/pending, evita API call duplicate tra componenti | Media | Media |
| 3 | Query monitoring | Prisma middleware per log query lente (>100ms), dashboard metriche | Bassa | Media |
| 4 | Cursor-based pagination | Sostituisce skip/take per liste grandi (giocatori, movimenti) | Bassa | Bassa |
| 5 | Appeal system test coverage | Flusso complesso con rollback, poco testato | Media | Media |
| 6 | Normalizzazione MarketSession | 40+ campi JSON -> tabelle relazionali (vedi P3.4) | Alta | Bassa |

---

## Ordine di Esecuzione

> Step 1-5 sono i quick win: ~5h per l'80% del miglioramento performance.

| Step | Rif. | Attivita | Impatto | Effort | Dipendenze |
|------|------|----------|---------|--------|------------|
| 1 | 1.1 | PrismaClient singleton | Alto | 1h | - |
| 2 | 1.4 | Indici mancanti | Alto | 30min | - |
| 3 | 2.1 | Fix clausola rescissoria 1→3 | Critico | 15min | - |
| 4 | 2.2 | Fix recordMovement tx | Critico | 1h | - |
| 5 | 1.2 | Ridurre polling frontend | Altissimo | 2h | - |
| 6 | 1.3 | Fix N+1 query | Alto | 3h | Step 1 |
| 7 | 1.5 | Ottimizzare select query | Medio | 2h | Step 1 |
| 8 | 2.3 | Allineare formula rinnovo | Critico | 30min | Decisione business |
| 9 | 2.4 | Budget re-check rubata | Alto | 30min | - |
| 10 | 1.6 | Cache in-memory | Medio | 2h | Step 1 |
| 11 | 3.2 | Bundle optimization | Medio | 1h | - |
| 12 | 2.5 | Validazione ESTERO/RETROCESSO | Medio | 20min | - |
| 13 | 3.1 | Split componenti grandi | Medio | 4-6h | - |
| 14 | 3.3 | Hook useApiQuery | Medio | 2h | - |
| 15 | 4.x | Decisioni branch | - | - | Decisione umana |

**Tempo totale stimato**: ~20-24h di lavoro
**Quick win (step 1-5)**: ~5h per 80% del miglioramento

---

## Note Operative

- Eseguire `npm run verify` dopo ogni step
- Committare ogni step separatamente con prefisso `perf:`, `fix:`, o `refactor:`
- Per step 8 (formula rinnovo) e step 15 (branch): servono decisioni del product owner
- Dopo step 5: monitorare req/min in produzione per verificare miglioramento
- Dopo step 2: monitorare query time su Neon dashboard
