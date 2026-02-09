import { useState } from 'react'
import { useTheme, styleThemes, themeCategories, fonts, type FontKey } from '../contexts/ThemeContext'
import { X, Check, Palette } from 'lucide-react'

interface ThemeSelectorProps {
  isOpen: boolean
  onClose: () => void
}

export function ThemeSelector({ isOpen, onClose }: ThemeSelectorProps) {
  const { themeId, setThemeId, font, setFont } = useTheme()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  if (!isOpen) return null

  const filteredThemes = selectedCategory
    ? styleThemes.filter(t => t.category === selectedCategory)
    : styleThemes

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-theme-card border border-theme-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border bg-theme-hover">
          <div>
            <h2 className="text-xl font-bold text-theme-text">Personalizza Tema</h2>
            <p className="text-sm text-theme-muted">22 stili basati sulle migliori app fantasy</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-theme-hover text-theme-muted hover:text-theme-text transition-colors"
            aria-label="Chiudi selettore tema"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Font Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-theme-muted uppercase mb-3">Font</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(fonts) as FontKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => setFont(key)}
                  style={{ fontFamily: fonts[key].value }}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    font === key
                      ? 'bg-theme-primary-bg text-theme-primary border border-theme-border ring-2 ring-theme-primary/30'
                      : 'bg-theme-hover text-theme-muted border border-theme-border hover:text-theme-text'
                  }`}
                >
                  {fonts[key].name}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-theme-muted uppercase mb-3">Categoria</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  selectedCategory === null
                    ? 'bg-theme-primary-bg text-theme-primary border border-theme-border'
                    : 'bg-theme-hover text-theme-muted border border-theme-border hover:text-theme-text'
                }`}
              >
                Tutte ({styleThemes.length})
              </button>
              {themeCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    selectedCategory === cat
                      ? 'bg-theme-primary-bg text-theme-primary border border-theme-border'
                      : 'bg-theme-hover text-theme-muted border border-theme-border hover:text-theme-text'
                  }`}
                >
                  {cat} ({styleThemes.filter(t => t.category === cat).length})
                </button>
              ))}
            </div>
          </div>

          {/* Theme Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredThemes.map(theme => (
              <button
                key={theme.id}
                onClick={() => setThemeId(theme.id)}
                className={`text-left p-4 rounded-xl border transition-all hover:scale-[1.02] ${
                  themeId === theme.id
                    ? 'ring-2 ring-theme-primary shadow-lg'
                    : ''
                }`}
                style={{
                  backgroundColor: theme.vars['--bg-card'],
                  borderColor: theme.vars['--border'],
                }}
              >
                {/* Theme Preview Header */}
                <div className="flex items-center gap-2 mb-2">
                  {theme.gradient && (
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${theme.gradient}`} />
                  )}
                  {!theme.gradient && (
                    <div
                      className="w-8 h-8 rounded-lg"
                      style={{ backgroundColor: theme.vars['--primary'] }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: theme.vars['--text'] }}>
                      {theme.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: theme.vars['--text-muted'] }}>
                      {theme.category}
                    </p>
                  </div>
                  {themeId === theme.id && (
                    <div className="w-6 h-6 rounded-full bg-theme-primary flex items-center justify-center">
                      <Check size={16} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>

                {/* Theme Preview Colors */}
                <div className="flex gap-1 mb-2">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: theme.vars['--primary'] }} title="Primary" />
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: theme.vars['--accent'] }} title="Accent" />
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: theme.vars['--success'] }} title="Success" />
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: theme.vars['--danger'] }} title="Danger" />
                </div>

                {/* Description */}
                <p className="text-xs line-clamp-2" style={{ color: theme.vars['--text-dim'] }}>
                  {theme.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-theme-border bg-theme-hover flex items-center justify-between">
          <p className="text-sm text-theme-muted">
            Tema attivo: <span className="font-bold text-theme-primary">{styleThemes.find(t => t.id === themeId)?.name}</span>
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-theme-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

// Compact theme button for navigation
export function ThemeButton({ onClick }: { onClick: () => void }) {
  const { theme } = useTheme()

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-hover border border-theme-border hover:bg-theme-primary-bg transition-colors group"
      title="Cambia tema"
      aria-label="Cambia tema"
    >
      {theme.gradient ? (
        <div className={`w-5 h-5 rounded bg-gradient-to-br ${theme.gradient}`} />
      ) : (
        <div className="w-5 h-5 rounded" style={{ backgroundColor: theme.vars['--primary'] }} />
      )}
      <Palette size={16} className="text-theme-muted group-hover:text-theme-primary transition-colors" />
    </button>
  )
}
