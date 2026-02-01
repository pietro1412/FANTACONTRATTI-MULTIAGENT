import { Router } from 'express'
import { PrismaClient, MarketPhase } from '@prisma/client'
import { authMiddleware } from '../../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// Display phase type for UI
type DisplayPhase = 'scouting' | 'open_window' | 'clause_meeting'

// Map MarketPhase to DisplayPhase
function mapMarketPhase(phase: MarketPhase | null): DisplayPhase {
  if (!phase) return 'scouting'

  switch (phase) {
    case 'RUBATA':
    case 'ASTA_SVINCOLATI':
    case 'OFFERTE_POST_ASTA_SVINCOLATI':
      return 'clause_meeting'

    case 'OFFERTE_PRE_RINNOVO':
    case 'PREMI':
    case 'CONTRATTI':
    case 'CALCOLO_INDENNIZZI':
      return 'open_window'

    case 'ASTA_LIBERA':
    default:
      return 'scouting'
  }
}

// GET /api/game/status?leagueId={id}
// Returns current game phase and related info
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const leagueId = req.query.leagueId as string

    if (!leagueId) {
      return res.status(400).json({
        success: false,
        message: 'leagueId is required',
      })
    }

    // Get the active session for this league
    const activeSession = await prisma.marketSession.findFirst({
      where: {
        leagueId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        currentPhase: true,
        sessionType: true,
        year: true,
        semester: true,
        createdAt: true,
        league: {
          select: {
            name: true,
          },
        },
      },
    })

    // Calculate next clause day (example: next Saturday at 20:00)
    // This is a placeholder - in real implementation, this should come from league settings
    const now = new Date()
    const nextSaturday = new Date(now)
    nextSaturday.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7))
    nextSaturday.setHours(20, 0, 0, 0)
    const daysRemaining = Math.ceil((nextSaturday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Determine display phase
    const displayPhase = activeSession
      ? mapMarketPhase(activeSession.currentPhase)
      : 'scouting'

    // Phase display names
    const phaseLabels: Record<DisplayPhase, string> = {
      scouting: 'Mercato Chiuso',
      open_window: 'Sessione Aperta',
      clause_meeting: 'Clause Day',
    }

    return res.json({
      success: true,
      data: {
        phase: displayPhase,
        phaseLabel: phaseLabels[displayPhase],
        marketPhase: activeSession?.currentPhase ?? null,
        sessionId: activeSession?.id ?? null,
        sessionType: activeSession?.sessionType ?? null,
        nextClauseDay: nextSaturday.toISOString(),
        daysRemaining,
        isActive: !!activeSession,
        leagueName: activeSession?.league?.name,
      },
    })
  } catch (error) {
    console.error('[Game Status] Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Errore nel recupero dello stato del gioco',
    })
  }
})

export default router
