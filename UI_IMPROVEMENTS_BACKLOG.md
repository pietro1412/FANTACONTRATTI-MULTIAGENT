# UI Improvements Backlog -- Fantacontratti Multiagent

> Generato il: 2026-02-08
> Ordinato per priorita di impatto
> Agente: UI Review Agent v1.0
> Modalita: Review Only (nessuna modifica applicata)

---

## Come Leggere Questo Backlog

- Ogni task e' auto-contenuta e implementabile indipendentemente (salvo dipendenze esplicite)
- Il layout target (S/M/C) indica per quale profilo e' pensata
- Lo sforzo e' stimato in: XS (< 1h), S (1-3h), M (3-8h), L (1-2gg), XL (2-5gg)
- I file coinvolti sono specificati per ogni task
- I wireframe ASCII mostrano il layout proposto

---

## Priorita CRITICA (da fare subito)

> Alto impatto UX + Basso/Medio sforzo = Fare subito

---

### TASK-001: Creare componente DataTable responsivo riutilizzabile

- **Pagina:** Trasversale (Rose, Movements, LeagueFinancials, PlayerStats, AdminPanel, Contracts, ManagerDashboard, PrizePhasePage)
- **Layout:** Tutti (S/M/C)
- **Problema:** 8 pagine hanno tabelle con 10-13+ colonne che usano `hidden lg:table-cell` per nascondere colonne su mobile. L'utente perde dati senza saperlo. Su tablet portrait (768px) la situazione e' critica -- le tabelle sono illeggibili o richiedono scroll orizzontale senza indicazione.
- **Proposta:** Creare un componente `<DataTable>` che gestisce 3 modalita responsive:
  - **Desktop (1024px+):** Tabella standard con tutte le colonne
  - **Tablet (768-1023px):** Tabella con scroll orizzontale + shadow gradient laterale che indica "scorri >"
  - **Mobile (<768px):** Card layout con header (info principale) + expand/collapse per dettagli
- **File coinvolti:**
  - Creare: `src/components/ui/DataTable.tsx`
  - Modificare: `src/pages/Rose.tsx`, `src/pages/Movements.tsx`, `src/pages/LeagueFinancials.tsx`, `src/pages/PlayerStats.tsx`
- **Componenti da usare/creare:**
  ```typescript
  interface DataTableProps<T> {
    data: T[]
    columns: ColumnDef<T>[]
    // Colonne visibili per breakpoint
    mobileColumns: string[]      // max 3-4 colonne principali
    tabletColumns: string[]      // max 6-8 colonne
    desktopColumns: string[]     // tutte
    // Card mode su mobile
    renderMobileCard?: (row: T) => ReactNode
    // Sorting
    sortable?: boolean
    defaultSort?: { key: string; dir: 'asc' | 'desc' }
    // Expand
    expandable?: boolean
    renderExpandedRow?: (row: T) => ReactNode
    // Pagination
    pageSize?: number
  }
  ```
- **Wireframe mobile card:**
  ```
  +----------------------------------+
  |  [PositionBadge] Nome Giocatore  |
  |  Serie A - Inter          42M    |
  |  ---- expand (tap) ----         |
  |  Salario: 8M | Durata: 3 anni  |
  |  Clausola: 15M | Rubata: 5M    |
  +----------------------------------+
  ```
- **Wireframe tablet scroll indicator:**
  ```
  +------------------------------------------------------+
  | Nome    | Ruolo | Team  | Budget | >>>>  [gradient]  |
  |---------|-------|-------|--------|                    |
  | Lautaro | A     | Inter | 42M    | scroll per altri >|
  +------------------------------------------------------+
  ```
- **Criteri di accettazione:**
  - [ ] Su mobile (<768px) le tabelle mostrano card layout con expand/collapse
  - [ ] Su tablet (768-1023px) le tabelle hanno scroll orizzontale con indicatore visivo
  - [ ] Su desktop (1024px+) le tabelle mostrano tutte le colonne
  - [ ] Il sorting funziona in tutte le modalita
  - [ ] Il componente e' riutilizzabile con API generica
  - [ ] Accessibilita: `scope` su headers, `aria-sort` su colonne sortabili
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** Nessuna

---

### TASK-002: Ridurre AdminPanel 8 tab a interfaccia gestibile su mobile

- **Pagina:** AdminPanel
- **Layout:** Tutti (S/M/C)
- **Problema:** AdminPanel ha 8 tab in una riga orizzontale (Mercato, Panoramica, Membri, Premi, Ricorsi, Inviti, Sessioni, Export). Su mobile (375px) i tab non entrano e generano overflow. Anche su tablet la leggibilita e' compromessa. Il file e' monolitico (1573+ righe) con tutti i tab renderizzati insieme.
- **Proposta:**
  - **Mobile (<768px):** Sostituire tab bar con menu a lista nel BottomSheet gia disponibile. Tap su icona menu apre lista voci con icona + label + badge contatore
  - **Tablet (768-1023px):** Tab scrollabili con frecce laterali e indicatore posizione
  - **Desktop (1024px+):** Tab bar attuale (funziona gia)
  - **Code splitting:** Lazy-load del contenuto di ogni tab con `React.lazy()`
