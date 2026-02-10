interface MarketSession {
  id: string
  type: string
  status: string
  currentPhase: string | null
  season: number
  semester: number
  createdAt: string
}

export interface AdminSessionsTabProps {
  sessions: MarketSession[]
}

export function AdminSessionsTab({ sessions }: AdminSessionsTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
        <div className="p-5 border-b border-surface-50/20">
          <h3 className="text-xl font-bold text-white">Storico Sessioni</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-300">
              <tr>
                <th className="px-5 py-4 text-left text-sm text-gray-400 font-semibold">Tipo</th>
                <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Stagione</th>
                <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Semestre</th>
                <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Fase</th>
                <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Stato</th>
                <th className="px-5 py-4 text-right text-sm text-gray-400 font-semibold">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50/10">
              {sessions.map(session => (
                <tr key={session.id} className="hover:bg-surface-300/50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-white">
                    {session.type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'}
                  </td>
                  <td className="px-5 py-4 text-center text-gray-300">{session.season}</td>
                  <td className="px-5 py-4 text-center text-gray-300">{session.semester}</td>
                  <td className="px-5 py-4 text-center text-gray-300">{session.currentPhase || '-'}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      session.status === 'ACTIVE' ? 'bg-secondary-500/20 text-secondary-400' :
                      session.status === 'COMPLETED' ? 'bg-gray-500/20 text-gray-400' :
                      'bg-accent-500/20 text-accent-400'
                    }`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-gray-400">
                    {new Date(session.createdAt).toLocaleDateString('it-IT')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sessions.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3 opacity-50">📭</div>
              <p className="text-gray-500">Nessuna sessione creata</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
