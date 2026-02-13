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
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
      <div className="p-5 border-b border-surface-50/20">
        <h3 className="text-xl font-bold text-white">Esporta Dati</h3>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between p-5 bg-surface-300 rounded-lg">
          <div>
            <p className="font-semibold text-white text-lg">Lista Membri</p>
            <p className="text-sm text-gray-400">Username, team, ruolo, budget</p>
          </div>
          <Button onClick={exportToExcel}>Scarica Excel</Button>
        </div>
        <div className="flex items-center justify-between p-5 bg-surface-300 rounded-lg">
          <div>
            <p className="font-semibold text-white text-lg">Tutte le Rose</p>
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
