import { useState } from 'react'

// ============ STYLE DEFINITIONS - 20+ COMBINATIONS ============
// Based on market analysis of: Sleeper, Yahoo Fantasy, FanDuel, DraftKings,
// Dream11, Sorare, FPL, and modern UI trends (glassmorphism, neon, gradients)

interface StyleTheme {
  id: string
  name: string
  category: string
  description: string
  inspiration: string
  bg: string
  bgCard: string
  bgHover: string
  text: string
  textMuted: string
  textDim: string
  border: string
  primary: string
  primaryBg: string
  accent: string
  accentBg: string
  success: string
  danger: string
  gradient?: string
  special?: string
}

const styleThemes: StyleTheme[] = [
  // ========== CATEGORIA 1: PREMIUM / LUXURY ==========
  {
    id: 'premium-gold',
    name: 'Premium Gold',
    category: 'Premium / Luxury',
    description: 'Tema scuro elegante con accenti dorati. Ideale per leghe premium e tornei esclusivi.',
    inspiration: 'Ispirato a DraftKings VIP e app di betting di lusso',
    bg: 'bg-[#0a0a0f]',
    bgCard: 'bg-[#12121a]',
    bgHover: 'bg-[#1a1a25]',
    text: 'text-white',
    textMuted: 'text-gray-400',
    textDim: 'text-gray-600',
    border: 'border-amber-900/30',
    primary: 'text-amber-400',
    primaryBg: 'bg-amber-500/15',
    accent: 'text-amber-300',
    accentBg: 'bg-amber-400/10',
    success: 'text-emerald-400',
    danger: 'text-red-400',
    gradient: 'from-amber-500 via-yellow-500 to-amber-600',
  },
  {
    id: 'platinum-elite',
    name: 'Platinum Elite',
    category: 'Premium / Luxury',
    description: 'Design sofisticato con toni argento e blu ghiaccio. Per utenti esperti.',
    inspiration: 'Ispirato a app finanziarie premium e dashboard executive',
    bg: 'bg-[#0c0c12]',
    bgCard: 'bg-[#14141c]',
    bgHover: 'bg-[#1c1c28]',
    text: 'text-slate-100',
    textMuted: 'text-slate-400',
    textDim: 'text-slate-600',
    border: 'border-slate-700/40',
    primary: 'text-slate-300',
    primaryBg: 'bg-slate-500/15',
    accent: 'text-sky-400',
    accentBg: 'bg-sky-500/10',
    success: 'text-teal-400',
    danger: 'text-rose-400',
    gradient: 'from-slate-400 via-slate-300 to-slate-400',
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    category: 'Premium / Luxury',
    description: 'Viola regale con tocchi dorati. Eleganza e prestigio per tornei importanti.',
    inspiration: 'Ispirato a brand sportivi di lusso e esports premium',
    bg: 'bg-[#0d0a14]',
    bgCard: 'bg-[#16121f]',
    bgHover: 'bg-[#201a2d]',
    text: 'text-purple-50',
    textMuted: 'text-purple-300',
    textDim: 'text-purple-500',
    border: 'border-purple-800/30',
    primary: 'text-purple-300',
    primaryBg: 'bg-purple-500/15',
    accent: 'text-amber-400',
    accentBg: 'bg-amber-500/10',
    success: 'text-emerald-400',
    danger: 'text-pink-400',
    gradient: 'from-purple-500 via-violet-500 to-purple-600',
  },

  // ========== CATEGORIA 2: NEON / CYBERPUNK ==========
  {
    id: 'neon-cyber',
    name: 'Neon Cyber',
    category: 'Neon / Cyberpunk',
    description: 'Stile cyberpunk con neon cyan e magenta. Futuristico e audace.',
    inspiration: 'Ispirato a Sorare NFT e gaming esports',
    bg: 'bg-black',
    bgCard: 'bg-gray-950',
    bgHover: 'bg-gray-900',
    text: 'text-cyan-50',
    textMuted: 'text-cyan-300',
    textDim: 'text-cyan-600',
    border: 'border-cyan-500/40',
    primary: 'text-cyan-400',
    primaryBg: 'bg-cyan-500/20',
    accent: 'text-fuchsia-400',
    accentBg: 'bg-fuchsia-500/20',
    success: 'text-green-400',
    danger: 'text-red-500',
    gradient: 'from-cyan-400 via-blue-500 to-fuchsia-500',
    special: 'shadow-[0_0_30px_rgba(0,255,255,0.15)]',
  },
  {
    id: 'electric-pink',
    name: 'Electric Pink',
    category: 'Neon / Cyberpunk',
    description: 'Rosa elettrico su nero profondo. Energico e distintivo.',
    inspiration: 'Ispirato a UI gaming moderne e stream overlay',
    bg: 'bg-[#050507]',
    bgCard: 'bg-[#0d0d12]',
    bgHover: 'bg-[#15151f]',
    text: 'text-pink-50',
    textMuted: 'text-pink-300',
    textDim: 'text-pink-600',
    border: 'border-pink-500/30',
    primary: 'text-pink-400',
    primaryBg: 'bg-pink-500/20',
    accent: 'text-violet-400',
    accentBg: 'bg-violet-500/15',
    success: 'text-lime-400',
    danger: 'text-red-400',
    gradient: 'from-pink-500 via-rose-500 to-fuchsia-500',
  },
  {
    id: 'matrix-green',
    name: 'Matrix Green',
    category: 'Neon / Cyberpunk',
    description: 'Verde Matrix su nero. Tech-inspired per appassionati di dati.',
    inspiration: 'Ispirato a dashboard di analytics e tech interfaces',
    bg: 'bg-[#020804]',
    bgCard: 'bg-[#071208]',
    bgHover: 'bg-[#0c1a0f]',
    text: 'text-green-50',
    textMuted: 'text-green-400',
    textDim: 'text-green-700',
    border: 'border-green-500/30',
    primary: 'text-green-400',
    primaryBg: 'bg-green-500/15',
    accent: 'text-emerald-300',
    accentBg: 'bg-emerald-500/10',
    success: 'text-lime-400',
    danger: 'text-red-500',
    gradient: 'from-green-400 via-emerald-500 to-green-600',
  },

  // ========== CATEGORIA 3: SPORTS / ATHLETIC ==========
  {
    id: 'stadium-blue',
    name: 'Stadium Blue',
    category: 'Sports / Athletic',
    description: 'Blu stadio classico. Professionale e sportivo come le grandi app.',
    inspiration: 'Ispirato a Yahoo Fantasy e ESPN',
    bg: 'bg-[#0a1628]',
    bgCard: 'bg-[#0f1e33]',
    bgHover: 'bg-[#152840]',
    text: 'text-white',
    textMuted: 'text-blue-300',
    textDim: 'text-blue-500',
    border: 'border-blue-600/30',
    primary: 'text-blue-400',
    primaryBg: 'bg-blue-500/20',
    accent: 'text-yellow-400',
    accentBg: 'bg-yellow-500/15',
    success: 'text-emerald-400',
    danger: 'text-red-400',
    gradient: 'from-blue-500 via-blue-600 to-indigo-600',
  },
  {
    id: 'champions-red',
    name: 'Champions Red',
    category: 'Sports / Athletic',
    description: 'Rosso campioni dinamico. Passione e competizione.',
    inspiration: 'Ispirato a brand sportivi come Liverpool, Man United',
    bg: 'bg-[#120808]',
    bgCard: 'bg-[#1a0c0c]',
    bgHover: 'bg-[#241212]',
    text: 'text-red-50',
    textMuted: 'text-red-300',
    textDim: 'text-red-500',
    border: 'border-red-800/40',
    primary: 'text-red-400',
    primaryBg: 'bg-red-500/20',
    accent: 'text-amber-400',
    accentBg: 'bg-amber-500/15',
    success: 'text-emerald-400',
    danger: 'text-orange-400',
    gradient: 'from-red-500 via-red-600 to-rose-600',
  },
  {
    id: 'pitch-green',
    name: 'Pitch Green',
    category: 'Sports / Athletic',
    description: 'Verde campo da calcio. Autentico e immersivo.',
    inspiration: 'Ispirato a FPL e app calcistiche europee',
    bg: 'bg-[#0a1a0f]',
    bgCard: 'bg-[#0f2415]',
    bgHover: 'bg-[#152e1c]',
    text: 'text-emerald-50',
    textMuted: 'text-emerald-300',
    textDim: 'text-emerald-600',
    border: 'border-emerald-700/30',
    primary: 'text-emerald-400',
    primaryBg: 'bg-emerald-500/20',
    accent: 'text-white',
    accentBg: 'bg-white/10',
    success: 'text-lime-400',
    danger: 'text-red-400',
    gradient: 'from-emerald-500 via-green-600 to-emerald-700',
  },

  // ========== CATEGORIA 4: MINIMALIST / CLEAN ==========
  {
    id: 'clean-white',
    name: 'Clean White',
    category: 'Minimalist / Clean',
    description: 'Design pulito e luminoso. Massima leggibilita e professionalita.',
    inspiration: 'Ispirato a Apple e design scandinavo',
    bg: 'bg-gray-50',
    bgCard: 'bg-white',
    bgHover: 'bg-gray-100',
    text: 'text-gray-900',
    textMuted: 'text-gray-600',
    textDim: 'text-gray-400',
    border: 'border-gray-200',
    primary: 'text-blue-600',
    primaryBg: 'bg-blue-50',
    accent: 'text-indigo-600',
    accentBg: 'bg-indigo-50',
    success: 'text-emerald-600',
    danger: 'text-red-600',
  },
  {
    id: 'soft-gray',
    name: 'Soft Gray',
    category: 'Minimalist / Clean',
    description: 'Grigio morbido elegante. Neutro e rilassante per lunghe sessioni.',
    inspiration: 'Ispirato a Notion e app productivity',
    bg: 'bg-stone-100',
    bgCard: 'bg-white',
    bgHover: 'bg-stone-50',
    text: 'text-stone-800',
    textMuted: 'text-stone-500',
    textDim: 'text-stone-400',
    border: 'border-stone-200',
    primary: 'text-stone-700',
    primaryBg: 'bg-stone-100',
    accent: 'text-amber-600',
    accentBg: 'bg-amber-50',
    success: 'text-emerald-600',
    danger: 'text-red-600',
  },
  {
    id: 'paper-cream',
    name: 'Paper Cream',
    category: 'Minimalist / Clean',
    description: 'Toni crema caldi. Confortevole come carta stampata.',
    inspiration: 'Ispirato a app di lettura e design editoriale',
    bg: 'bg-[#faf8f5]',
    bgCard: 'bg-white',
    bgHover: 'bg-[#f5f3f0]',
    text: 'text-stone-800',
    textMuted: 'text-stone-500',
    textDim: 'text-stone-400',
    border: 'border-stone-200',
    primary: 'text-amber-700',
    primaryBg: 'bg-amber-50',
    accent: 'text-orange-600',
    accentBg: 'bg-orange-50',
    success: 'text-emerald-700',
    danger: 'text-red-700',
  },

  // ========== CATEGORIA 5: GRADIENT / MODERN ==========
  {
    id: 'aurora-gradient',
    name: 'Aurora Gradient',
    category: 'Gradient / Modern',
    description: 'Gradienti aurora boreale. Moderno e accattivante.',
    inspiration: 'Ispirato a Stripe e design fintech moderno',
    bg: 'bg-slate-900',
    bgCard: 'bg-slate-800/80',
    bgHover: 'bg-slate-700/60',
    text: 'text-white',
    textMuted: 'text-slate-300',
    textDim: 'text-slate-500',
    border: 'border-slate-600/30',
    primary: 'text-violet-400',
    primaryBg: 'bg-violet-500/20',
    accent: 'text-pink-400',
    accentBg: 'bg-pink-500/15',
    success: 'text-emerald-400',
    danger: 'text-red-400',
    gradient: 'from-violet-500 via-fuchsia-500 to-pink-500',
  },
  {
    id: 'sunset-blend',
    name: 'Sunset Blend',
    category: 'Gradient / Modern',
    description: 'Sfumature calde del tramonto. Accogliente e dinamico.',
    inspiration: 'Ispirato a Instagram e social media moderni',
    bg: 'bg-zinc-900',
    bgCard: 'bg-zinc-800/90',
    bgHover: 'bg-zinc-700/70',
    text: 'text-orange-50',
    textMuted: 'text-orange-200',
    textDim: 'text-orange-400',
    border: 'border-orange-700/30',
    primary: 'text-orange-400',
    primaryBg: 'bg-orange-500/20',
    accent: 'text-rose-400',
    accentBg: 'bg-rose-500/15',
    success: 'text-yellow-400',
    danger: 'text-red-400',
    gradient: 'from-orange-500 via-rose-500 to-pink-500',
  },
  {
    id: 'ocean-wave',
    name: 'Ocean Wave',
    category: 'Gradient / Modern',
    description: 'Blu oceano profondo con sfumature acqua. Fluido e rilassante.',
    inspiration: 'Ispirato a app wellness e design marino',
    bg: 'bg-slate-900',
    bgCard: 'bg-slate-800/80',
    bgHover: 'bg-slate-700/60',
    text: 'text-cyan-50',
    textMuted: 'text-cyan-300',
    textDim: 'text-cyan-500',
    border: 'border-cyan-700/30',
    primary: 'text-cyan-400',
    primaryBg: 'bg-cyan-500/20',
    accent: 'text-teal-400',
    accentBg: 'bg-teal-500/15',
    success: 'text-emerald-400',
    danger: 'text-rose-400',
    gradient: 'from-cyan-500 via-blue-500 to-teal-500',
  },

  // ========== CATEGORIA 6: DARK PROFESSIONAL ==========
  {
    id: 'sleeper-dark',
    name: 'Sleeper Dark',
    category: 'Dark Professional',
    description: 'Tema scuro bilanciato. Ispirato alla migliore app fantasy USA.',
    inspiration: 'Direttamente ispirato a Sleeper App',
    bg: 'bg-[#1a1d24]',
    bgCard: 'bg-[#23272f]',
    bgHover: 'bg-[#2c313a]',
    text: 'text-white',
    textMuted: 'text-gray-400',
    textDim: 'text-gray-500',
    border: 'border-gray-700/40',
    primary: 'text-green-400',
    primaryBg: 'bg-green-500/15',
    accent: 'text-blue-400',
    accentBg: 'bg-blue-500/15',
    success: 'text-emerald-400',
    danger: 'text-red-400',
  },
  {
    id: 'draftkings-style',
    name: 'DraftKings Style',
    category: 'Dark Professional',
    description: 'Verde DraftKings su nero. Riconoscibile e professionale.',
    inspiration: 'Ispirato a DraftKings Fantasy',
    bg: 'bg-[#0d0d0d]',
    bgCard: 'bg-[#1a1a1a]',
    bgHover: 'bg-[#252525]',
    text: 'text-white',
    textMuted: 'text-gray-400',
    textDim: 'text-gray-600',
    border: 'border-gray-800',
    primary: 'text-[#53d337]',
    primaryBg: 'bg-[#53d337]/15',
    accent: 'text-white',
    accentBg: 'bg-white/10',
    success: 'text-green-400',
    danger: 'text-red-500',
  },
  {
    id: 'fanduel-blue',
    name: 'FanDuel Blue',
    category: 'Dark Professional',
    description: 'Blu FanDuel distintivo. Affidabile e competitivo.',
    inspiration: 'Ispirato a FanDuel Fantasy',
    bg: 'bg-[#0c1929]',
    bgCard: 'bg-[#132238]',
    bgHover: 'bg-[#1a2d47]',
    text: 'text-white',
    textMuted: 'text-blue-200',
    textDim: 'text-blue-400',
    border: 'border-blue-800/40',
    primary: 'text-[#1493ff]',
    primaryBg: 'bg-[#1493ff]/20',
    accent: 'text-orange-400',
    accentBg: 'bg-orange-500/15',
    success: 'text-emerald-400',
    danger: 'text-red-400',
  },

  // ========== CATEGORIA 7: PLAYFUL / FUN ==========
  {
    id: 'candy-pop',
    name: 'Candy Pop',
    category: 'Playful / Fun',
    description: 'Colori vivaci e giocosi. Perfetto per leghe tra amici.',
    inspiration: 'Ispirato a Duolingo e app gaming casual',
    bg: 'bg-violet-950',
    bgCard: 'bg-violet-900/80',
    bgHover: 'bg-violet-800/60',
    text: 'text-white',
    textMuted: 'text-violet-200',
    textDim: 'text-violet-400',
    border: 'border-violet-600/40',
    primary: 'text-yellow-400',
    primaryBg: 'bg-yellow-500/20',
    accent: 'text-pink-400',
    accentBg: 'bg-pink-500/20',
    success: 'text-lime-400',
    danger: 'text-orange-400',
    gradient: 'from-yellow-400 via-pink-500 to-violet-500',
  },
  {
    id: 'tropical-vibes',
    name: 'Tropical Vibes',
    category: 'Playful / Fun',
    description: 'Colori tropicali brillanti. Estate e divertimento tutto lanno.',
    inspiration: 'Ispirato a brand lifestyle e travel',
    bg: 'bg-teal-950',
    bgCard: 'bg-teal-900/80',
    bgHover: 'bg-teal-800/60',
    text: 'text-white',
    textMuted: 'text-teal-200',
    textDim: 'text-teal-400',
    border: 'border-teal-600/40',
    primary: 'text-cyan-400',
    primaryBg: 'bg-cyan-500/20',
    accent: 'text-orange-400',
    accentBg: 'bg-orange-500/20',
    success: 'text-lime-400',
    danger: 'text-pink-400',
    gradient: 'from-cyan-400 via-teal-500 to-orange-400',
  },

  // ========== CATEGORIA 8: GLASSMORPHISM ==========
  {
    id: 'glass-dark',
    name: 'Glass Dark',
    category: 'Glassmorphism',
    description: 'Effetto vetro su sfondo scuro. Moderno e sofisticato.',
    inspiration: 'Ispirato a Apple Vision Pro e UI moderne',
    bg: 'bg-[#0f0f14]',
    bgCard: 'bg-white/5',
    bgHover: 'bg-white/10',
    text: 'text-white',
    textMuted: 'text-gray-300',
    textDim: 'text-gray-500',
    border: 'border-white/10',
    primary: 'text-blue-400',
    primaryBg: 'bg-blue-500/20',
    accent: 'text-purple-400',
    accentBg: 'bg-purple-500/15',
    success: 'text-emerald-400',
    danger: 'text-red-400',
    special: 'backdrop-blur-xl',
  },
  {
    id: 'frosted-blue',
    name: 'Frosted Blue',
    category: 'Glassmorphism',
    description: 'Vetro smerigliato su blu. Elegante e tecnologico.',
    inspiration: 'Ispirato a Windows 11 e design Microsoft',
    bg: 'bg-gradient-to-br from-blue-900 via-indigo-900 to-violet-900',
    bgCard: 'bg-white/10',
    bgHover: 'bg-white/15',
    text: 'text-white',
    textMuted: 'text-blue-100',
    textDim: 'text-blue-300',
    border: 'border-white/20',
    primary: 'text-cyan-300',
    primaryBg: 'bg-cyan-500/20',
    accent: 'text-white',
    accentBg: 'bg-white/15',
    success: 'text-emerald-300',
    danger: 'text-rose-300',
    special: 'backdrop-blur-xl',
  },
]

