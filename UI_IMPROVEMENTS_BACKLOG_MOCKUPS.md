# UI Improvements Backlog -- Mockup & Motivazioni

> Companion di: `UI_IMPROVEMENTS_BACKLOG.md`
> Ogni task ha: motivazione dettagliata, wireframe BEFORE/AFTER, e impatto utente.

---

## Indice per Priorita

### Critiche
- [TASK-001: DataTable Responsivo](#task-001)
- [TASK-002: AdminPanel Mobile](#task-002)
- [TASK-003: Consolidamento Layout Asta](#task-003)
- [TASK-004: Movements Mobile](#task-004)
- [TASK-005: Keyboard DnD Rubata](#task-005)

### Alte
- [TASK-006: Splitting Rubata.tsx](#task-006)
- [TASK-007: Libreria Icone](#task-007)
- [TASK-008: Timer Accessibility](#task-008)
- [TASK-009: Recharts Adoption](#task-009)
- [TASK-010: Banner Fasi Affordance](#task-010)

### Medie
- [TASK-011: Skeleton Loader](#task-011)
- [TASK-012: EmptyState Component](#task-012)
- [TASK-013: Legenda Colori Durata](#task-013)
- [TASK-014: Stepper Rubata](#task-014)
- [TASK-015: Tooltip Status Contratto](#task-015)
- [TASK-016: Virtualizzazione Liste](#task-016)
- [TASK-017: BottomSheet Contratti](#task-017)

### Basse
- [TASK-018 - TASK-023](#tasks-basse)

### Future
- [TASK-030 - TASK-034](#tasks-future)

---

<a id="task-001"></a>
## TASK-001: Creare DataTable Responsivo Riutilizzabile

### Motivazione

Questo e' il task piu impattante dell'intero backlog. **8 pagine su 23** hanno tabelle con 10-13+ colonne che sono inutilizzabili su mobile e problematiche su tablet. Risolvere questo pattern una volta per tutte con un componente riutilizzabile elimina il problema alla radice per il 35% delle pagine.

### Impatto Utente

```
SCENARIO: Manager apre la Rosa dal telefono durante una pausa pranzo

BEFORE:
  Manager: "Voglio vedere il rating di Lautaro"
  App: Mostra tabella con 3 colonne visibili
  Manager: "Non vedo il rating... dove sta?"
  Manager: Non c'e' modo di trovarlo
  Manager: Chiude l'app frustrato

AFTER:
  Manager: "Voglio vedere il rating di Lautaro"
  App: Mostra card con info principali + "Dettagli"
  Manager: Tap su "Dettagli" della card Lautaro
  Manager: Vede rating, stats, contratto, tutto
  Manager: "Perfetto!" - decide se rinnovare il contratto
```

### Wireframe: Componente DataTable

```
=== API DEL COMPONENTE ===

<DataTable
  data={players}
  columns={allColumns}
  mobileColumns={['name', 'position', 'salary']}
  tabletColumns={['name', 'position', 'team', 'salary', 'duration', 'rating']}
  renderMobileCard={(player) => <PlayerCard player={player} />}
  sortable
  defaultSort={{ key: 'salary', dir: 'desc' }}
  expandable
  renderExpandedRow={(player) => <PlayerDetails player={player} />}
  pageSize={50}
/>

=== RENDERING PER BREAKPOINT ===

MOBILE (<768px) - Card Mode:
+-----------------------------------+
| [Sort: Salario v]  Risultati: 18 |
+-----------------------------------+
|                                   |
| +-------------------------------+ |
| | [A] Lautaro Martinez          | |
| |     Inter  28a        8.5M   | |
| |                               | |
| | [v Espandi dettagli]          | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | [C] Nicolo Barella            | |
| |     Inter  27a        7.2M   | |
| |                               | |
| | [v Espandi dettagli]          | |
| +-------------------------------+ |
|                                   |
| === Espanso: ===                 |
| +-------------------------------+ |
| | [A] Lautaro Martinez          | |
| |     Inter  28a        8.5M   | |
| |                               | |
| | Statistiche:                  | |
| | 25 Pres | 18 Gol | 5 Assist  | |
| | Rating: 7.2/10                | |
| |                               | |
| | Contratto:                    | |
| | Durata: 3 anni (2028)        | |
| | Clausola: 15M                 | |
| | Valore Rubata: 5M             | |
| |                               | |
| | [Stats Dettagliate]           | |
| +-------------------------------+ |
+-----------------------------------+

TABLET (768-1023px) - Scroll Table:
+-------------------------------------------------------+
| Nome        | Pos | Team  | Sal  | Dur | Vt  |  >>>  |
|-------------|-----|-------|------|-----|-----|-------|
| Lautaro     | A   | Inter | 8.5M | 3a  | 7.2 | shade |
| Barella     | C   | Inter | 7.2M | 2a  | 7.0 | shade |
| Bastoni     | D   | Inter | 6.0M | 3a  | 6.8 | shade |
+-------------------------------------------------------+
                                               ^^^
                              Gradient shadow = ci sono
                              altre colonne, scorri ->

  Scrollato a destra:
+-------------------------------------------------------+
| shade | Sal  | Dur | Vt  | Pr | Gol | Ass | Clausola |
|-------|------|-----|-----|----|----|------|----------|
| shade | 8.5M | 3a  | 7.2 | 25 | 18 | 5   | 15M      |
| shade | 7.2M | 2a  | 7.0 | 28 | 8  | 12  | 12M      |
+-------------------------------------------------------+
  ^^^
  Shadow a sinistra = puoi tornare indietro

DESKTOP (1024px+) - Full Table:
+--------------------------------------------------------------------+
| Nome        | Pos | Team  | Pr | G  | A  | Vt  | Sal  | Dur | Cl  |
|-------------|-----|-------|----|----|----|----- |------|-----|-----|
| Lautaro     | A   | Inter | 25 | 18 | 5  | 7.2 | 8.5M | 3a  | 15M |
| Barella     | C   | Inter | 28 | 8  | 12 | 7.0 | 7.2M | 2a  | 12M |
| Bastoni     | D   | Inter | 27 | 2  | 3  | 6.8 | 6.0M | 3a  | 10M |
+--------------------------------------------------------------------+
```

### Perche un componente e non fix pagina-per-pagina

```
Approccio A: Fix singole pagine (8 pagine x 3-8h = 24-64h)
  Rose.tsx        -> aggiungere card mobile     (8h)
  Movements.tsx   -> aggiungere card mobile     (6h)
  Financials.tsx  -> aggiungere card mobile     (8h)
  PlayerStats.tsx -> aggiungere card mobile     (8h)
  AdminPanel.tsx  -> aggiungere card mobile     (6h)
  Contracts.tsx   -> aggiungere card mobile     (6h)
  Manager.tsx     -> aggiungere card mobile     (4h)
  Prize.tsx       -> aggiungere card mobile     (4h)
  Totale: ~50h + inconsistenze tra implementazioni

Approccio B: Componente DataTable riutilizzabile (16h + 8h adozione)
  DataTable.tsx   -> creare componente          (16h)
  8 pagine        -> adottare <DataTable>       (1h ciascuna = 8h)
  Totale: ~24h + consistenza garantita + manutenzione centralizzata
```

---

<a id="task-002"></a>
## TASK-002: AdminPanel Mobile -- 8 Tab -> Menu BottomSheet

### Motivazione

L'admin gestisce la lega anche dal telefono (es. durante una partita, in treno). Con 8 tab in riga su 375px, ogni tab ha ~47px -- sotto il minimo touch target di 44px e con testo troncato illeggibile.

### Impatto Utente

```
SCENARIO: Admin deve approvare 3 richieste di adesione dal telefono

BEFORE:
  Admin: Apre Admin Panel su mobile
  Admin: Vede "Merc|Pan|Me|Pr|Ri|In|Se|Ex" -- troncato
  Admin: "Quale tab era Membri? Me? Mo?"
  Admin: Tap su "Me" -- troppo piccolo, tap su "Pr" per sbaglio
  Admin: Apre "Premi" invece di "Membri"
  Admin: Torna indietro, retry
  Admin: 3 tentativi per arrivare alla tab giusta

AFTER:
  Admin: Apre Admin Panel su mobile
  Admin: Vede [Menu v] in alto a destra
  Admin: Tap -> BottomSheet con voci chiare
  Admin: Vede "Membri (3)" con badge e descrizione
  Admin: Tap -> Apre direttamente la sezione Membri
  Admin: 1 tap, zero errori
```

### Wireframe BEFORE/AFTER

```
BEFORE: Mobile (375px)
+-----------------------------------+
| [<] Admin Panel                  |
+-----------------------------------+
| Me|Pa|Me|Pr|Ri|In|Se|Ex          |
+-----------------------------------+  <- 8 tab in 375px
|                                   |     = 47px per tab
| [Contenuto]                      |     Touch target: INSUFFICIENTE
|                                   |     Testo: TRONCATO
+-----------------------------------+

AFTER: Mobile (375px)
+-----------------------------------+
| [<] Admin Panel       [Menu v]   |
+-----------------------------------+
| Tab corrente: Mercato            |
+-----------------------------------+
|                                   |
| [Contenuto Mercato full-width]   |
| Sessione attiva: #3             |
| Fase: Mercato Ricorrente        |
| [Avvia prossima fase]           |
|                                   |
+-----------------------------------+

  [Menu v] -> BottomSheet:
  +-----------------------------------+
  | --- drag handle ---              |
  |                                   |
  |  Menu Admin                  [X] |
  +-----------------------------------+
  |                                   |
  | +-------------------------------+ |
  | | [Settings]  Mercato      (!)  | |
  | | Gestione sessioni e fasi      | |
  | +-------------------------------+ |
  |                                   |
  | +-------------------------------+ |
  | | [BarChart]  Panoramica        | |
  | | Stats e config lega           | |
  | +-------------------------------+ |
  |                                   |
  | +-------------------------------+ |
  | | [Users]     Membri       (3)  | |  <- Badge: 3 richieste
  | | Richieste e gestione roster   | |
  | +-------------------------------+ |
  |                                   |
  | +-------------------------------+ |
  | | [Trophy]    Premi             | |
  | | Distribuzione premi           | |
  | +-------------------------------+ |
  |                                   |
  | +-------------------------------+ |
  | | [Shield]    Ricorsi      (2)  | |  <- Badge: 2 ricorsi
  | | Gestione ricorsi              | |
  | +-------------------------------+ |
  |                                   |
  | +-------------------------------+ |
  | | [Mail]      Inviti            | |
  | | Invita partecipanti           | |
  | +-------------------------------+ |
  |                                   |
  | +-------------------------------+ |
  | | [Clock]     Sessioni          | |
  | | Storico sessioni passate      | |
  | +-------------------------------+ |
  |                                   |
  | +-------------------------------+ |
  | | [Download]  Export            | |
  | | Scarica dati in Excel         | |
  | +-------------------------------+ |
  |                                   |
  +-----------------------------------+
```

### Confronto Touch Target

```
BEFORE:
  Tab width: ~47px (sotto minimo 44px con margini)
  Tab height: ~32px
  Area touch: ~47 x 32 = 1504 px^2
  Minimo raccomandato: 44 x 44 = 1936 px^2
  INSUFFICIENTE

AFTER (BottomSheet):
  Voce width: 343px (full-width meno padding)
  Voce height: 60px
  Area touch: 343 x 60 = 20580 px^2
  13.7x piu grande del before!
  ECCELLENTE
```

---

<a id="task-003"></a>
## TASK-003: Consolidamento Layout Asta (6 -> 3)

### Motivazione

6 layout separati significano 6 implementazioni della stessa logica. Un bug fix va applicato 6 volte. Un nuovo campo va aggiunto 6 volte. E l'utente puo trovare comportamenti diversi tra layout, generando confusione.

### Impatto Utente

```
SCENARIO: Admin aggiunge un campo "offerta minima" all'asta

BEFORE (6 layout):
  Sviluppatore: Aggiunge campo a LayoutA.tsx
  Sviluppatore: Copia in LayoutB.tsx... LayoutC... D... E... F
  Sviluppatore: In LayoutD dimentica un prop
  Utente con LayoutD: "L'offerta minima non funziona!"
  Bug report -> Fix -> Deploy -> 4h perse

AFTER (3 layout con componenti shared):
  Sviluppatore: Aggiunge campo a AuctionBidPanel.tsx (shared)
  Automaticamente disponibile in tutti e 3 i layout
  Bug report: zero. Tempo: 1h.
```

### Architettura Componenti

```
BEFORE: 6 file indipendenti
+-------------+  +-------------+  +-------------+
| LayoutA.tsx |  | LayoutB.tsx |  | LayoutC.tsx |
| - Timer     |  | - Timer     |  | - Timer     |
| - Player    |  | - Player    |  | - Player    |
| - Bid       |  | - Bid       |  | - Bid       |
| - Budget    |  | - Budget    |  | - Budget    |
| - Managers  |  | - Managers  |  | - Managers  |
| - Admin     |  | - Admin     |  | - Admin     |
| ~800 righe  |  | ~600 righe  |  | ~700 righe  |
+-------------+  +-------------+  +-------------+
+-------------+  +-------------+  +-------------+
| LayoutD.tsx |  | LayoutE.tsx |  | LayoutF.tsx |
| - Timer     |  | - Timer     |  | - Timer     |
| - Player    |  | - Player    |  | - Player    |
| - Bid       |  | - Bid       |  | - Bid       |
| - Budget    |  | - Budget    |  | - Budget    |
| - Managers  |  | - Managers  |  | - Managers  |
| - Admin     |  | - Admin     |  | - Admin     |
| ~750 righe  |  | ~500 righe  |  | ~850 righe  |
+-------------+  +-------------+  +-------------+
TOTALE: ~4200 righe, molta duplicazione

AFTER: 3 layout + 4 componenti shared
+--------------------------------------------------+
| Componenti Shared (src/components/auction/shared/) |
+--------------------------------------------------+
| AuctionPlayerCard.tsx  (~150 righe)               |
|   Foto, nome, posizione, team, quotazione, stats  |
|                                                    |
| AuctionBidPanel.tsx    (~200 righe)               |
|   Input bid, +/-, OFFRI, offerta corrente          |
|                                                    |
| AuctionBudgetBar.tsx   (~100 righe)               |
|   Budget, speso, slot, barra progresso             |
|                                                    |
| AuctionManagerList.tsx (~150 righe)               |
|   Lista manager, chi ha offerto, status conn.      |
+--------------------------------------------------+

+-- LayoutMobile.tsx (~200 righe) --+
| Usa: PlayerCard + BidPanel        |
| Timer fisso in alto               |
| BidPanel sticky in basso          |
| Resto in BottomSheet              |
+-----------------------------------+

+-- LayoutDesktop.tsx (~250 righe) -+
| Usa: tutti i 4 shared components  |
| Split 60/40                       |
+-----------------------------------+

+-- LayoutPro.tsx (~300 righe) -----+
| Usa: tutti i 4 shared components  |
| Multi-panel tipo IDE               |
+-----------------------------------+

TOTALE: ~1350 righe (-68%), zero duplicazione
```

---

<a id="task-004"></a>
## TASK-004: Movements Leggibile su Mobile

### Motivazione

La cronologia movimenti e' una delle pagine piu consultate per capire cosa e' successo in lega. Su mobile con 12+ colonne e' completamente inutilizzabile.

### Wireframe BEFORE/AFTER

```
BEFORE: Mobile (375px)
+-----------------------------------+
| Tip|St|Giocatore |Da |Pre|Data   |
|----|--|----------|---|---|--------|
| PM | 1| Lautaro  |Svi| 42|15/1/26|
| SC | 1| Barella  |Mar| 30|16/1/26|
+-----------------------------------+
  MANCANO: team, posizione, a chi, salario,
  durata, clausola, semestre
  Testo troncato, touch impossibile

AFTER: Mobile (375px)
+-----------------------------------+
| [Filtro: Tutti v]  [Cerca...]    |
+-----------------------------------+
|                                   |
| +-------------------------------+ |
| | [PM] Primo Mercato  15/1/26  | |  <- Badge tipo + data
| |                               | |
| | [Photo][A] Lautaro Martinez   | |  <- Giocatore prominente
| |            Inter              | |
| |                               | |
| | Svincolato  -->  FC Mario    | |  <- Da / A con freccia
| |                               | |
| | +--------+ +--------+        | |
| | | 42M    | | 8.5Mx3a|        | |  <- Prezzo + Contratto
| | | Prezzo | | Contrat.|        | |
| | +--------+ +--------+        | |
| |                               | |
| | [v] Profezia (1)              | |  <- Expand profezia
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | [SC] Scambio        16/1/26  | |
| |                               | |
| | [C] Nicolo Barella            | |
| |     Inter                     | |
| |                               | |
| | FC Mario  <-->  AC Luigi     | |  <- Scambio bidirez.
| |                               | |
| | +--------+                   | |
| | | 30M    |                   | |
| | | Prezzo |                   | |
| | +--------+                   | |
| +-------------------------------+ |
|                                   |
+-----------------------------------+

  PROFEZIA ESPANSA:
  +-------------------------------+
  | [PM] Primo Mercato  15/1/26  |
  |                               |
  | [A] Lautaro Martinez          |
  |     Inter                     |
  |                               |
  | Svincolato  -->  FC Mario    |
  |                               |
  | 42M  |  8.5M x 3 anni       |
  |                               |
  | [^] Profezia:                 |
  | +---------------------------+ |
  | | "Lautaro sara il          | |
  | | capocannoniere della lega.| |
  | | Segna almeno 20 gol."     | |
  | | -- Mario (Acquirente)     | |
  | +---------------------------+ |
  |                               |
  | [Aggiungi la tua profezia]   |
  +-------------------------------+
```

### Filtro Tipo Movimento Mobile

```
BEFORE: Nessun filtro prominente su mobile

AFTER: Chip filtro scrollabile
+-----------------------------------+
| [Tutti] [PM] [SC] [RB] [SV] [CT] |  <- scroll orizzontale
+-----------------------------------+
  Tutti      = grigio (default)
  PM (Primo) = blu
  SC (Scambio) = verde
  RB (Rubata) = rosso
  SV (Svinc.) = oro
  CT (Rinnovo) = viola
```

---

<a id="task-005"></a>
## TASK-005: Alternativa Keyboard al DnD in Rubata

### Motivazione

L'ordinamento preferenze con drag-and-drop esclude utenti con disabilita motorie. Accessibilita non e' opzionale -- e' un requisito. Aggiungere bottoni su/giu e' un fix semplice (1-3h) con impatto enorme per l'inclusivita.

### Wireframe BEFORE/AFTER

```
BEFORE: Solo drag-and-drop
+-----------------------------------+
| Ordine Preferenze:               |
+-----------------------------------+
| [drag] Lautaro Martinez          |  <- Solo grip DnD
| [drag] Dusan Vlahovic            |
| [drag] Victor Osimhen            |
| [drag] Rafael Leao               |
+-----------------------------------+
  Mouse: OK (drag & drop)
  Touch: Difficile (DnD su mobile)
  Tastiera: IMPOSSIBILE
  Screen reader: IMPOSSIBILE

AFTER: DnD + bottoni su/giu
+-----------------------------------+
| Ordine Preferenze:               |
+-----------------------------------+
| [drag] 1. Lautaro Martinez [v]  |  <- Solo giu (e' il primo)
| [drag] 2. Dusan Vlahovic   [^][v]|  <- Su e giu
| [drag] 3. Victor Osimhen   [^][v]|  <- Su e giu
| [drag] 4. Rafael Leao      [^]  |  <- Solo su (e' l'ultimo)
+-----------------------------------+
  Mouse: OK (drag & drop) + click su frecce
  Touch: OK (tap sulle frecce e' piu preciso del DnD)
  Tastiera: Tab tra frecce, Enter per attivare
  Screen reader: "Sposta Lautaro Martinez in giu"

  Bottoni:
  [^] aria-label="Sposta {nome} in su"
  [v] aria-label="Sposta {nome} in giu"
  Dimensione: 36x36px (dentro area card 44px+)
  Focus: ring-2 ring-primary-400
```

---

<a id="task-006"></a>
## TASK-006: Splitting Rubata.tsx (2000+ righe)

### Motivazione

Un file da 2000+ righe e' un rischio tecnico: ogni modifica puo causare regressioni, i merge conflict sono frequenti, e nessuno sviluppatore puo tenerlo tutto in testa. La decomposizione in moduli rende il codice testabile, mantenibile, e ottimizzabile.

### Architettura Proposta

```
BEFORE:
  Rubata.tsx (2000+ righe)
  +------------------------------------------------+
  |  25+ useState                                   |
  |  10+ useEffect                                  |
  |  15+ useCallback                                |
  |                                                  |
  |  Pusher setup & handlers        (~200 righe)    |
  |  State machine transitions      (~300 righe)    |
  |  Board rendering                (~400 righe)    |
  |  Bid panel                      (~200 righe)    |
  |  Timer                          (~100 righe)    |
  |  Admin controls                 (~200 righe)    |
  |  Modal: Transaction ACK         (~100 righe)    |
  |  Modal: Ready Check             (~80 righe)     |
  |  Modal: Appeal                  (~100 righe)    |
  |  Modal: Appeal Decision         (~80 righe)     |
  |  Modal: Resume Check            (~60 righe)     |
  |  Modal: Preference              (~80 righe)     |
  |  JSX return                     (~400 righe)    |
  +------------------------------------------------+

AFTER:
  src/
  +-- pages/
  |   +-- Rubata.tsx (~200 righe)
  |       Orchestratore: importa hook + componenti
  |       Passa props e callbacks
  |
  +-- hooks/
  |   +-- useRubataState.ts (~400 righe)
  |       State machine completa
  |       Pusher event handlers
  |       API calls
  |       Polling/heartbeat
  |       Return: { phase, board, bids, actions }
  |
  +-- components/rubata/
      +-- RubataBoard.tsx (~300 righe)
      |   Board giocatori con preferenze
      |   DnD per ordinamento
      |   Progress indicator
      |
      +-- RubataBidPanel.tsx (~200 righe)
      |   Input importo
      |   Bottoni +/-
      |   Bottone OFFRI
      |   Offerta corrente
      |
      +-- RubataTimerPanel.tsx (~100 righe)
      |   Display timer
      |   Stati safe/warning/danger
      |   Label accessibilita
      |
      +-- RubataAdminControls.tsx (~200 righe)
      |   Pannello admin
      |   Ordine setter
      |   Timer config
      |   Force/simulate buttons
      |
      +-- RubataModals.tsx (~400 righe)
      |   Tutti i modal:
      |   - TransactionACKModal
      |   - ReadyCheckModal
      |   - AppealModal
      |   - AppealDecisionModal
      |   - ResumeCheckModal
      |   - PreferenceModal
      |
      +-- RubataPreferences.tsx (~200 righe)
          Gestione preferenze
          DnD + bottoni su/giu
          Max bid, priority, notes
```

### Benefici Concreti

```
+-------------------+------------+--------------+
| Aspetto           | Before     | After        |
+-------------------+------------+--------------+
| File piu grande   | 2000 righe | 400 righe    |
| Unit test         | Impossibile| Per modulo   |
| Re-rendering      | Tutto      | Per componente|
| Merge conflicts   | Frequenti  | Rari         |
| Lazy loading      | No         | Modal lazy   |
| Onboarding dev    | Settimane  | Giorni       |
| Code review       | Impossibile| Focalizzato  |
+-------------------+------------+--------------+
```

---

<a id="task-007"></a>
## TASK-007: Libreria Icone (lucide-react)

### Impatto Dimensionale

```
BEFORE: Navigation.tsx icone section
  Righe 23-130: 107 righe di SVG path definitions
  15+ icone definite manualmente
  Ogni pagina ha altri SVG inline: +200 righe stimate

AFTER: Con lucide-react
  1 import statement: ~2 righe
  15 riferimenti: ~15 righe
  Totale: ~17 righe vs 107 = -84%

  Bundle impact:
  lucide-react tree-shakes: solo icone usate nel bundle
  ~15 icone x ~1KB = ~15KB vs SVG inline ~20KB
  Netto: simile o inferiore
```

---

<a id="task-008"></a>
## TASK-008: Timer Accessibility

### Wireframe BEFORE/AFTER

```
BEFORE: Solo colore
+--------------------+  +--------------------+  +--------------------+
|      00:25         |  |      00:08         |  |      00:03         |
| [verde pieno]      |  | [giallo pieno]     |  | [rosso pieno]      |
+--------------------+  +--------------------+  +--------------------+
   Daltonico vede:          Daltonico vede:         Daltonico vede:
   "un numero"              "un numero"              "un numero"
   (identici!)              (identici!)              (identici!)

AFTER: Colore + testo + pattern + dimensione
+--------------------+  +--------------------+  +--------------------+
|      00:25         |  |      00:08         |  |    !! 00:03 !!     |
| [====== pieno ====]|  | [==== tratteg ====]|  | [=== puntini ====] |
|   "Tempo OK"       |  |   "Affrettati!"    |  | "ULTIMO SECONDO!"  |
+--------------------+  +--------------------+  +--------------------+
   Safe:                    Warning:                Danger:
   - Label calma            - Label urgente         - Label allarmante
   - Barra piena            - Barra tratteggiata    - Barra puntinata
   - Dimensione normale     - Leggero pulse         - Testo grande + shake
   - Nessun suono          - Beep ogni 2s          - Beep ogni 0.5s
                                                    - Vibrazione (mobile)
```

---

<a id="task-009"></a>
## TASK-009: Adozione Recharts

### Confronto SVG Custom vs Recharts

```
BEFORE: DonutChart custom (~80 righe SVG)
+-----------------------------------+
| <svg viewBox="0 0 200 200">      |
|   <circle cx="100" cy="100"      |
|     r="80" fill="none"           |
|     stroke-dasharray="..."       |
|     stroke-dashoffset="..." />   |
|   // calcoli manuali per ogni    |
|   // segmento, no tooltip,       |
|   // no resize, no animation     |
| </svg>                           |
+-----------------------------------+
  - Nessun tooltip on hover
  - Non responsive (dimensione fissa)
  - Nessuna legenda interattiva
  - Calcoli geometrici manuali
  - Non accessibile (no aria, no alt)

AFTER: Recharts PieChart (~15 righe)
+-----------------------------------+
| <ResponsiveContainer>            |
|   <PieChart>                     |
|     <Pie data={data}             |
|       cx="50%" cy="50%"          |
|       innerRadius={60}           |
|       outerRadius={80}           |
|       dataKey="value">           |
|       {data.map(entry =>         |
|         <Cell fill={colors[i]}/>)|
|     </Pie>                       |
|     <Tooltip />                  |
|     <Legend onClick={toggle} />  |
|   </PieChart>                    |
| </ResponsiveContainer>           |
+-----------------------------------+
  + Tooltip automatico on hover
  + Responsive (si adatta al container)
  + Legenda interattiva (click per hide)
  + Animazioni smooth
  + Accessibile (role="img", aria)
```

---

<a id="task-010"></a>
## TASK-010: Banner Fasi con Affordance Chiara

### Wireframe BEFORE/AFTER

```
BEFORE: Banner senza affordance
+---------------------------------------------------+
| [Emoji] Mercato Ricorrente - Sessione #3 attiva  |
+---------------------------------------------------+
  Sembra un banner informativo statico
  L'utente NON capisce che e' cliccabile
  Nessun cursore pointer su hover
  Nessuna indicazione visiva di interattivita

AFTER: Banner con CTA chiara
+---------------------------------------------------+
| [Emoji] Fase Attiva: Mercato Ricorrente           |
|         Sessione #3 in corso              [Vai >] |
+---------------------------------------------------+
  Hover effect: border-primary, shadow-glow
  Cursore: pointer
  CTA esplicita: "Vai >"
  Mobile: Tap anywhere sulla card

  Su mobile, ancora piu esplicito:
  +-----------------------------------+
  | [Emoji] Mercato Ricorrente       |
  |         Sessione #3 in corso     |
  |                                   |
  | [===== Vai alla fase =====>]     |
  +-----------------------------------+
```

---

<a id="task-011"></a>
## TASK-011: Skeleton Loader al Posto degli Spinner

### Wireframe BEFORE/AFTER

```
BEFORE: Spinner generico (tutte le pagine)
+-----------------------------------+
|                                   |
|                                   |
|           [spinning]              |
|          Caricamento...           |
|                                   |
|                                   |
+-----------------------------------+
  L'utente non sa:
  - COSA sta arrivando
  - QUANTO spazio occupera
  - CHE FORMA avra il contenuto
  Layout shift quando arriva il contenuto

AFTER: Skeleton specifico per Dashboard
+-----------------------------------+
| +-------------------------------+ |
| | [skeleton]  [skeleton bar]    | |
| | [skeleton block]              | |
| | [skeleton] [skeleton]         | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | [skeleton]  [skeleton bar]    | |
| | [skeleton block]              | |
| | [skeleton] [skeleton]         | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | [skeleton]  [skeleton bar]    | |
| | [skeleton block]              | |
| | [skeleton] [skeleton]         | |
| +-------------------------------+ |
+-----------------------------------+
  L'utente capisce:
  + Stanno arrivando 3 CARD (leghe)
  + Ogni card ha titolo + contenuto
  + Il layout e' gia definitivo (no shift)
  + L'animazione pulse comunica "sto caricando"

AFTER: Skeleton per AllPlayers
+-----------------------------------+
| [skeleton input bar]             |
| [P] [D] [C] [A]  [skeleton dd]  |
+-----------------------------------+
| [circle] [bar] [bar short]       |  <- SkeletonPlayerRow
| [circle] [bar] [bar short]       |
| [circle] [bar] [bar short]       |
| [circle] [bar] [bar short]       |
| [circle] [bar] [bar short]       |
+-----------------------------------+

  Componenti gia disponibili in Skeleton.tsx:
  - SkeletonCard (per Dashboard)
  - SkeletonPlayerRow (per AllPlayers, Rose)
  - SkeletonTableRow (per Movements, Financials)
```

---

<a id="task-012"></a>
## TASK-012: Componente EmptyState Standardizzato

### API Proposta

```typescript
// Uso semplice:
<EmptyState
  icon={<InboxIcon />}
  title="Nessun movimento trovato"
  description="I movimenti appariranno qui quando verranno
               completate le sessioni di mercato."
  action={{
    label: "Vai alla Dashboard",
    onClick: () => navigate('/dashboard'),
    variant: 'primary'
  }}
/>

// Con azione secondaria:
<EmptyState
  icon="🏟️"
  title="Nessuna lega"
  description="Non sei ancora membro di nessuna lega."
  action={{
    label: "Crea la tua prima lega",
    onClick: () => navigate('/leagues/new')
  }}
  secondaryAction={{
    label: "Cerca leghe esistenti",
    onClick: () => setSearchOpen(true)
  }}
/>
```

### Wireframe Varianti

```
EMPTY STATE STANDARD:
+-----------------------------------+
|                                   |
|         +---------------+        |
|         |     [icon]     |        |
|         +---------------+        |
|                                   |
|       Nessun Movimento           |
|           Trovato                 |
|                                   |
|   I movimenti appariranno qui    |
|   quando verranno completate     |
|   le sessioni di mercato.        |
|                                   |
|   [===  Vai alla Dashboard  ===] |
|                                   |
+-----------------------------------+

EMPTY STATE CON DUE AZIONI:
+-----------------------------------+
|                                   |
|         +---------------+        |
|         |     [icon]     |        |
|         +---------------+        |
|                                   |
|        Nessuna Lega              |
|                                   |
|   Non sei ancora membro di       |
|   nessuna lega. Creane una o     |
|   cerca tra quelle esistenti.    |
|                                   |
|   [=== Crea la tua prima ===]   |
|                                   |
|   Oppure: Cerca leghe esistenti  |
|                                   |
+-----------------------------------+

EMPTY STATE FILTRATO:
+-----------------------------------+
|                                   |
|         +---------------+        |
|         |     [icon]     |        |
|         +---------------+        |
|                                   |
|     Nessun Risultato per         |
|       "Lautaro Martinez"         |
|                                   |
|   Prova a modificare i filtri    |
|   o cerca con termini diversi.   |
|                                   |
|   [=== Resetta Filtri ===]      |
|                                   |
+-----------------------------------+
```

---

<a id="task-013"></a>
## TASK-013: Legenda Colori Durata Contratto

### Wireframe

```
BEFORE: Colori senza legenda
+-----------------------------------+
| Giocatore     | Sal  | Durata    |
|---------------|------|-----------|
| Lautaro       | 8.5M | [3 anni] |  <- verde, ma perche?
| Barella       | 7.2M | [2 anni] |  <- giallo, ma perche?
| Sommer        | 4.5M | [1 anno] |  <- rosso, ma perche?
+-----------------------------------+
  Domanda utente: "Perche Sommer e' rosso?"

AFTER: Legenda compatta sopra la tabella
+-----------------------------------+
| Durata:                          |
| [1a] [2a] [3a] [4a+]            |
|  red  yel  grn  blue             |
+-----------------------------------+
| Giocatore     | Sal  | Durata    |
|---------------|------|-----------|
| Lautaro       | 8.5M | [3 anni] |  <- verde = 3 anni
| Barella       | 7.2M | [2 anni] |  <- giallo = 2 anni
| Sommer        | 4.5M | [1 anno] |  <- rosso = 1 anno = ATTENZIONE
+-----------------------------------+
  Ora l'utente capisce:
  rosso = 1 anno = contratto in scadenza
  giallo = 2 anni = da monitorare
  verde = 3 anni = stabile
  blu = 4+ anni = lungo termine
```

---

<a id="task-014"></a>
## TASK-014: Stepper Visivo per Flusso Rubata

### Wireframe

```
BEFORE: Nessuna indicazione di dove si e' nel flusso
+-----------------------------------+
| [Modal: Conferma Transazione]    |
|                                   |
| Lautaro > FC Mario per 42M      |
|                                   |
| [Conferma]  [Ricorso]           |
+-----------------------------------+
  Utente: "Quanti step mancano?"
  Utente: "Cosa succede dopo?"
  Utente: "Dove sono nel processo?"

AFTER: Stepper in alto + indicazione nel modal
+-----------------------------------+
| Step: [v][v][v][*][ ][ ][ ]     |
|       At Pr Pr Co Pr Nx Co      |
+-----------------------------------+
| [Modal: Step 4 di 7 - Conferma] |
|                                   |
| Lautaro > FC Mario per 42M      |
|                                   |
| [Conferma]  [Ricorso]           |
|                                   |
| Prossimo step: Profezia         |
+-----------------------------------+

  Stepper dettaglio:
  +---------------------------------------------------+
  | [v] Attesa                                        |
  |  |                                                |
  | [v] Preview Board                                 |
  |  |                                                |
  | [v] Ready Check                                   |
  |  |                                                |
  | [*] Conferma Transazione  <-- SEI QUI (pulsante) |
  |  |                                                |
  | [ ] Profezia                                      |
  |  |                                                |
  | [ ] Prossimo Giocatore                            |
  |  |                                                |
  | [ ] Completamento                                 |
  +---------------------------------------------------+

  Su mobile (compatto):
  +-----------------------------------+
  | < Conferma (4/7)           Next >|
  | [====|====|====|*===|    |    |  ]|
  +-----------------------------------+
```

---

<a id="task-015"></a>
## TASK-015: Tooltip Status Contratto

### Wireframe

```
BEFORE: Badge senza spiegazione
+-----------------------------------+
| Lautaro  | [Da impostare]        |
| Barella  | [Attivo]              |
| Sommer   | [In scadenza]         |
+-----------------------------------+
  Nuovo utente: "Cosa significa 'Da impostare'?"
  Nuovo utente: "Cosa devo fare?"

AFTER: Tooltip con spiegazione e azione
+-----------------------------------+
| Lautaro  | [Da impostare] (?)    |
| Barella  | [Attivo]              |
| Sommer   | [In scadenza] (!)     |
+-----------------------------------+

  Hover/tap su [Da impostare]:
  +-------------------------------------+
  | Contratto Da Impostare              |
  |                                     |
  | Il contratto di Lautaro Martinez    |
  | non e' ancora stato configurato.    |
  |                                     |
  | Cosa fare:                          |
  | Imposta salario e durata prima     |
  | della chiusura della fase           |
  | Contratti.                          |
  |                                     |
  | Deadline: 15 Feb 2026              |
  |                                     |
  | [Imposta Contratto]                |
  +-------------------------------------+

  Hover/tap su [In scadenza]:
  +-------------------------------------+
  | Contratto In Scadenza               |
  |                                     |
  | Il contratto di Sommer scade a      |
  | fine stagione (1 anno rimanente).   |
  |                                     |
  | Opzioni:                            |
  | - Rinnova il contratto              |
  | - Lascia scadere (diventa svinc.)  |
  |                                     |
  | [Rinnova]  [Info Rubata]           |
  +-------------------------------------+
```

---

<a id="task-016"></a>
## TASK-016: Virtualizzazione Liste

### Confronto Performance

```
Pagina AllPlayers con 500 giocatori:

BEFORE (no virtualizzazione):
  DOM nodes renderizzati: 500 righe x ~15 elementi = ~7500
  Tempo rendering iniziale: ~800ms
  Memoria: ~45MB
  Scrolling FPS: ~30-40 (janky)

AFTER (con @tanstack/react-virtual):
  DOM nodes renderizzati: ~10 righe x ~15 elementi = ~150
  Tempo rendering iniziale: ~50ms
  Memoria: ~12MB
  Scrolling FPS: 60 (smooth)

  Miglioramento:
  - Rendering: 16x piu veloce
  - Memoria: 3.7x meno
  - Scrolling: da janky a smooth
  - DOM nodes: 50x meno
```

---

<a id="task-017"></a>
## TASK-017: BottomSheet per Contratti Mobile

### Wireframe

```
BEFORE: Campi inline in tabella su mobile
+-----------------------------------+
| Lautaro  | [sal: ___] [dur: _]  |  <- Campi piccoli
| Barella  | [sal: ___] [dur: _]  |     touch impreciso
| Sommer   | [sal: ___] [dur: _]  |     errori frequenti
+-----------------------------------+

AFTER: Tap apre BottomSheet dedicato
+-----------------------------------+
| Lautaro  | [8.5M x 3a] [Modifica]|
+-----------------------------------+

  Tap su [Modifica] apre:
  +-----------------------------------+
  | --- drag handle ---              |
  |                                   |
  | Modifica Contratto           [X] |
  +-----------------------------------+
  |                                   |
  | [Photo] Lautaro Martinez    [A]  |
  |         Inter  -  28 anni        |
  |                                   |
  | Durata:                          |
  | +-------------------------------+ |
  | |  1 anno  2 anni  3 anni  4+  | |
  | |          [====o====]         | |
  | +-------------------------------+ |
  |                                   |
  | Salario (M):                     |
  | +-------------------------------+ |
  | |  [  -  ]   8.5M    [  +  ]   | |
  | +-------------------------------+ |
  | Min: 1M  Max: 20M               |
  |                                   |
  | Clausola Rescissoria (M):       |
  | +-------------------------------+ |
  | |  [  -  ]   15.0M   [  +  ]   | |
  | +-------------------------------+ |
  | Min: Salario x 1.5              |
  |                                   |
  | +-------------------------------+ |
  | | [Annulla]     [Salva]         | |
  | +-------------------------------+ |
  |                                   |
  +-----------------------------------+
```

---

<a id="tasks-basse"></a>
## Tasks Priorita Bassa (TASK-018 - TASK-023)

### TASK-018: Sidebar Rosa Collassabile

```
DESKTOP (1280px):

BEFORE:                              AFTER:
+--------+---------------------+    +--+-------------------------+
|Sidebar | Tabella Rosa        |    |[<]| Tabella Rosa (piu larga)|
|Manager | (spazio limitato)   |    |   | (piu spazio!)           |
|Budget  |                     |    |   |                         |
|Stats   |                     |    |   |                         |
|        |                     |    +--+-------------------------+
+--------+---------------------+     ^^
                                     Sidebar collassata = solo icone
                                     Toggle [<] per espandere
```

### TASK-019: Filtro Data/Periodo Movements

```
+-----------------------------------+
| [Tipo: Tutti v] [Sessione: #3 v] |  <- NUOVO filtro sessione
+-----------------------------------+
  Sessioni disponibili:
  - Tutte le sessioni
  - Sessione #3 (Mercato Ric. Feb 2026)
  - Sessione #2 (Mercato Ric. Set 2025)
  - Sessione #1 (Primo Mercato Ago 2025)
```

### TASK-022: aria-label su Bottoni Icon-Only

```
BEFORE:
  <button onClick={close}>
    <svg>X</svg>                    <- Screen reader: "button"
  </button>

AFTER:
  <button onClick={close} aria-label="Chiudi modale">
    <svg aria-hidden="true">X</svg> <- Screen reader: "Chiudi modale"
  </button>
```

### TASK-023: scope e aria-sort sulle Tabelle

```
BEFORE:
  <th>Nome</th>                     <- Screen reader: "cell"
  <th onClick={sort}>Budget</th>    <- Screen reader: "cell"

AFTER:
  <th scope="col">Nome</th>         <- Screen reader: "column header: Nome"
  <th scope="col"
      aria-sort="ascending"
      onClick={sort}>
    Budget                           <- Screen reader: "column header: Budget,
  </th>                                 sorted ascending"
```

---

<a id="tasks-future"></a>
## Tasks Future (TASK-030 - TASK-034)

### TASK-030: Command Palette

```
  Ctrl+K / Cmd+K:
  +----------------------------------------------+
  | > _                                          |
  |----------------------------------------------|
  | Suggerimenti:                                |
  | [icon] Pagine                                |
  | [icon] Giocatori                             |
  | [icon] Azioni                                |
  +----------------------------------------------+

  Digitando "laut":
  +----------------------------------------------+
  | > laut_                                      |
  |----------------------------------------------|
  | [user] Lautaro Martinez - Inter - A          |
  | [page] Stats: Lautaro Martinez               |
  | [page] Contratto: Lautaro Martinez           |
  +----------------------------------------------+

  Digitando "finanze":
  +----------------------------------------------+
  | > finanze_                                   |
  |----------------------------------------------|
  | [page] Serie A > Finanze                     |
  | [page] Champions > Finanze                   |
  | [action] Esporta dati finanziari             |
  +----------------------------------------------+
```

### TASK-031: Dashboard Widget Drag & Drop

```
  Modalita edit (click "Personalizza"):
  +--------------------------------------------------------------------+
  | [Drag] Budget     | [Drag] Roster   | [Drag] Notifiche           |
  | Widget            | Heat Map        | Feed                        |
  |                   |                 |                              |
  | Drag per          | Drag per        | Drag per                    |
  | riposizionare     | riposizionare   | riposizionare               |
  |                   |                 |                              |
  | [X] Rimuovi       | [X] Rimuovi     | [X] Rimuovi                 |
  +-------------------+-----------------+------------------------------+
  | [+ Aggiungi Widget]                                                |
  | Disponibili: Calendar, Profezie, Alert, Export, Classifica         |
  +--------------------------------------------------------------------+
```

### TASK-034: Sparkline nelle Tabelle

```
  Tabella con sparkline inline:
  +----------------------------------------------------------+
  | Giocatore     | Quot   | Trend 6m      | Rating         |
  |---------------|--------|---------------|----------------|
  | Lautaro       | 35M    | /\  /\/\      | 7.2 (+0.3)    |
  | Barella       | 28M    |    /\   \/\   | 7.0 (-0.1)    |
  | Bastoni       | 22M    | /\/\/\        | 6.8 (+0.5)    |
  +----------------------------------------------------------+
                           ^^^^^^^^^^
                    Mini grafico 30x16px
                    che mostra trend ultimi
                    6 mesi inline nella cella
```

---

## Riepilogo Visivo: Impatto per Sprint

```
Sprint 1 (Quick Wins):
  +----------------------------------+
  | PRIMA         |  DOPO            |
  |---------------|------------------|
  | Spinner       |  Skeleton loader |
  | Empty emoji   |  EmptyState CTA  |
  | No legenda    |  Legenda colori  |
  | Banner piatto |  Banner con ">"  |
  | No aria-label |  Tutti i label   |
  | Timer colore  |  Timer + testo   |
  | Solo DnD      |  DnD + frecce   |
  +----------------------------------+
  8 task, ~1 settimana, impatto immediato

Sprint 2 (Fondamenta):
  +----------------------------------+
  | PRIMA          |  DOPO           |
  |----------------|-----------------|
  | Tabelle dense  |  DataTable resp.|
  | SVG inline 130+|  lucide-react   |
  | Movements 12col|  Card mobile    |
  | Badge misterio |  Tooltip info   |
  +----------------------------------+
  4 task, ~2 settimane, pattern fix strutturale

Sprint 3 (Refactoring):
  +----------------------------------+
  | PRIMA          |  DOPO           |
  |----------------|-----------------|
  | Admin 8 tab    |  BottomSheet    |
  | Rubata 2000rig |  7 file modulari|
  | SVG charts     |  Recharts       |
  | Flusso confuso |  Stepper visivo |
  +----------------------------------+
  4 task, ~2 settimane, debito tecnico

Sprint 4 (Polish):
  +----------------------------------+
  | PRIMA          |  DOPO           |
  |----------------|-----------------|
  | 6 layout asta  |  3 layout + shared|
  | Liste lente    |  Virtualizzate  |
  | Form mobile min|  BottomSheet    |
  | Comparison modal| Full page view |
  +----------------------------------+
  4 task, ~2 settimane, UX avanzata
```

---

*Mockup generati a supporto di UI_IMPROVEMENTS_BACKLOG.md. Tutti i wireframe sono in formato ASCII per compatibilita universale. Nessun file del progetto e' stato modificato.*
