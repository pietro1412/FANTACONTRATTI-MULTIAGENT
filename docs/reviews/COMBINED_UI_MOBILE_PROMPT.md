# Prompt Combinato — Web UI + Mobile Browser

> Copia-incolla questo prompt in una nuova chat Claude Code per avviare le lavorazioni.
> Il prompt e' diviso in 4 sprint combinati. Avvia uno sprint alla volta.

---

## SPRINT COMBINATO 1 — Quick Wins (Web + Mobile)

```
Sono sul branch develop del progetto Fantacontratti (React + Tailwind + Vite + TypeScript).
Devo implementare lo Sprint Combinato 1 che unisce le quick wins della UI desktop e del mobile browser.

PRIMA DI TUTTO: leggi questi file per il contesto completo:
1. UI_SPRINT_PLAN.md → sezione "SPRINT 1" per i dettagli web
2. MOBILE_UI_SPRINT_PLAN.md → sezione "SPRINT M1" per i dettagli mobile
3. UI_IMPROVEMENTS_BACKLOG.md → dettagli task TASK-xxx
4. MOBILE_UI_IMPROVEMENTS_BACKLOG.md → dettagli task MOB-xxx

WORKFLOW GIT:
- git checkout develop && git pull origin develop
- git checkout -b feature/1.x-combined-sprint-1
- Committa ogni task separatamente con: "feat: descrizione (#issue)"
- PR verso develop, MAI verso main

REGOLE:
- NON installare dipendenze senza mia conferma
- NON modificare logica di business — solo UI/UX/layout/CSS
- Testare su mobile (375px), tablet (768px), desktop (1280px+)
- Rispettare il design system esistente (colori/font da src/index.css e tailwind.config.js)
- Per le modifiche mobile: usare prefissi responsive (p-4 sm:p-6 md:p-8), NON rompere desktop
- Touch target minimo 44x44px su mobile

TASK DA IMPLEMENTARE (ordine consigliato):

--- PARTE A: WEB QUICK WINS (8 task) ---
1. TASK-010 (#292) — Banner fasi con affordance chiara [XS]
2. TASK-013 (#295) — Legenda colori durata contratto [XS]
3. TASK-011 (#293) — Skeleton loader dove disponibile [S]
4. TASK-012 (#294) — EmptyState standardizzato [S]
5. TASK-005 (#287) — Alternativa tastiera DnD Rubata [S]
6. TASK-008 (#290) — Timer accessibility (non solo colore) [S]
7. TASK-022 (#304) — aria-label pulsanti icon-only [S]
8. TASK-023 (#305) — scope e aria-sort tabelle [S]

--- PARTE B: MOBILE QUICK WINS (10 task) ---
9.  MOB-004 — Ridurre padding eccessivo su mobile (p-4 sm:p-6 md:p-8) [S]
10. MOB-023 — Font-size responsive titoli (text-xl sm:text-2xl md:text-3xl) [S]
11. MOB-010 — Hamburger menu 44x44px (da 32px) [XS]
12. MOB-002 — Profilo accessibile nel menu mobile [S]
13. MOB-003 — PWA Manifest + theme-color + meta tags in index.html [S]
14. MOB-014 — inputMode numeric/email sui campi appropriati [S]
15. MOB-018 — Scroll-to-top floating button [XS]
16. MOB-024 — Camera per upload profilo (capture="user") [XS]
17. MOB-020 — Banner "ruota per vista migliore" sui grafici [XS]
18. MOB-021 — Toggle dark/light in header mobile [XS]

TOTALE: 18 task, ~1-2 settimane di lavoro
Tutte indipendenti, nessuna dipendenza incrociata.

Per ogni task, leggi i dettagli nel backlog corrispondente (file e criteri di accettazione).
Alla fine: npm run build deve passare senza errori.
```

---

## SPRINT COMBINATO 2 — Foundation + Navigation

