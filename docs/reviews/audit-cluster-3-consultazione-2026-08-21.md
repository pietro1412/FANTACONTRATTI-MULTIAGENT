# Audit Cluster 3 — Fasi di consultazione (Contratti · Scambi · Premi · Finanze)

> Data: 2026-08-21
> Ambiente: dev locale (`localhost:5174` + API `:3003`, DB Docker), browser automation (Claude in Chrome) + lettura codice sorgente.
> Leghe usate: **Lega Test** (`cms7tw7c600are3d5quvxe0g7`, fase CONTRATTI) e **Fantacontratti Test** (`cmr7hitxq000914junocbrhtv`, fase OFFERTE_PRE_RINNOVO).
> Nessuna lega disponibile in fase PREMI: la sezione Premi è stata verificata **solo da codice** (vedi §Premi).

---

## Sintesi esecutiva (i problemi a più alto impatto)

1. **Il Residuo/Budget/Ingaggi di Contratti è mostrato due volte nello stesso schermo** — testata cockpit *e* card sidebar "Residuo dopo consolidamento" ripetono le stesse 4 cifre in tempo reale (verificato live: dopo un rinnovo, entrambe le posizioni sono passate da 37M→39M ingaggi e +231M→+229M residuo in modo identico).
2. **Anche in Finanze (Panoramica) lo stesso numero appare due volte a pochi pixel di distanza** — `MyTeamHero` mostra già "Budget totale" e "Monte ingaggi" come statistiche primarie, e la sezione "La lega in numeri" subito sotto ripete gli stessi due valori come nota (`il tuo: {budget}M`, `il tuo: {ingaggi}M/anno`) sulla stessa pagina, stesso tab.
3. **Doppia implementazione delle regole di rinnovo contratto**: `src/components/contracts/renewal-logic.ts` + `Stepper.tsx` (usati da Contratti) e `src/components/ContractModifier.tsx` (usato da Trades, Rubata, Svincolati, AuctionRoom) reimplementano *da zero* — con `DURATION_MULTIPLIERS` duplicato e stepper +/- ridisegnato — le stesse regole di CONTRATTI.md (max 4 semestri, no diminuzione, spalma). Rischio concreto di divergenza silenziosa se la regola cambia in futuro (Assioma 4 violato, non solo esteticamente).
4. **Composizione rosa / Ingaggi rosa ripetuti nella sidebar di Contratti** duplicano dati già nella testata (Slot, Ingaggi) senza aggiungere lettura nuova nella maggior parte dei casi.
5. **Gap di verifica**: nessuna lega di test è in fase PREMI, quindi il flusso reale (assegnazione premi/indennizzi, consolidamento) non è stato testato end-to-end in questo audit — solo letto da codice. Raccomando un giro di test dedicato quando una lega raggiungerà quella fase.

---

## Findings per dimensione

### 1. Gerarchia informativa (Assioma 6)

**Contratti (`src/pages/Contracts.tsx`, righe 859–881, tabella rinnovi)**
Ordine colonne: Giocatore → Ingaggio attuale → Durata attuale → Ingaggio rinnovo → Durata rinnovo → Clausola → Rubata → Azione. Rispetta l'ordine ruolo→nome→...→clausola→prezzo rubata previsto dall'Assioma 6 (ruolo e squadra sono dentro `PlayerCell`, verificato che nome è sempre a sinistra con badge ruolo).  **Conforme.**

**Scambi — Tavolo dello scambio (`DealTable`)**
Verificato live: creando un'offerta, il nome giocatore/manager è ben in vista, ma per selezione **crediti** (budget puro) non ci sono giocatori — l'assioma 6 non si applica a quel ramo, corretto.

Nessuna violazione grave della gerarchia informativa rilevata in questo cluster.

### 2. Navigazione e Information Architecture

**Finanze (`src/pages/LeagueFinancials.tsx`)** è l'esempio migliore del cluster: 3 tab espliciti (Panoramica → Squadre → Movimenti) più un **drill-down di 4° livello** (`TeamFinanceDetail`, dietro click su una squadra). Questo è esattamente il pattern "poche cose in superficie, profondità sotto" richiesto dall'Assioma 3 e dal principio less-is-more del brief. Da usare come riferimento per altre pagine dense (Contratti, Scambi).

