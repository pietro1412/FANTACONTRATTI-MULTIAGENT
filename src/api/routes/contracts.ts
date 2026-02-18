import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  getContracts,
  getContractById,
  createContract,
  renewContract,
  releasePlayer,
  previewRenewal,
  previewContract,
  getConsolidationStatus,
  consolidateContracts,
  getAllConsolidationStatus,
  saveDrafts,
  simulateAllConsolidation,
  modifyContractPostAcquisition,
  getConsolidationReceiptData,
  calculateRescissionClause,
} from '../../services/contract.service'
import { authMiddleware } from '../middleware/auth'
import { generateRenewalReceipt } from '../../services/pdf.service'
import type { ContractExportData } from '../../services/excel.service';
import { generateContractsExcel } from '../../services/excel.service'
import { createEmailService } from '../../modules/identity/infrastructure/services/email.factory'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const router = Router()

// GET /api/leagues/:leagueId/contracts - Get all contracts and pending contracts
router.get('/leagues/:leagueId/contracts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getContracts(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get contracts error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/contracts/:contractId - Get contract detail
router.get('/contracts/:contractId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const contractId = req.params.contractId as string
    const result = await getContractById(contractId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non sei il proprietario di questo contratto' ? 403 : 404).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get contract error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/contracts/create - Create initial contract for a player
router.post('/contracts/create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { rosterId, salary, duration } = req.body as { rosterId?: string; salary?: number; duration?: number }

    if (!rosterId || salary === undefined || duration === undefined) {
      res.status(400).json({ success: false, message: 'rosterId, salary e duration richiesti' })
      return
    }

    if (typeof salary !== 'number' || typeof duration !== 'number') {
      res.status(400).json({ success: false, message: 'salary e duration devono essere numeri' })
      return
    }

    const result = await createContract(rosterId, req.user!.userId, salary, duration)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Create contract error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/contracts/preview-create - Preview contract creation
router.post('/contracts/preview-create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { rosterId, salary, duration } = req.body as { rosterId?: string; salary?: number; duration?: number }

    if (!rosterId || salary === undefined || duration === undefined) {
      res.status(400).json({ success: false, message: 'rosterId, salary e duration richiesti' })
      return
    }

    const result = await previewContract(rosterId, req.user!.userId, salary, duration)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Preview contract error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/contracts/:contractId/preview - Preview renewal cost
router.post('/contracts/:contractId/preview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const contractId = req.params.contractId as string
    const { newSalary, newDuration } = req.body as { newSalary?: number; newDuration?: number }

    if (!newSalary || !newDuration) {
      res.status(400).json({ success: false, message: 'newSalary e newDuration richiesti' })
      return
    }

    const result = await previewRenewal(contractId, req.user!.userId, newSalary, newDuration)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Preview renewal error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/contracts/:contractId/renew - Renew contract
router.post('/contracts/:contractId/renew', authMiddleware, async (req: Request, res: Response) => {
  try {
    const contractId = req.params.contractId as string
    const { newSalary, newDuration } = req.body as { newSalary?: number; newDuration?: number }

    if (!newSalary || !newDuration) {
      res.status(400).json({ success: false, message: 'newSalary e newDuration richiesti' })
      return
    }

    if (typeof newSalary !== 'number' || typeof newDuration !== 'number') {
      res.status(400).json({ success: false, message: 'newSalary e newDuration devono essere numeri' })
      return
    }

    const result = await renewContract(contractId, req.user!.userId, newSalary, newDuration)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Renew contract error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/contracts/:contractId/modify - Modify contract post-acquisition
router.post('/contracts/:contractId/modify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const contractId = req.params.contractId as string
    const { newSalary, newDuration } = req.body as { newSalary?: number; newDuration?: number }

    if (!newSalary || !newDuration) {
      res.status(400).json({ success: false, message: 'newSalary e newDuration richiesti' })
      return
    }

    if (typeof newSalary !== 'number' || typeof newDuration !== 'number') {
      res.status(400).json({ success: false, message: 'newSalary e newDuration devono essere numeri' })
      return
    }

    const result = await modifyContractPostAcquisition(contractId, req.user!.userId, newSalary, newDuration)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Modify contract post-acquisition error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/contracts/:contractId/release - Release player (svincola)
router.post('/contracts/:contractId/release', authMiddleware, async (req: Request, res: Response) => {
  try {
    const contractId = req.params.contractId as string
    const result = await releasePlayer(contractId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Release player error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== CONTRACT CONSOLIDATION ====================

// GET /api/leagues/:leagueId/contracts/consolidation - Get consolidation status for current manager
router.get('/leagues/:leagueId/contracts/consolidation', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getConsolidationStatus(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get consolidation status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/contracts/save-drafts - Save draft renewals, new contracts, and releases
router.post('/leagues/:leagueId/contracts/save-drafts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { renewals, newContracts, releases, exitDecisions } = req.body as {
      renewals?: { contractId: string; salary: number; duration: number }[]
      newContracts?: { rosterId: string; salary: number; duration: number }[]
      releases?: string[]  // Contract IDs to mark for release
      exitDecisions?: { contractId: string; decision: 'KEEP' | 'RELEASE' }[]
    }

    const result = await saveDrafts(
      leagueId,
      req.user!.userId,
      renewals || [],
      newContracts || [],
      releases || [],
      exitDecisions || []
    )

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Save drafts error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/contracts/consolidate - Consolidate contracts with optional renewals/new contracts
router.post('/leagues/:leagueId/contracts/consolidate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { renewals, newContracts } = req.body as {
      renewals?: { contractId: string; salary: number; duration: number }[]
      newContracts?: { rosterId: string; salary: number; duration: number }[]
    }

    const result = await consolidateContracts(leagueId, req.user!.userId, renewals, newContracts)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Get the member ID for receipt generation
    const member = await prisma.leagueMember.findFirst({
      where: {
        leagueId,
        userId: req.user!.userId,
        status: 'ACTIVE',
      },
    })

    if (member) {
      // Generate PDF receipt and send email (async, don't block response)
      generateAndSendReceipt(leagueId, member.id).catch((err: unknown) => {
        console.error('Error generating/sending receipt:', err)
      })
    }

    res.json(result)
  } catch (error) {
    console.error('Consolidate contracts error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// Helper function to generate PDF + Excel and send email asynchronously
async function generateAndSendReceipt(leagueId: string, memberId: string): Promise<void> {
  try {
    const receiptData = await getConsolidationReceiptData(leagueId, memberId)

    if (!receiptData.success || !receiptData.data) {
      console.error('Failed to get receipt data:', receiptData.message)
      return
    }

    const data = receiptData.data

    // Generate PDF
    const pdfBuffer = await generateRenewalReceipt({
      managerName: data.managerName,
      teamName: data.teamName,
      leagueName: data.leagueName,
      consolidationDate: data.consolidationDate,
      transactionId: data.transactionId,
      renewals: data.renewals,
      releasedPlayers: data.releasedPlayers,
      totalSalary: data.totalSalary,
      remainingBudget: data.remainingBudget,
    })

    console.log(`[Contract Receipt] PDF generated for ${data.teamName}, size: ${pdfBuffer.length} bytes`)

    // Generate Excel
    let excelBuffer: Buffer | undefined

    // Get the actual contracts data for Excel - query directly
    const member = await prisma.leagueMember.findUnique({
      where: { id: memberId },
      include: {
        user: { select: { id: true } },
        league: { select: { name: true } },
        roster: {
          where: { status: 'ACTIVE' },
          include: {
            player: true,
            contract: true,
          },
        },
      },
    })

    if (member) {
      const excelData: ContractExportData = {
        teamName: data.teamName,
        leagueName: data.leagueName,
        exportDate: new Date(),
        contracts: member.roster
          .filter(r => r.contract)
          .map(r => {
            const c = r.contract!
            const isSpalmaActive = c.duration === 1 && c.draftDuration !== null && c.draftDuration > 1
            const rescissionClause = calculateRescissionClause(c.salary, c.duration)

            return {
              playerName: r.player.name,
              position: r.player.position,
              realTeam: r.player.team,
              currentSalary: c.salary,
              currentDuration: c.duration,
              currentClause: rescissionClause,
              draftSalary: c.draftSalary,
              draftDuration: c.draftDuration,
              draftClause: c.draftSalary && c.draftDuration
                ? calculateRescissionClause(c.draftSalary, c.draftDuration)
                : null,
              isReleased: c.draftReleased,
              isSpalmaActive,
              isExitedPlayer: r.player.listStatus === 'NOT_IN_LIST' && r.player.exitReason != null,
              exitReason: r.player.exitReason,
              exitDecision: c.draftExitDecision,
              indemnityAmount: 0, // Would need to calculate from prizes
            }
          }),
        pendingContracts: member.roster
          .filter(r => !r.contract)
          .map(r => ({
            playerName: r.player.name,
            position: r.player.position,
            realTeam: r.player.team,
            acquisitionPrice: r.acquisitionPrice,
            acquisitionType: r.acquisitionType,
            minSalary: Math.ceil(r.acquisitionPrice * 0.1),
            draftSalary: null,
            draftDuration: null,
          })),
        budget: member.currentBudget,
      }

      excelBuffer = generateContractsExcel(excelData)
      console.log(`[Contract Receipt] Excel generated for ${data.teamName}, size: ${excelBuffer.length} bytes`)
    }

    // Send email with PDF + Excel attachments
    const emailService = createEmailService()
    await emailService.sendContractRenewalReceipt(
      data.managerEmail,
      data.managerName,
      data.teamName,
      data.leagueName,
      pdfBuffer,
      data.renewals.length,
      excelBuffer
    )

    console.log(`[Contract Receipt] Email sent to ${data.managerEmail} (PDF + Excel)`)
  } catch (error) {
    console.error('Error in generateAndSendReceipt:', error)
  }
}

// GET /api/leagues/:leagueId/contracts/consolidation-all - Get all managers' consolidation status (admin only)
router.get('/leagues/:leagueId/contracts/consolidation-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getAllConsolidationStatus(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Solo gli admin possono vedere lo stato di consolidamento' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get all consolidation status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/contracts/simulate-consolidation - Simulate all managers consolidated (admin test only)
router.post('/leagues/:leagueId/contracts/simulate-consolidation', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await simulateAllConsolidation(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Solo gli admin possono simulare il consolidamento' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Simulate consolidation error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/contracts/export-excel - Export contracts to Excel
router.get('/leagues/:leagueId/contracts/export-excel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getContracts(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Get member and league info
    const member = await prisma.leagueMember.findFirst({
      where: {
        leagueId,
        userId: req.user!.userId,
        status: 'ACTIVE',
      },
      include: {
        user: { select: { username: true } },
        league: { select: { name: true } },
      },
    })

    if (!member) {
      res.status(400).json({ success: false, message: 'Membro non trovato' })
      return
    }

    // Transform data for Excel export
    const excelData: ContractExportData = {
      teamName: member.teamName || member.user.username,
      leagueName: member.league.name,
      exportDate: new Date(),
      contracts: result.data.contracts.map((c: {
        roster: { player: { name: string; position: string; team: string } }
        salary: number
        duration: number
        rescissionClause: number
        draftSalary: number | null
        draftDuration: number | null
        draftReleased: boolean
        canSpalmare: boolean
        isExitedPlayer: boolean
        exitReason: string | null
        draftExitDecision: string | null
        indemnityCompensation: number
      }) => {
        // Calculate if spalma is being used: player can spalmare AND draft duration > 1
        const isSpalmaActive = c.canSpalmare && c.draftDuration !== null && c.draftDuration > 1

        return {
          playerName: c.roster.player.name,
          position: c.roster.player.position,
          realTeam: c.roster.player.team,
          currentSalary: c.salary,
          currentDuration: c.duration,
          currentClause: c.rescissionClause,
          draftSalary: c.draftSalary,
          draftDuration: c.draftDuration,
          draftClause: c.draftSalary && c.draftDuration
            ? calculateRescissionClause(c.draftSalary, c.draftDuration)
            : null,
          isReleased: c.draftReleased,
          isSpalmaActive,
          isExitedPlayer: c.isExitedPlayer,
          exitReason: c.exitReason,
          exitDecision: c.draftExitDecision,
          indemnityAmount: c.indemnityCompensation,
        }
      }),
      pendingContracts: result.data.pendingContracts.map((p: {
        player: { name: string; position: string; team: string }
        acquisitionPrice: number
        acquisitionType: string
        minSalary: number
        draftSalary: number | null
        draftDuration: number | null
      }) => ({
        playerName: p.player.name,
        position: p.player.position,
        realTeam: p.player.team,
        acquisitionPrice: p.acquisitionPrice,
        acquisitionType: p.acquisitionType,
        minSalary: p.minSalary,
        draftSalary: p.draftSalary,
        draftDuration: p.draftDuration,
      })),
      budget: result.data.memberBudget,
    }

    // Generate Excel
    const excelBuffer = generateContractsExcel(excelData)

    // Send file as binary
    const filename = `Contratti_${(excelData.teamName ?? '').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0] ?? ''}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', excelBuffer.length)
    res.end(Buffer.from(excelBuffer))
  } catch (error) {
    console.error('Export Excel error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
