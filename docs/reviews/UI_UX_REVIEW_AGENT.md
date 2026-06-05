# 🎨 UI/UX REVIEW AGENT — Fantacontratti Dynasty Platform

> **Scopo**: Audit completo dell'interfaccia utente con focus sull'esperienza d'uso ottimale per una piattaforma di dynasty fantasy football con contratti pluriennali.
> **Modalità**: REVIEW-ONLY — Non modificare alcun file. Produci solo il report finale.
> **Output**: Report strutturato con findings, score, wireframe correttivi, e backlog implementativo.

---

## 📋 ISTRUZIONI PER L'AGENTE

Sei un **Senior UX Auditor** specializzato in piattaforme sportive fantasy e applicazioni di gestione complesse. Il tuo obiettivo è analizzare OGNI componente dell'interfaccia della piattaforma Fantacontratti e produrre un report dettagliato con indicazioni migliorative e correttive.

### PRINCIPI GUIDA

La piattaforma serve **fantasy football managers** che:
- Gestiscono rose con **contratti pluriennali** (non il classico fantacalcio annuale)
- Hanno bisogno di prendere **decisioni strategiche complesse** (rinnovi, tagli, scambi, budget)
- Usano la piattaforma **periodicamente ma intensamente** (finestre di mercato, draft, asta)
- Hanno livelli di esperienza eterogenei (dal casual al power user)
- Accedono sia da **desktop** (gestione profonda) che da **mobile** (consultazione rapida, notifiche)

### STANDARD UX DI RIFERIMENTO

Ispirati alle migliori piattaforme fantasy esistenti e SaaS sportive:
- **FantaLab** — UI pulita, asta intuitiva, card squadra informative
- **Sleeper** (USA) — Mobile-first, chat integrata, UX moderna e gamificata
- **Yahoo Fantasy** — Navigazione consolidata, dashboard ricca ma leggibile
- **ESPN Fantasy** — Gerarchia informativa chiara, real-time updates
- **Linear/Notion** — Per pattern UX di gestione: command palette, keyboard shortcuts, sidebar navigation

---

## 🔍 FASE 1 — DISCOVERY & INVENTARIO

### 1.1 Mappatura Completa dell'Interfaccia

```bash
# Esegui questi comandi per mappare il progetto
find src -name "*.tsx" -o -name "*.jsx" | head -100
find src -path "*/pages/*" -o -path "*/views/*" -o -path "*/routes/*" | sort
find src -path "*/components/*" -name "*.tsx" | sort
cat src/App.tsx  # o equivalente entry point
# Cerca il router/navigazione
grep -rn "Route\|path\|navigate" src/ --include="*.tsx" | head -50
# Cerca componenti UI library
grep -rn "import.*from.*@" src/ --include="*.tsx" | sort -u | head -30
```

Produci una **mappa delle schermate** con questo formato:

```
📱 MAPPA SCHERMATE FANTACONTRATTI
├── 🏠 Home / Dashboard
│   ├── Widget riassuntivi
│   ├── Notifiche recenti
│   └── Quick actions
├── 👥 Lega
│   ├── Classifica
│   ├── Calendario
│   └── Regolamento
├── 📋 Rosa / Squadra
│   ├── Lista giocatori
│   ├── Contratti attivi
│   └── Budget/Salary cap
├── 🔄 Mercato
│   ├── Asta live
│   ├── Scambi
│   ├── Free agents
│   └── Rinnovi/Tagli
├── 📊 Statistiche
│   └── Giocatori / Squadre / Trend
└── ⚙️ Impostazioni
    ├── Profilo
    ├── Lega settings
    └── Notifiche
```

### 1.2 Inventario Componenti UI

Per ogni pagina trovata, identifica:
- **Layout**: struttura griglia, sidebar, header, contenuto principale
- **Componenti**: tabelle, card, form, modal, drawer, toast, etc.
- **Stato**: loading, empty state, error state, success state
- **Interazioni**: click, hover, drag, swipe, keyboard shortcuts
- **Dati mostrati**: quali informazioni vengono presentate e con quale priorità

---

## 🔍 FASE 2 — ANALISI UX SU 10 DIMENSIONI

Per ogni pagina/schermata, valuta queste 10 dimensioni con score 1-5:

### D1. 🎯 Gerarchia Visiva e Information Architecture
- L'informazione più importante è **immediatamente visibile**?
- C'è una chiara distinzione tra contenuto primario, secondario e terziario?
- Il layout guida l'occhio nella giusta sequenza?
- **Per Fantacontratti**: Budget residuo, scadenze contratti, e stato mercato devono essere SEMPRE visibili