- **File coinvolti:**
  - Modificare: `src/pages/AdminPanel.tsx`
  - Usare: `src/components/ui/BottomSheet.tsx` (gia esistente)
  - Creare: sotto-componenti per ogni tab (`AdminMarketTab.tsx`, `AdminMembersTab.tsx`, etc.)
- **Wireframe mobile:**
  ```
  +-----------------------------------+
  | < Admin Panel          [Menu v]  |
  +-----------------------------------+
  |                                   |
  |  [Contenuto tab attivo]           |
  |                                   |
  +-----------------------------------+

  --- BottomSheet menu ---
  +-----------------------------------+
  | Menu Admin                    [X] |
  +-----------------------------------+
  | [icon] Mercato           (!)     |
  | [icon] Panoramica               |
  | [icon] Membri            (3)    |
  | [icon] Premi                    |
  | [icon] Ricorsi           (2)    |
  | [icon] Inviti                   |
  | [icon] Sessioni                 |
  | [icon] Export                   |
  +-----------------------------------+
  ```
- **Criteri di accettazione:**
  - [ ] Su mobile, i tab sono accessibili tramite menu BottomSheet
  - [ ] Badge contatori visibili nel menu mobile
  - [ ] Ogni tab viene caricato lazy (React.lazy)
  - [ ] Il file AdminPanel.tsx scende sotto 500 righe (orchestratore)
  - [ ] Performance: solo il tab attivo e' renderizzato
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** Nessuna

---

### TASK-003: Consolidare layout asta da 6 a 3

- **Pagina:** AuctionRoom
- **Layout:** Tutti (S/M/C)
- **Problema:** Esistono 6 layout asta separati (LayoutA.tsx - LayoutF.tsx) con stili e comportamenti leggermente diversi. Manutenzione 6x, inconsistenze tra layout, e l'utente puo trovare comportamenti diversi cambiando layout. Ogni layout e' un file completo che duplica logica.
- **Proposta:** Consolidare in 3 layout con componenti condivisi:
  - **LayoutMobile:** Ottimizzato per smartphone. Timer fisso in alto, card giocatore centrale, bid controls sticky in basso, tutto il resto in BottomSheet
  - **LayoutDesktop:** Split-screen focus (evoluzione di LayoutA). 60% area asta + 40% info sidebar
  - **LayoutPro:** Multi-panel tipo IDE per power user (evoluzione di LayoutD/F)
  - Estrarre componenti condivisi: `AuctionPlayerCard`, `AuctionBidPanel`, `AuctionBudgetBar`, `AuctionManagerList`
- **File coinvolti:**
  - Creare: `src/components/auction/shared/AuctionPlayerCard.tsx`, `AuctionBidPanel.tsx`, `AuctionBudgetBar.tsx`, `AuctionManagerList.tsx`
  - Creare: `src/components/auction/LayoutMobile.tsx`, rinominare/refactorare `LayoutDesktop.tsx`, `LayoutPro.tsx`
  - Rimuovere: `LayoutB.tsx`, `LayoutC.tsx`, `LayoutE.tsx` (dopo migrazione)
  - Modificare: `src/components/auction/AuctionLayoutSelector.tsx`
- **Wireframe LayoutMobile:**
  ```
  +-----------------------------------+
  |  TIMER: 00:15  [Budget: 87.3M]  |
  |  [████████████░░░░░░]            |
  +-----------------------------------+
  |                                   |
  |    +--- Player Card ---+          |
  |    |   [Photo]         |          |
  |    |   Lautaro Martinez|          |
  |    |   A - Inter       |          |
  |    |   Quot: 35M       |          |
  |    +-------------------+          |
  |                                   |
  |  Offerta corrente: 42M           |
  |  Di: FC Mario                    |
  |                                   |
  +-----------------------------------+
  | [- ] [  43M  ] [+ ]   [OFFRI!]  |
  +-----------------------------------+
  ```
- **Criteri di accettazione:**
  - [ ] 3 layout al posto di 6
  - [ ] Componenti condivisi estratti (PlayerCard, BidPanel, BudgetBar, ManagerList)
  - [ ] LayoutMobile usabile con una mano su 375px
  - [ ] Nessuna regressione funzionale (tutti gli stati/modali funzionano)
  - [ ] Auto-selezione layout in base al viewport (mobile auto-seleziona LayoutMobile)
- **Sforzo stimato:** XL (2-5gg)
- **Dipendenze:** Nessuna

---

### TASK-004: Rendere Movements leggibile su mobile

