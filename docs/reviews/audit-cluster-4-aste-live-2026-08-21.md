# Audit Cluster 4 — Aste live (Asta Primo Mercato, Rubata + Strategie Rubata, Svincolati)

Data: 2026-08-21
Ambiente: dev locale (`localhost:5174` + API `localhost:3003`, DB Docker condiviso con altri agenti in parallelo, tab Chrome dedicato)
Metodo: **azione reale end-to-end**, non solo lettura codice. Ho creato/portato avanti una lega di test fino a stato asta-live e giocato tutte e tre le fasi (Primo Mercato → Rubata → Svincolati) tramite UI browser + chiamate API dirette (per i passaggi di setup/fast-forward, con lo stesso account admin `pietro@test.it`), più lettura di `AuctionRoom.tsx`, `Svincolati.tsx`, `Rubata.tsx`, `StrategieRubata.tsx`, `useAuctionRoomState`/`useSvincolatiState`, `auction.service.ts`, `rubata.service.ts` e le Bibbie `PRIMO-MERCATO.md`, `RUBATA.md`, `SVINCOLATI.md`.

## Nota metodologica — cosa ho fatto e perché

Nessuna delle leghe note era in fase asta-live. Ho usato **"Lega finale"** (`cmsw06f4j005cops4khomjrsl`, era in `DRAFT` con 1/8 manager): l'ho resa pubblica, ho fatto richiedere l'iscrizione a tutti e 7 i manager di test (michele, mirko, emmanuele, diego, marco, marcolino, emiliano), accettate come admin, avviata (8/8, pari), creata la sessione Primo Mercato, giocato **una nomination/asta reale via UI** (Audero, portiere Cremonese), poi usato `complete-all-slots` (endpoint di test già presente nel prodotto, pensato per questo) per riempire le rose restanti e velocizzare fino a Mercato Ricorrente. Ho attraversato Offerte→Premi→Contratti (consolidamento per tutti gli 8 manager)→**Rubata** (generato tabellone, giocato un'asta reale con rilancio, chiusura lazy, conferma, ricorso simulato e risolto) →**Svincolati** (setup ordine turni, cockpit live). Non ho toccato "Fantacontratti Ufficiale" né le leghe di altri agenti. Non ho lasciato aste a metà: "Lega finale" è ora ferma in fase Svincolati con lo stato coerente (nessuna asta pendente).

---

## Sintesi esecutiva (5 problemi a più alto impatto)

1. **Overflow orizzontale che taglia dati/controlli, non solo su mobile**: a una larghezza di viewport comune per laptop (~1300–1440px, sotto un 1920 non massimizzato), le testate cockpit di Asta/Rubata/Svincolati **tagliano silenziosamente** badge (`OFFERTA MAX`), pulsanti admin (`Concludi asta`) e l'intero pannello "Controlli Admin (TEST)" — senza scrollbar, senza wrap. L'utente non sa nemmeno che quel controllo esiste.
2. **L'ordine turni Svincolati non viene precompilato secondo la regola di gioco** (ordine inverso alla Rubata, `SVINCOLATI.md §2.1`): il draft che l'admin vede in "Ordine Turni" è l'elenco grezzo dei membri, non l'inverso calcolato. L'admin deve trascinare a mano 8 manager nell'ordine esatto — lavoro manuale ad alto rischio d'errore che il sistema ha già tutti i dati per fare da solo.
3. **Ogni singola nomination del Primo Mercato richiede un ready-check di TUTTI gli 8 manager**, non solo la conferma anti-misclick del nominatore prevista da `PRIMO-MERCATO.md §2.5`. Con ~25 slot × 8 manager, è un collo di bottiglia che nel prodotto reale esiste solo grazie a un bottone "Forza Tutti Pronti" — segno che il flusso di default è più pesante di quanto serva.
4. **Controlli admin/test duplicati fra la cockpit bar e il pannello legacy**: "Concludi asta" e "Forza Conferme" esistono in due punti diversi della stessa schermata (retaggio della coesistenza `auction-room` vecchia/`auction-room-v2` già annotata in CLAUDE.md come problema noto).
5. **Bug di stato nel flusso di nomina rapida** (Primo Mercato): cliccando in sequenza ravvicinata su due giocatori diversi nello step di selezione, lo step di conferma può mostrare il nome di un giocatore con la quotazione di un altro ("QUOTAZIONE 1M" per Audero, che ha in realtà quotazione 14 — confermato nello schermo di offerta successivo).

---

## Findings per dimensione

### 1. Overflow-x / dati e controlli tagliati (trasversale ad Asta, Rubata, Svincolati)

**Cosa**: a viewport ~1425×660 (ridimensionare la finestra a 1920×1080 non ha avuto effetto sulla viewport reale renderizzata — comportamento di per sé sospetto, vedi nota tecnica sotto), ho osservato ripetutamente elementi tagliati senza alcuno scroll orizzontale disponibile:
- **AuctionRoom**: badge `OFFERTA MAX 450M` in testata tagliato a metà ("OFFERTA M…" / "450" parzialmente visibile); pulsante `Concludi asta` e i chip timer admin (`45s 60s`) fuori schermo; l'intero pannello **"Controlli Admin (TEST)"** (Forza Tutti Pronti, Forza Conferme, Completa slot, Reset) visibile solo per metà — pulsanti raggiungibili solo tramite ricerca per testo, non a colpo d'occhio.
- **Rubata**: riga "CHI ALTRO PUÒ RUBARLO" (lista manager con bilancio sufficiente) tagliata a metà lista ("T 343M, T 34…"); pulsante `Comp[leta]` in testata tagliato.
- **Svincolati / setup ordine turni**: dopo aver premuto "Conferma Ordine" (che in realtà era fuori schermo ed è stato raggiunto solo via ricerca per riferimento DOM), la pagina è rimasta **scrollata orizzontalmente** lasciando metà schermo nero — nessun contenuto, nessun modo ovvio di tornare a centro senza scroll manuale.

**Dove**: `src/components/cockpit/CockpitShell.tsx` (confinamento dichiarato in CLAUDE.md come garantito da `min-w-0 max-w-full overflow-x-hidden`), header/testata di `src/pages/AuctionRoom.tsx`, `src/pages/Rubata.tsx`, testata admin controls in `src/components/auction-room-v2/AdminActionsPanel.tsx`/pannello legacy.

**Perché è un problema**: CLAUDE.md §Assioma 2 (corollario anti-overflow-x) richiede che ogni riga di filtri/azioni su schermi densi sia `flex-wrap` (mobile) o `overflow-x-auto`, mai un `flex` non-wrap che eccede la larghezza senza un fratello scrollabile. Qui il problema si manifesta anche **desktop**, non solo mobile: un admin su un laptop 13"–14" (risoluzione reale ~1440×900 o 1512×982 scalata) può perdere l'accesso a controlli critici durante un'asta live (chiudere l'asta, forzare pronti) senza nemmeno capire che esistono. Durante un'asta reale con timer che scorre, questo è un blocco operativo, non un dettaglio estetico.

**Nota tecnica**: il tool di resize finestra non ha cambiato la viewport effettiva catturata dagli screenshot (rimasta 1425×660 anche dopo richiesta di 1920×1080) — non posso escludere che parte del taglio sia un artefatto dell'ambiente di test piuttosto che del solo CSS, ma la mancanza di scroll orizzontale disponibile (verificato tentando di scrollare a destra: nessun movimento) indica che il contenuto reale è più largo del contenitore e viene clippato da `overflow-hidden`, non solo "fuori vista".

**Proposta**: applicare a testata/admin-bar delle tre pagine lo stesso pattern già richiesto per righe filtri (`flex-wrap` + `lg:flex-nowrap` con fallback `overflow-x-auto`), testando esplicitamente a 1366px e 1440px (le larghezze laptop più comuni), non solo a 1920px o su mobile.

---

### 2. Regola di gioco non pre-applicata — Ordine Svincolati (violazione Bibbia, non solo UX)

**Cosa**: in `src/hooks/useSvincolatiState.ts:257-293` (`loadInitialData`), il draft dell'ordine turni per gli Svincolati viene inizializzato da `activeMembers` — l'elenco grezzo dei membri lega restituito da `GET /leagues/:id` — **non** dall'inverso dell'ordine Rubata già registrato in `MarketSession.rubataOrder`.

Verifica pratica: ordine Rubata impostato = `Pietro, Michele, Mirko, Emmanuele, Diego, Marco, Marcolino, Emiliano`. Inverso atteso (`SVINCOLATI.md §2.1`: "l'ordine di chiamata è inverso all'ordine della rubata") = `Emiliano, Marcolino, Marco, Diego, Emmanuele, Mirko, Michele, Pietro`. Ordine mostrato di default nella UI: `Mirko, Emmanuele, Diego, Michele, Pietro, Marco, Marcolino, Emiliano` — non corrisponde né all'inverso né a un ordinamento per budget.

**Dove**: `src/hooks/useSvincolatiState.ts:257-293`.

**Perché è un problema**: non è solo un vezzo grafico — è una **regola di gioco** (Bibbia SVINCOLATI §2.1) che il sistema conosce perfettamente (`rubataOrder` è già in DB) ma non applica. L'admin deve trascinare manualmente 8 righe nell'ordine corretto sotto pressione (gli altri manager aspettano), con alto rischio di sbagliare — e se sbaglia, il vantaggio/svantaggio competitivo dei manager si inverte silenziosamente rispetto al regolamento dichiarato. Questo è esattamente il tipo di incongruenza che mina la fiducia nel prodotto.

**Proposta**: precompilare `turnOrderDraft` con l'inverso di `rubataOrder` quando disponibile (fallback all'elenco grezzo solo se la lega non ha mai fatto una rubata, es. lega nuova). L'admin mantiene la possibilità di trascinare per correggere casi eccezionali (manager usciti, ecc.), ma il default deve essere quello corretto per regolamento — coerente con "less is more": il sistema fa il lavoro, l'admin verifica invece di costruire da zero.

---

### 3. Ready-check pesante non richiesto dalla Bibbia — Primo Mercato

**Cosa**: dopo che il nominatore conferma un giocatore (`confirmNomination`), il backend resetta `readyMembers` al solo nominatore (`src/services/auction.service.ts:3827-3834`) e **tutti** gli altri manager devono chiamare `markReady` prima che l'asta sul giocatore nominato inizi davvero (osservato in UI: "CONFERMA PRONTI — 0/8 DG PRONTI" dopo ogni singola nomination, con countdown che non parte finché non sono tutti pronti).

**Dove**: `src/services/auction.service.ts:3779-3835` (`confirmNomination`) + `3936-4030` (`markReady`); UI in `src/components/auction-room-v2/ReadyCheckPanel.tsx`.

**Perché è un problema**: `PRIMO-MERCATO.md §2.5` prevede solo una "conferma" per **evitare errori di click del nominatore** — non un ready-check di tutti gli 8 partecipanti per ogni singolo giocatore. Con 24+ slot totali (3P+8D+8C+6A per manager, moltiplicato per gli slot ancora vuoti sul mercato) il numero di nomination in una sessione reale è alto: ogni nomination che richiede 8 click "pronto" prima di poter offrire è un attrito enorme in un contesto che dovrebbe essere fluido e veloce (è letteralmente l'asta più concitata delle tre). Il fatto che esista un pulsante admin dedicato **"Forza Tutti Pronti"** proprio per bypassare questo passaggio (l'ho dovuto usare io stesso per procedere in tempi ragionevoli) è un segnale che il team di sviluppo per primo ha sentito il bisogno di scavalcarlo — di solito segno che il default è troppo pesante per l'uso reale, non solo per i test.

**Confronto con Rubata**: nella fase Rubata, un ready-check per singolo giocatore È esplicitamente previsto dalla Bibbia (macchina a stati `READY_CHECK`→`OFFERING`→`AUCTION_READY_CHECK`→`AUCTION`) perché la Rubata è strutturalmente un "reveal" ordinato, giocatore per giocatore, con pause deliberate. Il Primo Mercato nella Bibbia è invece descritto come asta libera e continua ("qualsiasi manager può fare offerte per qualsiasi giocatore"): il ready-check ad ogni nomination sembra un pattern preso in prestito dalla Rubata senza adattarlo al ritmo diverso del Primo Mercato.

**Proposta (da verificare con Pietro, è una scelta di prodotto non ovvia)**: valutare se il ready-check per-nomination nel Primo Mercato sia intenzionale (es. per dare tempo a tutti di vedere chi è stato chiamato prima che parta il timer) o vada allentato — es. richiedere ready-check solo alla primissima nomination della sessione, o eliminarlo del tutto lasciando solo la conferma anti-misclick del nominatore come da Bibbia.

---

### 4. Ridondanza — controlli admin duplicati nella stessa schermata

**Cosa**: durante un'asta Primo Mercato attiva, ho trovato **due pulsanti "Concludi/Chiudi asta"** e **due percorsi per "Forza Conferme"** sulla stessa pagina: uno nella cockpit bar in alto (`AdminActionsPanel`/`CockpitRailAdminBar`), uno nel pannello legacy "Controlli Admin (TEST)" aperto da un pulsante flottante, e un terzo trigger identico dentro la modale di conferma transazione stessa (`AcknowledgmentModal` con `[TEST] Forza Conferme`). Stesso pattern osservato in Rubata (`Chiudi asta` in testata + `[TEST] Forza Tutte le Conferme` dentro la modale PENDING_ACK).

**Dove**: `src/pages/AuctionRoom.tsx` (importa sia `AuctionRoomLayout` nuovo sia modali da `../components/auction-room` vecchio, come già annotato in CLAUDE.md §Problemi Noti); `src/components/auction-room/AuctionRoomModals.tsx` vs `src/components/auction-room-v2/*`.

**Perché è un problema**: è il sintomo esatto lamentato da Pietro ("c'è troppo e troppo spesso ripetuto") — non è solo estetico, genera incertezza su **quale** pulsante usare e se fanno la stessa cosa (in un caso ho cliccato per errore un "Simula ricorso" invece di "Conferma" perché i controlli test e i controlli reali convivono senza gerarchia visiva chiara, generando un ricorso reale che ho dovuto poi risolvere per continuare — vedi log di sessione). Viola CLAUDE.md §Convenzioni "Elementi grafici condivisi... mai copia-incolla divergenti" e riflette il debito tecnico già noto (`auction-room` legacy + `auction-room-v2` coesistenti).

**Proposta**: consolidare tutti i controlli "TEST"/admin in un unico pannello (quello cockpit, già presente e più coerente col tema), rimuovendo le azioni duplicate nelle modali. I controlli marcati `[TEST]` dovrebbero inoltre essere visivamente più distinti (colore diverso, sezione separata) dai controlli reali di gioco (Conferma/Ricorso) per evitare misclick come quello che ho fatto io.

---

### 5. Bug di stato — mismatch nome/quotazione nello step di conferma nomina

**Cosa**: nel flusso di ricerca-e-nomina del Primo Mercato, ho selezionato "Cavlina" (quotazione 1), poi cliccato rapidamente sul pulsante "Porta in Asta" nella stessa posizione — il click ha selezionato "Audero" (quotazione reale 14) ma lo step di conferma successivo mostrava **"AUDERO" con "QUOTAZIONE 1M"** (il valore di Cavlina, non quello di Audero). L'asta effettivamente avviata poi mostrava correttamente Audero con quotazione 14 nel pannello statistiche — quindi il dato sbagliato era transitorio/di visualizzazione nello step di conferma, non un problema sui dati salvati.

**Dove**: flusso `src/components/auction-room-v2/NominationPanel.tsx` (selezione+preview) → passaggio a stato di conferma. Non ho isolato la riga esatta per limiti di tempo, ma il sintomo è riproducibile: click veloce su un giocatore mentre la card precedente è ancora in preview può lasciare `quotation` non sincronizzato col nuovo `player` selezionato nello state locale.

**Perché è un problema**: se un manager guarda lo step di conferma e vede una quotazione inconsistente col giocatore mostrato, perde fiducia nel dato — specialmente perché la quotazione è un'informazione che guida la decisione di offerta (Assioma 6: età→ingaggio→durata→clausola→prezzo→**statistiche**, la quotazione è tra i dati usati per valutare l'affare).

