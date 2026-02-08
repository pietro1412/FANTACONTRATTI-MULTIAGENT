# UI Review Report -- Fantacontratti Multiagent

> Generato il: 2026-02-08
> Agente: UI Review Agent v1.0
> Modalita: Review Only (nessuna modifica applicata)
> Metodo: Analisi statica del codice sorgente (code review completo di tutte le pagine e componenti)

---

## Panoramica Progetto

### Stack Tecnologico UI
| Tecnologia | Versione | Ruolo |
|-----------|---------|-------|
| React | 19.2.3 | Framework UI |
| React Router DOM | 7.11.0 | Routing SPA |
| Tailwind CSS | 3.4.19 | Utility-first CSS |
| Vite | 7.3.0 | Build tool + Dev server |
| TypeScript | 5.9.3 | Type safety |
| Pusher JS | 8.4.0 | Real-time WebSocket |
| @dnd-kit | 6.3.1 / 10.0.0 | Drag & Drop |
| XLSX | 0.18.5 | Export Excel |
| PDFKit | 0.17.2 | Generazione PDF |
| canvas-confetti | 1.9.4 | Animazioni celebrative |

### Librerie UI NON presenti (opportunita)
- Nessuna libreria di charting (recharts, chart.js, d3) -- i grafici sono SVG custom
- Nessuna libreria di icone (lucide, heroicons) -- icone SVG inline ovunque
- Nessun sistema di toast/notification esterno -- implementazione custom
- Nessuna virtualizzazione liste (react-window, tanstack-virtual)

### Pagine Analizzate: 23

| # | Route | Pagina | Tipo |
|---|-------|--------|------|
| 1 | `/login` | Login | Pubblica |
| 2 | `/register` | Register | Pubblica |
| 3 | `/forgot-password` | ForgotPassword | Pubblica |
| 4 | `/reset-password` | ResetPassword | Pubblica |
| 5 | `/rules` | Rules | Pubblica |
| 6 | `/dashboard` | Dashboard | Protetta |
| 7 | `/profile` | Profile | Protetta |
| 8 | `/leagues/new` | CreateLeague | Protetta |
| 9 | `/leagues/:id` | LeagueDetail | Protetta |
| 10 | `/leagues/:id/auction/:sid` | AuctionRoom | Protetta |
| 11 | `/leagues/:id/rose` | Rose (Rosa) | Protetta |
| 12 | `/leagues/:id/contracts` | Contracts | Protetta |
| 13 | `/leagues/:id/indemnity` | Indemnity | Protetta |
| 14 | `/leagues/:id/trades` | Trades | Protetta |
| 15 | `/leagues/:id/rubata` | Rubata | Protetta |
| 16 | `/leagues/:id/strategie-rubata` | StrategieRubata | Protetta |
| 17 | `/leagues/:id/svincolati` | Svincolati | Protetta |
| 18 | `/leagues/:id/players` | AllPlayers | Protetta |
| 19 | `/leagues/:id/manager` | ManagerDashboard | Protetta |
| 20 | `/leagues/:id/admin` | AdminPanel | Protetta |
| 21 | `/leagues/:id/movements` | Movements | Protetta |
| 22 | `/leagues/:id/history` | History | Protetta |
| 23 | `/leagues/:id/prophecies` | Prophecies | Protetta |
| 24 | `/leagues/:id/stats` | PlayerStats | Protetta |
| 25 | `/leagues/:id/financials` | LeagueFinancials | Protetta |
| 26 | `/leagues/:id/prizes` | PrizePhasePage | Protetta |
| 27 | `/leagues/:id/patch-notes` | PatchNotes | Protetta |
| 28 | `/leagues/:id/feedback` | FeedbackHub | Protetta |
| 29 | `/superadmin` | SuperAdmin | Protetta |
| 30 | `/invite/:token` | InviteDetail | Protetta |

### Viewport Analizzati (da codice, non screenshot)
- Desktop FHD (1920x1080)
- Desktop Laptop (1440x900)
- Tablet Portrait (768x1024)
- Tablet Landscape (1024x768)
- Mobile Small (375x812)
- Mobile Large (428x926)

### Componenti UI Condivisi
| Componente | File | Varianti |
|-----------|------|---------|
| Button | `src/components/ui/Button.tsx` | 6 varianti, 4 size |
| Card | `src/components/ui/Card.tsx` | 7 varianti, 5 padding |
| Input | `src/components/ui/Input.tsx` | 3 stati, 3 size |
| Badge | `src/components/ui/Badge.tsx` | 5 varianti, 2 size |
| Modal | `src/components/ui/Modal.tsx` | 5 size |
| BottomSheet | `src/components/ui/BottomSheet.tsx` | Mobile-only |
| Skeleton | `src/components/ui/Skeleton.tsx` | 9 varianti specializzate |
| DurationSlider | `src/components/ui/DurationSlider.tsx` | Standard + Compact |
| NumberStepper | `src/components/ui/NumberStepper.tsx` | 3 size |
| PositionBadge | `src/components/ui/PositionBadge.tsx` | 4 posizioni, 4 size |
| RadarChart | `src/components/ui/RadarChart.tsx` | SVG multi-player |
| PageLayout | `src/components/layout/PageLayout.tsx` | Con SectionCard, StatBox |
| Navigation | `src/components/Navigation.tsx` | Desktop + Mobile |
| ThemeSelector | `src/components/ThemeSelector.tsx` | 22 temi |

