import { useState, useRef } from 'react'

interface PingResult {
  id: number
  timestamp: string
  frontendStart: number
  apiOnlyMs: number
  dbQueryMs: number
  dbDataQueryMs: number
  totalBackendMs: number
  roundTripMs: number
  status: 'ok' | 'error'
  error?: string
}

interface AuctionSimResult {
  id: number
  roundTripMs: number
  totalBackendMs: number
  timing: Record<string, number>
  pusherStatus: string
  status: 'ok' | 'error'
  error?: string
}

const API_URL = import.meta.env.VITE_API_URL || ''

export default function LatencyTest() {
  const [results, setResults] = useState<PingResult[]>([])
  const [auctionResults, setAuctionResults] = useState<AuctionSimResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [testCount, setTestCount] = useState(10)
  const [activeTab, setActiveTab] = useState<'ping' | 'auction'>('ping')
  const idCounter = useRef(0)

  async function runSinglePing(): Promise<PingResult> {
    const id = ++idCounter.current
    const frontendStart = Date.now()

    try {
      const response = await fetch(`${API_URL}/api/debug/ping`)
      const roundTripMs = Date.now() - frontendStart
      const data = await response.json()

      return {
        id,
        timestamp: new Date().toISOString(),
        frontendStart,
        apiOnlyMs: data.apiOnlyMs || 0,
        dbQueryMs: data.dbQueryMs || 0,
        dbDataQueryMs: data.dbDataQueryMs || 0,
        totalBackendMs: data.totalMs || 0,
        roundTripMs,
        status: 'ok',
      }
    } catch (err) {
      return {
        id,
        timestamp: new Date().toISOString(),
        frontendStart,
        apiOnlyMs: 0,
        dbQueryMs: 0,
        dbDataQueryMs: 0,
        totalBackendMs: 0,
        roundTripMs: Date.now() - frontendStart,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  async function runSingleAuctionSim(): Promise<AuctionSimResult> {
    const id = ++idCounter.current
    const frontendStart = Date.now()

    try {
      const response = await fetch(`${API_URL}/api/debug/auction-sim`)
      const roundTripMs = Date.now() - frontendStart
      const data = await response.json()

      return {
        id,
        roundTripMs,
        totalBackendMs: data.totalMs || 0,
        timing: data.timing || {},
        pusherStatus: data.pusherStatus || 'unknown',
        status: data.success ? 'ok' : 'error',
        error: data.error,
      }
    } catch (err) {
      return {
        id,
        roundTripMs: Date.now() - frontendStart,
        totalBackendMs: 0,
        timing: {},
        pusherStatus: 'error',
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  async function runTests() {
    setIsRunning(true)
    if (activeTab === 'ping') {
      setResults([])
      for (let i = 0; i < testCount; i++) {
        const result = await runSinglePing()
        setResults(prev => [...prev, result])
        await new Promise(r => setTimeout(r, 100))
      }
    } else {
      setAuctionResults([])
      for (let i = 0; i < testCount; i++) {
        const result = await runSingleAuctionSim()
        setAuctionResults(prev => [...prev, result])
        await new Promise(r => setTimeout(r, 100))
      }
    }
    setIsRunning(false)
  }

  function clearResults() {
    setResults([])
    setAuctionResults([])
    idCounter.current = 0
  }

  // Calculate stats for ping
  const okResults = results.filter(r => r.status === 'ok')
  const avgRoundTrip = okResults.length > 0
    ? Math.round(okResults.reduce((sum, r) => sum + r.roundTripMs, 0) / okResults.length)
    : 0
  const avgDbQuery = okResults.length > 0
    ? Math.round(okResults.reduce((sum, r) => sum + r.dbQueryMs, 0) / okResults.length)
    : 0

  // Calculate stats for auction
  const okAuctionResults = auctionResults.filter(r => r.status === 'ok')
  const avgAuctionRoundTrip = okAuctionResults.length > 0
    ? Math.round(okAuctionResults.reduce((sum, r) => sum + r.roundTripMs, 0) / okAuctionResults.length)
    : 0
  const avgAuctionBackend = okAuctionResults.length > 0
    ? Math.round(okAuctionResults.reduce((sum, r) => sum + r.totalBackendMs, 0) / okAuctionResults.length)
    : 0

  return (
    <div className="min-h-screen bg-surface-400 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Latency Test</h1>

        {/* Tab selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('ping')}
            className={`px-4 py-2 rounded font-medium ${activeTab === 'ping' ? 'bg-primary-500' : 'bg-surface-300 hover:bg-surface-200'}`}
          >
            Simple Ping
          </button>
          <button
            onClick={() => setActiveTab('auction')}
            className={`px-4 py-2 rounded font-medium ${activeTab === 'auction' ? 'bg-amber-500' : 'bg-surface-300 hover:bg-surface-200'}`}
          >
            Auction Simulation
          </button>
        </div>

        {/* Controls */}
        <div className="bg-surface-300 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2">
              <span>Test count:</span>
              <input
                type="number"
                value={testCount}
                onChange={(e) => setTestCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                className="w-20 px-2 py-1 bg-surface-200 rounded border border-surface-100"
                min={1}
                max={50}
              />
            </label>
            <button
              onClick={runTests}
              disabled={isRunning}
              className={`px-4 py-2 ${activeTab === 'ping' ? 'bg-primary-500 hover:bg-primary-600' : 'bg-amber-500 hover:bg-amber-600'} disabled:opacity-50 rounded font-medium`}
            >
              {isRunning ? `Running... (${activeTab === 'ping' ? results.length : auctionResults.length}/${testCount})` : `Run ${activeTab === 'ping' ? 'Ping' : 'Auction'} Tests`}
            </button>
            <button
              onClick={clearResults}
              disabled={isRunning}
              className="px-4 py-2 bg-surface-200 hover:bg-surface-100 disabled:opacity-50 rounded"
            >
              Clear
            </button>
          </div>
        </div>

        {/* PING TAB */}
        {activeTab === 'ping' && (
          <>
            {/* Stats */}
            {okResults.length > 0 && (
              <div className="bg-surface-300 rounded-lg p-4 mb-6">
                <h2 className="text-lg font-semibold mb-3">Statistics ({okResults.length} successful requests)</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-surface-200 rounded p-3">
                    <div className="text-sm text-gray-400">Avg Round Trip</div>
                    <div className="text-2xl font-bold text-primary-400">{avgRoundTrip}ms</div>
                  </div>
                  <div className="bg-surface-200 rounded p-3">
                    <div className="text-sm text-gray-400">Avg DB Query</div>
                    <div className="text-2xl font-bold text-amber-400">{avgDbQuery}ms</div>
                  </div>
                </div>
              </div>
            )}

            {/* Results Table */}
            {results.length > 0 && (
              <div className="bg-surface-300 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface-200">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-right">Round Trip</th>
                      <th className="px-3 py-2 text-right">Network</th>
                      <th className="px-3 py-2 text-right">DB Query</th>
                      <th className="px-3 py-2 text-right">Backend Total</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => {
                      const networkTime = r.roundTripMs - r.totalBackendMs
                      return (
                        <tr key={r.id} className="border-t border-surface-200">
                          <td className="px-3 py-2">{r.id}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            <span className={r.roundTripMs > 1000 ? 'text-red-400' : r.roundTripMs > 500 ? 'text-amber-400' : 'text-green-400'}>
                              {r.roundTripMs}ms
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-400">~{networkTime > 0 ? networkTime : 0}ms</td>
                          <td className="px-3 py-2 text-right font-mono">
                            <span className={r.dbQueryMs > 500 ? 'text-red-400' : r.dbQueryMs > 200 ? 'text-amber-400' : 'text-green-400'}>
                              {r.dbQueryMs}ms
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{r.totalBackendMs}ms</td>
                          <td className="px-3 py-2 text-center">
                            {r.status === 'ok' ? <span className="text-green-400">OK</span> : <span className="text-red-400" title={r.error}>ERR</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* AUCTION TAB */}
        {activeTab === 'auction' && (
          <>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
              <p className="text-amber-300 text-sm">
                Questo test simula le query che fa <code>placeBid</code> durante un'offerta:
                findAuction, findMember, countRoster, countBids, findSession + Pusher trigger
              </p>
            </div>

            {/* Stats */}
            {okAuctionResults.length > 0 && (
              <div className="bg-surface-300 rounded-lg p-4 mb-6">
                <h2 className="text-lg font-semibold mb-3">Statistics ({okAuctionResults.length} successful requests)</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-surface-200 rounded p-3">
                    <div className="text-sm text-gray-400">Avg Round Trip</div>
                    <div className="text-2xl font-bold text-primary-400">{avgAuctionRoundTrip}ms</div>
                  </div>
                  <div className="bg-surface-200 rounded p-3">
                    <div className="text-sm text-gray-400">Avg Backend Total</div>
                    <div className="text-2xl font-bold text-amber-400">{avgAuctionBackend}ms</div>
                  </div>
                </div>
              </div>
            )}

            {/* Results Table */}
            {auctionResults.length > 0 && (
              <div className="bg-surface-300 rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-200">
                    <tr>
                      <th className="px-2 py-2 text-left">#</th>
                      <th className="px-2 py-2 text-right">Round Trip</th>
                      <th className="px-2 py-2 text-right">1.Auction</th>
                      <th className="px-2 py-2 text-right">2.Member</th>
                      <th className="px-2 py-2 text-right">3.Roster</th>
                      <th className="px-2 py-2 text-right">4.Bids</th>
                      <th className="px-2 py-2 text-right">5.Session</th>
                      <th className="px-2 py-2 text-right">6.Pusher</th>
                      <th className="px-2 py-2 text-right">Total</th>
                      <th className="px-2 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auctionResults.map((r) => (
                      <tr key={r.id} className="border-t border-surface-200">
                        <td className="px-2 py-2">{r.id}</td>
                        <td className="px-2 py-2 text-right font-mono">
                          <span className={r.roundTripMs > 1000 ? 'text-red-400' : r.roundTripMs > 500 ? 'text-amber-400' : 'text-green-400'}>
                            {r.roundTripMs}ms
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs">{r.timing['1_findAuction'] ?? r.timing['1_findAnyAuction'] ?? '-'}ms</td>
                        <td className="px-2 py-2 text-right font-mono text-xs">{r.timing['2_findMember'] ?? '-'}ms</td>
                        <td className="px-2 py-2 text-right font-mono text-xs">{r.timing['3_countRoster'] ?? '-'}ms</td>
                        <td className="px-2 py-2 text-right font-mono text-xs">{r.timing['4_countWinningBids'] ?? '-'}ms</td>
                        <td className="px-2 py-2 text-right font-mono text-xs">{r.timing['5_findSession'] ?? '-'}ms</td>
                        <td className="px-2 py-2 text-right font-mono text-xs">
                          <span className={r.timing['6_pusherTrigger'] > 100 ? 'text-amber-400' : 'text-green-400'}>
                            {r.timing['6_pusherTrigger'] ?? '-'}ms
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right font-mono">{r.totalBackendMs}ms</td>
                        <td className="px-2 py-2 text-center">
                          {r.status === 'ok' ? <span className="text-green-400">OK</span> : <span className="text-red-400" title={r.error}>ERR</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Legend */}
        <div className="mt-6 text-sm text-gray-400">
          {activeTab === 'ping' ? (
            <>
              <p><strong>Round Trip:</strong> Total time from frontend click to response received</p>
              <p><strong>DB Query:</strong> Time for simple SELECT 1 query</p>
            </>
          ) : (
            <>
              <p><strong>1.Auction:</strong> Find active auction with player and league data</p>
              <p><strong>2.Member:</strong> Find league member</p>
              <p><strong>3.Roster:</strong> Count roster slots by position</p>
              <p><strong>4.Bids:</strong> Count winning bids</p>
              <p><strong>5.Session:</strong> Find market session</p>
              <p><strong>6.Pusher:</strong> Trigger Pusher event (to debug channel)</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