**Contratti**: le 3 tab "Rinnovi / Nuovi / Usciti" (righe 688–692) selezionano automaticamente la tab più urgente al primo caricamento (nuovi contratti da impostare > usciti da decidere > rinnovi) — buon pattern di orientamento "cosa devo fare ora", coerente col benchmark Football Manager (inbox di decisioni).

**Scambi**: verificato live che il pulsante "Invia offerta" esiste **due volte nel DOM** nello stesso momento — `ref_134` "Invia offerta a Michele" (desktop, dentro `DealTable`) e `ref_213` "Invia Offerta" (mobile, `DealMobileFooter`, riga 826 di `Trades.tsx`). Non è un bug visibile (il footer mobile è nascosto su desktop via CSS), ma la label testuale diverge tra le due istanze dello stesso CTA (`"Invia offerta a Michele"` vs `"Invia Offerta"`) — piccola incoerenza da allineare quando si toccano questi file.

### 3. Progressive disclosure

**Positivo**: Contratti nasconde clausola/rubata dietro tooltip `InfoTooltip` per i termini di dominio (Glossario condiviso `GLOSSARY`), e la sezione "Regole rinnovi contratti" è collassata di default su mobile (righe 1057–1070) — buona applicazione del principio.

**Da migliorare**: nella pagina Contratti, la sidebar (righe 793–856) mostra **4 card sempre aperte** in parallelo alla testata cockpit sempre visibile: "Residuo dopo consolidamento", "Per consolidare" (checklist), "Composizione rosa", "Ingaggi rosa" (min/max/media/totale). Su desktop questo significa che l'utente vede contemporaneamente: testata (Slot/Budget/Ingaggi/Residuo) + adminBar/gate + 4 card sidebar, quasi tutte derivate dagli stessi 3-4 numeri di base (budget, ingaggi, slot). Non è nascosto nulla dietro un tap — è tutto in superficie, il contrario del principio "less is more in superficie".

### 4. Coerenza (componenti condivisi vs copia-incolla)

**Trovato codice**: `src/components/ContractModifier.tsx` (414 righe) reimplementa in proprio:
- `DURATION_MULTIPLIERS` (righe 5–10) — già definito ed esportato da `src/components/contracts/shared.tsx` e riusato da `renewal-logic.ts`.
- `isValidModification()` (righe 18–89) — logica di validazione rinnovo/spalma/aumento-obbligatorio che duplica (con varianti `isSvincolatiMode`/`increaseOnly`) `getRenewalConstraints()` in `src/components/contracts/renewal-logic.ts`.
- Uno stepper +/- disegnato a mano (righe 260–304, bottoni quadrati `rounded-l-lg`/`rounded-r-lg`, bordo `border-primary-500/30`) invece di riusare `src/components/contracts/Stepper.tsx` (pillola dorata/primaria usata in `RenewalItem.tsx`).

`ContractModifier` è importato da **4 pagine diverse**: `AuctionRoom.tsx`, `Rubata.tsx`, `Svincolati.tsx`, `Trades.tsx` (verificato via grep). È quindi il componente più riusato per "modifica contratto dopo acquisizione", ma vive completamente disaccoppiato dal componente usato nella fase CONTRATTI vera e propria. Le regole sono equivalenti oggi (stessa Bibbia), ma **due fonti di verità nel codice per la stessa regola di dominio** è esattamente il tipo di rischio che l'Assioma 4 ("elementi grafici condivisi... mai copia-incolla divergenti") vuole evitare — qui il problema è anche funzionale, non solo grafico.

**Positivo**: `InfoTooltip` + `GLOSSARY` sono condivisi e usati coerentemente in Contratti, Scambi e Finanze per gli stessi termini (Budget, Monte Ingaggi, Durata, Clausola, Prezzo Rubata) — buona applicazione del pattern "stesso componente per lo stesso concetto".

