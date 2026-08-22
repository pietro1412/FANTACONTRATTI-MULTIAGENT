# Audit Cluster 5 — Storico & Extra (Storico/Movimenti, Profezie, Feedback)

Data: 2026-08-21
Perimetro: `History.tsx` (+ `components/history/*`), `Prophecies.tsx`, `FeedbackHub.tsx`, e — per necessità emersa durante il test — `Movements.tsx` (pagina "Storico Movimenti", stesso dominio funzionale).
Metodo: lettura codice (pagine, componenti, service, routing) + verifica live nel browser su **Lega Test** (`cms7tw7c600are3d5quvxe0g7`) e **Fantacontratti Test** (`cmr7hitxq000914junocbrhtv`), login `pietro@test.it`, azioni reali eseguite (profezia pubblicata, segnalazione feedback inviata).

---

## Sintesi esecutiva (i problemi a più alto impatto)

1. **Tre implementazioni diverse per lo stesso concetto "storico dei movimenti"** — `History.tsx` (nav "Storico"), la sua `TimelineView`, e una pagina *separata* `Movements.tsx` (titolo letterale **"Storico Movimenti"**, non presente nel menu desktop) mostrano la stessa tabella di movimenti con tre design e tre implementazioni scollegate. È l'esempio più diretto della sensazione "c'è troppo e troppo spesso ripetuto".
2. **Bug di performance reale e verificato**: la pagina Movimenti spara ~100 chiamate `GET .../can-prophecy` in parallelo al semplice caricamento (una per ogni riga visibile), causando jank e — con ogni probabilità — gli scroll-jump/corruzioni visive osservate scrivendo una profezia.
3. **Redundancy Assioma 8**: la "Carriera Lega" del giocatore è presentata in *due* punti con *due* UI diverse — `PlayerCareerPanel` dentro Storico (ricerca dedicata) e il tab "Carriera Lega" di `PlayerStatsModal` (raggiungibile da ogni nome cliccabile, come vuole l'Assioma 7/8) — stessa API, stessa forma dei dati, resa graficamente due volte.
4. **Assioma 5 non implementato**: nessuna aggregazione "per stagione sportiva" nello Storico, né lato UI né lato backend (`history.service.ts`).
5. **Storico è rimasto indietro nel rework grafico**: `History.tsx` non usa `CockpitShell` né il linguaggio tipografico/colore ufficiale già adottato da `Prophecies.tsx` (stesso cluster) — porta con sé colori Tailwind grezzi e problemi di overflow orizzontale su desktop non ultra-wide, assenti nelle pagine già migrate.

---

## Findings per dimensione

### 1. Ridondanza — "Storico" vs "Storico Movimenti" (massimo impatto)

**Cosa**: esistono due pagine distinte che raccontano gli stessi movimenti di mercato:
- `src/pages/History.tsx` → tab "Per Sessione" (`SessionView`/`SessionCard`, con sotto-tab Riepilogo/Aste/Scambi/Premi/Rubata/Svincolati) e tab "Timeline" (`TimelineView`, tabella cronologica).
- `src/pages/Movements.tsx` → pagina **separata**, raggiunta da `/leagues/:id/movements`, con **titolo in pagina "Storico Movimenti"**, filtri per tipo/semestre/data, e compositore di profezie inline.

**Dove**: `src/pages/History.tsx`, `src/components/history/TimelineView.tsx`, `src/pages/Movements.tsx`.

**Perché è un problema**: `Movements.tsx` **non compare nella Navigation desktop** (verificato: la barra "Dashboard · Admin · Rose · Giocatori · Scambi · Contratti · Finanze · Premi · Storico · Profezie · Feedback" non ha una voce "Movimenti"), ma è raggiungibile dal widget "Movimenti recenti" della Dashboard lega (`RecentMovements.tsx`), dalla `BottomNavBar` mobile e dalla Command Palette. Il risultato: un manager su desktop trova "Storico" nel menu e non sospetta che esista una seconda pagina, quasi omonima ("Storico Movimenti"), con dati sovrapposti ma un layout completamente diverso (colori a token, colonne proporzionate "Ing/Dur" con label — più curata della vecchia `TimelineView`). Chi la trova per caso da mobile o dal widget vive un'esperienza incoerente con "Storico" del menu.

**Verificato live**: navigando `/leagues/cms7tw7c600are3d5quvxe0g7/movements` la pagina si apre con header "📄 Storico Movimenti · Stagione 25/26 · 100 mov." — stessa lega, stessi identici movimenti già visibili in "Storico › Timeline", solo con grafica e colonne diverse (qui rispetta correttamente l'Assioma 9: "Ing 1M · Dur 3 s" con label, cosa che `TimelineView` non fa perché non mostra affatto ingaggio/durata).

**Benchmark**: Football Manager e Hattrick tengono un solo "log" storico coerente (con eventuale drill-down), non due sistemi paralleli con la stessa funzione.

**Proposta**: unificare. O (a) far diventare `Movements.tsx` la vista "Timeline" dentro `History.tsx` (è oggettivamente più curata e ha il compositore di profezie, che oggi manca del tutto in Storico), rimuovendo la vecchia `TimelineView.tsx`; oppure (b) rinominare esplicitamente le due pagine per differenziarne lo scopo (es. "Storico" = solo sessioni/riepiloghi per fase, "Movimenti" = log continuo con profezie) e aggiungerle *entrambe* al menu con etichette che non collidano. La opzione (a) è preferibile in ottica less-is-more: una sola fonte per il log dei movimenti.

---

### 2. Bug di performance verificato — N+1 su `can-prophecy`

**Cosa**: al caricamento di `/leagues/:id/movements`, il codice invoca `movementApi.canMakeProphecy(movement.id)` per **ogni** movimento caricato in pagina (fino a 100), non in modo lazy/on-demand alla singola riga.

**Dove**: `src/pages/Movements.tsx` righe ~124-133 (loop di eleggibilità profezia eseguito su tutto l'array `movements` al load).

**Verificato live**: ho intercettato il traffico di rete (`read_network_requests`, filtro `prophec`) e contato **202 richieste** (100 `GET can-prophecy` + 100 `OPTIONS` di preflight CORS) generate dal solo caricamento della pagina con 100 movimenti in "Lega Test".

**Perché è un problema**: oltre al carico inutile sul backend (moltiplicato per ogni manager che apre la pagina), ho osservato — riproducendolo **3 volte in modo indipendente** — che scrivere/impostare il testo nel campo "Scrivi una profezia..." causa un salto di scroll violento con un'area bianca vuota in alto e la testata di navigazione che si "stacca" a metà pagina. Il fenomeno si presenta sia digitando a tastiera sia impostando il valore via `form_input` (bypassando la tastiera), quindi non è un problema di focus ma di **re-render pesante** — molto probabilmente la combinazione tra la lista di 100 righe non virtualizzata, l'autoresize della textarea e il carico delle ~100 richieste XHR in corso.

**Impatto per il manager**: la funzione di "scrivere una profezia" — che è un elemento di intrattenimento chiave della piattaforma — risulta visivamente rotta durante l'uso, pur funzionando (la profezia di test è stata effettivamente pubblicata e verificata poi nell'archivio "Profezie").

**Proposta**: (1) rendere `canMakeProphecy` lazy — chiamarlo solo quando l'utente espande la riga di un movimento, non per tutti e 100 al load; oppure (2) restituire l'eleggibilità già dentro la risposta di `GET movements` (batch, zero round-trip aggiuntivi); (3) paginare/virtualizzare la lista di movimenti invece di renderizzare 100 righe intere.

---

### 3. Redundancy — Carriera giocatore mostrata due volte (Assioma 7/8)

**Cosa**: `PlayerCareerPanel` (dentro `History.tsx`, attivato dalla propria ricerca giocatore "Cerca giocatore...") e il tab "Carriera Lega" di `PlayerStatsModal` (attivato cliccando il nome di un giocatore ovunque nell'app, come impone l'Assioma 7) mostrano **esattamente gli stessi dati** — stessa API `historyApi.getPlayerCareer(leagueId, playerId)` — con **due presentazioni grafiche completamente diverse**.

**Dove**: `src/components/history/PlayerCareerPanel.tsx` (pannello grande, 5 tile statistiche, timeline verticale con icone) vs `src/components/PlayerStatsModal.tsx` righe 354-440 (tab compatto: box "Proprietario attuale/Contratto", tabella DA/A/Movimento/Prezzo, chip squadre).

**Verificato live**: cliccando "Benedyczak" nella Timeline di Storico si apre `PlayerStatsModal` con tab "Carriera Lega" — versione compatta e ben leggibile. Cercando lo stesso giocatore dalla barra di ricerca di `History.tsx` si apre `PlayerCareerPanel` — versione enorme, con timeline a icone, per la stessa identica informazione (Contratto 1M/3a RC:9M, 1 movimento, 1 acquisto, 10M valore totale).

**Perché è un problema**: due UI per lo stesso dato, mai riconciliate, sono esattamente il tipo di ripetizione percepita da Pietro. Inoltre `PlayerCareerPanel` **duplica una funzione che l'Assioma 7 già garantisce ovunque** (nome sempre cliccabile → modale) — la sua ricerca dedicata in cima a Storico è quindi ridondante rispetto al comportamento standard dell'app.

**Proposta**: eliminare `PlayerCareerPanel` e la ricerca giocatore dedicata di `History.tsx`; il flusso "voglio vedere la carriera di un giocatore" resta unico e coerente: clic sul nome → `PlayerStatsModal` → tab "Carriera Lega" (già presente ovunque, incluse le righe della Timeline). Risparmio netto di un intero componente e di una barra di ricerca duplicata in superficie.

---

### 4. Assioma 5 — Nessuna aggregazione per stagione sportiva

**Cosa**: l'assioma richiede che "nei totali dello storico le stagioni vanno aggregate per stagione sportiva (es. 2025-2026, 2026-2027)". Nello stato attuale **non esiste alcun totale aggregato per stagione**, né in UI né in backend.

**Dove**:
- `src/services/history.service.ts`, funzione `getSessionsOverview` (righe 37-80): la query Prisma raggruppa/ordina per `season`+`createdAt` ma non produce mai un aggregato per "coppia di semestri" (stagione sportiva) — ogni `MarketSession` (un singolo semestre) resta un record indipendente.
- `src/components/history/SessionView.tsx`/`SessionCard.tsx`: elencano le sessioni una per una (card espandibile), mai un riepilogo "Stagione 2025-2026: X aste, Y scambi, Z€ spesi" che accorpi Primo Mercato + 1° e 2° semestre.
- `src/components/history/TimelineView.tsx` e `src/pages/Movements.tsx`: filtrano per singola sessione (`<select>`/`filterSemester`), mai per stagione intera.

**Verificato live**: in "Lega Test" c'è solo "Primo Mercato 1/2" (in corso); in "Fantacontratti Test" solo "Mercato Ricorrente 2025/26 Secondo Semestre" — nessuna delle due leghe di test aveva più stagioni sportive complete da verificare visivamente, ma il codice conferma comunque l'assenza del meccanismo di aggregazione a prescindere dai dati disponibili.

**Proposta**: aggiungere, sopra l'elenco delle sessioni in `SessionView`, un raggruppamento per stagione sportiva (es. header collassabile "2025-2026" che raccoglie Primo Mercato + entrambi i semestri con i totali sommati: aste, scambi, movimenti, speso totale). È un lavoro sia di query (raggruppare `season` in "stagioni", ricordando che i due semestri sono a cavallo dell'anno solare) sia di UI.

---

### 5. Incoerenza visiva — Storico non ha ricevuto il rework grafico (Assioma 4 + convenzioni tema)

**Cosa**: `Prophecies.tsx`, nello stesso cluster "Storico & extra", è stata migrata al pattern cockpit (`CockpitShell`, header con `micro-label`, `stat-number`, chip a pillola, colori-token `primary/secondary/accent/danger`) — coerente con quanto richiesto da CLAUDE.md. `History.tsx` e i suoi componenti (`SessionCard.tsx`, `TimelineView.tsx`, `PlayerCareerPanel.tsx`) sono rimasti al linguaggio grafico precedente:

- Colori Tailwind **grezzi**, non token del tema: `text-yellow-400`, `text-red-400`, `text-green-400`, `text-blue-400`, `text-purple-400`, `text-cyan-400`/`text-cyan-300`, `text-orange-400`, `bg-green-500/20` ecc. — oltre 20 occorrenze in `TimelineView.tsx` e `SessionCard.tsx` (es. `SessionCard.tsx:404,451,459,668,706,709,743` e `TimelineView.tsx:54-66`). CLAUDE.md vieta esplicitamente `slate-*` e richiede token `primary/secondary/accent/danger` per gli accenti semantici — qui il principio non è rispettato neanche con colori non-`slate`.
- Nessun `font-display`/`micro-label`/`stat-number`: titoli e numeri usano classi generiche (`font-bold text-white`, `text-2xl font-bold`).
- CLAUDE.md, sezione Stili, elenca esplicitamente la roadmap del pattern cockpit: *"poi Scambi, Rose, Storico…"* — conferma che Storico è un rework **noto e pianificato ma non ancora eseguito**, non una svista silenziosa.

**Perché è un problema**: dentro lo stesso cluster funzionale (voci di menu adiacenti "Storico" e "Profezie"), il manager percepisce due prodotti diversi — uno curato, uno "vecchio stile" — il che aggrava proprio la sensazione di incoerenza/ripetizione lamentata.

**Proposta**: portare `History.tsx` al pattern cockpit riusando i componenti condivisi già esistenti (`PanelTabs`, `Monogram`, token colore `CHART_COLORS`/semantici) — idealmente in combinazione con la fusione proposta al punto 1 (assorbire `Movements.tsx`, che già usa palette più moderna, come base).

---

### 6. Overflow orizzontale su desktop non ultra-wide (corollario Assioma 2)

**Cosa**: `History.tsx` e `Movements.tsx` usano solo `max-w-[1600px] mx-auto` senza il contenimento `overflow-x-hidden`/`min-w-0 max-w-full` che `CockpitShell` garantisce alle pagine già migrate.

**Verificato live**, riprodotto **due volte in modo indipendente** a viewport 1425px (finestra desktop realistica, non ultra-wide):
- In Storico → Timeline, cercando un giocatore dal box "Cerca giocatore...", il risultato del dropdown appare **tagliato a destra** (il nome della squadra proprietaria è invisibile) e, selezionandolo, **l'intera pagina scorre orizzontalmente** lasciando il logo/testata tagliati a sinistra — lo scroll orizzontale **resta persistente** anche dopo la chiusura del dropdown (bug riprodotto identico in due sessioni di navigazione separate).
- In Movimenti (`Movements.tsx`), il pulsante "Pubblica" del compositore di profezie è **parzialmente fuori dal viewport** a questa risoluzione (visibile solo "Pubb…").

**Perché è un problema**: viola lo spirito dell'Assioma 2 (corollario anti-overflow-x già codificato in `CockpitShell` per le altre pagine) — un manager con un laptop da 13-14" (risoluzioni tipiche 1366-1440px) sperimenta esattamente questi tagli.

**Proposta**: la fix è "gratuita" migrando `History.tsx`/`Movements.tsx` a `CockpitShell` (punto 5) — il contenimento orizzontale arriva di default.

---

### 7. Bug minore — stringa enum grezza nella Carriera Lega dello Storico

**Cosa**: nel timeline di `PlayerCareerPanel`, l'etichetta della sessione è mostrata come stringa tecnica grezza, es. **"PRIMO_MERCATO S1"**, invece di un'etichetta umana come "Primo Mercato 25/26".

**Dove**: `src/services/history.service.ts:1273-1275`:
```ts
session: m.marketSession
  ? `${m.marketSession.type} S${m.marketSession.season}`
  : null,
```
mentre poche righe sopra (1132-1138, funzione `getTimeline`) lo stesso dato viene restituito come oggetto strutturato `{ type, season, semester }` e formattato correttamente lato client in `TimelineView.tsx` ("Primo Mercato 25/26").

**Verificato live**: aprendo la carriera di "Benedyczak" dalla ricerca di Storico, la riga di cronologia mostra letteralmente "PRIMO_MERCATO S1".

**Proposta**: allineare `getPlayerCareer` allo stesso pattern di `getTimeline` — restituire l'oggetto sessione strutturato e formattarlo lato client (o centralizzare la funzione di formattazione, oggi duplicata in almeno 3 punti: `History.tsx`, `TimelineView.tsx`, `PlayerCareerPanel.tsx`).

---

### 8. Assioma 2 — colonne che spariscono su mobile senza alternativa (rischio da codice, non verificato visivamente)

**Cosa**: `TimelineView.tsx` nasconde le colonne "Sessione" (`hidden sm:table-cell`), "Da"/"A" (`hidden md:table-cell`) su schermi stretti, **senza alcuna vista alternativa** (card espansa) che restituisca quei dati su mobile.

**Confronto positivo**: `Movements.tsx` gestisce correttamente lo stesso problema con **due render separati e completi**: una vista a card `md:hidden` (righe ~375+) con tutti i dati, e una tabella `hidden md:block` per desktop (riga 512) — nessun dato viene nascosto, solo riorganizzato. `Prophecies.tsx` fa lo stesso con la sua "Vista Espansa" (card) che mostra tutti i campi altrimenti nascosti nella tabella compatta.

**Perché è un problema potenziale**: su mobile, un manager che consulta Storico → Timeline perde la visibilità di chi ha ceduto/ricevuto un giocatore (colonne "Da"/"A") e della sessione di riferimento, senza un modo per recuperarle — diversamente da `Movements.tsx` e `Prophecies.tsx` che sullo stesso tipo di dato non tagliano nulla.

**Nota metodologica**: non sono riuscito a validare questo punto con uno screenshot mobile reale in questa sessione (il resize del viewport della finestra Chrome condivisa con gli altri agenti del cluster non si è riflesso nello strumento di screenshot, e ho preferito non insistere con resize ripetuti su una finestra condivisa per non disturbare il lavoro parallelo). Segnalo il rischio a livello di codice; andrebbe confermato con un test manuale mobile reale.

**Proposta**: se confermato, allineare `TimelineView.tsx` allo stesso pattern dual-layout già usato in `Movements.tsx`/`Prophecies.tsx` — ulteriore motivo per l'unificazione proposta al punto 1.

---

### 9. Cose che funzionano bene (da non toccare)

- **Prophecies.tsx**: ben progettata, rispetta il pattern cockpit, i token colore, l'Assioma 7 (nomi cliccabili → modale) e offre due viste (compatta/espansa) coerenti con "less is more + profondità per gli appassionati". Il flusso di scrittura profezia (reale, in `Movements.tsx`) → verifica in archivio (`Profezie`) funziona end-to-end: ho pubblicato **"Audit Cluster5 - test: Okereke sarà la sorpresa della stagione per Pietro"** su Okereke (Lega Test) e l'ho visto comparire correttamente nell'archivio con autore, ruolo "Acquirente", evento "Primo Mercato", prezzo 2M.
- **FeedbackHub.tsx**: modale di segnalazione pulita, categorie chiare (Problema/Suggerimento/Domanda/Altro), contatore caratteri, nessun problema di overflow riscontrato. Ho inviato una segnalazione reale di test — titolo **"Audit Cluster5 - test"**, categoria "Problema/Bug" — verificata comparire subito in "Le mie Segnalazioni" con stato "Aperta".
- La tabella di `Movements.tsx` rispetta bene l'Assioma 9 (label esplicite "Ing"/"Dur") e l'Assioma 1 (colonne proporzionate) meglio della vecchia Timeline di Storico.

---

## Proposte prioritizzate

| # | Proposta | Impatto | Sforzo | Note |
|---|----------|---------|--------|------|
| 1 | Unificare "Storico" e "Storico Movimenti" in un'unica pagina/flusso (assorbire `Movements.tsx` come vista Timeline di `History.tsx`, rimuovere la vecchia `TimelineView`) | **Alto** | **L** | Tocca routing, nav, `BottomNavBar`, widget dashboard. Da pianificare con Pietro (impatta anche dove vive il compositore di profezie). |
| 2 | Fix N+1 `can-prophecy` (lazy on-demand o batch nella response di `getMovements`) | **Alto** | **S** | Bug puntuale, isolato in `Movements.tsx`/endpoint movements; alto impatto percepito (l'azione "scrivi profezia" sembra rotta). |
| 3 | Rimuovere `PlayerCareerPanel` + ricerca giocatore dedicata da `History.tsx`, lasciare solo `PlayerStatsModal` → tab Carriera Lega come unico punto di accesso | **Alto** | **S** | Coerente con Assioma 7/8 già implementato altrove; puro "togliere". |
| 4 | Migrare `History.tsx` (e sotto-componenti) al pattern cockpit + token colore | **Medio** | **M** | Risolve anche il punto 6 (overflow-x) gratuitamente. Da fare insieme al punto 1 se possibile (evita doppio lavoro). |
| 5 | Aggiungere aggregazione per stagione sportiva (Assioma 5) | **Medio** | **M** | Richiede logica di raggruppamento season→stagione sportiva sia in `history.service.ts` sia in `SessionView`. |
| 6 | Fix label "PRIMO_MERCATO S1" → formattazione umana in `getPlayerCareer` | **Basso** | **S** | One-liner, centralizzare la funzione di formattazione sessione già duplicata 3 volte. |
| 7 | Verificare/allineare mobile della Timeline (dual-layout come `Movements.tsx`) | **Medio** | **S/M** | Da confermare prima con test manuale mobile reale; se confermato, si risolve naturalmente unendo con punto 1. |

---

## Mockup

Non ho prodotto mockup HTML per questo cluster: gli interventi a più alto impatto (unificazione pagine, fix N+1, rimozione pannello duplicato) sono principalmente di **architettura dell'informazione e ingegneria**, non di ridisegno visivo puntuale — un mockup statico non avrebbe aggiunto informazione utile oltre a quanto già visibile confrontando live `Storico` (`/history`) e `Storico Movimenti` (`/movements`) nella app stessa. Per il punto 4 (migrazione cockpit di Storico), il riferimento visivo corretto è già il mockup esistente `docs/reviews/mockups/05-allineamento-asta-rubata/cockpit.html` più l'implementazione live di `Prophecies.tsx`, che nel medesimo cluster funge già da esempio applicato.

---

## Azioni reali eseguite in questa sessione (per la traccia di audit)

- Login `pietro@test.it` / `Pietro2025!`.
- Navigazione Storico (Per Sessione + Timeline) su **Lega Test** e **Fantacontratti Test**.
- Apertura carriera giocatore da ricerca dedicata di Storico (Benedyczak) e da nome cliccabile in Timeline → confronto diretto delle due UI.
- Navigazione alla pagina `Movements.tsx` (non in nav desktop), scoperta e verifica della ridondanza.
- **Pubblicazione reale di una profezia di test** su Okereke (Lega Test): *"Audit Cluster5 - test: Okereke sarà la sorpresa della stagione per Pietro."* — verificata nell'archivio Profezie.
- **Invio reale di una segnalazione di test** in Feedback Hub: titolo *"Audit Cluster5 - test"*, categoria Problema/Bug — verificata in "Le mie Segnalazioni" (stato: Aperta).
- Ispezione rete (`read_network_requests`) durante l'uso del compositore di profezie → scoperta del bug N+1.
- Nessuna modifica alla lega "Fantacontratti Ufficiale", nessuna modifica a `src/`.
