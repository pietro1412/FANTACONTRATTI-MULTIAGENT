import { PrismaClient, FeedbackStatus, FeedbackCategory } from '@prisma/client'
import type { ServiceResult } from '@/shared/types/service-result'

const prisma = new PrismaClient()

// ==================== SUBMIT FEEDBACK ====================

export async function submitFeedback(
  userId: string,
  data: {
    title: string
    description: string
    category?: FeedbackCategory
    leagueId?: string
    pageContext?: string
  }
): Promise<ServiceResult> {
  // Validate input
  if (!data.title || data.title.trim().length === 0) {
    return { success: false, message: 'Il titolo e\' obbligatorio' }
  }

  if (!data.description || data.description.trim().length === 0) {
    return { success: false, message: 'La descrizione e\' obbligatoria' }
  }

  if (data.title.length > 200) {
    return { success: false, message: 'Il titolo non puo\' superare i 200 caratteri' }
  }

  if (data.description.length > 5000) {
    return { success: false, message: 'La descrizione non puo\' superare i 5000 caratteri' }
  }

  // If leagueId provided, verify user is member
  if (data.leagueId) {
    const member = await prisma.leagueMember.findFirst({
      where: {
        leagueId: data.leagueId,
        userId,
        status: 'ACTIVE',
      },
    })

    if (!member) {
      return { success: false, message: 'Non sei membro di questa lega' }
    }
  }

  // Create feedback
  const feedback = await prisma.userFeedback.create({
    data: {
      userId,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category || FeedbackCategory.BUG,
      leagueId: data.leagueId || null,
      pageContext: data.pageContext || null,
      status: FeedbackStatus.APERTA,
    },
    include: {
      user: { select: { username: true } },
      league: { select: { name: true } },
    },
  })

  return {
    success: true,
    message: 'Segnalazione inviata con successo',
    data: {
      id: feedback.id,
      title: feedback.title,
      category: feedback.category,
      status: feedback.status,
      createdAt: feedback.createdAt,
    },
  }
}

// ==================== GET FEEDBACK FOR MANAGER ====================

