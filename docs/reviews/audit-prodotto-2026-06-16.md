# Audit di Prodotto & UX — FantaContratti

> Prima analisi completa di prodotto/UX dell'intera piattaforma.
> Autore: Senior Product & UX Strategist (giochi manageriali sportivi).
> Data: 2026-06-16 · Read-only su `src/` · Principio guida: **less is more in superficie, profondità per i veri appassionati**.
> Fonti: Bibbie (`docs/bibbie/`), `CLAUDE.md` (Stili, Pattern cockpit, 10 Assiomi), codice reale in `src/`, mockup esistenti in `docs/reviews/mockups/`.

---

## 0. Premessa metodologica

La piattaforma è **matura e graficamente coerente**: pattern cockpit applicato alle pagine dense, componenti condivisi (TimerDisplay, BidControlsShared, CockpitShell…), tema Stadium Nights rispettato, navigazione fase-driven con sorgente unica (`navItems.ts`) condivisa fra desktop e mobile. Quasi ogni sezione ha già un mockup di riferimento (`mockups/01`→`21`) e un'implementazione allineata.

Per questo l'audit **non** ripropone redesign cosmetici già coperti dai mockup. Si concentra sui **problemi di prodotto trasversali** che nessun singolo mockup di sezione poteva cogliere, perché emergono solo guardando il *sistema di navigazione e comprensione nel suo insieme* — che è anche il focus prioritario dichiarato (difficoltà di navigazione).

Convenzione: **[REGOLA]** = vincolo imposto dalle Bibbie · **[PRODOTTO]** = scelta di prodotto/UX mia, opinabile, su cui propongo opzioni.

---

## 1. Sintesi esecutiva — i 5 problemi a più alto impatto

1. **Tre modelli mentali concorrenti della stessa Information Architecture** [PRODOTTO]. La stessa lega si naviga in tre modi che non coincidono: il **menu header desktop** è fase-driven (mostra solo la fase corrente + voci fisse), gli **8 QuickAccessTiles** dell'hub sono un set fisso diverso, la **bottom-nav mobile** ha 5 tab con una logica ancora diversa (es. "Rosa" come fallback, "Giocatori" che ingloba Strategie). Il manager non costruisce una mappa stabile di "dove sono le cose".

2. **Le fasi passate e future spariscono dalla navigazione** [PRODOTTO]. Il menu mostra come sezione *solo* la fase attiva (`getPhaseNavItem`). Quando la lega è in RUBATA, le voci **Scambi** e **Contratti** non esistono più nel menu (erano fasi precedenti) e **Premi** non compare mai (non ha sezione manager). L'unico modo per rivedere quel contenuto è lo stepper dell'hub o l'URL diretto. Per un dynasty game, dove si ragiona *attraverso* le fasi, è una perdita di contesto.

3. **Onboarding del modello dinastico assente** [PRODOTTO]. L'unico onboarding (Dashboard T-019) spiega il *processo* (crea lega → invita → asta), mai il *modello*: clausola rescissoria, ingaggio≠quotazione, durata in semestri, KEEP/RELEASE, prezzo rubata = clausola+ingaggio. Sono esattamente i concetti che le Bibbie definiscono come core e che un nuovo manager non può dedurre. Non esiste glossario né help contestuale sistematico (solo `KPICard` ha un tooltip).

4. **Nessun indicatore persistente di "in che fase è la lega + cosa devo fare ora"** fuori dall'hub [PRODOTTO]. Appena il manager entra in una sezione (Rose, Finanze, Giocatori), perde il riferimento alla fase e alla call-to-action corrente. Il badge "LIVE" copre solo le 3 aste. Football Manager risolve questo con la **inbox** sempre presente; qui il segnale "tocca a te" vive solo nell'`AttentionRail` dell'hub, che il manager non vede se è altrove.

