import { Button } from '../ui/Button'

export interface AdminExportTabProps {
  isSubmitting: boolean
  exportToExcel: () => void
  exportRostersToExcel: () => void
}

export function AdminExportTab({
  isSubmitting,
  exportToExcel,
  exportRostersToExcel,
}: AdminExportTabProps) {
  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-50">
        <h3 className="micro-label text-gray-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Esporta dati
        </h3>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 p-4 bg-surface-300 border border-surface-50 rounded-xl">
          <div className="min-w-0">
            <p className="font-display font-bold text-white">Lista Membri</p>
            <p className="text-sm text-gray-400">Username, team, ruolo, budget</p>
          </div>
          <Button onClick={exportToExcel}>Scarica Excel</Button>
        </div>
        <div className="flex items-center justify-between gap-3 p-4 bg-surface-300 border border-surface-50 rounded-xl">
          <div className="min-w-0">
            <p className="font-display font-bold text-white">Tutte le Rose</p>
            <p className="text-sm text-gray-400">Giocatori, contratti, valori</p>
          </div>
          <Button variant="outline" onClick={exportRostersToExcel} disabled={isSubmitting}>
            {isSubmitting ? 'Export...' : 'Scarica Excel'}
          </Button>
        </div>
      </div>
    </div>
  )
}