```
Sono sul branch develop del progetto Fantacontratti.
Lo Sprint Combinato 1 (quick wins) e' completato e mergiato in develop.
Devo implementare lo Sprint Combinato 2: componenti foundation + navigazione mobile.

LEGGI PRIMA:
1. UI_SPRINT_PLAN.md → sezione "SPRINT 2"
2. MOBILE_UI_SPRINT_PLAN.md → sezione "SPRINT M2"
3. UI_IMPROVEMENTS_BACKLOG.md → task TASK-001, TASK-004, TASK-007, TASK-015
4. MOBILE_UI_IMPROVEMENTS_BACKLOG.md → task MOB-001, MOB-009, MOB-011

WORKFLOW GIT:
- git checkout develop && git pull origin develop
- git checkout -b feature/1.x-combined-sprint-2
- Committa ogni task separatamente
- PR verso develop

TASK DA IMPLEMENTARE (ordine IMPORTANTE — ci sono dipendenze):

--- PARTE A: WEB FOUNDATION (4 task) — PRIMA ---
1. TASK-001 (#283) — DataTable responsivo riutilizzabile [L]
   → Componente src/components/ui/DataTable.tsx
   → Props: columns, data, sortable, responsive breakpoints
   → Su mobile (<768px): card view con espandi/comprimi
   → FONDAMENTALE: MOB-005 del prossimo sprint lo riusa
2. TASK-007 (#289) — Migrare icone SVG inline a lucide-react [M]
   → CHIEDI CONFERMA per installare lucide-react
3. TASK-004 (#286) — Movements leggibile su mobile [M]
   → Usare DataTable appena creato
4. TASK-015 (#297) — Tooltip status contratto [S]

--- PARTE B: MOBILE NAVIGATION (3 task) — DOPO parte A ---
5. MOB-001 — Bottom Navigation Bar [M]
   → Creare src/components/BottomNavBar.tsx
   → 5 tab: Home, Asta, Rosa, Finanze, Menu
   → Visibile solo su <768px, nasconde su scroll down
   → Badge "LIVE" su Asta quando sessione attiva
   → safe-area-inset-bottom per notch phones
   → padding-bottom su tutte le pagine
6. MOB-009 — Sticky action buttons sopra bottom nav [S]
   → Dipende da MOB-001 per calcolo offset
7. MOB-011 — Filtri collassati in BottomSheet su mobile [M]
   → Usare src/components/ui/BottomSheet.tsx esistente
   → Solo campo ricerca + "Filtri (N)" visibili su mobile
   → AllPlayers, Rose, Movements, PlayerStats

TOTALE: 7 task, ~2 settimane
ORDINE: prima TASK-001 (DataTable), poi il resto in parallelo.
Alla fine: npm run build deve passare.
```

---

## SPRINT COMBINATO 3 — Core Refactoring + Mobile Interactions

```
Sono sul branch develop del progetto Fantacontratti.
Sprint 1 e 2 completati. DataTable e BottomNavBar sono disponibili.
Devo implementare lo Sprint Combinato 3: refactoring core + interazioni mobile.

LEGGI PRIMA:
1. UI_SPRINT_PLAN.md → sezione "SPRINT 3"
2. MOBILE_UI_SPRINT_PLAN.md → sezione "SPRINT M3"
3. I backlog per i dettagli di ogni task

WORKFLOW GIT:
- git checkout develop && git pull origin develop
- git checkout -b feature/1.x-combined-sprint-3
- Committa ogni task separatamente
- PR verso develop

TASK DA IMPLEMENTARE:

--- PARTE A: WEB REFACTORING (4 task) ---
1. TASK-002 (#284) — AdminPanel 8 tab mobile + splitting [L]
2. TASK-006 (#288) — Splitting Rubata.tsx 2000+ righe [XL]
3. TASK-009 (#291) — Adottare recharts per grafici [L]
   → CHIEDI CONFERMA per installare recharts
4. TASK-014 (#296) — Stepper visivo Rubata [M]

--- PARTE B: MOBILE INTERACTIONS (5 task) ---
5. MOB-005 — Card view tabelle mobile [L]
   → RIUSA DataTable creato in Sprint 2 (TASK-001)
   → Rose, Movements, LeagueFinancials, Contracts
6. MOB-006 — Trades layout mobile (tab switch) [M]
   → Tab "Cosa Offri" / "Cosa Chiedi" su <768px
   → Desktop: side-by-side invariato
7. MOB-015 — Contratti editing via BottomSheet [M]
   → Tap su contratto apre BottomSheet con DurationSlider + NumberStepper
   → Corrisponde anche a TASK-017 web
8. MOB-007 — Touch targets minimi 44x44px ovunque [M]
   → Audit completo, padding per raggiungere 44px
9. MOB-022 — Haptic feedback esteso a Contracts/Trades/Admin [S]

TOTALE: 9 task, ~2-3 settimane
NOTA: TASK-006 e' la piu grande (XL) — Rubata.tsx va splittato in sotto-componenti.
Alla fine: npm run build deve passare.
```

