# Audit Cluster 2 — Hub & Rose (2026-08-21)

> Perimetro: `LeagueDetail` (hub lega), `Rose`, `Giocatori` (`Players.tsx`), `PlayerStatsModal`.
> Metodo: lettura sorgente (`src/pages/LeagueDetail.tsx`, `Rose.tsx`, `Players.tsx`,
> `src/components/league-detail/*`, `src/components/players/*`, `PlayerStatsModal.tsx`)
> + sessione browser autenticata (`pietro@test.it`) su **Lega Test**
> (`cms7tw7c600are3d5quvxe0g7`, fase Contratti) e **Fantacontratti Test**
> (`cmr7hitxq000914junocbrhtv`, fase Scambi, rosa di Pietro vuota) + verifica diretta
> dell'endpoint `GET /api/leagues/:id/auctions` via curl per confermare un'anomalia dati.
>
> **Nota ambientale**: sessione browser condivisa con altri 5 cluster paralleli sullo
> stesso profilo Chrome → più volte il tab è stato sloggato a metà audit (probabile
> race sulla rotazione del refresh-token tra tab). Ho rieseguito login quando serve;
> non è un finding di prodotto. Il `resize_window` a viewport mobile (390×844) non ha
> cambiato la risoluzione dello screenshot in questo ambiente: i finding mobile sotto
> sono basati su lettura del codice (classi `lg:hidden`/`hidden lg:*`), non su
> screenshot reali a 390px — segnalato caso per caso.
>
> **Nota di contesto**: al momento dell'audit `git status` mostra modifiche non
> committate ad opera di un'altra sessione parallela su `PreMarketOverview.tsx`,
> `league-detail/index.ts`, `LeagueDetail.tsx`, `league.service.ts` e un file nuovo
> `ManagerRosterOverview.tsx` (non ancora presente su disco). Non ho toccato né atteso
> questi file: il presente audit riflette lo stato osservato a runtime, che può
   differire lievemente da quanto in lavorazione altrove.

## Sintesi esecutiva (5 problemi a più alto impatto)

1. **La griglia "Accessi rapidi" dell'Hub ripete quasi 1:1 la barra di navigazione già sempre visibile in alto** — 8 tile su 10 duplicano voci di menu presenti nello stesso identico istante sullo schermo.
2. **La modale Statistiche Giocatore non mostra ingaggio/durata/clausola/prezzo rubata** — l'informazione più rilevante per un manager dinastico sparisce proprio nella vista di dettaglio, in violazione dell'Assioma 6.
3. **Il messaggio di rosa vuota su Rose è fuorviante fuori dal Primo Mercato** — dice "partecipa a un'asta" anche quando l'asta iniziale è già passata e la lega è in fase Scambi.
4. **Doppio indicatore di fase sull'Hub che può risultare contraddittorio** — la barra "Pre-mercato → 1° Mercato" e la striscia "Fase N di 7" possono raccontare due storie diverse quando i dati di sessione sono nello stato che ho osservato su Lega Test.
5. **"Giocatori" e "Statistiche" sono due tile/voci di menu separate per un'unica pagina** (`Players.tsx` ha già un toggle interno Lista/Statistiche) — moltiplica i punti d'ingresso per la stessa funzione.

---

## Findings per dimensione

### 1. Gerarchia informativa (Assioma 6/7/9)