export async function getFeedbackForManager(
  userId: string,
  options?: {
    status?: FeedbackStatus
    page?: number
    limit?: number
  }
): Promise<ServiceResult> {
  const page = options?.page || 1
  const limit = options?.limit || 20
  const skip = (page - 1) * limit

  const where: { userId: string; status?: FeedbackStatus } = { userId }
  if (options?.status) {
    where.status = options.status
  }

  const [feedback, total] = await Promise.all([
    prisma.userFeedback.findMany({
      where,
      include: {
        league: { select: { name: true } },
        _count: { select: { responses: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.userFeedback.count({ where }),
  ])

  return {
    success: true,
    data: {
      feedback: feedback.map(f => ({
        id: f.id,
        title: f.title,
        category: f.category,
        status: f.status,
        leagueName: f.league?.name || null,
        responseCount: f._count.responses,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        resolvedAt: f.resolvedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  }
}

// ==================== GET FEEDBACK BY ID ====================

export async function getFeedbackById(
  feedbackId: string,
  userId: string
): Promise<ServiceResult> {
  // Get user to check if superadmin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  })

  const feedback = await prisma.userFeedback.findUnique({
    where: { id: feedbackId },
    include: {
      user: { select: { id: true, username: true } },
      league: { select: { id: true, name: true } },
      responses: {
        include: {
          admin: { select: { username: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!feedback) {
    return { success: false, message: 'Segnalazione non trovata' }
  }

  // Check authorization: owner or superadmin
  if (feedback.userId !== userId && !user?.isSuperAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Mark notifications as read for this feedback
  await prisma.feedbackNotification.updateMany({
    where: {
      feedbackId,
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })

  return {
    success: true,
    data: {
      id: feedback.id,
      title: feedback.title,
      description: feedback.description,
      category: feedback.category,
      status: feedback.status,
      pageContext: feedback.pageContext,
      githubIssueId: feedback.githubIssueId,
      githubIssueUrl: feedback.githubIssueUrl,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
      resolvedAt: feedback.resolvedAt,
      user: {
        id: feedback.user.id,
        username: feedback.user.username,
      },
      league: feedback.league ? {
        id: feedback.league.id,
        name: feedback.league.name,
      } : null,
      responses: feedback.responses.map(r => ({
        id: r.id,
        content: r.content,
        statusChange: r.statusChange,
        adminUsername: r.admin.username,
        createdAt: r.createdAt,
      })),
    },
  }
}

// ==================== GET ALL FEEDBACK (ADMIN) ====================

export async function getAllFeedback(
  adminUserId: string,
  options?: {
    status?: FeedbackStatus
    category?: FeedbackCategory
    search?: string
    page?: number
    limit?: number
  }
): Promise<ServiceResult> {
  // Verify superadmin
  const user = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { isSuperAdmin: true },
  })

  if (!user?.isSuperAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const page = options?.page || 1
  const limit = options?.limit || 20
  const skip = (page - 1) * limit

  // Build where clause
  const where: {
    status?: FeedbackStatus
    category?: FeedbackCategory
    OR?: { title?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }[]
  } = {}

  if (options?.status) {
    where.status = options.status
  }

  if (options?.category) {
    where.category = options.category
  }

  if (options?.search) {
    where.OR = [
      { title: { contains: options.search, mode: 'insensitive' } },
      { description: { contains: options.search, mode: 'insensitive' } },
    ]
  }

  const [feedback, total] = await Promise.all([
    prisma.userFeedback.findMany({
      where,
      include: {
        user: { select: { username: true, email: true } },
        league: { select: { name: true } },
        _count: { select: { responses: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.userFeedback.count({ where }),
  ])

  return {
    success: true,
    data: {
      feedback: feedback.map(f => ({
        id: f.id,
        title: f.title,
        category: f.category,
        status: f.status,
        pageContext: f.pageContext,
        username: f.user.username,
        userEmail: f.user.email,
        leagueName: f.league?.name || null,
        responseCount: f._count.responses,
        githubIssueId: f.githubIssueId,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        resolvedAt: f.resolvedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  }
}

// ==================== UPDATE FEEDBACK STATUS (ADMIN) ====================

export async function updateFeedbackStatus(
  feedbackId: string,
  adminUserId: string,
  newStatus: FeedbackStatus
): Promise<ServiceResult> {
  // Verify superadmin
  const user = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { isSuperAdmin: true, username: true },
  })

  if (!user?.isSuperAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const feedback = await prisma.userFeedback.findUnique({
    where: { id: feedbackId },
  })

  if (!feedback) {
    return { success: false, message: 'Segnalazione non trovata' }
  }

  if (feedback.status === newStatus) {
    return { success: false, message: 'Lo stato e\' gia\' ' + newStatus }
  }

  // Update status
  const updatedFeedback = await prisma.userFeedback.update({
    where: { id: feedbackId },
    data: {
      status: newStatus,
      resolvedAt: newStatus === FeedbackStatus.RISOLTA ? new Date() : null,
    },
  })

  // Create notification for user
  await prisma.feedbackNotification.upsert({
    where: {
      userId_feedbackId_type: {
        userId: feedback.userId,
        feedbackId,
        type: 'STATUS_CHANGE',
      },
    },
    update: {
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    },
    create: {
      userId: feedback.userId,
      feedbackId,
      type: 'STATUS_CHANGE',
      isRead: false,
    },
  })

  return {
    success: true,
    message: `Stato aggiornato a ${newStatus}`,
    data: {
      id: updatedFeedback.id,
      status: updatedFeedback.status,
      resolvedAt: updatedFeedback.resolvedAt,
    },
  }
}

// ==================== ADD RESPONSE (ADMIN) ====================

export async function addResponse(
  feedbackId: string,
  adminUserId: string,
  content: string,
  statusChange?: FeedbackStatus
): Promise<ServiceResult> {
  // Verify superadmin
  const user = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { isSuperAdmin: true, username: true },
  })

  if (!user?.isSuperAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (!content || content.trim().length === 0) {
    return { success: false, message: 'Il contenuto della risposta e\' obbligatorio' }
  }

  if (content.length > 5000) {
    return { success: false, message: 'La risposta non puo\' superare i 5000 caratteri' }
  }

  const feedback = await prisma.userFeedback.findUnique({
    where: { id: feedbackId },
  })

  if (!feedback) {
    return { success: false, message: 'Segnalazione non trovata' }
  }

  // Create response and optionally update status
  const [response] = await prisma.$transaction([
    prisma.feedbackResponse.create({
      data: {
        feedbackId,
        adminId: adminUserId,
        content: content.trim(),
        statusChange: statusChange || null,
      },
      include: {
        admin: { select: { username: true } },
      },
    }),
    // Update feedback status if statusChange provided
    ...(statusChange ? [
      prisma.userFeedback.update({
        where: { id: feedbackId },
        data: {
          status: statusChange,
          resolvedAt: statusChange === FeedbackStatus.RISOLTA ? new Date() : feedback.resolvedAt,
        },
      }),
    ] : []),
  ])

  // Create notification for user
  await prisma.feedbackNotification.upsert({
    where: {
      userId_feedbackId_type: {
        userId: feedback.userId,
        feedbackId,
        type: 'NEW_RESPONSE',
      },
    },
    update: {
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    },
    create: {
      userId: feedback.userId,
      feedbackId,
      type: 'NEW_RESPONSE',
      isRead: false,
    },
  })

  return {
    success: true,
    message: 'Risposta aggiunta',
    data: {
      id: response.id,
      content: response.content,
      statusChange: response.statusChange,
      adminUsername: response.admin.username,
      createdAt: response.createdAt,
    },
  }
}

// ==================== GET UNREAD NOTIFICATIONS ====================

export async function getUnreadNotifications(userId: string): Promise<ServiceResult> {
  const notifications = await prisma.feedbackNotification.findMany({
    where: {
      userId,
      isRead: false,
    },
    include: {
      feedback: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    success: true,
    data: {
      count: notifications.length,
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        feedbackId: n.feedback.id,
        feedbackTitle: n.feedback.title,
        feedbackStatus: n.feedback.status,
        createdAt: n.createdAt,
      })),
    },
  }
}

// ==================== MARK NOTIFICATION READ ====================

export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<ServiceResult> {
  const notification = await prisma.feedbackNotification.findUnique({
    where: { id: notificationId },
  })

  if (!notification) {
    return { success: false, message: 'Notifica non trovata' }
  }

  if (notification.userId !== userId) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (notification.isRead) {
    return { success: true, message: 'Notifica gia\' letta' }
  }

  await prisma.feedbackNotification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })

  return { success: true, message: 'Notifica segnata come letta' }
}

// ==================== MARK ALL NOTIFICATIONS READ ====================

export async function markAllNotificationsRead(userId: string): Promise<ServiceResult> {
  const result = await prisma.feedbackNotification.updateMany({
    where: {
      userId,
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
}

// ==================== GET FEEDBACK STATS (ADMIN) ====================

export async function getFeedbackStats(adminUserId: string): Promise<ServiceResult> {
  // Verify superadmin
  const user = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { isSuperAdmin: true },
  })

  if (!user?.isSuperAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const [total, byStatus, byCategory] = await Promise.all([
    prisma.userFeedback.count(),
    prisma.userFeedback.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.userFeedback.groupBy({
      by: ['category'],
      _count: { id: true },
    }),
  ])

  const statusCounts = Object.fromEntries(
    Object.values(FeedbackStatus).map(s => [s, 0])
  )
  byStatus.forEach(s => {
    statusCounts[s.status] = s._count.id
  })

  const categoryCounts = Object.fromEntries(
    Object.values(FeedbackCategory).map(c => [c, 0])
  )
  byCategory.forEach(c => {
    categoryCounts[c.category] = c._count.id
  })

  return {
    success: true,
    data: {
      total,
      byStatus: statusCounts,
      byCategory: categoryCounts,
    },
  }
}
