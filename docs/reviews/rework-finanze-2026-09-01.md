# Rework motore finanziario — Budget / Monte Ingaggi / Bilancio

> **STATO: implementato e verificato (01/09/2026).** Modello distillato in `docs/bibbie/FINANZE.md` (§1.5, §2.1-2.2) e `docs/bibbie/CONTRATTI.md` (§6.1, §13.1). Blocco cautelativo rimosso dal codice. Resta da confermare il deploy in produzione con Pietro. Questo documento resta come riferimento storico del percorso di analisi (user stories, esempio numerico completo).

## 0. Perché questo documento esiste

Il 01/09/2026, verificando il Bilancio di AC TUA in Fase Contratti, è emerso che il consolidamento contratti **non decurtava mai realmente il Budget** per pagare il monte ingaggi — lo "fissava" soltanto (`LeagueMember.totalSalaries = postMonteIngaggi`), lasciando `LeagueMember.currentBudget` invariato. Risultato: il Budget di un manager cresceva senza limiti, stagione dopo stagione, senza mai scontare il vero costo della rosa.

**Fix implementato**: `consolidateContracts` ora decurta davvero `currentBudget` del monte ingaggi totale, azzera `totalSalaries`, e marca ogni contratto attivo con `PlayerContract.paidAt` (nuovo campo). Le 12 validazioni live di offerta in Asta/Rubata/Svincolati filtrano su `paidAt: null`. La Rubata azzera `paidAt` sul contratto trasferito (vero riacquisto); lo Scambio non lo tocca. Dettaglio completo in `docs/bibbie/FINANZE.md` §1.5.

**Blocco cautelativo** (era attivo dal commit `0915252`, `CONSOLIDATION_BLOCKED_PENDING_FINANCIAL_REWORK` in `src/services/contract.service.ts` + specchio in `src/pages/Contracts.tsx`): **rimosso dal codice** una volta completata l'implementazione. Non ancora deployato in produzione — nessuno ha ancora consolidato con la logica corretta.

## 1. Principio guida concordato

> Il monte ingaggi della rosa che hai al momento del consolidamento viene "pagato" una volta per tutte (decurtato realmente dal Budget). Da quel momento in poi, fino al prossimo consolidamento, quel monte ingaggi non pesa più — solo i NUOVI movimenti (acquisti in Rubata/Svincolati, futuri rinnovi) riducono il Bilancio disponibile.

Conseguenza diretta: dopo un consolidamento, la piattaforma deve poter distinguere "monte ingaggi già pagato" da "monte ingaggi nuovo da quel momento in poi" — oggi questa distinzione non esiste in nessun campo del database.

## 2. User Story #1 — AC TUA, consolidamento base (CONFERMATA)

**Dati di partenza (Fase Premi già consolidata, nessun rinnovo fatto)**:
- Residuo di partenza (bilancio fine sessione precedente): 0
- + Scambio Provedel→Montsegur: +5
- + Premi consolidati (Re-incremento Base 115 + Portiere 35 + Disciplina 23): +173
- = **Bilancio/Budget disponibile ora: 178**
- Monte ingaggi attuale (29 contratti attivi): 137
- Indennizzi potenziali (5 giocatori usciti, individuali): Gosens 8, Leao 97, Sanabria 4, Morata 3, Vardy 0 = 112

**Scenario**: AC TUA accetta RELEASE su tutti e 5 i giocatori usciti (incassa i 112 di indennizzo), non rinnova nient'altro. Monte ingaggi dei 24 giocatori rimasti: 137 − 31 (i 5 rilasciati) = 106.

**Al momento del consolidamento**:
- Budget diventa: 178 (bilancio pre-consolidamento) + 112 (indennizzi) − 106 (monte ingaggi pagato per intero) = **184**
- Questo 184 è il nuovo "Budget pulito" — non contiene più monte ingaggi "nascosto" dentro.