**F1 — PlayerStatsModal non porta con sé il contratto (Alto)**
- Dove: `src/components/PlayerStatsModal.tsx` (interfaccia `PlayerInfo`, righe 105-116); chiamanti `src/pages/Rose.tsx` (`openPlayerStats`, righe 83-95) e `src/pages/Players.tsx` (`openPlayerStats`, righe 428-440).
- Cosa: `PlayerInfo` include `quotation`, `age`, `computedStats` ma **non** `salary`/`duration`/`rescissionClause`/`rubataPrice`. Verificato dal vivo: su Rose → Lega Test → Profeti, la riga di "Audero" mostra `ING 2M · DUR 3s · CLS 18M · RUB 20M`; cliccando il nome si apre la modale (tab "Panoramica", default) che mostra solo `Cremonese · N.D. · 14M` — il contratto non compare. Bisogna aprire il terzo tab "Carriera Lega" per trovare un riquadro "CONTRATTO" con `2M / 3a` e `RC: 18M`.
- Perché è un problema: l'Assioma 6 impone l'ordine ruolo→nome→squadra→età→**ingaggio→durata→clausola→prezzo rubata**→statistiche in ogni pagina. Il nome è cliccabile ovunque (Assioma 7) proprio per aprire questa modale: se la modale "dimentica" il dato più decisionale (quanto costa tenerlo/rubarlo), il click perde di senso in un contesto dinastico. Benchmark: Football Manager e Hattrick mantengono sempre visibile il "costo di possesso" nel drill-down del giocatore, non solo nella lista.
- Nota aggiuntiva (Assioma 4/9): dove il contratto compare (tab "Carriera Lega", riquadro "Proprietario attuale"), il formato è `2M / 3a` senza etichette esplicite "Ingaggio"/"Durata" (viola Assioma 9) e usa markup proprio invece del componente condiviso `ContractInline` (`src/components/ui/ContractInline.tsx`) già usato da Rose/Giocatori e già conforme (Assioma 4).
- Proposta: aggiungere `salary`/`duration`/`rescissionClause` a `PlayerInfo`, passarli da Rose/Giocatori (i dati sono già in mano al chiamante), e renderizzarli nell'header della modale con `ContractInline` subito dopo l'età — stesso componente, tre chiamanti, zero divergenza.