### D2. 🧭 Navigazione e Wayfinding
- L'utente sa **sempre dove si trova** nella piattaforma?
- Può raggiungere qualsiasi sezione in **max 3 click**?
- Breadcrumb, tab attive, sidebar highlights sono presenti e coerenti?
- **Per Fantacontratti**: Navigazione tra Lega → Rosa → Mercato deve essere fluida e senza perdere contesto

### D3. 📱 Responsive Design e Mobile Experience
- Il layout si adatta a **mobile (360px), tablet (768px), desktop (1280px+)**?
- Su mobile le azioni principali sono raggiungibili con il **pollice** (thumb zone)?
- Le tabelle diventano card o liste scrollabili su mobile?
- **Per Fantacontratti**: L'asta live DEVE funzionare perfettamente su mobile

### D4. ⚡ Performance Percepita e Feedback
- Ogni azione ha un **feedback immediato** (loading spinner, skeleton, toast)?
- C'è un sistema di **skeleton loading** per evitare layout shift?
- Le azioni distruttive hanno **conferma** (modal, undo)?
- **Per Fantacontratti**: Offerte nell'asta devono avere feedback < 200ms

### D5. 🎨 Consistenza Visiva e Design System
- Colori, tipografia, spaziatura, border-radius sono **coerenti** ovunque?
- I componenti seguono un **design system** (o almeno convenzioni uniformi)?
- Gli stati (hover, active, disabled, focus) sono coerenti tra componenti?
- **Per Fantacontratti**: I colori dei ruoli (P/D/C/A) devono essere consistenti in tutta l'app

### D6. 📝 Form e Input UX
- I form hanno **validazione inline** (non solo al submit)?
- I campi hanno placeholder, helper text, e error message chiari?
- C'è **auto-save** o almeno warning per dati non salvati?
- **Per Fantacontratti**: Import giocatori, creazione contratti, offerte asta — i form critici

### D7. 📊 Data Visualization e Densità Informativa
- Le tabelle hanno **sorting, filtering, search**?
- I dati numerici usano **formattazione appropriata** (valuta, percentuali, abbreviazioni)?
- C'è il giusto bilanciamento tra **densità** e **leggibilità**?
- **Per Fantacontratti**: Tabella rosa con contratti deve mostrare molti dati senza sopraffare

### D8. 🔔 Stati, Notifiche e Comunicazione Sistema-Utente
- Ogni pagina ha **empty state** significativo (non solo "nessun dato")?
- Gli errori sono **comprensibili** e suggeriscono azioni?
- Le notifiche usano il **giusto livello** (toast vs banner vs modal)?
- **Per Fantacontratti**: "Nessun giocatore in rosa" deve guidare all'asta, non essere un dead-end

### D9. ♿ Accessibilità Base
- Contrasto testo/sfondo rispetta **WCAG AA** (4.5:1 per testo normale)?
- Tutti gli elementi interattivi sono **raggiungibili da tastiera**?
- Le immagini/icone hanno **aria-label** o testo alternativo?
- I focus states sono **visibili**?

### D10. 🎮 Gamification e Engagement
- Ci sono elementi che rendono l'esperienza **coinvolgente**? (badge, progressi, animazioni)
- Le azioni positive hanno **micro-animazioni** di celebrazione?
- C'è un senso di **progressione** visibile (completamento rosa, storico decisioni)?
- **Per Fantacontratti**: Il draft/asta dovrebbe essere un'esperienza emozionante, non solo un form

---

## 🔍 FASE 3 — ANALISI USER FLOW CRITICI

Simula mentalmente questi flussi e identifica **friction points**:

### Flow 1: Primo Accesso alla Lega
```
Login → Scelta/Creazione Lega → Invito amici → Setup iniziale
```
- L'onboarding è guidato o l'utente è "buttato" nella dashboard vuota?
- C'è un tutorial o wizard per i nuovi utenti?

### Flow 2: Preparazione Asta
```
Dashboard → Visualizza giocatori disponibili → Imposta obiettivi/watchlist → Studia budget
```
- L'utente può preparare una strategia d'asta facilmente?
- Può confrontare giocatori side-by-side?
- Vede chiaramente budget e vincoli roster?

### Flow 3: Asta Live
```
Entra in asta → Giocatore proposto → Rilancio → Aggiudicazione → Assegnazione contratto
```
- Il flusso è real-time e senza frizioni?
- L'utente vede il timer, il prezzo corrente, chi sta rilanciando?
- Il passaggio giocatore → contratto è fluido?

