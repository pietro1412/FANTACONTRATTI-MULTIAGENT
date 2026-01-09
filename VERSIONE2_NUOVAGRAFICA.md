# Fantacontratti v2 - Restyling Grafico

## Obiettivo

Trasformare l'esperienza utente da "app tech generica" a **piattaforma immersiva per appassionati di calcio, statistiche e fantacalcio**, ottimizzata per utilizzo mobile-first durante sessioni prolungate (aste 2-4 ore).

---

## Analisi Stato Attuale

### Stack Grafico
- **Framework CSS**: TailwindCSS
- **Font**: Inter (body), Outfit (display)
- **Tema**: Dark theme ispirato a Football Manager
- **Componenti UI**: Button, Card, Modal, Input, Badge custom

### Palette Attuale

| Ruolo | Colore | Hex | Problema |
|-------|--------|-----|----------|
| Primary | Teal | `#319795` | Non evoca calcio, troppo "tech/startup" |
| Secondary | Verde | `#22c55e` | Sottoutilizzato, dovrebbe essere più prominente |
| Accent | Oro | `#f59e0b` | Perfetto, semanticamente corretto (trofei) |
| Danger | Rosso | `#ef4444` | OK |
| Background | Grigio-blu | `#1a1f2e` | Leggermente freddo |

### Punti di Forza da Mantenere
- Timer asta con stati progressivi (safe/warning/danger)
- Animazioni fluide e professionali
- Sistema di glow effects
- Badge ruoli P/D/C/A con colori distinti
- Dark theme per sessioni prolungate

### Criticità Identificate
1. **Identità visiva generica** - non comunica "calcio italiano"
2. **Teal primary disconnesso** dal mondo sportivo
3. **Touch targets insufficienti** per mobile (< 44px)
4. **Mancanza feedback aptico** durante aste real-time
5. **Assenza skeleton loading** - perceived performance bassa
6. **Contrasto testi insufficiente** per uso in esterni
7. **Link debug visibili** in produzione

---

## Nuova Palette Proposta: "Stadium Nights"

Ispirazione: atmosfera notturna stadio italiano, luci artificiali, prato verde, passione.

### Colori Primari

| Ruolo | Nuovo Colore | Hex | Motivazione |
|-------|--------------|-----|-------------|
| **Primary** | Blu Stadio | `#2563eb` | Luci notturne stadio, più calcistico del teal |
| **Primary Light** | Blu chiaro | `#3b82f6` | Hover states |
| **Primary Dark** | Blu scuro | `#1d4ed8` | Active states |

### Colori Secondari

| Ruolo | Nuovo Colore | Hex | Motivazione |
|-------|--------------|-----|-------------|
| **Secondary** | Verde Campo | `#16a34a` | IL colore del calcio |
| **Secondary Light** | Verde brillante | `#22c55e` | Successi, conferme |
| **Accent** | Oro Trofeo | `#f59e0b` | Mantieni - perfetto per vittorie |
| **Accent Alt** | Arancio Passione | `#ea580c` | Per momenti di alta intensità |

### Background System

| Livello | Nuovo Colore | Hex | Uso |
|---------|--------------|-----|-----|
| **Base** | Nero profondo | `#0a0a0b` | Body background |
| **Surface 1** | Grigio carbone | `#111214` | Card background |
| **Surface 2** | Grigio scuro | `#1a1c20` | Elementi elevati |
| **Surface 3** | Grigio medio | `#252830` | Hover states |
| **Border** | Grigio bordo | `#2d3139` | Separatori |

### Colori Semantici

| Ruolo | Colore | Hex | Uso |
|-------|--------|-----|-----|
| **Success** | Verde | `#22c55e` | Conferme, acquisti completati |
| **Warning** | Ambra | `#f59e0b` | Timer 10-5 sec, attenzione |
| **Danger** | Rosso | `#ef4444` | Timer < 5 sec, errori |
| **Info** | Blu chiaro | `#38bdf8` | Informazioni, tooltip |

### Colori Ruoli (Mantieni)

| Ruolo | Colore | Hex | Note |
|-------|--------|-----|------|
| **P** - Portiere | Ambra | `#f59e0b` | Convenzione fantacalcio IT |
| **D** - Difensore | Blu | `#3b82f6` | Convenzione fantacalcio IT |
| **C** - Centrocampista | Verde | `#22c55e` | Convenzione fantacalcio IT |
| **A** - Attaccante | Rosso | `#ef4444` | Convenzione fantacalcio IT |

---

## Task di Implementazione

### Fase 1: Bug Fix e Cleanup (Priorità Critica)