**Proposta**: verificare che il componente di preview/conferma nomina derivi `quotation` dallo stesso oggetto `player` del nome mostrato (probabile causa: due pezzi di state aggiornati in momenti diversi, es. `selectedPlayer.name` e `selectedPlayer.quotation` non aggiornati atomicamente). Task per `sviluppatore`, non per questo audit.

---

### 6. Ridondanza tra pagine — StrategieRubata vs tabellone Rubata

**Cosa**: `StrategieRubata.tsx` (pagina di pianificazione pre-mercato: watchlist, categoria, `maxBid`, `priority`, note, per ogni giocatore rubabile e ogni svincolato) espone **lo stesso catalogo giocatori** con **filtri quasi identici** (ricerca nome/squadra, ruolo P/D/C/A, ecc.) a quello che poi si ritrova nel pannello "TABELLONE RUBATA" dentro la pagina Rubata live (colonna "Strategia" con badge watchlist/auto-pass/max-bid già prevista da `RUBATA.md §11.3`).

**Dove**: `src/pages/StrategieRubata.tsx` (1530 righe) vs pannello destro di `src/pages/Rubata.tsx` (tabellone con tab "Watchlist"/"Rimanenti"/"Tutti").

**Perché non è necessariamente un problema, ma va segnalato**: le due viste hanno scopi diversi (pianificazione asincrona pre-asta vs consultazione durante l'asta live) e questo è legittimo — non sto proponendo di eliminare le preferenze. Il punto è che sono **due pagine di navigazione separate** (voce di menu propria) che duplicano la stessa lista/filtri di giocatori, quando la pianificazione potrebbe vivere come **tab/modalità dentro la pagina Rubata** stessa (es. "Modalità pianificazione" prima che la fase parta, che diventa automaticamente il pannello "Strategia" del tabellone quando la fase è live) invece di una sezione di menu a parte. Riduce le voci di navigazione e il numero di posti in cui un manager deve andare a cercare le stesse informazioni — coerente con "less is more in superficie".

**Proposta (opzione, non imposizione — scelta di prodotto)**: valutare di fondere l'accesso a StrategieRubata come stato/tab della pagina Rubata (raggiungibile prima che la fase sia live, con lo stesso URL/voce di menu) invece di una voce di navigazione indipendente. Da validare con Pietro: se la pianificazione è pensata per essere consultata anche a mercato chiuso (tra una sessione e l'altra) come momento distinto, allora la pagina separata ha senso e questo finding va derubricato a "nice to have".

