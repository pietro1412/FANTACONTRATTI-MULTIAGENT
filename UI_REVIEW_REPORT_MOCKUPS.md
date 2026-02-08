# UI Review Report -- Mockup & Motivazioni

> Companion di: `UI_REVIEW_REPORT.md`
> Questo documento visualizza i problemi identificati con wireframe BEFORE/AFTER e spiega la motivazione di ogni proposta.

---

## Indice

1. [Pattern #1: Tabelle Dense Non Responsive](#pattern-1)
2. [Pattern #2: SVG Icons Inline](#pattern-2)
3. [Pattern #3: Pagine Monolitiche](#pattern-3)
4. [Pattern #4: Mancanza Virtualizzazione](#pattern-4)
5. [Pattern #5: Empty States Basici](#pattern-5)
6. [Pattern #6: Breadcrumbs Assenti su Mobile](#pattern-6)
7. [Dashboard: Proposte Layout S/M/C](#dashboard-layouts)
8. [LeagueFinancials: Proposte Layout S/M/C](#financials-layouts)
9. [AuctionRoom: Proposte Layout S/M/C](#auction-layouts)
10. [Rose: Problemi Responsiveness](#rose-responsive)
11. [AdminPanel: Tab Overflow Mobile](#admin-tabs)
12. [Rubata: Flusso Stati Confuso](#rubata-flow)

---

<a id="pattern-1"></a>
## Pattern #1: Tabelle Dense Non Responsive

**Affligge:** Rose, Movements, LeagueFinancials, PlayerStats, AdminPanel, Contracts, ManagerDashboard, PrizePhasePage (8 pagine)

### Motivazione

Le tabelle con 10-13+ colonne sono il pattern piu critico dell'applicazione. Attualmente viene usato `hidden lg:table-cell` per nascondere colonne su mobile, ma questo:
- **Nasconde dati senza avvisare:** L'utente non sa che ci sono altre colonne
- **Perde contesto:** Su mobile vede solo 3-4 colonne delle 11+ disponibili
- **Nessun modo di recuperare:** I dati nascosti non sono accessibili

### BEFORE: Rose su Mobile (375px)

```
+-----------------------------------+
| Giocatore    | Ruolo | Salario   |
|--------------|-------|-----------|
| Lautaro      |   A   | 8.5M     |
| Barella      |   C   | 7.2M     |
| Bastoni      |   D   | 6.0M     |
| Sommer       |   P   | 4.5M     |
+-----------------------------------+

  PROBLEMA: Dove sono le altre 8 colonne?
  - Team? NASCOSTO
  - Presenze? NASCOSTO
  - Gol? NASCOSTO
  - Assist? NASCOSTO
  - Rating? NASCOSTO
  - Durata contratto? NASCOSTO
  - Clausola? NASCOSTO
  - Valore rubata? NASCOSTO

  L'utente NON SA che questi dati esistono.
```

### AFTER: Rose su Mobile con Card Layout

```
+-----------------------------------+
| [Filtri: P D C A] [Cerca...]     |
+-----------------------------------+
|                                   |
| +-------------------------------+ |
| | [A] Lautaro Martinez          | |
| |     Inter - 28 anni           | |
| |                               | |
| | Salario: 8.5M  Durata: 3a    | |
| | Quot: 35M       Rating: 7.2  | |
| |                               | |
| | [v] Dettagli completi         | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | [C] Nicolo Barella            | |
| |     Inter - 27 anni           | |
| |                               | |
| | Salario: 7.2M  Durata: 2a    | |
| | Quot: 28M       Rating: 7.0  | |
| |                               | |
| | [v] Dettagli completi         | |
| +-------------------------------+ |
|                                   |
+-----------------------------------+

  ESPANSO (tap su "Dettagli completi"):
  +-------------------------------+
  | [A] Lautaro Martinez          |
  |     Inter - 28 anni           |
  |                               |
  | Salario: 8.5M  Durata: 3a    |
  | Quot: 35M       Rating: 7.2  |
  |                               |
  | --- Statistiche ---           |
  | Presenze: 25  Gol: 18        |
  | Assist: 5     Media: 7.2     |
  |                               |
  | --- Contratto ---             |
  | Clausola: 15M                 |
  | Valore Rubata: 5M             |
  | Scadenza: 2028                |
  |                               |
  | [Vedi Stats]  [Modifica]      |
  +-------------------------------+
```

### AFTER: Rose su Tablet (768px) con Scroll Indicator

```
+-------------------------------------------------------+
|                                          Scorri >>>    |
| Giocatore    | Ruolo | Team  | Sal  | Dur | Quot |////|
|--------------|-------|-------|------|-----|------|////|
| Lautaro      |   A   | Inter | 8.5M | 3a | 35M  |////|
| Barella      |   C   | Inter | 7.2M | 2a | 28M  |////|
+-------------------------------------------------------+
                                               ^^^
                                    Gradient shadow che
                                    indica "ci sono altre
                                    colonne a destra"
```

### Perche funziona meglio

| Aspetto | Before | After |
|---------|--------|-------|
| Dati visibili su mobile | 3-4 colonne (27%) | Tutti i dati (100%) |
| Discoverability | L'utente non sa cosa manca | Expand esplicito |
| Touch target | Righe tabella piccole | Card grandi, touch-friendly |
| Leggibilita | Testo compresso | Spaziatura generosa |
| Orientamento | Nessun contesto | Badge posizione + team prominente |

---

<a id="pattern-2"></a>
## Pattern #2: SVG Icons Inline

**Affligge:** Navigation.tsx (130+ righe), tutte le pagine

### Motivazione

Ogni icona e' un blocco SVG di 3-5 righe definito inline come JSX. Questo:
- **Gonfia il codice:** 130+ righe solo per definire icone in Navigation.tsx
- **Inconsistenza:** Ogni SVG puo avere stroke-width, dimensioni, e viewBox diversi
- **Non tree-shakeable:** Tutte le icone sono nel bundle anche se non usate
- **Difficile da cercare:** Per trovare dove e' usata un'icona, devi cercare il path SVG

### BEFORE: Navigation.tsx

```typescript
// 130+ righe di definizioni SVG...
const MenuIcons = {
  dashboard: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
         stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001
               1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6
               0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011
               1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  admin: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
         stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35
               0a1.724 1.724 0 002.573 1.066c1.543-.94..." />
    </svg>
  ),
  // ... altre 13+ icone, ognuna 5-7 righe ...
}
```

### AFTER: Con lucide-react

```typescript
import {
  Home, Settings, Users, Clock, Lightbulb,
  ArrowLeft, Trophy, UserPlus, BarChart3,
  DollarSign, Upload, ChevronRight,
  Shield, FileText, MessageSquare
} from 'lucide-react'

const MenuIcons = {
  dashboard:   <Home size={16} />,
  admin:       <Settings size={16} />,
  allRosters:  <Users size={16} />,
  history:     <Clock size={16} />,
  prophecy:    <Lightbulb size={16} />,
  back:        <ArrowLeft size={16} />,
  financials:  <DollarSign size={16} />,
  stats:       <BarChart3 size={16} />,
  upload:      <Upload size={16} />,
  strategy:    <Shield size={16} />,
  patchNotes:  <FileText size={16} />,
  feedbackHub: <MessageSquare size={16} />,
  chevronRight: <ChevronRight size={12} />,
}
```

### Perche funziona meglio

| Aspetto | Before (SVG Inline) | After (lucide-react) |
|---------|---------------------|---------------------|
| Righe di codice | 130+ righe | 15 righe |
| Consistenza | Variabile (stroke, size) | Uniforme (size prop) |
| Tree-shaking | No (tutto nel bundle) | Si (solo icone usate) |
| Manutenzione | Cercare path SVG | Cercare nome icona |
| Nuove icone | Trovare SVG, copiare path | `import { NomeIcona }` |
| Dimensioni | Classe CSS (`w-4 h-4`) | Prop (`size={16}`) |

---

<a id="pattern-3"></a>
## Pattern #3: Pagine Monolitiche

**Affligge:** Rubata.tsx (2000+ righe), AdminPanel.tsx (1573 righe), Contracts.tsx (~29KB)

### Motivazione

Componenti troppo grandi causano:
- **Rendering pesante:** React ri-renderizza tutto anche per cambi di stato minimi
- **Difficolta di test:** Impossibile testare singole parti
- **Merge conflicts:** Piu sviluppatori sullo stesso file
- **Lazy loading impossibile:** Non si possono caricare parti on-demand

### BEFORE: Rubata.tsx (2000+ righe in un file)

```
Rubata.tsx
+--------------------------------------------------+
|  useState x 25+                                   |
|  useEffect x 10+                                  |
|  useCallback x 15+                                |
|  useMemo x 5+                                     |
|                                                    |
|  // Pusher handlers (200 righe)                   |
|  // State machine logic (300 righe)               |
|  // Board rendering (400 righe)                   |
|  // Bid panel (200 righe)                         |
|  // Timer logic (100 righe)                       |
|  // Admin controls (200 righe)                    |
|  // Modal: Transaction ACK (100 righe)            |
|  // Modal: Ready Check (80 righe)                 |
|  // Modal: Appeal (100 righe)                     |
|  // Modal: Appeal Decision (80 righe)             |
|  // Modal: Resume Check (60 righe)                |
|  // Modal: Preference (80 righe)                  |
|  // Preference ordering DnD (100 righe)           |
|  // Contract modification (80 righe)              |
|  // Prophecy input (60 righe)                     |
|                                                    |
|  return (                                          |
|    <div> ... 400+ righe di JSX ... </div>         |
|  )                                                 |
+--------------------------------------------------+
   TUTTO in UN SOLO FILE = 2000+ righe
```

### AFTER: Rubata decomposed

```
src/pages/Rubata.tsx (~200 righe - orchestratore)
+--------------------------------------------------+
|  import { useRubataState } from '../hooks/...'    |
|  import { RubataBoard } from '../components/...'  |
|  import { RubataBidPanel } from '...'             |
|  import { RubataModals } from '...'               |
|                                                    |
|  export function Rubata({ leagueId, onNavigate }) |
|    const state = useRubataState(leagueId)         |
|                                                    |
|    return (                                        |
|      <RubataTimerPanel ... />                     |
|      <RubataBoard ... />                          |
|      <RubataBidPanel ... />                       |
|      <RubataAdminControls ... />                  |
|      <RubataModals ... />                         |
|    )                                               |
|  }                                                 |
+--------------------------------------------------+

src/hooks/useRubataState.ts (~400 righe)
+--------------------------------------------------+
|  // State machine con tutti gli stati             |
|  // Pusher event handlers                         |
|  // Polling logic                                 |
|  // Heartbeat                                     |
|  // API calls                                     |
|  export function useRubataState(leagueId) {       |
|    return { phase, board, bids, actions, ... }    |
|  }                                                 |
+--------------------------------------------------+

src/components/rubata/
  RubataBoard.tsx (~300 righe)
  RubataBidPanel.tsx (~200 righe)
  RubataTimerPanel.tsx (~100 righe)
  RubataAdminControls.tsx (~200 righe)
  RubataModals.tsx (~400 righe)
  RubataPreferences.tsx (~200 righe)
```

### Perche funziona meglio

| Aspetto | Before (Monolite) | After (Decomposed) |
|---------|-------------------|---------------------|
| Righe per file | 2000+ | Max 400 |
| Testabilita | Impossibile isolare | Ogni parte testabile |
| Re-rendering | Tutto ad ogni cambio stato | Solo componente affetto |
| Code review | Diff incomprensibili | Diff focalizzati |
| Lazy loading | Impossibile | Modali lazy-loadabili |
| Onboarding | Settimane per capire | Struttura chiara |

---

<a id="pattern-4"></a>
## Pattern #4: Mancanza Virtualizzazione

**Affligge:** AllPlayers, Movements, Prophecies, PlayerStats, Rose

### Motivazione

Liste con 100+ elementi renderizzano tutti i DOM node contemporaneamente. Questo:
- **Rallenta il rendering iniziale:** 500 giocatori = 500 righe DOM
- **Scrolling janky:** Il browser deve gestire migliaia di nodi
- **Memoria:** Ogni nodo occupa memoria anche se fuori viewport

### BEFORE: AllPlayers senza virtualizzazione

```
Viewport (visibile):
+-----------------------------------+
| Giocatore 1                       |  <- Renderizzato
| Giocatore 2                       |  <- Renderizzato
| Giocatore 3                       |  <- Renderizzato
| Giocatore 4                       |  <- Renderizzato
| Giocatore 5                       |  <- Renderizzato
+-----------------------------------+
  Giocatore 6                          <- Renderizzato (ma non visibile!)
  Giocatore 7                          <- Renderizzato (ma non visibile!)
  ...
  Giocatore 498                        <- Renderizzato (ma non visibile!)
  Giocatore 499                        <- Renderizzato (ma non visibile!)
  Giocatore 500                        <- Renderizzato (ma non visibile!)

  TOTALE DOM NODES: 500 righe x ~15 elementi ciascuna = ~7500 nodi
  VISIBILI: solo 5 righe = ~75 nodi
  SPRECO: 99% dei nodi sono fuori viewport
```

### AFTER: Con @tanstack/react-virtual

```
Viewport (visibile):
+-----------------------------------+
|  [spacer: 0px]                    |  <- Placeholder vuoto
| Giocatore 1                       |  <- Renderizzato
| Giocatore 2                       |  <- Renderizzato
| Giocatore 3                       |  <- Renderizzato
| Giocatore 4                       |  <- Renderizzato
| Giocatore 5                       |  <- Renderizzato
| Giocatore 6                       |  <- Renderizzato (buffer)
| Giocatore 7                       |  <- Renderizzato (buffer)
+-----------------------------------+
  [spacer: 29360px]                    <- Placeholder vuoto (no DOM)

  TOTALE DOM NODES: 7 righe x ~15 = ~105 nodi
  RIDUZIONE: da ~7500 a ~105 nodi (98.6% in meno)
  SCROLLING: Smooth 60fps
```

---

<a id="pattern-5"></a>
## Pattern #5: Empty States Basici

**Affligge:** Dashboard, Movements, Prophecies, Trades, e altre pagine

### Motivazione

Gli empty state attuali sono solo un'emoji + testo generico. Non guidano l'utente su cosa fare, non spiegano perche la lista e' vuota, e non offrono azioni.

### BEFORE: Empty state generico

```
+-----------------------------------+
|                                   |
|                                   |
|                                   |
|               📭                  |
|                                   |
|     Nessun movimento trovato      |
|                                   |
|                                   |
|                                   |
+-----------------------------------+

  PROBLEMI:
  - L'utente non sa PERCHE' e' vuoto
  - Non sa COSA FARE per popolare
  - Nessuna CTA per l'azione successiva
  - Visivamente povero
```

### AFTER: Empty state informativo con CTA

```
+-----------------------------------+
|                                   |
|         +---------------+        |
|         |    [icon]      |        |
|         |   Cronologia   |        |
|         |   vuota        |        |
|         +---------------+        |
|                                   |
|    Nessun Movimento Trovato       |
|                                   |
|    I movimenti appariranno qui    |
|    quando verranno completate     |
|    le sessioni di mercato della   |
|    tua lega.                      |
|                                   |
|    +---------------------------+  |
|    |   Vai alla Dashboard      |  |
|    +---------------------------+  |
|                                   |
|    Oppure chiedi all'admin di    |
|    avviare una sessione.         |
|                                   |
+-----------------------------------+

  MIGLIORAMENTI:
  + Icona/illustrazione distintiva
  + Titolo chiaro
  + Spiegazione del perche
  + CTA primaria per azione successiva
  + Suggerimento secondario
```

---

<a id="pattern-6"></a>
## Pattern #6: Breadcrumbs Assenti su Mobile

**Affligge:** Tutte le pagine league-specific su mobile

### Motivazione

I breadcrumbs sono `hidden md:flex lg:hidden` -- nascosti sia su mobile che su desktop grande. Su mobile l'utente non sa in quale lega si trova ne in quale sezione.

### BEFORE: Mobile senza contesto

```
+-----------------------------------+
| [=] [Logo] Fantacontratti  [...] |
+-----------------------------------+
|                                   |
|  [Contenuto pagina Finanze]      |
|  ...ma di quale lega?            |
|  ...dove sono?                   |
|                                   |
+-----------------------------------+

  L'utente vede "Finanze" ma non sa:
  - Di quale lega sta vedendo le finanze
  - Come tornare alla dashboard della lega
  - Dove si trova nella gerarchia
```

### AFTER: Mobile con context bar compatta

```
+-----------------------------------+
| [=] [Logo] Fantacontratti  [...] |
+-----------------------------------+
| Serie A Dynasty > Finanze        |
+-----------------------------------+
|                                   |
|  [Contenuto pagina Finanze]      |
|  Ora l'utente sa:                |
|  - E' nella lega "Serie A"      |
|  - Sta guardando "Finanze"       |
|  - Puo tap su "Serie A" per     |
|    tornare alla dashboard lega   |
|                                   |
+-----------------------------------+

  Barra di contesto:
  +-----------------------------------+
  | [<] Serie A Dynasty  >  Finanze  |
  +-----------------------------------+
       ^                     ^
       |                     |
  Tap = vai a              Pagina
  dashboard lega           corrente
```

---

<a id="dashboard-layouts"></a>
## Dashboard: Proposte Layout S/M/C

### Layout SIMPLE -- "Quick Glance Manager"

**Filosofia:** Apri l'app, capisci la situazione in 5 secondi, chiudi.

```
MOBILE (375px)
+-----------------------------------+
| [=] Fantacontratti         [A]   |
+-----------------------------------+
|                                   |
| +-------------------------------+ |
| |  Le Tue Leghe                 | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | SERIE A DYNASTY               | |
| | +---------+ +---------+      | |
| | | Budget  | | Giocatori|     | |
| | | 145.2M  | | 18/25   |      | |
| | +---------+ +---------+      | |
| |                               | |
| | Fase: Mercato Ricorrente     | |
| |                               | |
| | [====== Vai alla Lega ======]| |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | LEGA CHAMPIONS                | |
| | +---------+ +---------+      | |
| | | Budget  | | Giocatori|     | |
| | | 89.7M   | | 22/25   |      | |
| | +---------+ +---------+      | |
| |                               | |
| | Fase: Contratti              | |
| |                               | |
| | [====== Vai alla Lega ======]| |
| +-------------------------------+ |
|                                   |
+-----------------------------------+
```

**Regole applicate:**
- Max 2 KPI per card (Budget + Giocatori)
- Un solo CTA per card
- Nessun filtro/ricerca
- Font generoso, molto spazio bianco
- Usabile con una mano

---

### Layout MEDIUM -- "Engaged Manager"

**Filosofia:** Esplora i dati, fai confronti, prendi decisioni informate.

```
DESKTOP (1440px)
+--------------------------------------------------------------------+
| [Logo]  Fantacontratti    [Cerca Leghe]  [+ Crea]    [Bell] [A v] |
+--------------------------------------------------------------------+
|                                                                     |
| +----------+ +----------+ +----------+ +----------+                |
| | Leghe    | | Giocatori| | Budget   | | Contratti|                |
| | Attive   | | Totali   | | Totale   | | In Scad. |               |
| |    2     | |   40/50  | |  234.9M  | |    3     |                |
| +----------+ +----------+ +----------+ +----------+                |
|                                                                     |
| +---------------------------+ +---------------------------+         |
| | SERIE A DYNASTY           | | LEGA CHAMPIONS            |        |
| | +---------+---------+     | | +---------+---------+     |        |
| | | Budget  |Giocatori|     | | | Budget  |Giocatori|     |        |
| | | 145.2M  | 18/25   |     | | |  89.7M  | 22/25   |     |       |
| | +---------+---------+     | | +---------+---------+     |        |
| |                           | |                           |         |
| | Fase: Mercato Ric.       | | Fase: Contratti           |         |
| |                           | |                           |         |
| | Prossima azione:         | | Prossima azione:          |        |
| | "3 contratti da          | | "Imposta rinnovi per      |        |
| |  confermare"             | |  5 giocatori"             |         |
| |                           | |                           |         |
| | [Dashboard] [Rosa] [>]   | | [Dashboard] [Contratti]   |        |
| +---------------------------+ +---------------------------+         |
|                                                                     |
| +--------------------------------------------------------------+   |
| | Ultime Notifiche                                  [Vedi tutte]|  |
| |--------------------------------------------------------------|   |
| | [SC] Mario ha proposto uno scambio per Lautaro      2h fa   |   |
| | [RB] Sessione rubata #4 aperta                      ieri    |   |
| | [CT] 3 contratti in scadenza in Serie A Dynasty      3gg    |   |
| +--------------------------------------------------------------+   |
+--------------------------------------------------------------------+
```

**Aggiunte rispetto a SIMPLE:**
- 4 KPI aggregati multi-lega in alto
- "Prossima azione" suggerita per ogni lega
- Quick actions multipli su ogni card
- Feed notifiche recenti in basso
- Barra ricerca per cercare leghe

---

### Layout COMPLEX -- "Analytics Power User"

**Filosofia:** Massimo controllo, personalizzazione, analisi avanzate.

```
DESKTOP (1920px)
+------------------------------------------------------------------------+
| [Logo]  |  [Ctrl+K Quick Search]  |               [Bell] [Theme] [Av] |
+------------------------------------------------------------------------+
| +-- Tab: Serie A --+-- Tab: Champions --+-- Tab: Analisi Budget --+    |
| |                   |                    |                          |    |
| | KPI Row:          |                    |                          |    |
| | Budget  GC   $/GC | Budget  GC   $/GC | [Budget Trend Line Chart]|   |
| | 145.2M 18   8.1M  | 89.7M  22   4.1M  | 6 mesi, tutte le leghe  |   |
| |                   |                    |                          |    |
| | +-- Heatmap ----+ | +-- Calendar ---+ | +-- Scatter Plot ------+|   |
| | | Copertura Rosa | | | Feb 2026      | | | Ogni lega = punto    ||   |
| | |  P  D  C  A   | | | L M M G V S D | | | X: Budget            ||   |
| | | [2][5][6][5]  | | | . . . 1 . . . | | | Y: Giocatori         ||   |
| | | Completa: 72% | | | . . . . 2 . . | | | Size: Performance    ||   |
| | +---------------+ | | . 3 . . . . . | | +--------------------+||   |
| |                   | +----------------+ |                          |   |
| | +-- Alert Feed -+ |                    | +-- Export Panel ------+|   |
| | | ! 3 contratti  | |                    | | [CSV] [PDF] [Excel]  ||   |
| | |   in scadenza  | |                    | | Periodo: [v]         ||   |
| | | ! Budget < 30M | |                    | | Colonne: [v]         ||   |
| | +---------------+ |                    | +--------------------+||   |
| +-------------------+--------------------+--------------------------+  |
+------------------------------------------------------------------------+

  Ctrl+K Command Palette:
  +----------------------------------------------+
  | > Cerca pagina, giocatore, azione...         |
  |----------------------------------------------|
  | [icon] Vai a: Serie A > Finanze             |
  | [icon] Vai a: Champions > Rosa             |
  | [icon] Giocatore: Lautaro Martinez          |
  | [icon] Azione: Crea nuova sessione         |
  | [icon] Azione: Esporta dati budget         |
  +----------------------------------------------+
```

**Aggiunte rispetto a MEDIUM:**
- Multi-tab workspace (tipo IDE) con tab persistenti per ogni lega
- Command palette Ctrl+K per accesso rapido
- Heatmap copertura rosa per posizione
- Scatter plot multi-lega (budget vs giocatori)
- Calendar con eventi prossimi
- Alert feed configurabile
- Export multi-formato con opzioni
- Tab "Analisi Budget" cross-lega

---

<a id="financials-layouts"></a>
## LeagueFinancials: Proposte Layout S/M/C

### Layout SIMPLE -- "Quick Budget Check"

```
MOBILE (375px)
+-----------------------------------+
| [<] Finanze                       |
+-----------------------------------+
|                                   |
| Il Tuo Budget                    |
| +-------------------------------+ |
| |                               | |
| |  +-----------+-----------+   | |
| |  | Budget    | Speso     |   | |
| |  | 145.2M    | 87.3M     |   | |
| |  +-----------+-----------+   | |
| |                               | |
| |  +-----------+-----------+   | |
| |  | Bilancio  | Slot      |   | |
| |  | +57.9M    | 7/25      |   | |
| |  +-----------+-----------+   | |
| |                               | |
| +-------------------------------+ |
|                                   |
| Classifica Budget                |
| +-------------------------------+ |
| | 1. FC Mario       145.2M     | |
| |    ████████████████░░░  87%   | |
| |                               | |
| | 2. AC Luigi       132.1M     | |
| |    ██████████████░░░░  79%    | |
| |                               | |
| | 3. AS Peach       128.9M     | |
| |    █████████████░░░░░  77%    | |
| |                               | |
| | 4. US Toad        115.3M     | |
| |    ████████████░░░░░░  69%    | |
| +-------------------------------+ |
+-----------------------------------+

  Solo 4 KPI + classifica semplice
  Nessun grafico complesso
  Nessuna tabella multi-colonna
  Barra di progresso intuitiva
```

---

### Layout MEDIUM -- "Budget Explorer"

```
DESKTOP (1440px)
+--------------------------------------------------------------------+
| [<] Finanze Lega                         [Export Excel] [Export PDF]|
+--------------------------------------------------------------------+
|                                                                     |
| +----------+ +----------+ +----------+ +----------+                |
| | Budget   | | Speso    | | Bilancio | | Slot     |                |
| | 145.2M   | | 87.3M    | | +57.9M   | | 7/25     |               |
| |  +12%    | |  -5%     | | vs media | |          |                |
| |  vs media| |  vs media| |          | |          |                |
| +----------+ +----------+ +----------+ +----------+                |
|                                                                     |
| Budget vs Speso per Team                                            |
| +--------------------------------------------------------------+   |
| | FC Mario  ████████████████░░░░  145M / 88M                  |   |
| | AC Luigi  ██████████████░░░░░  132M / 95M                   |   |
| | AS Peach  █████████████░░░░░░  129M / 72M                   |   |
| | US Toad   ████████████░░░░░░░  115M / 63M                   |   |
| +--------------------------------------------------------------+   |
|                                                                     |
| +--Distribuzione per Ruolo--+  +--Tabella Riepilogo-----------+    |
| |                            |  |                              |    |
| |     +------+               |  | Team    | Budget | Bil | Slot|   |
| |    /  P 15% \              |  |---------|--------|-----|-----|   |
| |   | D  30%  |              |  | Mario   | 145.2M |+58M | 7  |   |
| |   | C  35%  |              |  | Luigi   | 132.1M |+37M | 5  |   |
| |    \ A 20% /               |  | Peach   | 128.9M |+57M | 8  |   |
| |     +------+               |  | Toad    | 115.3M |+52M | 6  |   |
| |                            |  |                              |    |
| +----------------------------+  +------------------------------+    |
+--------------------------------------------------------------------+
```

---

### Layout COMPLEX -- "Financial Analytics"

```
DESKTOP (1920px)
+------------------------------------------------------------------------+
| [<] Finanze              [Query Builder]  [Alerts]  [Export v]         |
+------------------------------------------------------------------------+
|                                                                         |
| Waterfall Chart: Flusso Budget Stagionale                              |
| +--------------------------------------------------------------------+ |
| |                                                                     | |
| |  200M |                                                             | |
| |       | [Budget]  [+Premi]  [-Acquisti]  [+Cessioni]  [=Finale]    | |
| |  150M | ████                                          ████         | |
| |       | ████      ████                                ████         | |
| |  100M | ████      ████       ████                     ████         | |
| |       | ████      ████       ████       ████          ████         | |
| |   50M | ████      ████       ████       ████          ████         | |
| |       | ████      ████       ████       ████          ████         | |
| |    0M +----+-------+----------+----------+-------------+---        | |
| |       Budget   +Premi    -Acquisti   +Cessioni     Finale          | |
| +--------------------------------------------------------------------+ |
|                                                                         |
| Pivot Table: Per Ruolo > Per Giocatore                                 |
| +--------------------------------------------------------------------+ |
| | Raggruppa: [Per Ruolo v]  [Per Semestre v]    [Espandi tutto]      | |
| |--------------------------------------------------------------------|  |
| | [v] P (Portieri)  | Budget: 22M | Acq: 3 | Media: 7.3M | +5%    | |
| |   > Sommer       | 8M   | Primo Merc. | Clausola: 12M             | |
| |   > Donnarumma   | 14M  | Rubata      | Clausola: 20M             | |
| | [v] D (Difensori) | Budget: 45M | Acq: 6 | Media: 7.5M | +3%    | |
| |   > Bastoni      | 12M  | Primo Merc. | Clausola: 18M             | |
| |   > ...          |      |             |                            | |
| | [>] C (Centroc.) | Budget: 52M | Acq: 7 | Media: 7.4M | -2%     | |
| | [>] A (Attaccanti)| Budget: 38M | Acq: 4 | Media: 9.5M | +8%    | |
| +--------------------------------------------------------------------+ |
|                                                                         |
| +--Heatmap: Costo/Rendimento-------+  +--Alert Configurati---------+  |
| |          |Budget|Salari| FVM |ROI |  | [!] Budget < 20M    [ON]   |  |
| |  Mario   | 9.2  | 7.8  | 8.5|6.2 |  | [!] Clausola > 15M  [ON]   | |
| |  Luigi   | 7.1  | 8.9  | 6.2|8.1 |  | [!] Bilancio < 0    [OFF]  | |
| |  Peach   | 8.5  | 6.3  | 7.8|7.5 |  | [+ Aggiungi alert]         | |
| +-----------------------------------+  +-----------------------------+  |
+------------------------------------------------------------------------+

  Heatmap legenda colori:
  [1-3] Basso (rosso)
  [4-6] Medio (giallo)
  [7-9] Alto  (verde)
  [10]  Eccellente (blu)
```

---

<a id="auction-layouts"></a>
## AuctionRoom: Proposte Layout

### BEFORE: 6 Layout Separati con Inconsistenze

```
LayoutA.tsx   LayoutB.tsx   LayoutC.tsx
+-----------+ +-----------+ +-----------+
| Split     | | Card      | | Compact   |
| screen    | | stack     | | table     |
| 60/40     | | mobile    | | focused   |
+-----------+ +-----------+ +-----------+

LayoutD.tsx   LayoutE.tsx   LayoutF.tsx
+-----------+ +-----------+ +-----------+
| Full      | | Minimal   | | Pro multi |
| width     | | timer     | | panel     |
+-----------+ +-----------+ +-----------+

PROBLEMI:
- 6 file da mantenere = 6x sforzo
- Stili leggermente diversi tra layout
- Bug fix va applicato in 6 posti
- Utente confuso dalla scelta
- Componenti NON condivisi tra layout
```

### AFTER: 3 Layout con Componenti Condivisi

```
Componenti Condivisi (usati da tutti i layout):
+---------------------------------------------------+
| AuctionPlayerCard  | AuctionBidPanel              |
| - Foto giocatore   | - Input importo              |
| - Nome + posizione  | - Bottoni +/-                |
| - Team + quota     | - Bottone OFFRI              |
| - Stats rapide     | - Offerta corrente           |
+--------------------+------------------------------+
| AuctionBudgetBar   | AuctionManagerList           |
| - Budget corrente   | - Lista manager              |
| - Budget speso     | - Chi ha offerto             |
| - Slot rimanenti   | - Status connessione         |
+--------------------+------------------------------+

Layout Mobile (auto-selezionato su <768px):
+-----------------------------------+
|  TIMER: 00:15  [Budget: 87.3M]   |
|  [████████████░░░░░░]             |
+-----------------------------------+
|                                    |
|    +--- AuctionPlayerCard ---+    |
|    |                         |    |
|    +-------------------------+    |
|                                    |
|  Offerta: 42M - FC Mario         |
|                                    |
+-----------------------------------+
| +--- AuctionBidPanel (sticky) ---+|
| | [- ]  [  43M  ]  [+ ]  [OFFRI]||
| +--------------------------------+|
+-----------------------------------+

  [swipe up] = BottomSheet con:
  - AuctionBudgetBar
  - AuctionManagerList
  - Storico offerte

Layout Desktop (1024px+):
+-------------------------------------------------------+
|  TIMER: 00:15                                         |
|  [████████████████████░░░░░░░░░░]                    |
+------------------------------------+------------------+
|                                    |                  |
|  +--- AuctionPlayerCard ---+      | AuctionBudgetBar |
|  |                         |      |                  |
|  |   [Foto Giocatore]     |      | Budget: 87.3M    |
|  |   Lautaro Martinez     |      | Speso:  42.0M    |
|  |   A - Inter            |      | Slot:   18/25    |
|  |   Quotazione: 35M      |      |                  |
|  +-------------------------+      +------------------+
|                                    |                  |
|  Offerta corrente: 42M            | Manager Status   |
|  Di: FC Mario                     | [v] Mario  42M  |
|                                    | [ ] Luigi       |
|  +--- AuctionBidPanel ---+       | [ ] Peach       |
|  | [- ] [ 43M ] [+ ] [OFFRI!]|  | [ ] Toad        |
|  +-------------------------+      |                  |
+------------------------------------+------------------+

Layout Pro (1280px+, opt-in):
+---------------------------------------------------------------+
| TIMER  | AuctionPlayerCard     | Budget | Manager | Storico   |
| 00:15  | [Foto] Lautaro       | 87.3M  | Mario v | 42M Mario |
|        | A Inter 35M          |        | Luigi   | 40M Luigi |
|        |                      |        | Peach   | 38M Peach |
|--------+----------------------+--------+---------+-----------|
| AuctionBidPanel: [- ] [ 43M ] [+ ] [OFFRI!]                 |
| My Roster: [P:2] [D:5] [C:6] [A:4]  Slot liberi: 8        |
+---------------------------------------------------------------+
```

---

<a id="rose-responsive"></a>
## Rose: Problemi Responsiveness

### BEFORE: Desktop OK, Mobile problematico

```
DESKTOP (1440px) - Funziona bene:
+--------------------------------------------------------------------+
| Sidebar      | Giocatore | Pos | Team  | Pr | G | A | Vt | Sal | D |
| Manager:     |-----------|-----|-------|----|----|---|----|----|---|
| FC Mario     | Lautaro   | A   | Inter | 25 | 18| 5 |7.2 |8.5M|3a |
| Budget:145M  | Barella   | C   | Inter | 28 | 8 |12 |7.0 |7.2M|2a |
| Salari: 87M  | Bastoni   | D   | Inter | 27 | 2 | 3 |6.8 |6.0M|3a |
+--------------------------------------------------------------------+

MOBILE (375px) - Problematico:
+-----------------------------------+
| Giocatore    | Pos | Sal          |
|--------------|-----|--------------|
| Lautaro      | A   | 8.5M        |
| Barella      | C   | 7.2M        |
| Bastoni      | D   | 6.0M        |
+-----------------------------------+
  MANCANO: Team, Pr, G, A, Vt, D, Clausola
  SIDEBAR: Nascosta completamente
```

### AFTER: Card + sidebar collapsible

```
MOBILE (375px):
+-----------------------------------+
| [i] FC Mario - Budget: 145.2M   |
+-----------------------------------+
| [P] [D] [C] [A]  [Cerca...]     |
+-----------------------------------+
|                                   |
| +-------------------------------+ |
| | [A] Lautaro Martinez   7.2   | |
| |     Inter  -  28 anni        | |
| |     Sal: 8.5M  Dur: 3a      | |
| |     25P  18G  5A             | |
| | [v Dettagli] [Stats]         | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | [C] Nicolo Barella    7.0    | |
| |     Inter  -  27 anni        | |
| |     Sal: 7.2M  Dur: 2a      | |
| |     28P  8G   12A            | |
| | [v Dettagli] [Stats]         | |
| +-------------------------------+ |
+-----------------------------------+

  [i] = tap per espandere info sidebar:
  +-----------------------------------+
  | FC Mario                         |
  | Budget: 145.2M                   |
  | Salari: 87.3M                    |
  | Giocatori: 18/25                 |
  | P:2  D:5  C:6  A:5              |
  +-----------------------------------+

DESKTOP con sidebar collapsata (1280px):
+--------------------------------------------------------------------+
| [<] |  Giocatore    | Pos | Team  | Sal  | Dur | Pr | G  | A | Vt |
|     |  Lautaro      | A   | Inter | 8.5M | 3a  | 25 | 18 | 5 |7.2 |
|     |  Barella      | C   | Inter | 7.2M | 2a  | 28 | 8  | 12|7.0 |
+--------------------------------------------------------------------+
  [<] = toggle sidebar espansa/collassata
```

---

<a id="admin-tabs"></a>
## AdminPanel: Tab Overflow Mobile

### BEFORE: 8 tab in riga su mobile

```
MOBILE (375px):
+-----------------------------------+
| Merc|Panor|Memb|Prem|Ric|Inv|Ses|Exp|
+-----------------------------------+
  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  8 tab su 375px = ~47px per tab
  Testo troncato o overflow
  Touch target troppo piccolo
  Non si capisce cosa sono
```

### AFTER: Menu BottomSheet su mobile

```
MOBILE (375px):
+-----------------------------------+
| [<] Admin Panel       [Menu v]   |
+-----------------------------------+
|                                   |
| Tab attivo: Mercato              |
| [Contenuto tab Mercato]          |
|                                   |
+-----------------------------------+

  Tap su [Menu v] apre BottomSheet:
  +-----------------------------------+
  |  Menu Admin                  [X] |
  +-----------------------------------+
  |                                   |
  | [Settings] Mercato          (!)  |
  |    Gestione sessioni e fasi      |
  |                                   |
  | [Eye]      Panoramica           |
  |    Stats e configurazione lega   |
  |                                   |
  | [Users]    Membri           (3)  |
  |    Richieste pendenti e roster   |
  |                                   |
  | [Trophy]   Premi                |
  |    Distribuzione premi           |
  |                                   |
  | [Shield]   Ricorsi          (2)  |
  |    Gestione ricorsi              |
  |                                   |
  | [Mail]     Inviti                |
  |    Invita nuovi partecipanti     |
  |                                   |
  | [Clock]    Sessioni             |
  |    Storico sessioni passate      |
  |                                   |
  | [Download] Export               |
  |    Scarica dati in Excel         |
  |                                   |
  +-----------------------------------+

  MIGLIORAMENTI:
  + Ogni voce ha icona + label + descrizione
  + Badge contatore per voci con azioni pendenti
  + Touch target generosi (48px+ per voce)
  + Tutta la larghezza dello schermo
  + Scrollabile se necessario
```

---

<a id="rubata-flow"></a>
## Rubata: Flusso Stati Confuso

### BEFORE: Modal a catena senza contesto

```
Stato 1: OFFERING
+-----------------------------------+
| [Player Card]                     |
| [Bid Input]                       |
| Offerta accettata!               |
+-----------------------------------+
          |
          v (modal si apre)
Stato 2: PENDING_ACK (Modal)
+-----------------------------------+
| Conferma Transazione             |
| Lautaro > FC Mario per 42M      |
| [Conferma] [Ricorso]            |
+-----------------------------------+
          |
          v (altro modal)
Stato 3: PROPHECY INPUT (Modal)
+-----------------------------------+
| Scrivi una profezia...           |
| [________________]               |
| [Invia]                         |
+-----------------------------------+
          |
          v (stato cambia)
Stato 4: NEXT PLAYER
+-----------------------------------+
| ...dove eravamo?                 |
| Quale player e' il prossimo?    |
+-----------------------------------+

  L'utente vede 3 modal di fila senza capire:
  - Quanti step mancano?
  - Cosa succede dopo?
  - Dove siamo nel flusso complessivo?
```

### AFTER: Stepper visivo + modal contestuali

```
+-----------------------------------+
| Step: [v] [v] [*] [ ] [ ] [ ]   |
|       Off  Asta Conf Prof Next   |
+-----------------------------------+
| [Player Card]                     |
| Offerta accettata!               |
|                                   |
| Modal: Conferma Transazione      |
| +-------------------------------+ |
| | Step 3 di 5: Conferma         | |
| |                               | |
| | Lautaro > FC Mario per 42M   | |
| |                               | |
| | [Conferma]  [Ricorso]        | |
| |                               | |
| | Prossimo: Profezia           | |
| +-------------------------------+ |
+-----------------------------------+

  Lo stepper mostra:
  [v] Offerta    - completata (verde)
  [v] Asta       - completata (verde)
  [*] Conferma   - attuale (blu pulsante)
  [ ] Profezia   - prossima (grigio)
  [ ] Prossimo   - futuro (grigio)

  Ogni modal dice:
  "Step 3 di 5: Conferma"
  "Prossimo: Profezia"
```

---

## Timer Accessibility: Non Solo Colore

### BEFORE: Solo colore per urgenza

```
  Stato SAFE (verde):        Stato WARNING (giallo):    Stato DANGER (rosso):
  +------------------+       +------------------+       +------------------+
  |      00:25       |       |      00:08       |       |      00:03       |
  |  [████████████]  |       |  [████████░░░░]  |       |  [███░░░░░░░░░]  |
  |   (testo verde)  |       |  (testo giallo)  |       |  (testo rosso)   |
  +------------------+       +------------------+       +------------------+

  Per un utente daltonico:
  +------------------+       +------------------+       +------------------+
  |      00:25       |       |      00:08       |       |      00:03       |
  |  [████████████]  |       |  [████████░░░░]  |       |  [███░░░░░░░░░]  |
  |   (testo ???)    |       |  (testo ???)     |       |  (testo ???)     |
  +------------------+       +------------------+       +------------------+
                         ^^^ Tutti uguali! Non distinguibili! ^^^
```

### AFTER: Colore + testo + pattern + vibrazione

```
  Stato SAFE:                Stato WARNING:              Stato DANGER:
  +------------------+       +------------------+       +------------------+
  |      00:25       |       |      00:08       |       |      00:03       |
  |  [████████████]  |       |  [▓▓▓▓▓▓▓▓░░░░]  |       |  [▒▒▒░░░░░░░░░]  |
  |   "Tempo OK"     |       |  "Affrettati!"   |       | "ULTIMO SECONDO!"|
  +------------------+       +------------------+       +------------------+
       Pattern: solido            Pattern: tratteg.         Pattern: puntinato
       Label: "Tempo OK"         Label: "Affrettati!"      Label: "ULTIMO!"
       Audio: nessuno            Audio: beep lento          Audio: beep rapido
       Vibr.: nessuna            Vibr.: leggera             Vibr.: forte

  Ora un utente daltonico puo distinguere:
  1. Dal TESTO: "Tempo OK" vs "Affrettati!" vs "ULTIMO SECONDO!"
  2. Dal PATTERN: solido vs tratteggiato vs puntinato
  3. Dall'AUDIO: silenzio vs beep lento vs beep rapido
  4. Dalla VIBRAZIONE: nessuna vs leggera vs forte (mobile)
```

---

*Mockup generati a supporto di UI_REVIEW_REPORT.md. Tutti i wireframe sono in formato ASCII per compatibilita universale. Nessun file del progetto e' stato modificato.*