#### Task 1.1: Rimuovere Link Debug
- **File**: `src/components/Navigation.tsx:381-386`
- **Azione**: Eliminare il link "Test Latency" o wrapparlo in condizione `process.env.NODE_ENV === 'development'`
- **Motivazione**: Visibile in produzione, confonde gli utenti
- **Tempo stimato**: 5 minuti

```tsx
// RIMUOVERE:
<a href="/test-latency" className="...">Test Latency</a>

// OPPURE:
{import.meta.env.DEV && (
  <a href="/test-latency" className="...">Test Latency</a>
)}
```

#### Task 1.2: Convertire Inline Styles Menu Mobile
- **File**: `src/components/Navigation.tsx:527-717`
- **Azione**: Sostituire tutti gli `style={{}}` con classi Tailwind equivalenti
- **Motivazione**: Consistenza codebase, manutenibilità, purge CSS corretto
- **Tempo stimato**: 1 ora

```tsx
// DA:
style={{ backgroundColor: '#1a1f2c' }}

// A:
className="bg-surface-300"
```

---

### Fase 2: Mobile-First UX (Priorità Alta)

#### Task 2.1: Touch Targets Minimi 44x44px
- **File**: `src/components/ui/Button.tsx`
- **Azione**: Aumentare padding per size `sm` e `md` su mobile
- **Motivazione**: Standard Apple/Google per accessibilità touch
- **Tempo stimato**: 2 ore

```tsx
const sizes = {
  sm: 'px-4 py-2 text-sm gap-1.5 min-h-[44px] min-w-[44px]',
  md: 'px-5 py-2.5 text-base gap-2 min-h-[48px]',
  lg: 'px-6 py-3 text-lg gap-2.5 min-h-[52px]',
  xl: 'px-8 py-4 text-xl gap-3 min-h-[56px]',
}
```

#### Task 2.2: Bottoni Offerta Rapida Aste
- **File**: `src/pages/AuctionRoom.tsx`
- **Azione**: Aggiungere bottoni "+1", "+5", "+10", "MAX" sopra l'input offerta
- **Motivazione**: Velocizza offerte su mobile, riduce errori di digitazione
- **Tempo stimato**: 3 ore

```tsx
// Nuovo componente
<div className="grid grid-cols-4 gap-2 mb-3">
  <Button onClick={() => setBidAmount(prev => prev + 1)} size="lg">+1</Button>
  <Button onClick={() => setBidAmount(prev => prev + 5)} size="lg">+5</Button>
  <Button onClick={() => setBidAmount(prev => prev + 10)} size="lg">+10</Button>
  <Button
    onClick={() => setBidAmount(membership?.currentBudget || 0)}
    variant="accent"
    size="lg"
  >
    MAX
  </Button>
</div>
```

#### Task 2.3: Timer Asta Sticky su Mobile
- **File**: `src/pages/AuctionRoom.tsx`
- **Azione**: Rendere il timer sempre visibile durante scroll su mobile
- **Motivazione**: Informazione critica sempre accessibile
- **Tempo stimato**: 1 ora

```tsx
// Aggiungere classe sticky
<div className="sticky top-16 z-30 lg:relative lg:top-0">
  {/* Timer component */}
</div>
```

#### Task 2.4: Feedback Aptico
- **File**: `src/pages/AuctionRoom.tsx`, `src/pages/Rubata.tsx`
- **Azione**: Aggiungere vibrazione su eventi chiave
- **Motivazione**: Feedback tattile immediato durante aste frenetiche
- **Tempo stimato**: 30 minuti

```tsx
// Nuovo utility
// src/utils/haptics.ts
export function vibrate(pattern: number | number[] = 50) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

// Patterns suggeriti:
// - Offerta inviata: 50ms
// - Offerta ricevuta: [50, 30, 50]
// - Vittoria asta: [100, 50, 100, 50, 200]
// - Timer warning: 100ms
// - Timer danger: [50, 50, 50]
```

---

### Fase 3: Accessibilità e Contrasto (Priorità Media)

#### Task 3.1: Migliorare Contrasto Testi
- **File**: Tutti i componenti
- **Azione**: Sostituire `text-gray-500` con `text-gray-400` e `text-gray-400` con `text-gray-300` per testi importanti
- **Motivazione**: WCAG AA compliance, leggibilità in esterni
- **Tempo stimato**: 1 ora

```css
/* Regola generale:
   - Testi secondari: minimo text-gray-400 (#9ca3af)
   - Testi informativi: minimo text-gray-300 (#d1d5db)
   - Label form: text-gray-300
   - Placeholder: text-gray-500 ok (non critico)
*/
```