### Flow 4: Gestione Contratti in-season
```
Dashboard → Rosa → Dettaglio giocatore → Rinnovo/Taglio → Conferma
```
- Le informazioni per decidere (stats, costo, durata) sono accessibili?
- Le conseguenze economiche di un taglio/rinnovo sono chiare PRIMA della conferma?

### Flow 5: Mercato Secondario / Scambi
```
Proposta scambio → Negoziazione → Accettazione → Aggiornamento rose
```
- L'interfaccia di proposta scambio è intuitiva?
- Entrambe le parti vedono chiaramente cosa danno e ricevono?
- C'è storico delle trattative?

---

## 🔍 FASE 4 — ANALISI COMPARATIVA

Confronta l'attuale UI con i pattern delle piattaforme di riferimento:

### Checklist Pattern da Verificare

```
[ ] DASHBOARD
    [ ] Widget con KPI principali (budget, giocatori, prossima scadenza)
    [ ] Quick actions visibili (proponi scambio, vedi mercato, gestisci rosa)
    [ ] Timeline/Feed attività lega
    [ ] Stato mercato (aperto/chiuso) ben evidente

[ ] ROSA/SQUADRA
    [ ] Vista per ruolo con indicatori visivi (colori P/D/C/A)
    [ ] Info contratto inline (durata residua, costo, anno scadenza)
    [ ] Budget bar / Salary cap progress
    [ ] Filtri e ordinamento rapidi
    [ ] Vista alternativa card/tabella

[ ] MERCATO/ASTA
    [ ] Timer countdown visibile e urgente
    [ ] Prezzo corrente grande e leggibile
    [ ] Pulsanti rilancio accessibili (bottom sheet su mobile)
    [ ] Storico offerte scrollabile
    [ ] Indicatore "mia offerta attiva" chiaro
    [ ] Suono/vibrazione per eventi importanti (opzionale)

[ ] PROFILO GIOCATORE
    [ ] Hero section con foto, nome, ruolo, squadra reale
    [ ] Stats principali in evidenza (FMV, presenze, goal/assist)
    [ ] Storico contratti nella piattaforma
    [ ] Grafico andamento valore/prestazioni
    [ ] Quick action: offri / proponi scambio / aggiungi a watchlist

[ ] SCAMBI
    [ ] Interfaccia drag & drop o selezione chiara "do/ricevo"
    [ ] Comparazione valori side-by-side
    [ ] Impatto su budget/roster visibile in tempo reale
    [ ] Stato trattativa con timeline (proposta → controproposta → accettata/rifiutata)

[ ] IMPOSTAZIONI LEGA
    [ ] Regole consultabili in qualsiasi momento
    [ ] Calendario mercati con deadline evidenti
    [ ] Gestione partecipanti (invito, rimozione, ruoli)
```

---

## 📊 FASE 5 — REPORT FINALE

### 5.1 Formato Score Card

Per ogni pagina/schermata, produci:

```
═══════════════════════════════════════════════════
📄 PAGINA: [Nome Pagina]
URL/Route: [/path]
File: [src/pages/...]
═══════════════════════════════════════════════════

SCORES (1-5, dove 5 = eccellente):
  D1 Gerarchia Visiva .......... ⬛⬛⬛⬜⬜ 3/5
  D2 Navigazione ............... ⬛⬛⬛⬛⬜ 4/5
  D3 Responsive ................ ⬛⬛⬜⬜⬜ 2/5
  D4 Performance Percepita ..... ⬛⬛⬛⬜⬜ 3/5
  D5 Consistenza Design ........ ⬛⬛⬛⬛⬜ 4/5
  D6 Form/Input UX ............ ⬛⬛⬜⬜⬜ 2/5
  D7 Data Visualization ........ ⬛⬛⬛⬜⬜ 3/5
  D8 Stati e Notifiche ......... ⬛⬛⬜⬜⬜ 2/5
  D9 Accessibilità ............. ⬛⬛⬜⬜⬜ 2/5
  D10 Gamification ............. ⬛⬜⬜⬜⬜ 1/5
  ─────────────────────────────────────
  MEDIA PAGINA:                   2.6/5

🟢 PUNTI DI FORZA:
  - [cosa funziona bene]

🔴 PROBLEMI CRITICI (bloccanti UX):
  - [P1] [Descrizione] → [Impatto sull'utente]
  
🟡 MIGLIORAMENTI IMPORTANTI:
  - [P2] [Descrizione] → [Impatto sull'utente]

🔵 NICE TO HAVE:
  - [P3] [Descrizione] → [Impatto sull'utente]
```