---

### 7. Coerenza minor — label ingaggio/durata nel box "Costo Rubata"

**Cosa**: nel box "COSTO RUBATA" della pagina Rubata live, la scomposizione mostra `7M` (etichettato "clausola") `+` `1M` (etichettato "ingaggio · 2 semestri"). La durata (`2 semestri`) è concatenata come sottotesto del box ingaggio, senza un'etichetta "Durata" a sé stante.

**Dove**: pannello centrale "SUL PIATTO" di `src/pages/Rubata.tsx` / componente scomposizione prezzo.

**Perché è un problema (minore)**: Assioma 9 ("quando si mostrano ingaggio e durata ci vogliono sempre label che li identificano") è rispettato solo parzialmente — "ingaggio" è etichettato, "2 semestri" si capisce dal contesto ma non ha un'etichetta esplicita propria (es. "Durata: 2 semestri"). Impatto basso perché il contesto (asta, box "costo") rende comunque leggibile il dato, ma è un'incongruenza minima rispetto alla regola esplicita.

**Proposta**: aggiungere micro-label "Durata" davanti a "2 semestri" nello stesso componente, per coerenza puntuale con l'Assioma.

---

### 8. Copertura di test non raggiunta — Mobile

Non sono riuscito a verificare le tre pagine in viewport mobile reale: il tool di ridimensionamento finestra disponibile in questa sessione non ha cambiato la viewport effettiva catturata (screenshot rimasti a risoluzione desktop anche dopo richieste esplicite a 390×844). Ho verificato da codice che tutte e tre le pagine hanno rami mobile dedicati (`MobileBottomBar.tsx`, `MobileSidePanel.tsx` in `auction-room-v2/`; footer espandibile per il box budget in Rubata da Bibbia §9.4; card responsive per il tabellone), coerenti con l'architettura cockpit dichiarata in CLAUDE.md ("mobile resta in flusso normale"), ma **non ho potuto confermare visivamente l'assenza di troncamenti su mobile reale** (Assioma 2) per queste tre pagine. Segnalo il gap esplicitamente: una verifica mobile dedicata (device reale o emulazione affidabile) resta da fare.