// Font definitions
const fonts = {
  system: { name: 'System', desc: 'Font di sistema', style: { fontFamily: 'system-ui, -apple-system, sans-serif' } },
  inter: { name: 'Inter', desc: 'Moderno e leggibile', style: { fontFamily: 'Inter, system-ui, sans-serif' } },
  roboto: { name: 'Roboto', desc: 'Google Material', style: { fontFamily: 'Roboto, system-ui, sans-serif' } },
  poppins: { name: 'Poppins', desc: 'Geometrico', style: { fontFamily: 'Poppins, system-ui, sans-serif' } },
  mono: { name: 'Mono', desc: 'Monospazio', style: { fontFamily: 'ui-monospace, monospace' } },
}

type FontKey = keyof typeof fonts

// Mock data
const mockPlayers = [
  { id: '1', name: 'Lautaro Martinez', position: 'A', team: 'Inter', quotation: 85, fvm: 62, salary: 15, duration: 3, fantaPoints: 156, avgRating: 7.2, goals: 18, assists: 6 },
  { id: '2', name: 'Dusan Vlahovic', position: 'A', team: 'Juventus', quotation: 78, fvm: 55, salary: 12, duration: 2, fantaPoints: 142, avgRating: 6.9, goals: 15, assists: 3 },
  { id: '3', name: 'Rafael Leao', position: 'A', team: 'Milan', quotation: 72, fvm: 48, salary: 10, duration: 4, fantaPoints: 128, avgRating: 6.8, goals: 12, assists: 8 },
  { id: '4', name: 'Nicolò Barella', position: 'C', team: 'Inter', quotation: 68, fvm: 52, salary: 14, duration: 3, fantaPoints: 145, avgRating: 7.1, goals: 8, assists: 11 },
  { id: '5', name: 'Theo Hernandez', position: 'D', team: 'Milan', quotation: 42, fvm: 38, salary: 11, duration: 3, fantaPoints: 112, avgRating: 6.7, goals: 4, assists: 9 },
  { id: '6', name: 'Alessandro Bastoni', position: 'D', team: 'Inter', quotation: 38, fvm: 32, salary: 9, duration: 4, fantaPoints: 95, avgRating: 6.6, goals: 2, assists: 4 },
  { id: '7', name: 'Mike Maignan', position: 'P', team: 'Milan', quotation: 22, fvm: 18, salary: 7, duration: 3, fantaPoints: 132, avgRating: 6.8, goals: 0, assists: 0 },
]