**F2 — Etichette duplicate ma non identiche per lo stesso concetto (Basso)**
- Dove: `src/components/players/RosterTableRow.tsx` (`FinancialValue`), `src/components/players/RosterPlayerCard.tsx` (`ContractStat`), `src/components/ui/ContractInline.tsx` (`Field`).
- Cosa: tre componenti diversi implementano la stessa idea ("valore + etichetta Ing/Dur/Cls/Rub") con markup leggermente diverso invece di un'unica primitiva condivisa.
- Perché: non è un bug visibile, ma è esattamente il tipo di frammentazione che l'Assioma 4 vuole evitare — tre punti da mantenere allineati invece di uno.
- Proposta (bassa priorità, solo se si tocca comunque quest'area): far usare a `RosterTableRow`/`RosterPlayerCard` la stessa primitiva `Field` di `ContractInline` invece di ridefinirla.

### 2. Navigazione e Information Architecture

**F3 — QuickAccessTiles duplica la Navigation bar sulla stessa schermata (Alto)**
- Dove: `src/components/league-detail/QuickAccessTiles.tsx` + `src/lib/navItems.ts` (`getQuickAccessTiles`, usata anche da `Navigation.tsx` via `getVisibleNavItems`).
- Cosa: verificato dal vivo su Lega Test — la `Navigation` in alto mostra Dashboard · Admin · **Rose · Giocatori · Scambi · Contratti · Finanze · Premi · Storico · Profezie** · Feedback; a scorrimento minimo, la sezione "Accessi rapidi" dell'Hub mostra **Rose, Giocatori, Scambi, Contratti, Finanze, Premi, Storico, Profezie, Strategie, Statistiche** — 8 destinazioni su 10 sono le stesse della nav bar, visibili contemporaneamente nello stesso viewport.
- Perché è un problema: è tecnicamente DRY (stessa fonte `navItems.ts`, Assioma 4 rispettato lato codice) ma il risultato percepito dall'utente è la ripetizione lamentata — la stessa lista di link mostrata due volte a pochi pixel di distanza. Football Manager e Sleeper usano la home/hub per **segnalare cosa richiede attenzione ora**, non per riproporre l'intero menu.
- Proposta (da validare con Pietro, tocca una scelta di prodotto): ridurre "Accessi rapidi" alle 2-3 destinazioni davvero contestuali al momento (es. solo la fase attiva + eventuali badge tipo "3 offerte scambio"), lasciando alla nav bar il ruolo di indice completo; oppure eliminare del tutto la sezione tile e affidare tutta la navigazione secondaria alla `AttentionRail` (che già fa "cosa richiede attenzione ora") + nav bar.

**F4 — "Giocatori" e "Statistiche" sono due punti d'ingresso per un'unica pagina (Medio)**
- Dove: `src/lib/navItems.ts` (voci separate `allPlayers`/`playerStats`), `src/pages/Players.tsx` (un solo componente con `initialView` + `PlayerViewToggle` interno già funzionante).
- Cosa: la pagina Giocatori ha già un toggle "Lista / Statistiche" nell'header (verificato dal vivo, cambia vista senza ricaricare la pagina). Eppure sia la nav bar sia la griglia tile dell'Hub offrono due voci separate ("Giocatori" e "Statistiche") che aprono lo stesso componente in due stati iniziali diversi.
- Perché: moltiplica le voci di menu per una distinzione che l'utente può già fare con due click nella stessa pagina — va contro "less is more in superficie".
- Proposta: unificare a una sola voce "Giocatori" (default Lista); il toggle interno resta l'unico modo per passare a Statistiche. Riduce la nav bar e le tile di 1 voce ciascuna.

**F5 — Messaggio di rosa vuota fuorviante fuori dal Primo Mercato (Alto)**
- Dove: `src/pages/Rose.tsx`, blocco `emptyState` righe 461-489, in particolare il ramo `isOwnRoster` (non `firstMarketNotStarted`) riga 476: *"Non hai ancora acquistato giocatori. Partecipa a un'asta per costruire la tua squadra!"*.
- Cosa: verificato dal vivo su **Fantacontratti Test** (fase Scambi, 1/7) con l'utente Pietro (rosa vuota, mentre altri manager come "Michele FC"/"Mirko United" hanno già 3 giocatori ciascuno). `firstMarketNotStarted` in Rose.tsx è calcolato come "tutti i membri hanno rosa vuota" — essendo falso (altri hanno giocatori), il codice mostra il messaggio "destinato al primo mercato non ancora iniziato", cioè invita a "partecipare a un'asta" quando in realtà il Primo Mercato è concluso da tempo e non c'è nessuna asta a cui iscriversi in questo momento (siamo in Scambi, prima di Rubata/Svincolati).
- Perché è un problema: un manager che si iscrive a metà stagione, o che non ha comprato nulla al primo mercato, riceve un'istruzione azionabile ma sbagliata — non esiste un'asta da "raggiungere" ora. Il CTA "Vai alla Lega" generico non aiuta a capire cosa fare davvero (es. proporre uno scambio).
- Proposta: distinguere esplicitamente lo stato "rosa vuota perché la lega non ha ancora fatto il primo mercato" da "rosa vuota con lega già avviata" (quest'ultimo caso, mostrare un messaggio calibrato sulla fase attiva — es. in Scambi: "Proponi uno scambio per costruire la tua squadra", in Svincolati: "Partecipa all'asta svincolati"). La fase attiva è già disponibile lato Rose (`leagueData.inContrattiPhase` esiste già come precedente simile a livello di prop — si può generalizzare con la fase corrente passata da `LeagueDetail`/route).

### 3. Progressive disclosure

**F6 — Tabellone Statistiche denso e spesso "a muro di N.D." (Medio)**
- Dove: `src/pages/Players.tsx`, vista `statsPanel` (righe 752-984), preset colonne `COLUMN_PRESETS`.
- Cosa: verificato dal vivo su Lega Test → Giocatori → Statistiche, preset "Attaccante": tutte le colonne (Pres, Min, Rating, Gol, Ass, G+A, Tiri, TiP, Tiri%, Rigs, DrbR…) mostrano "ND" per tutti i portieri visibili, perché i dati Serie A non sono sincronizzati in questo ambiente/lega. Il preset iniziale osservato era "Attaccante" (11 colonne) invece di "Essenziali" (il default previsto da codice, `COLUMN_PRESETS.essential`) — quasi certamente perché il `localStorage` (`playerStats_visibleColumns`) era stato impostato da un'altra sessione/agente sullo stesso profilo browser, non un bug di per sé, ma dimostra che la preferenza persiste tra sessioni e può presentare a un utente nuovo una vista già densa se il browser è condiviso o se una versione precedente ha lasciato uno stato.
- Perché è un problema più in generale: indipendentemente dalla causa del test, il pattern "tabellone denso esposto anche quando la sincronizzazione dati non è ancora avvenuta" va contro il principio less-is-more: l'utente vede tante colonne vuote invece di un messaggio chiaro tipo "statistiche non ancora disponibili per questa stagione/lega".
- Proposta: quando la percentuale di celle "ND" nella pagina/preset corrente supera una soglia (es. >80%), mostrare un banner leggero sopra il tabellone ("Statistiche Serie A non ancora sincronizzate per questa stagione") invece di — o sopra — 10+ colonne vuote; mantenere comunque il tabellone accessibile per chi vuole verificarlo.

**F7 — "FASE 3 DI 7" con 6 pallini visibili non è un bug ma può confondere (Basso)**
- Dove: `src/lib/phaseSteps.ts` (`RECURRENT_PHASES`, 6 fasi + commento "la 7ª, Fine Mercato, non ha sezione").
- Cosa: verificato che è intenzionale — la 7ª fase (chiusura mercato) non ha una sezione navigabile propria, quindi la striscia fase mostra solo 6 chip mentre il contatore dice "di 7". Nessuna azione di correzione necessaria (non è un difetto), ma dal punto di vista di un manager che conta i pallini la label può sembrare sbagliata.
- Proposta (facoltativa, sforzo minimo): un tooltip/asterisco su "DI 7" che spieghi "include la chiusura automatica del mercato" toglierebbe l'ambiguità visiva senza cambiare la logica.

### 4. Coerenza / stati dei dati

**F8 — Possibile indicatore di fase contraddittorio sull'Hub (Medio, da verificare in produzione)**
- Dove: `src/components/league-detail/PhaseIndicator.tsx` righe 25-44 (funzione `buildSteps`).
- Cosa osservata: su Lega Test, l'header dell'Hub mostra contemporaneamente: (a) la striscia in alto "FASE 3 DI 7 — Rinnovo Contratti" con Scambi✓/Premi✓/**Contratti (attivo)**; (b) subito sotto, la barra macro "Pre-mercato ✓ → **1° Mercato (attivo, arancione)**" — cioè il Primo Mercato risulta ancora "in corso" nello stesso istante in cui la fase Contratti (mercato ricorrente) è attiva. Ho verificato via API (`GET /api/leagues/cms7tw7c600are3d5quvxe0g7/auctions` con token admin) che in questa lega esiste **una sola** `MarketSession`, con `type: "PRIMO_MERCATO"`, `status: "ACTIVE"`, `currentPhase: "CONTRATTI"` — non risulta la sessione separata `type: "MERCATO_RICORRENTE"` che il codice (`src/services/auction.service.ts` riga 392) crea normalmente quando si avvia il mercato ricorrente.
- Causa probabile: dato di seed della lega di test creato direttamente a metà partita (non attraversando il flusso reale asta→completamento→avvio mercato ricorrente), quindi **probabile artefatto dei dati di test**, non necessariamente un bug riproducibile in produzione.
- Perché segnalarlo comunque: il codice di `PhaseIndicator.buildSteps` (riga 34) non è difensivo rispetto a questo scenario — il fallback `isDraft ? 'future' : 'current'` per lo step "1° Mercato" scatta ogni volta che `firstMarketDone` è `false` e nessuna sessione PRIMO_MERCATO è attiva, **anche se** una fase del mercato ricorrente è già in corso (`recurrentActive`, riga 48). Se per qualunque motivo (bug futuro, migrazione dati, importazione lega) si ripresentasse una combinazione simile in produzione, l'Hub mostrerebbe due racconti diversi della stessa situazione nello stesso schermo.
- Proposta (piccolo intervento difensivo, basso sforzo): in `buildSteps`, quando `recurrentActive` è vero, forzare `firstMarketState = 'done'` indipendentemente dallo stato della sessione PRIMO_MERCATO — la presenza di una fase ricorrente attiva implica logicamente che il primo mercato è concluso, a prescindere da come è marcato il record storico.

### 5. Densità contestuale

Rose e Giocatori seguono correttamente il pattern cockpit (viewport bloccato su desktop, scroll solo nei pannelli, `CockpitShell` condiviso) — nessun problema strutturale rilevato. La densità è coerente col contesto (lettura ragionata, non asta live), in linea con CLAUDE.md.

**F9 — Tre mini-classifiche manager con layout simile ma metriche diverse (Basso)**
- Dove: `src/components/league-detail/ManagersSidebar.tsx` ("Classifica bilanci", per saldo budget-ingaggi) sull'Hub; `src/components/players/RosterSidebar.tsx` ("Classifica composizione", per numero giocatori/ruolo) su Rose.
- Cosa: stesso pattern visivo (riga: posizione # + nome manager + valore), stessa posizione nella sidebar destra, metriche diverse (saldo vs composizione rosa). Non sono dati duplicati, ma il pattern "mini-classifica manager" si ripete due volte nella stessa area del prodotto (Hub → Rose sono a un click di distanza).
- Proposta (facoltativa, non urgente): se in futuro si tocca quest'area, valutare un unico componente condiviso `ManagerRankingList` parametrizzato sulla metrica (Assioma 4), invece di due implementazioni parallele.

### 6. Mobile

Basato su lettura del codice (non ho ottenuto screenshot reali a 390px in questo ambiente — vedi nota in testa al documento).

- Rose: `RosterPlayerCard.tsx` mostra ingaggio/durata/clausola/rubata in una griglia 4 colonne con etichette esplicite (Assioma 9 rispettato), nessun dato troncato via CSS (Assioma 2 rispettato a livello di markup: `break-words`, nessun `overflow-hidden` su testo).
- Giocatori (lista): riga mobile sposta i dati di contratto su una seconda riga tramite `ContractInline` (`variant="compact"`), coerente con Assioma 2/9.
- Giocatori (statistiche): su mobile la vista tabellare diventa card con chip `flex-wrap` (commento esplicito nel codice: "nessuno scroll orizzontale, Assioma 2"); il preset "Tutte" (26 colonne) è escluso dal `BottomSheet` filtri mobile (commento: "su mobile sarebbe troppo, less-is-more") — buona applicazione del principio.
- Non ho potuto verificare visivamente eventuali problemi di layout reali (ad es. overflow orizzontale accidentale) perché il resize del viewport non ha avuto effetto sugli screenshot in questo ambiente; consiglio una verifica manuale rapida di Pietro su un device reale o DevTools locale.

### 7. Onboarding & first-run

Non ho trovato materiale di onboarding dedicato dentro Hub/Rose/Giocatori (nessun tour, nessun tooltip introduttivo su KEEP/RELEASE o sul significato di "Rubata" al primo accesso) — c'è però `InfoTooltip`/`GLOSSARY` usato in punti mirati (es. header Rose su "Budget"/"Monte ingaggi"/"Clausole tot."), che aiuta senza invadere lo schermo. Non ho approfondito oltre: fuori dal perimetro stretto di questo cluster (nessuna pagina di onboarding dedicata da controllare).

### 8. Stati (loading/empty/error/success)

- Loading: skeleton coerenti (`SkeletonPlayerRow`, `SkeletonCard`) su Rose/Giocatori/Hub — verificato dal vivo (breve flash di skeleton su Giocatori al primo caricamento).
- Empty: gestiti esplicitamente su Rose (F5 sopra, contenuto migliorabile) e su Giocatori/Statistiche (`EmptyState` con icona + descrizione).
- Error: `ErrorState` con retry su Rose in caso di fallimento caricamento; banner con "Riprova" su Statistiche Giocatori in caso di errore fetch — coerente con la policy "banner solo per errori bloccanti con azione di recovery" di CLAUDE.md.

---

## Proposte prioritizzate

| # | Proposta | Impatto | Sforzo | Rif. |
|---|---|---|---|---|
| 1 | Passare ingaggio/durata/clausola/rubata a `PlayerStatsModal` e mostrarli nell'header con `ContractInline` | **Alto** | S | F1 |
| 2 | Calibrare il messaggio di rosa vuota su Rose in base alla fase corrente della lega (non solo "primo mercato sì/no") | **Alto** | S | F5 |
| 3 | Ridurre/ripensare "Accessi rapidi" sull'Hub per non duplicare 1:1 la nav bar (opzioni da validare con Pietro) | **Alto** | M | F3 |
| 4 | Unificare le voci "Giocatori" e "Statistiche" in un solo punto d'ingresso (il toggle interno esiste già) | Medio | S | F4 |
| 5 | Banner "statistiche non sincronizzate" quando la vista Statistiche è quasi tutta ND, invece di 10+ colonne vuote | Medio | S | F6 |
| 6 | Rendere `PhaseIndicator.buildSteps` difensivo: `firstMarketState = 'done'` quando `recurrentActive` è vero | Medio | S | F8 |
| 7 | Sostituire in `PlayerStatsModal` il markup contratto ad hoc con `ContractInline` (coerente col fix #1) | Basso | S | F1 |
| 8 | Tooltip esplicativo su "DI 7" per la 7ª fase implicita | Basso | S | F7 |
| 9 | Consolidare `FinancialValue`/`ContractStat`/`ContractInline.Field` in un'unica primitiva | Basso | M | F2 |
| 10 | Unico componente `ManagerRankingList` parametrizzato per Hub/Rose | Basso | M | F9 |

Nessun mockup HTML prodotto in questo audit: i finding più ad alto impatto (F1, F3, F5) sono interventi mirati su componenti/testi esistenti, non richiedono un nuovo layout da disegnare — un mockup avrebbe aggiunto meno valore di una descrizione precisa del file/riga da modificare.

---

## Bug funzionali osservati (riepilogo per riproducibilità)

| # | Dove | Passi | Atteso | Osservato |
|---|---|---|---|---|
| B1 | Rose → click nome giocatore (rosa propria) | Login pietro@test.it → Lega Test → Rose → click "Audero" | Contratto (ING/DUR/CLS/RUB) visibile nella modale | Solo tab "Carriera Lega" (3° tab) mostra un riepilogo contratto non etichettato; tab default "Panoramica" non lo mostra affatto |
| B2 | Rose, rosa vuota, lega oltre il primo mercato | Login pietro@test.it → Fantacontratti Test (fase Scambi) → Rose (rosa Pietro vuota) | Messaggio coerente con la fase attuale (Scambi) | "Non hai ancora acquistato giocatori. Partecipa a un'asta per costruire la tua squadra!" — non c'è nessuna asta attiva/imminente in fase Scambi |
| B3 | Hub → indicatore fase | Lega Test → Hub (scroll a destra per vedere l'header per intero su desktop largo) | Un solo racconto coerente dello stato di avanzamento | "1° Mercato" mostrato come "in corso" (arancione) mentre la striscia sopra mostra già "Contratti" (mercato ricorrente) attivo — riconducibile a dato di seed (vedi F8), ma il componente non è difensivo rispetto al caso |

---

## File toccati per la lettura (nessuna modifica a `src/`)

- `src/pages/LeagueDetail.tsx`, `src/pages/Rose.tsx`, `src/pages/Players.tsx`
- `src/components/PlayerStatsModal.tsx`
- `src/components/league-detail/{LeagueDetailHeader,PhaseIndicator,AdminBanner,AttentionRail,QuickAccessTiles,FinancialKPIs,ManagersSidebar,PreMarketOverview}.tsx`
- `src/components/players/{RosterTableRow,RosterPlayerCard,RosterSidebar}.tsx`
- `src/components/ui/ContractInline.tsx`
- `src/lib/phaseSteps.ts`, `src/lib/navItems.ts` (letto per riferimento, non incluso integralmente)
- `src/services/auction.service.ts` (righe 280-430, per la verifica di F8)
