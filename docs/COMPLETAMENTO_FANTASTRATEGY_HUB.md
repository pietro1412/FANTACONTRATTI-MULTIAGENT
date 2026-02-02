# Piano Completamento FantaStrategy Hub

> **Documento per completare le funzionalità mancanti**
>
> Branch: `feature/1.x-fantastrategy-hub`
> Data: 2026-02-02

---

## Stato Attuale

### Implementato ✅
- MarketPhaseBanner (fase-aware UI con countdown)
- FilterSidebar (filtri collapsabili)
- PlannerWidget (lista obiettivi con calcolo budget)
- Layout 3 colonne responsive
- HubDG (dashboard KPI)
- PlayerTrendBadge (trend up/down/stable)
- PlayerHistoricalStats (grafici storici)
- Game Status API (`/api/game/status`)
- Test unitari per tutti i componenti

### Mancante ❌
1. **Stagionalità Mensile** (Set-Mag breakdown)
2. **Piani Multipli** (Piano A/B)
3. **Esecuzione Clausole Live**
4. **Foto/Loghi nei nuovi componenti**

---

## Sprint 5: Stagionalità Mensile (PRIORITÀ ALTA)

### 5.1 Schema Database

Aggiungere in `prisma/schemas/player.prisma`:

```prisma
// Ratings per singola partita (per calcolo stagionalità)
model PlayerMatchRating {
  id              String   @id @default(cuid())
  playerId        String
  player          SerieAPlayer @relation(fields: [playerId], references: [id], onDelete: Cascade)

  apiFixtureId    Int           // API-Football fixture ID
  matchDate       DateTime
  season          String        // "2024-2025"
  round           String?       // "Regular Season - 15"

  rating          Float?        // Rating 0-10 (null se non ha giocato)
  minutesPlayed   Int?
  goals           Int?
  assists         Int?

  createdAt       DateTime @default(now())

  @@unique([playerId, apiFixtureId])
  @@index([playerId, matchDate])
  @@index([matchDate])
  @@index([season])
}
```

Estendere `SerieAPlayer`:

```prisma
model SerieAPlayer {
  // ... campi esistenti ...

  // Relazione con match ratings
  matchRatings          PlayerMatchRating[]

  // Cache stagionalità (ricalcolata periodicamente)
  seasonalStatsCache    Json?      // { monthly_breakdown: {...}, hot_months: [...] }
  seasonalStatsCachedAt DateTime?
}
```

### 5.2 API-Football Integration

Creare `src/services/seasonality.service.ts`:

```typescript
/**
 * Servizio per sync e calcolo stagionalità giocatori
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY
const SERIE_A_LEAGUE_ID = 135

interface FixturePlayer {
  player: { id: number; name: string }
  statistics: Array<{
    games: { rating: string | null; minutes: number | null }
    goals: { total: number | null; assists: number | null }
  }>
}

interface FixtureResponse {
  fixture: { id: number; date: string }
  league: { round: string }
  players: Array<{ team: { id: number }; players: FixturePlayer[] }>
}

/**
 * Sync ratings da API-Football per una stagione
 * Chiamare una volta per stagione, poi incrementalmente
 */
export async function syncSeasonRatings(season: number): Promise<{
  success: boolean
  fixturesProcessed: number
  ratingsCreated: number
}> {
  // 1. Fetch tutti i fixtures completati della stagione
  const fixturesUrl = `https://v3.football.api-sports.io/fixtures?league=${SERIE_A_LEAGUE_ID}&season=${season}&status=FT`

  const fixturesRes = await fetch(fixturesUrl, {
    headers: {
      'x-rapidapi-key': API_FOOTBALL_KEY!,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  })

  const fixturesData = await fixturesRes.json()
  const fixtures = fixturesData.response as Array<{ fixture: { id: number; date: string }; league: { round: string } }>

  let ratingsCreated = 0

  // 2. Per ogni fixture, fetch player stats
  for (const fix of fixtures) {
    // Check if already processed
    const existing = await prisma.playerMatchRating.findFirst({
      where: { apiFixtureId: fix.fixture.id }
    })
    if (existing) continue

    // Fetch player stats for this fixture
    const playersUrl = `https://v3.football.api-sports.io/fixtures/players?fixture=${fix.fixture.id}`
    const playersRes = await fetch(playersUrl, {
      headers: {
        'x-rapidapi-key': API_FOOTBALL_KEY!,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    })

    const playersData = await playersRes.json()
    const teams = playersData.response as FixtureResponse['players']

    // 3. Per ogni giocatore, salva rating
    for (const team of teams) {
      for (const p of team.players) {
        const stats = p.statistics[0]
        if (!stats?.games?.rating) continue

        // Find player in our DB by apiFootballId
        const dbPlayer = await prisma.serieAPlayer.findFirst({
          where: { apiFootballId: p.player.id }
        })
        if (!dbPlayer) continue

        await prisma.playerMatchRating.create({
          data: {
            playerId: dbPlayer.id,
            apiFixtureId: fix.fixture.id,
            matchDate: new Date(fix.fixture.date),
            season: `${season}-${season + 1}`,
            round: fix.league.round,
            rating: parseFloat(stats.games.rating),
            minutesPlayed: stats.games.minutes,
            goals: stats.goals.total,
            assists: stats.goals.assists,
          }
        })
        ratingsCreated++
      }
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 200))
  }

  return {
    success: true,
    fixturesProcessed: fixtures.length,
    ratingsCreated,
  }
}

/**
 * Calcola monthly breakdown per un giocatore
 */
export async function calculateSeasonalStats(playerId: string): Promise<{
  monthly_breakdown: Record<string, number>
  hot_months: string[]
  avg_rating: number
}> {
  const ratings = await prisma.playerMatchRating.findMany({
    where: { playerId },
    orderBy: { matchDate: 'asc' },
  })

  if (ratings.length === 0) {
    return { monthly_breakdown: {}, hot_months: [], avg_rating: 0 }
  }

  // Group by month
  const byMonth: Record<string, number[]> = {}
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

  for (const r of ratings) {
    if (r.rating === null) continue
    const month = monthNames[r.matchDate.getMonth()]
    if (!byMonth[month]) byMonth[month] = []
    byMonth[month].push(r.rating)
  }

  // Calculate averages
  const monthly_breakdown: Record<string, number> = {}
  for (const [month, vals] of Object.entries(byMonth)) {
    monthly_breakdown[month] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }

  // Calculate overall average
  const allRatings = ratings.filter(r => r.rating !== null).map(r => r.rating!)
  const avg_rating = Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10

  // Find hot months (> avg + 0.3)
  const hot_months = Object.entries(monthly_breakdown)
    .filter(([_, avg]) => avg >= avg_rating + 0.3)
    .map(([month]) => month)

  return { monthly_breakdown, hot_months, avg_rating }
}

/**
 * Aggiorna cache stagionalità per tutti i giocatori
 */
export async function refreshSeasonalityCache(): Promise<number> {
  const players = await prisma.serieAPlayer.findMany({
    where: {
      apiFootballId: { not: null },
      matchRatings: { some: {} }
    },
    select: { id: true }
  })

  let updated = 0
  for (const player of players) {
    const stats = await calculateSeasonalStats(player.id)
    await prisma.serieAPlayer.update({
      where: { id: player.id },
      data: {
        seasonalStatsCache: stats,
        seasonalStatsCachedAt: new Date(),
      }
    })
    updated++
  }

  return updated
}
```

### 5.3 API Route

Creare `src/api/routes/seasonality.ts`:

```typescript
import { Router } from 'express'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import {
  syncSeasonRatings,
  calculateSeasonalStats,
  refreshSeasonalityCache
} from '../../services/seasonality.service'

const router = Router()

// GET /api/seasonality/player/:id - Get seasonal stats for a player
router.get('/player/:id', authMiddleware, async (req, res) => {
  try {
    const stats = await calculateSeasonalStats(req.params.id)
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Errore calcolo stagionalità' })
  }
})

