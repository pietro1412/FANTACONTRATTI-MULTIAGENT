import { useState, useEffect } from 'react'
import { superadminApi } from '../../services/api'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import {
  POSITION_CHIP,
  type ApiFootballStatus,
  type MatchingResult,
  type SyncResult,
  type MatchProposal,
  type MatchedPlayer,
} from './types'

export function StatsTab() {
  const [apiFootballStatus, setApiFootballStatus] = useState<ApiFootballStatus | null>(null)
  const [apiFootballLoading, setApiFootballLoading] = useState(false)
  const [matchingResult, setMatchingResult] = useState<MatchingResult | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [manualMatchPlayerId, setManualMatchPlayerId] = useState<string>('')
  const [manualMatchApiId, setManualMatchApiId] = useState<string>('')

  const [matchProposals, setMatchProposals] = useState<MatchProposal[]>([])
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalsError, setProposalsError] = useState<string | null>(null)
  const [cacheRefreshing, setCacheRefreshing] = useState(false)
  const [cacheStatus, setCacheStatus] = useState<{ count: number; refreshed: boolean } | null>(null)
  const [confirmingMatch, setConfirmingMatch] = useState(false)

  // Search modal
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [searchModalPlayer, setSearchModalPlayer] = useState<MatchProposal['dbPlayer'] | null>(null)
  const [apiSearchQuery, setApiSearchQuery] = useState('')
  const [apiSearchResults, setApiSearchResults] = useState<Array<{ id: number; name: string; team: string; position: string }>>([])
  const [apiSearchLoading, setApiSearchLoading] = useState(false)
  const [selectedApiPlayer, setSelectedApiPlayer] = useState<number | null>(null)

  // Matched players
  const [matchedPlayers, setMatchedPlayers] = useState<MatchedPlayer[]>([])
  const [matchedLoading, setMatchedLoading] = useState(false)
  const [matchedSearch, setMatchedSearch] = useState('')
  const [removingMatch, setRemovingMatch] = useState<string | null>(null)

  useEffect(() => {
    void loadApiFootballStatus()
    void loadMatchProposals()
    void loadMatchedPlayers()
  }, [])

  async function loadApiFootballStatus() {
    setApiFootballLoading(true)
    try {
      const res = await superadminApi.getApiFootballStatus()
      if (res.success && res.data) {
        setApiFootballStatus(res.data)
      }
    } finally {
      setApiFootballLoading(false)
    }
  }

  async function loadMatchProposals() {
    setProposalsLoading(true)
    setProposalsError(null)
    try {
      const res = await superadminApi.getMatchProposals()
      if (res.success && res.data) {
        setMatchProposals(res.data.proposals)
        setCacheStatus({ count: res.data.proposals.length, refreshed: res.data.cacheRefreshed })
      } else {
        setProposalsError(res.message || 'Errore nel caricamento delle proposte')
      }
    } catch {
      setProposalsError('Errore di rete nel caricamento delle proposte')
    } finally {
      setProposalsLoading(false)
    }
  }

  async function handleRefreshCache() {
    setCacheRefreshing(true)
    setProposalsError(null)
    try {
      const res = await superadminApi.refreshApiFootballCache()
      if (res.success) {
        await loadMatchProposals()
      } else {
        setProposalsError(res.message || 'Errore nel refresh della cache')
      }
    } catch {
      setProposalsError('Errore di rete nel refresh della cache')
    } finally {
      setCacheRefreshing(false)
    }
  }

  async function handleConfirmProposal(dbPlayerId: string, apiFootballId: number) {
    setConfirmingMatch(true)
    try {
      const res = await superadminApi.confirmMatch(dbPlayerId, apiFootballId)
      if (res.success) {
        setMatchProposals(prev => prev.filter(p => p.dbPlayer.id !== dbPlayerId))
        void loadApiFootballStatus()
      }
    } finally {
      setConfirmingMatch(false)
    }
  }

  async function handleApiSearch() {
    if (apiSearchQuery.length < 2) return
    setApiSearchLoading(true)
    try {
      const res = await superadminApi.searchApiFootballPlayers(apiSearchQuery)
      if (res.success && res.data) {
        setApiSearchResults(res.data.players)
      }
    } finally {
      setApiSearchLoading(false)
    }
  }

  function openSearchModal(dbPlayer: MatchProposal['dbPlayer']) {
    setSearchModalPlayer(dbPlayer)
    setSearchModalOpen(true)
    setApiSearchQuery('')
    setApiSearchResults([])
    setSelectedApiPlayer(null)
  }

  function closeSearchModal() {
    setSearchModalOpen(false)
    setSearchModalPlayer(null)
    setApiSearchQuery('')
    setApiSearchResults([])
    setSelectedApiPlayer(null)
  }

  async function loadMatchedPlayers(search?: string) {
    setMatchedLoading(true)
    try {
      const res = await superadminApi.getMatchedPlayers(search)
      if (res.success && res.data) {
        setMatchedPlayers(res.data.players)
      }
    } finally {
      setMatchedLoading(false)
    }
  }

  async function handleRemoveMatch(playerId: string) {
    setRemovingMatch(playerId)
    try {
      const res = await superadminApi.removeMatch(playerId)
      if (res.success) {
        setMatchedPlayers(prev => prev.filter(p => p.id !== playerId))
        void loadMatchProposals()
        void loadApiFootballStatus()
      }
    } finally {
      setRemovingMatch(null)
    }
  }

  async function handleManualAssociation() {
    if (!searchModalPlayer || !selectedApiPlayer) return
    setConfirmingMatch(true)
    try {
      const res = await superadminApi.confirmMatch(searchModalPlayer.id, selectedApiPlayer)
      if (res.success) {
        setMatchProposals(prev => prev.filter(p => p.dbPlayer.id !== searchModalPlayer.id))
        closeSearchModal()
        void loadApiFootballStatus()
        void loadMatchedPlayers(matchedSearch)
      }
    } finally {
      setConfirmingMatch(false)
    }
  }

  async function handleMatchPlayers() {
    setApiFootballLoading(true)
    setMatchingResult(null)
    try {
      const res = await superadminApi.matchApiFootballPlayers()
      if (res.success && res.data) {
        setMatchingResult(res.data)
        const status = await superadminApi.getApiFootballStatus()
        if (status.success && status.data) setApiFootballStatus(status.data)
      }
    } finally {
      setApiFootballLoading(false)
    }
  }

  async function handleSyncStats() {
    setApiFootballLoading(true)
    setSyncResult(null)
    try {
      const res = await superadminApi.syncApiFootballStats()
      if (res.success && res.data) {
        setSyncResult(res.data)
        const status = await superadminApi.getApiFootballStatus()
        if (status.success && status.data) setApiFootballStatus(status.data)
      }
    } finally {
      setApiFootballLoading(false)
    }
  }

  async function handleManualMatch() {
    if (!manualMatchPlayerId || !manualMatchApiId) return
    setApiFootballLoading(true)
    try {
      const res = await superadminApi.manualMatchPlayer(manualMatchPlayerId, parseInt(manualMatchApiId))
      if (res.success) {
        setManualMatchPlayerId('')
        setManualMatchApiId('')
        const status = await superadminApi.getApiFootballStatus()
        if (status.success && status.data) setApiFootballStatus(status.data)
      }
    } finally {
      setApiFootballLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-50 flex items-center justify-between gap-3">
          <div>
            <h2 className="micro-label text-gray-300">Stato Sync API-Football</h2>
            <p className="text-xs text-gray-500 mt-1">Statistiche giocatori da API-Football v3</p>
          </div>
          <Button
            onClick={() => void loadApiFootballStatus()}
            variant="secondary"
            size="sm"
            disabled={apiFootballLoading}
          >
            {apiFootballLoading ? 'Caricamento...' : 'Aggiorna Stato'}
          </Button>
        </div>
        <div className="p-4">
          {apiFootballStatus ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-surface-300 border border-surface-50 rounded-xl p-4 text-center">
                <p className="stat-number text-2xl text-white">{apiFootballStatus.totalPlayers}</p>
                <p className="text-xs text-gray-400 mt-1">Giocatori Totali</p>
              </div>
              <div className="bg-surface-300 border border-secondary-500/30 rounded-xl p-4 text-center">
                <p className="stat-number text-2xl text-secondary-400">{apiFootballStatus.matched}</p>
                <p className="text-xs text-gray-400 mt-1">Matchati</p>
              </div>
              <div className="bg-surface-300 border border-warning-500/30 rounded-xl p-4 text-center">
                <p className="stat-number text-2xl text-warning-400">{apiFootballStatus.unmatched}</p>
                <p className="text-xs text-gray-400 mt-1">Non Matchati</p>
              </div>
              <div className="bg-surface-300 border border-primary-500/30 rounded-xl p-4 text-center">
                <p className="stat-number text-2xl text-primary-400">{apiFootballStatus.withStats}</p>
                <p className="text-xs text-gray-400 mt-1">Con Stats</p>
              </div>
              <div className="bg-surface-300 border border-danger-500/30 rounded-xl p-4 text-center">
                <p className="stat-number text-2xl text-danger-400">{apiFootballStatus.withoutStats}</p>
                <p className="text-xs text-gray-400 mt-1">Senza Stats</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">Clicca "Aggiorna Stato" per caricare i dati</p>
          )}

          {apiFootballStatus?.lastSync && (
            <p className="text-xs text-gray-500 text-center mt-4 font-mono">
              Ultimo sync: {new Date(apiFootballStatus.lastSync).toLocaleDateString('it-IT', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Match Players */}
        <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-50">
            <h3 className="micro-label text-gray-300">1. Match Giocatori</h3>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-400 mb-4">
              Associa automaticamente i giocatori nel DB ai loro ID API-Football tramite nome e squadra.
              Circa 20 chiamate API.
            </p>
            <Button
              onClick={() => void handleMatchPlayers()}
              disabled={apiFootballLoading}
              className="w-full"
            >
              {apiFootballLoading ? 'Matching in corso...' : 'Avvia Matching Automatico'}
            </Button>

            {matchingResult && (
              <div className="mt-4 p-4 bg-surface-300 border border-surface-50 rounded-xl">
                <p className="text-secondary-400 font-medium">{matchingResult.matched} giocatori matchati</p>
                {matchingResult.unmatched.length > 0 && (
                  <p className="text-warning-400 text-sm mt-1">{matchingResult.unmatched.length} non trovati</p>
                )}
                {matchingResult.ambiguous.length > 0 && (
                  <p className="text-primary-400 text-sm mt-1">{matchingResult.ambiguous.length} ambigui (match multiplo)</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sync Stats */}
        <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-50">
            <h3 className="micro-label text-gray-300">2. Sync Statistiche</h3>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-400 mb-4">
              Scarica le statistiche Serie A per tutti i giocatori matchati.
              Circa 25 chiamate API.
            </p>
            <Button
              onClick={() => void handleSyncStats()}
              disabled={apiFootballLoading}
              variant="secondary"
              className="w-full"
            >
              {apiFootballLoading ? 'Sync in corso...' : 'Avvia Sync Statistiche'}
            </Button>

            {syncResult && (
              <div className="mt-4 p-4 bg-surface-300 border border-surface-50 rounded-xl">
                <p className="text-secondary-400 font-medium">{syncResult.synced} giocatori aggiornati</p>
                {syncResult.notFound > 0 && (
                  <p className="text-warning-400 text-sm mt-1">{syncResult.notFound} senza stats Serie A</p>
                )}
                <p className="text-gray-500 text-xs mt-2 font-mono">{syncResult.apiCallsUsed} chiamate API usate</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Match */}
      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-50">
          <h3 className="micro-label text-gray-300">Match Manuale</h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-400 mb-4">
            Per i giocatori non matchati automaticamente, inserisci manualmente l'ID API-Football.
          </p>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block micro-label text-gray-400 mb-1">Player ID (dal DB)</label>
              <Input
                placeholder="es. clx123..."
                value={manualMatchPlayerId}
                onChange={(e) => { setManualMatchPlayerId(e.target.value); }}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block micro-label text-gray-400 mb-1">API-Football ID</label>
              <Input
                placeholder="es. 217"
                value={manualMatchApiId}
                onChange={(e) => { setManualMatchApiId(e.target.value); }}
              />
            </div>
            <Button
              onClick={() => void handleManualMatch()}
              disabled={apiFootballLoading || !manualMatchPlayerId || !manualMatchApiId}
            >
              Match
            </Button>
          </div>

          {/* Unmatched players list */}
          {matchingResult && matchingResult.unmatched.length > 0 && (
            <div className="mt-6">
              <h4 className="micro-label text-gray-400 mb-3">Giocatori Non Matchati ({matchingResult.unmatched.length})</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {matchingResult.unmatched.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-surface-300 border border-surface-50 rounded-lg p-2">
                    <div>
                      <span className="text-white font-medium">{p.name}</span>
                      <span className="text-gray-400 text-sm ml-2">{p.team}</span>
                    </div>
                    <button
                      onClick={() => { setManualMatchPlayerId(p.id); }}
                      className="text-xs text-primary-400 hover:text-primary-300"
                    >
                      Seleziona
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Matching Assistito */}
      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-50 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="micro-label text-gray-300">Matching Assistito</h3>
            <p className="text-xs text-gray-500 mt-1">
              Rivedi le proposte di associazione e conferma o cerca manualmente
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => void handleRefreshCache()}
              disabled={cacheRefreshing || proposalsLoading}
              variant="secondary"
              size="sm"
            >
              {cacheRefreshing ? 'Aggiornando Cache...' : 'Aggiorna Cache API'}
            </Button>
            <Button
              onClick={() => void loadMatchProposals()}
              disabled={proposalsLoading || cacheRefreshing}
              variant="outline"
              size="sm"
            >
              {proposalsLoading ? 'Caricamento...' : 'Genera Proposte'}
            </Button>
          </div>
        </div>
        <div className="p-4">
          {/* Error message */}
          {proposalsError && (
            <div className="mb-4 p-4 bg-danger-500/20 border border-danger-500/40 rounded-lg">
              <p className="text-danger-400 text-sm">{proposalsError}</p>
            </div>
          )}

          {/* Cache status */}
          {cacheStatus && (
            <div className="mb-4 p-3 bg-surface-300 border border-surface-50 rounded-lg text-sm text-gray-400">
              {cacheStatus.refreshed && <span className="text-secondary-400 mr-2">Cache aggiornata!</span>}
              Trovate {cacheStatus.count} proposte di matching
            </div>
          )}

          {/* Proposals */}
          {matchProposals.length > 0 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-secondary-500/[0.13] border border-secondary-500/40 rounded-lg p-3 text-center">
                  <p className="stat-number text-xl text-secondary-400">
                    {matchProposals.filter(p => p.confidence === 'HIGH').length}
                  </p>
                  <p className="text-xs text-gray-400">Alta</p>
                </div>
                <div className="bg-primary-500/[0.13] border border-primary-500/40 rounded-lg p-3 text-center">
                  <p className="stat-number text-xl text-primary-400">
                    {matchProposals.filter(p => p.confidence === 'MEDIUM').length}
                  </p>
                  <p className="text-xs text-gray-400">Media</p>
                </div>
                <div className="bg-warning-500/[0.13] border border-warning-500/40 rounded-lg p-3 text-center">
                  <p className="stat-number text-xl text-warning-400">
                    {matchProposals.filter(p => p.confidence === 'LOW').length}
                  </p>
                  <p className="text-xs text-gray-400">Bassa</p>
                </div>
                <div className="bg-surface-300 border border-surface-50 rounded-lg p-3 text-center">
                  <p className="stat-number text-xl text-gray-400">
                    {matchProposals.filter(p => p.confidence === 'NONE').length}
                  </p>
                  <p className="text-xs text-gray-400">Nessuna</p>
                </div>
              </div>

              {/* Proposals List */}
              <div className="max-h-[500px] overflow-y-auto space-y-2">
                {matchProposals.map((proposal) => {
                  const confidenceChips = {
                    HIGH: 'bg-secondary-500/[0.13] text-secondary-400 border-secondary-500/40',
                    MEDIUM: 'bg-primary-500/[0.13] text-primary-400 border-primary-500/40',
                    LOW: 'bg-warning-500/[0.13] text-warning-400 border-warning-500/40',
                    NONE: 'bg-surface-100 text-gray-400 border-surface-50',
                  }
                  const confidenceLabels = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Bassa', NONE: 'Nessuna' }

                  return (
                    <div key={proposal.dbPlayer.id} className="bg-surface-300 border border-surface-50 rounded-xl p-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        {/* DB Player */}
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <span className={`w-8 h-8 rounded-full border flex items-center justify-center font-display font-bold text-xs ${POSITION_CHIP[proposal.dbPlayer.position] ?? ''}`}>
                            {proposal.dbPlayer.position}
                          </span>
                          <div>
                            <p className="font-display font-bold text-white">{proposal.dbPlayer.name}</p>
                            <p className="text-xs text-gray-400">
                              {proposal.dbPlayer.team} · Quot. {proposal.dbPlayer.quotation}
                            </p>
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="text-gray-500">→</div>

                        {/* API Player Proposal */}
                        <div className="flex-1 min-w-[200px]">
                          {proposal.apiPlayer ? (
                            <div>
                              <p className="font-display font-bold text-white">{proposal.apiPlayer.name}</p>
                              <p className="text-xs text-gray-500 font-mono">
                                {proposal.apiPlayer.team} · ID: {proposal.apiPlayer.id}
                              </p>
                            </div>
                          ) : (
                            <p className="text-gray-500 italic">Nessuna proposta</p>
                          )}
                        </div>

                        {/* Confidence Chip */}
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${confidenceChips[proposal.confidence]}`}>
                          {confidenceLabels[proposal.confidence]}
                        </span>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {proposal.apiPlayer && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => { void handleConfirmProposal(proposal.dbPlayer.id, proposal.apiPlayer!.id) }}
                              disabled={confirmingMatch}
                            >
                              Conferma
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { openSearchModal(proposal.dbPlayer); }}
                          >
                            Cerca
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {matchProposals.length === 0 && !proposalsLoading && (
            <div className="py-8 text-center text-gray-400">
              <p>Tutti i giocatori sono stati associati</p>
              <p className="text-sm mt-1">Non ci sono proposte di matching in sospeso</p>
            </div>
          )}

          {proposalsLoading && (
            <div className="py-8 text-center">
              <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Generazione proposte in corso...</p>
              <p className="text-xs text-gray-500 mt-1">Potrebbe richiedere alcuni secondi se la cache deve essere aggiornata</p>
            </div>
          )}
        </div>
      </div>

      {/* Existing Matches */}
      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-50 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="micro-label text-gray-300">Associazioni Esistenti</h3>
            <p className="text-xs text-gray-500 mt-1">
              Visualizza e modifica le associazioni gia confermate ({matchedPlayers.length})
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={matchedSearch}
              onChange={(e) => { setMatchedSearch(e.target.value); }}
              placeholder="Cerca giocatore..."
              className="w-48"
              onKeyDown={(e) => { void (e.key === 'Enter' && loadMatchedPlayers(matchedSearch)) }}
            />
            <Button
              onClick={() => { void loadMatchedPlayers(matchedSearch) }}
              variant="outline"
              size="sm"
              disabled={matchedLoading}
            >
              {matchedLoading ? '...' : 'Cerca'}
            </Button>
          </div>
        </div>
        <div className="p-4">
          {matchedLoading ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
            </div>
          ) : matchedPlayers.length > 0 ? (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {matchedPlayers.map((player) => (
                <div key={player.id} className="bg-surface-300 border border-surface-50 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <span className={`w-8 h-8 rounded-full border flex items-center justify-center font-display font-bold text-xs ${POSITION_CHIP[player.position] ?? ''}`}>
                      {player.position}
                    </span>
                    <div className="min-w-[180px]">
                      <p className="font-display font-bold text-white">{player.name}</p>
                      <p className="text-xs text-gray-400">{player.team}</p>
                    </div>
                  </div>

                  <div className="text-gray-500 mx-4">↔</div>

                  <div className="flex-1">
                    <p className="font-display font-bold text-secondary-400">{player.apiFootballName || `ID: ${player.apiFootballId}`}</p>
                    <p className="text-xs text-gray-500 font-mono">API ID: {player.apiFootballId}</p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="border-danger-500/50 text-danger-400 hover:bg-danger-500/20"
                    onClick={() => { void handleRemoveMatch(player.id) }}
                    disabled={removingMatch === player.id}
                  >
                    {removingMatch === player.id ? '...' : 'Rimuovi'}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400">
              <p>Nessuna associazione trovata</p>
              {matchedSearch && <p className="text-sm mt-1">Prova a cercare con altri termini</p>}
            </div>
          )}
        </div>
      </div>

      {/* Search API-Football Modal */}
      {searchModalOpen && searchModalPlayer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl border border-surface-50 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-surface-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-xl text-white">Cerca Giocatore API-Football</h2>
                  <p className="text-sm text-gray-400">
                    Associa <span className="text-white font-medium">{searchModalPlayer.name}</span> ({searchModalPlayer.team})
                  </p>
                </div>
                <button
                  onClick={closeSearchModal}
                  className="w-10 h-10 rounded-lg bg-surface-300 hover:bg-surface-100 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex gap-3 mb-4">
                <Input
                  value={apiSearchQuery}
                  onChange={(e) => { setApiSearchQuery(e.target.value); }}
                  placeholder="Cerca per nome..."
                  className="flex-1"
                  onKeyDown={(e) => { void (e.key === 'Enter' && handleApiSearch()) }}
                />
                <Button
                  onClick={() => void handleApiSearch()}
                  disabled={apiSearchLoading || apiSearchQuery.length < 2}
                >
                  {apiSearchLoading ? 'Ricerca...' : 'Cerca'}
                </Button>
              </div>

              {apiSearchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400 mb-3">
                    {apiSearchResults.length} risultati trovati
                  </p>
                  {apiSearchResults.map((player) => (
                    <label
                      key={player.id}
                      className={`block bg-surface-300 border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedApiPlayer === player.id
                          ? 'ring-2 ring-primary-500 bg-primary-500/10 border-primary-500/40'
                          : 'border-surface-50 hover:bg-surface-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="apiPlayer"
                          value={player.id}
                          checked={selectedApiPlayer === player.id}
                          onChange={() => { setSelectedApiPlayer(player.id); }}
                          className="w-4 h-4 text-primary-500"
                        />
                        <div className="flex-1">
                          <p className="font-display font-bold text-white">{player.name}</p>
                          <p className="text-xs text-gray-400 font-mono">
                            {player.team} · {player.position} · ID: {player.id}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {apiSearchResults.length === 0 && apiSearchQuery.length >= 2 && !apiSearchLoading && (
                <div className="py-8 text-center text-gray-400">
                  <p>Nessun giocatore trovato</p>
                  <p className="text-sm mt-1">Prova con un altro termine di ricerca</p>
                </div>
              )}

              {apiSearchQuery.length < 2 && (
                <div className="py-8 text-center text-gray-400">
                  <p>Inserisci almeno 2 caratteri per cercare</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-surface-50 bg-surface-300 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeSearchModal}>
                Annulla
              </Button>
              <Button
                className="flex-1"
                onClick={() => void handleManualAssociation()}
                disabled={!selectedApiPlayer || confirmingMatch}
              >
                {confirmingMatch ? 'Associazione...' : 'Associa'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
