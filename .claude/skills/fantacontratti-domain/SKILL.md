# Skill: FantaContratti Domain Knowledge

> Regole di business della piattaforma FantaContratti.
> Fonte: codebase attuale (contract.service.ts, rubata.service.ts, etc.)
> ⚠️ Queste sono le regole REALI implementate — hanno precedenza su qualsiasi documento esterno.

## Modello Finanziario

### Contratti
- Ogni giocatore in rosa ha un **contratto** con: salary (ingaggio), duration (durata in semestri 1-4), clausola rescissoria
- **Salary default** dopo asta: `FLOOR(prezzo_asta / 10)`, minimo 1
- **Clausola rescissoria**: `salary × moltiplicatore`
  - 1 semestre: ×3
  - 2 semestri: ×7
  - 3 semestri: ×9
  - 4 semestri: ×11
- **Costo svincolo**: `CEIL((salary × duration) / 2)`
  - Eccezione: GRATUITO per giocatori ESTERO e RETROCESSO
- **Contratto automatico post-asta**: salary = 10% prezzo, duration = 3 semestri (sia PRIMO_MERCATO che SVINCOLATI)

### Rinnovi
- Salary NON può diminuire
- Duration NON può diminuire
- Aumento durata richiede aumento salary
- MAX_DURATION = 4 semestri
- **Regola SPALMA** (quando duration=1): `newSalary × newDuration >= initialSalary`

### Budget
- Bilancio = `currentBudget - monteIngaggi`
- Minimo per offrire in asta: ≥ 2 (1 offerta + 1 salary minimo)
- In PRIMO_MERCATO: riserva 2 crediti per ogni slot vuoto rimanente

## Fasi di Mercato

### PRIMO_MERCATO
Solo fase: `ASTA_LIBERA`
- Sequenza ruoli: P → D → C → A
- Turni configurabili (firstMarketOrder)

### MERCATO_RICORRENTE (8 fasi in sequenza)
1. `OFFERTE_PRE_RINNOVO` — Scambi tra manager (trade con giocatori + budget)
2. `PREMI` — Assegnazione premi e base reincrement (default 100M)
3. `CONTRATTI` — Rinnovi, svincoli, spalma. Consolidamento obbligatorio
4. `CALCOLO_INDENNIZZI` — Decisioni su giocatori usciti (RITIRATO/RETROCESSO/ESTERO)
5. `RUBATA` — Asta forzata, ordine classifica inversa, sequenza P→D→C→A
6. `ASTA_SVINCOLATI` — Asta giocatori liberi con nomination
7. `OFFERTE_POST_ASTA_SVINCOLATI` — Secondo round scambi

## Rubata
- **Ordine**: classifica inversa (ultimo in classifica sceglie per primo)
- **Sequenza ruoli**: P → D → C → A
- **Asta forzata**: prezzo base = clausola + ingaggio, NON rifiutabile dal proprietario
- **Se nessuno offre**: il giocatore resta nella rosa attuale
- **RubataPreference**: watchlist, autoPass, maxBid, priority per ogni giocatore

## Svincolati
- **Nomination**: un manager alla volta nomina un giocatore libero
- **Asta**: offerte libere con timer (default 30s, si resetta ad ogni bid)
- **Turni configurabili** (svincolatiTurnOrder)
- **Bot**: supporto bot per nomination e bidding automatico
- **Pass**: un manager può passare il turno

## Scambi (Trade)
- **Fasi valide**: solo OFFERTE_PRE_RINNOVO e OFFERTE_POST_ASTA_SVINCOLATI
- **Contenuto offerta**: giocatori offerti + giocatori richiesti + budget offerto + budget richiesto
- **Durata default**: 24 ore
- **Vincolo anti-reverse**: non puoi scambiare gli stessi giocatori nella stessa sessione
- **Auto-invalidazione**: offerte conflittuali invalidate quando una viene accettata
- **Counter offer**: possibilità di controfferta

## Giocatori Usciti
- **RITIRATO**: auto-svincolo gratuito all'apertura mercato
- **RETROCESSO**: decisione manager (KEEP/RELEASE), rilascio gratuito
- **ESTERO**: decisione manager (KEEP/RELEASE), rilascio con indennizzo (default 50M)

## Premi
- **Base reincrement**: default 100M (distribuito a tutti)
- **Categorie personalizzabili**: con importi individuali per manager
- **Indennizzi custom**: per giocatori specifici (es. "Indennizzo - NomeGiocatore")

## Roster
- **MAX_ROSTER_SIZE**: 29 giocatori
- **Slot default**: P=3, D=8, C=8, A=6 (configurabili per lega)
- **MIN_SALARY_PERCENTAGE**: 10% del prezzo di acquisizione

## Lega
- **Partecipanti**: min 6, max 20
- **Budget iniziale**: configurabile (default 500)
- **Status**: DRAFT → ACTIVE → ARCHIVED
- **Ruoli**: ADMIN (1 per lega) + MANAGER

## Timer e Real-time
- **Timer asta**: default 30s (range 5-120), si resetta ad ogni bid
- **Heartbeat**: timeout 45s (1.5x dell'intervallo client 30s)
- **WebSocket**: Pusher, canali per lega e per sessione

## Auto-Tag Giocatori
- TITOLARE: ≥60 min in ≥70% presenze (min 3 partite)
- TOP_PERFORMER: rating medio ≥7.0 (min 3 partite)
- IN_CRESCITA: ultime 3 partite > media + 0.2
- IN_CALO: ultime 3 partite < media - 0.3
- GOLEADOR: gol ≥1.5x media del ruolo
- GIOVANE: età < 25
- ANZIANO: età > 30

## Enum Chiave
- **Position**: P, D, C, A
- **AcquisitionType**: FIRST_MARKET, RUBATA, SVINCOLATI, TRADE
- **MovementType**: FIRST_MARKET, TRADE, RUBATA, SVINCOLATI, RELEASE, CONTRACT_RENEW, RETIREMENT, RELEGATION_RELEASE, RELEGATION_KEEP, ABROAD_COMPENSATION, ABROAD_KEEP
- **ContractEventType**: SESSION_START_SNAPSHOT, DURATION_DECREMENT, AUTO_RELEASE_EXPIRED, RENEWAL, SPALMA, RELEASE_NORMAL, RELEASE_ESTERO, RELEASE_RETROCESSO, KEEP_ESTERO, KEEP_RETROCESSO, INDEMNITY_RECEIVED
