import { describe, it, expect } from 'vitest'
import { getVisibleNavItems, getPhaseNavItem, getQuickAccessTiles, type NavItemKey } from '../lib/navItems'

describe('navItems — sorgente unica di navigazione (P1)', () => {
  const keys = (phase: string | null, isAdmin = false): NavItemKey[] =>
    getVisibleNavItems(phase, null, isAdmin).map((i) => i.key)

  describe('sezioni di consultazione sempre visibili (F-NAV-2)', () => {
    it('mostra Rose/Scambi/Contratti/Premi anche senza fase attiva', () => {
      const k = keys(null)
      expect(k).toEqual(
        expect.arrayContaining(['rose', 'trades', 'contracts', 'financials', 'prizes', 'history', 'prophecies']),
      )
    })

    it('NON fa sparire Scambi e Contratti durante la Rubata', () => {
      const k = keys('RUBATA')
      expect(k).toContain('trades')
      expect(k).toContain('contracts')
    })

    it('rispetta lo stesso insieme di voci a prescindere dalla fase', () => {
      const base = keys(null).filter((x) => x !== 'auction' && x !== 'rubata' && x !== 'svincolati')
      const duringContracts = keys('CONTRATTI').filter((x) => x !== 'auction' && x !== 'rubata' && x !== 'svincolati')
      expect(duringContracts).toEqual(base)
    })
  })

  describe('aste live a comparsa + evidenziazione fase corrente', () => {
    it('inserisce la voce Rubata solo durante la fase RUBATA, marcata live', () => {
      expect(keys(null)).not.toContain('rubata')
      const items = getVisibleNavItems('RUBATA', null, false)
      const rubata = items.find((i) => i.key === 'rubata')
      expect(rubata).toBeDefined()
      expect(rubata?.isCurrent).toBe(true)
      expect(rubata?.isLive).toBe(true)
    })

    it('evidenzia una voce di consultazione (Contratti) quando è la fase, senza isLive', () => {
      const items = getVisibleNavItems('CONTRATTI', null, false)
      const contracts = items.find((i) => i.key === 'contracts')
      expect(contracts?.isCurrent).toBe(true)
      expect(contracts?.isLive).toBe(false)
    })

    it('evidenzia Scambi sia in pre-rinnovo sia post-svincolati', () => {
      for (const phase of ['OFFERTE_PRE_RINNOVO', 'OFFERTE_POST_ASTA_SVINCOLATI']) {
        const trades = getVisibleNavItems(phase, null, false).find((i) => i.key === 'trades')
        expect(trades?.isCurrent).toBe(true)
      }
    })
  })

  describe('admin gating', () => {
    it('nasconde Admin ai non-admin e lo mostra agli admin', () => {
      expect(keys(null, false)).not.toContain('adminPanel')
      expect(keys(null, true)).toContain('adminPanel')
    })
  })

  describe('getPhaseNavItem — comportamento storico preservato (BottomNavBar)', () => {
    it('mappa le fasi alle voci azionabili, null per PREMI', () => {
      expect(getPhaseNavItem('ASTA_LIBERA')?.key).toBe('auction')
      expect(getPhaseNavItem('OFFERTE_PRE_RINNOVO')?.key).toBe('trades')
      expect(getPhaseNavItem('CONTRATTI')?.key).toBe('contracts')
      expect(getPhaseNavItem('RUBATA')?.key).toBe('rubata')
      expect(getPhaseNavItem('ASTA_SVINCOLATI')?.key).toBe('svincolati')
      expect(getPhaseNavItem('PREMI')).toBeNull()
      expect(getPhaseNavItem(null)).toBeNull()
    })
  })

  describe('getQuickAccessTiles — derivate dalla stessa sorgente (Assioma 4)', () => {
    it('espone solo voci non-admin con metadati tile', () => {
      const tiles = getQuickAccessTiles()
      expect(tiles.length).toBeGreaterThan(0)
      expect(tiles.every((t) => t.tile && !t.adminOnly)).toBe(true)
      expect(tiles.map((t) => t.key)).toEqual(
        expect.arrayContaining(['rose', 'trades', 'contracts', 'financials', 'strategie-rubata', 'playerStats']),
      )
    })
  })
})
