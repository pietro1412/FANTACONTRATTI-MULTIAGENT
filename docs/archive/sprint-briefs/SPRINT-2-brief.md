# Sprint 2 Brief - Sessione d'Asta e Rose

**Data:** Dicembre 2025
**Dipendenze:** Sprint 1 completato

---

## OBIETTIVO SPRINT

Implementare il sistema di aste per l'acquisto giocatori e la gestione delle rose. Al termine di questo sprint, gli admin potranno aprire sessioni d'asta e i manager potranno fare offerte per acquistare giocatori Serie A.

---

## DESCRIZIONE FUNZIONALE

### Cosa realizzeremo

1. **Database Giocatori Serie A**
   - Seed con giocatori reali (nome, ruolo, squadra)
   - Prezzo base per ruolo

2. **Sessione d'Asta**
   - Admin apre/chiude sessione d'asta
   - Nomina giocatore da mettere all'asta
   - Timer countdown per offerte
   - Offerta minima incrementale

3. **Sistema Offerte**
   - Manager fa offerta (se ha budget)
   - Rilancio minimo configurabile
   - Assegnazione al miglior offerente
   - Scalare budget dopo acquisto

4. **Gestione Rosa**
   - Visualizzazione rosa per ruolo
   - Slot disponibili per ruolo
   - Contratto automatico alla prima stagione

---

## API ENDPOINTS

```
# Players
GET    /api/players                    - Lista giocatori (con filtri)
GET    /api/players/:id                - Dettaglio giocatore

# Auction Sessions
POST   /api/leagues/:id/auctions       - Crea sessione asta (Admin)
GET    /api/leagues/:id/auctions       - Lista sessioni
GET    /api/leagues/:id/auctions/:auctionId - Dettaglio sessione
PUT    /api/leagues/:id/auctions/:auctionId - Aggiorna stato (Admin)

# Auction Items (giocatori in asta)
POST   /api/auctions/:id/items         - Nomina giocatore (Admin)
GET    /api/auctions/:id/items/current - Giocatore corrente in asta
PUT    /api/auctions/:id/items/:itemId - Chiudi asta giocatore

# Bids
POST   /api/auctions/:id/bids          - Fai offerta
GET    /api/auctions/:id/bids          - Storico offerte

# Roster
GET    /api/leagues/:id/roster         - La mia rosa nella lega
GET    /api/leagues/:id/roster/:memberId - Rosa di un membro
```

---

## FLUSSO ASTA

1. **Admin apre sessione** → status = OPEN
2. **Admin nomina giocatore** → crea AuctionItem con prezzo base
3. **Timer parte** (es. 30 secondi)
4. **Manager offre** → verifica budget, crea Bid
5. **Altri rilanciano** → timer si resetta
6. **Timer scade** → giocatore assegnato al miglior offerente
7. **Sistema aggiorna**: budget, rosa, contratto
8. **Admin nomina prossimo** o chiude sessione

---

## REGOLE BUSINESS

- **Prezzo base per ruolo**: P=1, D=1, C=1, A=1 (configurabile)
- **Rilancio minimo**: 1 credito
- **Timer default**: 30 secondi
- **Budget scalato** immediatamente dopo assegnazione
- **Slot verificati** prima di assegnare (non può comprare se slot pieni)
- **Contratto automatico**: 3 anni alla prima stagione

---

## CHECKLIST MILESTONE 2

```
□ Seed giocatori Serie A funzionante
□ Creazione sessione asta
□ Nomina giocatore all'asta
□ Sistema offerte con validazione budget
□ Timer countdown (frontend)
□ Assegnazione giocatore e scalare budget
□ Visualizzazione rosa
□ Contratto automatico creato
□ Test coverage ≥ 90%
```