#### Task 3.2: Badge Ruoli Accessibili (Daltonismo)
- **File**: `src/index.css`, componenti badge
- **Azione**: Aggiungere icone o forme distintive oltre al colore
- **Motivazione**: 8% uomini è daltonico, ruoli devono essere distinguibili
- **Tempo stimato**: 2 ore

```tsx
// Aggiungere icone ai badge
const POSITION_ICONS = {
  P: '🧤', // guanto
  D: '🛡️', // scudo
  C: '⚙️', // ingranaggio
  A: '⚡', // fulmine
}

// Oppure forme CSS diverse:
// P: cerchio, D: quadrato, C: esagono, A: triangolo
```

#### Task 3.3: Skeleton Loading Components
- **File**: Nuovo `src/components/ui/Skeleton.tsx`
- **Azione**: Creare componenti skeleton per cards, liste, tabelle
- **Motivazione**: Perceived performance, riduce frustrazione attesa
- **Tempo stimato**: 3 ore

```tsx
// src/components/ui/Skeleton.tsx
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-surface-200 rounded ${className}`}
      aria-hidden="true"
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-surface-200 rounded-xl p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-8 w-full" />
    </div>
  )
}

export function SkeletonPlayerRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  )
}
```

---

### Fase 4: Nuova Palette Colori (Priorità Media)

#### Task 4.1: Aggiornare tailwind.config.js
- **File**: `tailwind.config.js`
- **Azione**: Sostituire palette primary da teal a blu stadio
- **Motivazione**: Identità visiva più calcistica
- **Tempo stimato**: 30 minuti

```javascript
// tailwind.config.js
colors: {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',  // Nuovo primary
    600: '#2563eb',  // Nuovo primary base
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
  // Rinomina vecchio teal come "legacy" per transizione graduale
  legacy: {
    500: '#319795',
    600: '#2c7a7b',
  },
  // Nuovi background più profondi
  dark: {
    50: '#252830',
    100: '#1a1c20',
    200: '#111214',
    300: '#0a0a0b',
    400: '#050506',
    500: '#000000',
  },
}
```

#### Task 4.2: Aggiornare CSS Variables
- **File**: `src/index.css`
- **Azione**: Aggiornare variabili CSS root
- **Tempo stimato**: 15 minuti

```css
:root {
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-dark-50: #252830;
  --color-dark-100: #1a1c20;
  --color-dark-200: #111214;
  --color-dark-300: #0a0a0b;
  --color-surface-50: #2d3139;
  --color-surface-100: #252830;
  --color-surface-200: #1a1c20;
  --color-surface-300: #111214;
}
```

#### Task 4.3: Aggiornare Glow Effects
- **File**: `src/index.css`, `tailwind.config.js`
- **Azione**: Cambiare glow da teal a blu
- **Tempo stimato**: 30 minuti

```css
.btn-primary {
  background: linear-gradient(to right, #3b82f6, #2563eb);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
}

.btn-primary:hover {
  background: linear-gradient(to right, #60a5fa, #3b82f6);
}
```

---

### Fase 5: Miglioramenti UX Avanzati (Priorità Bassa)

#### Task 5.1: Bottom Sheet per Mobile
- **File**: Nuovo `src/components/ui/BottomSheet.tsx`
- **Azione**: Creare componente bottom sheet per sostituire modal su mobile
- **Motivazione**: Pattern mobile-native, più ergonomico
- **Tempo stimato**: 4 ore

```tsx
// Comportamento:
// - Slide up dal basso
// - Drag to dismiss
// - Altezza dinamica con max-height
// - Backdrop blur
```

#### Task 5.2: Sistema Suoni
- **File**: Nuovo `src/utils/sounds.ts`, `src/hooks/useSounds.ts`
- **Azione**: Aggiungere suoni opzionali per eventi asta
- **Motivazione**: Feedback audio durante multitasking
- **Tempo stimato**: 2 ore

```tsx
// src/utils/sounds.ts
const sounds = {
  bid: '/sounds/bid.mp3',
  outbid: '/sounds/outbid.mp3',
  warning: '/sounds/warning.mp3',
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
}

// Hook con localStorage per preferenze utente
export function useSounds() {
  const [enabled, setEnabled] = useLocalStorage('sounds-enabled', true)

  const play = (sound: keyof typeof sounds) => {
    if (enabled) {
      new Audio(sounds[sound]).play()
    }
  }

  return { play, enabled, setEnabled }
}
```

#### Task 5.3: Animazione Confetti Vittoria
- **File**: `src/pages/AuctionRoom.tsx`
- **Azione**: Aggiungere animazione confetti quando si vince un'asta importante
- **Motivazione**: Celebrazione emotiva, engagement
- **Tempo stimato**: 1 ora

```bash
npm install canvas-confetti
```

```tsx
import confetti from 'canvas-confetti'

// Quando vinci asta
if (isUserWinning && auction.status === 'COMPLETED') {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#f59e0b', '#22c55e', '#3b82f6']
  })
}
```

#### Task 5.4: Indicatore Giocatore Corrente Sticky (Rubata)
- **File**: `src/pages/Rubata.tsx`
- **Azione**: Mostrare sempre il giocatore corrente in cima durante scroll board
- **Motivazione**: Contesto sempre visibile
- **Tempo stimato**: 1.5 ore

```tsx
{/* Sticky current player indicator */}
<div className="sticky top-16 z-20 bg-dark-300/95 backdrop-blur-sm border-b border-surface-50/20 p-3">
  <CurrentPlayerCard player={currentPlayer} timer={timerDisplay} />
