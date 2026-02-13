# BIBBIA: Statistiche Giocatori e Matching API Football

> Fonte di verita per l'algoritmo di matching giocatori e la sincronizzazione statistiche.
> Ultima revisione: 2026-02-07

---

## 1. FONTI DATI

### 1.1 Fantagazzetta (Quotazioni)
- **Tipo**: File Excel caricato dal SuperAdmin
- **Dati**: Nome, squadra, ruolo, quotazione, ID interno
- **Frequenza**: Ad ogni sessione di mercato (inizio stagione + mercato invernale)
- **Modello DB**: `SerieAPlayer`

### 1.2 API Football (Statistiche)
- **Provider**: api-sports.io (v3)
- **Dati**: Presenze, gol, assist, voto medio, cartellini, tiri, passaggi, etc.
- **Frequenza**: Aggiornamento settimanale (limiti API: 100 call/giorno piano Free)
- **Modello DB**: `SerieAPlayer.apiFootballId` (link) + campi statistiche
- **Lega**: Serie A (ID 135), Stagione corrente (2025)

---

## 2. ALGORITMO DI MATCHING

Il matching associa i giocatori del DB (da quotazioni Fantagazzetta) ai giocatori di API Football tramite il nome, poiche non esiste un ID comune tra le due fonti.

### 2.1 Livelli di Matching (in ordine di priorita)

| Livello | Strategia | Confidenza | Auto-match |
|---------|-----------|------------|------------|
| 1 | Match esatto nome completo | HIGH | Si (se unico) |
| 2 | Match esatto cognome | HIGH | Si (se unico) |
| 3 | Match su parte del nome | HIGH | Si (se unico) |
| 4 | Match parziale per inclusione cognome | MEDIUM | Si (se unico) |
| 5 | Levenshtein distance <= 20% | LOW | Si (se unico) |
| 6 | Match multipli (ambiguo) | - | No → SuperAdmin |
| 7 | Nessun match | NONE | No → SuperAdmin |

### 2.2 Dettaglio Strategie

#### Strategy A: Match esatto (Livello 1-2)
```
DB: "Morata"  → normalize → "morata"
API: "Morata" → normalize → "morata"
→ Match esatto cognome: AUTO
```
- Confronta il nome completo normalizzato E il cognome estratto
- Se esattamente 1 match → auto-match

#### Strategy B: Match parziale cognome (Livello 4)
```
DB: "Di Lorenzo" → extractLastName → "lorenzo"
API: "Giovanni Di Lorenzo" → extractLastName → "lorenzo"
→ "lorenzo".includes("lorenzo") = true: MATCH PARZIALE
```
- Verifica se un cognome contiene l'altro (o viceversa)
- Utile per abbreviazioni o nomi composti

#### Strategy C: Name-part match (Livello 3)
```
DB: "Morata"          → getNameParts → ["morata"]
API: "Alvaro Morata"  → getNameParts → ["alvaro", "morata"]
→ "morata" in apiParts: MATCH
```
- Divide entrambi i nomi in parti (parole >= 3 caratteri)
- Se una parte del nome DB compare nelle parti del nome API → match
- Solo se esattamente 1 match nella squadra → auto-match

#### Strategy D: Levenshtein (Livello 5)
```
DB: "Ronalod"  → extractLastName → "ronalod"
API: "Ronaldo" → extractLastName → "ronaldo"
→ Levenshtein distance = 2, maxLen = 7, ratio = 0.28 > 0.20: NO MATCH
→ (soglia conservativa al 20% per evitare falsi positivi)
```
- Calcola la distanza di editing tra cognomi
- Soglia: <= 20% della lunghezza massima (piu conservativa del 30% usato nei proposals)
- Solo se esattamente 1 match → auto-match

### 2.3 Normalizzazione Nomi

La funzione `normalizeName()` esegue:
1. Lowercase
2. Rimozione diacritici (NFD + strip combining marks): `Álvaro` → `alvaro`
3. Rimozione caratteri non-alfabetici (eccetto spazi)
4. Trim spazi

### 2.4 Estrazione Cognome

La funzione `extractLastName()`:
1. Normalizza il nome completo
2. Divide per spazi
3. Filtra iniziali (parti <= 2 caratteri)
4. Restituisce l'ultima parte non-iniziale (convenzione italiana: Nome Cognome)

---

## 3. PERSISTENZA MATCH