---

## SPRINT COMBINATO 4 — Polish + PWA

```
Sono sul branch develop del progetto Fantacontratti.
Sprint 1, 2 e 3 completati. L'app ha DataTable, BottomNavBar, card view, BottomSheet filtri.
Devo implementare lo Sprint Combinato 4: polish finale + features PWA.

LEGGI PRIMA:
1. UI_SPRINT_PLAN.md → sezione "SPRINT 4"
2. MOBILE_UI_SPRINT_PLAN.md → sezione "SPRINT M4"
3. I backlog per i dettagli di ogni task

WORKFLOW GIT:
- git checkout develop && git pull origin develop
- git checkout -b feature/1.x-combined-sprint-4
- Committa ogni task separatamente
- PR verso develop

TASK DA IMPLEMENTARE:

--- PARTE A: WEB POLISH (4 task) ---
1. TASK-003 (#285) — Consolidare layout asta 6 pagine → 3 [XL]
2. TASK-016 (#298) — Virtualizzazione liste lunghe [M]
   → CHIEDI CONFERMA per installare @tanstack/react-virtual
3. TASK-017 (#299) — BottomSheet contratti mobile [M]
   → Se MOB-015 gia fatto in Sprint 3, questo e' completato
4. TASK-020 (#302) — Full-page comparison PlayerStats [M]

--- PARTE B: MOBILE PWA + GESTURES (5 task) ---
5. MOB-008 — Pull-to-refresh custom [M]
   → Creare src/hooks/usePullToRefresh.ts + src/components/PullToRefresh.tsx
6. MOB-012 — Swipe gesture per navigazione tab [M]
   → Creare src/hooks/useSwipeGesture.ts
   → AdminPanel, LeagueDetail
7. MOB-013 — Service Worker per cache offline [L]
   → CHIEDI CONFERMA per installare vite-plugin-pwa
   → Cache-first per asset, network-first per API
   → Pagina offline dedicata
8. MOB-019 — Swipe-to-dismiss modali [S]
   → Estendere Modal.tsx con swipe-down
9. MOB-020 — Landscape hint grafici [XS]
   → Se non fatto in Sprint 1, farlo qui

TOTALE: 9 task, ~2-3 settimane
NOTA: TASK-003 (consolidamento asta) e' la piu grande.
NOTA: MOB-013 (Service Worker) dipende da MOB-003 (PWA manifest, Sprint 1).
Alla fine: npm run build deve passare.

DOPO QUESTO SPRINT:
Restano solo le task in Backlog (priorita bassa/futura):
- Web: TASK-018, 019, 021, 030, 031, 032, 033, 034
- Mobile: MOB-016 (push notifications), MOB-017 (Web Share)
Queste si implementano quando serve.
```

---

## Riepilogo Sprint Combinati

| Sprint | Web | Mobile | Task Totali | Durata |
|--------|-----|--------|-------------|--------|
| **C1** Quick Wins | 8 task (Sprint 1) | 10 task (M1) | **18** | 1-2 sett |
| **C2** Foundation | 4 task (Sprint 2) | 3 task (M2) | **7** | 2 sett |
| **C3** Core | 4 task (Sprint 3) | 5 task (M3) | **9** | 2-3 sett |
| **C4** Polish | 4 task (Sprint 4) | 5 task (M4) | **9** | 2-3 sett |
| **Totale** | **20 task** | **23 task** | **43** | **7-10 sett** |

> Le restanti 9 task (web backlog + mobile backlog futuro) si implementano successivamente.
