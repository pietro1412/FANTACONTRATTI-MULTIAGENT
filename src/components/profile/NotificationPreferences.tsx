import { useState, useEffect, useCallback } from 'react'
import { Switch } from '@/components/ui/Switch'
import { pushApi } from '@/services/api'

interface NotifPrefs {
  pushEnabled: boolean
  tradeOffers: boolean
  contractExpiry: boolean
  auctionStart: boolean
  phaseChange: boolean
}

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  pushEnabled: false,
  tradeOffers: true,
  contractExpiry: true,
  auctionStart: true,
  phaseChange: true,
}

type PushStatus = 'default' | 'granted' | 'denied' | 'unsupported'

const NOTIF_OPTIONS: { key: keyof Omit<NotifPrefs, 'pushEnabled'>; label: string; desc: string }[] = [
  { key: 'tradeOffers', label: 'Offerte scambio', desc: 'Nuove offerte ricevute' },
  { key: 'contractExpiry', label: 'Scadenze contratti', desc: 'Contratti in scadenza imminente' },
  { key: 'auctionStart', label: 'Inizio aste', desc: "Quando inizia una nuova sessione d'asta" },
  { key: 'phaseChange', label: 'Cambio fase', desc: 'Transizioni di fase della lega' },
]

/** Notifiche: master push toggle (con flusso permission) + 4 preferenze, via Switch. */
export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS)
  const [pushStatus, setPushStatus] = useState<PushStatus>('default')
  const [vapidKey, setVapidKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPushStatus('unsupported')
    } else {
      setPushStatus(Notification.permission as PushStatus)
    }

    Promise.all([pushApi.getVapidKey(), pushApi.getPreferences()])
      .then(([vapidRes, prefsRes]) => {
        if (vapidRes.success && vapidRes.data) {
          setVapidKey(vapidRes.data.publicKey)
        }
        if (prefsRes.success && prefsRes.data) {
          setPrefs(prefsRes.data as NotifPrefs)
        }
      })
      .catch(() => {})
      .finally(() => { setLoading(false) })
  }, [])

  const handlePushToggle = useCallback(async () => {
    if (pushStatus === 'unsupported' || !vapidKey) return

    if (!prefs.pushEnabled) {
      if (pushStatus === 'denied') return

      const permission = await Notification.requestPermission()
      setPushStatus(permission as PushStatus)

      if (permission === 'granted') {
        try {
          const registration = await navigator.serviceWorker.ready
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey,
          })
          await pushApi.subscribe(subscription.toJSON())
          setPrefs(p => ({ ...p, pushEnabled: true }))
        } catch {
          // Subscription failed, keep disabled
        }
      }
    } else {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await pushApi.unsubscribe(subscription.endpoint)
          await subscription.unsubscribe()
        }
        setPrefs(p => ({ ...p, pushEnabled: false }))
      } catch {
        setPrefs(p => ({ ...p, pushEnabled: false }))
      }
    }
  }, [prefs, pushStatus, vapidKey])

  const toggle = useCallback(async (key: keyof Omit<NotifPrefs, 'pushEnabled'>) => {
    const updated = { [key]: !prefs[key] }
    setPrefs(p => ({ ...p, ...updated }))
    await pushApi.updatePreferences(updated).catch(() => {})
  }, [prefs])

  const pushDisabled = pushStatus === 'unsupported' || pushStatus === 'denied' || !vapidKey
  const pushDescription =
    pushStatus === 'unsupported'
      ? 'Non supportate dal browser'
      : !vapidKey
        ? 'Push non configurate sul server'
        : pushStatus === 'denied'
          ? 'Bloccate dal browser - abilita dalle impostazioni'
          : "Ricevi notifiche anche quando l'app non è aperta"

  if (loading) {
    return (
      <section className="bg-surface-200 border border-surface-50/20 rounded-2xl p-5">
        <h3 className="micro-label text-gray-400 mb-4">Notifiche</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-12 bg-surface-300 rounded-lg" />
          <div className="h-10 bg-surface-300 rounded-lg" />
          <div className="h-10 bg-surface-300 rounded-lg" />
        </div>
      </section>
    )
  }

  return (
    <section className="bg-surface-200 border border-surface-50/20 rounded-2xl p-5">
      <h3 className="micro-label text-gray-400 mb-1">Notifiche</h3>

      <div className="flex items-center gap-3 py-3 border-b border-surface-50/20">
        <div className="flex-1">
          <p className="font-display font-semibold text-white text-sm">Notifiche push</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{pushDescription}</p>
        </div>
        <Switch
          label="Notifiche push"
          checked={prefs.pushEnabled}
          disabled={pushDisabled}
          onChange={() => void handlePushToggle()}
        />
      </div>

      {NOTIF_OPTIONS.map((opt, i) => (
        <div
          key={opt.key}
          className={`flex items-center gap-3 py-3 ${i < NOTIF_OPTIONS.length - 1 ? 'border-b border-surface-50/20' : ''}`}
        >
          <div className="flex-1">
            <p className="font-display font-semibold text-white text-sm">{opt.label}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</p>
          </div>
          <Switch
            label={opt.label}
            checked={prefs[opt.key]}
            onChange={() => void toggle(opt.key)}
          />
        </div>
      ))}
    </section>
  )
}
