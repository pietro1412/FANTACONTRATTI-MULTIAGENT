import { PrismaClient } from '@prisma/client'
import webpush from 'web-push'

const prisma = new PrismaClient()

// ==================== VAPID CONFIGURATION ====================

let vapidConfigured = false

export function initWebPush(): void {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL || 'mailto:admin@fantacontratti.it'

  if (!publicKey || !privateKey) {
    console.warn('⚠️  VAPID keys not set – push notifications disabled')
    return
  }

  webpush.setVapidDetails(email, publicKey, privateKey)
  vapidConfigured = true
  console.log('✅ Web Push configured with VAPID keys')
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null
}

// ==================== SUBSCRIPTION MANAGEMENT ====================

export async function subscribe(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: { userId, endpoint: subscription.endpoint },
    },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  })

  // Auto-enable push in preferences
  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, pushEnabled: true },
    update: { pushEnabled: true },
  })
}

export async function unsubscribe(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  })

  // If no more subscriptions, disable push
  const remaining = await prisma.pushSubscription.count({ where: { userId } })
  if (remaining === 0) {
    await prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, pushEnabled: false },
      update: { pushEnabled: false },
    })
  }
}

// ==================== PREFERENCES ====================

export async function getPreferences(userId: string) {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  })
  return prefs || {
    pushEnabled: false,
    tradeOffers: true,
    contractExpiry: true,
    auctionStart: true,
    phaseChange: true,
  }
}

export async function updatePreferences(
  userId: string,
  prefs: {
    tradeOffers?: boolean
    contractExpiry?: boolean
    auctionStart?: boolean
    phaseChange?: boolean
  }
) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...prefs },
    update: prefs,
  })
}

// ==================== PUSH SENDING ====================

interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, unknown>
}

async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!vapidConfigured) return

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  })

  const failures: string[] = []

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      )
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      // 404 or 410 = subscription expired/invalid, clean up
      if (statusCode === 404 || statusCode === 410) {
        failures.push(sub.id)
      }
    }
  }

  // Clean up expired subscriptions
  if (failures.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: failures } },
    })
  }
}

// ==================== NOTIFICATION HELPERS ====================

export async function notifyTradeOffer(
  receiverUserId: string,
  senderName: string,
  leagueName: string
): Promise<void> {
  const prefs = await getPreferences(receiverUserId)
  if (!prefs.pushEnabled || !prefs.tradeOffers) return

  await sendPushToUser(receiverUserId, {
    title: 'Nuova offerta di scambio',
    body: `${senderName} ti ha inviato un\'offerta in ${leagueName}`,
    tag: 'trade-offer',
    data: { type: 'trade-offer' },
  })
}

export async function notifyPhaseChange(
  leagueId: string,
  phaseName: string
): Promise<void> {
  // Get all active members of the league
  const members = await prisma.leagueMember.findMany({
    where: { leagueId, status: 'ACTIVE' },
    select: { userId: true },
  })

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { name: true },
  })

  for (const member of members) {
    const prefs = await getPreferences(member.userId)
    if (!prefs.pushEnabled || !prefs.phaseChange) continue

    await sendPushToUser(member.userId, {
      title: 'Cambio fase',
      body: `${league?.name || 'Lega'}: nuova fase ${phaseName}`,
      tag: 'phase-change',
      data: { type: 'phase-change', leagueId },
    })
  }
}

export async function notifyAuctionStart(
  leagueId: string,
  sessionType: string
): Promise<void> {
  const members = await prisma.leagueMember.findMany({
    where: { leagueId, status: 'ACTIVE' },
    select: { userId: true },
  })

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { name: true },
  })

  const typeLabel = sessionType === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'

  for (const member of members) {
    const prefs = await getPreferences(member.userId)
    if (!prefs.pushEnabled || !prefs.auctionStart) continue

    await sendPushToUser(member.userId, {
      title: 'Nuova sessione di mercato',
      body: `${league?.name || 'Lega'}: ${typeLabel} iniziato`,
      tag: 'auction-start',
      data: { type: 'auction-start', leagueId },
    })
  }
}

export async function notifyContractExpiry(
  userId: string,
  playerName: string,
  duration: number
): Promise<void> {
  const prefs = await getPreferences(userId)
  if (!prefs.pushEnabled || !prefs.contractExpiry) return

  await sendPushToUser(userId, {
    title: 'Contratto in scadenza',
    body: `${playerName}: ${duration} semestri rimanenti`,
    tag: 'contract-expiry',
    data: { type: 'contract-expiry' },
  })
}
