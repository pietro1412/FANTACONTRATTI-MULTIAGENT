import { useState, useCallback, useMemo } from 'react'

// API-Football v3 endpoints configuration
const API_BASE_URL = 'https://v3.football.api-sports.io'

interface ApiEndpoint {
  id: string
  name: string
  path: string
  category: string
  description: string
  params: {
    name: string
    required: boolean
    description: string
    example?: string
  }[]
}

const API_ENDPOINTS: ApiEndpoint[] = [
  // Status & Config
  {
    id: 'timezone',
    name: 'Timezone',
    path: '/timezone',
    category: 'Config',
    description: 'Get the list of available timezone',
    params: []
  },
  {
    id: 'countries',
    name: 'Countries',
    path: '/countries',
    category: 'Config',
    description: 'Get the list of available countries',
    params: [
      { name: 'name', required: false, description: 'Country name', example: 'Italy' },
      { name: 'code', required: false, description: 'Country code (2 chars)', example: 'IT' },
      { name: 'search', required: false, description: 'Search term (3+ chars)', example: 'ita' }
    ]
  },
  // Leagues
  {
    id: 'leagues',
    name: 'Leagues',
    path: '/leagues',
    category: 'Leagues',
    description: 'Get the list of available leagues and cups',
    params: [
      { name: 'id', required: false, description: 'League ID', example: '135' },
      { name: 'name', required: false, description: 'League name', example: 'Serie A' },
      { name: 'country', required: false, description: 'Country name', example: 'Italy' },
      { name: 'code', required: false, description: 'Country code', example: 'IT' },
      { name: 'season', required: false, description: 'Season year', example: '2024' },
      { name: 'team', required: false, description: 'Team ID', example: '489' },
      { name: 'type', required: false, description: 'Type: league or cup', example: 'league' },
      { name: 'current', required: false, description: 'Current season only', example: 'true' },
      { name: 'search', required: false, description: 'Search term (3+ chars)', example: 'serie' }
    ]
  },
  {
    id: 'leagues-seasons',
    name: 'Seasons',
    path: '/leagues/seasons',
    category: 'Leagues',
    description: 'Get the list of available seasons',
    params: []
  },
  // Teams
  {
    id: 'teams',
    name: 'Teams',
    path: '/teams',
    category: 'Teams',
    description: 'Get teams information',
    params: [
      { name: 'id', required: false, description: 'Team ID', example: '489' },
      { name: 'name', required: false, description: 'Team name', example: 'AC Milan' },
      { name: 'league', required: false, description: 'League ID', example: '135' },
      { name: 'season', required: false, description: 'Season year', example: '2024' },
      { name: 'country', required: false, description: 'Country name', example: 'Italy' },
      { name: 'code', required: false, description: 'Country code', example: 'IT' },
      { name: 'venue', required: false, description: 'Venue ID' },
      { name: 'search', required: false, description: 'Search term (3+ chars)', example: 'milan' }
    ]
  },
  {
    id: 'teams-statistics',
    name: 'Teams Statistics',
    path: '/teams/statistics',
    category: 'Teams',
    description: 'Get statistics for a team in a league',
    params: [
      { name: 'league', required: true, description: 'League ID', example: '135' },
      { name: 'season', required: true, description: 'Season year', example: '2024' },
      { name: 'team', required: true, description: 'Team ID', example: '489' },
      { name: 'date', required: false, description: 'Limit stats to before date', example: '2024-12-31' }
    ]
  },
  {
    id: 'teams-seasons',
    name: 'Teams Seasons',
    path: '/teams/seasons',
    category: 'Teams',
    description: 'Get available seasons for a team',
    params: [
      { name: 'team', required: true, description: 'Team ID', example: '489' }
    ]
  },
  {
    id: 'teams-countries',
    name: 'Teams Countries',
    path: '/teams/countries',
    category: 'Teams',
    description: 'Get list of countries with teams available',
    params: []
  },
  // Venues
  {
    id: 'venues',
    name: 'Venues',
    path: '/venues',
    category: 'Teams',
    description: 'Get venues information',
    params: [
      { name: 'id', required: false, description: 'Venue ID', example: '907' },
      { name: 'name', required: false, description: 'Venue name', example: 'San Siro' },
      { name: 'city', required: false, description: 'City name', example: 'Milano' },
      { name: 'country', required: false, description: 'Country name', example: 'Italy' },
      { name: 'search', required: false, description: 'Search term (3+ chars)', example: 'siro' }
    ]
  },
  // Standings
  {
    id: 'standings',
    name: 'Standings',
    path: '/standings',
    category: 'Standings',
    description: 'Get standings for a league',
    params: [
      { name: 'league', required: true, description: 'League ID', example: '135' },
      { name: 'season', required: true, description: 'Season year', example: '2024' },
      { name: 'team', required: false, description: 'Team ID', example: '489' }
    ]
  },
  // Fixtures
  {
    id: 'fixtures',
    name: 'Fixtures',
    path: '/fixtures',
    category: 'Fixtures',
    description: 'Get fixtures/matches',
    params: [
      { name: 'id', required: false, description: 'Fixture ID', example: '239625' },
      { name: 'ids', required: false, description: 'Multiple fixture IDs (max 20)', example: '239625-239626' },
      { name: 'live', required: false, description: 'Live fixtures only', example: 'all' },
      { name: 'date', required: false, description: 'Date (YYYY-MM-DD)', example: '2024-01-15' },
      { name: 'league', required: false, description: 'League ID', example: '135' },
      { name: 'season', required: false, description: 'Season year', example: '2024' },
      { name: 'team', required: false, description: 'Team ID', example: '489' },
      { name: 'last', required: false, description: 'Last X fixtures for team', example: '10' },
      { name: 'next', required: false, description: 'Next X fixtures for team', example: '10' },
      { name: 'from', required: false, description: 'Start date', example: '2024-01-01' },
      { name: 'to', required: false, description: 'End date', example: '2024-12-31' },
      { name: 'round', required: false, description: 'Round name', example: 'Regular Season - 1' },
      { name: 'status', required: false, description: 'Fixture status', example: 'NS' },
      { name: 'venue', required: false, description: 'Venue ID', example: '907' },
      { name: 'timezone', required: false, description: 'Timezone', example: 'Europe/Rome' }
    ]
  },
  {
    id: 'fixtures-rounds',
    name: 'Fixtures Rounds',
    path: '/fixtures/rounds',
    category: 'Fixtures',
    description: 'Get available rounds for a league',
    params: [
      { name: 'league', required: true, description: 'League ID', example: '135' },
      { name: 'season', required: true, description: 'Season year', example: '2024' },
      { name: 'current', required: false, description: 'Current round only', example: 'true' }
    ]
  },
  {
    id: 'fixtures-headtohead',
    name: 'Head to Head',
    path: '/fixtures/headtohead',
    category: 'Fixtures',
    description: 'Get head to head between two teams',
    params: [
      { name: 'h2h', required: true, description: 'Team IDs (id1-id2)', example: '489-496' },
      { name: 'date', required: false, description: 'Date', example: '2024-01-15' },
      { name: 'league', required: false, description: 'League ID', example: '135' },
      { name: 'season', required: false, description: 'Season year', example: '2024' },
      { name: 'last', required: false, description: 'Last X matches', example: '10' },
      { name: 'from', required: false, description: 'Start date', example: '2024-01-01' },
      { name: 'to', required: false, description: 'End date', example: '2024-12-31' },
      { name: 'status', required: false, description: 'Fixture status', example: 'FT' },
      { name: 'venue', required: false, description: 'Venue ID' },
      { name: 'timezone', required: false, description: 'Timezone', example: 'Europe/Rome' }
    ]
  },
  {
    id: 'fixtures-statistics',
    name: 'Fixtures Statistics',
    path: '/fixtures/statistics',
    category: 'Fixtures',
    description: 'Get statistics for a fixture',
    params: [
      { name: 'fixture', required: true, description: 'Fixture ID', example: '239625' },
      { name: 'team', required: false, description: 'Team ID', example: '489' },
      { name: 'type', required: false, description: 'Statistic type', example: 'Shots on Goal' }
    ]
  },
  {
    id: 'fixtures-events',
    name: 'Fixtures Events',
    path: '/fixtures/events',
    category: 'Fixtures',
    description: 'Get events for a fixture (goals, cards, subs)',
    params: [
      { name: 'fixture', required: true, description: 'Fixture ID', example: '239625' },
      { name: 'team', required: false, description: 'Team ID', example: '489' },
      { name: 'player', required: false, description: 'Player ID' },
      { name: 'type', required: false, description: 'Event type', example: 'Goal' }
    ]
  },
  {
    id: 'fixtures-lineups',
    name: 'Fixtures Lineups',
    path: '/fixtures/lineups',
    category: 'Fixtures',
    description: 'Get lineups for a fixture',
    params: [
      { name: 'fixture', required: true, description: 'Fixture ID', example: '239625' },
      { name: 'team', required: false, description: 'Team ID', example: '489' },
      { name: 'player', required: false, description: 'Player ID' },
      { name: 'type', required: false, description: 'Type', example: 'startXI' }
    ]
  },
  {
    id: 'fixtures-players',
    name: 'Fixtures Players',
    path: '/fixtures/players',
    category: 'Fixtures',
    description: 'Get player statistics for a fixture',
    params: [
      { name: 'fixture', required: true, description: 'Fixture ID', example: '239625' },
      { name: 'team', required: false, description: 'Team ID', example: '489' }
    ]
  },
  // Players
  {
    id: 'players',
    name: 'Players',
    path: '/players',
    category: 'Players',
    description: 'Get players with stats for a season',
    params: [
      { name: 'id', required: false, description: 'Player ID', example: '276' },
      { name: 'team', required: false, description: 'Team ID', example: '489' },
      { name: 'league', required: false, description: 'League ID', example: '135' },
      { name: 'season', required: true, description: 'Season year', example: '2024' },
      { name: 'search', required: false, description: 'Player name (4+ chars)', example: 'leao' },
      { name: 'page', required: false, description: 'Page number', example: '1' }
    ]
  },
  {
    id: 'players-seasons',
    name: 'Players Seasons',
    path: '/players/seasons',
    category: 'Players',
    description: 'Get available seasons for player stats',
    params: [
      { name: 'player', required: false, description: 'Player ID', example: '276' }
    ]
  },
  {
    id: 'players-squads',
    name: 'Squads',
    path: '/players/squads',
    category: 'Players',
    description: 'Get current squad of a team',
    params: [
      { name: 'team', required: false, description: 'Team ID', example: '489' },
      { name: 'player', required: false, description: 'Player ID', example: '276' }
    ]
  },
  {
    id: 'players-topscorers',
    name: 'Top Scorers',
    path: '/players/topscorers',
    category: 'Players',
    description: 'Get top 20 scorers of a league',
    params: [
      { name: 'league', required: true, description: 'League ID', example: '135' },
      { name: 'season', required: true, description: 'Season year', example: '2024' }
    ]
  },
  {
    id: 'players-topassists',
    name: 'Top Assists',
    path: '/players/topassists',
    category: 'Players',
    description: 'Get top 20 assisters of a league',
    params: [
      { name: 'league', required: true, description: 'League ID', example: '135' },
      { name: 'season', required: true, description: 'Season year', example: '2024' }
    ]
  },
  {
    id: 'players-topyellowcards',
    name: 'Top Yellow Cards',
    path: '/players/topyellowcards',
    category: 'Players',
    description: 'Get top 20 players with most yellow cards',
    params: [
      { name: 'league', required: true, description: 'League ID', example: '135' },
      { name: 'season', required: true, description: 'Season year', example: '2024' }
    ]
  },
  {
    id: 'players-topredcards',
    name: 'Top Red Cards',
    path: '/players/topredcards',
    category: 'Players',
    description: 'Get top 20 players with most red cards',
    params: [
      { name: 'league', required: true, description: 'League ID', example: '135' },
      { name: 'season', required: true, description: 'Season year', example: '2024' }
    ]
  },
  // Transfers
  {
    id: 'transfers',
    name: 'Transfers',
    path: '/transfers',
    category: 'Transfers',
    description: 'Get transfers for a player or team',
    params: [
      { name: 'player', required: false, description: 'Player ID', example: '276' },
      { name: 'team', required: false, description: 'Team ID', example: '489' }
    ]
  },
  // Trophies
  {
    id: 'trophies',
    name: 'Trophies',
    path: '/trophies',
    category: 'Trophies',
    description: 'Get trophies for a player or coach',
    params: [
      { name: 'player', required: false, description: 'Player ID', example: '276' },
      { name: 'coach', required: false, description: 'Coach ID', example: '2' }
    ]
  },
  // Sidelined
  {
    id: 'sidelined',
    name: 'Sidelined',
    path: '/sidelined',
    category: 'Injuries',
    description: 'Get sidelined players (injuries/suspensions)',
    params: [
      { name: 'player', required: false, description: 'Player ID', example: '276' },
      { name: 'coach', required: false, description: 'Coach ID', example: '2' }
    ]
  },
  // Injuries
  {
    id: 'injuries',
    name: 'Injuries',
    path: '/injuries',
    category: 'Injuries',
    description: 'Get injuries for fixtures',
    params: [
      { name: 'league', required: false, description: 'League ID', example: '135' },
      { name: 'season', required: false, description: 'Season year', example: '2024' },
      { name: 'fixture', required: false, description: 'Fixture ID', example: '239625' },
      { name: 'team', required: false, description: 'Team ID', example: '489' },
      { name: 'player', required: false, description: 'Player ID', example: '276' },
      { name: 'date', required: false, description: 'Date', example: '2024-01-15' },
      { name: 'timezone', required: false, description: 'Timezone', example: 'Europe/Rome' }
    ]
  },
  // Predictions
  {
    id: 'predictions',
    name: 'Predictions',
    path: '/predictions',
    category: 'Predictions',
    description: 'Get predictions for a fixture',
    params: [
      { name: 'fixture', required: true, description: 'Fixture ID', example: '239625' }
    ]
  },
  // Coachs
  {
    id: 'coachs',
    name: 'Coachs',
    path: '/coachs',
    category: 'Coachs',
    description: 'Get coach information and career',
    params: [
      { name: 'id', required: false, description: 'Coach ID', example: '2' },
      { name: 'team', required: false, description: 'Team ID', example: '489' },
      { name: 'search', required: false, description: 'Coach name (3+ chars)', example: 'fonseca' }
    ]
  },
  // Odds
  {
    id: 'odds',
    name: 'Odds',
    path: '/odds',
    category: 'Odds',
    description: 'Get betting odds for fixtures',
    params: [
      { name: 'fixture', required: false, description: 'Fixture ID', example: '239625' },
      { name: 'league', required: false, description: 'League ID', example: '135' },
      { name: 'season', required: false, description: 'Season year', example: '2024' },
      { name: 'date', required: false, description: 'Date', example: '2024-01-15' },
      { name: 'timezone', required: false, description: 'Timezone', example: 'Europe/Rome' },
      { name: 'page', required: false, description: 'Page number', example: '1' },
      { name: 'bookmaker', required: false, description: 'Bookmaker ID', example: '8' },
      { name: 'bet', required: false, description: 'Bet ID', example: '1' }
    ]
  },
  {
    id: 'odds-live',
    name: 'Odds Live',
    path: '/odds/live',
    category: 'Odds',
    description: 'Get live in-play odds',
    params: [
      { name: 'fixture', required: false, description: 'Fixture ID', example: '239625' },
      { name: 'league', required: false, description: 'League ID', example: '135' },
      { name: 'bet', required: false, description: 'Bet ID', example: '1' }
    ]
  },
  {
    id: 'odds-mapping',
    name: 'Odds Mapping',
    path: '/odds/mapping',
    category: 'Odds',
    description: 'Get mapping between fixtures and odds',
    params: [
      { name: 'page', required: false, description: 'Page number', example: '1' }
    ]
  },
  {
    id: 'odds-bookmakers',
    name: 'Bookmakers',
    path: '/odds/bookmakers',
    category: 'Odds',
    description: 'Get available bookmakers',
    params: [
      { name: 'id', required: false, description: 'Bookmaker ID', example: '8' },
      { name: 'search', required: false, description: 'Search term (3+ chars)', example: 'bet365' }
    ]
  },
  {
    id: 'odds-bets',
    name: 'Bet Types',
    path: '/odds/bets',
    category: 'Odds',
    description: 'Get available bet types',
    params: [
      { name: 'id', required: false, description: 'Bet ID', example: '1' },
      { name: 'search', required: false, description: 'Search term (3+ chars)', example: 'winner' }
    ]
  }
]