5. **Overload nelle viste più dense, contro il principio less-is-more** [PRODOTTO + ASSIOMI]. Due punti caldi: (a) **Players → vista Statistiche** espone fino a **26 colonne** con scroll orizzontale forzato (`Players.tsx:173`), in conflitto con Assioma 2 (mobile, nessun troncamento) e con less-is-more; (b) **Svincolati** impila fino a 6 modali in una state-machine con bottoni di test "force" mescolati ai controlli live (`Svincolati.tsx:580-808`), aumentando il carico cognitivo nel momento di massima tensione.

---

## 2. Findings per dimensione

### 2.1 Navigazione & Information Architecture (focus prioritario)

**F-NAV-1 · Tripla IA non riconciliata** [PRODOTTO]
Tre superfici di navigazione con tassonomie diverse:
- Header desktop (`Navigation.tsx:241`, `navItems.ts:94`): Dashboard · Admin · **[fase corrente]** · Giocatori · Finanze · Storico · Profezie · Feedback.
- Hub `QuickAccessTiles` (`league-detail/QuickAccessTiles.tsx`): 8 tile fisse — Rose, Finanze, Scambi, Contratti, **Strategie**, Storico, Profezie, **Statistiche**. Include "Scambi" e "Contratti" *anche quando non sono la fase corrente* (incoerente col menu, che li nasconde), e ha voci che il menu non ha (Strategie, Statistiche separata da Giocatori).
- Bottom-nav mobile (`BottomNavBar.tsx:64`): Home · **[fase|Rosa]** · Giocatori · Finanze · Menu. "Giocatori" qui ingloba anche `/strategie-rubata` (`getActiveTab:186`); "Finanze" ingloba Movimenti e Storico (`:191`).

*Perché è un problema:* il manager non riesce a formarsi una mappa stabile. La stessa azione ("vedere i contratti") sta nel menu solo in fase CONTRATTI, ma è sempre tra le tile, e su mobile è dentro "Menu". Benchmark: Sleeper e Fantrax tengono una **tab-bar stabile** (le voci non cambiano di posizione né compaiono/spariscono); ciò che cambia è il *badge/CTA*, non la presenza della voce.

**F-NAV-2 · Le sezioni di fase non-attiva diventano orfane** [PRODOTTO]
`getPhaseNavItem` (`navItems.ts:68`) ritorna una sola voce di fase. Conseguenze:
- In RUBATA, **Scambi** (fase 1) e **Contratti** (fase 3) non sono nel menu. Eppure le rose, i contratti consolidati e lo storico scambi restano contenuti consultabili e rilevanti per decidere una rubata.
- **Premi** non ha mai una voce manager (solo admin via `/prizes`), quindi il manager non ha un punto-menu per rivedere i premi ricevuti se non passando da Finanze/Storico.
- Il routing **espone comunque** `/trades`, `/contracts` ecc. sempre (`App.tsx`), ma raggiungibili solo via tile/URL. La navigazione e il routing dicono cose diverse.

*Perché è un problema:* in un dynasty game si ragiona di continuo sul passato (cosa ho consolidato, cosa ho scambiato) mentre si gioca il presente. Nascondere le sezioni non-attive ottimizza per il "fai la cosa di adesso" ma penalizza la profondità per l'appassionato.

**F-NAV-3 · Cambio lega costoso e identità lega debole su mobile** [PRODOTTO]
Da una sezione di Lega A a Lega B servono 2 hop (sezione → dashboard → lega B), mitigati solo dal click sull'identità-lega nell'header *desktop* (`Navigation.tsx:312`), che però è `hidden sm:flex` → **assente su mobile**. Su mobile l'unico ritorno è il breadcrumb compatto (`:347`). Benchmark: Fantrax (multi-lega) ha uno switcher lega persistente in cima.

**F-NAV-4 · Lo stepper di fase è informativo ma non azionabile** [PRODOTTO]
`PhaseIndicator` (`league-detail/PhaseIndicator.tsx`) mostra bene il percorso a 7 fasi (Pre → 1° → ricorrenti) con stato done/current/future, ma **i passi non sono cliccabili** e vive solo nell'hub. È una bussola che non è anche un timone, e non è visibile quando serve di più (dentro una sezione).

