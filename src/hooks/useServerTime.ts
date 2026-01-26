/**
 * useServerTime - Hook per sincronizzazione clock client-server
 *
 * Implementa un algoritmo NTP-like per calcolare l'offset tra
 * il clock del client e quello del server, garantendo timer
 * sincronizzati tra tutti i client.
 */
import { useState, useEffect, useCallback, useRef } from 'react'

interface TimeSyncState {
  offset: number           // Differenza in ms tra server e client
  lastSync: number | null  // Timestamp ultima sincronizzazione
  isCalibrating: boolean   // Se sta calibrando
  error: string | null     // Eventuale errore
  latency: number          // Latenza media RTT
}

interface TimeSample {
  offset: number
  latency: number
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003'
const SYNC_INTERVAL_MS = 60000  // Risincronizza ogni 60 secondi
const SAMPLES_COUNT = 3        // Numero di campioni per calibrazione
const MAX_ACCEPTABLE_LATENCY = 5000 // Ignora campioni con latenza > 5s

export function useServerTime() {
  const [state, setState] = useState<TimeSyncState>({
    offset: 0,
    lastSync: null,
    isCalibrating: true,
    error: null,
    latency: 0
  })

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  /**
   * Effettua una singola richiesta di sincronizzazione
   * Calcola offset e latenza usando metodo NTP-like
   */
  const fetchTimeSample = useCallback(async (): Promise<TimeSample | null> => {
    try {
      const t1 = Date.now() // Tempo invio richiesta

      const response = await fetch(`${API_URL}/api/time`, {
        method: 'GET',
        credentials: 'include'
      })

      const t4 = Date.now() // Tempo ricezione risposta

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const serverTime = data.serverTime as number

      // Calcolo NTP-like:
      // - t1 = tempo client invio
      // - t2 = tempo server ricezione (assumiamo = serverTime)
      // - t3 = tempo server invio (assumiamo = serverTime)
      // - t4 = tempo client ricezione
      // RTT = (t4 - t1)
      // offset = serverTime - ((t1 + t4) / 2)

      const rtt = t4 - t1
      const offset = serverTime - Math.floor((t1 + t4) / 2)

      // Ignora campioni con latenza troppo alta
      if (rtt > MAX_ACCEPTABLE_LATENCY) {
        console.warn(`[useServerTime] Campione scartato: latenza ${rtt}ms troppo alta`)
        return null
      }

      return {
        offset,
        latency: rtt
      }
    } catch (error) {
      console.error('[useServerTime] Errore fetch:', error)
      return null
    }
  }, [])

  /**
   * Calibra l'offset usando la mediana di N campioni
   * La mediana è più robusta rispetto alla media in caso di outlier
   */
  const calibrate = useCallback(async () => {
    if (!mountedRef.current) return

    setState(prev => ({ ...prev, isCalibrating: true, error: null }))

    const samples: TimeSample[] = []

    // Raccoglie N campioni
    for (let i = 0; i < SAMPLES_COUNT; i++) {
      const sample = await fetchTimeSample()
      if (sample) {
        samples.push(sample)
      }
      // Piccolo delay tra campioni per evitare burst
      if (i < SAMPLES_COUNT - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    if (!mountedRef.current) return

    if (samples.length === 0) {
      setState(prev => ({
        ...prev,
        isCalibrating: false,
        error: 'Impossibile sincronizzare con il server'
      }))
      return
    }

    // Usa la mediana degli offset
    samples.sort((a, b) => a.offset - b.offset)
    const medianIndex = Math.floor(samples.length / 2)
    const medianOffset = samples[medianIndex].offset

    // Media delle latenze
    const avgLatency = Math.round(
      samples.reduce((sum, s) => sum + s.latency, 0) / samples.length
    )

    setState({
      offset: medianOffset,
      lastSync: Date.now(),
      isCalibrating: false,
      error: null,
      latency: avgLatency
    })

    console.log(
      `[useServerTime] Calibrazione completata: offset=${medianOffset}ms, ` +
      `latenza media=${avgLatency}ms, campioni=${samples.length}`
    )
  }, [fetchTimeSample])

  /**
   * Restituisce il tempo server corrente stimato
   */
  const getServerTime = useCallback((): number => {
    return Date.now() + state.offset
  }, [state.offset])

  /**
   * Calcola i secondi rimanenti a una scadenza usando il tempo server
   * @param expiresAt - Timestamp di scadenza (Date, numero o stringa ISO)
   * @returns Secondi rimanenti (minimo 0)
   */
  const getRemainingSeconds = useCallback((expiresAt: Date | number | string | null | undefined): number => {
    if (!expiresAt) return 0

    let expiresAtMs: number
    if (expiresAt instanceof Date) {
      expiresAtMs = expiresAt.getTime()
    } else if (typeof expiresAt === 'string') {
      // Gestisce stringhe ISO date (es. "2026-01-24T16:00:00.000Z")
      expiresAtMs = new Date(expiresAt).getTime()
    } else {
      expiresAtMs = expiresAt
    }

    // Verifica che il valore sia valido
    if (isNaN(expiresAtMs)) {
      console.warn('[useServerTime] expiresAt non valido:', expiresAt)
      return 0
    }

    const serverNow = getServerTime()
    const remainingMs = expiresAtMs - serverNow

    return Math.max(0, Math.floor(remainingMs / 1000))
  }, [getServerTime])

  /**
   * Verifica se un timestamp è scaduto secondo il tempo server
   */
  const isExpired = useCallback((expiresAt: Date | number | string | null | undefined): boolean => {
    if (!expiresAt) return true

    let expiresAtMs: number
    if (expiresAt instanceof Date) {
      expiresAtMs = expiresAt.getTime()
    } else if (typeof expiresAt === 'string') {
      expiresAtMs = new Date(expiresAt).getTime()
    } else {
      expiresAtMs = expiresAt
    }

    if (isNaN(expiresAtMs)) {
      console.warn('[useServerTime] isExpired: expiresAt non valido:', expiresAt)
      return true
    }

    const serverNow = getServerTime()

    return serverNow >= expiresAtMs
  }, [getServerTime])

  /**
   * Forza una ricalibrazione manuale
   */
  const forceSync = useCallback(() => {
    calibrate()
  }, [calibrate])

  // Setup iniziale e intervallo di risincronizzazione
  useEffect(() => {
    mountedRef.current = true

    // Calibrazione iniziale
    calibrate()

    // Risincronizzazione periodica
    syncIntervalRef.current = setInterval(() => {
      calibrate()
    }, SYNC_INTERVAL_MS)

    return () => {
      mountedRef.current = false
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [calibrate])

  return {
    // Stato
    offset: state.offset,
    lastSync: state.lastSync,
    isCalibrating: state.isCalibrating,
    error: state.error,
    latency: state.latency,

    // Metodi
    getServerTime,
    getRemainingSeconds,
    isExpired,
    forceSync
  }
}

export default useServerTime
