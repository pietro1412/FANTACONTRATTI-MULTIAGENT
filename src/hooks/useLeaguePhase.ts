// useLeaguePhase — deriva la fase corrente di una lega dalla sessione ATTIVA.
// Unica fonte per la navigazione (Navigation + BottomNavBar) per mostrare le
// voci di fase coerenti su desktop e mobile. La fase = currentPhase della
// sessione con status ACTIVE (vedi enum MarketPhase). Nessuna sessione attiva → null.
import { useState, useEffect } from 'react'
import { auctionApi } from '../services/api'

interface SessionLite {
  id: string
  type: string
  status: string
  currentPhase: string
}

interface LeaguePhaseState {
  /** currentPhase della sessione ACTIVE, o null se nessuna è attiva. */
  currentPhase: string | null
  /** id della sessione ACTIVE (serve per aprire l'asta), o null. */
  activeSessionId: string | null
}

/**
 * Recupera e deriva la fase corrente della lega.
 * Resiliente: in assenza di leagueId o di dati restituisce { currentPhase: null }.
 */
export function useLeaguePhase(leagueId: string | null | undefined): LeaguePhaseState {
  const [currentPhase, setCurrentPhase] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!leagueId) {
      setCurrentPhase(null)
      setActiveSessionId(null)
      return
    }

    let cancelled = false

    async function loadPhase(id: string) {
      try {
        // Guardia difensiva: in alcuni contesti (test) l'api può essere parzialmente mockata.
        const getSessions = auctionApi?.getSessions
        if (typeof getSessions !== 'function') return
        const res = await getSessions(id)
        if (cancelled) return
        if (res.success && Array.isArray(res.data)) {
          const sessions = res.data as SessionLite[]
          const active = sessions.find((s) => s.status === 'ACTIVE') ?? null
          setCurrentPhase(active?.currentPhase ?? null)
          setActiveSessionId(active?.id ?? null)
        } else {
          setCurrentPhase(null)
          setActiveSessionId(null)
        }
      } catch {
        // Non fatale: la nav mostra solo le voci sempre visibili
        if (!cancelled) {
          setCurrentPhase(null)
          setActiveSessionId(null)
        }
      }
    }

    void loadPhase(leagueId)

    // Permetti il refresh esplicito quando la fase cambia altrove (es. admin avanza fase)
    const onPhaseChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ leagueId?: string }>).detail
      if (!detail?.leagueId || detail.leagueId === leagueId) {
        void loadPhase(leagueId)
      }
    }
    window.addEventListener('league-phase-updated', onPhaseChanged)

    return () => {
      cancelled = true
      window.removeEventListener('league-phase-updated', onPhaseChanged)
    }
  }, [leagueId])

  return { currentPhase, activeSessionId }
}