**Subito dopo il consolidamento, in Rubata/Svincolati**:
- AC TUA può offrire fino a **184 pieni**. I 106 di monte ingaggi dei 24 giocatori rimasti in rosa **non vengono sottratti una seconda volta** — sono già stati pagati.
- Solo un NUOVO acquisto (es. vince un'asta Svincolati a 10 con ingaggio 3) riduce il Bilancio disponibile del suo impatto totale (offerta + ingaggio), esattamente come fa oggi il codice per le fasi live — la differenza è che la base di partenza per il "quanto ho ancora" deve essere 184, non "184 meno il monte ingaggi già pagato".

## 3. Conseguenza tecnica da risolvere (aperta)

Oggi, in Asta/Rubata/Svincolati, ogni validazione di offerta ricalcola dal vivo `Bilancio = currentBudget − somma di TUTTI i contratti attivi del manager` (mai fidandosi di un campo salvato, per sicurezza — vedi Bibbia FINANZE.md §1.4). Con lo User Story #1, questo ricalcolo dovrebbe invece contare **solo i contratti nuovi/modificati dopo l'ultimo consolidamento** — non tutti.

Serve quindi un modo per la piattaforma di sapere, in ogni momento, quali contratti sono "già pagati" (fanno parte del monte ingaggi consolidato l'ultima volta) e quali sono "nuovi" (da un acquisto/rinnovo successivo al consolidamento). Opzioni possibili da valutare (nessuna ancora scelta):
- Un campo/timestamp su `PlayerContract` che segna quando è stato "consolidato l'ultima volta".
- Il campo persistito `totalSalaries`, azzerato al consolidamento e poi incrementato SOLO dalle transazioni live successive (pattern già usato oggi per Rubata/Svincolati/Primo Mercato — "Subito, live, per transazione") — usato però come fonte di verità al posto del ricalcolo "somma di tutti i contratti", il che richiede di fidarsi del campo persistito invece di ricalcolare sempre dal vivo (cambio di filosofia rispetto a oggi).
- Altro?

## 4. User Stories — verificate

### 4.1 Rubata (CONFERMATA — nessun bug)

Esempio: Soulè (AC TUA) viene rubato da ARCIONIA. ARCIONIA paga clausola+ingaggio: AC TUA riceve la clausola e si libera del suo ingaggio (torna nel suo Bilancio come credito); ARCIONIA paga la clausola e si accolla l'ingaggio (nuovo costo per lui). Un eventuale aumento post-acquisizione (21→25, meccanismo "modifica contratto post-acquisto", increase-only) pesa solo su chi lo fa da quel momento — non torna mai indietro al vecchio proprietario. **Verificato nel codice (`FINANZE.md` §3): già implementato correttamente.**

### 4.2 Scambio a pari (CONFERMATA — nessun bug)

Esempio: AC TUA scambia Soulè con Arcionia per Svilar, alla pari (nessun credito extra). I due contratti invertono semplicemente squadra, mantenendo ingaggio e durata originali — **nessun pagamento viene ri-attivato**. Il contratto era già "pagato" da chi lo possedeva prima; cambiare proprietario non fa scattare un nuovo pagamento. Coerente con `FINANZE.md` §1.4 ("Scambi: Fissato — il contratto trasferito non viene sommato subito") e con il pattern già usato per i trasferimenti fatti in questa sessione (roster+contratto spostati as-is, budget non toccato). **Nessuna correzione necessaria.**

### 4.3 Taglio (CONFERMATA — nessun bug)

Il taglio è possibile **solo prima del consolidamento**: non si può mai tagliare un giocatore "già pagato", perché lo si taglia PRIMA che scatti il pagamento (che avviene solo al consolidamento). Coerente col codice attuale: `consolidateContracts` cancella i contratti tagliati/rilasciati (RELEASE_NORMAL/ESTERO/RETROCESSO) PRIMA di calcolare `postMonteIngaggi` (righe 1547-1550) — quindi un giocatore tagliato non entra mai nel calcolo di cosa va "pagato". **Nessuna correzione necessaria.**

### 4.4 Primo Mercato Assoluto (CONFERMATA — nessun bug)

Esempio: compro Esposito a 50 (prezzo asta) → contratto minimo per regola: ingaggio 5, durata 3. L'ingaggio (5) viene pagato **contestualmente all'acquisto**, non differito — stesso meccanismo degli Svincolati. Coerente con `FINANZE.md` §1.4 ("Primo Mercato — ogni asta vinta: Subito, live, per transazione") e §2.1 punto 2. **Nessuna correzione necessaria.**

### 4.5 Conclusione parziale

Rubata, Scambi, Taglio e Primo Mercato sono **tutti già corretti** — seguono tutti lo stesso principio (l'ingaggio è impegnato da chi possiede il contratto in quel momento, si sposta con lui, un aumento pesa solo su chi lo decide). **L'unico bug reale è nel Consolidamento stesso**: non decurta mai il Budget del monte ingaggi che pure "fissa". Il problema tecnico da risolvere (§3) resta quindi molto più circoscritto di quanto sembrasse all'inizio.

## 4.6 Risolto

- **Soluzione tecnica per §3**: nuovo campo `PlayerContract.paidAt` (schema `prisma/schemas/roster.prisma`). `null` = non pagato, valorizzato = pagato all'ultimo consolidamento di chi lo possiede ora. Consolidamento lo stampa su tutti i contratti attivi; Rubata lo azzera sul contratto trasferito; Scambio non lo tocca (confermato con esempio Soulè↔Bonaventura). Dettaglio in `FINANZE.md` §1.5.
- **`preConsolidationBudget`**: non toccato — resta un campo distinto (snapshot pre-modifiche per la privacy durante Fase Contratti), ortogonale a `paidAt`.

## 5. Stato finale

1. ✅ User stories completate con Pietro (§4.1-4.4), esempio numerico completo verificato riga per riga con Pietro (AC TUA: 178→184 post-consolidamento→variazioni Rubata/Svincolati)
2. ✅ Meccanismo tecnico deciso (`paidAt`, §4.6)
3. ✅ Bibbie aggiornate: `FINANZE.md` §1.4-1.5, §2.1-2.2; `CONTRATTI.md` §6.1, §13.1
4. ✅ Codice modificato: `contract.service.ts` (`consolidateContracts`), `auction.service.ts`/`rubata.service.ts`/`svincolati.service.ts` (12 validazioni + 3 trasferimenti Rubata), `trade.service.ts` (nessuna modifica, verificato corretto). Test: 68 in `contract.service.test.ts` + nuovi test dedicati `paidAt` in auction/rubata/svincolati/trade. `tsc` e suite completa (1845 test) puliti.
5. ⬜ Rimuovere il blocco cautelativo in produzione — **da confermare con Pietro prima del deploy** (rimosso dal codice locale, non ancora pushato)