### 2.2 Gerarchia informativa (Assioma 6)

**F-HIER-1 · Gerarchia rispettata nelle sezioni rifatte, ma "ingaggio/durata" non sempre con label fuori dalle tabelle** [PRODOTTO + ASSIOMA 9]
Le pagine dense (Rose, Players, Contracts) seguono l'ordine ruolo→nome→squadra→età→ingaggio→durata→clausola→rubata e i nomi sono cliccabili (Assioma 7) — verificato in `Rose.tsx:469`, `Players.tsx:791`. Nelle tabelle le colonne hanno header. Da verificare in live (debito noto): nelle viste compatte/mobile e nelle card riassuntive che ingaggio e durata abbiano sempre label esplicite (Assioma 9), non solo numeri affiancati.

**F-HIER-2 · "Numero grande spiegato" non sistematico** [PRODOTTO + ASSIOMA 3]
Lo stile Finanze (numero grande + sottotitolo + tooltip "i") è il riferimento, ma KPI inline nelle testate cockpit (Rose, Contracts, Trades) mostrano spesso il numero con micro-label ma **senza il tooltip esplicativo** che invece `finance/KPICard` ha. Per i concetti ambigui (Bilancio vs Budget vs Monte Ingaggi — distinzione [REGOLA] cruciale e notoriamente confondibile) il tooltip dovrebbe essere ovunque appaia il numero, non solo in Finanze.

### 2.3 Progressive disclosure

**F-PD-1 · Players/Statistiche: troppo in superficie** [PRODOTTO]
Preset "all" = 26 colonne (`Players.tsx:173`), scroll orizzontale forzato (`:736 w-max min-w-full`). Viola less-is-more e Assioma 2. Il preset essenziale esiste, ma il default e la possibilità di arrivare a 26 colonne in tabella spingono nella direzione opposta. Benchmark OOTP/FM: default a poche colonne ad alto valore, il resto dietro "drill-down" o nella scheda giocatore.

**F-PD-2 · Svincolati: troppo impilato nel momento clou** [PRODOTTO]
6 modali potenziali in stack (`Svincolati.tsx:450-858`) + bottoni "force/test" admin frammisti ai controlli (`:580, :607, :737, :808`). Anche se mutuamente esclusivi, la densità di stati e la commistione test/produzione aumentano il rischio di errore e il carico cognitivo durante un'asta live. *Nota:* `SvincolatiCockpit` è un sotto-componente opaco — la verifica live (debito noto) qui è particolarmente importante.

**F-PD-3 · PrizePhasePage molto scarna per i manager** [PRODOTTO]
Per i non-admin senza sessione attiva: solo emoji + "Nessuna sessione" + storico (`PrizePhasePage.tsx:78-102`). Manca un riepilogo "cosa ho ricevuto / cosa è in palio" sempre consultabile — l'opposto dell'overload, qui c'è *under-disclosure*.

### 2.4 Coerenza (Assiomi 3, 4)

**F-COE-1 · QuickAccessTiles vs menu divergono sulla tassonomia** (vedi F-NAV-1) [PRODOTTO]. Stessa funzione, due elenchi diversi → viola lo spirito dell'Assioma 4 (riuso, niente divergenze).

**F-COE-2 · Stati gestiti, linguaggio toast/banner in via di bonifica** [PRODOTTO]. Loading/empty/error/unauthorized presenti e coerenti (Dashboard, Financials, AdminPanel). La bonifica banner→toast è in corso (nota CLAUDE.md): da completare sulle pagine non ancora convertite, così che i banner persistenti restino solo per errori bloccanti con recovery.

### 2.5 Densità contestuale

