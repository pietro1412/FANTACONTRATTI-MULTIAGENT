import { PrismaClient, AlertType, AlertSeverity } from '@prisma/client'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

export interface AlertData {
  playerId: string
  alertType: AlertType
  severity?: AlertSeverity
  title: string
  message: string
  matchId?: number
  matchInfo?: string
  metadata?: Record<string, unknown>
  validUntil?: Date
}

// ==================== GET ALERTS FOR WATCHED PLAYERS ====================

export async function getAlertsForMember(
  memberId: string,
  options: {
    unreadOnly?: boolean
    limit?: number
    offset?: number
  } = {}
): Promise<ServiceResult> {
  try {
    const { unreadOnly = false, limit = 50, offset = 0 } = options

    // Get the member and their league
    const member = await prisma.leagueMember.findFirst({
      where: {
        id: memberId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        leagueId: true,
      },
    })

    if (!member) {
      return { success: false, message: 'Membro non trovato' }
    }

    // Get all players in the member's watchlist
    const watchedPlayerIds = await prisma.watchlistEntry.findMany({
      where: {
        memberId,
        category: {
          leagueId: member.leagueId,
        },
      },
      select: { playerId: true },
    })

    const playerIds = watchedPlayerIds.map(w => w.playerId)

    // Also include players in the member's roster
    const rosterPlayerIds = await prisma.playerRoster.findMany({
      where: {
        leagueMemberId: memberId,
        status: 'ACTIVE',
      },
      select: { playerId: true },
    })

    const allPlayerIds = [...new Set([...playerIds, ...rosterPlayerIds.map(r => r.playerId)])]

    if (allPlayerIds.length === 0) {
      return {
        success: true,
        data: {
          alerts: [],
          total: 0,
          unreadCount: 0,
        },
      }
    }

    // Build where clause for notifications
    const whereClause: {
      memberId: string
      isRead?: boolean
      alert: {
        playerId: { in: string[] }
        OR: Array<{ validUntil: null } | { validUntil: { gte: Date } }>
      }
    } = {
      memberId,
      alert: {
        playerId: { in: allPlayerIds },
        OR: [
          { validUntil: null },
          { validUntil: { gte: new Date() } },
        ],
      },
    }

    if (unreadOnly) {
      whereClause.isRead = false
    }

    // Count total and unread
    const [total, unreadCount] = await Promise.all([
      prisma.playerAlertNotification.count({ where: whereClause }),
      prisma.playerAlertNotification.count({
        where: {
          ...whereClause,
          isRead: false,
        },
      }),
    ])

    // Get notifications with alert and player details
    const notifications = await prisma.playerAlertNotification.findMany({
      where: whereClause,
      include: {
        alert: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                team: true,
                position: true,
                quotation: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    return {
      success: true,
      data: {
        alerts: notifications.map(n => ({
          id: n.id,
          alertId: n.alert.id,
          isRead: n.isRead,
          readAt: n.readAt,
          createdAt: n.createdAt,
          alert: {
            id: n.alert.id,
            type: n.alert.alertType,
            severity: n.alert.severity,
            title: n.alert.title,
            message: n.alert.message,
            matchInfo: n.alert.matchInfo,
            metadata: n.alert.metadata,
            validFrom: n.alert.validFrom,
            validUntil: n.alert.validUntil,
            createdAt: n.alert.createdAt,
            player: n.alert.player,
          },
        })),
        total,
        unreadCount,
      },
    }
  } catch (error) {
    console.error('Error getting alerts for member:', error)
    return { success: false, message: 'Errore nel recupero degli alert' }
  }
}

// ==================== GET UNREAD COUNT ====================

export async function getUnreadCount(memberId: string): Promise<ServiceResult> {
  try {
    // Get the member and their league
    const member = await prisma.leagueMember.findFirst({
      where: {
        id: memberId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        leagueId: true,
      },
    })

    if (!member) {
      return { success: false, message: 'Membro non trovato' }
    }

    // Get all players in the member's watchlist
    const watchedPlayerIds = await prisma.watchlistEntry.findMany({
      where: {
        memberId,
        category: {
          leagueId: member.leagueId,
        },
      },
      select: { playerId: true },
    })

    const playerIds = watchedPlayerIds.map(w => w.playerId)

    // Also include players in the member's roster
    const rosterPlayerIds = await prisma.playerRoster.findMany({
      where: {
        leagueMemberId: memberId,
        status: 'ACTIVE',
      },
      select: { playerId: true },
    })

    const allPlayerIds = [...new Set([...playerIds, ...rosterPlayerIds.map(r => r.playerId)])]

    if (allPlayerIds.length === 0) {
      return { success: true, data: { unreadCount: 0 } }
    }

    const unreadCount = await prisma.playerAlertNotification.count({
      where: {
        memberId,
        isRead: false,
        alert: {
          playerId: { in: allPlayerIds },
          OR: [
            { validUntil: null },
            { validUntil: { gte: new Date() } },
          ],
        },
      },
    })

    return { success: true, data: { unreadCount } }
  } catch (error) {
    console.error('Error getting unread count:', error)
    return { success: false, message: 'Errore nel recupero del conteggio' }
  }
}

// ==================== MARK ALERT AS READ ====================

export async function markAsRead(
  notificationId: string,
  memberId: string
): Promise<ServiceResult> {
  try {
    // Verify ownership
    const notification = await prisma.playerAlertNotification.findFirst({
      where: {
        id: notificationId,
        memberId,
      },
    })

    if (!notification) {
      return { success: false, message: 'Notifica non trovata' }
    }

    if (notification.isRead) {
      return { success: true, message: 'Notifica gia\' letta' }
    }

    await prisma.playerAlertNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return { success: true, message: 'Notifica segnata come letta' }
  } catch (error) {
    console.error('Error marking alert as read:', error)
    return { success: false, message: 'Errore nella modifica della notifica' }
  }
}

// ==================== MARK ALL ALERTS AS READ ====================

export async function markAllAsRead(memberId: string): Promise<ServiceResult> {
  try {
    // Get the member and their league
    const member = await prisma.leagueMember.findFirst({
      where: {
        id: memberId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        leagueId: true,
      },
    })

    if (!member) {
      return { success: false, message: 'Membro non trovato' }
    }

    const result = await prisma.playerAlertNotification.updateMany({
      where: {
        memberId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return {
      success: true,
      message: `${result.count} notifiche segnate come lette`,
      data: { count: result.count },
    }
  } catch (error) {
    console.error('Error marking all alerts as read:', error)
    return { success: false, message: 'Errore nella modifica delle notifiche' }
  }
}

// ==================== CREATE ALERT (internal use) ====================

export async function createAlert(data: AlertData): Promise<ServiceResult> {
  try {
    // Verify player exists
    const player = await prisma.serieAPlayer.findUnique({
      where: { id: data.playerId },
    })

    if (!player) {
      return { success: false, message: 'Giocatore non trovato' }
    }

    const alert = await prisma.playerAlert.create({
      data: {
        playerId: data.playerId,
        alertType: data.alertType,
        severity: data.severity || 'INFO',
        title: data.title,
        message: data.message,
        matchId: data.matchId,
        matchInfo: data.matchInfo,
        metadata: data.metadata ? data.metadata : undefined,
        validUntil: data.validUntil,
      },
    })

    // Find all members who have this player in their watchlist or roster
    // across all leagues
    const watchlistMembers = await prisma.watchlistEntry.findMany({
      where: { playerId: data.playerId },
      select: {
        memberId: true,
        category: {
          select: { leagueId: true },
        },
      },
    })

    const rosterMembers = await prisma.playerRoster.findMany({
      where: {
        playerId: data.playerId,
        status: 'ACTIVE',
      },
      select: { leagueMemberId: true },
    })

    // Get unique member IDs
    const memberIds = [...new Set([
      ...watchlistMembers.map(w => w.memberId),
      ...rosterMembers.map(r => r.leagueMemberId),
    ])]

    // Create notifications for all interested members
    if (memberIds.length > 0) {
      await prisma.playerAlertNotification.createMany({
        data: memberIds.map(memberId => ({
          alertId: alert.id,
          memberId,
        })),
      })
    }

    return {
      success: true,
      message: 'Alert creato',
      data: {
        alert,
        notificationsSent: memberIds.length,
      },
    }
  } catch (error) {
    console.error('Error creating alert:', error)
    return { success: false, message: 'Errore nella creazione dell\'alert' }
  }
}

// ==================== CLEANUP OLD ALERTS ====================

export async function cleanupOldAlerts(daysOld: number = 30): Promise<ServiceResult> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    // Delete old notifications first (due to foreign key)
    await prisma.playerAlertNotification.deleteMany({
      where: {
        alert: {
          createdAt: { lt: cutoffDate },
        },
      },
    })

    // Delete old alerts
    const result = await prisma.playerAlert.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    })

    return {
      success: true,
      message: `${result.count} alert eliminati`,
      data: { count: result.count },
    }
  } catch (error) {
    console.error('Error cleaning up old alerts:', error)
    return { success: false, message: 'Errore nella pulizia degli alert' }
  }
}