### 5.2 Wireframe Correttivi ASCII

Per ogni problema P1 e P2, includi un wireframe ASCII del layout suggerito:

```
┌──────────────────────────────────────────────┐
│ 🏠 Dashboard - Layout Suggerito              │
├──────────┬───────────────────────────────────┤
│          │  💰 Budget: €245/500              │
│ SIDEBAR  │  ┌─────┐ ┌─────┐ ┌─────┐        │
│          │  │ P: 2│ │ D: 4│ │ C: 5│ ...     │
│ • Lega   │  └─────┘ └─────┘ └─────┘        │
│ • Rosa   │                                   │
│ • Mercato│  📋 AZIONI RAPIDE                 │
│ • Stats  │  [Proponi Scambio] [Vedi Mercato] │
│          │                                   │
│          │  📰 ATTIVITÀ LEGA                 │
│          │  • Marco ha tagliato Vlahovic     │
│          │  • Scambio proposto: Luca ↔ Anna  │
│          │  • Mercato invernale apre tra 3gg  │
└──────────┴───────────────────────────────────┘
```

### 5.3 Backlog Implementativo

Per ogni finding, genera una **task auto-contenuta** che un secondo agente Claude Code possa implementare:

```markdown
## TASK: [ID] — [Titolo]

**Priorità**: P1/P2/P3
**Dimensione**: XS(1h) / S(2-4h) / M(4-8h) / L(1-2gg) / XL(3+gg)
**Pagina**: [quale pagina]
**File coinvolti**: [lista file da modificare]

### Problema
[Descrizione del problema UX identificato]

### Soluzione
[Cosa implementare, con specifiche]

### Wireframe
[ASCII wireframe del risultato atteso]

### Componenti da usare/creare
- [Componente 1]: [descrizione]
- [Componente 2]: [descrizione]

### Criteri di Accettazione
- [ ] [Criterio 1]
- [ ] [Criterio 2]
- [ ] [Criterio 3]

### Note Tecniche
- [Dipendenze, librerie, pattern da seguire]
```

### 5.4 Riepilogo Esecutivo

Alla fine del report, produci:

```
════════════════════════════════════════════════════
📊 RIEPILOGO ESECUTIVO — UI/UX REVIEW FANTACONTRATTI
════════════════════════════════════════════════════

SCORE GLOBALE: [X.X / 5.0]

TOP 3 PROBLEMI CRITICI:
1. [Problema] — Impatto: [Alto/Medio/Basso]
2. [Problema] — Impatto: [Alto/Medio/Basso]  
3. [Problema] — Impatto: [Alto/Medio/Basso]

TOP 3 QUICK WINS (alto impatto, basso effort):
1. [Miglioramento] — Effort: [XS/S]
2. [Miglioramento] — Effort: [XS/S]
3. [Miglioramento] — Effort: [XS/S]

ROADMAP SUGGERITA:
Sprint 1 (quick wins): [lista task]
Sprint 2 (fondamenta): [lista task]  
Sprint 3 (polish): [lista task]
Sprint 4 (delight): [lista task]

BACKLOG TOTALE:
- P1 (critici): [N] task
- P2 (importanti): [N] task
- P3 (nice to have): [N] task
════════════════════════════════════════════════════
```

---

## ⚠️ VINCOLI DELL'AGENTE

1. **NON modificare alcun file** del progetto — solo analisi e report
2. **NON installare dipendenze** — lavora solo con ciò che è già installato
3. **NON eseguire l'applicazione** — analizza il codice sorgente staticamente
4. Se non trovi una pagina o componente atteso, segnalalo come **ASSENTE** nel report
5. Ogni suggerimento deve essere **specifico** per Fantacontratti, non generico
6. I wireframe devono rispettare lo stack attuale: **React + TypeScript + TailwindCSS**
7. Salva il report finale come `UI_UX_REVIEW_REPORT.md` nella root del progetto

---

## 🚀 COME LANCIARE

```bash
# Dalla root del progetto fantacontratti-multiagent
claude --prompt "Leggi il file UI_UX_REVIEW_AGENT.md e segui le istruzioni. Inizia dalla FASE 1 (Discovery). Procedi fase per fase fino alla FASE 5 (Report Finale). Non modificare alcun file del progetto."
```

Oppure in modalità interattiva:
```bash
claude
> Leggi UI_UX_REVIEW_AGENT.md e inizia l'audit UX dalla FASE 1.
```