**F-DENS-1 · Densità ben tarata dove rifatta** [PRODOTTO]. Asta/Rubata cockpit = densità alta giustificata dal real-time; Hub = consultazione a flusso normale (corretto: l'hub *non* è cockpit, come da mockup 11). Buona separazione. Il punto debole resta Players/Statistiche (troppa densità per una vista di consultazione, F-PD-1).

### 2.6 Mobile (Assiomi 1, 2)

**F-MOB-1 · Scroll orizzontale in Statistiche** = troncamento/perdita dati su mobile (Assioma 2) [ASSIOMA].

**F-MOB-2 · Identità-lega e switch lega assenti su mobile** (F-NAV-3) [PRODOTTO].

**F-MOB-3 · Bottom-nav: la voce centrale cambia significato** [PRODOTTO]. La 2ª tab è "fase corrente" o "Rosa" come fallback: il manager non sa a priori cosa troverà toccandola. Touch target e safe-area sono gestiti correttamente (`BottomNavBar.tsx:75`).

### 2.7 Onboarding & first-run

**F-ONB-1 · Nessuna spiegazione del modello dinastico** [PRODOTTO]. (vedi Sintesi #3). Non c'è glossario, tour, né help "i" sistematico. Il nuovo manager invitato in una lega esistente non riceve alcun onboarding (l'unico è in Dashboard per chi non ha leghe). Benchmark: Hattrick/Sleeper hanno un glossario e tooltip pervasivi sui concetti economici.

**F-ONB-2 · Concetti più confondibili senza supporto** [REGOLA→supporto PRODOTTO]: Bilancio = Budget − Monte Ingaggi (`FINANZE.md §1.3`); prezzo rubata = clausola + ingaggio (`RUBATA.md §3.1`); il rinnovo NON scala il budget (`CONTRATTI.md §5.4`). Sono regole controintuitive che meritano un tooltip nel punto d'uso.

### 2.8 Stati

**F-STA-1 · Buona copertura** [PRODOTTO]. Skeleton, empty con CTA, error con "Riprova", unauthorized: presenti e coerenti col tema. Nessuna azione strutturale richiesta oltre alla bonifica banner→toast (F-COE-2).

---

## 3. Proposte prioritizzate (impatto × sforzo, ordinate per rapporto)

| # | Proposta | Dimensione | Impatto | Sforzo | Note / Assiomi |
|---|----------|-----------|:-------:|:------:|----------------|
| **P1** | **Unificare l'IA in una sola tassonomia stabile.** Una sola sorgente (`navItems.ts`) che elenca SEMPRE tutte le sezioni della lega in ordine fisso (Hub · Rose · Giocatori · Scambi · Contratti · Rubata/Svincolati quando esistono · Finanze · Storico · Profezie). La fase corrente non *sostituisce* le altre voci: le evidenzia (badge "ORA"/LIVE + accento oro). QuickAccessTiles, header e bottom-nav derivano tutti da questa lista (Assioma 4). | NAV | **Alto** | **M** | Risolve F-NAV-1, F-NAV-2, F-COE-1. Mockup P1. |
| **P2** | **Barra-fase persistente azionabile** (slim, sticky sotto l'header) visibile in OGNI sezione di lega: mostra fase corrente + "cosa fare ora" + CTA. Stepper a 7 fasi cliccabile (porta alla sezione, se navigabile). È il "timone" sempre presente. | NAV | **Alto** | **M** | Risolve F-NAV-4 e #4. Estende `PhaseIndicator` rendendolo globale + cliccabile. Mockup P2. |
| **P3** | **Help contestuale + glossario dinastico.** Tooltip "i" riusabile (estendere il pattern `KPICard`) su tutti i numeri ambigui (Bilancio/Budget/Monte ingaggi, clausola, rubata, durata). Una pagina/sheet "Glossario" linkata dal menu e dal first-run. Micro-spiegazioni nei punti d'uso, non un wall di testo. | ONB | **Alto** | **S–M** | Risolve F-ONB-1/2, F-HIER-2. Riusa Bibbie come fonte. |
| **P4** | **Default a poche colonne in Players/Statistiche** + drill-down nella scheda giocatore (`PlayerStatsModal`) per il resto. Eliminare lo scroll orizzontale forzato su mobile; preset essenziale come default, "tutte" solo desktop e dietro scelta esplicita. | PD/MOBILE | **Medio-Alto** | **S** | Risolve F-PD-1, F-MOB-1 (Assioma 2). |
| **P5** | **Onboarding del modello al primo ingresso in una lega** (non solo per chi crea): card/sheet "Come funziona una stagione" con le 7 fasi + 4 concetti chiave, dismissibile, richiamabile dal Glossario. | ONB | **Medio-Alto** | **M** | Completa P3. Per il manager invitato (oggi zero onboarding). |
| **P6** | **Switcher lega persistente su mobile** (dropdown nell'header o nel drawer) + identità-lega visibile anche `<sm`. | NAV/MOBILE | **Medio** | **S** | Risolve F-NAV-3, F-MOB-2. |
| **P7** | **Separare i controlli admin "force/test" dai controlli live in Svincolati/Rubata** (raggruppare in un pannello admin collassato, fuori dal flusso del manager). | PD | **Medio** | **S–M** | Riduce F-PD-2; verifica live necessaria. |
| **P8** | **Riepilogo premi per il manager** in PrizePhasePage / hub ("ricevuti / in palio"), sempre consultabile. | PD | **Basso-Medio** | **S** | Risolve F-PD-3. |
| **P9** | **Completare bonifica banner→toast** sulle pagine non ancora convertite. | COE | **Basso** | **S** | F-COE-2. Già pianificata. |

**Ordine consigliato di esecuzione (impatto/sforzo):** P1 → P2 → P4 → P3 → P6 → P5 → P7 → P8 → P9.
P1 e P2 sono il cuore del focus "difficoltà di navigazione" e si rinforzano a vicenda: conviene progettarli insieme (vedi mockup).

---

## 4. Mockup prodotti

Cartella: `docs/reviews/mockups/22-audit-prodotto/`

1. `navigazione-unificata.html` — **P1 + P2 insieme**: header con IA stabile (tutte le sezioni sempre presenti, fase evidenziata) + barra-fase persistente azionabile sotto l'header, vista desktop e mobile. È il mockup dell'intervento a più alto impatto sul focus prioritario.
2. `players-statistiche.html` — **P4**: vista Statistiche ridisegnata less-is-more (poche colonne ad alto valore di default, drill-down nella scheda, niente scroll orizzontale forzato; preset come scelta esplicita).

I mockup riusano palette/font dei mockup esistenti (token Stadium Nights, Outfit/Oswald/JetBrains Mono) e sono coerenti con il pattern cockpit dove pertinente.

---

## 5. Note finali

- Tutte le proposte rispettano **less-is-more in superficie / profondità sotto**: P1/P2 non aggiungono dati, riorganizzano l'accesso; P4 riduce la superficie e sposta il dettaglio nel drill-down; P3/P5 aggiungono profondità *on-demand*.
- Nessuna proposta viola le Bibbie. P1/P2 vanno verificati contro il flusso a 7 fasi [REGOLA `MERCATO-RICORRENTE.md`]: l'ordine delle sezioni nella tassonomia stabile deve rispecchiare l'ordine delle fasi.
- **Decisioni di prodotto aperte per Pietro** (non le impongo): (a) le fasi future devono essere *visibili ma disabilitate* o *nascoste finché non raggiunte*? (b) la barra-fase persistente deve essere sticky sempre o comprimersi nelle pagine cockpit (dove il viewport è già bloccato)? (c) Glossario come pagina dedicata o sheet contestuale?
- **Debito da CLAUDE.md/memoria:** le verifiche live su ~13 sezioni non sono mai state fatte. Diversi finding (F-HIER-1, F-PD-2) andrebbero confermati su app in esecuzione prima di intervenire.
