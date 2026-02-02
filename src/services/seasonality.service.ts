/**
 * Seasonality Service
 * Sync and calculate monthly performance breakdown for players
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
 * Sync ratings from API-Football for a season
 * Call once per season, then incrementally for new matches
 */
export async function syncSeasonRatings(season: number): Promise<{
  success: boolean
  fixturesProcessed: number
  ratingsCreated: number
}> {
  if (!API_FOOTBALL_KEY) {
    throw new Error('API_FOOTBALL_KEY not configured')
  }

  // 1. Fetch all completed fixtures for the season
  const fixturesUrl = `https://v3.football.api-sports.io/fixtures?league=${SERIE_A_LEAGUE_ID}&season=${season}&status=FT`

  const fixturesRes = await fetch(fixturesUrl, {
    headers: {
      'x-rapidapi-key': API_FOOTBALL_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  })

  const fixturesData = await fixturesRes.json()
  const fixtures = fixturesData.response as Array<{
    fixture: { id: number; date: string }
    league: { round: string }
  }>

  let ratingsCreated = 0

  // 2. For each fixture, fetch player stats
  for (const fix of fixtures) {
    // Check if already processed
    const existing = await prisma.playerMatchRating.findFirst({
      where: { apiFixtureId: fix.fixture.id },
    })
    if (existing) continue

    // Fetch player stats for this fixture
    const playersUrl = `https://v3.football.api-sports.io/fixtures/players?fixture=${fix.fixture.id}`
    const playersRes = await fetch(playersUrl, {
      headers: {
        'x-rapidapi-key': API_FOOTBALL_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    })

    const playersData = await playersRes.json()
    const teams = playersData.response as FixtureResponse['players']

    // 3. For each player, save rating
    for (const team of teams || []) {
      for (const p of team.players) {
        const stats = p.statistics[0]
        if (!stats?.games?.rating) continue

        // Find player in our DB by apiFootballId
        const dbPlayer = await prisma.serieAPlayer.findFirst({
          where: { apiFootballId: p.player.id },
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
          },
        })
        ratingsCreated++
      }
    }

    // Rate limiting (API-Football allows 10 requests/minute on free plan)
    await new Promise((r) => setTimeout(r, 200))
  }

  return {
    success: true,
    fixturesProcessed: fixtures.length,
    ratingsCreated,
  }
}

/**
 * Calculate monthly breakdown for a player
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
  const monthNames = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ]

  for (const r of ratings) {
    if (r.rating === null) continue
    const month = monthNames[r.matchDate.getMonth()]
    if (!byMonth[month]) byMonth[month] = []
    byMonth[month].push(r.rating)
  }

  // Calculate averages per month
  const monthly_breakdown: Record<string, number> = {}
  for (const [month, vals] of Object.entries(byMonth)) {
    monthly_breakdown[month] =
      Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }

  // Calculate overall average
  const allRatings = ratings
    .filter((r) => r.rating !== null)
    .map((r) => r.rating!)
  const avg_rating =
    Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10

  // Find hot months (> avg + 0.3)
  const hot_months = Object.entries(monthly_breakdown)
    .filter(([_, avg]) => avg >= avg_rating + 0.3)
    .map(([month]) => month)

  return { monthly_breakdown, hot_months, avg_rating }
}

/**
 * Refresh seasonality cache for all players with match data
 */
export async function refreshSeasonalityCache(): Promise<number> {
  const players = await prisma.serieAPlayer.findMany({
    where: {
      apiFootballId: { not: null },
      matchRatings: { some: {} },
    },
    select: { id: true },
  })

  let updated = 0
  for (const player of players) {
    const stats = await calculateSeasonalStats(player.id)
    await prisma.serieAPlayer.update({
      where: { id: player.id },
      data: {
        seasonalStatsCache: stats,
        seasonalStatsCachedAt: new Date(),
      },
    })
    updated++
  }

  return updated
}

/**
 * Get cached or compute seasonality stats for a player
 */
export async function getPlayerSeasonality(playerId: string): Promise<{
  monthly_breakdown: Record<string, number>
  hot_months: string[]
  avg_rating: number
} | null> {
  const player = await prisma.serieAPlayer.findUnique({
    where: { id: playerId },
    select: {
      seasonalStatsCache: true,
      seasonalStatsCachedAt: true,
    },
  })

  if (!player) return null

  // If cached within last 24h, return cache
  const cacheAge = player.seasonalStatsCachedAt
    ? Date.now() - player.seasonalStatsCachedAt.getTime()
    : Infinity
  const ONE_DAY = 24 * 60 * 60 * 1000

  if (player.seasonalStatsCache && cacheAge < ONE_DAY) {
    return player.seasonalStatsCache as {
      monthly_breakdown: Record<string, number>
      hot_months: string[]
      avg_rating: number
    }
  }

  // Otherwise compute fresh
  const stats = await calculateSeasonalStats(playerId)

  // Update cache
  await prisma.serieAPlayer.update({
    where: { id: playerId },
    data: {
      seasonalStatsCache: stats,
      seasonalStatsCachedAt: new Date(),
    },
  })

  return stats
}

/**
 * Get current month name (for highlighting)
 */
export function getCurrentMonth(): string {
  const monthNames = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ]
  return monthNames[new Date().getMonth()]
}