// POST /api/seasonality/sync - Sync ratings from API-Football (admin only)
router.post('/sync', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const season = req.body.season || 2024
    const result = await syncSeasonRatings(season)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Errore sync stagionalità' })
  }
})

// POST /api/seasonality/refresh-cache - Refresh all player caches (admin only)
router.post('/refresh-cache', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const updated = await refreshSeasonalityCache()
    res.json({ success: true, data: { playersUpdated: updated } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Errore refresh cache' })
  }
})

export default router
```

### 5.4 Componente SeasonalitySparkbar

Creare `src/components/SeasonalitySparkbar.tsx`:

```typescript
/**
 * SeasonalitySparkbar - Mini bar chart showing monthly ratings (Sep-May)
 */

import { useMemo } from 'react'

interface SeasonalitySparkbarProps {
  monthlyBreakdown: Record<string, number>  // { sep: 6.2, oct: 6.4, ... }
  hotMonths: string[]
  currentMonth?: string
  showLabels?: boolean
  className?: string
}

// Month order for football season
const SEASON_MONTHS = ['sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may']
const MONTH_LABELS = ['S', 'O', 'N', 'D', 'G', 'F', 'M', 'A', 'M']

function getBarColor(rating: number, isHot: boolean, isCurrent: boolean): string {
  if (isCurrent) return 'bg-purple-400 animate-pulse'
  if (isHot) return 'bg-green-400'
  if (rating >= 7.0) return 'bg-green-500'
  if (rating >= 6.5) return 'bg-yellow-500'
  if (rating >= 6.0) return 'bg-orange-500'
  return 'bg-gray-600'
}