**Trade history**: verificato live che la tab "Concluse" ha i filtri "Tutte/Accettate/Rifiutate/Decadute/Annullate" ma le singole righe (`TradeOfferCard variant="history"`) non mostravano uno stato badge visibile nella viewport catturata — da verificare se il badge di stato è solo scrollato fuori vista o effettivamente assente (non ho potuto isolare la causa con certezza in questa sessione per limiti del viewport condiviso — vedi nota metodologica in fondo).

### 5. Densità contestuale

Contratti e Scambi usano correttamente il pattern cockpit (`CockpitShell`, viewport bloccato su desktop, `panel-scroll` per lo scroll interno) — coerente con CLAUDE.md. Finanze **non** è cockpit, come previsto dalla precisazione d'ambito in CLAUDE.md (pagina di sola lettura ragionata) — corretto.

### 6. Ridondanza (il tema centrale richiesto da Pietro)

Questo è il finding più rilevante del cluster, con **due istanze verificate live/codice** dello stesso pattern:

**A. Contratti — stesso numero, stesso schermo, due riquadri**
- Testata cockpit (`Contracts.tsx` righe 653–683): Slot, Budget, Ingaggi, Residuo.
- Sidebar, card "Residuo dopo consolidamento" (righe 793–810): Budget, − Ingaggi annui, + Recupero tagli, − Indennizzi, Residuo.
Ho verificato **live** che sono sincronizzati byte-per-byte: incrementando l'ingaggio di un giocatore (Britschgi, Lega Test) di +2M, sia la testata sia la sidebar sono passate insieme da 37M→39M (ingaggi) e da +231M→+229M (residuo). I due riquadri raccontano la stessa cosa con parole diverse ("Residuo" vs "Residuo dopo consolidamento") a ~150px di distanza verticale.
- In più, sidebar "Composizione rosa · 25/29" (riga 826) ripete lo stesso "25/29" già in testata come "Slot 25/29" (riga 657), e "Ingaggi rosa" (min/max/media/totale, righe 846–854) ripete concettualmente "Ingaggi 39M" della testata scomponendolo in statistiche aggiuntive — questo caso è meno grave perché aggiunge informazione (min/max/media), ma il totale è comunque il quarto posto dove compare la stessa cifra.

**B. Finanze Panoramica — stesso pattern**
`FinanceDashboard.tsx`: `MyTeamHero` (righe 74–103 di `MyTeamHero.tsx`) mostra già "Budget totale" e "Monte ingaggi" come statistiche grandi con rank/contesto. Subito sotto, la sezione "La lega in numeri" (righe 68–99 di `FinanceDashboard.tsx`) mostra "Budget medio per squadra" e "Monte ingaggi medio" con nota `il tuo: {budget}M` / `il tuo: {ingaggi}M/anno` — **stessi due numeri**, seconda volta, undici righe di codice più sotto nello stesso file.

