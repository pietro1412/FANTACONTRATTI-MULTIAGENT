# Prompt: Completare FantaStrategy Hub

> **Copia e incolla questo prompt nella chat che sta implementando**

---

## Contesto

Stiamo completando il FantaStrategy Hub. Sono già stati implementati:
- ✅ MarketPhaseBanner (fase-aware UI)
- ✅ FilterSidebar (filtri 3 colonne)
- ✅ PlannerWidget (lista obiettivi budget)
- ✅ Layout 3 colonne
- ✅ HubDG (dashboard KPI)
- ✅ PlayerTrendBadge (trend up/down/stable)
- ✅ Game Status API

## Leggi Prima

**File di riferimento** (nel repo):
- `docs/COMPLETAMENTO_FANTASTRATEGY_HUB.md` - Piano dettagliato con codice
- `docs/seasonality-mockup.html` - Mockup UI stagionalità (apri nel browser)

## Cosa Manca

### 1. Stagionalità Mensile (PRIORITÀ ALTA - 5 giorni)

**Il problema**: PlayerTrendBadge mostra solo trend generico, non il breakdown mensile (Set-Mag).

**Da implementare**:
1. Nuova tabella `PlayerMatchRating` per ratings partita per partita
2. Service `seasonality.service.ts` per:
   - Sync da API-Football `/fixtures/players`
   - Calcolo `monthly_breakdown` (media per mese)
   - Identificazione `hot_months` (mesi > media + 0.3)
3. Componente `SeasonalitySparkbar.tsx`:
   - Mini istogramma 9 barre (Set-Mag)
   - Colori in base a rating (verde > 7, giallo > 6.5, rosso < 6)
   - Highlight mesi "hot" con colore diverso
4. Badge `HotMonthsBadge` ("🔥 Spring Player", "🍂 Autumn Starter")
5. API route `/api/seasonality/player/:id`

**Riferimento codice**: Vedi sezione "Sprint 5" in `COMPLETAMENTO_FANTASTRATEGY_HUB.md`

### 2. Piani Multipli (PRIORITÀ MEDIA - 3 giorni)

**Il problema**: Si può vedere solo un piano, non confrontare scenari.

**Da implementare**:
1. Nuova tabella `WatchlistPlan` (name, playerIds, totalBudget, isActive)
2. API CRUD `/api/leagues/:id/plans`
3. Selector nel PlannerWidget per switch tra piani
4. Bottone "Salva come Piano B"

**Riferimento codice**: Vedi sezione "Sprint 6" in `COMPLETAMENTO_FANTASTRATEGY_HUB.md`

### 3. Esecuzione Clausole Live (PRIORITÀ MEDIA - 2 giorni)

**Il problema**: Il PlannerWidget mostra il piano ma non permette di eseguirlo.

**Da implementare**:
1. Bottone "Esegui Piano" (visibile solo se `phase === 'clause_meeting'`)
2. Modal conferma con lista giocatori e totale
3. Chiamata sequenziale API clausole esistente
4. Feedback real-time (successo/errore per ogni giocatore)

### 4. Foto/Loghi nei Componenti (PRIORITÀ BASSA - 1 giorno)

**Il problema**: PlannerWidget e HubDG non usano foto giocatori e loghi squadre.

**Da implementare**:
- Usare `getPlayerPhotoUrl(apiFootballId)` da `utils/player-images.ts`
- Usare `getTeamLogo(team)` da `utils/teamLogos.ts`
- Aggiungere in PlayerPlanCard e nelle liste di HubDG

## Ordine Implementazione Consigliato

1. **Sprint 5**: Stagionalità (feature differenziante)
2. **Sprint 8**: Foto/Loghi (quick win)
3. **Sprint 6**: Piani Multipli
4. **Sprint 7**: Esecuzione Clausole

## Note Tecniche

- **API-Football**: Account a pagamento, rate limits alti
- **Serie A League ID**: 135
- **Branch**: `feature/1.x-fantastrategy-hub`
- **Utilities esistenti**: `getPlayerPhotoUrl`, `getTeamLogo`, `extractRatingsFromStats`

## Domande?

Se hai dubbi, i mockup in `docs/seasonality-mockup.html` mostrano esattamente come deve apparire la stagionalità.
