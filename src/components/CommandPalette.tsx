import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight } from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  category: string
  icon: string
  action: () => void
  keywords?: string
}

const RECENTS_KEY = 'fantacontratti-command-recents'
const MAX_RECENTS = 5

function getRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]')
  } catch { return [] }
}

function addRecent(id: string) {
  const recents = getRecents().filter(r => r !== id)
  recents.unshift(id)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)))
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Try to get leagueId from current URL
  const leagueId = useMemo(() => {
    const match = window.location.pathname.match(/\/leagues\/([^/]+)/)
    return match?.[1] || null
  }, [isOpen])

  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      // Global pages
      { id: 'dashboard', label: 'Dashboard', category: 'Navigazione', icon: '🏠', action: () => { void navigate('/dashboard') }, keywords: 'home principale' },
      { id: 'profile', label: 'Profilo', category: 'Navigazione', icon: '👤', action: () => { void navigate('/profile') }, keywords: 'account utente impostazioni' },
      { id: 'create-league', label: 'Crea Lega', category: 'Azioni', icon: '➕', action: () => { void navigate('/leagues/new') }, keywords: 'nuova lega creare' },
      { id: 'rules', label: 'Regolamento', category: 'Navigazione', icon: '📖', action: () => { void navigate('/rules') }, keywords: 'regole guida' },
    ]

    // League-specific pages
    if (leagueId) {
      items.push(
        { id: 'league', label: 'Dettaglio Lega', category: 'Lega', icon: '🏆', action: () => { void navigate(`/leagues/${leagueId}`) }, keywords: 'lega info' },
        { id: 'rose', label: 'Rose', category: 'Lega', icon: '📋', action: () => { void navigate(`/leagues/${leagueId}/rose`) }, keywords: 'rosa squadra giocatori roster' },
        { id: 'contracts', label: 'Contratti', category: 'Lega', icon: '📝', action: () => { void navigate(`/leagues/${leagueId}/contracts`) }, keywords: 'contratto rinnovo taglio' },
        { id: 'trades', label: 'Scambi', category: 'Lega', icon: '🔄', action: () => { void navigate(`/leagues/${leagueId}/trades`) }, keywords: 'trade scambio offerta' },
        { id: 'rubata', label: 'Rubata', category: 'Lega', icon: '🎯', action: () => { void navigate(`/leagues/${leagueId}/rubata`) }, keywords: 'clausola rescissione' },
        { id: 'svincolati', label: 'Svincolati', category: 'Lega', icon: '📂', action: () => { void navigate(`/leagues/${leagueId}/svincolati`) }, keywords: 'free agent libero' },
        { id: 'financials', label: 'Finanze', category: 'Lega', icon: '💰', action: () => { void navigate(`/leagues/${leagueId}/financials`) }, keywords: 'budget soldi bilancio' },
        { id: 'movements', label: 'Movimenti', category: 'Lega', icon: '📜', action: () => { void navigate(`/leagues/${leagueId}/movements`) }, keywords: 'storico operazioni' },
        { id: 'stats', label: 'Statistiche Giocatori', category: 'Lega', icon: '📊', action: () => { void navigate(`/leagues/${leagueId}/stats`) }, keywords: 'stats gol assist rating' },
        { id: 'players', label: 'Tutti i Giocatori', category: 'Lega', icon: '⚽', action: () => { void navigate(`/leagues/${leagueId}/players`) }, keywords: 'calciatori ricerca' },
        { id: 'manager', label: 'Dashboard Manager', category: 'Lega', icon: '📈', action: () => { void navigate(`/leagues/${leagueId}/manager`) }, keywords: 'manager panoramica' },
        { id: 'history', label: 'Storico', category: 'Lega', icon: '📚', action: () => { void navigate(`/leagues/${leagueId}/history`) }, keywords: 'cronologia passato' },
        { id: 'prizes', label: 'Premi', category: 'Lega', icon: '🏅', action: () => { void navigate(`/leagues/${leagueId}/prizes`) }, keywords: 'premio classifica' },
        { id: 'prophecies', label: 'Profezie', category: 'Lega', icon: '🔮', action: () => { void navigate(`/leagues/${leagueId}/prophecies`) }, keywords: 'profezia previsione' },
        { id: 'strategie', label: 'Strategie Rubata', category: 'Lega', icon: '🧠', action: () => { void navigate(`/leagues/${leagueId}/strategie-rubata`) }, keywords: 'strategia rubata piano' },
        { id: 'indemnity', label: 'Indennizzi', category: 'Lega', icon: '💵', action: () => { void navigate(`/leagues/${leagueId}/indemnity`) }, keywords: 'indennizzo compenso' },
        { id: 'admin', label: 'Pannello Admin', category: 'Lega', icon: '⚙️', action: () => { void navigate(`/leagues/${leagueId}/admin`) }, keywords: 'amministrazione gestione' },
        { id: 'feedback', label: 'Feedback Hub', category: 'Lega', icon: '💬', action: () => { void navigate(`/leagues/${leagueId}/feedback`) }, keywords: 'segnalazione bug suggerimento' },
        { id: 'patchnotes', label: 'Patch Notes', category: 'Lega', icon: '📰', action: () => { void navigate(`/leagues/${leagueId}/patch-notes`) }, keywords: 'aggiornamenti novita changelog' },
      )
    }

    return items
  }, [leagueId, navigate])

  // Fuzzy search
  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      (cmd.keywords && cmd.keywords.toLowerCase().includes(q))
    )
  }, [commands, query])

  // T-024: Build "Recenti" section when query is empty
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}

    // Show recent items first when no search query
    if (!query.trim()) {
      const recentIds = getRecents()
      const recentItems = recentIds
        .map(id => commands.find(c => c.id === id))
        .filter((c): c is CommandItem => c !== undefined)
      if (recentItems.length > 0) {
        groups['Recenti'] = recentItems
      }
    }

    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    }
    return groups
  }, [filtered, query, commands])

  // Keyboard listener for Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown); }
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Keyboard navigation within palette
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault()
      addRecent(filtered[selectedIndex].id)
      filtered[selectedIndex].action()
      setIsOpen(false)
    }
  }, [filtered, selectedIndex])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!isOpen) return null

  let flatIndex = 0

  return (
    <div className="fixed inset-0 z-[100]" onClick={() => { setIsOpen(false); }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-surface-200 rounded-xl border border-surface-50/30 shadow-2xl overflow-hidden"
        onClick={e => { e.stopPropagation(); }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-50/20">
          <Search size={18} className="text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); }}
            onKeyDown={handleInputKeyDown}
            placeholder="Cerca pagina o azione..."
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] text-gray-500 bg-surface-300 rounded border border-surface-50/20">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-6">
              Nessun risultato per "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-2">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider px-2 py-1 font-medium">
                  {category}
                </div>
                {items.map(item => {
                  const idx = flatIndex++
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={() => {
                        addRecent(item.id)
                        item.action()
                        setIsOpen(false)
                      }}
                      onMouseEnter={() => { setSelectedIndex(idx); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedIndex === idx
                          ? 'bg-primary-500/20 text-white'
                          : 'text-gray-300 hover:bg-surface-300/50'
                      }`}
                    >
                      <span className="text-base flex-shrink-0">{item.icon}</span>
                      <span className="text-sm flex-1">{item.label}</span>
                      {selectedIndex === idx && (
                        <ArrowRight size={14} className="text-primary-400 flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-surface-50/20 text-[10px] text-gray-400">
          <span><kbd className="px-1 py-0.5 bg-surface-300 rounded">↑↓</kbd> Naviga</span>
          <span><kbd className="px-1 py-0.5 bg-surface-300 rounded">Enter</kbd> Apri</span>
          <span><kbd className="px-1 py-0.5 bg-surface-300 rounded">Esc</kbd> Chiudi</span>
        </div>
      </div>
    </div>
  )
}
