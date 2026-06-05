# UI/UX REVIEW REPORT — Fantacontratti Dynasty Platform

> **Data**: 2026-02-11
> **Branch**: test/e2e-session
> **Modalita**: REVIEW-ONLY (nessun file modificato)
> **Score Globale**: 3.5 / 5.0

---

## INDICE

1. [FASE 1 — Discovery & Inventario](#fase-1--discovery--inventario)
2. [FASE 2 — Analisi UX su 10 Dimensioni](#fase-2--analisi-ux-su-10-dimensioni)
3. [FASE 3 — Analisi User Flow Critici](#fase-3--analisi-user-flow-critici)
4. [FASE 4 — Analisi Comparativa](#fase-4--analisi-comparativa)
5. [FASE 5 — Report Finale](#fase-5--report-finale)

---

# FASE 1 — Discovery & Inventario

## 1.1 Mappa Completa dell'Interfaccia

```
MAPPA SCHERMATE FANTACONTRATTI DYNASTY

├── AREA PUBBLICA (non autenticata)
│   ├── /login ─────────────── Login.tsx
│   ├── /register ──────────── Register.tsx
│   ├── /forgot-password ───── ForgotPassword.tsx
│   ├── /reset-password ────── ResetPassword.tsx
│   └── /rules ─────────────── Rules.tsx
│
├── AREA GLOBALE (autenticata, senza contesto lega)
│   ├── /dashboard ─────────── Dashboard.tsx
│   ├── /profile ───────────── Profile.tsx
│   ├── /leagues/new ───────── CreateLeague.tsx
│   ├── /invite/:token ─────── InviteDetail.tsx
│   └── /superadmin ────────── SuperAdmin.tsx
│
├── AREA LEGA (/leagues/:leagueId/...)
│   ├── DASHBOARD & INFO
│   │   ├── / ──────────────── LeagueDetail.tsx
│   │   ├── /admin ────────── AdminPanel.tsx
│   │   └── /manager ──────── ManagerDashboard.tsx
│   │
│   ├── ROSA & GIOCATORI
│   │   ├── /rose ─────────── Rose.tsx
│   │   ├── /players ──────── AllPlayers.tsx
│   │   ├── /strategie-rubata StrategieRubata.tsx
│   │   └── /stats ────────── PlayerStats.tsx
│   │
│   ├── CONTRATTI & FINANZE
│   │   ├── /contracts ────── Contracts.tsx
│   │   ├── /financials ───── LeagueFinancials.tsx
│   │   ├── /indemnity ────── Indemnity.tsx
│   │   └── /movements ────── Movements.tsx
│   │
│   ├── MERCATO & ASTE
│   │   ├── /auction/:sid ─── AuctionRoom.tsx
│   │   ├── /rubata ───────── Rubata.tsx
│   │   ├── /svincolati ───── Svincolati.tsx
│   │   └── /trades ───────── Trades.tsx
│   │
│   ├── PREMI & PROFEZIE
│   │   ├── /prizes ───────── PrizePhasePage.tsx
│   │   └── /prophecies ───── Prophecies.tsx
│   │
│   ├── STORICO
│   │   └── /history ──────── History.tsx
│   │
│   └── COMMUNITY
│       ├── /feedback ─────── FeedbackHub.tsx
│       └── /patch-notes ──── PatchNotes.tsx
│
└── COMPONENTI GLOBALI
    ├── Navigation.tsx ──────── Header + menu desktop/mobile
    ├── BottomNavBar.tsx ────── Tab bar mobile 5 voci
    ├── CommandPalette.tsx ──── Ctrl+K navigazione rapida
    └── ScrollToTop.tsx ────── Scroll-to-top button
```

**Totale schermate: 36** (di cui 3 test/debug, 4 pubbliche, 29 protette)

## 1.2 Stack Tecnologico

| Categoria | Tecnologia |
|-----------|-----------|
| Framework | React 18 + TypeScript |
| Styling | TailwindCSS (dark theme custom "Stadium Nights") |
| Routing | React Router DOM v6 |
| Real-time | Pusher (WebSocket) |
| Icons | Lucide React |
| Charts | Recharts (RadarChart) |
| DnD | @dnd-kit |
| Virtualizzazione | @tanstack/react-virtual |
| Analytics | @vercel/speed-insights |

## 1.3 Design System

**Palette**: Blu Stadio (primary), Verde Campo (secondary), Oro Trofeo (accent), Rosso (danger)
**Font**: Inter (body), Outfit (display), Oswald (numeri scoreboard), JetBrains Mono (codice)
**Posizioni**: P=amber/cerchio, D=blu/quadrato, C=emerald/esagono, A=rosso/triangolo

## 1.4 Componenti UI Primitivi

Button (6 varianti), Card (7 varianti), Input (3 stati), Badge (5 varianti), Modal (5 size + swipe mobile), Skeleton (9 specializzati), DataTable (3 breakpoint responsive), EmptyState, BottomSheet, Tooltip, PositionBadge, NumberStepper, DurationSlider, RadarChart, LandscapeHint, StickyActionBar.

---

# FASE 2 — Analisi UX su 10 Dimensioni

## Score per Dimensione (media globale)

| Dimensione | Score | Note |
|------------|-------|------|
| D1 Gerarchia Visiva | 3.9/5 | |
| D2 Navigazione | 3.9/5 | |
| D3 Responsive/Mobile | 3.4/5 | |
| D4 Performance Percepita | 4.1/5 | Punto di forza |
| D5 Consistenza Design | 4.1/5 | Punto di forza |
| D6 Form/Input UX | 2.6/5 | Punto debole |
| D7 Data Visualization | 4.2/5 | Punto di forza |
| D8 Stati e Notifiche | 3.5/5 | |
| D9 Accessibilita | 2.8/5 | Punto debole |
| D10 Gamification | 2.1/5 | Punto debole |
| **MEDIA** | **3.5/5** | |

## Score per Pagina

### Login / Register / ForgotPassword — 3.2/5

**Punti di Forza**:
- Logo/branding coerente, loading state su submit, aria-invalid/describedby sugli errori

**Problemi Critici**:
- P1-AUTH-01: Nessuna validazione inline (feedback solo al submit)
- P1-AUTH-02: Messaggi errore generici ("Errore durante il login")

**Miglioramenti Importanti**:
- P2-AUTH-03: Padding p-8 eccessivo su mobile 360px
- P2-AUTH-04: Manca password strength indicator in Register
- P2-AUTH-05: ForgotPassword non usa Button isLoading

### Dashboard — 3.7/5

**Punti di Forza**:
- Empty state eccellente con CTA, skeleton loading, card lega con gradient

**Problemi Critici**:
- P1-DASH-01: Card lega mostra solo "Stato" e "Budget" — mancano rosa count, fase corrente, prossima scadenza

**Miglioramenti Importanti**:
- P2-DASH-02: Nessun feed attivita globale
- P2-DASH-03: Nessuna quick action
- P2-DASH-04: Contrasto text-gray-400 non WCAG AA

### League Detail — 4.0/5

**Punti di Forza**:
- 2-phase loading, skeleton lazy, layout 2/3+1/3, PhaseStepper, FinancialKPIs, StrategySummary

**Miglioramenti Importanti**:
- P2-LD-01: Budget senza barra progresso visuale
- P2-LD-02: Nessun indicatore "chi e online" nella sidebar
- P2-LD-03: Nessun widget "Prossime Scadenze"

### Auction Room — 3.7/5

**Punti di Forza**:
- Timer eccellente (5 livelli, glow, particelle), StatusBar informativa, layout 3 colonne, FinancialDashboard spy, quick bid buttons

**Problemi Critici**:
- P1-AUC-01: Nessun debounce su bid (double tap = double bid)
- P1-AUC-02: Nessuna conferma per bid MAX
- P1-AUC-03: Bid permesso quando disconnessi
- P1-AUC-04: "Chi sta vincendo" nascosto su mobile

**Miglioramenti Importanti**:
- P2-AUC-05: Nessuna celebrazione quando si vince un giocatore
- P2-AUC-06: Input numerico non touch-optimized
- P2-AUC-07: Nessun loading state durante invio bid
- P2-AUC-08: Nessun feedback sonoro o vibrazione

### Rose — 3.6/5

**Punti di Forza**:
- Dual view table/card, filtri posizione colorati, sidebar collassabile, duration color legend, skeleton loading

**Miglioramenti Importanti**:
- P2-ROSE-01: Empty state minimale senza CTA
- P2-ROSE-02: Nessuna virtualizzazione
- P2-ROSE-03: Nessun indicatore scroll orizzontale

### AllPlayers — 3.6/5

**Punti di Forza**:
- Virtualizzazione, pull-to-refresh, filtri mobile via BottomSheet, eta color-coded

**Miglioramenti Importanti**:
- P2-AP-01: Nessun sorting utente
- P2-AP-02: StatsModal senza quick actions

### Contracts — 2.4/5 (CRITICO)

**Punti di Forza**:
- Sistema draft/bozza, debounce preview, beforeunload warning

**Problemi Critici**:
- P1-CON-01: 7 stati in una sola vista = overload cognitivo
- P1-CON-02: Nessun "Annulla tutte le modifiche"
- P1-CON-03: "Salva" vs "Consolida" non chiaro

**Miglioramenti Importanti**:
- P2-CON-04: 10+ data points per riga senza progressive disclosure
- P2-CON-05: Mobile probabilmente inutilizzabile
- P2-CON-06: Preview costo rinnovo non chiaro inline

### Trades — 3.6/5

**Punti di Forza**:
- Tab organizzate, BilancioGauge/CompactBudgetBar/DeltaBar eccellenti, real-time Pusher, urgency colors

**Miglioramenti Importanti**:
- P2-TRD-01: Card lunghe su mobile
- P2-TRD-02: Form creazione senza drag & drop o vista affiancata
- P2-TRD-03: Nessun impatto roster visualizzato

### StrategieRubata — 3.3/5

**Punti di Forza**:
- 5 viste, 3 modalita dati, watchlist 5 categorie, RadarChart, auto-tags AI

**Miglioramenti Importanti**:
- P2-STR-01: Pagina troppo complessa (curva apprendimento ripida)
- P2-STR-02: Mobile desktop-oriented
- P2-STR-03: Nessun tutorial o help contestuale

### LeagueFinancials — 4.2/5 (MIGLIORE)

**Punti di Forza**:
- Drill-down 4 livelli, progressive disclosure eccellente, componenti specializzati (KPICard, WaterfallChart, ContractExpiryGantt, ecc.)

### Movements — 3.9/5

**Punti di Forza**:
- Dual view card/table, filtri mobile BottomSheet, pull-to-refresh, profezie integrate

### Navigation System — 3.9/5

**Punti di Forza**:
- Desktop tab + mobile slide-in + BottomNavBar + CommandPalette

**Problemi Critici**:
- P1-NAV-01: Contrasto WCAG critico (text-gray-500 = 1.8:1)
- P1-NAV-02: Nessun prefers-reduced-motion

### Profile — 2.8/5

**Problemi Critici**:
- P1-PRO-01: Sezione foto non responsive su 360px
- P1-PRO-02: Password form senza HTML required

---

# FASE 3 — Analisi User Flow Critici

## Riepilogo Friction Points

### Critici (6)
| ID | Flow | Descrizione |
|----|------|-------------|
| F3.1 | Asta Live | Double tap = double bid (no debounce) |
| F3.2 | Asta Live | MAX bid senza conferma |
| F3.3 | Asta Live | Bid permesso quando disconnesso |
| F4.1 | Contratti | Tutto in una vista = overload cognitivo |
| F4.2 | Contratti | "Salva" vs "Consolida" poco chiaro |
| F5.1 | Scambi | Nessuna interfaccia "do/ricevo" intuitiva |

### Importanti (11)
| ID | Flow | Descrizione |
|----|------|-------------|
| F1.1 | Primo Accesso | Nessun wizard guidato |
| F1.2 | Primo Accesso | Codice invito difficile da ritrovare |
| F2.1 | Pre-Asta | Nessun percorso "Prepara Asta" |
| F2.2 | Pre-Asta | AllPlayers e StrategieRubata disconnessi |
| F3.4 | Asta Live | "Chi sta vincendo" nascosto su mobile |
| F3.5 | Asta Live | Nessuna celebrazione vittoria |
| F3.6 | Asta Live | Input numerico non touch-optimized |
| F4.3 | Contratti | Conseguenze economiche non chiare |
| F4.5 | Contratti | Mobile probabilmente inutilizzabile |
| F5.2 | Scambi | Nessuna controproposta |
| F5.3 | Scambi | Impatto roster non visualizzato |

### Minori (10)
| ID | Flow | Descrizione |
|----|------|-------------|
| F1.3 | Primo Accesso | Membro pending senza info |
| F1.4 | Primo Accesso | Config slot senza preset |
| F2.3 | Pre-Asta | Curva apprendimento StrategieRubata |
| F2.4 | Pre-Asta | Nessun budget simulator |
| F3.7 | Asta Live | Passaggio bid-contract senza riepilogo |
| F3.8 | Asta Live | Dead wait per non-admin durante setup |
| F4.4 | Contratti | Nessun "Annulla tutte modifiche" |
| F4.6 | Contratti | Nessun deep link rosa-contratto |
| F5.4 | Scambi | Nessuno storico trattative tra 2 DG |
| F5.5 | Scambi | Card scambio lunga su mobile |

---

# FASE 4 — Analisi Comparativa

## Score vs Benchmark

| Area | Check | Pass | Score |
|------|-------|------|-------|
| Dashboard | 4 | 1 | 25% |
| Rosa/Squadra | 5 | 3 | 60% |
| Mercato/Asta | 6 | 3 | 50% |
| Profilo Giocatore | 5 | 2.5 | 50% |
| Scambi | 4 | 2.5 | 62% |
| Impostazioni Lega | 3 | 2.5 | 83% |
| **TOTALE** | **27** | **14.5** | **54%** |

## Top 10 Gap Quick Wins

| # | Gap | Impatto | Effort |
|---|-----|---------|--------|
| 1 | Bid confirmation modal (asta) | Critico | XS |
| 2 | Budget progress bar visuale | Alto | XS |
| 3 | Banner LIVE su card dashboard | Alto | XS |
| 4 | Quick actions in StatsModal | Alto | S |
| 5 | Suono/vibrazione in asta | Alto | S |
| 6 | Celebration animation vittoria | Alto | S |
| 7 | Connection loss overlay (asta) | Alto | S |
| 8 | Sorting colonne tabella | Alto | S |
| 9 | Feed attivita su Dashboard | Alto | M |
| 10 | Trade builder do/ricevo visuale | Alto | M |

---

# FASE 5 — Report Finale

## Backlog Implementativo

### T-001 — Debounce e loading state su bid asta
- **Priorita**: P1 | **Dimensione**: XS (1h)
- **File**: BidControls.tsx, MobileBottomBar.tsx, Rubata.tsx, Svincolati.tsx
- Aggiungere stato isBidding, disabilitare pulsante durante invio, debounce 1000ms

### T-002 — Conferma bid MAX e bid elevati
- **Priorita**: P1 | **Dimensione**: XS (1h)
- **File**: BidControls.tsx, MobileBottomBar.tsx
- Modal conferma per bid >= 75% budget o pulsante MAX

### T-003 — Blocco bid quando disconnesso
- **Priorita**: P1 | **Dimensione**: XS (1h)
- **File**: BidControls.tsx, MobileBottomBar.tsx
- Passare isConnected come prop, disabilitare se disconnesso

### T-004 — Contrasto WCAG AA per testo su sfondo scuro
- **Priorita**: P1 | **Dimensione**: S (2-4h)
- **File**: index.css, tailwind.config.js, tutti i file con text-gray-400/500/600
- Aggiornare palette per minimo 4.5:1 su testo normale

### T-005 — prefers-reduced-motion
- **Priorita**: P1 | **Dimensione**: XS (1h)
- **File**: index.css
- Media query per disabilitare tutte le animazioni

### T-006 — Ristruttura pagina Contratti in tab
- **Priorita**: P1 | **Dimensione**: M (4-8h)
- **File**: Contracts.tsx
- 3 tab (Rinnovi/Nuovi/Usciti) + riepilogo impatto + conferma Consolida

### T-007 — Celebrazione vittoria asta
- **Priorita**: P2 | **Dimensione**: S (2-4h)
- **File**: CenterStage.tsx, AcknowledgmentPanel.tsx
- Confetti CSS, banner vittoria, vibrazione haptic

### T-008 — Bidder visibile su mobile
- **Priorita**: P2 | **Dimensione**: XS (1h)
- **File**: MobileBottomBar.tsx
- Aggiungere nome bidder corrente sotto il prezzo

### T-009 — Validazione inline form auth
- **Priorita**: P2 | **Dimensione**: S (2-4h)
- **File**: Login.tsx, Register.tsx, ForgotPassword.tsx
- Validazione on blur, password strength, messaggi specifici

### T-010 — Quick actions su Dashboard card lega
- **Priorita**: P2 | **Dimensione**: S (2-4h)
- **File**: Dashboard.tsx
- KPI aggiuntivi + bottoni [Asta][Rosa][Finanze] + badge LIVE

### T-011 — Budget progress bar visuale
- **Priorita**: P2 | **Dimensione**: XS (1h)
- **File**: Nuovo BudgetBar.tsx, pagine con budget
- Barra colorata proporzionale (verde/giallo/rosso)

### T-012 — Sorting colonne tabella utente
- **Priorita**: P2 | **Dimensione**: S (2-4h)
- **File**: Rose.tsx, AllPlayers.tsx, Movements.tsx
- Click header per sort asc/desc con freccia

### T-013 — Input numerico touch-optimized per asta
- **Priorita**: P2 | **Dimensione**: S (2-4h)
- **File**: BidControls.tsx
- inputMode="numeric" + pulsanti +/- grandi (44x44px)

### T-014 — Empty state Rose con CTA
- **Priorita**: P2 | **Dimensione**: XS (1h)
- **File**: Rose.tsx
- EmptyState component con CTA "Vai all'Asta"

### T-015 — Responsive padding form auth
- **Priorita**: P2 | **Dimensione**: XS (1h)
- **File**: Login.tsx, Register.tsx
- Cambiare p-8 in p-4 sm:p-8

### T-016 — Responsive grid CreateLeague
- **Priorita**: P2 | **Dimensione**: XS (1h)
- **File**: CreateLeague.tsx
- Cambiare grid-cols-2 in grid-cols-1 sm:grid-cols-2

### T-017 — Responsive profilo foto
- **Priorita**: P2 | **Dimensione**: XS (1h)
- **File**: Profile.tsx
- Cambiare flex in flex-col sm:flex-row

### T-018 — Notifiche real-time via Pusher
- **Priorita**: P2 | **Dimensione**: M (4-8h)
- **File**: Notifications.tsx, PendingInvites.tsx
- Canale Pusher user-specific, ridurre polling a 5min fallback

### T-019 — Onboarding wizard prima lega
- **Priorita**: P2 | **Dimensione**: M (4-8h)
- **File**: Dashboard.tsx, CreateLeague.tsx
- Wizard 4 step con preset configurazione

### T-020 — Suono e vibrazione in asta
- **Priorita**: P2 | **Dimensione**: S (2-4h)
- **File**: Nuovo useAuctionSounds.ts, componenti asta
- Hook con suoni per bid/turn/win/warning + toggle

### T-021 — Scambi: interfaccia do/ricevo migliorata
- **Priorita**: P2 | **Dimensione**: L (1-2gg)
- **File**: Trades.tsx
- Layout 2 colonne Offro/Chiedo + impatto roster real-time

### T-022 — Feed attivita su Dashboard
- **Priorita**: P3 | **Dimensione**: M (4-8h)
- **File**: Dashboard.tsx
- Ultimi 10 eventi cross-lega con icone e tempo relativo

### T-023 — Breadcrumbs su mobile
- **Priorita**: P3 | **Dimensione**: S (2-4h)
- **File**: Navigation.tsx
- Breadcrumb compatto visibile su tutte le viewport

### T-024 — CommandPalette: recenti e contesto
- **Priorita**: P3 | **Dimensione**: S (2-4h)
- **File**: CommandPalette.tsx
- Sezione "Recenti" + indicatore posizione corrente

### T-025 — Storico giocatore nel StatsModal
- **Priorita**: P3 | **Dimensione**: S (2-4h)
- **File**: PlayerStatsModal.tsx
- Tab "Storico" + quick actions nel footer

### T-026 — Calendario fasi lega visuale
- **Priorita**: P3 | **Dimensione**: M (4-8h)
- **File**: Nuovo PhaseCalendar.tsx, LeagueDetail.tsx
- Barra orizzontale fasi con indicatore "oggi" e prossima deadline

---

## Roadmap Suggerita

### Sprint 1 — Protezioni Critiche (~12h, 9 task)
T-001, T-002, T-003, T-004, T-005, T-011, T-015, T-016, T-017

### Sprint 2 — Fondamenta UX (~24h, 7 task)
T-006, T-008, T-009, T-010, T-012, T-013, T-014

### Sprint 3 — Engagement & Polish (~30h, 5 task)
T-007, T-018, T-019, T-020, T-023

### Sprint 4 — Delight & Advanced (~36h, 5 task)
T-021, T-022, T-024, T-025, T-026

---

## Riepilogo Esecutivo

**SCORE GLOBALE: 3.5 / 5.0**

**Top 3 Problemi Critici**:
1. Asta Live: Bid senza protezioni (T-001, T-002, T-003)
2. Accessibilita: Contrasto WCAG + no reduced-motion (T-004, T-005)
3. Contratti: Overload cognitivo, azione irreversibile ambigua (T-006)

**Top 3 Quick Wins**:
1. Debounce + loading state bid — XS (1h)
2. prefers-reduced-motion — XS (1h)
3. Budget progress bar visuale — XS (1h)

**Backlog Totale**: 6 P1 + 15 P2 + 5 P3 = 26 task
