import type { RefObject } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import {
  POSITION_CHIP,
  POSITION_NAMES,
  type PlayersStats,
  type UploadRecord,
  type ExitedPlayerInfo,
} from './types'

export interface UploadTabProps {
  stats: PlayersStats | null
  positionStats: Record<'P' | 'D' | 'C' | 'A', { inList: number; notInList: number }>
  sheetName: string
  setSheetName: (value: string) => void
  fileInputRef: RefObject<HTMLInputElement | null>
  importing: boolean
  deleting: boolean
  onImport: () => void
  onRequestDelete: () => void
  historyLoading: boolean
  uploadHistory: UploadRecord[]
  classificationLoading: boolean
  playersNeedingClassification: ExitedPlayerInfo[]
  onOpenClassification: () => void
}

export function UploadTab({
  stats,
  positionStats,
  sheetName,
  setSheetName,
  fileInputRef,
  importing,
  deleting,
  onImport,
  onRequestDelete,
  historyLoading,
  uploadHistory,
  classificationLoading,
  playersNeedingClassification,
  onOpenClassification,
}: UploadTabProps) {
  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-surface-300 border border-surface-50 rounded-xl p-4 text-center">
            <p className="stat-number text-3xl text-white">{stats.totalPlayers}</p>
            <p className="text-sm text-gray-400 mt-1">Totale Giocatori</p>
          </div>
          <div className="bg-surface-300 border border-secondary-500/30 rounded-xl p-4 text-center">
            <p className="stat-number text-3xl text-secondary-400">{stats.inList}</p>
            <p className="text-sm text-gray-400 mt-1">In Lista</p>
          </div>
          <div className="bg-surface-300 border border-danger-500/30 rounded-xl p-4 text-center">
            <p className="stat-number text-3xl text-danger-400">{stats.notInList}</p>
            <p className="text-sm text-gray-400 mt-1">Non in Lista</p>
          </div>
          <div className="bg-surface-300 border border-accent-500/30 rounded-xl p-4 text-center">
            <p className="stat-number text-3xl text-accent-400">
              {stats.totalPlayers > 0 ? ((stats.inList / stats.totalPlayers) * 100).toFixed(0) : 0}%
            </p>
            <p className="text-sm text-gray-400 mt-1">Attivi</p>
          </div>
        </div>
      )}

      {/* Position breakdown */}
      {stats && stats.totalPlayers > 0 && (
        <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-50">
            <h2 className="micro-label text-gray-300">Giocatori per Ruolo</h2>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['P', 'D', 'C', 'A'] as const).map(pos => (
              <div key={pos} className="bg-surface-300 border border-surface-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-8 h-8 rounded-full border flex items-center justify-center font-display font-bold text-xs ${POSITION_CHIP[pos] ?? ''}`}>{pos}</span>
                  <span className="text-gray-300 font-medium">{POSITION_NAMES[pos]}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-secondary-400 font-mono">{positionStats[pos].inList} attivi</span>
                  <span className="text-gray-500 font-mono">{positionStats[pos].notInList} rimossi</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-50">
          <h2 className="micro-label text-gray-300">Carica Quotazioni</h2>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-gray-400 text-sm">
            Carica un file Excel (.xlsx) con le quotazioni Fantacalcio.
          </p>

          <div>
            <label className="block micro-label text-gray-400 mb-2">Nome Foglio</label>
            <Input
              value={sheetName}
              onChange={(e) => { setSheetName(e.target.value); }}
              placeholder="Es: Tutti"
              className="max-w-xs"
            />
            <p className="text-xs text-gray-500 mt-1">Il nome del foglio Excel da leggere (default: "Tutti")</p>
          </div>

          <div>
            <label className="block micro-label text-gray-400 mb-2">File Quotazioni</label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx"
              className="block w-full text-sm text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-primary-500/20 file:text-primary-400
                hover:file:bg-primary-500/30
                cursor-pointer"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={onImport}
              disabled={importing || deleting}
            >
              {importing ? 'Importazione in corso...' : 'Importa Quotazioni'}
            </Button>
            <Button
              onClick={onRequestDelete}
              disabled={importing || deleting || !stats || stats.totalPlayers === 0}
              variant="outline"
              className="border-danger-500/50 text-danger-400 hover:bg-danger-500/20"
            >
              {deleting ? 'Cancellazione...' : 'Cancella Tutti i Giocatori'}
            </Button>
          </div>
        </div>
      </div>

      {/* Upload History */}
      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-50">
          <h2 className="micro-label text-gray-300">Storico Caricamenti</h2>
        </div>
        <div className="p-4">
          {historyLoading ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
            </div>
          ) : uploadHistory.length > 0 ? (
            <div className="space-y-3">
              {uploadHistory.map((upload) => (
                <div key={upload.id} className="bg-surface-300 border border-surface-50 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-display font-bold text-white">{upload.fileName}</p>
                      <p className="text-xs text-gray-400">
                        Foglio: {upload.sheetName} · Caricato da {upload.uploadedBy.username}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 font-mono">
                      {new Date(upload.createdAt).toLocaleString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm font-mono">
                    <span className="text-secondary-400">
                      +{upload.playersCreated} nuovi
                    </span>
                    <span className="text-primary-400">
                      {upload.playersUpdated} aggiornati
                    </span>
                    <span className="text-gray-400">
                      {upload.playersNotInList} non in lista
                    </span>
                    <span className="text-gray-500">
                      ({upload.totalProcessed} totali)
                    </span>
                  </div>
                  {upload.errors && upload.errors.length > 0 && (
                    <div className="mt-2 text-xs text-danger-400">
                      {upload.errors.length} errori durante l'import
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">
              Nessun caricamento effettuato
            </p>
          )}
        </div>
      </div>

      {/* Players Needing Classification */}
      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-50 flex items-center justify-between gap-3">
          <div>
            <h2 className="micro-label text-gray-300">Giocatori da Classificare</h2>
            <p className="text-xs text-gray-500 mt-1">Giocatori usciti dalla lista con contratti attivi</p>
          </div>
          {playersNeedingClassification.length > 0 && (
            <Button onClick={onOpenClassification}>
              Classifica ({playersNeedingClassification.length})
            </Button>
          )}
        </div>
        <div className="p-4">
          {classificationLoading ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 border-4 border-warning-500/30 border-t-warning-500 rounded-full animate-spin mx-auto"></div>
            </div>
          ) : playersNeedingClassification.length > 0 ? (
            <div className="space-y-3">
              {playersNeedingClassification.slice(0, 5).map((player) => (
                <div key={player.playerId} className="bg-surface-300 border border-surface-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full border flex items-center justify-center font-display font-bold text-xs ${POSITION_CHIP[player.position] ?? ''}`}>
                        {player.position}
                      </span>
                      <div>
                        <p className="font-display font-bold text-white">{player.playerName}</p>
                        <p className="text-xs text-gray-400">{player.team}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Quotazione</p>
                      <p className="stat-number text-accent-400 text-lg">{player.lastQuotation}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    <span className="text-warning-400">{player.contracts.length} contratt{player.contracts.length === 1 ? 'o' : 'i'} attiv{player.contracts.length === 1 ? 'o' : 'i'}</span>
                    {' in '}
                    {player.contracts.map((c, i) => (
                      <span key={c.memberId}>
                        {i > 0 && ', '}
                        <span className="text-white">{c.leagueName}</span>
                        {' ('}
                        <span className="text-primary-400">{c.memberUsername}</span>
                        {')'}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {playersNeedingClassification.length > 5 && (
                <p className="text-sm text-gray-400 text-center py-2">
                  ...e altri {playersNeedingClassification.length - 5} giocatori
                </p>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400">
              <p>Nessun giocatore da classificare</p>
              <p className="text-sm mt-1">Tutti i giocatori usciti dalla lista sono stati classificati</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