### 3.1 Match Automatici
- Salvati immediatamente in `SerieAPlayer.apiFootballId`
- Ai run successivi, i giocatori gia matchati vengono skippati
- Se un API Football ID e gia assegnato a un altro giocatore → skip (unique constraint)

### 3.2 Match Manuali
- Il SuperAdmin seleziona il match corretto dalla UI dei proposals
- Salvato tramite `manualMatch()` in `SerieAPlayer.apiFootballId`
- Permanente: non viene sovrascritto da run automatici successivi

### 3.3 Match Proposals (UI Assistita)
- Per giocatori ambigui o senza match, il sistema genera proposals
- Proposals con confidenza HIGH/MEDIUM/LOW/NONE
- Il SuperAdmin conferma o cerca manualmente il giocatore API
- Metodi usati nei proposals: stessi del matching auto + Levenshtein al 30%

---

## 4. CAMPI STATISTICHE SINCRONIZZATI

| Campo DB | Campo API Football | Descrizione |
|----------|-------------------|-------------|
| `appearances` | `games.appearences` | Presenze totali |
| `minutes` | `games.minutes` | Minuti giocati |
| `rating` | `games.rating` | Voto medio (stringa → float) |
| `goals` | `goals.total` | Gol segnati |
| `assists` | `goals.assists` | Assist |
| `goalsConceded` | `goals.conceded` | Gol subiti (portieri) |
| `saves` | `goals.saves` | Parate (portieri) |
| `yellowCards` | `cards.yellow` | Cartellini gialli |
| `redCards` | `cards.red` | Cartellini rossi |
| `shotsTotal` | `shots.total` | Tiri totali |
| `shotsOnTarget` | `shots.on` | Tiri in porta |
| `passAccuracy` | `passes.accuracy` | % precisione passaggi |
| `dribbleSuccess` | `dribbles.success` | Dribbling riusciti |
| `tacklesTotal` | `tackles.total` | Contrasti |
| `interceptions` | `tackles.interceptions` | Intercettazioni |
| `duelsWon` | `duels.won` | Duelli vinti |
| `foulsCommitted` | `fouls.committed` | Falli commessi |
| `penaltyScored` | `penalty.scored` | Rigori segnati |
| `penaltyMissed` | `penalty.missed` | Rigori sbagliati |

---

## 5. FLUSSO OPERATIVO SUPERADMIN

### 5.1 Pipeline Completa

```
1. CACHE → Refresh cache squadre API Football
   (scarica rose aggiornate di tutte le squadre Serie A)

2. MATCH → Esegui matching automatico
   (applica Strategy A → B → C → D in ordine)
   Risultato: X matchati, Y ambigui, Z non trovati

3. PROPOSALS → Gestisci ambigui e non trovati
   (UI con proposte assistite per SuperAdmin)

4. SYNC STATS → Sincronizza statistiche
   (scarica stats stagione corrente per tutti i matchati)
```

### 5.2 Frequenza Consigliata

| Operazione | Quando |
|------------|--------|
| Cache refresh | A inizio stagione + dopo mercato invernale |
| Match automatico | Dopo ogni cache refresh |
| Match manuale | Dopo ogni match automatico (per risolvere ambigui) |
| Sync statistiche | Settimanalmente durante la stagione |

### 5.3 Limiti API

- Piano Free: 100 chiamate/giorno
- Cache refresh: ~20 call (1 per squadra Serie A)
- Match: usa la cache locale (0 call aggiuntive se cache fresca)
- Sync stats: ~30 call (paginazione giocatori Serie A)
- **Totale pipeline completa**: ~50 call

---

## 6. GESTIONE ERRORI

### 6.1 API Key Non Configurata
- Messaggio: "API_FOOTBALL_KEY non configurata"
- Soluzione: Impostare la variabile d'ambiente `API_FOOTBALL_KEY` nel server

### 6.2 Rate Limiting
- Delay di 100ms tra le chiamate alle squadre
- Se il piano API viene superato, la chiamata fallisce con errore HTTP

### 6.3 Giocatori Non Matchabili
- Giocatori con nomi molto diversi tra le due fonti (es. soprannomi)
- Giocatori nuovi non ancora nelle rose API Football
- Soluzione: match manuale via UI SuperAdmin

---

## CHANGELOG

| Data | Modifica |
|------|----------|
| 2026-02-07 | Creazione documento con algoritmo matching a 5 livelli, campi statistiche, flusso operativo |