</div>
```

#### Task 5.5: Slider Durata Contratto
- **File**: `src/pages/Contracts.tsx`
- **Azione**: Sostituire dropdown durata con slider visuale 1-4 anni
- **Motivazione**: Più intuitivo, mostra visivamente l'impegno
- **Tempo stimato**: 2 ore

```tsx
<input
  type="range"
  min="1"
  max="4"
  value={duration}
  onChange={(e) => setDuration(Number(e.target.value))}
  className="w-full accent-primary-500"
/>
<div className="flex justify-between text-xs text-gray-400 mt-1">
  <span>1 anno</span>
  <span>2 anni</span>
  <span>3 anni</span>
  <span>4 anni</span>
</div>
```

---

### Fase 6: Elementi Visivi Calcistici (Priorità Bassa)

#### Task 6.1: Pattern Campo più Visibile
- **File**: `src/index.css`
- **Azione**: Rendere il pitch-overlay più visibile in aree chiave
- **Tempo stimato**: 30 minuti

```css
.pitch-overlay-visible {
  background:
    linear-gradient(90deg, transparent 49%, rgba(34, 197, 94, 0.05) 50%, transparent 51%),
    linear-gradient(0deg, transparent 49%, rgba(34, 197, 94, 0.05) 50%, transparent 51%);
  background-size: 80px 80px;
}
```

#### Task 6.2: Font Sportivo per Numeri
- **File**: `src/index.css`, componenti statistiche
- **Azione**: Usare font condensed/bold per numeri grandi (budget, prezzi, timer)
- **Motivazione**: Estetica sportiva, tabelloni stadio
- **Tempo stimato**: 1 ora

```css
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&display=swap');

.stat-number {
  font-family: 'Oswald', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: -0.02em;
}
```

#### Task 6.3: Card Reveal Stile FIFA
- **File**: Nuovo `src/components/PlayerRevealCard.tsx`
- **Azione**: Animazione "card flip" quando si acquisisce un giocatore
- **Motivazione**: Momento celebrativo, familiarità con FIFA Ultimate Team
- **Tempo stimato**: 3 ore

---

## Riepilogo Tempi Stimati

| Fase | Descrizione | Tempo |
|------|-------------|-------|
| **1** | Bug Fix e Cleanup | 1.5 ore |
| **2** | Mobile-First UX | 6.5 ore |
| **3** | Accessibilità e Contrasto | 6 ore |
| **4** | Nuova Palette Colori | 1.5 ore |
| **5** | Miglioramenti UX Avanzati | 10.5 ore |
| **6** | Elementi Visivi Calcistici | 4.5 ore |
| **TOTALE** | | **~30 ore** |

---

## Ordine di Implementazione Consigliato

1. **Sprint 1 (Critico)**: Task 1.1, 1.2, 2.1, 2.2, 2.3, 2.4
2. **Sprint 2 (Importante)**: Task 3.1, 3.2, 3.3, 4.1, 4.2, 4.3
3. **Sprint 3 (Nice-to-have)**: Task 5.1, 5.2, 5.3, 5.4, 5.5
4. **Sprint 4 (Polish)**: Task 6.1, 6.2, 6.3

---

## Note per il Team

### Testing
- Testare su dispositivi reali (non solo emulatore)
- Verificare contrasti con tool WCAG
- Test con utenti daltonici per badge ruoli
- Test sessioni lunghe (2+ ore) per affaticamento visivo

### Rollback Plan
- Mantenere vecchia palette come `legacy` in Tailwind per transizione graduale
- Feature flag per nuova grafica: `VITE_NEW_THEME=true`

### Assets Necessari
- File audio per suoni (5 file MP3, <50KB ciascuno)
- Font Oswald (Google Fonts, già CDN)

---

*Documento creato: Gennaio 2026*
*Versione: 2.0*
