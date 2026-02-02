# Prompt: Completare FantaStrategy Hub - V2

> **Copia e incolla questo prompt nella chat che sta implementando**

---

## Contesto

Stiamo completando il FantaStrategy Hub. Un'altra chat ha analizzato i gap tra mockup/specifiche e implementazione attuale.

### Gia' Implementato e Committato
- SeasonalitySparkbar, PlayerTrendBadge, PlayerFormChart, PlayerHistoricalStats
- MarketPhaseBanner, FilterSidebar, PlannerWidget, ExecutePlanModal
- HubDG, WatchlistPlan (DB + API), PlayerMatchRating (DB)
- Foto/Loghi giocatori

### Implementato ma NON Committato (file untracked)
- `src/components/AlertBell.tsx`
- `src/api/routes/alerts.ts`
- `src/services/alerts.service.ts`
- `prisma/schemas/alert.prisma`

---

## PROBLEMA CRITICO

**I modelli `WatchlistCategory` e `WatchlistEntry` NON ESISTONO nel database!**

Il file `alerts.service.ts` li usa gia', quindi non funzionera' fino a quando non vengono creati.

---

## Cosa Implementare (7 Fasi)

### Fase A: Creare Modelli Watchlist (BLOCCANTE)

Crea `prisma/schemas/watchlist.prisma`:

```prisma
model WatchlistCategory {
  id              String   @id @default(cuid())
  leagueId        String
  league          League   @relation(fields: [leagueId], references: [id])
  name            String
  description     String?
  icon            String?
  color           String?
  isSystemDefault Boolean  @default(false)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  entries         WatchlistEntry[]

  @@unique([leagueId, name])
  @@index([leagueId])
}

model WatchlistEntry {
  id          String            @id @default(cuid())
  categoryId  String
  category    WatchlistCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  memberId    String
  member      LeagueMember      @relation(fields: [memberId], references: [id])
  playerId    String
  player      SerieAPlayer      @relation(fields: [playerId], references: [id])
  maxBid      Int?
  targetPrice Int?
  notes       String?
  addedAt     DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  statsAtAdd  Json?

  @@unique([categoryId, memberId, playerId])
  @@index([memberId, categoryId])
  @@index([playerId])
}
```

Aggiungi relazioni in:
- `League`: `watchlistCategories WatchlistCategory[]`
- `LeagueMember`: `watchlistEntries WatchlistEntry[]`
- `SerieAPlayer`: `watchlistEntries WatchlistEntry[]`

Poi:
```bash
npx prisma generate --schema=prisma/schema.generated.prisma
npx prisma db push --schema=prisma/schema.generated.prisma
```

### Fase B: Committare Alert System

1. Committa i file alert (gia' scritti ma untracked)
2. Integra AlertBell in `src/components/Navigation.tsx`
3. Registra routes in server: `app.use('/api', alertRoutes)`

### Fase C: API Watchlist Categories

Crea `src/api/routes/watchlist.ts` e `src/services/watchlist.service.ts`:

| Endpoint | Descrizione |
|----------|-------------|
| GET /leagues/:id/watchlist/categories | Lista categorie |
| POST /leagues/:id/watchlist/categories | Crea categoria |
| GET /leagues/:id/watchlist/:categoryId | Entry di categoria |
| POST /leagues/:id/watchlist/:categoryId/players | Aggiungi giocatore |
| PUT /leagues/:id/watchlist/entries/:entryId | Modifica entry |
| DELETE /leagues/:id/watchlist/entries/:entryId | Rimuovi entry |

Crea funzione per generare categorie di sistema al setup lega:
- Da Rubare (rosso #ef4444)
- Sotto Osservazione (giallo #f59e0b)
- Potenziali Acquisti (verde #22c55e)
- Scambi Possibili (blu #3b82f6)
- Da Vendere (grigio #6b7280)

### Fase D: Allineare Dashboard al Mockup

Modifica `src/pages/HubDG.tsx`:

1. **5 Card categoria con contatori** (come nel mockup `docs/strategie-mockups.html`)
2. **Sezione "Ultime Notizie dai Tuoi Osservati"** - mostra ultimi 3-5 alert
3. **Sezione "Top Priorita'"** - giocatori con priorita' 4-5 stelle

Apri `docs/strategie-mockups.html` nel browser per vedere esattamente come deve apparire.

### Fase E: Vista Categoria Watchlist

Crea `src/components/WatchlistCategoryView.tsx`:

- Header "Da Rubare (12 giocatori)"
- Filtri: Ordina (Priorita, Form, Prezzo), Posizione
- Lista player cards con: foto, nome, team, form, maxBid, priorita', clausola, alert inline
- Checkbox selezione multipla
- Bulk actions: Confronta, Sposta in..., Rimuovi

### Fase F: Quick Add e Strategia in Modal

1. **QuickAddToWatchlist.tsx**: Dropdown nella tabella per aggiungere rapidamente a categoria

2. **Sezione strategia in PlayerStatsModal.tsx**:
   - Dropdown categoria watchlist
   - Input max offerta
   - Stelle priorita' (1-5)
   - Textarea note
   - Bottone Salva

### Fase G: Job Sync Automatici (opzionale)

Configura node-cron o Vercel Cron:
- Ogni 6h: sync stats stagionali
- Ogni giorno 8:00: sync form recente
- Dopo giornata: genera alert

---

## File di Riferimento

| File | Descrizione |
|------|-------------|
| `docs/STRATEGIE_IMPROVEMENT_PLAN.md` | Piano miglioramento completo |
| `docs/strategie-mockups.html` | **APRI NEL BROWSER** - Mockup UI interattivo |
| `docs/COMPLETAMENTO_FANTASTRATEGY_HUB.md` | Sprint dettagliati |

---

## Ordine Implementazione

```
Fase A (modelli DB) --> Fase B (alert) --> Fase C (API watchlist)
                                                    |
                                                    v
Fase D (dashboard) --> Fase E (vista categoria) --> Fase F (quick add)
                                                    |
                                                    v
                                              Fase G (cron jobs)
```

**Inizia SEMPRE dalla Fase A** - senza i modelli WatchlistCategory/Entry niente altro funzionera'.

---

## Verifica Finale

Dopo l'implementazione:
1. Dashboard mostra 5 card categoria con contatori corretti
2. Alert bell visibile in navigation con badge count
3. Click su categoria porta a lista giocatori filtrata
4. Quick add funziona dalla tabella giocatori
5. Modal giocatore ha sezione strategia salvabile
6. Bulk actions funzionano (confronta, sposta, rimuovi)

---

## Domande?

Se hai dubbi sull'aspetto UI, apri `docs/strategie-mockups.html` nel browser - e' il riferimento visivo definitivo.
