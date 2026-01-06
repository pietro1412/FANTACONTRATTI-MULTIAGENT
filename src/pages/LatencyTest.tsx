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

const API_URL = import.meta.env.VITE_API_URL || ''

export default function LatencyTest() {
  const [results, setResults] = useState<PingResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [testCount, setTestCount] = useState(10)
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

  async function runTests() {
    setIsRunning(true)
    setResults([])

    for (let i = 0; i < testCount; i++) {
      const result = await runSinglePing()
      setResults(prev => [...prev, result])
      // Small delay between requests
      await new Promise(r => setTimeout(r, 100))
    }

    setIsRunning(false)
  }

  function clearResults() {
    setResults([])
    idCounter.current = 0
  }

  // Calculate stats
  const okResults = results.filter(r => r.status === 'ok')
  const avgRoundTrip = okResults.length > 0
    ? Math.round(okResults.reduce((sum, r) => sum + r.roundTripMs, 0) / okResults.length)
    : 0
  const avgDbQuery = okResults.length > 0
    ? Math.round(okResults.reduce((sum, r) => sum + r.dbQueryMs, 0) / okResults.length)
    : 0
  const minRoundTrip = okResults.length > 0 ? Math.min(...okResults.map(r => r.roundTripMs)) : 0
  const maxRoundTrip = okResults.length > 0 ? Math.max(...okResults.map(r => r.roundTripMs)) : 0

  return (
    <div className="min-h-screen bg-surface-400 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Latency Test</h1>

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
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded font-medium"
            >
              {isRunning ? `Running... (${results.length}/${testCount})` : 'Run Tests'}
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
              <div className="bg-surface-200 rounded p-3">
                <div className="text-sm text-gray-400">Min Round Trip</div>
                <div className="text-2xl font-bold text-green-400">{minRoundTrip}ms</div>
              </div>
              <div className="bg-surface-200 rounded p-3">
                <div className="text-sm text-gray-400">Max Round Trip</div>
                <div className="text-2xl font-bold text-red-400">{maxRoundTrip}ms</div>
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
                  <th className="px-3 py-2 text-right">DB Data</th>
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
                      <td className="px-3 py-2 text-right font-mono text-gray-400">
                        ~{networkTime > 0 ? networkTime : 0}ms
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span className={r.dbQueryMs > 500 ? 'text-red-400' : r.dbQueryMs > 200 ? 'text-amber-400' : 'text-green-400'}>
                          {r.dbQueryMs}ms
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-400">{r.dbDataQueryMs}ms</td>
                      <td className="px-3 py-2 text-right font-mono">{r.totalBackendMs}ms</td>
                      <td className="px-3 py-2 text-center">
                        {r.status === 'ok' ? (
                          <span className="text-green-400">OK</span>
                        ) : (
                          <span className="text-red-400" title={r.error}>ERR</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 text-sm text-gray-400">
          <p><strong>Round Trip:</strong> Total time from frontend click to response received</p>
          <p><strong>Network:</strong> Estimated network latency (Round Trip - Backend Total)</p>
          <p><strong>DB Query:</strong> Time for simple SELECT 1 query</p>
          <p><strong>DB Data:</strong> Time for SELECT COUNT(*) from users table</p>
          <p><strong>Backend Total:</strong> Total time spent in backend processing</p>
        </div>
      </div>
    </div>
  )
}
