# Piano Esecutivo — Mobile Browser UI (24 Evolutive)

> Questo file guida una nuova sessione Claude Code per implementare le 24 evolutive mobile browser.
> Leggi TUTTO questo file prima di iniziare qualsiasi sviluppo.

---

## Contesto

E' stata effettuata una review della UX mobile browser (375px) dell'app Fantacontratti. Il risultato:

| Documento | Cosa contiene |
|-----------|---------------|
| `MOBILE_UI_REVIEW_REPORT.md` | Analisi per pagina con punteggi, problemi critici mobile |
| `MOBILE_UI_IMPROVEMENTS_BACKLOG.md` | 24 task con criteri di accettazione, file coinvolti, wireframe |
| `MOBILE_UI_MOCKUPS.html` | Mockup visivi BEFORE/AFTER in phone frames 375px (apri nel browser) |

Le issue GitHub vanno create nel progetto **EVOLUTIVE** nella colonna **Backlog** con label `2.x-mobile` + `enhancement`.

---

## Regole Operative

### Workflow Git (da CLAUDE.md)
```
1. git checkout develop && git pull origin develop
2. git checkout -b feature/2.x-mobile-sprint-N
3. Implementare i task dello sprint
4. Commit con riferimento issue: "feat: descrizione (#numero)"
5. Push e PR verso develop
6. Spostare issue in Done su progetto EVOLUTIVE
```

### Convenzioni
- Branch: `feature/2.x-mobile-sprint-M1`, `feature/2.x-mobile-sprint-M2`, etc.
- Commit: `feat:` per nuove feature, `style:` per CSS/layout, `fix:` per bug
- Label issue: `2.x-mobile` + `enhancement`
- Ogni PR va verso `develop`, MAI verso `main`

### Regole di Sviluppo
- Focus ESCLUSIVO su viewport < 768px — NON modificare layout desktop
- Usare `md:` / `lg:` prefix per preservare stili desktop
- Touch target minimo: 44x44px
- Safe area: usare `env(safe-area-inset-bottom)` dove necessario
- Testare su Chrome DevTools: iPhone SE (375px), iPhone 12 (390px), Samsung Galaxy S20 (360px)
- NON installare dipendenze senza conferma esplicita dell'utente
- NON cambiare logica di business — solo UI/UX/layout

### Prima di ogni Sprint
1. Leggere la sezione del task in `MOBILE_UI_IMPROVEMENTS_BACKLOG.md` per i dettagli
2. Aprire `MOBILE_UI_MOCKUPS.html` nel browser per il mockup visivo
3. Creare le issue GitHub con label `2.x-mobile` + `enhancement`
4. Spostare issue da Backlog → In Progress nel progetto EVOLUTIVE

---

## Mappa Task

| Task | Titolo | Priorita | Sforzo | Sprint |
|------|--------|----------|--------|--------|
| MOB-001 | Bottom Navigation Bar | Critica | M | M2 |
| MOB-002 | Profilo accessibile mobile | Critica | S | M1 |
| MOB-003 | PWA Manifest + Theme Color | Critica | S | M1 |
| MOB-004 | Ridurre padding mobile | Critica | S | M1 |
| MOB-005 | Card view tabelle mobile | Critica | L | M3 |
| MOB-006 | Trades layout mobile | Critica | M | M3 |
| MOB-007 | Touch targets 44px | Alta | M | M3 |
| MOB-008 | Pull-to-refresh | Alta | M | M4 |
| MOB-009 | Sticky action buttons | Alta | S | M2 |
| MOB-010 | Hamburger piu grande | Alta | XS | M1 |
| MOB-011 | Filtri in BottomSheet | Alta | M | M2 |
| MOB-012 | Swipe gesture tabs | Alta | M | M4 |
| MOB-013 | Service Worker offline | Media | L | M4 |
| MOB-014 | Input keyboard mobile | Media | S | M1 |
| MOB-015 | Contratti BottomSheet | Media | M | M3 |
| MOB-016 | Push notifications | Media | XL | Backlog |
| MOB-017 | Web Share API | Media | S | Backlog |
| MOB-018 | Scroll-to-top | Media | XS | M1 |
| MOB-019 | Swipe-to-dismiss modali | Media | S | M4 |
| MOB-020 | Landscape hint grafici | Bassa | XS | M1 |
| MOB-021 | Dark/light toggle rapido | Bassa | XS | M1 |
| MOB-022 | Vibrazione feedback esteso | Bassa | S | M3 |
| MOB-023 | Font-size responsive | Bassa | S | M1 |
| MOB-024 | Camera profilo | Bassa | XS | M1 |

---

## SPRINT M1 — Quick Wins (~1 settimana, 10 task)

### Setup
```bash
git checkout develop
git pull origin develop
git checkout -b feature/2.x-mobile-sprint-M1
```

### Prima: Creare le issue GitHub
```bash
# Creare issue per ogni task MOB-xxx con label 2.x-mobile + enhancement
# Aggiungere al progetto EVOLUTIVE → Backlog
# Spostare in In Progress
```

### Ordine di Implementazione

Tutti indipendenti, parallelizzabili.

---

#### M1.1 — MOB-003: PWA Manifest + Theme Color (S, 1-3h)

**File da creare:** `public/manifest.json`, `public/icons/` (icone)
**File da modificare:** `index.html`

**Cosa fare:**
1. Creare `public/manifest.json`:
```json
{
  "name": "Fantacontratti",
  "short_name": "FC",
  "description": "Gestione lega fantacalcio dynasty",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0b",
  "theme_color": "#0a0a0b",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```
2. In `index.html` aggiungere nel `<head>`:
```html
<meta name="theme-color" content="#0a0a0b">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
```
3. Per le icone: usare il logo dell'app o generare un'icona semplice con le iniziali "FC" su sfondo #0a0a0b con testo #3b82f6

**Criteri di accettazione:**
- [ ] manifest.json valido
- [ ] Theme color integrato con browser chrome scuro
- [ ] App installabile su Android/iOS
- [ ] Icone visibili su home screen

---

#### M1.2 — MOB-004: Ridurre padding mobile (S, 1-3h)

**File:** Tutte le pagine con padding eccessivo

**Cosa fare:**
1. Cercare nel codebase (grep) occorrenze di `p-8`, `px-6`, `p-16`, `py-10` usate senza breakpoint responsive
2. Sostituire con pattern responsive:
```
p-8       → p-4 sm:p-6 md:p-8
px-6      → px-3 sm:px-4 md:px-6
p-16      → p-6 sm:p-10 md:p-16
py-10     → py-6 sm:py-8 md:py-10
gap-6     → gap-3 sm:gap-4 md:gap-6
```
3. Verificare che il layout desktop non cambi (breakpoint md/lg invariati)

**Criteri di accettazione:**
- [ ] Nessun padding > p-4 (16px) su viewport < 640px
- [ ] Contenuto ≥ 343px su schermo 375px
- [ ] Layout desktop invariato

---

#### M1.3 — MOB-002: Profilo accessibile mobile (S, 1-3h)

**File:** `src/components/Navigation.tsx`

**Cosa fare:**
1. Nel menu mobile slide-in, aggiungere in cima (prima delle voci di navigazione):
```tsx
{/* Profile card - mobile */}
<div className="p-4 border-b border-surface-50/20">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
      {user?.name?.[0] || 'U'}
    </div>
    <div>
      <div className="font-semibold text-sm">{user?.name}</div>
      <div className="text-xs text-gray-400">{user?.email}</div>
    </div>
  </div>
</div>
```
2. Aggiungere link "Profilo" nelle voci di navigazione mobile
3. Aggiungere bottone "Logout" in fondo al menu mobile:
```tsx
<button onClick={handleLogout} className="w-full px-4 py-3 text-left text-red-400 border-t border-surface-50/20 text-sm">
  Esci
</button>
```

**Criteri di accettazione:**
- [ ] Card profilo visibile in cima al menu mobile
- [ ] Link "Profilo" navigabile
- [ ] Bottone "Esci" in fondo al menu
- [ ] Funziona su < 640px

---

#### M1.4 — MOB-010: Hamburger piu grande (XS, <1h)

**File:** `src/components/Navigation.tsx`

**Cosa fare:**
1. Trovare il bottone hamburger menu
2. Cambiare dimensioni da 32px a 44px:
```tsx
<button
  onClick={toggleMenu}
  className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-50/20 transition-colors"
  aria-label="Apri menu navigazione"
>
  <svg className="w-6 h-6" ...>
```
3. Aggiungere `aria-label`

**Criteri di accettazione:**
- [ ] Area touch >= 44x44px
- [ ] aria-label presente
- [ ] Visivamente bilanciato

---

#### M1.5 — MOB-014: Input keyboard mobile (S, 1-3h)

**File:** Tutti i componenti con `<input>`

**Cosa fare:**
1. Cercare tutti i `<input>` nel codebase
2. Per campi numerici (salario, prezzo, budget, crediti):
   - Aggiungere `inputMode="numeric"` (NON `type="number"` che ha problemi su mobile)
3. Per campi email:
   - Verificare `type="email"` e aggiungere `inputMode="email"`
4. Per campi di ricerca:
   - Aggiungere `inputMode="search"` e `enterKeyHint="search"`
5. Per form sequenziali:
   - Aggiungere `enterKeyHint="next"` sui campi intermedi
   - Aggiungere `enterKeyHint="done"` sull'ultimo campo
6. Aggiungere `autocomplete` dove appropriato:
   - Email: `autocomplete="email"`
   - Password: `autocomplete="current-password"` o `autocomplete="new-password"`
   - Nome: `autocomplete="name"`

**Criteri di accettazione:**
- [ ] Campi numerici aprono tastierino numerico
- [ ] Campi email mostrano @ nella keyboard
- [ ] enterKeyHint guida navigazione tra campi
- [ ] autocomplete abilitato

---

#### M1.6 — MOB-023: Font-size responsive (S, 1-3h)

**File:** Tutte le pagine con titoli grandi

**Cosa fare:**
1. Cercare `text-3xl`, `text-4xl`, `text-5xl` senza breakpoint responsive
2. Sostituire con:
```
text-4xl  → text-2xl sm:text-3xl md:text-4xl
text-3xl  → text-xl sm:text-2xl md:text-3xl
text-5xl  → text-3xl sm:text-4xl md:text-5xl
```
3. Verificare che i titoli non wrappino su 3+ righe su 375px

**Criteri di accettazione:**
- [ ] Titoli leggibili su 375px senza wrapping eccessivo
- [ ] Desktop invariato

---

#### M1.7 — MOB-018: Scroll-to-top (XS, <1h)

**File da creare:** `src/components/ScrollToTop.tsx`

**Cosa fare:**
```tsx
export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-20 right-4 w-11 h-11 rounded-full bg-primary-500 text-white
                 shadow-glow flex items-center justify-center z-40 md:hidden"
      aria-label="Torna in cima"
    >
      ↑
    </button>
  )
}
```
- `bottom-20` per stare sopra la bottom nav bar (quando verra aggiunta in M2)
- `md:hidden` per mostrare solo su mobile
- Aggiungere in `App.tsx` o nelle pagine con liste lunghe

**Criteri di accettazione:**
- [ ] Appare dopo 500px di scroll
- [ ] Smooth scroll to top
- [ ] Sopra la bottom nav bar
- [ ] Solo su mobile

---

#### M1.8 — MOB-020: Landscape hint grafici (XS, <1h)

**File:** `src/pages/LeagueFinancials.tsx`, `src/pages/PlayerStats.tsx`

**Cosa fare:**
Sopra i grafici, aggiungere su mobile:
```tsx
<div className="text-xs text-gray-400 text-center py-2 md:hidden">
  📱 Ruota il dispositivo per una vista migliore
</div>
```

**Criteri di accettazione:**
- [ ] Hint visibile su mobile sopra i grafici
- [ ] Nascosto su desktop

---

#### M1.9 — MOB-021: Dark/light toggle rapido (XS, <1h)

**File:** `src/components/Navigation.tsx`

**Cosa fare:**
Nell'header mobile, accanto al bell e prima dell'hamburger, aggiungere icona toggle tema:
```tsx
<button
  onClick={() => toggleTheme()}
  className="w-11 h-11 flex items-center justify-center rounded-lg md:hidden"
  aria-label="Cambia tema"
>
  {isDark ? '☀️' : '🌙'}
</button>
```

**Criteri di accettazione:**
- [ ] Toggle visibile su mobile nell'header
- [ ] Cambia tema con 1 tap
- [ ] Nascosto su desktop (dove c'e' il selettore completo)

---

#### M1.10 — MOB-024: Camera profilo (XS, <1h)

**File:** `src/pages/Profile.tsx`

**Cosa fare:**
Trovare l'`<input type="file">` per upload foto e aggiungere:
```tsx
<input
  type="file"
  accept="image/*"
  capture="user"  // Apre camera frontale su mobile
  onChange={handlePhotoUpload}
/>
```

**Criteri di accettazione:**
- [ ] Tap su foto profilo apre camera frontale su mobile
- [ ] Su desktop: file picker normale

---

### Chiusura Sprint M1

```bash
npm run build
# Commit per task con riferimento issue
git push origin feature/2.x-mobile-sprint-M1
gh pr create --title "feat: Mobile Sprint M1 - Quick Wins" \
  --body "## Mobile Browser Improvements - Sprint M1
- PWA Manifest + theme-color
- Padding responsive mobile
- Profilo accessibile da menu mobile
- Hamburger 44px
- Input keyboard mobile
- Font-size responsive
- Scroll-to-top
- Landscape hint grafici
- Dark/light toggle rapido
- Camera profilo" --base develop
```

---

## SPRINT M2 — Navigazione (~1 settimana, 4 task)

### Setup
```bash
git checkout develop && git pull origin develop
git checkout -b feature/2.x-mobile-sprint-M2
```

### Ordine di Implementazione
```
MOB-001 Bottom Nav Bar ──→ MOB-009 Sticky Action Buttons (posizionamento sopra bottom nav)
MOB-011 Filtri BottomSheet (indipendente)
MOB-021 gia fatto in M1
```

---

#### M2.1 — MOB-001: Bottom Navigation Bar (M, 3-8h) ⚠️ FONDAMENTALE

**File da creare:** `src/components/BottomNavBar.tsx`
**File da modificare:** `src/App.tsx`, `src/index.css`

**Cosa fare:**
1. Creare il componente:
```tsx
const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: '🏠', path: '/dashboard' },
  { id: 'auction', label: 'Asta', icon: '⚡', path: '/auction', liveBadge: true },
  { id: 'roster', label: 'Rosa', icon: '👥', path: '/roster' },
  { id: 'finance', label: 'Finanze', icon: '💰', path: '/financials' },
  { id: 'menu', label: 'Menu', icon: '☰', isMenu: true },
]
```
2. Renderizzare come barra fissa in basso:
```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-surface-300 border-t border-surface-50/20
                md:hidden z-50"
     style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
  <div className="flex justify-around items-center h-14">
    {NAV_ITEMS.map(item => (
      <button key={item.id} className="flex flex-col items-center gap-0.5 py-1 px-2 min-w-[56px]">
        <span className="text-lg">{item.icon}</span>
        <span className="text-[10px]">{item.label}</span>
      </button>
    ))}
  </div>
</nav>
```
3. Tab "Menu" apre il menu slide-in esistente (NON navigare, solo toggle menu)
4. Tab "Asta" mostra badge LIVE se c'e' sessione attiva (dal contesto Pusher)
5. I path devono essere relativi alla lega corrente se l'utente e' in una lega
6. In `App.tsx`: aggiungere `<BottomNavBar />` dentro il layout
7. In `src/index.css`: aggiungere padding-bottom alle pagine su mobile:
```css
@media (max-width: 767px) {
  main { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }
}
```
8. **Auto-hide on scroll down, show on scroll up** (pattern Instagram/Twitter)

**Criteri di accettazione:**
- [ ] Barra 5 tab visibile solo su < 768px
- [ ] Tab attivo evidenziato primary
- [ ] Badge LIVE su tab Asta
- [ ] Menu tab apre slide-in
- [ ] safe-area-inset-bottom
- [ ] Hide on scroll down, show on scroll up
- [ ] Contenuto non coperto dalla barra

---

#### M2.2 — MOB-009: Sticky Action Buttons (S, 1-3h)

**File da creare:** `src/components/StickyActionBar.tsx`
**File da modificare:** `src/pages/Contracts.tsx`, `src/pages/Trades.tsx`, `src/pages/AdminPanel.tsx`

**Cosa fare:**
```tsx
interface StickyActionBarProps {
  onCancel?: () => void
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
  disabled?: boolean
}

export function StickyActionBar({ onCancel, onConfirm, confirmLabel = 'Salva', cancelLabel = 'Annulla', disabled }: StickyActionBarProps) {
  return (
    <div className="fixed bottom-14 left-0 right-0 bg-surface-300/95 backdrop-blur-sm
                    border-t border-surface-50/20 p-3 flex gap-3 md:hidden z-40"
         style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>
      {onCancel && (
        <button onClick={onCancel} className="flex-1 btn btn-outline">{cancelLabel}</button>
      )}
      <button onClick={onConfirm} disabled={disabled} className="flex-1 btn btn-primary">{confirmLabel}</button>
    </div>
  )
}
```
- `bottom: calc(56px + safe-area)` per stare sopra la bottom nav bar
- Backdrop blur per leggibilita

**Criteri di accettazione:**
- [ ] Sticky sopra bottom nav bar
- [ ] Solo su mobile
- [ ] Bottoni 44px height

---

#### M2.3 — MOB-011: Filtri in BottomSheet (M, 3-8h)

**File da modificare:** `src/pages/AllPlayers.tsx`, `src/pages/Rose.tsx`, `src/pages/Movements.tsx`, `src/pages/PlayerStats.tsx`
**File da usare:** `src/components/ui/BottomSheet.tsx`

**Cosa fare:**
1. Su mobile, collassare i filtri in un unico bottone "Filtri":
```tsx
<div className="flex gap-2 items-center md:hidden">
  <input placeholder="Cerca..." className="flex-1 input input-dark text-sm" />
  <button onClick={() => setFiltersOpen(true)} className="btn btn-sm btn-outline whitespace-nowrap">
    Filtri {activeFilterCount > 0 && `(${activeFilterCount})`}
  </button>
</div>
```
2. BottomSheet con tutti i filtri organizzati:
```tsx
<BottomSheet isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtri">
  <div className="space-y-4 p-4">
    <div>
      <label className="text-xs text-gray-400 mb-2 block">Posizione</label>
      <div className="flex gap-2">
        {['P', 'D', 'C', 'A'].map(pos => (
          <button key={pos} className={`pos-badge pos-${pos} w-11 h-11 text-sm`}>
            {pos}
          </button>
        ))}
      </div>
    </div>
    <div>
      <label className="text-xs text-gray-400 mb-2 block">Squadra</label>
      <select className="input input-dark w-full">...</select>
    </div>
    <button onClick={applyFilters} className="btn btn-primary w-full mt-4">Applica Filtri</button>
  </div>
</BottomSheet>
```
3. Su desktop (md+): filtri inline invariati

**Criteri di accettazione:**
- [ ] Mobile: filtri in BottomSheet
- [ ] Contatore filtri attivi
- [ ] Desktop: filtri inline invariati
- [ ] Ricerca sempre visibile

---

### Chiusura Sprint M2

```bash
npm run build
git push origin feature/2.x-mobile-sprint-M2
gh pr create --title "feat: Mobile Sprint M2 - Navigation" \
  --body "## Mobile Browser Improvements - Sprint M2
- Bottom Navigation Bar
- Sticky Action Buttons
- Filtri in BottomSheet" --base develop
```

---

## SPRINT M3 — Interazioni (~2 settimane, 5 task)

### Setup
```bash
git checkout develop && git pull origin develop
git checkout -b feature/2.x-mobile-sprint-M3
```

### Ordine
```
MOB-005 Card view tabelle (L) — fondamentale, dipende opzionalmente da DataTable web
MOB-006 Trades layout (M) — indipendente
MOB-015 Contratti BottomSheet (M) — indipendente
MOB-007 Touch targets (M) — indipendente
MOB-022 Haptic feedback (S) — indipendente
```

---

#### M3.1 — MOB-005: Card view tabelle mobile (L, 1-2gg)

**File da modificare:** `src/pages/Rose.tsx`, `src/pages/Movements.tsx`, `src/pages/LeagueFinancials.tsx`, `src/pages/Contracts.tsx`

**Cosa fare:**
1. Se il componente `DataTable` (TASK-001 web) e' gia disponibile: adottarlo con `renderMobileCard`
2. Se non e' disponibile, implementare pattern card locale per ogni pagina:
```tsx
{/* Mobile */}
<div className="md:hidden space-y-3">
  {players.map(player => (
    <div key={player.id} className="bg-surface-100 rounded-lg border border-surface-50/20 p-3">
      <div className="flex items-center gap-3">
        <PositionBadge position={player.position} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{player.name}</div>
          <div className="text-xs text-gray-400">{player.team}</div>
        </div>
        <div className="text-sm font-bold text-accent-400 font-oswald">{player.salary}M</div>
      </div>
      <button onClick={() => toggleExpand(player.id)} className="text-xs text-primary-400 mt-2">
        {expanded === player.id ? '▲ Comprimi' : '▼ Dettagli'}
      </button>
      {expanded === player.id && (
        <div className="mt-2 pt-2 border-t border-surface-50/20 grid grid-cols-2 gap-2 text-xs text-gray-400">
          <div>Presenze: <span className="text-white font-oswald">{player.appearances}</span></div>
          <div>Gol: <span className="text-white font-oswald">{player.goals}</span></div>
          <div>Assist: <span className="text-white font-oswald">{player.assists}</span></div>
          <div>Rating: <span className="text-white font-oswald">{player.rating}</span></div>
          <div>Durata: <span className="text-white">{player.contractDuration}a</span></div>
          <div>Clausola: <span className="text-white font-oswald">{player.clause}M</span></div>
        </div>
      )}
    </div>
  ))}
</div>

{/* Desktop */}
<div className="hidden md:block">
  <table>... tabella originale invariata ...</table>
</div>
```

**Criteri di accettazione:**
- [ ] Mobile: card espandibili con tutti i dati
- [ ] Desktop: tabella invariata
- [ ] Sorting funziona su entrambe le viste
- [ ] Almeno 4 pagine convertite

---

#### M3.2 — MOB-006: Trades layout mobile (M, 3-8h)

**File:** `src/pages/Trades.tsx`

**Cosa fare:**
Su mobile, convertire da side-by-side a tab-switch:
```tsx
const [tradeTab, setTradeTab] = useState<'offer' | 'request'>('offer')

{/* Mobile */}
<div className="md:hidden">
  <div className="flex bg-surface-300 rounded-lg p-1 mb-4">
    <button onClick={() => setTradeTab('offer')}
      className={`flex-1 py-2 text-sm rounded-md ${tradeTab === 'offer' ? 'bg-primary-500 text-white' : 'text-gray-400'}`}>
      Cosa Offri ({offeredPlayers.length})
    </button>
    <button onClick={() => setTradeTab('request')}
      className={`flex-1 py-2 text-sm rounded-md ${tradeTab === 'request' ? 'bg-primary-500 text-white' : 'text-gray-400'}`}>
      Cosa Chiedi ({requestedPlayers.length})
    </button>
  </div>
  {tradeTab === 'offer' ? <OfferPanel /> : <RequestPanel />}
</div>

{/* Desktop */}
<div className="hidden md:grid md:grid-cols-2 md:gap-6">
  <OfferPanel />
  <RequestPanel />
</div>
```

**Criteri di accettazione:**
- [ ] Mobile: tab switch offri/chiedi
- [ ] Desktop: side-by-side invariato
- [ ] Riepilogo prima di conferma

---

#### M3.3 — MOB-015: Contratti BottomSheet (M, 3-8h)

**File:** `src/pages/Contracts.tsx`
**Usare:** BottomSheet, DurationSlider, NumberStepper

**Cosa fare:**
Su mobile, tap su riga contratto apre BottomSheet con form editing.
(Corrisponde a TASK-017 del backlog web — implementazione identica.)

---

#### M3.4 — MOB-007: Touch targets 44px (M, 3-8h)

**File:** Multipli — audit necessario

**Cosa fare:**
1. Grep per bottoni con dimensioni piccole: `w-6 h-6`, `w-5 h-5`, `p-1`
2. Per ogni bottone trovato su mobile, assicurarsi che l'area touch sia >= 44x44px:
   - Aggiungere `min-w-[44px] min-h-[44px]` o padding sufficiente
   - Usare `className="... md:p-1 p-2.5"` per aumentare solo su mobile
3. Verificare spaziatura tra target adiacenti (>= 8px gap)

**Criteri di accettazione:**
- [ ] Tutti i target >= 44x44px su mobile
- [ ] Spaziatura >= 8px tra target adiacenti
- [ ] Desktop invariato

---

#### M3.5 — MOB-022: Haptic feedback esteso (S, 1-3h)

**File:** `src/utils/haptics.ts`, pagine interessate

**Cosa fare:**
Aggiungere pattern e usarli:
```typescript
// Nuovi pattern
save: [50, 30, 100],     // Salvataggio confermato
send: [50, 50],           // Invio scambio
approve: [50, 30, 100],   // Approvazione
reject: [50, 30, 50, 30, 50], // Rifiuto
```
Usare in: Contracts (save), Trades (send), AdminPanel (approve/reject)

---

### Chiusura Sprint M3

```bash
npm run build
git push origin feature/2.x-mobile-sprint-M3
gh pr create --title "feat: Mobile Sprint M3 - Interazioni" \
  --body "## Mobile Browser Improvements - Sprint M3
- Card view per tabelle su mobile
- Trades tab-switch layout
- Contratti editing BottomSheet
- Touch targets 44px
- Haptic feedback esteso" --base develop
```

---

## SPRINT M4 — Power Features (~2 settimane, 5 task)

### Setup
```bash
git checkout develop && git pull origin develop
git checkout -b feature/2.x-mobile-sprint-M4
```

### Task
```
MOB-008 Pull-to-refresh (M)
MOB-012 Swipe gesture tabs (M)
MOB-013 Service Worker offline (L)
MOB-019 Swipe-to-dismiss modali (S)
MOB-020 gia fatto in M1
```

---

#### M4.1 — MOB-008: Pull-to-refresh (M, 3-8h)

**File da creare:** `src/hooks/usePullToRefresh.ts`, `src/components/PullToRefresh.tsx`

**Cosa fare:**
1. Hook che ascolta touch events:
   - touchstart: salva posizione Y iniziale
   - touchmove: se scroll e' a 0 e delta Y > 80px, attivare refresh
   - touchend: eseguire refresh callback
2. Componente wrapper che mostra spinner durante il pull
3. Usare nelle pagine con dati live

---

#### M4.2 — MOB-012: Swipe gesture tabs (M, 3-8h)

**File da creare:** `src/hooks/useSwipeGesture.ts`

**Cosa fare:**
1. Hook generico per swipe orizzontale:
```typescript
function useSwipeGesture(onSwipeLeft: () => void, onSwipeRight: () => void, threshold = 50)
```
2. Usare in AdminPanel e LeagueDetail per navigare tra tab

---

#### M4.3 — MOB-013: Service Worker offline (L, 1-2gg)

**⚠️ RICHIEDE:** `npm install vite-plugin-pwa` — CHIEDERE CONFERMA

**File da modificare:** `vite.config.ts`, `index.html`
**File da creare:** `src/pages/Offline.tsx`

**Cosa fare:**
1. Installare `vite-plugin-pwa` (Workbox-based)
2. Configurare in `vite.config.ts`:
```typescript
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts/, handler: 'CacheFirst' },
          { urlPattern: /\/api\//, handler: 'NetworkFirst' },
        ]
      }
    })
  ]
})
```
3. Creare pagina offline user-friendly

---

#### M4.4 — MOB-019: Swipe-to-dismiss modali (S, 1-3h)

**File:** `src/components/ui/Modal.tsx`

**Cosa fare:**
Aggiungere supporto swipe-down come gia presente in BottomSheet.

---

### Chiusura Sprint M4

```bash
npm run build
git push origin feature/2.x-mobile-sprint-M4
gh pr create --title "feat: Mobile Sprint M4 - Power Features" \
  --body "## Mobile Browser Improvements - Sprint M4
- Pull-to-refresh
- Swipe gesture tabs
- Service Worker offline
- Swipe-to-dismiss modali" --base develop
```

---

## Dipendenze npm (riepilogo)

| Sprint | Pacchetto | Task | Note |
|--------|-----------|------|------|
| M4 | `vite-plugin-pwa` | MOB-013 | Per service worker e offline |

---

## Task in Backlog (non schedulati)

| Task | Titolo | Sforzo | Note |
|------|--------|--------|------|
| MOB-016 | Push Notifications | XL | Richiede backend API |
| MOB-017 | Web Share API | S | Implementabile in qualsiasi momento |

---

## Interazione con Backlog Web (UI Sprint Plan)

Alcuni task mobile si sovrappongono con il backlog web:

| Task Mobile | Task Web | Nota |
|-------------|----------|------|
| MOB-005 (card tabelle) | TASK-001 (DataTable) | Se DataTable web e' implementato, riusarlo |
| MOB-015 (contratti BottomSheet) | TASK-017 (BottomSheet contratti) | Implementazione identica |
| MOB-011 (filtri BottomSheet) | — | Solo mobile, non ha corrispettivo web |
| MOB-001 (bottom nav) | — | Solo mobile, non ha corrispettivo web |

**Consiglio:** Implementare prima gli Sprint Web 1-2 (che includono DataTable e altri fondamenti), poi gli Sprint Mobile.

---

## Riferimenti

| File | Descrizione |
|------|-------------|
| `MOBILE_UI_REVIEW_REPORT.md` | Analisi mobile per pagina con punteggi |
| `MOBILE_UI_IMPROVEMENTS_BACKLOG.md` | Dettagli di ogni task mobile |
| `MOBILE_UI_MOCKUPS.html` | Mockup visivi BEFORE/AFTER in phone frames 375px |
| `UI_SPRINT_PLAN.md` | Piano sprint web (per sinergie) |
| `CLAUDE.md` | Workflow Git, credenziali, comandi |
| `src/components/ui/BottomSheet.tsx` | Componente BottomSheet (gia production-ready) |
| `src/utils/haptics.ts` | Vibration API wrapper con 9 pattern |
| `src/components/Navigation.tsx` | Navigazione con menu mobile slide-in |
| `src/index.css` | CSS con bid-controls-sticky e safe-area support |

---

## Prompt Consigliati per Ogni Sprint

### Sprint M1
> Leggi `MOBILE_UI_SPRINT_PLAN.md` sezione SPRINT M1. Crea branch `feature/2.x-mobile-sprint-M1` da develop. Crea le issue GitHub con label `2.x-mobile,enhancement`. Implementa tutti i 10 task quick wins nell'ordine. Commit separati per task. Verifica build e crea PR verso develop.

### Sprint M2
> Leggi `MOBILE_UI_SPRINT_PLAN.md` sezione SPRINT M2. Crea branch `feature/2.x-mobile-sprint-M2` da develop. INIZIA da MOB-001 (Bottom Nav Bar) — e' fondamentale. Poi MOB-009 (Sticky Actions, dipende dalla bottom nav). Poi MOB-011 (Filtri BottomSheet).

### Sprint M3
> Leggi `MOBILE_UI_SPRINT_PLAN.md` sezione SPRINT M3. Crea branch `feature/2.x-mobile-sprint-M3` da develop. Fai MOB-005 (card tabelle) per primo. Poi gli altri 4 in parallelo.

### Sprint M4
> Leggi `MOBILE_UI_SPRINT_PLAN.md` sezione SPRINT M4. Crea branch `feature/2.x-mobile-sprint-M4` da develop. Per vite-plugin-pwa chiedi conferma prima di installare.