- **Pagina:** Movements
- **Layout:** Tutti (S/M/C)
- **Problema:** La tabella movimenti ha 12+ colonne (tipo, stagione, giocatore, da, a, prezzo, contratto, data). Su mobile e' completamente inutilizzabile. Anche su tablet la situazione e' critica.
- **Proposta:** Implementare card layout su mobile con informazioni organizzate gerarchicamente:
  ```
  +-----------------------------------+
  |  [Badge PM] Primo Mercato        |
  |  15 Gen 2026                     |
  +-----------------------------------+
  |  [Photo] Lautaro Martinez  [A]  |
  |  Inter                          |
  |                                  |
  |  Da: Svincolato > A: FC Mario  |
  |  Prezzo: 42M                    |
  |  Salario: 8M x 3 anni          |
  |                                  |
  |  [Aggiungi profezia v]          |
  +-----------------------------------+
  ```
- **File coinvolti:**
  - Modificare: `src/pages/Movements.tsx`
  - Usare: TASK-001 DataTable (se implementato) oppure card layout dedicato
- **Criteri di accettazione:**
  - [ ] Su mobile (<768px) i movimenti sono visualizzati come card
  - [ ] Ogni card mostra: tipo (badge), data, giocatore, da/a, prezzo
  - [ ] La profezia e' accessibile tramite expand nella card
  - [ ] Filtro per tipo di movimento prominente su mobile
  - [ ] Su desktop la tabella resta invariata
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Opzionale TASK-001 (puo usare DataTable se disponibile)

---

### TASK-005: Aggiungere alternativa tastiera al drag-and-drop in Rubata

- **Pagina:** Rubata
- **Layout:** Tutti (S/M/C)
- **Problema:** Il riordino delle preferenze nella fase Rubata usa solo drag-and-drop (@dnd-kit). Utenti con disabilita motorie o che usano tastiera non possono riordinare le preferenze. Questo e' un problema di accessibilita critico per una funzionalita core.
- **Proposta:** Aggiungere bottoni freccia su/giu accanto a ogni voce della lista preferenze come alternativa al DnD. I bottoni devono essere visibili e accessibili da tastiera.
- **File coinvolti:**
  - Modificare: `src/pages/Rubata.tsx` (sezione preferenze)
- **Wireframe:**
  ```
  Ordine Preferenze:
  +-----------------------------------+
  | [drag] 1. Lautaro Martinez  [^][v]|
  | [drag] 2. Vlahovic           [^][v]|
  | [drag] 3. Osimhen             [^][v]|
  +-----------------------------------+
  ```
- **Criteri di accettazione:**
  - [ ] Bottoni su/giu visibili accanto ad ogni voce
  - [ ] Bottoni navigabili da tastiera (Tab + Enter/Space)
  - [ ] Il primo elemento non ha bottone "su", l'ultimo non ha "giu"
  - [ ] Drag-and-drop resta funzionante come prima
  - [ ] `aria-label` su bottoni: "Sposta Lautaro Martinez in su"
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

## Priorita ALTA

> Alto impatto UX + Alto sforzo = Pianificare con cura

---

### TASK-006: Splitting componente Rubata.tsx (2000+ righe)

- **Pagina:** Rubata
- **Layout:** Tutti (S/M/C)
- **Problema:** Rubata.tsx ha 2000+ righe con 8+ stati della state machine, 6+ modal, logica Pusher, polling, heartbeat, e rendering del board. Impossibile da mantenere, testare, o ottimizzare. Ogni modifica rischia regressioni.
- **Proposta:** Decomporre in:
  ```
  src/pages/Rubata.tsx            (~200 righe - orchestratore)
  src/hooks/useRubataState.ts     (~400 righe - state machine + Pusher)
  src/components/rubata/
    RubataBoard.tsx               (~300 righe - board giocatori)
    RubataBidPanel.tsx            (~200 righe - controlli offerta)
    RubataTimerPanel.tsx          (~100 righe - timer + stato)
    RubataAdminControls.tsx       (~200 righe - pannello admin)
    RubataModals.tsx              (~400 righe - tutti i modal)
    RubataPreferences.tsx         (~200 righe - gestione preferenze)
  ```
- **File coinvolti:**
  - Refactorare: `src/pages/Rubata.tsx`
  - Creare: 7 nuovi file come sopra
- **Criteri di accettazione:**
  - [ ] Rubata.tsx principale < 300 righe
  - [ ] Ogni sotto-componente testabile indipendentemente
  - [ ] Hook useRubataState gestisce tutta la logica di stato
  - [ ] Nessuna regressione funzionale (tutti gli stati e modal funzionano)
  - [ ] I modal sono lazy-loaded
- **Sforzo stimato:** XL (2-5gg)
- **Dipendenze:** Nessuna

---

### TASK-007: Sostituire icone SVG inline con libreria icone

- **Pagina:** Trasversale (Navigation, tutte le pagine)
- **Layout:** Tutti (S/M/C)
- **Problema:** Navigation.tsx dedica 130+ righe a definizioni SVG inline per icone. Ogni pagina ha ulteriori SVG inline per icone. Questo:
  - Aumenta il bundle size
  - Rende inconsistenti dimensioni e stroke-width
  - Non permette tree-shaking
  - Rende il codice difficile da leggere