const posColorMap: Record<string, { gradient: string; text: string }> = {
  P: { gradient: 'from-amber-500 to-amber-600', text: 'text-amber-400' },
  D: { gradient: 'from-blue-500 to-blue-600', text: 'text-blue-400' },
  C: { gradient: 'from-emerald-500 to-emerald-600', text: 'text-emerald-400' },
  A: { gradient: 'from-red-500 to-red-600', text: 'text-red-400' },
}

// Get unique categories
const categories = [...new Set(styleThemes.map(t => t.category))]

export default function TestStrategyFormats() {
  const [selectedTheme, setSelectedTheme] = useState<string>('sleeper-dark')
  const [selectedFont, setSelectedFont] = useState<FontKey>('system')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const theme = styleThemes.find(t => t.id === selectedTheme) || styleThemes[0]
  const font = fonts[selectedFont]

  const filteredThemes = selectedCategory
    ? styleThemes.filter(t => t.category === selectedCategory)
    : styleThemes

  return (
    <div className={`min-h-screen ${theme.bg} transition-all duration-500`} style={font.style}>
      <div className="max-w-[1600px] mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-4xl font-bold ${theme.text} mb-2`}>Platform Style Explorer</h1>
          <p className={theme.textMuted}>
            22 combinazioni di stile basate su analisi di mercato: Sleeper, Yahoo Fantasy, DraftKings, FanDuel, Dream11, Sorare, FPL
          </p>
          <div className={`mt-4 text-sm ${theme.textDim}`}>
            Fonte: <a href="https://dribbble.com/tags/fantasy-sports" className={`${theme.primary} underline`} target="_blank">Dribbble</a>,{' '}
            <a href="https://www.behance.net/search/projects/fantasy%20football%20app" className={`${theme.primary} underline`} target="_blank">Behance</a>,{' '}
            <a href="https://www.yahooinc.com/press/award-winning-yahoo-fantasy-app-unveils-new-design-and-1-million-giveaway-for-2024-season" className={`${theme.primary} underline`} target="_blank">Yahoo Fantasy</a>
          </div>
        </div>

        {/* Controls */}
        <div className={`${theme.bgCard} ${theme.special || ''} rounded-2xl border ${theme.border} p-5 mb-6`}>
          {/* Category Filter */}
          <div className="mb-5">
            <h3 className={`text-sm font-bold ${theme.textMuted} uppercase mb-3`}>Filtra per Categoria</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === null
                    ? `${theme.primaryBg} ${theme.primary} border ${theme.border}`
                    : `${theme.bgHover} ${theme.textMuted} border ${theme.border}`
                }`}
              >
                Tutte ({styleThemes.length})
              </button>
              {categories.map(cat => {
                const count = styleThemes.filter(t => t.category === cat).length
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedCategory === cat
                        ? `${theme.primaryBg} ${theme.primary} border ${theme.border}`
                        : `${theme.bgHover} ${theme.textMuted} border ${theme.border}`
                    }`}
                  >
                    {cat} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {/* Font Selection */}
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h3 className={`text-sm font-bold ${theme.textMuted} uppercase mb-2`}>Font</h3>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(fonts) as FontKey[]).map(key => (
                  <button
                    key={key}
                    onClick={() => setSelectedFont(key)}
                    style={fonts[key].style}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      selectedFont === key
                        ? `${theme.primaryBg} ${theme.primary} border ${theme.border}`
                        : `${theme.bgHover} ${theme.textMuted} border ${theme.border}`
                    }`}
                  >
                    {fonts[key].name}
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto">
              <h3 className={`text-sm font-bold ${theme.textMuted} uppercase mb-2`}>Vista</h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === 'grid' ? theme.primaryBg + ' ' + theme.primary : theme.bgHover + ' ' + theme.textMuted}`}
                >
                  Griglia
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === 'list' ? theme.primaryBg + ' ' + theme.primary : theme.bgHover + ' ' + theme.textMuted}`}
                >
                  Lista
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Theme Selection Grid/List */}
        <div className={`${theme.bgCard} ${theme.special || ''} rounded-2xl border ${theme.border} p-5 mb-6`}>
          <h3 className={`text-lg font-bold ${theme.text} mb-4`}>Seleziona uno Stile ({filteredThemes.length} disponibili)</h3>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredThemes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTheme(t.id)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selectedTheme === t.id
                      ? `ring-2 ring-offset-2 ring-offset-transparent ${t.border} ring-current`
                      : ''
                  } ${t.bg} ${t.border} hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {t.gradient && (
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${t.gradient}`}></div>
                    )}
                    <span className={`font-bold ${t.text} text-sm`}>{t.name}</span>
                  </div>
                  <p className={`text-xs ${t.textMuted} mb-2`}>{t.category}</p>
                  <p className={`text-xs ${t.textDim} line-clamp-2`}>{t.description}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredThemes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTheme(t.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${
                    selectedTheme === t.id ? `ring-2 ring-current` : ''
                  } ${t.bg} ${t.border} hover:scale-[1.005]`}
                >
                  {t.gradient && (
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${t.gradient} flex-shrink-0`}></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${t.text}`}>{t.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${t.primaryBg} ${t.primary}`}>{t.category}</span>
                    </div>
                    <p className={`text-sm ${t.textMuted} mt-1`}>{t.description}</p>
                    <p className={`text-xs ${t.textDim} mt-1`}>{t.inspiration}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Theme Info */}
        <div className={`${theme.bgCard} ${theme.special || ''} rounded-2xl border ${theme.border} p-5 mb-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {theme.gradient && (
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${theme.gradient}`}></div>
                )}
                <div>
                  <h2 className={`text-2xl font-bold ${theme.text}`}>{theme.name}</h2>
                  <span className={`text-sm ${theme.primary}`}>{theme.category}</span>
                </div>
              </div>
              <p className={`${theme.textMuted} mt-2 max-w-2xl`}>{theme.description}</p>
              <p className={`${theme.textDim} text-sm mt-1`}>{theme.inspiration}</p>
            </div>
            <div className={`${theme.bgHover} rounded-xl p-4 border ${theme.border}`}>
              <h4 className={`text-xs font-bold ${theme.textMuted} uppercase mb-2`}>Colori Tema</h4>
              <div className="flex gap-2">
                <div className={`w-8 h-8 rounded ${theme.primaryBg} border ${theme.border}`} title="Primary"></div>
                <div className={`w-8 h-8 rounded ${theme.accentBg} border ${theme.border}`} title="Accent"></div>
                <div className={`w-8 h-8 rounded bg-emerald-500/20 border ${theme.border}`} title="Success"></div>
                <div className={`w-8 h-8 rounded bg-red-500/20 border ${theme.border}`} title="Danger"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Table */}
        <div className={`${theme.bgCard} ${theme.special || ''} rounded-2xl border ${theme.border} p-5`}>
          <h3 className={`text-lg font-bold ${theme.text} mb-4`}>Anteprima Tabella Strategie</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theme.bgHover}>
                <tr className={`${theme.textMuted} text-xs uppercase`}>
                  <th className="text-center py-3 px-2 w-12">R</th>
                  <th className="text-left py-3 px-3">Giocatore</th>
                  <th className="text-left py-3 px-3">Squadra</th>
                  <th className="text-center py-3 px-2">Quot.</th>
                  <th className="text-center py-3 px-2">FVM</th>
                  <th className="text-center py-3 px-2">Contratto</th>
                  <th className="text-center py-3 px-2">FP</th>
                  <th className="text-center py-3 px-2">Media</th>
                  <th className="text-center py-3 px-2">G+A</th>
                </tr>
              </thead>
              <tbody>
                {mockPlayers.map(p => (
                  <tr key={p.id} className={`border-t ${theme.border}`}>
                    <td className="py-3 px-2 text-center">
                      <span className={`w-8 h-8 inline-flex items-center justify-center rounded-full bg-gradient-to-br ${posColorMap[p.position].gradient} text-white text-xs font-bold`}>
                        {p.position}
                      </span>
                    </td>
                    <td className={`py-3 px-3 ${theme.text} font-medium`}>{p.name}</td>
                    <td className={`py-3 px-3 ${theme.textDim}`}>{p.team}</td>
                    <td className={`py-3 px-2 text-center ${theme.primary} font-bold`}>{p.quotation}</td>
                    <td className={`py-3 px-2 text-center ${theme.accent}`}>{p.fvm}</td>
                    <td className={`py-3 px-2 text-center ${theme.textMuted}`}>{p.salary}M/{p.duration}a</td>
                    <td className={`py-3 px-2 text-center ${theme.success} font-medium`}>{p.fantaPoints}</td>
                    <td className="py-3 px-2 text-center text-cyan-400">{p.avgRating}</td>
                    <td className={`py-3 px-2 text-center ${theme.text}`}>{p.goals}+{p.assists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sample Cards */}
          <div className="mt-6 pt-6 border-t border-current/10">
            <h4 className={`text-sm font-bold ${theme.textMuted} uppercase mb-4`}>Anteprima Card</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mockPlayers.slice(0, 3).map(p => (
                <div key={p.id} className={`${theme.bgHover} rounded-xl p-4 border ${theme.border}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${posColorMap[p.position].gradient} text-white font-bold flex items-center justify-center`}>
                      {p.position}
                    </div>
                    <div>
                      <h4 className={`${theme.text} font-bold`}>{p.name}</h4>
                      <p className={`text-sm ${theme.textDim}`}>{p.team}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`${theme.primaryBg} rounded-lg p-2 text-center`}>
                      <span className={`block text-lg font-bold ${theme.primary}`}>{p.quotation}</span>
                      <span className={`text-xs ${theme.textDim}`}>QUOT</span>
                    </div>
                    <div className={`${theme.accentBg} rounded-lg p-2 text-center`}>
                      <span className={`block text-lg font-bold ${theme.accent}`}>{p.fvm}</span>
                      <span className={`text-xs ${theme.textDim}`}>FVM</span>
                    </div>
                    <div className="bg-emerald-500/15 rounded-lg p-2 text-center">
                      <span className={`block text-lg font-bold ${theme.success}`}>{p.fantaPoints}</span>
                      <span className={`text-xs ${theme.textDim}`}>FP</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`mt-6 text-center text-sm ${theme.textDim}`}>
          <p>Analisi di mercato basata su: Sleeper, Yahoo Fantasy, DraftKings, FanDuel, Dream11, Sorare, FPL</p>
          <p className="mt-1">Trend UI/UX 2024-2025: glassmorphism, dark mode, neon gradients, mobile-first design</p>
        </div>
      </div>
    </div>
  )
}