export function SeasonalitySparkbar({
  monthlyBreakdown,
  hotMonths,
  currentMonth,
  showLabels = true,
  className = '',
}: SeasonalitySparkbarProps) {
  const bars = useMemo(() => {
    return SEASON_MONTHS.map((month, idx) => {
      const rating = monthlyBreakdown[month] || 0
      const isHot = hotMonths.includes(month)
      const isCurrent = currentMonth === month
      // Normalize height: 5.0 = 0%, 8.0 = 100%
      const heightPercent = rating > 0 ? Math.max(10, Math.min(100, ((rating - 5) / 3) * 100)) : 0

      return {
        month,
        label: MONTH_LABELS[idx],
        rating,
        heightPercent,
        isHot,
        isCurrent,
        color: getBarColor(rating, isHot, isCurrent),
      }
    })
  }, [monthlyBreakdown, hotMonths, currentMonth])

  const hasData = bars.some(b => b.rating > 0)

  if (!hasData) {
    return (
      <div className={`flex items-center justify-center h-8 text-xs text-gray-500 ${className}`}>
        N/D
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-end gap-0.5 h-8">
        {bars.map(bar => (
          <div
            key={bar.month}
            className={`w-2 ${bar.color} rounded-t transition-all cursor-pointer hover:opacity-80`}
            style={{ height: `${bar.heightPercent}%` }}
            title={`${bar.month.toUpperCase()}: ${bar.rating || 'N/D'}${bar.isHot ? ' 🔥' : ''}`}
          />
        ))}
      </div>
      {showLabels && (
        <div className="flex gap-0.5 mt-0.5">
          {bars.map(bar => (
            <span
              key={bar.month}
              className={`w-2 text-[8px] text-center ${
                bar.isHot ? 'text-green-400 font-bold' :
                bar.isCurrent ? 'text-purple-400 font-bold' : 'text-gray-600'
              }`}
            >
              {bar.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Badge component for hot months
export function HotMonthsBadge({ hotMonths }: { hotMonths: string[] }) {
  if (hotMonths.length === 0) return null

  // Determine season type
  const hasSpring = hotMonths.some(m => ['mar', 'apr', 'may'].includes(m))
  const hasAutumn = hotMonths.some(m => ['sep', 'oct', 'nov'].includes(m))
  const hasWinter = hotMonths.some(m => ['dec', 'jan', 'feb'].includes(m))

  let label = ''
  let icon = ''
  let colors = ''

  if (hasSpring && !hasAutumn && !hasWinter) {
    label = 'Spring Player'
    icon = '🔥'
    colors = 'bg-orange-500/20 text-orange-400'
  } else if (hasAutumn && !hasSpring && !hasWinter) {
    label = 'Autumn Starter'
    icon = '🍂'
    colors = 'bg-amber-500/20 text-amber-400'
  } else if (hasWinter && !hasSpring && !hasAutumn) {
    label = 'Winter Warrior'
    icon = '❄️'
    colors = 'bg-cyan-500/20 text-cyan-400'
  } else {
    // Multiple peaks or consistent
    label = hotMonths.map(m => m.charAt(0).toUpperCase() + m.slice(1, 3)).join('-')
    icon = '📈'
    colors = 'bg-green-500/20 text-green-400'
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${colors}`}>
      {icon} {label}
    </span>
  )
}

export default SeasonalitySparkbar
```

### 5.5 Integrazione in StrategieRubata

Modificare la tabella giocatori per includere SeasonalitySparkbar:

```typescript
// In StrategieRubata.tsx, nella colonna trend

import { SeasonalitySparkbar, HotMonthsBadge } from '../components/SeasonalitySparkbar'

// Nella riga della tabella:
<td className="p-3">
  {player.seasonalStatsCache ? (
    <div className="flex flex-col gap-1">
      <SeasonalitySparkbar
        monthlyBreakdown={player.seasonalStatsCache.monthly_breakdown}
        hotMonths={player.seasonalStatsCache.hot_months}
        currentMonth={getCurrentMonth()}
      />
      <HotMonthsBadge hotMonths={player.seasonalStatsCache.hot_months} />
    </div>
  ) : (
    <PlayerTrendBadge ratings={extractRatings(player)} variant="compact" />
  )}
</td>
```

---

## Sprint 6: Piani Multipli (PRIORITÀ MEDIA)

### 6.1 Schema Database

Aggiungere in `prisma/schemas/watchlist.prisma`:

```prisma
model WatchlistPlan {
  id          String   @id @default(cuid())
  memberId    String
  member      LeagueMember @relation(fields: [memberId], references: [id], onDelete: Cascade)

  name        String   // "Piano A", "Piano B", "Aggressivo"
  description String?
  playerIds   String[] // Array di SerieAPlayer IDs

  totalBudget Int      // Somma clausole (calcolato)
  isActive    Boolean  @default(false)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([memberId, name])
  @@index([memberId])
}
```

### 6.2 API Routes

Creare `src/api/routes/plans.ts`:

```typescript
import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// GET /api/leagues/:id/plans - List all plans for member
router.get('/leagues/:id/plans', authMiddleware, async (req, res) => {
  try {
    const leagueId = req.params.id
    const member = await prisma.leagueMember.findFirst({
      where: { leagueId, userId: req.user!.userId, status: 'ACTIVE' }
    })
    if (!member) return res.status(403).json({ success: false, message: 'Non autorizzato' })

    const plans = await prisma.watchlistPlan.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: plans })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Errore recupero piani' })
  }
})

// POST /api/leagues/:id/plans - Create new plan
router.post('/leagues/:id/plans', authMiddleware, async (req, res) => {
  try {
    const leagueId = req.params.id
    const { name, description, playerIds } = req.body

    const member = await prisma.leagueMember.findFirst({
      where: { leagueId, userId: req.user!.userId, status: 'ACTIVE' }
    })
    if (!member) return res.status(403).json({ success: false, message: 'Non autorizzato' })

    // Calculate total budget from player clauses
    const players = await prisma.serieAPlayer.findMany({
      where: { id: { in: playerIds } },
      include: {
        rosters: {
          where: { status: 'ACTIVE' },
          include: { contract: true }
        }
      }
    })

    const totalBudget = players.reduce((sum, p) => {
      const clause = p.rosters[0]?.contract?.clause || p.quotation
      return sum + clause
    }, 0)

    const plan = await prisma.watchlistPlan.create({
      data: {
        memberId: member.id,
        name,
        description,
        playerIds,
        totalBudget,
      }
    })

    res.status(201).json({ success: true, data: plan })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Errore creazione piano' })
  }
})

// PUT /api/leagues/:id/plans/:planId - Update plan
router.put('/leagues/:id/plans/:planId', authMiddleware, async (req, res) => {
  // ... similar implementation
})

// DELETE /api/leagues/:id/plans/:planId - Delete plan
router.delete('/leagues/:id/plans/:planId', authMiddleware, async (req, res) => {
  // ... similar implementation
})

// POST /api/leagues/:id/plans/:planId/activate - Set as active plan
router.post('/leagues/:id/plans/:planId/activate', authMiddleware, async (req, res) => {
  try {
    const { id: leagueId, planId } = req.params

    const member = await prisma.leagueMember.findFirst({
      where: { leagueId, userId: req.user!.userId, status: 'ACTIVE' }
    })
    if (!member) return res.status(403).json({ success: false, message: 'Non autorizzato' })

    // Deactivate all other plans
    await prisma.watchlistPlan.updateMany({
      where: { memberId: member.id },
      data: { isActive: false }
    })

    // Activate this plan
    const plan = await prisma.watchlistPlan.update({
      where: { id: planId },
      data: { isActive: true }
    })

    res.json({ success: true, data: plan })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Errore attivazione piano' })
  }
})

export default router
```

### 6.3 UI: PlanSelector nel PlannerWidget

Aggiungere al `PlannerWidget.tsx`:

```typescript
// Aggiungere props
interface PlannerWidgetProps {
  // ... existing props ...
  plans?: WatchlistPlan[]
  activePlanId?: string
  onCreatePlan?: (name: string) => void
  onSwitchPlan?: (planId: string) => void
  onDeletePlan?: (planId: string) => void
}

// Nel header del widget, aggiungere selector:
<div className="flex items-center gap-2">
  <select
    value={activePlanId || ''}
    onChange={(e) => onSwitchPlan?.(e.target.value)}
    className="bg-surface-300 border border-surface-50/30 rounded-lg px-2 py-1 text-xs text-white"
  >
    <option value="">Piano corrente</option>
    {plans?.map(p => (
      <option key={p.id} value={p.id}>{p.name}</option>
    ))}
  </select>
  <button
    onClick={() => {
      const name = prompt('Nome del piano:')
      if (name) onCreatePlan?.(name)
    }}
    className="text-xs text-primary-400 hover:text-primary-300"
  >
    + Nuovo
  </button>
</div>
```

---

## Sprint 7: Esecuzione Clausole Live (PRIORITÀ MEDIA)

### 7.1 Integrazione con Sistema Esistente

Il sistema di pagamento clausole esiste già. Bisogna:

1. Aggiungere bottone "Esegui Piano" al PlannerWidget
2. Mostrare solo se `phase === 'clause_meeting'`
3. Chiamare API esistente per ogni clausola

```typescript
// Nel PlannerWidget, aggiungere:

{phase === 'clause_meeting' && plannedPlayers.length > 0 && (
  <div className="p-3 border-t border-surface-50/20">
    <button
      onClick={onExecutePlan}
      className="w-full py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold flex items-center justify-center gap-2"
    >
      <span>🎯</span>
      Esegui Piano ({plannedPlayers.length} clausole)
    </button>
    <p className="text-xs text-gray-500 text-center mt-2">
      Verranno pagate clausole per €{totalCommitted}M
    </p>
  </div>
)}
```

### 7.2 Conferma ed Esecuzione

Creare modal di conferma:

```typescript
// ExecutePlanModal.tsx
export function ExecutePlanModal({
  isOpen,
  onClose,
  players,
  totalBudget,
  onConfirm,
}: {
  isOpen: boolean
  onClose: () => void
  players: PlannedPlayer[]
  totalBudget: number
  onConfirm: () => Promise<void>
}) {
  const [executing, setExecuting] = useState(false)
  const [results, setResults] = useState<ExecutionResult[]>([])

  const handleExecute = async () => {
    setExecuting(true)
    // Execute each clause sequentially
    for (const player of players) {
      try {
        await rubataApi.payClause(player.id)
        setResults(prev => [...prev, { playerId: player.id, success: true }])
      } catch (error) {
        setResults(prev => [...prev, { playerId: player.id, success: false, error: error.message }])
      }
    }
    setExecuting(false)
  }

  // ... render modal with progress
}
```

---

## Sprint 8: Foto e Loghi nei Componenti (PRIORITÀ BASSA)

### 8.1 PlannerWidget

```typescript
// Nel PlayerPlanCard, aggiungere foto:

import { getPlayerPhotoUrl } from '../utils/player-images'
import { getTeamLogo } from '../utils/teamLogos'

function PlayerPlanCard({ player, onClick }: PlayerPlanCardProps) {
  const photoUrl = getPlayerPhotoUrl(player.apiFootballId)

  return (
    <button onClick={onClick} className="...">
      <div className="flex items-center gap-2">
        {/* Player photo */}
        {photoUrl ? (
          <img src={photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <span className={`w-8 h-8 rounded-full ${POS_COLORS[player.position]} flex items-center justify-center text-xs font-bold`}>
            {player.position}
          </span>
        )}

        {/* Team logo */}
        <img src={getTeamLogo(player.team)} alt="" className="w-4 h-4" />

        {/* ... rest */}
      </div>
    </button>
  )
}
```

### 8.2 HubDG

Aggiungere foto nelle cards dei top players:

```typescript
// Nei KPI o nelle liste di HubDG
<div className="flex items-center gap-3">
  <img
    src={getPlayerPhotoUrl(player.apiFootballId)}
    alt=""
    className="w-12 h-12 rounded-full object-cover border-2 border-primary-500/30"
    onError={(e) => e.currentTarget.style.display = 'none'}
  />
  <div>
    <div className="font-semibold">{player.name}</div>
    <div className="flex items-center gap-1 text-xs text-gray-400">
      <img src={getTeamLogo(player.team)} alt="" className="w-4 h-4" />
      {player.team}
    </div>
  </div>
</div>
```

---

## Riepilogo Sprint

| Sprint | Feature | Effort | Priorità |
|--------|---------|--------|----------|
| 5 | Stagionalità Mensile | 5 giorni | ALTA |
| 6 | Piani Multipli | 3 giorni | MEDIA |
| 7 | Esecuzione Clausole | 2 giorni | MEDIA |
| 8 | Foto/Loghi | 1 giorno | BASSA |

**Totale stimato: 11 giorni**

---

## Checklist Pre-Implementazione

- [ ] Verificare rate limits API-Football
- [ ] Creare migration per nuove tabelle
- [ ] Testare sync stagionalità su subset di giocatori
- [ ] Verificare integrazione con sistema clausole esistente

---

## Test da Aggiungere

```typescript
// tests/unit/SeasonalitySparkbar.test.tsx
describe('SeasonalitySparkbar', () => {
  it('renders bars for each month', () => {})
  it('highlights hot months', () => {})
  it('shows N/D when no data', () => {})
})

// tests/unit/seasonality.service.test.ts
describe('calculateSeasonalStats', () => {
  it('groups ratings by month', () => {})
  it('calculates correct averages', () => {})
  it('identifies hot months', () => {})
})

// tests/unit/plans.route.test.ts
describe('Plans API', () => {
  it('creates plan with correct budget', () => {})
  it('activates plan and deactivates others', () => {})
})
```

---

## Note Finali

1. **Sync stagionalità**: Eseguire una volta per popolare storico, poi schedulare settimanalmente
2. **Cache**: I dati stagionalità cambiano poco, usare cache 24h
3. **Performance**: Virtualizzare lista se > 100 giocatori
4. **Mobile**: Sparkbar deve essere touch-friendly