---

## Cose che funzionano bene (da non toccare)

- La **macchina a stati della Rubata** (OFFERING → AUCTION_READY_CHECK → AUCTION → PENDING_ACK, chiusura lazy del timer) rispecchia fedelmente `RUBATA.md` — verificato con un'asta reale, incluso il blocco del proprietario ("Sei il proprietario — non puoi rilanciare") e la scomposizione prezzo (clausola + ingaggio) esposta con chiarezza superiore alla media di settore (Hattrick/FM raramente mostrano la scomposizione del prezzo così esplicitamente — buon punto di forza da preservare).
- Il **sistema Ricorsi** (dichiarazione, review admin, ack di tutti i manager, ripresa asta) funziona end-to-end come documentato in `RICORSI.md`/`RUBATA.md §6`, testato accidentalmente ma con successo durante questa sessione.
- Il vincolo "niente slot per ruolo fuori dal Primo Mercato" (Bibbie RUBATA §4.0, SVINCOLATI §1.2) è rispettato nella UI: durante Rubata/Svincolati non ho visto indicatori "slot pieni/liberi", solo conteggio giocatori — commit `7e42e8e` già lo aveva sistemato.
- `complete-all-slots` e gli altri strumenti `[TEST]` dell'admin panel sono esattamente ciò che serve per testare rapidamente: buona scelta di prodotto per un ambiente di sviluppo/QA (da tenere sotto flag ambiente, vedi finding cluster 6 sull'assenza di un gate `import.meta.env`).

