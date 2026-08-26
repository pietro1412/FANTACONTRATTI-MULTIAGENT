import { describe, it, expect } from 'vitest'
import { getVisibleNavItems, getPhaseNavItem, getQuickAccessTiles, type NavItemKey } from '../lib/navItems'

describe('navItems — sorgente unica di navigazione (P1)', () => {
  const keys = (phase: string | null, isAdmin = false): NavItemKey[] =>
    getVisibleNavItems(phase, null, isAdmin).map((i) => i.key)

  describe('sezioni di consultazione pura sempre visibili (F-NAV-2)', () => {
    it('mostra Rose/Finanze/Premi anche senza fase attiva', () => {
      const k = keys(null)
      expect(k).toEqual(
        expect.arrayContaining(['rose', 'financials', 'prizes', 'history', 'prophecies']),
      )
    })

    it('rispetta lo stesso insieme di voci di consultazione pura a prescindere dalla fase', () => {
      const nonPhaseKeys: NavItemKey[] = ['auction', 'trades', 'contracts', 'rubata', 'svincolati']
      const base = keys(null).filter((x) => !nonPhaseKeys.includes(x))
      const duringContracts = keys('CONTRATTI').filter((x) => !nonPhaseKeys.includes(x))
      expect(duringContracts).toEqual(base)
    })
  })

  describe('voci di fase a comparsa (Asta/Scambi/Contratti/Rubata/Svincolati, 2026-08-26)', () => {
    it('nasconde Scambi e Contratti quando non sono la fase attiva', () => {
      expect(keys(null)).not.toContain('trades')
      expect(keys(null)).not.toContain('contracts')
      expect(keys('RUBATA')).not.toContain('trades')
      expect(keys('RUBATA')).not.toContain('contracts')
    })

    it('inserisce la voce Rubata solo durante la fase RUBATA, marcata live', () => {
      expect(keys(null)).not.toContain('rubata')
      const items = getVisibleNavItems('RUBATA', null, false)
      const rubata = items.find((i) => i.key === 'rubata')
      expect(rubata).toBeDefined()
      expect(rubata?.isCurrent).toBe(true)
      expect(rubata?.isLive).toBe(true)
    })

    it('mostra Contratti solo durante CONTRATTI, evidenziata, senza isLive', () => {
      expect(keys('RUBATA')).not.toContain('contracts')
      const items = getVisibleNavItems('CONTRATTI', null, false)
      const contracts = items.find((i) => i.key === 'contracts')
      expect(contracts).toBeDefined()
      expect(contracts?.isCurrent).toBe(true)
      expect(contracts?.isLive).toBe(false)
    })

    it('mostra Scambi sia in pre-rinnovo sia post-svincolati, evidenziata, senza isLive', () => {
      for (const phase of ['OFFERTE_PRE_RINNOVO', 'OFFERTE_POST_ASTA_SVINCOLATI']) {
        const trades = getVisibleNavItems(phase, null, false).find((i) => i.key === 'trades')
        expect(trades).toBeDefined()
        expect(trades?.isCurrent).toBe(true)
        expect(trades?.isLive).toBe(false)
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
    it('espone solo voci non-admin, di consultazione pura, con metadati tile', () => {
      const tiles = getQuickAccessTiles()
      expect(tiles.length).toBeGreaterThan(0)
      expect(tiles.every((t) => t.tile && !t.adminOnly)).toBe(true)
      expect(tiles.map((t) => t.key)).toEqual(
        expect.arrayContaining(['rose', 'financials', 'strategie-rubata']),
      )
      // Scambi/Contratti sono ora voci di fase (a comparsa), non più tile sempre presenti.
      expect(tiles.map((t) => t.key)).not.toContain('trades')
      expect(tiles.map((t) => t.key)).not.toContain('contracts')
    })
  })

  describe('fusione Rose/Giocatori/Statistiche (2026-08): allPlayers/playerStats non sono più voci di menu separate', () => {
    it('non mostra allPlayers/playerStats nel menu — sono tab di "rose"', () => {
      expect(keys(null)).not.toContain('allPlayers')
      expect(keys(null)).not.toContain('playerStats')
    })
  })
})
