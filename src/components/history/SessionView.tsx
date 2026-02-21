import { useState } from 'react'
import { SessionCard } from './SessionCard'

interface SessionSummary {
  id: string
  type: string
  season: number
  semester: string
  status: string
  currentPhase: string | null
  createdAt: string
  startsAt: string | null
  endsAt: string | null
  counts: {
    auctions: number
    movements: number
    trades: number
    prizes: number
  }
  prizesFinalized: boolean
  prizesFinalizedAt: string | null
}

interface SessionViewProps {
  leagueId: string
  sessions: SessionSummary[]
  formatSessionType: (type: string) => string
  formatSemester: (semester: string) => string
  formatSessionTitle: (type: string, season: number, semester: string) => string
}

export function SessionView({ leagueId, sessions, formatSessionType, formatSemester, formatSessionTitle }: SessionViewProps) {
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  if (sessions.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {sessions.map(session => (
        <SessionCard
          key={session.id}
          leagueId={leagueId}
          session={session}
          isExpanded={expandedSession === session.id}
          onToggle={() => { setExpandedSession(expandedSession === session.id ? null : session.id); }}
          formatSessionType={formatSessionType}
          formatSemester={formatSemester}
          formatSessionTitle={formatSessionTitle}
        />
      ))}
    </div>
  )
}