**C. Budget/Ingaggi ripetuti tra pagine diverse (Contratti/Scambi/Finanze)** — verificato: ogni pagina ha la propria testata con Budget e Monte Ingaggi. Questo è **normale e atteso** (orientamento cross-pagina, l'utente potrebbe atterrare su una qualsiasi di queste da un link diretto) e **non lo classifico come problema** — la vera criticità è la ripetizione A e B, cioè *nello stesso schermo/tab*, non tra pagine diverse.

---

## Verifiche funzionali eseguite (azioni reali)

### Contratti (Lega Test, ADMIN Pietro)
- Caricamento pagina: Slot 25/29, Budget 268M, Ingaggi 37M, Residuo +231M. Coerente con `RESIDUO = Budget − Ingaggi − Tagli + Indennizzi` di CONTRATTI.md §8.4.
- **Rinnovo con stepper**: Britschgi 1M×3s → 3M×3s (click doppio su "+" ingaggio). Effetto osservato: Ingaggi 37M→39M, Residuo +231M→+229M, clausola ricalcolata 9M→27M, prezzo rubata 10M→30M, tag "RIALZO" comparso. **Coerente con la regola "il rinnovo NON scala il budget, solo il monte ingaggi" (CONTRATTI.md §6.1)** — nessun bug trovato, anzi buona conferma della correttezza del motore.
- **Salva bozza**: cliccato, risposta "bozza salvata 15:15" e badge "da salvare" sparito. Draft persistito correttamente (i valori sono rimasti dopo il salvataggio). **Non è stato premuto "Consolida"**, come da istruzioni (azione irreversibile per tutta la lega).
- Non ho potuto verificare in modo affidabile la visualizzazione mobile via resize del browser: la finestra Chrome è condivisa con altri agenti dell'audit in esecuzione in parallelo (tab multiple sullo stesso `tabGroupId`, navigazioni concorrenti osservate su `/admin`, `/history`, `/login`, `/register` durante la sessione) e il resize non è stato affidabile. La valutazione mobile per Contratti si basa quindi su lettura del codice (classi `lg:hidden`/`hidden lg:grid`, pattern `micro-label lg:hidden` per le label inline) — struttura corretta per l'Assioma 2 (nessun troncamento, i valori diventano righe etichettate), ma non verificata a schermo.

### Scambi (Fantacontratti Test, ADMIN Pietro)
- Pietro non ha giocatori in rosa in questa lega (0/0) — ho potuto testare solo il ramo "scambio di soli crediti".
- **Offerta reale inviata**: a Michele, 5M crediti offerti, 0 richiesti, scadenza 24h. Risposta: "Offerta inviata!", redirect automatico a tab "Inviate" con conteggio aggiornato (2→3), riga nuova visibile con "+5M" e timestamp corretto (15:17). **Funziona correttamente.**
- Tab **Ricevute**: vuota per Pietro in questo run (nessuna offerta in ingresso da testare in questa sessione).
- Tab **Concluse**: 2 trattative storiche visibili con filtri di stato funzionanti (Tutte/Accettate/Rifiutate/Decadute/Annullate a chip).
- **Controfferta**: non testata in questa sessione — nessuna offerta ricevuta era disponibile su cui contro-offrire con l'utenza Pietro in questo momento della lega condivisa.

### Finanze (Fantacontratti Test)
- Tab **Panoramica**: hero "La mia squadra" (500M, formula esplicita "500M budget − 0M ingaggi = 500M"), KPI di lega, classifica bilanci (7 righe visibili, Pietro evidenziato in oro all'ultima posizione con "TU").
- Tab **Squadre**: grafico "Composizione del budget" (barre impilate per squadra, asse Y "Crediti (M)" — **Assioma 10 rispettato**) + "Andamento dei bilanci" (empty state corretto: "Nessuno storico disponibile per questa lega", coerente con una lega ancora alla prima sessione).
- Tab **Movimenti**: non aperta in questa sessione per limiti di tempo/finestra condivisa — verificata solo da codice (`FinanceTimeline.tsx`, non letto in dettaglio in questo giro).
- Non ho consolidato né toccato dati economici reali: solo navigazione e lettura.

### Premi
- **Nessuna lega di test è in fase PREMI** (Lega Test è in CONTRATTI, Fantacontratti Test è in OFFERTE_PRE_RINNOVO, Lega finale non ha sessione attiva). Come da istruzioni, non ho forzato la fase via endpoint admin/DB.
- Verifica da codice: `PrizePhasePage.tsx` gestisce correttamente il caso "nessuna sessione attiva" con vista di sola consultazione dello storico (`PrizeHistoryAccordion`) — buona applicazione del principio "consultazione senza sessione attiva non deve essere una pagina vuota".
- `PrizePhaseManager.tsx` (735 righe) è un componente ampio che orchestra uno step-wizard (`PrizeStepper`/`StepCard`) con tabelle dedicate (`IndemnityTable`, `PrizeAssignmentTable`) e un riepilogo per manager (`ManagerPrizeSummary`, 91 righe) — la scomposizione in sotto-componenti è già buona; non emergono duplicazioni evidenti a lettura statica, ma **non è stato verificato a runtime in questo audit**. Raccomando un giro di test dedicato (ideale: usare un ambiente con una sessione forzata in fase PREMI su un DB di scratch, non su Lega Test/Fantacontratti Test) quando possibile.

---

## Proposte prioritizzate

| # | Proposta | Impatto | Sforzo | Dove |
|---|----------|---------|--------|------|
| 1 | **Contratti**: eliminare la card sidebar "Residuo dopo consolidamento" oppure la sezione Residuo in testata — tenerne una sola. Se si tiene la sidebar (più ricca, con scomposizione Budget/Ingaggi/Tagli/Indennizzi), la testata può mostrare solo Slot + Residuo (2 numeri), rimandando Budget/Ingaggi al breakdown sidebar. | **Alto** | S | `src/pages/Contracts.tsx` righe 653–683 (testata) e 793–810 (sidebar) |
| 2 | **Finanze Panoramica**: rimuovere le note `il tuo: {budget}M` / `il tuo: {ingaggi}M/anno` dalle card "La lega in numeri" (righe 79 e 85 di `FinanceDashboard.tsx`), dato che gli stessi numeri sono già i due KPI grandi di `MyTeamHero` undici righe più in alto sulla stessa pagina. Le card di lega dovrebbero mostrare solo il valore medio/aggregato, senza ripetere "il tuo". | **Alto** | S | `src/components/finance/FinanceDashboard.tsx` righe 74–98 |
| 3 | **Unificare la logica di validazione contratto**: far usare a `ContractModifier.tsx` le funzioni condivise `getRenewalConstraints()`/`DURATION_MULTIPLIERS` di `src/components/contracts/renewal-logic.ts` + `shared.tsx`, e il componente `Stepper.tsx` invece dei bottoni +/- ridisegnati a mano. Riduce la superficie di bug (una sola fonte di verità per "clausola = ingaggio × moltiplicatore" e "no diminuzione"). | **Alto** (previene bug futuri, non solo estetico) | M | `src/components/ContractModifier.tsx` righe 5–10, 18–89, 260–304 |
| 4 | **Contratti — sidebar**: accorpare "Composizione rosa" e "Ingaggi rosa" in un'unica card ("Rosa" con distribuzione ruoli + min/max/media ingaggio), invece di due card separate che ripetono lo stesso "25/29"/totale ingaggi già in testata. Valutare se "Composizione rosa" (distribuzione P/D/C/A) è davvero utile durante i rinnovi o è più a casa in Rose. | Medio | S | `src/pages/Contracts.tsx` righe 824–854 |
| 5 | **Scambi**: allineare la label del CTA duplicato — `DealTable` dice "Invia offerta a {nome}", `DealMobileFooter` dice "Invia Offerta" generico. Non è un bug ma un'incoerenza testuale tra due istanze dello stesso pulsante. | Basso | S | `src/pages/Trades.tsx` riga 826 vs `DealTable` |
| 6 | **Trade history**: verificare che ogni riga in "Concluse" mostri sempre un badge di stato visibile senza scroll orizzontale (non confermato con certezza in questa sessione per limiti del viewport condiviso) — da ricontrollare con un giro rapido su viewport dedicato. | Medio | S | `src/components/trades/TradeOfferCard.tsx` (variant history) |
| 7 | **Premi**: pianificare un giro di verifica live dedicato (session forzata in fase PREMI su DB di scratch) data l'ampiezza di `PrizePhaseManager.tsx` (735 righe) mai esercitata in questo audit. | Medio | M (richiede setup ambiente) | `src/components/PrizePhaseManager.tsx` |

---

## Nota metodologica

La finestra Chrome usata per l'automazione era **condivisa con altri agenti dell'audit** in esecuzione in parallelo (osservati: navigazioni autonome su `/admin`, `/history`, `/login`, `/register`, `/dashboard`, cambi di dimensione finestra non richiesti da me). Questo ha reso **inaffidabile il resize per lo screenshot mobile** e ha introdotto qualche interferenza nei click (stepper che sembravano non rispondere per via di scroll/resize concorrenti, poi confermati funzionanti isolando i click con `find`+ref). Le conclusioni funzionali (rinnovo contratto, salvataggio bozza, invio offerta scambio) sono comunque **verificate con successo end-to-end**, azioni reali eseguite e osservate. La valutazione mobile-specifica si basa in parte su lettura del codice invece che su screenshot live, ed è segnalata come tale nei punti relativi.

Nessun consolidamento contratti eseguito, nessuna offerta reale accettata/rifiutata su rose altrui, nessun dato economico irreversibile modificato oltre a quanto esplicitamente autorizzato (rinnovo in bozza + un'offerta di scambio di prova).
