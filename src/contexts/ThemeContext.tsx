import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { styleThemes, fonts, DEFAULT_THEME_ID, DEFAULT_FONT, type StyleTheme, type FontKey } from '../themes'

interface ThemeContextType {
  theme: StyleTheme
  themeId: string
  setThemeId: (id: string) => void
  font: FontKey
  setFont: (font: FontKey) => void
  fontFamily: string
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY_THEME = 'fantacontratti-theme'
const STORAGE_KEY_FONT = 'fantacontratti-font'

function applyThemeVariables(theme: StyleTheme) {
  const root = document.documentElement
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}

function applyFont(fontKey: FontKey) {
  document.documentElement.style.setProperty('--font-family', fonts[fontKey].value)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_THEME)
      if (saved && styleThemes.some(t => t.id === saved)) {
        return saved
      }
    }
    return DEFAULT_THEME_ID
  })

  const [font, setFontState] = useState<FontKey>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_FONT) as FontKey
      if (saved && fonts[saved]) {
        return saved
      }
    }
    return DEFAULT_FONT
  })

  const theme = styleThemes.find(t => t.id === themeId) || styleThemes.find(t => t.id === DEFAULT_THEME_ID)!

  const setThemeId = (id: string) => {
    const newTheme = styleThemes.find(t => t.id === id)
    if (newTheme) {
      setThemeIdState(id)
      localStorage.setItem(STORAGE_KEY_THEME, id)
      applyThemeVariables(newTheme)
    }
  }

  const setFont = (newFont: FontKey) => {
    if (fonts[newFont]) {
      setFontState(newFont)
      localStorage.setItem(STORAGE_KEY_FONT, newFont)
      applyFont(newFont)
    }
  }

  // Apply theme and font on mount and when they change
  useEffect(() => {
    applyThemeVariables(theme)
  }, [theme])

  useEffect(() => {
    applyFont(font)
  }, [font])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeId,
        setThemeId,
        font,
        setFont,
        fontFamily: fonts[font].value,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Re-export types and constants for convenience
export { styleThemes, fonts, themeCategories, type StyleTheme, type FontKey }
