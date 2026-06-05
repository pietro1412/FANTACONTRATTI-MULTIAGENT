# UX Audit Report — FantaContratti

> Audit generato il 2026-02-17. Analisi statica completa su tutte le pagine, componenti, pattern mobile e accessibilita'.
> Contesto: **70%+ utenti mobile**, livello intermedio, nessun feedback utente ancora (analisi preventiva).

---

## Scorecard

| Dimensione | Score | Dettagli |
|------------|-------|----------|
| **Pagine & Flussi** | 3.5/5 | Buoni pattern base, problemi critici su Roster e D&D mobile |
| **Consistenza UI** | 2.8/5 | Design system presente ma sotto-adottato, 11 copie POSITION_COLORS |
| **Mobile-First** | 3.2/5 | BottomNavBar/BottomSheet eccellenti, ma layout rotti su 375px |
| **Feedback & Stati** | 3.4/5 | Skeleton buono, alert() nativi da eliminare, no toast system |
| **Accessibilita'** | 2.5/5 | ARIA base ok, contrasto insufficiente, no focus trapping |

**Score complessivo: 3.1/5**

---

## Top 20 Issue — Prioritizzate per Impatto Utente

### P0 — BLOCCANTI (esperienza rotta su mobile)

| # | Issue | File:Riga | Impatto | Fix |
|---|-------|-----------|---------|-----|
| 1 | **Roster filtri grid-cols-4 senza breakpoint mobile** | `Roster.tsx:530` | Filtri inutilizzabili su 375px — ogni input ~70px | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` |
| 2 | **Roster stats overflow orizzontale** | `Roster.tsx:482-495` | 3 card stat in `flex` senza wrap escono dallo schermo | `grid grid-cols-3 gap-2` o `flex flex-wrap` |
| 3 | **Roster header non responsive** | `Roster.tsx:469-500` | `px-6`, icona 64px, `text-3xl` — troppo largo su mobile | `px-4 sm:px-6`, `w-12 sm:w-16`, `text-xl sm:text-3xl` |
| 4 | **HTML5 Drag & Drop non funziona su touch** | `Rubata.tsx:210-216`, `Svincolati.tsx:129-131` | Admin non puo' riordinare turni da mobile (70% utenti). AuctionRoom usa gia' `@dnd-kit` | Migrare a `@dnd-kit` o aggiungere bottoni freccia su/giu' |
| 5 | **Svincolati grid-cols-4 senza breakpoint** | `Svincolati.tsx:266,827` | Contenuto rotto su mobile | `grid grid-cols-2 sm:grid-cols-4` |
| 6 | **PageLayout padding fisso px-6** | `PageLayout.tsx:27,52` | Su 375px perde 48px (24px/lato), solo 327px per contenuto | `px-4 sm:px-6` |

### P1 — ALTI (UX degradata significativamente)

| # | Issue | File:Riga | Impatto | Fix |
|---|-------|-----------|---------|-----|
| 7 | **alert()/confirm() nativi — 23+ occorrenze** | `Trades.tsx:471,492,512,521`, `Dashboard.tsx:78`, `AdminPanel.tsx:297`, `PendingInvites.tsx:87,98`, `FeedbackDetail.tsx:95-113`, `InviteDetail.tsx:123,138`, `useAuctionRoomState.ts:675,723`, `useSvincolatiState.ts:433,744`, `PrizePhaseManager.tsx:195,330` | Blocca thread, brutto su mobile, non accessibile, rompe PWA | Creare `ConfirmDialog` component + `useConfirmDialog` hook |
| 8 | **Nessun toast system unificato** | Cross-platform | Errori/successi inline si perdono dopo scroll, 30+ varianti inconsistenti | Creare `ToastProvider` + `useToast` hook |
| 9 | **POSITION_COLORS definito 11 volte con 4 varianti incompatibili** | `PlayerStats.tsx:17`, `Roster.tsx:246`, `AllRosters.tsx:78`, `PlayerStatsModal.tsx:8`, `auction/types.ts:193`, `finance/types.ts:161`, `RecentMovements.tsx:33`, `Movements.tsx:61`, `SuperAdmin.tsx:152`, `rubata.types.ts:197`, `Notifications.tsx:67` | Portiere giallo in alcune pagine, ambra in altre. Confonde associazione colore-ruolo | Importare da `PositionBadge.tsx` che gia' esporta tutte le varianti |
| 10 | **Modal shared usato solo in 2 file su 18+ modali** | 16+ modali custom con z-index (50 vs 60), backdrop (/50 a /80), border-radius (xl/2xl/3xl) inconsistenti. No escape key, no scroll lock, no swipe-to-dismiss | Migrare progressivamente al `Modal` shared |
| 11 | **Contrasto text-gray-500/600 fallisce WCAG AA** | 89 occ. `text-gray-600` in 35 file, ~3.7:1 e ~2.3:1 su sfondi scuri (serve 4.5:1) | Sostituire `text-gray-600` con `text-gray-400`, `text-gray-500` con `text-gray-400` dove su sfondo scuro |
| 12 | **Rubata sidebar admin nascosta su mobile senza alternativa** | `Rubata.tsx:324` (`hidden lg:block`) | Admin non puo' gestire budget, timer, bot, completamento da telefono | Aggiungere drawer/bottom sheet per controlli admin mobile |
| 13 | **Dashboard bottoni header non stackano** | `Dashboard.tsx:160-170` | "Cerca Leghe" + "Crea Nuova Lega" cramped su 375px | `flex flex-col sm:flex-row` |
| 14 | **No focus trapping in Modal e BottomSheet** | `Modal.tsx`, `BottomSheet.tsx` | Tab naviga fuori dal dialog — viola WCAG 2.4.3 | Aggiungere `focus-trap-react` o implementazione custom |

### P2 — MEDI (UX subottimale ma funzionante)

| # | Issue | File:Riga | Impatto | Fix |
|---|-------|-----------|---------|-----|
| 15 | **Contracts.tsx overload cognitivo** | `Contracts.tsx` (2489 righe) | Rinnovi + nuovi + usciti + tagli + consolidamento tutti insieme | Wizard step-by-step per utenti intermedi |
| 16 | **BottomNavBar senza Scambi** | `BottomNavBar.tsx:52-58` | Feature core durante fase trade richiede 2-3 tap via hamburger | Tab dinamico per fase attiva o badge sul Menu |
| 17 | **Nessun componente Alert/Spinner/Textarea/Tabs centralizzato** | Design system gaps | 30+ varianti errore, 6+ spinner pattern, textarea inline, tabs reimplementati | Creare componenti UI mancanti |
| 18 | **AllRosters/Rose padding fisso + grid senza breakpoint** | `AllRosters.tsx:389,402`, `Rose.tsx:634` | Layout rotto o inefficiente su mobile | Responsive classes |
| 19 | **History search input w-64 fisso** | `History.tsx:217` | Non riempie lo spazio su mobile | `w-full sm:w-64` |
| 20 | **Retry button mancante sulla maggior parte delle pagine** | Solo 4 pagine su ~20 hanno retry | Utente senza connessione non puo' riprovare | Aggiungere retry pattern |

---

## Punti di Forza (da preservare e estendere)

La piattaforma ha gia' implementazioni di alto livello in molte aree:

| Area | Pattern | Qualita' |
|------|---------|----------|
| **Skeleton loading** | 10 varianti specializzate (card, player row, timer, bid history...) | Eccellente |
| **Asta mobile** | MobileBottomBar fisso, bid controls 44px+, safe-area, haptic timer | Eccellente |
| **Touch targets** | Button min-h-[44px], Modal/BottomSheet close 44x44 | Eccellente |
| **BottomSheet** | Drag-to-dismiss, safe area, backdrop blur | Eccellente |
| **Haptic feedback** | 13 pattern semantici (bid, outbid, win, save, send, approve, reject) | Eccellente |
| **Timer asta** | Escalation multi-sensoriale (colore + pulse + shake + glow + haptic) | Eccellente |
| **Confetti** | 4 varianti (win, big win, trophy, small) per celebrazioni | Molto buono |
| **BottomNavBar** | Auto-hide scroll, safe area, 5 tab, LIVE badge asta | Molto buono |
| **Onboarding Dashboard** | Empty state con 3 step illustrati + CTA multiple | Molto buono |
| **Input validation** | Shake animation + border rosso + aria-invalid + aria-describedby | Molto buono |
| **Password strength** | 4 livelli con barra colorata nel Register | Molto buono |
| **Swipe gesturesA** | Modal swipe-to-dismiss, AdminPanel swipe tabs | Molto buono |
| **Real-time Pusher** | Asta, rubata, svincolati, trade con indicatore connessione | Buono |
| **Pull-to-refresh** | Presente in Financials, Movements | Buono |
| **DataTable responsive** | 3 tier: mobile cards / tablet scroll / desktop table | Buono |

---

## Analisi per Pagina

### Pagine con UX Migliore

| Pagina | Score | Note |
|--------|-------|------|
| **AuctionRoom** | 4.5/5 | Best mobile: MobileBottomBar, quick bid buttons, MobileSidePanel, haptic + confetti |
| **Login/Register** | 4.5/5 | Form mobile-first, password strength, inputMode, responsive padding |
| **Trades** | 4/5 | 3 colonne desktop, BottomSheet mobile, real-time Pusher, tab abbreviati |
| **LeagueDetail** | 4/5 | Skeleton strutturato, error banner dismissable, phase stepper overflow-x |
| **LeagueFinancials** | 3.5/5 | PullToRefresh, ShareButton, LandscapeHint, error con retry |
| **PlayerStats** | 4/5 | Column presets per ruolo, BottomSheet filtri, LandscapeHint |

### Pagine con Problemi Critici

| Pagina | Score | Problemi principali |
|--------|-------|---------------------|
| **Roster** | 2/5 | Header non responsive, filtri grid-cols-4 rotti, stats overflow |
| **Svincolati** | 2.5/5 | grid-cols-4 rotto (x2), admin setup D&D non touch |
| **Contracts** | 2.5/5 | 2489 righe, overload cognitivo, tabelle overflow, no loading preview |
| **Rubata** | 3/5 | Admin sidebar nascosta su mobile, D&D non touch, maxHeight hardcoded |
| **AllRosters/Rose** | 2.5/5 | Padding fisso, grid senza breakpoint mobile |

---

## Design System — Gap Analysis

### Componenti UI Esistenti vs Adozione

| Componente | Qualita' | Adozione | Problema |
|------------|----------|----------|----------|
| Button | 9/10 | Alta | - |
| Card | 8/10 | Media | Molte card costruite a mano con `bg-surface-200 rounded-xl` |
| Input | 9/10 | Media | - |
| Modal | 9/10 | **1/10** | 16+ modali custom non usano il shared Modal |
| BottomSheet | 8/10 | Bassa | Solo in Trades e PlayerStats |
| DataTable | 8/10 | Bassa | Solo PlayerStats, pagine legacy hanno tabelle manuali |
| EmptyState | 7/10 | Bassa | Molti empty state usano `<p>` semplici |
| Badge | 7/10 | Bassa | Manca variante purple (usata per Feedback) |
| Skeleton | 8/10 | Media | Non usato in Contracts, AdminPanel |
| PositionBadge | 9/10 | **Parziale** | Esporta tutte le varianti ma 11 file usano copie locali |

### Componenti Mancanti (da creare)

| Componente | Priorita' | Sostituirebbe |
|------------|-----------|---------------|
| **ToastProvider + Toast** | P1 | 30+ varianti errore/successo inline + alert() nativi |
| **ConfirmDialog** | P1 | 23+ occorrenze di window.confirm() |
| **Alert** | P1 | 30+ banner errore/successo con stili diversi |
| **Spinner** | P2 | 6+ pattern spinner diversi |
| **Tabs** | P2 | Tab reimplementati in Trades, Notifications, AdminPanel, PlayerStats |
| **Textarea** | P2 | Textarea inline in 5+ file con stili diversi |
| **StatusBadge** | P3 | STATUS_LABELS duplicato in 3+ file |

### Inconsistenze Colori Posizioni (11 definizioni)

| Colore | PositionBadge (canonical) | 6 file con variante diversa |
|--------|--------------------------|------------------------------|
| **P (Portiere)** | amber-500 | yellow-500 |
| **D (Difensore)** | blue-500 | green-500 |
| **C (Centrocampista)** | emerald-500 | blue-500 |
| **A (Attaccante)** | red-500 | red-500 (uguale) |

L'utente vede il Difensore **blu** in alcune pagine e **verde** in altre.

---

## Mobile-Specific Findings

### Pattern Mobile Ben Implementati

| Pattern | Componente | Dettaglio |
|---------|-----------|-----------|
| Bottom navigation | BottomNavBar | 5 tab, auto-hide scroll, safe-area, LIVE badge |
| Bottom sheet | BottomSheet | Drag-to-dismiss, safe area, backdrop |
| Pull-to-refresh | PullToRefresh | Solo mobile (`hidden md:block` il trigger) |
| Swipe-to-dismiss | Modal | Handle visibile, threshold 100px |
| Haptic feedback | haptics.ts | 13 pattern semantici |
| Mobile bid bar | MobileBottomBar | Fixed, compact, safe area |
| Deal footer | DealMobileFooter | Sticky submit per trade |
| Landscape hint | LandscapeHint | Suggerisce rotazione per grafici |

### Pattern Mobile Mancanti

| Pattern | Dove servirebbe | Priorita' |
|---------|-----------------|-----------|
| **Sticky filters** | Roster, StrategieRubata, AllPlayers — filtri scrollano via | Alta |
| **Virtualized lists** | Rose con 25+ giocatori — jank su mobile | Media |
| **Swipe between tabs** | Trades 4 tab — tap only, swipe sarebbe naturale | Bassa |
| **Back gesture** | Nessun supporto browser back/Android back nel SPA | Media |
| **Toast globale** | Success/error che floating sopra content | Alta |

### Pagine con Layout Rotto su 375px

| Pagina | Elemento rotto | Causa |
|--------|---------------|-------|
| Roster | Filtri | `grid-cols-4` senza breakpoint |
| Roster | Stats header | `flex` senza wrap |
| Svincolati | Counter + grid | `grid-cols-4` senza breakpoint (x2) |
| AllRosters | Contenuto | `px-6` fisso |
| Rose | Grid | `grid-cols-4` senza breakpoint |
| Dashboard | Header buttons | `flex` senza wrap verticale |

---

## Accessibilita' — Findings Chiave

### Cosa Funziona

- `aria-label` su componenti UI core (Modal, BottomSheet, DataTable, Notifications)
- `aria-modal`, `role="dialog"` sui dialog
- `aria-invalid`, `aria-describedby` sugli Input in errore
- `aria-busy` sui Button in loading
- `aria-hidden` su skeleton e elementi decorativi
- Alt text su tutte le immagini (team logo, foto giocatori)
- Touch target minimo 44px su Button, Modal close, BottomSheet close

### Cosa Non Funziona

| Issue | Gravita' | Dettaglio |
|-------|----------|----------|
| **Contrasto text-gray-600** | WCAG AA FAIL | ~2.3:1 su sfondo scuro (servono 4.5:1). 89 occorrenze in 35 file |
| **Contrasto text-gray-500** | WCAG AA BORDERLINE | ~3.7:1 su sfondo scuro. Migliaia di occorrenze |
| **No focus trapping** | WCAG 2.4.3 FAIL | Modal e BottomSheet permettono Tab fuori dal dialog |
| **text-[10px] diffuso** | Leggibilita' | 226 occorrenze in 48 file — sotto minimo raccomandato su mobile |
| **Tooltip solo hover** | Keyboard inaccessible | `Tooltip.tsx` non risponde a focus, solo hover/click |

---

## Piano di Fix Suggerito

### Sprint 1 — Quick Wins (1-2 giorni, fix CSS/responsive)

| # | Task | Effort | File |
|---|------|--------|------|
| 1 | Fix Roster filtri `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` | 5 min | Roster.tsx:530 |
| 2 | Fix Roster stats `grid grid-cols-3` o `flex-wrap` | 10 min | Roster.tsx:482-495 |
| 3 | Fix Roster header responsive | 15 min | Roster.tsx:469-500 |
| 4 | Fix Svincolati grid-cols responsive (x2) | 5 min | Svincolati.tsx:266,827 |
| 5 | Fix PageLayout `px-4 sm:px-6` | 5 min | PageLayout.tsx:27,52 |
| 6 | Fix AllRosters/Rose padding + grid | 10 min | AllRosters.tsx:389,402; Rose.tsx:634 |
| 7 | Fix Dashboard buttons `flex-col sm:flex-row` | 5 min | Dashboard.tsx:160 |
| 8 | Fix History search `w-full sm:w-64` | 2 min | History.tsx:217 |
| 9 | Centralizzare POSITION_COLORS (importare da PositionBadge) | 30 min | 11 file |
| 10 | Fix contrasto `text-gray-600` → `text-gray-400` | 1 hr | 35 file |

### Sprint 2 — Componenti Core (3-5 giorni)

| # | Task | Effort | Dipendenze |
|---|------|--------|------------|
| 11 | Creare `ToastProvider` + `Toast` + `useToast` | 1 giorno | - |
| 12 | Creare `ConfirmDialog` + `useConfirmDialog` | 4 ore | Toast opzionale |
| 13 | Creare `Alert` component (error/success/warning/info) | 2 ore | - |
| 14 | Creare `Spinner` component centralizzato | 1 ora | - |
| 15 | Sostituire alert()/confirm() con ConfirmDialog (23+ punti) | 4 ore | #12 |
| 16 | Sostituire inline error/success con Alert (30+ punti) | 3 ore | #13 |
| 17 | Aggiungere focus trapping a Modal e BottomSheet | 3 ore | - |

### Sprint 3 — Consolidamento (5-8 giorni)

| # | Task | Effort | Dipendenze |
|---|------|--------|------------|
| 18 | Migrare 16+ modali custom al Modal shared | 3 giorni | - |
| 19 | Migrare Rubata/Svincolati D&D a @dnd-kit | 1 giorno | - |
| 20 | Aggiungere retry pattern a tutte le pagine | 1 giorno | - |
| 21 | Aggiungere sidebar admin mobile per Rubata | 4 ore | - |
| 22 | Creare componente Tabs riusabile | 4 ore | - |
| 23 | Splittare Contracts.tsx in sotto-componenti | 1 giorno | - |
| 24 | BottomNavBar dinamico per fase attiva | 4 ore | - |

---

## Benchmark vs Competitor

| Area | FantaContratti | Sleeper | FantaLab |
|------|---------------|---------|----------|
| Bottom navigation | 5 tab statici | 5 tab dinamici per contesto | Tab + FAB |
| Asta mobile | Eccellente (bid bar, haptic, timer) | N/A (format diverso) | Buona |
| Card vs Tabelle | Mix (DataTable responsive) | Card-first sempre | Card su mobile |
| Real-time | Pusher + polling fallback | WebSocket nativo | Polling |
| Haptic feedback | 13 pattern | Presente | Assente |
| Offline support | Pagina dedicata | Caching aggressivo | Nessuno |
| Onboarding | 3 step nella Dashboard | Tutorial interattivo | Nessuno |
| Data density mobile | Troppa (contratti, stats) | Aggressivamente nascosta | Media |

**Takeaway**: FantaContratti eccelle nell'asta mobile e nel feedback tattile, ma deve adottare una **information hierarchy per mobile** — mostrare dati primari (nome, posizione, squadra) upfront, nascondere secondari (ingaggio, durata, clausola) dietro tap/expand.

---

## Confronto con Audit Precedente

Questo e' il **primo UX Audit**. I prossimi confronteranno i progressi rispetto a questi numeri:

| Metrica | Baseline (17/02/2026) |
|---------|----------------------|
| Score complessivo | 3.1/5 |
| Issue P0 (bloccanti) | 6 |
| Issue P1 (alti) | 8 |
| Issue P2 (medi) | 6 |
| Layout rotti su 375px | 6 pagine |
| alert()/confirm() nativi | 23+ occorrenze |
| POSITION_COLORS duplicati | 11 file |
| Modali custom (non shared) | 16+ |
| Varianti error/success inline | 30+ |
| text-gray-600 (contrasto fail) | 89 occorrenze |
| Componenti UI mancanti | 7 |
