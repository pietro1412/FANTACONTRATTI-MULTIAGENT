import { useState, useEffect } from 'react'

const ALERT_STORAGE_KEY = 'manager-alert-settings'

export interface AlertConfig {
  budgetLow: { enabled: boolean; threshold: number }
  contractExpiring: { enabled: boolean; threshold: number }
  salaryHigh: { enabled: boolean; threshold: number }
  slotsFull: { enabled: boolean }
}

const DEFAULT_CONFIG: AlertConfig = {
  budgetLow: { enabled: true, threshold: 100 },
  contractExpiring: { enabled: true, threshold: 1 },
  salaryHigh: { enabled: false, threshold: 40 },
  slotsFull: { enabled: true },
}

export function loadAlertConfig(): AlertConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  try {
    const saved = localStorage.getItem(ALERT_STORAGE_KEY)
    if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) }
  } catch {}
  return DEFAULT_CONFIG
}

interface AlertTrigger {
  type: 'danger' | 'warning' | 'info'
  title: string
  message: string
}

export function evaluateAlerts(
  config: AlertConfig,
  data: { budget: number; totalSalaries: number; initialBudget: number; expiringCount: number; totalSlots: number; filledSlots: number }
): AlertTrigger[] {
  const alerts: AlertTrigger[] = []

  if (config.budgetLow.enabled && data.budget < config.budgetLow.threshold) {
    alerts.push({
      type: data.budget < config.budgetLow.threshold / 2 ? 'danger' : 'warning',
      title: 'Budget basso',
      message: `Budget attuale ${data.budget} cr, sotto la soglia di ${config.budgetLow.threshold} cr`,
    })
  }

  if (config.contractExpiring.enabled && data.expiringCount > 0) {
    alerts.push({
      type: data.expiringCount >= 3 ? 'danger' : 'warning',
      title: `${data.expiringCount} contratt${data.expiringCount === 1 ? 'o' : 'i'} in scadenza`,
      message: `Durata residua <= ${config.contractExpiring.threshold} semestre`,
    })
  }

  if (config.salaryHigh.enabled) {
    const pct = data.initialBudget > 0 ? Math.round((data.totalSalaries / data.initialBudget) * 100) : 0
    if (pct > config.salaryHigh.threshold) {
      alerts.push({
        type: pct > 60 ? 'danger' : 'warning',
        title: 'Monte ingaggi elevato',
        message: `${pct}% del budget iniziale (soglia: ${config.salaryHigh.threshold}%)`,
      })
    }
  }

  if (config.slotsFull.enabled && data.filledSlots >= data.totalSlots && data.totalSlots > 0) {
    alerts.push({
      type: 'info',
      title: 'Rosa completa',
      message: `${data.filledSlots}/${data.totalSlots} slot occupati`,
    })
  }

  return alerts
}

interface AlertSettingsProps {
  onClose: () => void
}

export function AlertSettings({ onClose }: AlertSettingsProps) {
  const [config, setConfig] = useState<AlertConfig>(loadAlertConfig)

  useEffect(() => {
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(config))
  }, [config])

  const update = (key: keyof AlertConfig, field: string, value: boolean | number) => {
    setConfig(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Configura Alert</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors text-xs"
        >
          Chiudi
        </button>
      </div>

      {/* Budget basso */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-surface-300/30 border border-surface-50/10">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.budgetLow.enabled}
                onChange={e => update('budgetLow', 'enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-surface-400 peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-500" />
            </label>
            <span className="text-sm text-white">Budget basso</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Avvisa quando il budget scende sotto la soglia</p>
        </div>
        {config.budgetLow.enabled && (
          <div className="flex items-center gap-1 ml-3">
            <input
              type="number"
              inputMode="numeric"
              value={config.budgetLow.threshold}
              onChange={e => update('budgetLow', 'threshold', parseInt(e.target.value) || 0)}
              className="w-16 px-2 py-1 text-xs text-right bg-surface-400 border border-surface-50/20 rounded text-white"
            />
            <span className="text-xs text-gray-500">cr</span>
          </div>
        )}
      </div>

      {/* Contratti in scadenza */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-surface-300/30 border border-surface-50/10">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.contractExpiring.enabled}
                onChange={e => update('contractExpiring', 'enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-surface-400 peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-500" />
            </label>
            <span className="text-sm text-white">Contratti in scadenza</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Avvisa per contratti con durata residua bassa</p>
        </div>
        {config.contractExpiring.enabled && (
          <div className="flex items-center gap-1 ml-3">
            <span className="text-xs text-gray-500">&le;</span>
            <input
              type="number"
              inputMode="numeric"
              value={config.contractExpiring.threshold}
              onChange={e => update('contractExpiring', 'threshold', parseInt(e.target.value) || 1)}
              className="w-12 px-2 py-1 text-xs text-right bg-surface-400 border border-surface-50/20 rounded text-white"
              min={1}
              max={5}
            />
            <span className="text-xs text-gray-500">sem</span>
          </div>
        )}
      </div>

      {/* Monte ingaggi alto */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-surface-300/30 border border-surface-50/10">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.salaryHigh.enabled}
                onChange={e => update('salaryHigh', 'enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-surface-400 peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-500" />
            </label>
            <span className="text-sm text-white">Monte ingaggi elevato</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Avvisa quando gli ingaggi superano una % del budget</p>
        </div>
        {config.salaryHigh.enabled && (
          <div className="flex items-center gap-1 ml-3">
            <span className="text-xs text-gray-500">&gt;</span>
            <input
              type="number"
              inputMode="numeric"
              value={config.salaryHigh.threshold}
              onChange={e => update('salaryHigh', 'threshold', parseInt(e.target.value) || 0)}
              className="w-12 px-2 py-1 text-xs text-right bg-surface-400 border border-surface-50/20 rounded text-white"
              min={10}
              max={90}
              step={5}
            />
            <span className="text-xs text-gray-500">%</span>
          </div>
        )}
      </div>

      {/* Rosa completa */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-surface-300/30 border border-surface-50/10">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.slotsFull.enabled}
                onChange={e => update('slotsFull', 'enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-surface-400 peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-500" />
            </label>
            <span className="text-sm text-white">Rosa completa</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Notifica quando tutti gli slot sono occupati</p>
        </div>
      </div>

      <p className="text-[10px] text-gray-600 text-center">
        Le preferenze vengono salvate localmente. Gli alert push saranno disponibili in un futuro aggiornamento.
      </p>
    </div>
  )
}
