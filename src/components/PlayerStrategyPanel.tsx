/**
 * PlayerStrategyPanel - Pannello espanso per gestire la strategia di un giocatore
 *
 * Features:
 * - Quick action buttons per categorie
 * - Campo offerta max grande con +/- e suggerimento prezzo
 * - Stelle priorità grandi
 * - Tag note predefiniti + campo libero
 * - Budget impact preview
 */

import { useState, useEffect, useMemo } from 'react'
import type { WatchlistCategory } from '../services/api'
import type { PlayerStats } from './PlayerStatsModal'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { getTeamLogo } from '../utils/teamLogos'
import { POSITION_COLORS } from './ui/PositionBadge'
import { PlayerFormBadge, getFormRating, calculateFormTrend } from './PlayerFormBadge'

// Predefined note tags for ALL players (characteristics)
// Exported for use in WatchlistOverview
export const NOTE_TAGS = [
  { id: 'titolare', label: '⚽ Titolare', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { id: 'rigorista', label: '🎯 Rigorista', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { id: 'piazzati', label: '🎱 Piazzati', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { id: 'giovane', label: '🌱 Giovane', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { id: 'anziano', label: '👴 Anziano', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { id: 'infortunato', label: '🏥 Infortunato', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { id: 'incostante', label: '📉 Incostante', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { id: 'affidabile', label: '💪 Affidabile', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { id: 'crescita', label: '📈 In crescita', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
]

// Roster management tags for MY ROSTER players (what to do with them)
// Exported for use in WatchlistOverview
export const ROSTER_MANAGEMENT_TAGS = [
  { id: 'incedibile', label: '💎 Incedibile', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', description: 'Non cederlo mai' },
  { id: 'da_osservare', label: '👁️ Da Osservare', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', description: 'Monitora il rendimento' },
  { id: 'da_cedere', label: '📤 Da Cedere', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', description: 'Cerca di venderlo' },
  { id: 'da_scambiare', label: '🔄 Da Scambiare', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', description: 'Proponilo in uno scambio' },
  { id: 'farsi_rubare', label: '🎯 Da Farsi Rubare', color: 'bg-red-500/20 text-red-400 border-red-500/30', description: 'Lascialo prendere alla rubata' },
  { id: 'scadenza', label: '⏰ Lascia Scadere', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', description: 'Non rinnovare, lascia scadere' },
  { id: 'spalma', label: '📊 Spalma', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', description: 'Usa clausola spalma' },
  { id: 'da_tagliare', label: '✂️ Da Tagliare', color: 'bg-red-600/20 text-red-500 border-red-600/30', description: 'Taglialo se possibile' },
]

// Category style type
interface CategoryStyle {
  bg: string
  text: string
  border: string
  activeBg: string
  activeText: string
}

// Category color mapping based on category.color field
const CATEGORY_COLOR_STYLES: Record<string, CategoryStyle> = {
  red: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', activeBg: 'bg-red-500', activeText: 'text-white' },
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40', activeBg: 'bg-orange-500', activeText: 'text-white' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40', activeBg: 'bg-yellow-500', activeText: 'text-black' },
  green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40', activeBg: 'bg-green-500', activeText: 'text-white' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', activeBg: 'bg-blue-500', activeText: 'text-white' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40', activeBg: 'bg-purple-500', activeText: 'text-white' },
  pink: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/40', activeBg: 'bg-pink-500', activeText: 'text-white' },
  cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/40', activeBg: 'bg-cyan-500', activeText: 'text-white' },
  gray: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40', activeBg: 'bg-gray-600', activeText: 'text-white' },
}

const DEFAULT_CATEGORY_STYLE: CategoryStyle = { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', activeBg: 'bg-blue-500', activeText: 'text-white' }

function getCategoryStyle(color: string | null | undefined): CategoryStyle {
  if (!color) return DEFAULT_CATEGORY_STYLE
  return CATEGORY_COLOR_STYLES[color] ?? DEFAULT_CATEGORY_STYLE
}

interface PlayerData {
  playerId: string
  playerName: string
  playerPosition: string
  playerTeam: string
  playerAge?: number | null
  playerQuotation?: number
  playerApiFootballId?: number | null
  playerApiFootballStats?: PlayerStats | null
  contractClause?: number
  contractSalary?: number
  rubataPrice?: number
  type: 'myRoster' | 'owned' | 'svincolato'
  ownerTeamName?: string | null
  ownerUsername?: string
}

interface LocalStrategy {
  maxBid: string
  priority: number
  notes: string
  isDirty: boolean
}

interface PlayerStrategyPanelProps {
  isOpen: boolean
  onClose: () => void
  player: PlayerData | null
  categories: WatchlistCategory[]
  currentCategoryId: string | null
  localStrategy: LocalStrategy
  onCategoryChange: (categoryId: string | null) => void
  onStrategyChange: (field: 'maxBid' | 'priority' | 'notes', value: string | number) => void
  onSave?: () => void // Manual save trigger
  onCancel?: () => void // Cancel/discard changes
  currentBudget: number
  totalTargetBids: number // Sum of all max bids from targets
  savingCategory: boolean
  savingStrategy: boolean
}

// Calculate suggested price based on player data
function calculateSuggestedPrice(player: PlayerData): { min: number; max: number; reason: string } {
  const clause = player.contractClause || 0
  const quotation = player.playerQuotation || 0
  const rubata = player.rubataPrice || 0
  const age = player.playerAge || 28
  const rating = player.playerApiFootballStats?.games?.rating
    ? Number(player.playerApiFootballStats.games.rating)
    : 6.5

  // Base price is the rubata price or clause
  let basePrice = rubata || clause || quotation

  // Adjust for age (younger = more valuable)
  let ageMultiplier = 1
  if (age < 23) ageMultiplier = 1.15
  else if (age < 26) ageMultiplier = 1.05
  else if (age > 30) ageMultiplier = 0.9
  else if (age > 33) ageMultiplier = 0.75

  // Adjust for form/rating
  let ratingMultiplier = 1
  if (rating >= 7.5) ratingMultiplier = 1.1
  else if (rating >= 7.0) ratingMultiplier = 1.0
  else if (rating < 6.5) ratingMultiplier = 0.85

  const adjustedPrice = Math.round(basePrice * ageMultiplier * ratingMultiplier)

  // Range is ±15%
  const min = Math.max(1, Math.round(adjustedPrice * 0.85))
  const max = Math.round(adjustedPrice * 1.15)

  let reason = ''
  if (rubata) reason = `Prezzo rubata ${rubata}M`
  else if (clause) reason = `Clausola ${clause}M`
  else reason = `Quotazione ${quotation}M`

  if (ageMultiplier !== 1) {
    reason += age < 26 ? ', giovane' : ', età avanzata'
  }
  if (ratingMultiplier !== 1) {
    reason += rating >= 7.0 ? ', buona forma' : ', forma scarsa'
  }

  return { min, max, reason }
}

export function PlayerStrategyPanel({
  isOpen,
  onClose,
  player,
  categories,
  currentCategoryId,
  localStrategy,
  onCategoryChange,
  onStrategyChange,
  onSave,
  onCancel,
  currentBudget,
  totalTargetBids,
  savingCategory,
  savingStrategy,
}: PlayerStrategyPanelProps) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [selectedRosterTags, setSelectedRosterTags] = useState<Set<string>>(new Set())
  const [freeNote, setFreeNote] = useState('')

  // Track which player we've initialized notes for
  const [initializedForPlayer, setInitializedForPlayer] = useState<string | null>(null)

  // Reset state when modal closes (player becomes null)
  useEffect(() => {
    if (!player) {
      setInitializedForPlayer(null)
      setSelectedTags(new Set())
      setSelectedRosterTags(new Set())
      setFreeNote('')
    }
  }, [player])

  // Parse existing notes into tags and free text - ONLY when player changes
  useEffect(() => {
    if (!player) return
    if (initializedForPlayer === player.playerId) return // Already initialized for this player

    const notes = localStrategy.notes || ''
    const foundTags = new Set<string>()
    const foundRosterTags = new Set<string>()
    let remainingText = notes

    // Parse existing tags from notes
    NOTE_TAGS.forEach(tag => {
      if (notes.includes(tag.label)) {
        foundTags.add(tag.id)
        remainingText = remainingText.replace(tag.label, '').trim()
      }
    })

    // Parse roster management tags
    ROSTER_MANAGEMENT_TAGS.forEach(tag => {
      if (notes.includes(tag.label)) {
        foundRosterTags.add(tag.id)
        remainingText = remainingText.replace(tag.label, '').trim()
      }
    })

    // Auto-select age tag if no existing notes AND no tags found
    if (!notes && player.playerAge && foundTags.size === 0) {
      if (player.playerAge < 25) {
        foundTags.add('giovane')
      } else if (player.playerAge > 30) {
        foundTags.add('anziano')
      }
    }

    // Clean up remaining text (remove separators from previous format)
    remainingText = remainingText.replace(/\s*\|\s*/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim()

    setSelectedTags(foundTags)
    setSelectedRosterTags(foundRosterTags)
    setFreeNote(remainingText)
    setInitializedForPlayer(player.playerId)
  }, [player?.playerId, initializedForPlayer]) // Only depend on player ID, not notes

  // Calculate suggested price
  const suggestedPrice = useMemo(() => {
    if (!player) return null
    return calculateSuggestedPrice(player)
  }, [player])

  // Budget impact calculation
  const budgetImpact = useMemo(() => {
    const maxBid = parseInt(localStrategy.maxBid) || 0
    const otherBids = totalTargetBids - maxBid // Exclude current player's bid
    const newTotal = otherBids + maxBid
    const remaining = currentBudget - newTotal
    return { total: newTotal, remaining }
  }, [localStrategy.maxBid, totalTargetBids, currentBudget])

  // Update notes when tags or free text change
  const updateNotes = (tags: Set<string>, rosterTags: Set<string>, free: string) => {
    // Roster management tags first (for myRoster players)
    const rosterTagLabels = ROSTER_MANAGEMENT_TAGS
      .filter(t => rosterTags.has(t.id))
      .map(t => t.label)
      .join(', ')

    // Then characteristic tags
    const tagLabels = NOTE_TAGS
      .filter(t => tags.has(t.id))
      .map(t => t.label)
      .join(', ')

    const fullNote = [rosterTagLabels, tagLabels, free].filter(Boolean).join(' | ')
    onStrategyChange('notes', fullNote)
  }

  const toggleTag = (tagId: string) => {
    const newTags = new Set(selectedTags)
    if (newTags.has(tagId)) {
      newTags.delete(tagId)
    } else {
      newTags.add(tagId)
    }
    setSelectedTags(newTags)
    updateNotes(newTags, selectedRosterTags, freeNote)
  }

  const toggleRosterTag = (tagId: string) => {
    const newTags = new Set(selectedRosterTags)
    if (newTags.has(tagId)) {
      newTags.delete(tagId)
    } else {
      newTags.add(tagId)
    }
    setSelectedRosterTags(newTags)
    updateNotes(selectedTags, newTags, freeNote)
  }

  const handleFreeNoteChange = (value: string) => {
    setFreeNote(value)
    updateNotes(selectedTags, selectedRosterTags, value)
  }

  // Handle category click - toggle selection
  const handleCategoryClick = (categoryId: string) => {
    if (currentCategoryId === categoryId) {
      onCategoryChange(null) // Deselect if already selected
    } else {
      onCategoryChange(categoryId)
    }
  }

  if (!isOpen || !player) return null

  const photoUrl = getPlayerPhotoUrl(player.playerApiFootballId)
  const posColors = POSITION_COLORS[player.playerPosition as keyof typeof POSITION_COLORS] || { bg: 'bg-gray-500', text: 'text-white' }
  const isMyRoster = player.type === 'myRoster'
  const isOtherRoster = player.type === 'owned'

  // Get type-specific config
  const typeConfig = isMyRoster
    ? {
        headerGradient: 'from-emerald-600/20 to-teal-600/20',
        badge: { text: '🏠 Nella Tua Rosa', bg: 'bg-emerald-500/20', color: 'text-emerald-400' },
        categoryLabel: '📂 Cosa vuoi fare con questo giocatore?',
        bidLabel: '💰 Valore Minimo di Cessione',
        bidDescription: 'A quanto lo cederesti?',
        priorityLabel: '⭐ Quanto ci tieni?',
        priorityDescription: '5 stelle = incedibile',
      }
    : isOtherRoster
    ? {
        headerGradient: 'from-red-600/20 to-orange-600/20',
        badge: { text: `🎯 Di ${player.ownerTeamName || player.ownerUsername}`, bg: 'bg-red-500/20', color: 'text-red-400' },
        categoryLabel: '📂 Come vuoi acquisirlo?',
        bidLabel: '💰 Offerta Massima alla Rubata',
        bidDescription: 'Quanto sei disposto a spendere?',
        priorityLabel: '⭐ Quanto lo vuoi?',
        priorityDescription: '5 stelle = obiettivo primario',
      }
    : {
        headerGradient: 'from-blue-600/20 to-cyan-600/20',
        badge: { text: '🆓 Svincolato', bg: 'bg-blue-500/20', color: 'text-blue-400' },
        categoryLabel: '📂 Tipo di interesse',
        bidLabel: '💰 Budget per Acquisto',
        bidDescription: 'Quanto vuoi investire?',
        priorityLabel: '⭐ Priorità di acquisto',
        priorityDescription: '5 stelle = da prendere subito',
      }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface-200 rounded-2xl border border-surface-50/20 w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with player info */}
        <div className={`bg-gradient-to-r ${typeConfig.headerGradient} p-4 border-b border-surface-50/20`}>
          <div className="flex items-center gap-4">
            {/* Player Photo */}
            <div className="relative flex-shrink-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={player.playerName}
                  className="w-16 h-16 rounded-xl object-cover bg-surface-300 border-2 border-white/20"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className={`w-16 h-16 rounded-xl ${posColors.bg} ${posColors.text} flex items-center justify-center text-xl font-bold`}>
                  {player.playerPosition}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white p-0.5 border border-surface-50/20">
                <img
                  src={getTeamLogo(player.playerTeam)}
                  alt={player.playerTeam}
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            </div>

            {/* Player Details */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{player.playerName}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${posColors.bg} ${posColors.text}`}>
                  {player.playerPosition}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig.badge.bg} ${typeConfig.badge.color}`}>
                  {typeConfig.badge.text}
                </span>
                <span className="text-gray-400 text-sm">{player.playerTeam}</span>
                {player.playerAge && (
                  <span className="text-gray-500 text-sm">• {player.playerAge} anni</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-sm">
                {isOtherRoster && player.contractClause && (
                  <span className="text-orange-400">Clausola: {player.contractClause}M</span>
                )}
                {isOtherRoster && player.rubataPrice && (
                  <span className="text-yellow-400">Rubata: {player.rubataPrice}M</span>
                )}
                {isMyRoster && player.contractClause && (
                  <span className="text-emerald-400">Clausola: {player.contractClause}M</span>
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg bg-surface-300/50 hover:bg-surface-100/50 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Form Badge */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Forma attuale:</span>
            <PlayerFormBadge
              rating={getFormRating(player.playerApiFootballStats)}
              trend={calculateFormTrend(
                getFormRating(player.playerApiFootballStats),
                getFormRating(player.playerApiFootballStats)
              )}
              size="md"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(90vh-200px)]">

          {/* Category Selection / Roster Management Tags */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              {typeConfig.categoryLabel}
            </label>

            {isMyRoster ? (
              /* Roster Management Tags - multi-select for MY ROSTER players */
              <div className="space-y-3">
                <p className="text-xs text-gray-500 -mt-1 mb-2">Seleziona uno o più tag per pianificare cosa fare con questo giocatore</p>
                <div className="grid grid-cols-2 gap-2">
                  {ROSTER_MANAGEMENT_TAGS.map(tag => {
                    const isActive = selectedRosterTags.has(tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleRosterTag(tag.id)}
                        className={`
                          flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left
                          ${isActive
                            ? `${tag.color} ring-2 ring-white/30 border-transparent`
                            : 'bg-surface-300/50 text-gray-500 border-surface-50/30 hover:border-surface-50/50 hover:text-gray-300'
                          }
                        `}
                        title={tag.description}
                      >
                        <span className="text-lg">{tag.label.split(' ')[0]}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{tag.label.split(' ').slice(1).join(' ')}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
                {selectedRosterTags.size > 0 && (
                  <div className="bg-surface-300/30 rounded-lg p-2 text-xs text-gray-400">
                    <span className="font-medium text-white">{selectedRosterTags.size} tag selezionati:</span>{' '}
                    {ROSTER_MANAGEMENT_TAGS.filter(t => selectedRosterTags.has(t.id)).map(t => t.label).join(', ')}
                  </div>
                )}
              </div>
            ) : (
              /* Watchlist Categories - single select for OTHER players */
              categories.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {/* Remove from category button - only show if a category is selected */}
                  {currentCategoryId && (
                    <button
                      onClick={() => onCategoryChange(null)}
                      disabled={savingCategory}
                      className={`
                        flex items-center gap-2 p-3 rounded-xl border-2 transition-all
                        bg-gray-500/20 text-gray-400 border-gray-500/40 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40
                        ${savingCategory ? 'animate-pulse' : ''}
                      `}
                    >
                      <span className="text-xl">✕</span>
                      <span className="text-sm font-medium">Rimuovi</span>
                    </button>
                  )}
                  {/* Category buttons */}
                  {categories.map(category => {
                    const style = getCategoryStyle(category.color)
                    const isActive = currentCategoryId === category.id

                    return (
                      <button
                        key={category.id}
                        onClick={() => handleCategoryClick(category.id)}
                        disabled={savingCategory}
                        className={`
                          flex items-center gap-2 p-3 rounded-xl border-2 transition-all
                          ${isActive
                            ? `${style.activeBg} ${style.activeText} border-transparent ring-2 ring-white/30`
                            : `${style.bg} ${style.text} ${style.border} hover:brightness-110`
                          }
                          ${savingCategory ? 'animate-pulse' : ''}
                        `}
                        title={category.description || category.name}
                      >
                        <span className="text-xl">{category.icon || '📋'}</span>
                        <span className="text-sm font-medium truncate">{category.name}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-surface-300/50 rounded-xl p-4 text-center">
                  <p className="text-gray-500 text-sm">Nessuna categoria configurata</p>
                  <p className="text-gray-600 text-xs mt-1">Le categorie vengono create automaticamente</p>
                </div>
              )
            )}
          </div>

          {/* Max Bid with Suggestion */}
          <div>
            <label className="block text-sm font-semibold text-white mb-1">
              {typeConfig.bidLabel}
            </label>
            <p className="text-xs text-gray-500 mb-3">{typeConfig.bidDescription}</p>

            {/* Suggestion Banner */}
            {suggestedPrice && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-blue-400 font-medium">💡 Suggerito: </span>
                    <span className="text-white font-bold">{suggestedPrice.min}-{suggestedPrice.max}M</span>
                  </div>
                  <button
                    onClick={() => onStrategyChange('maxBid', suggestedPrice.max.toString())}
                    className="px-3 py-1 bg-blue-500/30 hover:bg-blue-500/50 text-blue-300 rounded-lg text-xs font-medium transition-colors"
                  >
                    Usa {suggestedPrice.max}M
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">{suggestedPrice.reason}</p>
              </div>
            )}

            {/* Big Input */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 bg-surface-300/50 rounded-xl p-3 sm:p-4">
              <button
                onClick={() => {
                  const current = parseInt(localStrategy.maxBid) || 0
                  onStrategyChange('maxBid', Math.max(0, current - 5).toString())
                }}
                className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-surface-100/50 hover:bg-red-500/30 text-gray-400 hover:text-red-400 text-xl sm:text-2xl font-bold transition-colors"
              >
                −5
              </button>
              <button
                onClick={() => {
                  const current = parseInt(localStrategy.maxBid) || 0
                  onStrategyChange('maxBid', Math.max(0, current - 1).toString())
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-100/50 hover:bg-red-500/20 text-gray-400 hover:text-red-400 text-base sm:text-lg font-bold transition-colors"
              >
                −1
              </button>

              <div className="text-center">
                <input
                  type="number"
                  value={localStrategy.maxBid}
                  onChange={(e) => onStrategyChange('maxBid', e.target.value)}
                  placeholder="0"
                  className="w-20 h-14 sm:w-24 sm:h-16 text-center text-2xl sm:text-3xl font-bold bg-surface-300 border-2 border-green-500/50 rounded-xl text-green-400 focus:border-green-400 focus:outline-none"
                />
                <span className="block text-xs sm:text-sm text-gray-500 mt-1">milioni</span>
              </div>

              <button
                onClick={() => {
                  const current = parseInt(localStrategy.maxBid) || 0
                  onStrategyChange('maxBid', (current + 1).toString())
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-100/50 hover:bg-green-500/20 text-gray-400 hover:text-green-400 text-base sm:text-lg font-bold transition-colors"
              >
                +1
              </button>
              <button
                onClick={() => {
                  const current = parseInt(localStrategy.maxBid) || 0
                  onStrategyChange('maxBid', (current + 5).toString())
                }}
                className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-surface-100/50 hover:bg-green-500/30 text-gray-400 hover:text-green-400 text-xl sm:text-2xl font-bold transition-colors"
              >
                +5
              </button>
            </div>

            {/* Budget Impact - different for myRoster vs others */}
            {parseInt(localStrategy.maxBid) > 0 && (
              isMyRoster ? (
                // For my roster players: show potential income from sale
                <div className="mt-3 p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/30">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Se lo cedi a questo prezzo:</span>
                    <span className="text-emerald-400">
                      +{localStrategy.maxBid}M in cassa
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Budget attuale: {currentBudget}M → Nuovo: {currentBudget + parseInt(localStrategy.maxBid)}M
                  </p>
                </div>
              ) : (
                // For other players: show remaining budget after purchases
                <div className={`mt-3 p-3 rounded-lg border ${budgetImpact.remaining >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Se prendi tutti i target:</span>
                    <span className={budgetImpact.remaining >= 0 ? 'text-green-400' : 'text-red-400'}>
                      Restano {budgetImpact.remaining}M
                    </span>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Priority Stars */}
          <div>
            <label className="block text-sm font-semibold text-white mb-1">
              {typeConfig.priorityLabel}
            </label>
            <p className="text-xs text-gray-500 mb-2">{typeConfig.priorityDescription}</p>
            <div className="flex items-center justify-center gap-1 sm:gap-2 bg-surface-300/50 rounded-xl p-3 sm:p-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => onStrategyChange('priority', localStrategy.priority === star ? 0 : star)}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl transition-all hover:scale-110 ${
                    localStrategy.priority >= star
                      ? 'text-yellow-400 drop-shadow-lg bg-yellow-500/20'
                      : 'text-gray-600 bg-surface-300/50 hover:text-yellow-500/50'
                  }`}
                >
                  <span className="text-2xl sm:text-3xl">★</span>
                </button>
              ))}
            </div>
            <div className="text-center mt-2">
              <span className={`text-sm font-medium ${
                localStrategy.priority === 0 ? 'text-gray-500' :
                localStrategy.priority <= 2 ? 'text-gray-400' :
                localStrategy.priority === 3 ? 'text-yellow-500' :
                localStrategy.priority === 4 ? 'text-orange-400' :
                isMyRoster ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {isMyRoster
                  ? (localStrategy.priority === 0 ? 'Non valutato' :
                     localStrategy.priority === 1 ? 'Cedibile' :
                     localStrategy.priority === 2 ? 'Sacrificabile' :
                     localStrategy.priority === 3 ? 'Preferisco tenerlo' :
                     localStrategy.priority === 4 ? 'Ci tengo molto' :
                     'INCEDIBILE! 💎')
                  : (localStrategy.priority === 0 ? 'Nessuna priorità' :
                     localStrategy.priority === 1 ? 'Interessante' :
                     localStrategy.priority === 2 ? 'Da valutare' :
                     localStrategy.priority === 3 ? 'Lo voglio' :
                     localStrategy.priority === 4 ? 'Obiettivo importante' :
                     'DEVO PRENDERLO! 🔥')
                }
              </span>
            </div>
          </div>

          {/* Quick Notes Tags */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              📝 Note Rapide
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {NOTE_TAGS.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                    selectedTags.has(tag.id)
                      ? tag.color + ' ring-2 ring-white/30'
                      : 'bg-surface-300/50 text-gray-500 border-surface-50/30 hover:text-gray-300'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={freeNote}
              onChange={(e) => handleFreeNoteChange(e.target.value)}
              placeholder="Altre note personali..."
              className="w-full px-4 py-3 bg-surface-300/50 border border-surface-50/30 rounded-xl text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer - Manual Save/Cancel */}
        <div className="p-4 border-t border-surface-50/20 bg-surface-300/30">
          <div className="flex items-center justify-between gap-3">
            {/* Left side - dirty indicator */}
            <span className={`text-sm ${localStrategy.isDirty ? 'text-yellow-400' : 'text-gray-500'}`}>
              {savingStrategy ? '💾 Salvataggio...' : localStrategy.isDirty ? '⚠️ Modifiche non salvate' : '✓ Salvato'}
            </span>

            {/* Right side - action buttons */}
            <div className="flex items-center gap-2">
              {/* Cancel button - only show if there are unsaved changes */}
              {localStrategy.isDirty && onCancel && (
                <button
                  onClick={() => {
                    onCancel()
                    onClose()
                  }}
                  disabled={savingStrategy}
                  className="px-4 py-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-xl font-medium transition-colors border border-gray-500/30"
                >
                  Annulla
                </button>
              )}

              {/* Save button */}
              <button
                onClick={() => {
                  if (onSave) {
                    onSave()
                  }
                  onClose()
                }}
                disabled={savingStrategy}
                className={`px-6 py-2 rounded-xl font-medium transition-colors ${
                  localStrategy.isDirty
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-primary-500 hover:bg-primary-600 text-white'
                }`}
              >
                {localStrategy.isDirty ? '💾 Salva' : 'Chiudi'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlayerStrategyPanel
