# Piano Esecutivo — UI Improvements (28 Evolutive)

> Questo file guida una nuova sessione Claude Code per implementare tutte le 28 evolutive UI.
> Leggi TUTTO questo file prima di iniziare qualsiasi sviluppo.

---

## Contesto

E' stata effettuata una review completa della UI dell'app Fantacontratti. Il risultato:

| Documento | Cosa contiene |
|-----------|---------------|
| `UI_REVIEW_REPORT.md` | Analisi per pagina con punteggi, problemi, proposte |
| `UI_IMPROVEMENTS_BACKLOG.md` | 28 task con criteri di accettazione, file coinvolti, wireframe ASCII |
| `UI_REVIEW_REPORT_MOCKUPS.html` | Mockup visivi BEFORE/AFTER per i pattern trovati (apri nel browser) |
| `UI_IMPROVEMENTS_BACKLOG_MOCKUPS.html` | Mockup visivi BEFORE/AFTER per ogni task (apri nel browser) |

Le 28 GitHub issues sono gia create nel progetto **EVOLUTIVE** nella colonna **Backlog**.

---

## Regole Operative

### Workflow Git (da CLAUDE.md)
```
1. git checkout develop && git pull origin develop
2. git checkout -b feature/1.x-ui-sprint-N
3. Implementare i task del sprint
4. Commit con riferimento issue: "feat: descrizione (#numero)"
5. Push e PR verso develop
6. Spostare issue in Done su progetto EVOLUTIVE
```

### Convenzioni
- Branch: `feature/1.x-ui-sprint-1`, `feature/1.x-ui-sprint-2`, etc.
- Commit: `feat:` per nuove feature, `refactor:` per splitting, `style:` per a11y/CSS
- Label issue: `1.x-web` + `enhancement` (gia applicate)
- Ogni PR va verso `develop`, MAI verso `main`

### Prima di ogni Sprint
1. Leggere la sezione del task in `UI_IMPROVEMENTS_BACKLOG.md` per i dettagli completi
2. Aprire `UI_IMPROVEMENTS_BACKLOG_MOCKUPS.html` nel browser per il mockup visivo
3. Leggere la issue GitHub corrispondente per i criteri di accettazione
4. Spostare le issue da Backlog → In Progress nel progetto EVOLUTIVE

### Dopo ogni Sprint
1. Verificare `npm run build` passa senza errori
2. Verificare che i test esistenti non si rompano: `npm test`
3. Spostare issue in Done
4. Creare PR verso develop

### Regole di Sviluppo
- NON installare dipendenze senza conferma esplicita dell'utente
- NON modificare file non elencati nei "File coinvolti" del task
- NON cambiare logica di business — solo UI/UX/layout/accessibilita
- Mantenere retrocompatibilita: tutti i dati e le API restano identici
- Testare su mobile (375px), tablet (768px), desktop (1280px+)
- Rispettare il design system esistente (colori, font, spacing da `src/index.css` e `tailwind.config.js`)

---

## Mappa Issue GitHub

| Issue | Task | Titolo | Priorita | Sforzo | Sprint |
|-------|------|--------|----------|--------|--------|
| #292 | TASK-010 | Banner fasi con affordance chiara | Alta | XS | 1 |
| #295 | TASK-013 | Legenda colori durata contratto | Media | XS | 1 |
| #293 | TASK-011 | Skeleton loader dove disponibile | Media | S | 1 |
| #294 | TASK-012 | EmptyState standardizzato | Media | S | 1 |
| #287 | TASK-005 | Alternativa tastiera DnD Rubata | Critica | S | 1 |
| #290 | TASK-008 | Timer accessibility (non solo colore) | Alta | S | 1 |
| #304 | TASK-022 | aria-label pulsanti icon-only | Bassa | S | 1 |
| #305 | TASK-023 | scope e aria-sort tabelle | Bassa | S | 1 |
| #283 | TASK-001 | DataTable responsivo riutilizzabile | Critica | L | 2 |
| #289 | TASK-007 | Icone SVG → lucide-react | Alta | M | 2 |
| #286 | TASK-004 | Movements leggibile su mobile | Critica | M | 2 |
| #297 | TASK-015 | Tooltip status contratto | Media | S | 2 |
| #284 | TASK-002 | AdminPanel 8 tab mobile + splitting | Critica | L | 3 |
| #288 | TASK-006 | Splitting Rubata.tsx 2000+ righe | Alta | XL | 3 |
| #291 | TASK-009 | Adottare recharts | Alta | L | 3 |
| #296 | TASK-014 | Stepper visivo Rubata | Media | M | 3 |
| #285 | TASK-003 | Consolidare layout asta 6 → 3 | Critica | XL | 4 |
| #298 | TASK-016 | Virtualizzazione liste lunghe | Media | M | 4 |
| #299 | TASK-017 | BottomSheet contratti mobile | Media | M | 4 |
| #302 | TASK-020 | Full-page comparison PlayerStats | Bassa | M | 4 |
| #300 | TASK-018 | Sidebar Rosa collassabile | Bassa | S | Backlog |
| #301 | TASK-019 | Filtro data/periodo Movements | Bassa | S | Backlog |
| #303 | TASK-021 | Raggruppare colonne PlayerStats | Bassa | S | Backlog |
| #306 | TASK-030 | Command Palette (Ctrl+K) | Futura | L | Backlog |
| #307 | TASK-031 | Dashboard widget DnD | Futura | XL | Backlog |
| #308 | TASK-032 | Keyboard shortcuts asta | Futura | M | Backlog |
| #309 | TASK-033 | Alert configurabili manager | Futura | XL | Backlog |
| #310 | TASK-034 | Sparkline inline tabelle | Futura | M | Backlog |

---

## SPRINT 1 — Quick Wins (~1 settimana, ~8 task)

### Setup
```bash
git checkout develop
git pull origin develop
git checkout -b feature/1.x-ui-sprint-1
```

### Gestione Issue
Spostare nel progetto EVOLUTIVE da Backlog → In Progress:
Issues: #292, #295, #293, #294, #287, #290, #304, #305

### Ordine di Implementazione

I task sono tutti indipendenti. Implementali in quest'ordine per massimizzare parallelismo e minimizzare conflitti:

---

#### 1.1 — #292 TASK-010: Banner fasi con affordance (XS, <1h)

**File:** `src/pages/LeagueDetail.tsx`

**Cosa fare:**
- Trovare i banner delle fasi di mercato (Primo Mercato, Contratti, Rubata, Svincolati)
- Aggiungere icona freccia destra (SVG inline, 16x16) dentro il banner
- Aggiungere hover effect: `hover:translate-x-1 hover:border-primary-500/50 transition-all duration-200`
- Aggiungere testo CTA: "Vai alla fase →" allineato a destra
- Su mobile: rendere il banner un `<button>` full-width con `role="link"`
- Aggiungere `cursor-pointer` se non gia presente

**Criteri di accettazione:**
- [ ] Banner mostra freccia destra
- [ ] Hover effect visibile
- [ ] CTA testuale "Vai alla fase" su mobile
- [ ] Semantica corretta (`role="link"` o `<button>`)

---

#### 1.2 — #295 TASK-013: Legenda colori durata contratto (XS, <1h)

**File:** `src/pages/Rose.tsx`, `src/pages/Contracts.tsx`

**Cosa fare:**
- Sotto i filtri posizione (P/D/C/A), aggiungere una riga legenda:
```tsx
<div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
  <span>Durata:</span>
  <span className="flex items-center gap-1">
    <span className="w-3 h-3 rounded bg-gradient-to-r from-red-500 to-red-600" />
    1 anno
  </span>
  <span className="flex items-center gap-1">
    <span className="w-3 h-3 rounded bg-gradient-to-r from-yellow-500 to-yellow-600" />
    2 anni
  </span>
  <span className="flex items-center gap-1">
    <span className="w-3 h-3 rounded bg-gradient-to-r from-green-500 to-green-600" />
    3 anni
  </span>
  <span className="flex items-center gap-1">
    <span className="w-3 h-3 rounded bg-gradient-to-r from-blue-500 to-blue-600" />
    4+ anni
  </span>
</div>
```
- Verificare che i colori corrispondano ai badge gia usati nella tabella
- Rendere compatta su mobile: `flex-wrap` se necessario

**Criteri di accettazione:**
- [ ] Legenda visibile sotto filtri su Rose e Contracts
- [ ] Colori identici ai badge tabella
- [ ] Non basata solo su colore (ha testo "1 anno", etc.)

---

#### 1.3 — #293 TASK-011: Skeleton loader (S, 1-3h)

**File da modificare:** `src/pages/Dashboard.tsx`, `src/pages/AllPlayers.tsx`, `src/pages/Movements.tsx`, `src/pages/Rose.tsx`, `src/pages/LeagueDetail.tsx`
**File da usare:** `src/components/ui/Skeleton.tsx` (gia esistente con 9 varianti)

**Cosa fare:**
- Leggere `src/components/ui/Skeleton.tsx` per capire le varianti disponibili
- In ogni pagina, trovare il blocco `if (loading)` o `isLoading` che mostra spinner/LoadingScreen
- Sostituire con la skeleton variant appropriata:
  - Dashboard: `<SkeletonCard />` x3 nel grid delle leghe
  - AllPlayers: `<SkeletonPlayerRow />` x10 (o quante ne mostra la pagina)
  - Movements: `<SkeletonTableRow />` x10
  - Rose: `<SkeletonPlayerRow />` x10
  - LeagueDetail: `<SkeletonPage />` o `<SkeletonCard />` x4
- Importare i componenti skeleton dove necessario

**Criteri di accettazione:**
- [ ] Ogni pagina usa skeleton appropriato durante caricamento
- [ ] Dimensioni skeleton simili al contenuto reale (no layout shift)
- [ ] Animazione pulse coerente

---

#### 1.4 — #294 TASK-012: EmptyState standardizzato (S, 1-3h)

**File da creare:** `src/components/ui/EmptyState.tsx`
**File da modificare:** `src/pages/Dashboard.tsx`, `src/pages/Movements.tsx`, `src/pages/Prophecies.tsx`, `src/pages/Trades.tsx`

**Cosa fare:**
1. Creare il componente:
```tsx
interface EmptyStateProps {
  icon?: React.ReactNode | string  // emoji o componente icona
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="text-4xl mb-4 opacity-50">
          {typeof icon === 'string' ? icon : icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-200 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 max-w-md mb-6">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={`btn ${action.variant === 'secondary' ? 'btn-outline' : 'btn-primary'} px-6`}
        >
          {action.label}
        </button>
      )}
      {secondaryAction && (
        <button
          onClick={secondaryAction.onClick}
          className="text-sm text-gray-400 hover:text-gray-200 mt-3 underline"
        >
          {secondaryAction.label}
        </button>
      )}
    </div>
  )
}
```

2. Adottare nelle pagine che hanno empty state basici (cercare emoji + "Nessun" o "Non ci sono")

**Criteri di accettazione:**
- [ ] Componente riutilizzabile con API pulita
- [ ] Adottato in almeno 4 pagine
- [ ] Centrato verticalmente, coerente con design system

---

#### 1.5 — #287 TASK-005: Alternativa tastiera DnD Rubata (S, 1-3h)

**File:** `src/pages/Rubata.tsx`

**Cosa fare:**
- Cercare la sezione che usa `@dnd-kit` per le preferenze (lista riordinabile)
- Accanto a ogni elemento della lista, aggiungere due bottoni freccia:
```tsx
<button
  onClick={() => moveItem(index, index - 1)}
  disabled={index === 0}
  className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
  aria-label={`Sposta ${playerName} in su`}
>
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M18 15l-6-6-6 6" />
  </svg>
</button>
<button
  onClick={() => moveItem(index, index + 1)}
  disabled={index === items.length - 1}
  className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
  aria-label={`Sposta ${playerName} in giu`}
>
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M6 9l6 6 6-6" />
  </svg>
</button>
```
- La funzione `moveItem(fromIndex, toIndex)` deve replicare il comportamento del DnD: riordinare l'array e aggiornare lo stato
- Il DnD esistente deve continuare a funzionare

**Criteri di accettazione:**
- [ ] Bottoni su/giu visibili accanto a ogni voce
- [ ] Navigabili da tastiera (Tab + Enter/Space)
- [ ] Primo elemento: no bottone "su". Ultimo: no bottone "giu"
- [ ] DnD resta funzionante
- [ ] aria-label descrittivo

---

#### 1.6 — #290 TASK-008: Timer accessibility (S, 1-3h)

**File:** Cercare il componente timer usato in AuctionRoom. Probabilmente `src/components/AuctionTimer.tsx` o simile.
**File CSS:** `src/index.css` (sezione timer)

**Cosa fare:**
1. Sotto il valore numerico del timer, aggiungere label testuale:
```tsx
const timerLabel = timeLeft > 15 ? 'Tempo OK' : timeLeft > 5 ? 'Affrettati!' : 'Ultimo secondo!'
```
2. Mostrare la label sotto il timer:
```tsx
<span className={`text-sm font-medium ${
  timeLeft > 15 ? 'text-green-400' : timeLeft > 5 ? 'text-yellow-400' : 'text-red-400'
}`}>
  {timerLabel}
</span>
```
3. Aggiungere `aria-live="assertive"` al container timer quando `timeLeft < 10`
4. Aggiungere `aria-label` al container: `aria-label={`Timer: ${timeLeft} secondi. ${timerLabel}`}`
5. Opzionale: aggiungere pattern CSS alla barra di progresso per distinguere gli stati senza colore

**Criteri di accettazione:**
- [ ] Label testuale visibile sotto il timer
- [ ] `aria-live="assertive"` quando timer < 10s
- [ ] Tre stati distinguibili senza colore
- [ ] Barra con pattern/texture per stato

---

#### 1.7 — #304 TASK-022: aria-label pulsanti icon-only (S, 1-3h)

**File:** Multipli — serve audit

**Cosa fare:**
1. Cercare nel codebase tutti i `<button>` che contengono solo SVG/icona senza testo:
   - Pattern grep: `<button` seguito da `<svg` senza testo visibile
   - Cercare anche `onClick` con solo icona dentro
2. Per ogni bottone trovato, aggiungere `aria-label` appropriato:
   - Close buttons nei modal: `aria-label="Chiudi"`
   - Toggle sidebar: `aria-label="Apri/Chiudi menu"`
   - Filtri posizione: `aria-label="Filtra per Attaccanti"`
   - Edit/Delete: `aria-label="Modifica giocatore"` / `aria-label="Rimuovi giocatore"`
3. Usare `title` per tooltip visivo dove utile

**Criteri di accettazione:**
- [ ] Tutti i pulsanti icon-only hanno `aria-label`
- [ ] Label descrittive e contestuali

---

#### 1.8 — #305 TASK-023: scope e aria-sort tabelle (S, 1-3h)

**File:** Tutte le pagine con `<table>`: Rose.tsx, Movements.tsx, LeagueFinancials.tsx, PlayerStats.tsx, AdminPanel.tsx, Contracts.tsx

**Cosa fare:**
1. In ogni `<th>`, aggiungere `scope="col"`:
```tsx
<th scope="col" className="...">Nome</th>
```
2. Per le colonne sortabili, aggiungere `aria-sort`:
```tsx
<th
  scope="col"
  aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
  className="cursor-pointer ..."
  onClick={() => handleSort('name')}
>
  Nome {sortKey === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
</th>
```
3. Aggiungere `<caption>` o `aria-label` a ogni `<table>`:
```tsx
<table aria-label="Rosa giocatori FC Mario">
```

**Criteri di accettazione:**
- [ ] Tutti i `<th>` hanno `scope="col"` o `scope="row"`
- [ ] Colonne sortabili hanno `aria-sort` dinamico
- [ ] Tabelle hanno `aria-label` o `<caption>`

---

### Chiusura Sprint 1

```bash
# Verificare build
npm run build

# Commit (un commit per task o un commit unico per sprint)
# Opzione A: commit unico
git add src/
git commit -m "feat: UI Sprint 1 - quick wins a11y e UX (#292, #295, #293, #294, #287, #290, #304, #305)"

# Opzione B: commit per task (preferibile)
git add src/pages/LeagueDetail.tsx
git commit -m "feat: banner fasi con affordance chiara (#292)"
git add src/pages/Rose.tsx src/pages/Contracts.tsx
git commit -m "feat: legenda colori durata contratto (#295)"
# ... etc per ogni task

# Push e PR
git push origin feature/1.x-ui-sprint-1
gh pr create --title "feat: UI Sprint 1 - Quick Wins" --body "## Issues risolte
- #292 Banner fasi affordance
- #295 Legenda colori durata
- #293 Skeleton loader
- #294 EmptyState component
- #287 Keyboard DnD Rubata
- #290 Timer accessibility
- #304 aria-label pulsanti
- #305 scope/aria-sort tabelle" --base develop
```

---

## SPRINT 2 — Fondamenta (~2 settimane, 4 task)

### Setup
```bash
git checkout develop
git pull origin develop
git checkout -b feature/1.x-ui-sprint-2
```

### Gestione Issue
Spostare nel progetto EVOLUTIVE da Backlog → In Progress:
Issues: #283, #289, #286, #297

### IMPORTANTE: Ordine di Implementazione

**TASK-001 (DataTable) DEVE essere fatto per primo.** TASK-004 (Movements) lo usa. Gli altri sono indipendenti.

```
#283 DataTable ──→ #286 Movements (usa DataTable)
#289 lucide-react (indipendente, parallelizzabile)
#297 Tooltip status (indipendente, parallelizzabile)
```

---

#### 2.1 — #283 TASK-001: DataTable responsivo (L, 1-2gg) ⚠️ FONDAMENTALE

**File da creare:** `src/components/ui/DataTable.tsx`
**File da modificare per prima adozione:** `src/pages/Rose.tsx`

**Cosa fare:**
1. Leggere ATTENTAMENTE la sezione TASK-001 in `UI_IMPROVEMENTS_BACKLOG.md` per l'API completa
2. Creare il componente con queste 3 modalita:
   - **Desktop (>=1024px):** Tabella HTML standard con tutte le colonne
   - **Tablet (768-1023px):** Tabella con `overflow-x-auto` + gradient shadow sui bordi (indica scroll)
   - **Mobile (<768px):** Card layout con expand/collapse
3. Usare `window.matchMedia` o un hook `useBreakpoint()` per determinare la modalita
4. API del componente (da `UI_IMPROVEMENTS_BACKLOG.md`):
```tsx
interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  mobileColumns: string[]      // max 3-4 colonne principali
  tabletColumns: string[]      // max 6-8 colonne
  desktopColumns: string[]     // tutte
  renderMobileCard?: (row: T) => ReactNode
  sortable?: boolean
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  expandable?: boolean
  renderExpandedRow?: (row: T) => ReactNode
  pageSize?: number
}
```
5. Prima adozione: sostituire la tabella in `Rose.tsx` con `<DataTable>`
6. Verificare che funzioni su 375px, 768px, 1280px

**Criteri di accettazione:**
- [ ] Mobile: card layout con expand/collapse
- [ ] Tablet: scroll orizzontale con indicatore visivo
- [ ] Desktop: tabella completa
- [ ] Sorting funziona in tutte le modalita
- [ ] Componente riutilizzabile con API generica
- [ ] `scope` su headers, `aria-sort` su colonne sortabili

---

#### 2.2 — #289 TASK-007: Icone SVG → lucide-react (M, 3-8h)

**⚠️ RICHIEDE:** `npm install lucide-react` — CHIEDERE CONFERMA all'utente prima di procedere.

**File principale:** `src/components/Navigation.tsx`
**File secondari:** tutte le pagine con SVG inline per icone (cercare `<svg` con `viewBox="0 0 24 24"`)

**Cosa fare:**
1. Installare: `npm install lucide-react`
2. In `Navigation.tsx`:
   - Trovare l'oggetto `MenuIcons` (contiene 130+ righe di SVG inline)
   - Sostituire ogni SVG con il corrispondente componente lucide-react
   - Mappatura suggerita:
     - dashboard → `<Home size={16} />`
     - admin → `<Settings size={16} />`
     - allRosters → `<Users size={16} />`
     - history → `<Clock size={16} />`
     - prophecy → `<Lightbulb size={16} />`
     - back → `<ArrowLeft size={16} />`
     - financials → `<DollarSign size={16} />`
     - stats → `<BarChart3 size={16} />`
     - feedback → `<MessageSquare size={16} />`
3. In ogni pagina, cercare SVG inline usati come icone (non grafici/chart!) e sostituire
4. Convenzione dimensioni: 16px nav, 20px azioni, 24px headers

**Criteri di accettazione:**
- [ ] Tutte le icone da lucide-react
- [ ] Dimensioni coerenti
- [ ] Nessun SVG inline per icone standard rimasto

---

#### 2.3 — #286 TASK-004: Movements mobile (M, 3-8h)

**File:** `src/pages/Movements.tsx`
**Dipende da:** #283 DataTable (se disponibile, usarlo; altrimenti card layout dedicato)

**Cosa fare:**
1. Se DataTable (#283) e' implementato: adottare `<DataTable>` con `renderMobileCard` custom
2. Se DataTable non e' ancora pronto: implementare card layout dedicato per mobile
3. La card mobile deve mostrare:
   - Badge tipo movimento (colore diverso per PM/Trade/Rubata/Svincolati/Release)
   - Data
   - Giocatore con badge posizione
   - Da → A (con freccia)
   - Prezzo
   - Expand per profezia
4. Usare `<div className="block md:hidden">` per card e `<div className="hidden md:block">` per tabella desktop

**Criteri di accettazione:**
- [ ] Mobile: card layout con badge tipo, data, giocatore, da/a, prezzo
- [ ] Filtro tipo prominente su mobile
- [ ] Desktop: tabella invariata
- [ ] Profezia accessibile tramite expand

---

#### 2.4 — #297 TASK-015: Tooltip status contratto (S, 1-3h)

**File:** `src/pages/Contracts.tsx`, `src/pages/ManagerDashboard.tsx`

**Cosa fare:**
1. Trovare i badge stato contratto ("Da impostare", "Scaduto", "In scadenza", "Attivo")
2. Wrappare ogni badge in un container con tooltip:
```tsx
<div className="relative group">
  <span className="badge-status ...">{status}</span>
  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block
                  bg-surface-300 border border-surface-50/30 rounded-lg p-3 text-xs text-gray-300
                  w-64 shadow-lg z-50"
       role="tooltip">
    <p className="font-medium text-gray-100 mb-1">{statusTitle}</p>
    <p>{statusDescription}</p>
    {deadline && <p className="mt-1 text-accent-400">Deadline: {deadline}</p>}
  </div>
</div>
```
3. Su mobile: usare `onClick` toggle invece di hover (`:hover` non funziona bene su touch)

**Criteri di accettazione:**
- [ ] Tooltip su hover desktop / tap mobile
- [ ] Testo chiaro con azione suggerita
- [ ] `role="tooltip"` e `aria-describedby`

---

### Chiusura Sprint 2

```bash
npm run build
# Commit per task
git push origin feature/1.x-ui-sprint-2
gh pr create --title "feat: UI Sprint 2 - DataTable, lucide-react, Movements mobile" \
  --body "## Issues risolte
- #283 DataTable responsivo riutilizzabile
- #289 lucide-react icons
- #286 Movements mobile card layout
- #297 Tooltip status contratto" --base develop
```

---

## SPRINT 3 — Refactoring Core (~2 settimane, 4 task)

### Setup
```bash
git checkout develop
git pull origin develop
git checkout -b feature/1.x-ui-sprint-3
```

### Gestione Issue
Issues: #284, #288, #291, #296

### IMPORTANTE: Ordine di Implementazione

Questi sono i task piu grossi. Ordine consigliato:
```
#288 Rubata splitting (XL) ──→ #296 Stepper Rubata (M) [piu facile dopo lo splitting]
#284 AdminPanel splitting (L) [indipendente]
#291 recharts (L) [indipendente, richiede npm install]
```

**Consiglio:** Fare #288 e #284 in sessioni separate (sono refactoring pesanti, consumano molto contesto). Fare #291 e #296 insieme nella sessione finale.

---

#### 3.1 — #288 TASK-006: Splitting Rubata.tsx (XL, 2-5gg)

**File da refactorare:** `src/pages/Rubata.tsx` (2000+ righe)
**File da creare:** 7 nuovi file

**Cosa fare:**
1. Leggere TUTTO `Rubata.tsx` per capire la struttura
2. Identificare le sezioni:
   - State machine e logica Pusher → `src/hooks/useRubataState.ts`
   - Board giocatori → `src/components/rubata/RubataBoard.tsx`
   - Controlli offerta → `src/components/rubata/RubataBidPanel.tsx`
   - Timer e stato → `src/components/rubata/RubataTimerPanel.tsx`
   - Pannello admin → `src/components/rubata/RubataAdminControls.tsx`
   - Modal (6+) → `src/components/rubata/RubataModals.tsx`
   - Gestione preferenze → `src/components/rubata/RubataPreferences.tsx`
3. Estrarre hook `useRubataState`:
   - Tutta la logica di stato (useState, useEffect per Pusher, polling, heartbeat)
   - Deve esporre: state, actions, derived values
4. `Rubata.tsx` diventa orchestratore (~200 righe):
   - Usa `useRubataState`
   - Renderizza i sotto-componenti condizionalmente in base allo stato
   - Passa props ai sotto-componenti
5. **ZERO REGRESSIONI:** ogni stato e modal deve funzionare come prima

**Criteri di accettazione:**
- [ ] Rubata.tsx < 300 righe
- [ ] Ogni sotto-componente testabile indipendentemente
- [ ] useRubataState gestisce tutta la logica
- [ ] Nessuna regressione funzionale
- [ ] Modal lazy-loaded

---

#### 3.2 — #284 TASK-002: AdminPanel splitting + mobile (L, 1-2gg)

**File da refactorare:** `src/pages/AdminPanel.tsx` (1573+ righe)
**File da creare:** Sotto-componenti per ogni tab
**File da usare:** `src/components/ui/BottomSheet.tsx`

**Cosa fare:**
1. Leggere `AdminPanel.tsx` e identificare gli 8 tab
2. Per ogni tab, estrarre il contenuto in un componente separato:
   - `src/components/admin/AdminMarketTab.tsx`
   - `src/components/admin/AdminOverviewTab.tsx`
   - `src/components/admin/AdminMembersTab.tsx`
   - `src/components/admin/AdminPrizesTab.tsx`
   - `src/components/admin/AdminAppealsTab.tsx`
   - `src/components/admin/AdminInvitesTab.tsx`
   - `src/components/admin/AdminSessionsTab.tsx`
   - `src/components/admin/AdminExportTab.tsx`
3. Usare `React.lazy()` per lazy-load di ogni tab
4. Su mobile (<768px): sostituire tab bar con menu BottomSheet
5. `AdminPanel.tsx` diventa orchestratore (<500 righe)

**Criteri di accettazione:**
- [ ] Mobile: tab accessibili via BottomSheet
- [ ] Badge contatori nel menu mobile
- [ ] Ogni tab lazy-loaded
- [ ] AdminPanel.tsx < 500 righe

---

#### 3.3 — #291 TASK-009: Adottare recharts (L, 1-2gg)

**⚠️ RICHIEDE:** `npm install recharts` — CHIEDERE CONFERMA all'utente.

**File da modificare:** `src/pages/LeagueFinancials.tsx`, `src/components/ui/RadarChart.tsx`, `src/pages/PlayerStats.tsx`

**Cosa fare:**
1. Installare: `npm install recharts`
2. Migrare i grafici:
   - DonutChart custom → `<PieChart>` + `<Pie>` + `<Cell>` + `<ResponsiveContainer>`
   - BudgetBarChart custom → `<BarChart>` + `<Bar>` + `<ResponsiveContainer>`
   - RadarChart custom → `<RadarChart>` + `<Radar>` + `<ResponsiveContainer>`
3. Aggiungere a ogni grafico:
   - `<ResponsiveContainer width="100%" height={300}>`
   - `<Tooltip>` per dati on-hover
   - `<Legend>` interattiva
4. Dark theme: impostare colori coerenti con il design system:
```tsx
const CHART_COLORS = {
  primary: '#3b82f6',
  secondary: '#22c55e',
  accent: '#f59e0b',
  danger: '#ef4444',
  text: '#9ca3af',
  grid: 'rgba(42, 49, 66, 0.3)',
}
```

**Criteri di accettazione:**
- [ ] Grafici responsive
- [ ] Tooltip su hover/tap
- [ ] Legenda interattiva
- [ ] Dark theme coerente

---

#### 3.4 — #296 TASK-014: Stepper visivo Rubata (M, 3-8h)

**File da creare:** `src/components/ui/StepperProgress.tsx`
**File da modificare:** `src/pages/Rubata.tsx` (o il file orchestratore post-splitting)

**Cosa fare:**
1. Creare componente stepper:
```tsx
interface StepperProps {
  steps: { id: string; label: string }[]
  currentStep: string
  completedSteps: string[]
}
```
2. Visualizzare orizzontalmente: [check] → [check] → [corrente *] → [futuro] → [futuro]
3. Step completati: cerchio verde con check
4. Step corrente: cerchio primary con pulse
5. Step futuri: cerchio grigio
6. Su mobile: mostrare solo step corrente con testo "Passo 3 di 7" e frecce prev/next
7. Aggiungere in Rubata.tsx in alto, prima del contenuto

**Criteri di accettazione:**
- [ ] Stepper mostra tutti gli step
- [ ] Step corrente evidenziato
- [ ] Mobile: compatto con testo "Passo X di Y"
- [ ] `aria-current="step"`, `aria-label`

---

### Chiusura Sprint 3

```bash
npm run build
git push origin feature/1.x-ui-sprint-3
gh pr create --title "refactor: UI Sprint 3 - Rubata splitting, AdminPanel splitting, recharts, stepper" \
  --body "## Issues risolte
- #288 Splitting Rubata.tsx
- #284 AdminPanel mobile + splitting
- #291 Adozione recharts
- #296 Stepper visivo Rubata" --base develop
```

---

## SPRINT 4 — Polish & Power Features (~2 settimane, 4 task)

### Setup
```bash
git checkout develop
git pull origin develop
git checkout -b feature/1.x-ui-sprint-4
```

### Gestione Issue
Issues: #285, #298, #299, #302

### Ordine di Implementazione

```
#285 Consolidare layout asta (XL) [indipendente, il piu grosso]
#298 Virtualizzazione (M) [indipendente, richiede npm install]
#299 BottomSheet contratti (M) [indipendente]
#302 PlayerComparison (M) [dipende da #291 recharts]
```

**Consiglio:** #285 in sessione dedicata. Gli altri 3 in parallelo nella seconda sessione.

---

#### 4.1 — #285 TASK-003: Consolidare layout asta 6 → 3 (XL, 2-5gg)

**File da analizzare:** `src/components/auction/LayoutA.tsx` attraverso `LayoutF.tsx`
**File da creare:** Componenti condivisi + LayoutMobile
**File da modificare:** `src/components/auction/AuctionLayoutSelector.tsx`

**Cosa fare:**
1. Leggere TUTTI i 6 layout (LayoutA-F) per capire differenze e somiglianze
2. Estrarre componenti condivisi:
   - `src/components/auction/shared/AuctionPlayerCard.tsx`
   - `src/components/auction/shared/AuctionBidPanel.tsx`
   - `src/components/auction/shared/AuctionBudgetBar.tsx`
   - `src/components/auction/shared/AuctionManagerList.tsx`
3. Creare 3 layout che usano i componenti condivisi:
   - `LayoutMobile.tsx`: Timer fisso top, card giocatore center, bid controls sticky bottom
   - `LayoutDesktop.tsx`: Evoluzione di LayoutA, 60/40 split
   - `LayoutPro.tsx`: Evoluzione di LayoutD/F, multi-panel IDE-style
4. Aggiornare `AuctionLayoutSelector.tsx` per offrire 3 scelte
5. Auto-selezionare LayoutMobile su viewport < 768px
6. Rimuovere LayoutB, LayoutC, LayoutE (solo dopo che i nuovi funzionano)
7. **ZERO REGRESSIONI:** testare tutti gli stati dell'asta

**Criteri di accettazione:**
- [ ] 3 layout al posto di 6
- [ ] Componenti condivisi estratti
- [ ] LayoutMobile usabile con una mano su 375px
- [ ] Auto-selezione per viewport
- [ ] Nessuna regressione

---

#### 4.2 — #298 TASK-016: Virtualizzazione liste (M, 3-8h)

**⚠️ RICHIEDE:** `npm install @tanstack/react-virtual` — CHIEDERE CONFERMA.

**File:** `src/pages/AllPlayers.tsx`, `src/pages/Movements.tsx`, `src/pages/Prophecies.tsx`, `src/pages/PlayerStats.tsx`

**Cosa fare:**
1. Installare `@tanstack/react-virtual`
2. Per ogni pagina con liste lunghe:
   - Wrap il container in un `ref` per `useVirtualizer`
   - Rendere solo le righe nel viewport visibile
   - Mantenere altezze righe fisse o stimarle
3. Verificare che sorting e filtering funzionino con virtualizzazione

**Criteri di accettazione:**
- [ ] Liste 100+ elementi: solo righe visibili renderizzate
- [ ] Scrolling smooth 60fps
- [ ] Nessuna regressione visiva
- [ ] Funziona con sort/filter

---

#### 4.3 — #299 TASK-017: BottomSheet contratti mobile (M, 3-8h)

**File:** `src/pages/Contracts.tsx`
**File da usare:** `src/components/ui/BottomSheet.tsx`, `DurationSlider.tsx`, `NumberStepper.tsx`

**Cosa fare:**
1. Su mobile (<768px), tap su una riga contratto apre BottomSheet
2. Il BottomSheet mostra:
   - Info giocatore (foto, nome, ruolo, team)
   - DurationSlider full-width
   - NumberStepper per salario
   - NumberStepper per clausola
   - Bottoni Salva/Annulla
3. Su desktop: il form resta inline nella tabella (comportamento attuale invariato)

**Criteri di accettazione:**
- [ ] Mobile: tap apre BottomSheet
- [ ] DurationSlider usabile con un dito
- [ ] NumberStepper con bottoni 44x44px
- [ ] Desktop: form inline invariato

---

#### 4.4 — #302 TASK-020: Full-page comparison PlayerStats (M, 3-8h)

**File:** `src/pages/PlayerStats.tsx`, eventualmente `src/pages/PlayerComparison.tsx`

**Cosa fare:**
1. Creare una vista/pagina dedicata per il confronto giocatori
2. Layout desktop: side-by-side (2-4 giocatori affiancati)
3. Layout mobile: card stack (uno sopra l'altro)
4. Radar chart confronto (usa recharts se disponibile da Sprint 3)
5. Link diretto dalla tabella stats: bottone "Confronta selezionati"

**Criteri di accettazione:**
- [ ] Vista full-page per confronto
- [ ] Side-by-side desktop, stack mobile
- [ ] Radar chart responsive
- [ ] Navigazione da tabella stats

---

### Chiusura Sprint 4

```bash
npm run build
git push origin feature/1.x-ui-sprint-4
gh pr create --title "feat: UI Sprint 4 - Layout asta, virtualizzazione, BottomSheet contratti, PlayerComparison" \
  --body "## Issues risolte
- #285 Consolidare layout asta 6→3
- #298 Virtualizzazione liste
- #299 BottomSheet contratti mobile
- #302 Full-page comparison PlayerStats" --base develop
```

---

## Dipendenze npm da installare (riepilogo)

Queste dipendenze vanno installate SOLO con conferma esplicita dell'utente:

| Sprint | Pacchetto | Task |
|--------|-----------|------|
| 2 | `lucide-react` | #289 TASK-007 |
| 3 | `recharts` | #291 TASK-009 |
| 4 | `@tanstack/react-virtual` | #298 TASK-016 |

---

## Task in Backlog (non schedulati)

Questi task restano nel Backlog del progetto EVOLUTIVE. Implementarli solo se l'utente lo richiede esplicitamente:

| Issue | Titolo | Sforzo |
|-------|--------|--------|
| #300 | Sidebar Rosa collassabile | S |
| #301 | Filtro data/periodo Movements | S |
| #303 | Raggruppare colonne PlayerStats | S |
| #306 | Command Palette (Ctrl+K) | L |
| #307 | Dashboard widget DnD | XL |
| #308 | Keyboard shortcuts asta | M |
| #309 | Alert configurabili manager | XL |
| #310 | Sparkline inline tabelle | M |

---

## Riferimenti

| File | Descrizione |
|------|-------------|
| `UI_REVIEW_REPORT.md` | Analisi completa per pagina con punteggi |
| `UI_IMPROVEMENTS_BACKLOG.md` | Dettagli completi di ogni task (wireframe, criteri, file) |
| `UI_REVIEW_REPORT_MOCKUPS.html` | Mockup visivi BEFORE/AFTER per pattern (apri nel browser) |
| `UI_IMPROVEMENTS_BACKLOG_MOCKUPS.html` | Mockup visivi BEFORE/AFTER per ogni task (apri nel browser) |
| `CLAUDE.md` | Workflow Git, credenziali test, comandi utili |
| `src/index.css` | Design system CSS (variabili, componenti, animazioni) |
| `tailwind.config.js` | Palette colori, tipografia, shadows, animazioni |
| `src/themes/index.ts` | 22 temi con variabili CSS custom |
| `src/components/ui/Skeleton.tsx` | 9 varianti skeleton loader gia disponibili |
| `src/components/ui/BottomSheet.tsx` | BottomSheet component gia disponibile |
| `src/components/ui/DurationSlider.tsx` | Slider durata gia disponibile |
| `src/components/ui/NumberStepper.tsx` | Stepper numerico gia disponibile |
| `src/components/ui/PositionBadge.tsx` | Badge posizione (P/D/C/A) gia disponibile |

---

## Prompt Consigliati per Ogni Sprint

### Sprint 1
> Leggi `UI_SPRINT_PLAN.md` sezione SPRINT 1. Crea branch `feature/1.x-ui-sprint-1` da develop. Implementa tutti gli 8 task nell'ordine indicato. Fai commit separati per ogni task con riferimento all'issue. Alla fine, verifica build e crea PR verso develop.

### Sprint 2
> Leggi `UI_SPRINT_PLAN.md` sezione SPRINT 2. Crea branch `feature/1.x-ui-sprint-2` da develop. INIZIA da #283 DataTable (e' fondamentale). Poi procedi con gli altri 3 task. Per lucide-react chiedi conferma prima di installare.

### Sprint 3
> Leggi `UI_SPRINT_PLAN.md` sezione SPRINT 3. Crea branch `feature/1.x-ui-sprint-3` da develop. Fai #288 (Rubata splitting) per primo — e' il piu grosso. Poi #284 (AdminPanel). Poi #291 (recharts, chiedi conferma npm install) e #296 (stepper) insieme.

### Sprint 4
> Leggi `UI_SPRINT_PLAN.md` sezione SPRINT 4. Crea branch `feature/1.x-ui-sprint-4` da develop. Fai #285 (layout asta) per primo in sessione dedicata. Poi #298, #299, #302 in parallelo. Per @tanstack/react-virtual chiedi conferma prima di installare.