---

## Proposte prioritizzate

| # | Proposta | Impatto | Sforzo | Nota |
|---|----------|---------|--------|------|
| 1 | Precompilare ordine Svincolati con l'inverso di `rubataOrder` | Alto | S | Bug di conformità Bibbia, non solo UX — `useSvincolatiState.ts:257-293` |
| 2 | Fix overflow-x su testate/admin-bar cockpit a 1366–1440px | Alto | S–M | Blocca controlli critici durante asta live |
| 3 | Consolidare controlli admin/test duplicati (Concludi asta / Forza Conferme) in un solo pannello | Medio-Alto | M | Riduce rischio di misclick tra test e azioni reali |
| 4 | Rivedere ready-check per-nomination nel Primo Mercato (verificare con Pietro se intenzionale) | Alto (se confermato attrito reale) | M | Richiede decisione di prodotto, non solo fix |
| 5 | Fix mismatch nome/quotazione nello step di conferma nomina | Basso-Medio | S | Bug isolato, probabile race di state locale |
| 6 | Etichetta esplicita "Durata" nel box Costo Rubata | Basso | S | Coerenza puntuale con Assioma 9 |
| 7 | Valutare fusione StrategieRubata come tab dentro Rubata invece di pagina/voce menu separata | Medio | M–L | Scelta di prodotto, da validare con Pietro |
| 8 | Verifica mobile reale delle tre pagine (gap di questo audit) | Alto (ignoto) | — | Da programmare come follow-up dedicato |

---

## Stato finale ambiente di test

"Lega finale" (`cmsw06f4j005cops4khomjrsl`) è ora attiva, 8/8 manager, in fase **ASTA_SVINCOLATI** con ordine turni impostato e cockpit funzionante (turno di Mirko). Nessuna asta pendente lasciata a metà. La lega è utilizzabile da altri agenti/da Pietro per proseguire i test sulla fase Svincolati senza dover rifare il setup.