### Design System
- **Font primario:** Inter (system-ui fallback)
- **Font display:** Outfit
- **Font sport:** Oswald (timer, statistiche)
- **Palette:** Dark theme "Stadium Nights" con 22 temi selezionabili
- **Spacing base:** 4px grid (Tailwind default)
- **Border radius:** 8px (standard), 12px (lg), 16px (xl)
- **Touch target:** min 44x44px
- **Colori semantici:** Primary (blu #3b82f6), Secondary (verde #22c55e), Accent (oro #f59e0b), Danger (rosso #ef4444)

---

## Score Riepilogativo

| Pagina | Gerarchia | Densita | Consistenza | A11y | Responsive | Feedback | Nav | Perf | Media |
|--------|-----------|---------|-------------|------|------------|----------|-----|------|-------|
| Dashboard | 8/10 | 8/10 | 9/10 | 7/10 | 8/10 | 7/10 | 8/10 | 9/10 | **8.0** |
| LeagueDetail | 7/10 | 7/10 | 8/10 | 6/10 | 7/10 | 7/10 | 8/10 | 8/10 | **7.3** |
| AuctionRoom | 8/10 | 6/10 | 7/10 | 5/10 | 5/10 | 9/10 | 6/10 | 7/10 | **6.6** |
| Rose | 7/10 | 5/10 | 7/10 | 5/10 | 4/10 | 6/10 | 7/10 | 6/10 | **5.9** |
| Contracts | 6/10 | 5/10 | 7/10 | 5/10 | 4/10 | 6/10 | 7/10 | 6/10 | **5.8** |
| Trades | 6/10 | 6/10 | 7/10 | 5/10 | 5/10 | 7/10 | 7/10 | 7/10 | **6.3** |
| AllPlayers | 7/10 | 6/10 | 8/10 | 6/10 | 5/10 | 6/10 | 7/10 | 6/10 | **6.4** |
| ManagerDashboard | 7/10 | 6/10 | 8/10 | 6/10 | 6/10 | 7/10 | 7/10 | 7/10 | **6.8** |
| AdminPanel | 6/10 | 4/10 | 7/10 | 5/10 | 5/10 | 7/10 | 6/10 | 5/10 | **5.6** |
| Movements | 6/10 | 5/10 | 7/10 | 5/10 | 3/10 | 6/10 | 7/10 | 6/10 | **5.6** |
| History | 7/10 | 7/10 | 8/10 | 6/10 | 7/10 | 7/10 | 7/10 | 7/10 | **7.0** |
| Prophecies | 7/10 | 6/10 | 7/10 | 6/10 | 6/10 | 7/10 | 7/10 | 7/10 | **6.6** |
| LeagueFinancials | 7/10 | 4/10 | 7/10 | 5/10 | 3/10 | 6/10 | 7/10 | 6/10 | **5.6** |
| Rubata | 7/10 | 5/10 | 6/10 | 4/10 | 4/10 | 8/10 | 5/10 | 6/10 | **5.6** |
| StrategieRubata | 7/10 | 6/10 | 7/10 | 6/10 | 6/10 | 7/10 | 7/10 | 7/10 | **6.6** |
| Svincolati | 7/10 | 5/10 | 7/10 | 5/10 | 5/10 | 7/10 | 6/10 | 6/10 | **6.0** |
| PlayerStats | 8/10 | 5/10 | 8/10 | 6/10 | 4/10 | 7/10 | 7/10 | 5/10 | **6.3** |
| Profile | 8/10 | 8/10 | 8/10 | 7/10 | 8/10 | 7/10 | 8/10 | 8/10 | **7.8** |
| SuperAdmin | 6/10 | 5/10 | 7/10 | 5/10 | 5/10 | 6/10 | 6/10 | 5/10 | **5.6** |
| PrizePhasePage | 7/10 | 6/10 | 7/10 | 6/10 | 6/10 | 7/10 | 7/10 | 7/10 | **6.6** |
| FeedbackHub | 7/10 | 7/10 | 8/10 | 6/10 | 7/10 | 7/10 | 7/10 | 7/10 | **7.0** |
| PatchNotes | 8/10 | 8/10 | 8/10 | 7/10 | 8/10 | 7/10 | 7/10 | 8/10 | **7.6** |

**Media Globale: 6.5/10**

---

## Analisi Dettagliata per Pagina

---

### Dashboard

#### Score Breakdown
| Criterio | Score | Note |
|----------|-------|------|
| Gerarchia Visiva | 8/10 | Buona gerarchia con card league prominenti e CTA chiare |
| Densita Informativa | 8/10 | Equilibrata: nome lega, ruolo, budget, stato membership |
| Consistenza | 9/10 | Usa Card component standard, colori semantici coerenti |
| Accessibilita | 7/10 | Focus states presenti, mancano aria-label su alcune card |
| Responsiveness | 8/10 | Grid responsive 1-2-3 colonne, buon adattamento mobile |
| Feedback & Stati | 7/10 | Loading spinner presente, empty state con emoji. Manca skeleton loading |
| Navigazione | 8/10 | CTA "Crea Lega" ben visibile, search modal accessibile |
| Performance Percepita | 9/10 | Import statico (non lazy), rendering rapido |

#### Problemi Identificati

1. **[MEDIO]** Empty state basico con sola emoji
   - **Dove:** Dashboard.tsx, stato senza leghe
   - **Perche e' un problema:** L'utente nuovo non ha guida visiva su cosa fare
   - **Proposta:** Aggiungere illustrazione, testo guida, e CTA prominente "Crea la tua prima lega"

2. **[BASSO]** Nessun skeleton loader durante il caricamento delle leghe
   - **Dove:** Dashboard.tsx, stato isLoading
   - **Perche e' un problema:** Lo spinner generico non comunica cosa sta arrivando
   - **Proposta:** Usare SkeletonCard gia disponibile in `Skeleton.tsx`

3. **[BASSO]** Il pulsante "Cerca Leghe" potrebbe essere piu prominente
   - **Dove:** Dashboard.tsx, header area
   - **Perche e' un problema:** Un nuovo utente potrebbe non notare la possibilita di cercare leghe esistenti

---

### LeagueDetail

#### Score Breakdown
| Criterio | Score | Note |
|----------|-------|------|
| Gerarchia Visiva | 7/10 | Header con info lega, sezioni ben divise. Banner fasi ben colorati |
| Densita Informativa | 7/10 | Mostra nome, descrizione, partecipanti, sessioni, stato fase |
| Consistenza | 8/10 | Usa componenti standard, colori fase coerenti |
| Accessibilita | 6/10 | Mancano aria-label su banner cliccabili delle fasi |
| Responsiveness | 7/10 | Grid 3 colonne su desktop, stacking su mobile |
| Feedback & Stati | 7/10 | Loading states presenti, modal conferma sessione |
| Navigazione | 8/10 | Punto di ingresso chiaro per tutte le funzionalita della lega |
| Performance Percepita | 8/10 | Lazy loaded, rendering efficiente |

#### Problemi Identificati

1. **[ALTO]** Banner fasi di mercato senza affordance chiara
   - **Dove:** LeagueDetail.tsx, sezione fasi
   - **Perche e' un problema:** I banner delle fasi sono cliccabili ma non sembrano bottoni. L'utente potrebbe non capire che puo interagire
   - **Proposta:** Aggiungere icona freccia o indicatore "Vai >" e effetto hover piu marcato

2. **[MEDIO]** Lista partecipanti con budget senza ordinamento
   - **Dove:** LeagueDetail.tsx, sezione partecipanti
   - **Perche e' un problema:** Con 7+ partecipanti, l'utente non puo ordinare per budget o nome
   - **Proposta:** Aggiungere header cliccabili per sorting

---

### AuctionRoom

#### Score Breakdown
| Criterio | Score | Note |
|----------|-------|------|
| Gerarchia Visiva | 8/10 | Timer dominante, player card centrale. 6 layout diversi disponibili |
| Densita Informativa | 6/10 | Molta informazione compressa: budget, roster, bid, timer, storico |
| Consistenza | 7/10 | 6 layout diversi (A-F) con stili leggermente diversi tra loro |
| Accessibilita | 5/10 | Timer basato solo su colore per urgenza, touch target da verificare nei controlli bid |
| Responsiveness | 5/10 | Layout complesso su mobile, bid controls fixed bottom su mobile |
| Feedback & Stati | 9/10 | Eccellente: 8+ stati con modal dedicati, animazioni, suoni, confetti |
| Navigazione | 6/10 | Difficile uscire dalla stanza asta, focus sulla sessione |
| Performance Percepita | 7/10 | Pusher real-time, ma polling adattivo come fallback |

#### Problemi Identificati

1. **[CRITICO]** 6 layout asta (A-F) con inconsistenze di stile tra loro
   - **Dove:** `src/components/auction/LayoutA.tsx` - `LayoutF.tsx`
   - **Perche e' un problema:** L'utente puo cambiare layout e trovare comportamenti/stili diversi. Manutenzione 6x
   - **Proposta:** Consolidare in 2-3 layout (Mobile, Desktop Standard, Desktop Pro) con componenti condivisi

2. **[CRITICO]** Responsiveness su mobile con troppa informazione
   - **Dove:** AuctionRoom.tsx, tutti i layout
   - **Perche e' un problema:** Su mobile 375px, timer + player + bid + budget + roster devono tutti stare in vista
   - **Proposta:** Mobile: mostrare solo Timer + Player + Bid Button. Tutto il resto in BottomSheet scorrevole

3. **[ALTO]** Timer comunica urgenza solo tramite colore
   - **Dove:** AuctionTimer.tsx, stati timer-safe/warning/danger
   - **Perche e' un problema:** Utenti daltonici non percepiscono il cambio verde > giallo > rosso
   - **Proposta:** Aggiungere vibrazione (navigator.vibrate), beep audio progressivo, e label testuale ("Tempo quasi scaduto!")

---

### Rose (Rosa/Squadra)

#### Score Breakdown
| Criterio | Score | Note |
|----------|-------|------|
| Gerarchia Visiva | 7/10 | Sidebar con stats + tabella principale ben strutturata |
| Densita Informativa | 5/10 | Tabella con 11+ colonne: troppo densa, soprattutto su tablet |
| Consistenza | 7/10 | Usa PositionBadge, colori contratto coerenti |
| Accessibilita | 5/10 | Tabella senza scope headers, colonne nascoste su mobile senza indicazione |
| Responsiveness | 4/10 | 11+ colonne problematiche sotto 1024px. Card layout su mobile ma incompleto |
| Feedback & Stati | 6/10 | Loading state presente, PlayerStatsModal integrato |
| Navigazione | 7/10 | Sidebar sticky, filtri posizione funzionali |
| Performance Percepita | 6/10 | Nessuna virtualizzazione per rose grandi |

#### Problemi Identificati

1. **[CRITICO]** Tabella 11+ colonne non usabile su tablet e mobile
   - **Dove:** Rose.tsx, tabella roster principale
   - **Perche e' un problema:** Su tablet (768px) o mobile, le colonne vengono nascoste con `hidden lg:table-cell` ma l'utente perde dati importanti senza saperlo
   - **Proposta:** Implementare card layout completo su mobile con expand/collapse per dettagli. Su tablet: tabella con scroll orizzontale e indicatore "scorri >"

2. **[ALTO]** Sidebar sticky non collassabile su desktop stretto
   - **Dove:** Rose.tsx, sidebar manager
   - **Perche e' un problema:** Su laptop 1280px, la sidebar occupa spazio prezioso
   - **Proposta:** Sidebar collassabile con toggle, mostrando solo icone quando collassata

3. **[MEDIO]** Color-coding durata contratto senza legenda
   - **Dove:** Rose.tsx, colonna durata
   - **Perche e' un problema:** I colori 1yr=rosso, 2yr=giallo, 3yr=verde, 4yr=blu non hanno legenda visibile
   - **Proposta:** Aggiungere legenda compatta sotto i filtri o come tooltip informativo

---

### Contracts

#### Score Breakdown
| Criterio | Score | Note |
|----------|-------|------|
| Gerarchia Visiva | 6/10 | Form-heavy, difficile distinguere azioni primarie da secondarie |
| Densita Informativa | 5/10 | Molti campi per ogni contratto, tabella densa |
| Consistenza | 7/10 | Usa componenti standard per form elements |
| Accessibilita | 5/10 | Form labels presenti ma tabella complessa da navigare con tastiera |
| Responsiveness | 4/10 | Tabella contratti problematica su mobile |
| Feedback & Stati | 6/10 | Validazione form presente, stati contratto colorati |
| Navigazione | 7/10 | Accessibile da Rose e LeagueDetail |
| Performance Percepita | 6/10 | File grande (~29KB), rendering pesante |

#### Problemi Identificati

1. **[CRITICO]** Form di modifica contratto non ottimizzato per mobile
   - **Dove:** Contracts.tsx, form contratto
   - **Perche e' un problema:** Modificare salario/durata/clausola su mobile richiede precisione su campi piccoli
   - **Proposta:** Usare BottomSheet dedicato con DurationSlider e NumberStepper gia esistenti, full-width su mobile

2. **[ALTO]** Status badge contratto senza spiegazione
   - **Dove:** Contracts.tsx, badge "Da impostare", "Scaduto", "In scadenza", "Attivo"
   - **Perche e' un problema:** Un nuovo utente non capisce cosa significano gli stati
   - **Proposta:** Aggiungere tooltip informativo su hover/tap con spiegazione dello stato e azione richiesta

---

### AdminPanel

#### Score Breakdown
| Criterio | Score | Note |
|----------|-------|------|
| Gerarchia Visiva | 6/10 | 8 tab in una riga: difficile trovare quello che serve |
| Densita Informativa | 4/10 | Troppe funzionalita in una pagina, 1573 righe di codice |
| Consistenza | 7/10 | Tab design coerente, badge contatori |
| Accessibilita | 5/10 | Tab navigabili ma senza aria-selected, panels senza aria-labelledby |
| Responsiveness | 5/10 | 8 tab su mobile: overflow orizzontale probabile |
| Feedback & Stati | 7/10 | Buon feedback per azioni admin, progress bars |
| Navigazione | 6/10 | Tab bar sovraffollata, ricerca contenuti difficile |
| Performance Percepita | 5/10 | File molto grande, tutti i tab caricati insieme |

#### Problemi Identificati

1. **[CRITICO]** 8 tab in una riga: non scalabile su mobile
   - **Dove:** AdminPanel.tsx, tab bar
   - **Perche e' un problema:** Su mobile (375px), 8 tab non entrano. Anche su tablet la leggibilita e' compromessa
   - **Proposta:** Su mobile: usare BottomSheet con lista voci. Su tablet: tab scrollabili con indicatori laterali

2. **[ALTO]** Pagina monolitica da 1573+ righe
   - **Dove:** AdminPanel.tsx
   - **Perche e' un problema:** Tutto viene renderizzato insieme. Cambi di tab non sono lazy
   - **Proposta:** Lazy-load dei contenuti tab, splitting in sotto-componenti dedicati

3. **[MEDIO]** Consolidation status display complesso
   - **Dove:** AdminPanel.tsx, tab Market
   - **Perche e' un problema:** Lo stato di consolidamento con percentuali e progress bar puo confondere admin non esperti
   - **Proposta:** Aggiungere stepper visuale con fasi chiare: Fase 1 > Fase 2 > Completato

---

### Movements

#### Score Breakdown
| Criterio | Score | Note |
|----------|-------|------|
| Gerarchia Visiva | 6/10 | Header compatto, focus sulla tabella |
| Densita Informativa | 5/10 | 12+ colonne: tipo, stagione, giocatore, da, a, prezzo, contratto, data |
| Consistenza | 7/10 | Badge tipo movimento coerenti con sistema colori |
| Accessibilita | 5/10 | Tabella senza scope, righe espandibili senza aria-expanded |
| Responsiveness | 3/10 | 12+ colonne: completamente inutilizzabile su mobile |
| Feedback & Stati | 6/10 | Righe espandibili per profezie, input con char counter |
| Navigazione | 7/10 | Filtri per tipo, ricerca |
| Performance Percepita | 6/10 | Nessuna virtualizzazione per cronologie lunghe |

#### Problemi Identificati

1. **[CRITICO]** 12+ colonne tabella = inutilizzabile sotto 1024px
   - **Dove:** Movements.tsx, tabella movimenti
   - **Perche e' un problema:** Su mobile e tablet portrait, la tabella e' completamente illeggibile
   - **Proposta:** Card layout su mobile con: header (tipo + data), body (giocatore + da/a), footer (prezzo + contratto). Aggiungere filtro tipo prominente

2. **[ALTO]** Nessun filtro data/periodo visibile
   - **Dove:** Movements.tsx
   - **Perche e' un problema:** Con molti movimenti, l'utente non puo filtrare per periodo
   - **Proposta:** Aggiungere filtro per sessione/semestre come dropdown

---

### LeagueFinancials

#### Score Breakdown
| Criterio | Score | Note |
|----------|-------|------|
| Gerarchia Visiva | 7/10 | Banner riepilogativo + tabella ordinabile + grafici espandibili |
| Densita Informativa | 4/10 | 13+ colonne con formule finanziarie complesse |
| Consistenza | 7/10 | Colori finanziari coerenti (budget=blu, acquisizioni=arancione, bilancio=verde/rosso) |
| Accessibilita | 5/10 | Grafici SVG senza alternative testuali, tabella senza scope |
| Responsiveness | 3/10 | 13+ colonne = scroll necessario, grafici a dimensione fissa |
| Feedback & Stati | 6/10 | Sort arrows presenti, righe espandibili |
| Navigazione | 7/10 | Collegato dal menu lega come "Finanze" |
| Performance Percepita | 6/10 | Calcoli memoizzati ma rendering pesante con grafici |

#### Problemi Identificati

1. **[CRITICO]** Tabella 13+ colonne con grafici inline
   - **Dove:** LeagueFinancials.tsx, tabella principale
   - **Perche e' un problema:** Anche su desktop 1440px e' densa. Su mobile completamente inutilizzabile
   - **Proposta:** Mobile: card per team con KPI principali (budget, bilancio, slot) e tap-to-expand per dettagli. Desktop: raggruppare colonne in sezioni collassabili

2. **[ALTO]** Grafici SVG custom senza libreria
   - **Dove:** LeagueFinancials.tsx, DonutChart e BudgetBarChart
   - **Perche e' un problema:** SVG custom sono difficili da mantenere, non responsive, e senza accessibilita
   - **Proposta:** Valutare recharts o chart.js per grafici accessibili e responsive

3. **[MEDIO]** Formule finanziarie visualizzate come testo grezzo
   - **Dove:** LeagueFinancials.tsx, riga espansa
   - **Perche e' un problema:** Le formule sono comprensibili solo per utenti esperti
   - **Proposta:** Visualizzare con barra progressiva o waterfall chart per rendere intuitivo il calcolo

---

### PlayerStats

#### Score Breakdown
| Criterio | Score | Note |
|----------|-------|------|
| Gerarchia Visiva | 8/10 | Filtri prominenti, tabella ordinabile, confronto multi-player |
| Densita Informativa | 5/10 | Colonne dinamiche con preset per ruolo: ottime ma dense |
| Consistenza | 8/10 | Uso coerente di PositionBadge, RadarChart per confronto |
| Accessibilita | 6/10 | Checkbox selezione per confronto, sort indicators |
| Responsiveness | 4/10 | Tabella con molte colonne + scroll orizzontale su mobile |
| Feedback & Stati | 7/10 | Modal confronto con radar chart, color-coding rating |
| Navigazione | 7/10 | Preset colonne per ruolo (All/P/D/C/A/Essential) |
| Performance Percepita | 5/10 | Paginazione 50/page ma nessuna virtualizzazione, molte colonne |

#### Problemi Identificati

1. **[ALTO]** Confronto giocatori in modal = schermo troppo piccolo
   - **Dove:** PlayerStats.tsx, comparison modal
   - **Perche e' un problema:** Confrontare 4 giocatori con radar chart in un modal 576px max e' stretto
   - **Proposta:** Full-page comparison view con layout side-by-side su desktop, card stack su mobile

2. **[MEDIO]** Column selector dropdown complesso
   - **Dove:** PlayerStats.tsx, colonne personalizzabili
   - **Perche e' un problema:** Molte colonne in un dropdown, difficile trovare quella giusta
   - **Proposta:** Raggruppare colonne per categoria (Generali, Attacco, Difesa, Passaggio, Disciplina) con toggle per gruppo

---

### Rubata

#### Score Breakdown
| Criterio | Score | Note |
|----------|-------|------|
| Gerarchia Visiva | 7/10 | State machine chiara con 8+ stati, modal overlay per transizioni |
| Densita Informativa | 5/10 | Budget + board + timer + admin controls + bid input tutto insieme |
| Consistenza | 6/10 | Modal per ogni transizione di stato con gradient diversi: troppa varieta |
| Accessibilita | 4/10 | Molti modal annidati, drag-and-drop senza alternative tastiera esplicite |
| Responsiveness | 4/10 | Board + sidebar + timer = layout complesso su mobile |
| Feedback & Stati | 8/10 | Eccellente feedback per ogni transizione di stato |
| Navigazione | 5/10 | Stato della "stanza" puo confondere, difficile capire dove si e' nel flusso |
| Performance Percepita | 6/10 | 2000+ righe, Pusher real-time con polling fallback |

#### Problemi Identificati

1. **[CRITICO]** 2000+ righe in un singolo componente
   - **Dove:** Rubata.tsx
   - **Perche e' un problema:** Impossibile da mantenere, tutte le variabili di stato nello stesso scope
   - **Proposta:** Separare in: RubataRoom (orchestratore), RubataBoard, RubataBidPanel, RubataModals, useRubataState hook

2. **[ALTO]** Drag-and-drop ordine preferenze senza alternativa keyboard
   - **Dove:** Rubata.tsx, preference ordering
   - **Perche e' un problema:** Utenti che usano tastiera non possono riordinare le preferenze
   - **Proposta:** Aggiungere bottoni su/giu per ogni voce come alternativa a DnD

3. **[ALTO]** Modal "a catena" per transizioni di stato
   - **Dove:** Rubata.tsx, PENDING_ACK, AUCTION_READY_CHECK, APPEAL, etc.
   - **Perche e' un problema:** L'utente puo vedere 2-3 modal di fila senza capire il flusso
   - **Proposta:** Stepper visivo in alto che mostra "Sei qui: Offerta > Conferma > Profezia > Completato"

---

### Profile

#### Score Breakdown
| Criterio | Score | Note |
|----------|-------|------|
| Gerarchia Visiva | 8/10 | Layout pulito con sezioni ben separate |
| Densita Informativa | 8/10 | Solo informazioni necessarie: foto, account, password, leghe |
| Consistenza | 8/10 | Usa Card e Button standard |
| Accessibilita | 7/10 | Form labels presenti, validazione inline |
| Responsiveness | 8/10 | max-w-2xl container, stacking naturale |
| Feedback & Stati | 7/10 | Overlay spinner upload, errori inline |
| Navigazione | 8/10 | Back button chiaro, sezioni logiche |
| Performance Percepita | 8/10 | Leggera, pochi dati |

#### Problemi Identificati

1. **[BASSO]** Password change form collassabile senza indicatore chiaro
   - **Dove:** Profile.tsx, sezione password
   - **Perche e' un problema:** L'utente potrebbe non trovare l'opzione cambio password
   - **Proposta:** Bottone esplicito "Cambia Password" con icona lucchetto

---

## Analisi Cross-Pagina: Pattern Problematici Ricorrenti

### 1. Tabelle Dense Non Responsive (Impatto: 8 pagine)
**Pagine affette:** Rose, Contracts, Movements, LeagueFinancials, PlayerStats, AdminPanel, ManagerDashboard, PrizePhasePage

Il pattern piu problematico dell'applicazione. Le tabelle con 10+ colonne usano `hidden lg:table-cell` per nascondere colonne su mobile, ma questo:
- Nasconde dati importanti senza avvisare l'utente
- Non offre modo di accedere ai dati nascosti
- Su tablet portrait (768px) la situazione e' critica

### 2. SVG Icons Inline Ovunque (Impatto: tutti i componenti)
**File:** Navigation.tsx (130+ righe solo di definizioni icone SVG)

Tutte le icone sono SVG inline definiti come componenti JSX. Questo:
- Aumenta la dimensione del bundle
- Rende difficile la consistenza (dimensioni, stroke-width variabili)
- Non permette tree-shaking

### 3. Pagine Monolitiche (Impatto: 3 pagine critiche)
**File affetti:** AdminPanel.tsx (1573 righe), Rubata.tsx (2000+ righe), Contracts.tsx (~29KB)

Componenti troppo grandi che rendono difficile manutenzione, testing, e lazy-loading granulare.

### 4. Mancanza di Virtualizzazione Liste (Impatto: 5 pagine)
**Pagine affette:** AllPlayers, Movements, Prophecies, Rose, PlayerStats

Liste potenzialmente lunghe (100+ giocatori, movimenti storici) senza react-window o simili.

---

## Proposte Layout per Profilo

### Dashboard -- Proposte Layout

#### Proposte per Layout SIMPLE
> Target: Manager che vuole info rapide in 5 secondi

**Proposta S-DASH-1: Dashboard KPI-First**
```
MOBILE (375px)
+-----------------------------------+
| [Logo] Fantacontratti    [Avatar] |
+-----------------------------------+
| +-------------------------------+ |
| | Budget: 145.2M     18/25 GC  | |
| | Prossima Asta: 3gg           | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| |  LEGA SERIE A DYNASTY        | |
| |  Fase: Mercato Ricorrente    | |
| |  [Vai alla Lega]             | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| |  LEGA CHAMPIONS               | |
| |  Fase: Contratti             | |
| |  [Vai alla Lega]             | |
| +-------------------------------+ |
+-----------------------------------+
```
- Max 3 KPI visibili (Budget, Giocatori, Prossima Asta)
- Card lega con singola CTA "Vai alla Lega"
- Nessun filtro, nessuna ricerca
- File coinvolti: `src/pages/Dashboard.tsx`
- Sforzo: S (1-3h)

#### Proposte per Layout MEDIUM
> Target: Manager che vuole esplorare e confrontare

**Proposta M-DASH-1: Dashboard Multi-Lega Comparativa**
```
DESKTOP (1440px)
+--------------------------------------------------------------------+
| [Logo]  |  [Search Leagues]  [Crea Lega]  |  [Notifiche] [Avatar] |
+--------------------------------------------------------------------+
| KPI: Budget Tot | Giocatori Tot | Leghe Attive | Contratti Scad.   |
+--------------------------------------------------------------------+
|                                                                     |
| +-----------------------+  +-----------------------+                |
| | LEGA SERIE A DYNASTY  |  | LEGA CHAMPIONS        |              |
| | Budget: 145.2M        |  | Budget: 89.7M         |              |
| | Giocatori: 18/25      |  | Giocatori: 22/25      |              |
| | Fase: Mercato Ric.    |  | Fase: Contratti        |              |
| | Prossima azione:      |  | Prossima azione:       |              |
| | "Conferma contratti"  |  | "Imposta rinnovi"     |              |
| | [Dashboard] [Rosa]    |  | [Dashboard] [Contratti]|              |
| +-----------------------+  +-----------------------+                |
|                                                                     |
| Ultime Notifiche:                                                   |
| - Mario ha proposto uno scambio (2h fa)                            |
| - Sessione rubata aperta (ieri)                                    |
+--------------------------------------------------------------------+
```
- 4-6 KPI aggregati multi-lega
- Card con "prossima azione" suggerita
- Quick actions su ogni card
- Feed notifiche recenti
- File coinvolti: `src/pages/Dashboard.tsx`, `src/components/Notifications.tsx`
- Sforzo: M (3-8h)

#### Proposte per Layout COMPLEX
> Target: Power user analitico

**Proposta C-DASH-1: Dashboard Analitica Multi-Panel**
```
DESKTOP (1920px)
+------------------------------------------------------------------------+
| [Logo] | [Cmd+K Search] | [Notifiche] [Avatar]                       |
+------------------------------------------------------------------------+
| +-- Tab: Lega A --+-- Tab: Lega B --+-- Tab: Budget Analysis --+      |
| |                  |                 |                           |      |
| | [KPI Row]        | [KPI Row]      | [Budget Trend Chart]     |      |
| | Budget | GC | $  | Budget | GC    | Line chart 6 mesi        |      |
| |                  |                 |                           |      |
| | [Roster Heat]    | [Roster Heat]  | [Scatter: Val/Budget]    |      |
| | Heatmap per      | Heatmap per    | Ogni lega come punto     |      |
| | posizione        | posizione      |                           |      |
| |                  |                 |                           |      |
| | [Alert Feed]     | [Calendar]     | [Export CSV/PDF]         |      |
| +------------------+-----------------+---------------------------+      |
+------------------------------------------------------------------------+
```
- Multi-tab workspace con tab persistenti per ogni lega
- Command palette (Ctrl+K)
- Heatmap roster per posizione
- Scatter plot valore/budget
- Calendar con eventi prossimi
- Export multi-formato
- File coinvolti: Nuovo componente `DashboardWorkspace.tsx`, `CommandPalette.tsx`
- Sforzo: XL (2-5gg)

---

### LeagueFinancials -- Proposte Layout

#### Proposte per Layout SIMPLE

**Proposta S-FIN-1: Finanze Quick View**
```
MOBILE (375px)
+-----------------------------------+
| < Finanze Lega                    |
+-----------------------------------+
| Il tuo team:                      |
| +-------------------------------+ |
| | Budget: 145.2M                | |
| | Speso: 87.3M                  | |
| | Bilancio: +57.9M             | |
| | Slot liberi: 7/25            | |
| +-------------------------------+ |
|                                   |
| Classifica Budget:                |
| 1. FC Mario      145.2M         |
| 2. AC Luigi      132.1M         |
| 3. AS Peach      128.9M         |
| 4. US Toad       115.3M         |
| ...                               |
+-----------------------------------+
```
- Solo 4 KPI del proprio team
- Classifica budget a lista semplice
- Nessun grafico
- File coinvolti: `src/pages/LeagueFinancials.tsx`
- Sforzo: S (1-3h)

#### Proposte per Layout MEDIUM

**Proposta M-FIN-1: Finanze Comparative**
```
DESKTOP (1440px)
+--------------------------------------------------------------------+
| < Finanze Lega                           [Export Excel] [Export PDF] |
+--------------------------------------------------------------------+
|                                                                     |
| +----------+ +----------+ +----------+ +----------+                |
| | Budget   | | Speso    | | Bilancio | | Slot     |                |
| | 145.2M   | | 87.3M    | | +57.9M   | | 7/25     |               |
| | +12% vs  | | -5% vs   | |          | |          |               |
| | media    | | media    | |          | |          |               |
| +----------+ +----------+ +----------+ +----------+                |
|                                                                     |
| [Bar Chart: Budget vs Speso per Team]                               |
|  FC Mario  ████████████░░░  145M / 88M                              |
|  AC Luigi  ██████████░░░░  132M / 95M                               |
|  AS Peach  █████████░░░░░  129M / 72M                               |
|                                                                     |
| [Donut: Distribuzione per Ruolo]                                    |
| P: 15%  D: 30%  C: 35%  A: 20%                                     |
|                                                                     |
| Tabella dettagli (6 colonne max):                                   |
| Team | Budget | Acquisti | Bilancio | Slot | Eta Media              |
+--------------------------------------------------------------------+
```
- 4 KPI con trend vs media
- Bar chart orizzontale budget vs speso
- Donut distribuzione per ruolo
- Tabella ridotta a 6 colonne
- File coinvolti: `src/pages/LeagueFinancials.tsx`
- Sforzo: M (3-8h)

#### Proposte per Layout COMPLEX

**Proposta C-FIN-1: Analytics Finanziaria Avanzata**
```
DESKTOP (1920px)
+------------------------------------------------------------------------+
| < Finanze Lega            [Query Builder] [Alerts] [Export]            |
+------------------------------------------------------------------------+
| +--Waterfall Chart: Flusso Budget Stagionale-------------------------+ |
| | Budget Iniziale > +Acquisti > -Cessioni > +Clausole > = Bilancio   | |
| +--------------------------------------------------------------------+ |
|                                                                        |
| +--Pivot Table------------------------------------------------------+  |
| | Raggruppamento: [Per Ruolo v] [Per Semestre v]                    |  |
| | P  | Budget: 22M | Acquisti: 3 | Media: 7.3M | Trend: +5%       |  |
| |   > Sommer   | 8M  | Primo Merc. | Clausola: 12M                |  |
| |   > Donnaruma| 14M | Rubata     | Clausola: 20M                |  |
| | D  | Budget: 45M | ...                                           |  |
| +--------------------------------------------------------------------+ |
|                                                                        |
| +--Heatmap: Costo/Rendimento per Team-------------------------------+  |
| |        | Budget | Salari | FVM    | ROI                           |  |
| | Mario  | ████   | ███    | ████   | ██                            |  |
| | Luigi  | ███    | ████   | ██     | ████                          |  |
| +--------------------------------------------------------------------+ |
|                                                                        |
| Alert Configurati: Budget < 20M [Attivo] | Clausola > 15M [Attivo]     |
+------------------------------------------------------------------------+
```
- Waterfall chart per flusso budget
- Pivot table con drill-down
- Heatmap costo/rendimento
- Alert configurabili
- Query builder per filtri complessi
- File coinvolti: Nuovi componenti WaterfallChart, PivotTable, Heatmap
- Sforzo: XL (2-5gg)

---

### AuctionRoom -- Proposte Layout

#### Proposte per Layout SIMPLE

**Proposta S-AUC-1: Asta Mobile-First**
```
MOBILE (375px)
+-----------------------------------+
|         TIMER: 00:15              |
|    [████████████░░░░░░]           |
+-----------------------------------+
|                                   |
|    +--Player Card--+              |
|    |  [Photo]      |              |
|    |  Lautaro      |              |
|    |  A - Inter    |              |
|    |  Quot: 35M    |              |
|    +---------------+              |
|                                   |
|  Offerta corrente: 42M           |
|  Di: FC Mario                    |
|                                   |
+-----------------------------------+
|  [- ] [ 43M ] [+ ]  [OFFRI!]    |
+-----------------------------------+
```
- Timer prominente in alto
- Una sola card giocatore centrale
- Bid input + button fissi in basso
- Tutto il resto in BottomSheet
- File coinvolti: Nuovo `LayoutMobile.tsx`
- Sforzo: M (3-8h)

---

## Analisi Trasversale: Temi e Pattern

### Cosa Funziona Bene
1. **Sistema temi:** 22 temi con CSS variables e' un punto di forza unico
2. **Position Badge:** Accessibile con forme + colori (colorblind-friendly)
3. **Skeleton loaders:** 9 varianti specializzate gia pronte
4. **Real-time:** Pusher integration con fallback polling
5. **Loading screen:** Coerente con brand (pallone + gradiente)
6. **Navigation desktop:** Menu lega compatto e ben organizzato
7. **Button system:** 6 varianti complete con loading state

### Cosa Richiede Miglioramento
1. **Responsiveness tabelle:** Pattern piu critico, affligge 8 pagine
2. **Pagine monolitiche:** 3 pagine > 1500 righe ciascuna
3. **Icone SVG inline:** 130+ righe solo in Navigation.tsx
4. **Grafici custom SVG:** Fragili e non accessibili
5. **Mancanza virtualizzazione:** Liste lunghe senza ottimizzazione
6. **Empty states:** Basici, con solo emoji e testo
7. **Breadcrumbs mobile:** Nascosti su schermi piccoli

---

## Raccomandazioni Architetturali

### Quick Wins (impatto alto, sforzo basso)
1. Sostituire spinner con Skeleton loader nelle pagine che gia hanno SkeletonCard disponibile
2. Aggiungere `aria-label` ai pulsanti icon-only
3. Aggiungere legenda colori durata contratto
4. Usare BottomSheet per form su mobile (gia disponibile)

### Investimenti Strutturali (impatto alto, sforzo medio-alto)
1. Libreria icone (lucide-react): sostituisce 100+ SVG inline
2. Libreria charting (recharts): sostituisce grafici SVG custom
3. Virtualizzazione liste (react-window): per pagine con 100+ righe
4. Splitting componenti monolitici: AdminPanel, Rubata, Contracts

### Evoluzione Design System
1. Documentare i token di design in un file condiviso
2. Creare componente DataTable responsivo riutilizzabile
3. Creare componente EmptyState standardizzato
4. Creare componente StepperProgress per flussi multi-fase

---

*Report generato tramite analisi statica del codice sorgente. Tutti gli score sono basati sulla review del codice TSX, CSS, e configurazioni Tailwind. Nessun file del progetto e' stato modificato.*