// Group endpoints by category
const CATEGORIES = [...new Set(API_ENDPOINTS.map(e => e.category))]

interface ApiResult {
  endpoint: string
  status: 'idle' | 'loading' | 'success' | 'error'
  data: unknown
  error?: string
  responseTime?: number
}

type ViewMode = 'json' | 'table'

// Helper to flatten nested objects for table display
function flattenObject(obj: unknown, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (obj === null || obj === undefined) {
    return { [prefix || 'value']: obj }
  }

  if (typeof obj !== 'object') {
    return { [prefix || 'value']: obj }
  }

  if (Array.isArray(obj)) {
    return { [prefix || 'value']: `[Array(${obj.length})]` }
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const newKey = prefix ? `${prefix}.${key}` : key

    if (value === null || value === undefined) {
      result[newKey] = value
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Flatten one level deep
      const nested = value as Record<string, unknown>
      for (const [nestedKey, nestedValue] of Object.entries(nested)) {
        if (typeof nestedValue === 'object' && nestedValue !== null) {
          if (Array.isArray(nestedValue)) {
            result[`${newKey}.${nestedKey}`] = `[Array(${nestedValue.length})]`
          } else {
            result[`${newKey}.${nestedKey}`] = '{...}'
          }
        } else {
          result[`${newKey}.${nestedKey}`] = nestedValue
        }
      }
    } else if (Array.isArray(value)) {
      result[newKey] = `[Array(${value.length})]`
    } else {
      result[newKey] = value
    }
  }

  return result
}

