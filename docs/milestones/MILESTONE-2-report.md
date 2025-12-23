# Report Milestone Sprint 2

**Data:** Dicembre 2025
**Sprint:** 2 - Sessione d'Asta e Rose
**Status:** ✅ COMPLETATO

---

## Checklist Verifica

| Item | Status |
|------|--------|
| Seed giocatori Serie A (130 giocatori) | ✅ |
| API lista giocatori con filtri | ✅ |
| Creazione sessione d'asta | ✅ |
| Nomina giocatore all'asta | ✅ |
| Sistema offerte con validazione budget | ✅ |
| Verifica slot rosa prima dell'offerta | ✅ |
| Chiusura asta e assegnazione | ✅ |
| Creazione contratto automatico | ✅ |
| Scalare budget dopo acquisto | ✅ |
| Visualizzazione rosa | ✅ |
| Frontend sala asta | ✅ |
| Build senza errori | ✅ |
| Test passing | ✅ (3 test) |

---

## API Implementate

### Players (`/api/players`)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/` | Lista giocatori con filtri (position, team, search, available) |
| GET | `/:id` | Dettaglio giocatore |
| GET | `/teams` | Lista squadre Serie A |

### Auction Sessions

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/leagues/:id/auctions` | Crea sessione asta (Admin) |
| GET | `/api/leagues/:id/auctions` | Lista sessioni |
| PUT | `/api/auctions/sessions/:id/close` | Chiudi sessione (Admin) |

### Auction Items

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/auctions/sessions/:id/nominate` | Nomina giocatore (Admin) |
| GET | `/api/auctions/sessions/:id/current` | Asta corrente |

### Bidding

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/auctions/:id/bid` | Fai offerta |
| PUT | `/api/auctions/:id/close` | Chiudi asta e assegna (Admin) |

### Roster

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/leagues/:id/roster` | La mia rosa |
| GET | `/api/leagues/:id/roster/:memberId` | Rosa di un membro |
| GET | `/api/leagues/:id/rosters` | Tutte le rose |

---

## Frontend Implementato

### Pagine

| Pagina | File | Descrizione |
|--------|------|-------------|
| League Detail | `LeagueDetail.tsx` | Dettaglio lega, gestione sessioni |
| Auction Room | `AuctionRoom.tsx` | Sala asta real-time |
| Roster | `Roster.tsx` | Visualizzazione rosa |

### Funzionalità Sala Asta

- **Admin:**
  - Apri/chiudi sessione d'asta
  - Cerca e nomina giocatori
  - Chiudi asta corrente

- **Manager:**
  - Visualizza giocatore in asta
  - Fai offerte con pulsanti rapidi (+1, +5, +10, +25)
  - Visualizza storico offerte
  - Vedi il tuo budget

---

## Database

### Tabelle Utilizzate

| Tabella | Funzione |
|---------|----------|
| SerieAPlayer | 130 giocatori Serie A |
| MarketSession | Sessioni d'asta |
| Auction | Aste singole giocatori |
| AuctionBid | Offerte |
| PlayerRoster | Rose dei manager |
| PlayerContract | Contratti automatici |

### Giocatori per Ruolo

| Ruolo | Quantità |
|-------|----------|
| Portieri (P) | 19 |
| Difensori (D) | 38 |
| Centrocampisti (C) | 35 |
| Attaccanti (A) | 38 |
| **Totale** | **130** |

---

## Logica Business Implementata

### Flusso Asta

1. Admin apre sessione → `MarketSession.status = ACTIVE`
2. Admin nomina giocatore → crea `Auction.status = ACTIVE`
3. Manager offre → verifica budget e slot rosa
4. Offerta registrata → aggiorna `currentPrice`
5. Admin chiude asta → assegna al miglior offerente
6. Sistema crea `PlayerRoster` + `PlayerContract`
7. Budget scalato dal vincitore

### Validazioni Offerta

- Budget sufficiente
- Prezzo superiore all'offerta corrente
- Slot rosa disponibile per il ruolo

### Contratto Automatico

- **Durata:** 6 semestri (3 anni)
- **Salary:** Prezzo di acquisto
- **Clausola rescissione:** 2x salary

---

## Comandi di Test

```bash
# Esegui seed giocatori
npx tsx prisma/seed.ts

# Avvia development
npm run dev

# Test API (con auth)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"...","password":"..."}'

# Lista attaccanti
curl http://localhost:3001/api/players?position=A \
  -H "Authorization: Bearer <token>"
```

---

## Note per il PM

### Come testare l'asta

1. Login come admin della lega
2. Dalla pagina lega, clicca "Apri Sessione d'Asta"
3. Clicca "Entra nell'Asta"
4. Cerca un giocatore e cliccalo per nominarlo
5. Da un altro browser (manager), fai un'offerta
6. Admin chiude l'asta
7. Verifica che il giocatore sia nella rosa del vincitore

### Polling Real-time

La sala asta fa polling ogni 3 secondi per aggiornare le offerte. In futuro si potrà sostituire con WebSocket.

---

## Prossimi Passi (Sprint 3-4)

**Sprint 3 - Contratti e Rinnovi:**
- Visualizzazione contratti
- Rinnovo contratto
- Svincolo giocatore
- Calcolo clausola rescissoria

**Sprint 4 - Scambi:**
- Proposta scambio
- Accetta/Rifiuta scambio
- Controproposta

---

## Validazione PM

- [ ] Ho testato la creazione sessione d'asta
- [ ] Ho testato la nomina giocatore
- [ ] Ho testato le offerte
- [ ] Ho verificato l'assegnazione e scalatura budget
- [ ] Ho verificato la rosa dopo l'acquisto
- [ ] Autorizzo a procedere con Sprint 3

**Firma PM:** _______________
**Data validazione:** _______________