- **Proposta:** Adottare `lucide-react` (leggera, tree-shakeable, 1000+ icone):
  ```typescript
  // Prima:
  const MenuIcons = {
    dashboard: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0..." />
      </svg>
    ),
    // ... 15+ altre icone inline
  }

  // Dopo:
  import { Home, Settings, Users, Clock, Lightbulb, ArrowLeft } from 'lucide-react'
  const MenuIcons = {
    dashboard: <Home size={16} />,
    admin: <Settings size={16} />,
    allRosters: <Users size={16} />,
    history: <Clock size={16} />,
    prophecy: <Lightbulb size={16} />,
    back: <ArrowLeft size={16} />,
  }
  ```
- **File coinvolti:**
  - Installare: `lucide-react` (dipendenza)
  - Modificare: `src/components/Navigation.tsx` (rimuovere 130+ righe di SVG)
  - Modificare: tutte le pagine che hanno SVG inline per icone
- **Criteri di accettazione:**
  - [ ] Tutte le icone vengono da lucide-react
  - [ ] Dimensioni coerenti (16px per nav, 20px per azioni, 24px per header)
  - [ ] Bundle size non aumenta (lucide e' tree-shakeable)
  - [ ] Nessun SVG inline per icone standard
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### TASK-008: Aggiungere timer accessibility (non solo colore)

- **Pagina:** AuctionRoom, Rubata, Svincolati
- **Layout:** Tutti (S/M/C)
- **Problema:** Il timer dell'asta comunica urgenza solo tramite cambio colore (verde > giallo > rosso). Utenti daltonici non percepiscono il cambio. Le animazioni (pulse, shake, glow) aiutano ma non sono sufficienti per comunicare il livello di urgenza.
- **Proposta:**
  1. Aggiungere label testuale sotto il timer: "Tempo OK", "Affrettati!", "Ultimo secondo!"
  2. Aggiungere `aria-live="assertive"` sul container timer per screen reader
  3. Opzionale: navigator.vibrate() su mobile quando timer < 5s
  4. Aggiungere pattern/texture alle barre di progresso (non solo colore)
- **File coinvolti:**
  - Modificare: `src/components/AuctionTimer.tsx`
  - Modificare: CSS timer states in `src/index.css`
- **Wireframe:**
  ```
  +----------------------------+
  |         00:07              |
  |   [████████░░░░░░░░]      |
  |     "Affrettati!"         |
  +----------------------------+
  ```
- **Criteri di accettazione:**
  - [ ] Label testuale visibile sotto il timer che cambia con lo stato
  - [ ] `aria-live="assertive"` sul container quando timer < 10s
  - [ ] I tre stati (safe/warning/danger) sono distinguibili senza colore
  - [ ] Barra di progresso ha pattern/texture differente per ogni stato
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### TASK-009: Adottare libreria charting (recharts)

- **Pagina:** LeagueFinancials, PlayerStats, ManagerDashboard
- **Layout:** M/C
- **Problema:** I grafici sono implementati come SVG custom inline (DonutChart, BudgetBarChart, RadarChart). Sono fragili, non responsive, non accessibili, e difficili da mantenere. Non hanno tooltip, legenda interattiva, o resize automatico.
- **Proposta:** Adottare `recharts` (gia React-based, responsive, accessibile):
  - DonutChart > `<PieChart>` con `<Pie>`
  - BudgetBarChart > `<BarChart>` con `<Bar>`
  - RadarChart > `<RadarChart>` con `<Radar>`
  - Aggiungere: `<ResponsiveContainer>` per auto-resize
  - Aggiungere: `<Tooltip>` per dati on-hover
  - Aggiungere: `<Legend>` interattiva
- **File coinvolti:**
  - Installare: `recharts` (dipendenza)
  - Modificare: `src/pages/LeagueFinancials.tsx` (DonutChart, BudgetBarChart)
  - Modificare: `src/components/ui/RadarChart.tsx`
  - Modificare: `src/pages/PlayerStats.tsx` (comparison radar)
- **Criteri di accettazione:**
  - [ ] Tutti i grafici sono responsive (si adattano al container)
  - [ ] Tooltip visibili su hover/tap
  - [ ] Legenda interattiva (click per mostrare/nascondere serie)
  - [ ] Grafici accessibili con ruolo `img` e aria-label
  - [ ] Dark theme coerente con il design system
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** Nessuna

---

### TASK-010: Banner fasi di mercato con affordance chiara

- **Pagina:** LeagueDetail
- **Layout:** Tutti (S/M/C)
- **Problema:** I banner delle fasi di mercato (Primo Mercato, Contratti, Rubata, etc.) sono cliccabili ma non sembrano bottoni. L'utente potrebbe non capire che puo interagire con essi per navigare alla fase attiva.
- **Proposta:**
  - Aggiungere icona freccia destra nel banner
  - Hover effect piu marcato (translate-x o border highlight)
  - Testo CTA esplicito: "Vai alla fase >"
  - Su mobile: rendere il banner un bottone full-width con testo chiaro
- **File coinvolti:**
  - Modificare: `src/pages/LeagueDetail.tsx` (sezione fasi)
- **Wireframe:**
  ```
  +--------------------------------------------------+
  | [Emoji] Fase Attiva: Mercato Ricorrente          |
  |         Sessione #3 in corso          [Vai >]    |
  +--------------------------------------------------+
  ```
- **Criteri di accettazione:**
  - [ ] I banner mostrano chiaramente che sono cliccabili
  - [ ] Icona freccia visibile
  - [ ] Hover effect distintivo
  - [ ] Su mobile: CTA testuale "Vai alla fase"
  - [ ] `role="link"` o `<button>` semantico
- **Sforzo stimato:** XS (< 1h)
- **Dipendenze:** Nessuna

---

## Priorita MEDIA

> Quick win o impatto moderato

---

### TASK-011: Sostituire spinner con Skeleton loader dove disponibile

- **Pagina:** Dashboard, LeagueDetail, AllPlayers, Movements, Rose
- **Layout:** Tutti (S/M/C)
- **Problema:** Diverse pagine usano uno spinner generico durante il caricamento, nonostante `Skeleton.tsx` offra 9 varianti specializzate (SkeletonCard, SkeletonPlayerRow, SkeletonTableRow, SkeletonPage, etc.). Lo spinner non comunica cosa sta arrivando.
- **Proposta:** Sostituire `<LoadingScreen />` e spinner generici con le skeleton variants appropriate:
  - Dashboard: `SkeletonCard` x3 nel grid delle leghe
  - AllPlayers: `SkeletonPlayerRow` x10
  - Movements: `SkeletonTableRow` x10
  - Rose: `SkeletonPlayerRow` x10
- **File coinvolti:**
  - Modificare: `src/pages/Dashboard.tsx`, `src/pages/AllPlayers.tsx`, `src/pages/Movements.tsx`, `src/pages/Rose.tsx`, `src/pages/LeagueDetail.tsx`
  - Usare: `src/components/ui/Skeleton.tsx` (gia esistente)
- **Criteri di accettazione:**
  - [ ] Ogni pagina usa skeleton loader appropriato durante il caricamento
  - [ ] Le skeleton hanno dimensioni simili al contenuto reale (no layout shift)
  - [ ] L'animazione pulse e' coerente (2s cycle)
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### TASK-012: Creare componente EmptyState standardizzato

- **Pagina:** Trasversale
- **Layout:** Tutti (S/M/C)
- **Problema:** Gli empty state delle pagine sono basici: emoji + testo generico. Manca guida visiva su cosa fare, illustrazioni, e CTA esplicite. Ogni pagina implementa il suo empty state in modo diverso.
- **Proposta:** Creare componente riutilizzabile `<EmptyState>`:
  ```typescript
  interface EmptyStateProps {
    icon?: ReactNode | string  // emoji o componente icona
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
  ```
- **File coinvolti:**
  - Creare: `src/components/ui/EmptyState.tsx`
  - Modificare: `src/pages/Dashboard.tsx` (stato senza leghe)
  - Modificare: `src/pages/Movements.tsx` (nessun movimento)
  - Modificare: `src/pages/Prophecies.tsx` (nessuna profezia)
  - Modificare: `src/pages/Trades.tsx` (nessuno scambio)
- **Wireframe:**
  ```
  +-----------------------------------+
  |                                   |
  |          [Illustrazione]          |
  |                                   |
  |     Nessun movimento trovato     |
  |                                   |
  |  I movimenti appariranno qui     |
  |  quando inizieranno le sessioni  |
  |  di mercato.                     |
  |                                   |
  |     [Vai alla Dashboard]         |
  |                                   |
  +-----------------------------------+
  ```
- **Criteri di accettazione:**
  - [ ] Componente riutilizzabile con API pulita
  - [ ] Titolo, descrizione, e CTA opzionale
  - [ ] Centrato verticalmente nel container
  - [ ] Accessibile (heading semantico, bottone con aria-label)
  - [ ] Coerente con il design system (colori surface, typography)
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### TASK-013: Aggiungere legenda colori durata contratto

- **Pagina:** Rose, Contracts, ManagerDashboard
- **Layout:** Tutti (S/M/C)
- **Problema:** I contratti usano color-coding per durata (1yr=rosso, 2yr=giallo, 3yr=verde, 4yr=blu) ma non c'e' nessuna legenda visibile. Un utente nuovo non sa cosa significano i colori.
- **Proposta:** Aggiungere legenda compatta sotto i filtri o come tooltip informativo:
  ```
  Durata contratto: [1 anno] [2 anni] [3 anni] [4+ anni]
                      rosso    giallo   verde     blu
  ```
- **File coinvolti:**
  - Modificare: `src/pages/Rose.tsx` (sotto filtri)
  - Modificare: `src/pages/Contracts.tsx`
- **Wireframe:**
  ```
  Durata:  [1a] [2a] [3a] [4a+]
           red  yel  grn  blue
  ```
- **Criteri di accettazione:**
  - [ ] Legenda visibile sotto i filtri posizione
  - [ ] Colori corrispondono esattamente ai badge nella tabella
  - [ ] Su mobile: legenda compatta inline
  - [ ] Accessibile: non basata solo su colore (ha anche testo "1 anno", "2 anni", etc.)
- **Sforzo stimato:** XS (< 1h)
- **Dipendenze:** Nessuna

---

### TASK-014: Aggiungere stepper visivo per flusso Rubata

- **Pagina:** Rubata
- **Layout:** Tutti (S/M/C)
- **Problema:** La Rubata ha 8+ stati (WAITING, PREVIEW, READY_CHECK, OFFERING, AUCTION_READY_CHECK, AUCTION, PENDING_ACK, COMPLETED) con modal che appaiono in sequenza. L'utente non ha una visione d'insieme di dove si trova nel flusso e cosa viene dopo.
- **Proposta:** Aggiungere un componente stepper visivo in alto che mostra il flusso:
  ```
  [Attesa] > [Preview] > [Pronti?] > [Offerte] > [Asta] > [Conferma] > [Completato]
      done      done       active
  ```
- **File coinvolti:**
  - Creare: `src/components/ui/StepperProgress.tsx`
  - Modificare: `src/pages/Rubata.tsx` (aggiungere stepper in header)
- **Wireframe:**
  ```
  +--------------------------------------------------------------+
  | [v] Attesa > [v] Preview > [*] Pronti? > [ ] Offerte > ...  |
  +--------------------------------------------------------------+
  ```
- **Criteri di accettazione:**
  - [ ] Stepper mostra tutti gli step della Rubata
  - [ ] Step corrente evidenziato (primary color)
  - [ ] Step completati con checkmark (verde)
  - [ ] Step futuri grigi
  - [ ] Su mobile: solo step corrente con frecce prev/next
  - [ ] Accessibile: `aria-current="step"`, `aria-label` per ogni step
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna (ma utile se TASK-006 splitting e' fatto prima)

---

### TASK-015: Status badge contratto con tooltip spiegazione

- **Pagina:** Contracts, ManagerDashboard, Rose
- **Layout:** Tutti (S/M/C)
- **Problema:** I badge di stato contratto ("Da impostare", "Scaduto", "In scadenza", "Attivo") non spiegano cosa significano e cosa l'utente deve fare. Un nuovo utente non sa quale azione intraprendere per ogni stato.
- **Proposta:** Aggiungere tooltip (o tap-to-reveal su mobile) con:
  - Spiegazione dello stato
  - Azione richiesta dall'utente
  - Deadline se applicabile
- **File coinvolti:**
  - Modificare: `src/pages/Contracts.tsx` (badge stato)
  - Modificare: `src/pages/ManagerDashboard.tsx` (tab contratti)
- **Wireframe tooltip:**
  ```
  [Da impostare] <-- hover
  +-------------------------------------+
  | Contratto non ancora configurato.   |
  | Imposta salario e durata prima     |
  | della chiusura della fase.          |
  | Deadline: 15 Feb 2026              |
  +-------------------------------------+
  ```
- **Criteri di accettazione:**
  - [ ] Tooltip su hover (desktop) o tap (mobile) per ogni badge stato
  - [ ] Testo chiaro con azione suggerita
  - [ ] Deadline visibile se applicabile
  - [ ] Tooltip accessibile con `role="tooltip"` e `aria-describedby`
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### TASK-016: Aggiungere virtualizzazione liste lunghe

- **Pagina:** AllPlayers, Movements, Prophecies, PlayerStats
- **Layout:** Tutti (S/M/C)
- **Problema:** Le pagine con liste potenzialmente lunghe (AllPlayers limita a 100, Movements nessun limite, Prophecies usa infinite scroll) non usano virtualizzazione. Con molti elementi, il rendering e' pesante e lo scrolling puo essere janky.
- **Proposta:** Adottare `@tanstack/react-virtual` (o `react-window`) per:
  - AllPlayers: virtualizzare lista giocatori (potenzialmente 500+)
  - Movements: virtualizzare cronologia (potenzialmente 1000+)
  - Prophecies: gia usa infinite scroll, aggiungere virtualizzazione
  - PlayerStats: virtualizzare tabella statistiche
- **File coinvolti:**
  - Installare: `@tanstack/react-virtual` (dipendenza)
  - Modificare: `src/pages/AllPlayers.tsx`, `src/pages/Movements.tsx`, `src/pages/Prophecies.tsx`, `src/pages/PlayerStats.tsx`
- **Criteri di accettazione:**
  - [ ] Liste con 100+ elementi renderizzano solo le righe visibili
  - [ ] Scrolling smooth (60fps)
  - [ ] Nessuna regressione visiva (altezze righe preservate)
  - [ ] Funziona con sorting e filtering
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### TASK-017: Migliorare form contratto su mobile con BottomSheet

- **Pagina:** Contracts
- **Layout:** S/M
- **Problema:** Modificare salario, durata, e clausola di un contratto su mobile richiede precisione su campi piccoli nella tabella. DurationSlider e NumberStepper esistono gia ma non sono usati in un layout mobile-friendly.
- **Proposta:** Su mobile, tap su un contratto apre BottomSheet dedicato con:
  - Player info in alto (nome, ruolo, team)
  - DurationSlider full-width per durata
  - NumberStepper full-width per salario
  - NumberStepper per clausola
  - Bottoni Salva/Annulla
- **File coinvolti:**
  - Modificare: `src/pages/Contracts.tsx`
  - Usare: `src/components/ui/BottomSheet.tsx`, `DurationSlider.tsx`, `NumberStepper.tsx`
- **Wireframe BottomSheet:**
  ```
  +-----------------------------------+
  | Modifica Contratto            [X] |
  +-----------------------------------+
  |                                   |
  |  [Photo] Lautaro Martinez   [A]  |
  |  Inter                           |
  |                                   |
  |  Durata:                         |
  |  [------|------o------]          |
  |  1 anno  2 anni  3 anni  4 anni |
  |                                   |
  |  Salario:                        |
  |  [- ]  [  8.5M  ]  [+ ]         |
  |                                   |
  |  Clausola Rescissoria:           |
  |  [- ]  [ 15.0M  ]  [+ ]         |
  |                                   |
  |  [Annulla]        [Salva]        |
  +-----------------------------------+
  ```
- **Criteri di accettazione:**
  - [ ] Su mobile (<768px), tap su contratto apre BottomSheet
  - [ ] DurationSlider usabile con un dito
  - [ ] NumberStepper con bottoni 44x44px
  - [ ] Validazione inline (salario min/max)
  - [ ] Su desktop, il form resta inline nella tabella
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

## Priorita BASSA

> Basso impatto o nice-to-have

---

### TASK-018: Sidebar Rosa collassabile su desktop stretto

- **Pagina:** Rose
- **Layout:** M/C
- **Problema:** Su laptop 1280px, la sidebar del manager nella pagina Rosa occupa spazio che potrebbe servire alla tabella. Non c'e' modo di collassarla.
- **Proposta:** Aggiungere toggle per collassare la sidebar, mostrando solo icone quando collassata.
- **File coinvolti:** `src/pages/Rose.tsx`
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### TASK-019: Aggiungere filtro data/periodo a Movements

- **Pagina:** Movements
- **Layout:** M/C
- **Problema:** Con molti movimenti storici, l'utente non puo filtrare per periodo o sessione.
- **Proposta:** Aggiungere dropdown filtro per sessione/semestre in header.
- **File coinvolti:** `src/pages/Movements.tsx`
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### TASK-020: Full-page comparison view per PlayerStats

- **Pagina:** PlayerStats
- **Layout:** M/C
- **Problema:** Il confronto giocatori avviene in un modal 576px che e' troppo stretto per confrontare 4 giocatori con radar chart e tabella stats.
- **Proposta:** Creare pagina/view dedicata per il confronto con layout side-by-side su desktop e card stack su mobile.
- **File coinvolti:** `src/pages/PlayerStats.tsx`, eventualmente nuova pagina `PlayerComparison.tsx`
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** TASK-009 (recharts per radar chart migliorato)

---

### TASK-021: Raggruppare colonne PlayerStats per categoria

- **Pagina:** PlayerStats
- **Layout:** M/C
- **Problema:** Il column selector ha molte colonne in un dropdown piatto. Difficile trovare la statistica giusta.
- **Proposta:** Raggruppare colonne per categoria (Generali, Attacco, Difesa, Passaggio, Disciplina) con toggle per gruppo intero.
- **File coinvolti:** `src/pages/PlayerStats.tsx`
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### TASK-022: Aggiungere aria-label a tutti i pulsanti icon-only

- **Pagina:** Trasversale
- **Layout:** Tutti
- **Problema:** Alcuni pulsanti (close button nei modal, toggle sidebar, filtri posizione) hanno solo icona senza `aria-label`. Screen reader non possono comunicare la funzione del pulsante.
- **Proposta:** Audit completo dei pulsanti icon-only e aggiunta di `aria-label` appropriato.
- **File coinvolti:** Multipli (audit necessario)
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### TASK-023: Aggiungere scope e aria-sort alle tabelle

- **Pagina:** Rose, Movements, LeagueFinancials, PlayerStats, AdminPanel
- **Layout:** Tutti
- **Problema:** Le tabelle HTML non hanno `scope="col"` sugli header e `aria-sort` sulle colonne sortabili. Screen reader non possono comunicare la struttura e l'ordinamento della tabella.
- **Proposta:** Aggiungere `scope="col"` a tutti i `<th>`, `aria-sort="ascending|descending|none"` dove applicabile.
- **File coinvolti:** Tutte le pagine con tabelle
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

## Nice-to-Have (Futuri)

---

### TASK-030: Command Palette (Ctrl+K)

- **Pagina:** Trasversale
- **Layout:** C
- **Problema:** Power user devono navigare tramite menu. Nessun modo rapido per saltare a una pagina o cercare un giocatore.
- **Proposta:** Implementare command palette accessibile da Ctrl+K / Cmd+K con ricerca fuzzy su: pagine, giocatori, azioni (crea sessione, esporta dati).
- **File coinvolti:** Nuovo `src/components/CommandPalette.tsx`, `src/App.tsx`
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** Nessuna

---

### TASK-031: Dashboard drag-and-drop widget configurabili

- **Pagina:** Dashboard, ManagerDashboard
- **Layout:** C
- **Problema:** La dashboard ha layout fisso. Un power user vorrebbe personalizzare quali widget vedere e dove.
- **Proposta:** Usare @dnd-kit (gia installato) per creare griglia widget drag-and-drop con salvataggio preferenze in LocalStorage.
- **File coinvolti:** Nuovi componenti widget, modifiche Dashboard
- **Sforzo stimato:** XL (2-5gg)
- **Dipendenze:** TASK-001 (DataTable per widget tabellari)

---

### TASK-032: Keyboard shortcuts per power user

- **Pagina:** AuctionRoom, Rubata
- **Layout:** C
- **Problema:** Durante l'asta, ogni secondo conta. Usare il mouse per cliccare "Offri" e' lento.
- **Proposta:**
  - `Enter`: Conferma offerta
  - `+`/`-`: Incrementa/decrementa offerta
  - `Esc`: Annulla offerta
  - `Space`: Passa turno
  - Mostrare shortcut hint accanto ai bottoni
- **File coinvolti:** `src/pages/AuctionRoom.tsx`, `src/pages/Rubata.tsx`
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### TASK-033: Alert configurabili per manager

- **Pagina:** Nuova (Settings/Preferences)
- **Layout:** C
- **Problema:** L'utente non ha modo di configurare notifiche personalizzate (es. "avvisami se il valore di un giocatore scende sotto X").
- **Proposta:** Creare sezione Alert nel profilo utente con regole personalizzabili.
- **File coinvolti:** Nuovi componenti e API
- **Sforzo stimato:** XL (2-5gg)
- **Dipendenze:** Backend API

---

### TASK-034: Sparkline inline nelle tabelle

- **Pagina:** LeagueFinancials, PlayerStats
- **Layout:** C
- **Problema:** I trend storici non sono visibili nelle tabelle. L'utente deve espandere la riga o navigare a un'altra pagina per vedere l'andamento.
- **Proposta:** Aggiungere mini sparkline (30x16px) nelle celle tabella per mostrare trend ultimi 6 mesi.
- **File coinvolti:** Nuovo componente `Sparkline.tsx`, modifiche alle tabelle
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** TASK-009 (recharts)

---

## Riepilogo per Sforzo

| Sforzo | Tasks | Ore Stimate |
|--------|-------|-------------|
| XS (< 1h) | TASK-010, TASK-013 | ~2h |
| S (1-3h) | TASK-005, TASK-008, TASK-011, TASK-012, TASK-015, TASK-018, TASK-019, TASK-021, TASK-022, TASK-023 | ~20h |
| M (3-8h) | TASK-004, TASK-007, TASK-014, TASK-016, TASK-017, TASK-020, TASK-032, TASK-034 | ~44h |
| L (1-2gg) | TASK-001, TASK-002, TASK-009, TASK-030 | ~6gg |
| XL (2-5gg) | TASK-003, TASK-006, TASK-031, TASK-033 | ~14gg |

**Totale stimato: ~24 giorni di lavoro**

## Percorso Consigliato di Implementazione

### Sprint 1 (Quick Wins - 1 settimana)
1. TASK-010: Banner fasi con affordance (XS)
2. TASK-013: Legenda colori durata (XS)
3. TASK-011: Skeleton loader dove disponibile (S)
4. TASK-012: Componente EmptyState (S)
5. TASK-005: Alternativa keyboard DnD Rubata (S)
6. TASK-008: Timer accessibility (S)
7. TASK-022: aria-label pulsanti icon-only (S)
8. TASK-023: scope/aria-sort tabelle (S)

### Sprint 2 (Fondamenta - 2 settimane)
1. TASK-001: DataTable responsivo (L) -- fondamentale per 8 pagine
2. TASK-007: Libreria icone lucide-react (M)
3. TASK-004: Movements mobile card layout (M)
4. TASK-015: Tooltip status contratto (S)

### Sprint 3 (Refactoring Core - 2 settimane)
1. TASK-002: AdminPanel tab mobile + splitting (L)
2. TASK-006: Splitting Rubata.tsx (XL)
3. TASK-009: Adozione recharts (L)
4. TASK-014: Stepper visivo Rubata (M)

### Sprint 4 (Polish & Power Features - 2 settimane)
1. TASK-003: Consolidamento layout asta (XL)
2. TASK-016: Virtualizzazione liste (M)
3. TASK-017: BottomSheet contratti mobile (M)
4. TASK-020: Full-page comparison PlayerStats (M)

### Backlog Futuro
- TASK-030, TASK-031, TASK-032, TASK-033, TASK-034

---

*Backlog generato tramite analisi statica del codice sorgente. Nessun file del progetto e' stato modificato. Tutte le stime sono indicative e dipendono dalla familiarita del team con il codebase.*