// Extract table data from API response
function extractTableData(data: unknown): { headers: string[]; rows: Record<string, unknown>[] } | null {
  if (!data || typeof data !== 'object') return null

  const apiResponse = data as { response?: unknown }

  // API-Football responses have a "response" array
  if (apiResponse.response && Array.isArray(apiResponse.response)) {
    const responseArray = apiResponse.response as unknown[]
    if (responseArray.length === 0) return { headers: [], rows: [] }

    // Flatten each item
    const flattenedRows = responseArray.map(item => flattenObject(item))

    // Get all unique headers
    const headersSet = new Set<string>()
    flattenedRows.forEach(row => {
      Object.keys(row).forEach(key => headersSet.add(key))
    })

    const headers = Array.from(headersSet).sort()
    return { headers, rows: flattenedRows }
  }

  // If it's a single object response (like team statistics)
  if (apiResponse.response && typeof apiResponse.response === 'object' && !Array.isArray(apiResponse.response)) {
    const flattened = flattenObject(apiResponse.response)
    const headers = Object.keys(flattened).sort()
    return { headers, rows: [flattened] }
  }

  return null
}

export default function ApiFootballTest() {
  const [apiKey, setApiKey] = useState('')
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [results, setResults] = useState<ApiResult[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES))
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set([0]))

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const toggleResultExpanded = (index: number) => {
    setExpandedResults(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const selectEndpoint = (endpoint: ApiEndpoint) => {
    setSelectedEndpoint(endpoint)
    // Pre-fill with examples
    const initialValues: Record<string, string> = {}
    endpoint.params.forEach(p => {
      if (p.example) {
        initialValues[p.name] = p.example
      }
    })
    setParamValues(initialValues)
  }

  const executeTest = useCallback(async () => {
    if (!selectedEndpoint || !apiKey) return

    const startTime = Date.now()

    // Build query string
    const queryParams = new URLSearchParams()
    Object.entries(paramValues).forEach(([key, value]) => {
      if (value) {
        queryParams.append(key, value)
      }
    })

    const url = `${API_BASE_URL}${selectedEndpoint.path}${queryParams.toString() ? '?' + queryParams.toString() : ''}`

    // Add to results as loading
    const newResult: ApiResult = {
      endpoint: `${selectedEndpoint.name} - ${url}`,
      status: 'loading',
      data: null
    }
    setResults(prev => [newResult, ...prev])
    setExpandedResults(prev => new Set([0, ...Array.from(prev).map(i => i + 1)]))

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      })

      const data = await response.json()
      const responseTime = Date.now() - startTime

      setResults(prev => {
        const updated = [...prev]
        updated[0] = {
          ...updated[0],
          status: response.ok ? 'success' : 'error',
          data,
          responseTime,
          error: !response.ok ? `HTTP ${response.status}` : undefined
        }
        return updated
      })
    } catch (err) {
      const responseTime = Date.now() - startTime
      setResults(prev => {
        const updated = [...prev]
        updated[0] = {
          ...updated[0],
          status: 'error',
          data: null,
          responseTime,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
        return updated
      })
    }
  }, [selectedEndpoint, apiKey, paramValues])

  const clearResults = () => {
    setResults([])
    setExpandedResults(new Set([0]))
  }

  const renderValue = (value: unknown, depth = 0): JSX.Element => {
    if (value === null) return <span className="text-gray-500">null</span>
    if (value === undefined) return <span className="text-gray-500">undefined</span>
    if (typeof value === 'boolean') return <span className="text-purple-400">{value.toString()}</span>
    if (typeof value === 'number') return <span className="text-blue-400">{value}</span>
    if (typeof value === 'string') return <span className="text-green-400">"{value}"</span>

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-500">[]</span>
      if (depth > 2) return <span className="text-gray-500">[Array({value.length})]</span>
      return (
        <div className="ml-4">
          {value.slice(0, 5).map((item, i) => (
            <div key={i} className="border-l border-gray-600 pl-2 my-1">
              [{i}]: {renderValue(item, depth + 1)}
            </div>
          ))}
          {value.length > 5 && <div className="text-gray-500">... +{value.length - 5} more</div>}
        </div>
      )
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value)
      if (entries.length === 0) return <span className="text-gray-500">{'{}'}</span>
      if (depth > 2) return <span className="text-gray-500">{'{Object}'}</span>
      return (
        <div className="ml-4">
          {entries.slice(0, 10).map(([k, v]) => (
            <div key={k} className="border-l border-gray-600 pl-2 my-1">
              <span className="text-yellow-400">{k}</span>: {renderValue(v, depth + 1)}
            </div>
          ))}
          {entries.length > 10 && <div className="text-gray-500">... +{entries.length - 10} more</div>}
        </div>
      )
    }

    return <span>{String(value)}</span>
  }

  const renderCellValue = (value: unknown): string => {
    if (value === null) return 'null'
    if (value === undefined) return '-'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const TableView = useMemo(() => {
    return ({ data }: { data: unknown }) => {
      const tableData = extractTableData(data)

      if (!tableData) {
        return <div className="text-gray-500 text-sm">Unable to display as table</div>
      }

      if (tableData.rows.length === 0) {
        return <div className="text-gray-500 text-sm">No data in response</div>
      }

      // API info from response
      const apiResponse = data as { results?: number; paging?: { current: number; total: number } }

      return (
        <div>
          {/* Response meta info */}
          <div className="flex items-center gap-4 mb-2 text-xs text-gray-400">
            {apiResponse.results !== undefined && (
              <span>Results: <span className="text-green-400">{apiResponse.results}</span></span>
            )}
            {apiResponse.paging && (
              <span>Page: <span className="text-green-400">{apiResponse.paging.current}/{apiResponse.paging.total}</span></span>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left text-gray-400 font-medium border-b border-gray-700">#</th>
                  {tableData.headers.map(header => (
                    <th
                      key={header}
                      className="px-2 py-1 text-left text-gray-400 font-medium border-b border-gray-700 whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={rowIndex % 2 === 0 ? 'bg-gray-900/50' : 'bg-gray-800/30'}
                  >
                    <td className="px-2 py-1 text-gray-500 border-b border-gray-800">{rowIndex + 1}</td>
                    {tableData.headers.map(header => (
                      <td
                        key={header}
                        className="px-2 py-1 text-gray-300 border-b border-gray-800 max-w-xs truncate"
                        title={renderCellValue(row[header])}
                      >
                        {renderCellValue(row[header])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-green-400">API-Football Test Console</h1>
          <p className="text-gray-400 text-sm mt-1">
            Test all API-Football v3 endpoints -
            <a href="https://www.api-football.com/documentation-v3" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline ml-1">
              Documentation
            </a>
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* API Key Input */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            API Key (x-rapidapi-key)
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); }}
            placeholder="Enter your API-Football key..."
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Get your free API key at <a href="https://www.api-football.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">api-football.com</a>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Endpoints List */}
          <div className="bg-gray-800 rounded-lg p-4 max-h-[70vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-3 text-gray-200">Endpoints</h2>
            {CATEGORIES.map(category => (
              <div key={category} className="mb-2">
                <button
                  onClick={() => { toggleCategory(category); }}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                >
                  <span className="font-medium text-green-400">{category}</span>
                  <span className="text-gray-400">
                    {expandedCategories.has(category) ? '▼' : '▶'}
                  </span>
                </button>
                {expandedCategories.has(category) && (
                  <div className="mt-1 ml-2 space-y-1">
                    {API_ENDPOINTS.filter(e => e.category === category).map(endpoint => (
                      <button
                        key={endpoint.id}
                        onClick={() => { selectEndpoint(endpoint); }}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          selectedEndpoint?.id === endpoint.id
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-750 hover:bg-gray-700 text-gray-300'
                        }`}
                      >
                        <div className="font-medium">{endpoint.name}</div>
                        <div className="text-xs opacity-70">{endpoint.path}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Parameter Form */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3 text-gray-200">Parameters</h2>
            {selectedEndpoint ? (
              <div>
                <div className="mb-4 p-3 bg-gray-700 rounded">
                  <div className="font-mono text-green-400 text-sm">{selectedEndpoint.path}</div>
                  <div className="text-xs text-gray-400 mt-1">{selectedEndpoint.description}</div>
                </div>

                {selectedEndpoint.params.length === 0 ? (
                  <p className="text-gray-500 text-sm">No parameters required</p>
                ) : (
                  <div className="space-y-3 max-h-[45vh] overflow-y-auto">
                    {selectedEndpoint.params.map(param => (
                      <div key={param.name}>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          {param.name}
                          {param.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <input
                          type="text"
                          value={paramValues[param.name] || ''}
                          onChange={(e) => { setParamValues(prev => ({ ...prev, [param.name]: e.target.value })); }}
                          placeholder={param.example || param.description}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">{param.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={executeTest}
                  disabled={!apiKey}
                  className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded transition-colors"
                >
                  Execute Test
                </button>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Select an endpoint to configure parameters</p>
            )}
          </div>

          {/* Results */}
          <div className="bg-gray-800 rounded-lg p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-200">Results</h2>
              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex bg-gray-700 rounded overflow-hidden">
                  <button
                    onClick={() => { setViewMode('table'); }}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === 'table' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => { setViewMode('json'); }}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === 'json' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    JSON
                  </button>
                </div>
                {results.length > 0 && (
                  <button
                    onClick={clearResults}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {results.length === 0 ? (
              <p className="text-gray-500 text-sm">No results yet. Execute a test to see results.</p>
            ) : (
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`rounded border ${
                      result.status === 'loading' ? 'border-yellow-500 bg-yellow-900/20' :
                      result.status === 'success' ? 'border-green-500 bg-green-900/20' :
                      result.status === 'error' ? 'border-red-500 bg-red-900/20' :
                      'border-gray-600 bg-gray-700/50'
                    }`}
                  >
                    {/* Result Header - Clickable */}
                    <button
                      onClick={() => { toggleResultExpanded(index); }}
                      className="w-full flex items-center justify-between p-3 text-left"
                    >
                      <span className="text-xs font-mono text-gray-400 truncate max-w-[70%]">
                        {result.endpoint}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${
                          result.status === 'loading' ? 'text-yellow-400' :
                          result.status === 'success' ? 'text-green-400' :
                          'text-red-400'
                        }`}>
                          {result.status === 'loading' ? 'Loading...' :
                          result.responseTime ? `${result.responseTime}ms` : ''}
                        </span>
                        <span className="text-gray-500">
                          {expandedResults.has(index) ? '▼' : '▶'}
                        </span>
                      </div>
                    </button>

                    {/* Result Content - Expandable */}
                    {expandedResults.has(index) && (
                      <div className="px-3 pb-3 border-t border-gray-700/50">
                        {result.error && (
                          <div className="text-red-400 text-sm mt-2">{result.error}</div>
                        )}

                        {result.data && (
                          <div className="mt-2">
                            {viewMode === 'table' ? (
                              <TableView data={result.data} />
                            ) : (
                              <div className="text-xs font-mono bg-gray-900 rounded p-2 max-h-60 overflow-auto">
                                {renderValue(result.data)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
