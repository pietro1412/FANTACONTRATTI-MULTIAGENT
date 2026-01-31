/**
 * Sync Player Form History - Popola PlayerFormHistory con dati stagione 2025/26
 *
 * Questo script:
 * 1. Recupera tutti i fixture della Serie A 2025 già giocati
 * 2. Per ogni fixture, ottiene le statistiche dei giocatori
 * 3. Salva le stats in PlayerFormHistory per i giocatori con apiFootballId nel DB
 *
 * Usage: node scripts/sync-player-form-history.cjs
 *
 * Richiede: API_FOOTBALL_KEY nel .env
 */

const { PrismaClient } = require('../node_modules/.prisma/client')
const fs = require('fs')
const path = require('path')

// Load .env manually
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const [, key, value] = match
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '')
      }
    }
  })
}

const prisma = new PrismaClient()

const API_BASE = 'https://v3.football.api-sports.io'
const SERIE_A_LEAGUE_ID = 135
const CURRENT_SEASON = 2025

// Rate limiting: max requests per minute for free tier
const DELAY_BETWEEN_REQUESTS = 500 // 500ms between requests

async function apiFootballFetch(endpoint, params = {}) {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY non configurata nel .env')
  }

  const url = new URL(API_BASE + endpoint)
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, String(v)))

  const res = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  })

  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status}: ${res.statusText}`)
  }

  const data = await res.json()

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football errors: ${JSON.stringify(data.errors)}`)
  }

  return data
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getFinishedFixtures() {
  console.log('📅 Recupero fixture Serie A 2025 già giocati...')

  const data = await apiFootballFetch('/fixtures', {
    league: SERIE_A_LEAGUE_ID,
    season: CURRENT_SEASON,
    status: 'FT', // Full Time - partite finite
  })

  console.log(`   Trovati ${data.response.length} fixture completati`)
  return data.response
}

async function getFixturePlayerStats(fixtureId) {
  const data = await apiFootballFetch('/fixtures/players', {
    fixture: fixtureId,
  })
  return data.response
}

async function main() {
  console.log('🔄 Sync Player Form History - Stagione 2025/26')
  console.log('=' .repeat(50))

  try {
    // 1. Carica tutti i giocatori con apiFootballId dal DB
    const dbPlayers = await prisma.serieAPlayer.findMany({
      where: { apiFootballId: { not: null } },
      select: { id: true, apiFootballId: true, name: true },
    })

    console.log(`📊 Giocatori con apiFootballId nel DB: ${dbPlayers.length}`)

    // Mappa apiFootballId → dbPlayerId
    const apiIdToDbPlayer = new Map()
    for (const p of dbPlayers) {
      apiIdToDbPlayer.set(p.apiFootballId, { id: p.id, name: p.name })
    }

    // 2. Recupera tutti i fixture completati
    const fixtures = await getFinishedFixtures()

    if (fixtures.length === 0) {
      console.log('⚠️  Nessun fixture completato trovato per la stagione 2025')
      return
    }

    // Ordina per data (più vecchi prima)
    fixtures.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))

    console.log(`\n📆 Range date: ${fixtures[0].fixture.date.split('T')[0]} → ${fixtures[fixtures.length-1].fixture.date.split('T')[0]}`)

    // 3. Per ogni fixture, recupera stats giocatori e salva
    let totalSaved = 0
    let totalSkipped = 0
    let apiCalls = 1 // già fatta una per i fixtures

    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i]
      const fixtureId = fixture.fixture.id
      const matchDate = new Date(fixture.fixture.date)
      const homeTeam = fixture.teams.home.name
      const awayTeam = fixture.teams.away.name
      const round = fixture.league.round || 'Serie A'

      console.log(`\n[${i + 1}/${fixtures.length}] Fixture ${fixtureId}: ${homeTeam} vs ${awayTeam} (${matchDate.toLocaleDateString('it-IT')})`)

      await sleep(DELAY_BETWEEN_REQUESTS)

      try {
        const teamsStats = await getFixturePlayerStats(fixtureId)
        apiCalls++

        let savedThisFixture = 0

        for (const teamStats of teamsStats) {
          const teamName = teamStats.team.name
          const isHome = teamName === homeTeam
          const opponent = isHome ? awayTeam : homeTeam

          for (const playerData of teamStats.players) {
            const apiPlayerId = playerData.player.id
            const dbPlayer = apiIdToDbPlayer.get(apiPlayerId)

            if (!dbPlayer) {
              // Giocatore non nel nostro DB
              continue
            }

            const stats = playerData.statistics[0] // Prima (e unica) entry stats
            if (!stats) continue

            const entry = {
              playerId: dbPlayer.id,
              fixtureId: fixtureId,
              matchDate: matchDate,
              opponent: opponent,
              isHome: isHome,
              competition: round,
              minutesPlayed: stats.games?.minutes || null,
              rating: stats.games?.rating ? parseFloat(stats.games.rating) : null,
              goals: stats.goals?.total || 0,
              assists: stats.goals?.assists || 0,
              started: stats.games?.position !== null && stats.games?.minutes > 0 && stats.games?.substitute === false,
              yellowCards: stats.cards?.yellow || 0,
              redCards: stats.cards?.red || 0,
              shots: stats.shots?.total || null,
              shotsOnTarget: stats.shots?.on || null,
              passes: stats.passes?.total || null,
              passAccuracy: stats.passes?.accuracy ? parseFloat(stats.passes.accuracy) : null,
              dribbles: stats.dribbles?.success || null,
              tackles: stats.tackles?.total || null,
            }

            try {
              await prisma.playerFormHistory.upsert({
                where: {
                  playerId_fixtureId: {
                    playerId: entry.playerId,
                    fixtureId: entry.fixtureId,
                  },
                },
                create: entry,
                update: entry,
              })
              savedThisFixture++
              totalSaved++
            } catch (err) {
              console.error(`   ❌ Errore salvando ${dbPlayer.name}: ${err.message}`)
            }
          }
        }

        console.log(`   ✅ Salvati ${savedThisFixture} record per questo fixture`)

      } catch (err) {
        console.error(`   ❌ Errore fixture ${fixtureId}: ${err.message}`)
        totalSkipped++
      }
    }

    console.log('\n' + '=' .repeat(50))
    console.log('📊 RIEPILOGO SYNC')
    console.log('=' .repeat(50))
    console.log(`   Fixture processati: ${fixtures.length - totalSkipped}/${fixtures.length}`)
    console.log(`   Record salvati: ${totalSaved}`)
    console.log(`   Chiamate API usate: ${apiCalls}`)

    // Verifica conteggio finale
    const totalRecords = await prisma.playerFormHistory.count()
    const uniquePlayers = await prisma.playerFormHistory.groupBy({
      by: ['playerId'],
    })
    console.log(`\n📈 Stato DB PlayerFormHistory:`)
    console.log(`   Record totali: ${totalRecords}`)
    console.log(`   Giocatori con storico: ${uniquePlayers.length}`)

  } catch (error) {
    console.error('❌ Errore:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
