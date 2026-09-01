# BIBBIA: Finanze e Bilancio

> Fonte di verita per il modello finanziario della piattaforma.
> Ultima revisione: 2026-08-30

---

## 1. CONCETTI FONDAMENTALI

### 1.1 Budget

**I crediti totali disponibili per operazioni di mercato.**

- Salvato nel database come `currentBudget` nel modello `LeagueMember`
- Rappresenta la liquidita di un manager
- Viene modificato da operazioni di mercato (acquisti, vendite, premi, tagli, indennizzi)

### 1.2 Monte Ingaggi

**La somma di tutti gli ingaggi dei giocatori sotto contratto.**

- Calcolato come somma di `PlayerContract.salary` di tutti i contratti attivi del manager
- Viene ricalcolato ad ogni consolidamento (fase 3 del mercato ricorrente)
- Tra un consolidamento e l'altro, le variazioni ai contratti (rubata, svincolati) impattano il bilancio incrementalmente

### 1.3 Bilancio

**Il parametro fondamentale di una squadra. Indica la capacita di spesa reale.**

```
Bilancio = Budget - Monte Ingaggi
```

- Calcolato on-the-fly (NON salvato nel DB)
- Puo essere negativo (ingaggi superano il budget)
- Durante le fasi di mercato (rubata, svincolati), il bilancio traccia i delta incrementalmente a partire dal bilancio post-consolidamento

### 1.4 Live vs Fissato: due usi diversi dello stesso campo

`LeagueMember.totalSalaries` (Monte Ingaggi) non si comporta allo stesso modo ovunque. E' importante distinguere:

- **Aggiornamento live** (il campo riflette subito ogni transazione): usato per verificare se un manager ha bilancio sufficiente PRIMA di un'offerta (asta, rubata, svincolati) — questi controlli **non si fidano mai del campo salvato**, ricalcolano sempre la somma vera dei contratti al momento (`prisma.playerContract.aggregate`, filtrata su `paidAt: null` — vedi §1.5). Per questo un manager non puo mai spendere piu di quanto ha davvero, indipendentemente da eventuali ritardi nel campo mostrato in UI.
- **Aggiornamento fissato** (il campo resta al valore dell'ultimo evento che lo ha scritto, anche se i contratti reali sono gia cambiati): usato deliberatamente dagli **Scambi** (§13, `trade.service.ts`) per validare il bilancio disponibile sul valore "congelato" all'ultimo consolidamento, non su quello live — e dallo **svincolo pre-consolidamento** di un giocatore (taglio), che lascia il Monte Ingaggi invariato fino al prossimo consolidamento completo.

| Fase / Evento | Il campo `totalSalaries` si aggiorna |
|---|---|
| Primo Mercato — ogni asta vinta | **Subito** (live, per transazione) |
| Rubata — ogni trasferimento | **Subito** (live, per transazione, atomico con lo scambio di budget) |
| Svincolati — ogni acquisto | **Subito** (live, per transazione) |
| Modifica contratto post-acquisto (increase-only, qualsiasi fase) | **Subito** (live, per il delta) |
| Contratti — rinnovo pre-consolidamento | **Fissato** — il rinnovo scrive il contratto, il campo resta indietro fino al consolidamento |
| Contratti — taglio/svincolo pre-consolidamento | **Fissato** — il contratto viene cancellato ma il campo non decrementa |
| Scambi | **Fissato** — il contratto trasferito non viene sommato subito |
| Consolidamento | **Azzerato a 0** (rework 01/09/2026): la somma di TUTTI i contratti attivi del manager in quel momento viene calcolata per **decurtare realmente il Budget** (§2.1 punto 6), non per "fissare" il monte ingaggi — vedi §1.5 |

Il Consolidamento è quindi anche una **rete di sicurezza**: qualunque disallineamento accumulato nelle fasi "fissato" viene sanato ad ogni ciclo, pagando per intero il monte ingaggi vero in quel momento.

### 1.5 Monte ingaggi "pagato" vs "non pagato" (rework 01/09/2026)

Il Consolidamento paga per intero il monte ingaggi della rosa attuale, decurtandolo dal Budget — non lo lascia più semplicemente "fissato" a fianco di un Budget che cresce senza limiti (bug corretto il 01/09/2026, vedi `docs/reviews/rework-finanze-2026-09-01.md`). Da quel momento, fino al prossimo consolidamento di quel manager, quel monte ingaggi non deve più pesare sulle validazioni di offerta — solo i movimenti nuovi (Rubata, Svincolati, modifiche post-acquisto) lo fanno.

Per distinguerlo, `PlayerContract.paidAt` marca ogni contratto "pagato" all'ultimo consolidamento di chi lo possiede ora (`null` = non pagato/nuovo). Le validazioni live di Asta/Rubata/Svincolati (§1.4, riga "Aggiornamento live") sommano solo i contratti con `paidAt: null`. Comportamento per evento:

- **Consolidamento**: marca "pagato" (stampa `paidAt`) su **tutti** i contratti attivi del manager, qualunque cosa sia successo prima
- **Rubata**: azzera `paidAt` sul contratto trasferito al vincitore — è un vero riacquisto (clausola+ingaggio pagati, §3), il monte ingaggi torna a pesare per il nuovo proprietario fino al suo prossimo consolidamento
- **Scambio**: **non tocca** `paidAt` — nessun pagamento nuovo avviene, il contratto mantiene il suo stato indipendentemente dal cambio di proprietario (§13)
- **Nuovo contratto** (Primo Mercato, Svincolati): nasce con `paidAt: null` — è per definizione non ancora pagato

---

## 2. FLUSSO FINANZIARIO COMPLETO

### 2.1 Scenario Tipo

```
1. INIZIO LEGA
   Budget = budget_iniziale (configurabile, default 500)
   Monte Ingaggi = 0
   Bilancio = 500

2. PRIMO MERCATO ASSOLUTO
   Per ogni acquisto:
     Budget -= prezzo_asta (solo prezzo asta va su budget)
     Monte Ingaggi += ingaggio_default (ingaggio va su monte ingaggi)
   Esempio: compro a 75, ingaggio default 8, durata 3
     Budget -= 75 (asta)
     Monte Ingaggi += 8
     Bilancio cala di 83 in totale (75 da budget + 8 da monte ingaggi)

3. MERCATO RICORRENTE - Apertura
   Decremento durata contratti (-1 a tutti)
   Giocatori con durata 0 → svincolati (tracciare)
   Ricalcolo clausole rescissorie con nuove durate

4. FASE 1 - Offerte e Scambi
   Budget +/- scambi economici tra manager
   Monte Ingaggi NON si ricalcola (contratti trasferiti non impattano ancora)
   Bilancio = bilancio_precedente +/- delta_scambi

5. FASE 2 - Assegnazione Premi
   Budget += premi_standard + premi_variabili + indennizzi
   Budget -= tagli (costo taglio = ceil(salary * duration / 2))

6. FASE 3 - Rinnovo Contratti e Consolidamento
   Monte Ingaggi ricalcolato con tutti i contratti attuali (rinnovi inclusi)
   Rinnovo: aumenta monte ingaggi, NON decrementa subito il budget
   Al Consolidamento (rework 01/09/2026): il Budget viene DECURTATO per intero
   del Monte Ingaggi appena ricalcolato — non solo "fissato" a fianco.
   Budget -= Monte Ingaggi totale; Monte Ingaggi riparte da 0 (vedi §1.5)
   Il nuovo Budget (già netto) è il punto di partenza per le fasi successive

7. FASE 4 - Rubata
   Bilancio incrementale (vedi sezione 3)

8. FASE 5 - Asta Svincolati
   Bilancio incrementale (vedi sezione 4)

9. FASE 6 - Offerte e Scambi Post-Svincolati
   Come Fase 1

10. FASE 7 - Fine Mercato
    Blocco operazioni
```

### 2.2 Esempio Numerico Completo

```
Manager A comincia lega con budget 500
Primo mercato: compra 25 giocatori
  Totale speso in aste: 280 → Budget = 500 - 280 = 220
  Contratti default creati → Monte Ingaggi = 70
  Bilancio = 220 - 70 = 150

Si apre mercato ricorrente:
  Premi ricevuti: 150
  Bilancio = 150 + 150 = 300

  Offerte e scambi: +50 netto
  Bilancio = 300 + 50 = 350

  Rinnovo contratti e consolidamento (rework 01/09/2026):
    Budget accumulato finora (aste+premi+scambi, senza monte ingaggi dentro): 350
    Indennizzi accettati: +50 → Budget = 400
    Tagli: -10 → Budget = 390
    Monte ingaggi post rinnovo (tutti i contratti attivi): 140, pagato per intero
    Budget = 390 - 140 = 250
    Monte Ingaggi riparte da 0 (tutti i contratti ora "pagati", vedi §1.5)
    Bilancio disponibile dopo il consolidamento = 250

  Rubata (viene rubato Maignan, contratto 4x4):
    Clausola = 44, rubata base = 48
    Nessun rilancio, rubata a 48
    Manager A: bilancio = 250 + 44 (offerta) + 4 (ingaggio risparmiato) = 298

  Asta svincolati: nessun acquisto
  Offerte e scambi post: nessuna operazione

  Fine mercato: bilancio = 298
```

---

## 3. BILANCIO NELLA RUBATA

### 3.1 Scomposizione del Prezzo Rubata

Il prezzo totale della rubata si scompone SEMPRE in due parti:

```
PREZZO TOTALE = OFFERTA + INGAGGIO

Dove:
- OFFERTA = parte che parte dalla clausola e sale con i rilanci
- INGAGGIO = salario originale del giocatore (fisso, non cambia con i rilanci)
```

**Esempio con rilanci:**

| Azione | Totale | = Offerta | + Ingaggio |
|--------|--------|-----------|------------|
| B dichiara rubata | 48 | 44 (clausola) | 4 |
| C rilancia | 49 | 45 | 4 |
| B rilancia | 50 | 46 | 4 |

L'OFFERTA sale (44 → 45 → 46). L'INGAGGIO resta sempre 4.

### 3.2 Impatto Finanziario

#### Venditore (perde il giocatore)

```
Bilancio += OFFERTA + INGAGGIO_RISPARMIATO
```

- **Budget** += OFFERTA (solo la parte offerta, non il totale)
- **Monte Ingaggi** -= ingaggio originale (il giocatore esce dalla rosa)
- L'effetto sul monte ingaggi sara visibile al prossimo consolidamento
- Nel bilancio corrente: +offerta + ingaggio_risparmiato

#### Acquirente (acquisisce il giocatore)

```
Bilancio -= OFFERTA + NUOVO_INGAGGIO
```

- **Budget** -= OFFERTA (solo la parte offerta)
- **Monte Ingaggi** += nuovo ingaggio (originale o modificato)
- L'effetto sul monte ingaggi sara visibile al prossimo consolidamento
- Nel bilancio corrente: -offerta - nuovo_ingaggio

#### Se l'acquirente modifica il contratto

Il costo aggiuntivo e l'aumento di ingaggio (delta tra nuovo e originale):

```
Costo modifica = nuovo_ingaggio - ingaggio_originale
```

Questo costo NON va al venditore. E' un costo sostenuto solo dall'acquirente.

### 3.3 Esempio Completo con Modifica

```
Maignan di Manager A, contratto 4x4, clausola 44
Manager B vince rubata a 50 (offerta 46 + ingaggio 4)
Manager B modifica contratto da 4x4 a 6x4

MANAGER A (venditore):
  +46 (offerta ricevuta)
  +4  (ingaggio risparmiato)
  = +50 a bilancio

MANAGER B (acquirente):
  -46 (offerta pagata)
  -6  (nuovo ingaggio dopo modifica)
  = -52 a bilancio

VERIFICA ZERO-SUM:
  Senza modifica: A +48, B -48 → netto 0
  Con modifica:   A +50, B -52 → netto -2 (= costo modifica volontaria)
  Nessun soldo dal nulla.
```

### 3.4 Regola Fondamentale

> **Nel valore della rubata e gia previsto il pagamento dell'ingaggio.**
> Il prezzo rubata = clausola + ingaggio. Quando paghi la rubata, stai implicitamente pagando anche il contratto per il primo semestre.
> Solo eventuali AUMENTI volontari di ingaggio sono un costo aggiuntivo.

---

## 4. BILANCIO NELL'ASTA SVINCOLATI

### 4.1 Costo Acquisto Svincolato

```
Costo totale = prezzo_asta + ingaggio_default
```

Il manager deve avere bilancio sufficiente per ENTRAMBI prima di poter fare offerta.

**Esempio:**
```
Manager A, bilancio 250
Asta svincolato Bernabe, vince a 25
Ingaggio default = Math.max(1, Math.round(25/10)) = 3, durata 3
Costo = 25 (asta) + 3 (ingaggio) = 28
Bilancio = 250 - 28 = 222
```

### 4.2 Modifica Contratto Post-Acquisto

Se il manager modifica l'ingaggio (aumento), il costo e la differenza:

```
Manager A modifica da 3x3 a 5x4
Costo = 25 (asta) + 5 (nuovo ingaggio) = 30
Bilancio = 250 - 30 = 220
```

### 4.3 Offerta Minima

Per fare offerta di 1, serve bilancio >= 2 (offerta 1 + ingaggio default 1).

---

## 5. BILANCIO NEL PRIMO MERCATO

### 5.1 Costo Acquisto

```
Impatto su bilancio = prezzo_asta + ingaggio (= "costo totale")
  → Budget -= prezzo_asta (componente cash)
  → Monte Ingaggi += ingaggio (componente stipendiale)
```

**Esempio:**
```
Compro Esposito a 75
Ingaggio default = Math.max(1, Math.round(75/10)) = 8, durata 3

Budget -= 75 (solo prezzo asta)
Monte Ingaggi += 8
Bilancio cala di 83 in totale (75 + 8)

Se modifico ingaggio a 9x3: bilancio cala di 84 (75 + 9)
Se modifico ingaggio a 9x4: bilancio cala di 84 (75 + 9)
```

Il manager deve avere **bilancio >= costo totale** (prezzo + ingaggio) per fare offerta.

---

## 6. OPERAZIONI CHE MODIFICANO IL BUDGET

| Operazione | Effetto su Budget |
|------------|------------------|
| Acquisto primo mercato | -= prezzo asta |
| Acquisto svincolati | -= prezzo asta |
| Rubata (acquirente) | -= OFFERTA (non totale!) |
| Rubata (venditore) | += OFFERTA |
| Scambio/offerta tra manager | +/- importo concordato |
| Premio standard | += importo |
| Premio variabile | += importo |
| Indennizzo ESTERO | += importo (definito da admin, min 0) |
| Taglio giocatore | -= ceil(salary * duration / 2) |
| Taglio giocatore ESTERO | -= 0 (gratuito) |
| Taglio giocatore RETROCESSO | -= 0 (gratuito) |
| Aumento ingaggio | Budget invariato (impatta solo monte ingaggi) |
| Rinnovo/Spalma | Budget invariato (impatta solo monte ingaggi) |

---

## 7. OPERAZIONI CHE MODIFICANO IL MONTE INGAGGI

| Operazione | Effetto su Monte Ingaggi |
|------------|-------------------------|
| Acquisto (qualsiasi tipo) | += ingaggio (default o modificato) |
| Rubata (acquirente) | += ingaggio (originale o modificato) |
| Rubata (venditore) | -= ingaggio giocatore perso |
| Taglio | -= ingaggio giocatore tagliato |
| Rinnovo/Aumento ingaggio | += delta ingaggio |
| Giocatore scadenza contratto | -= ingaggio (diventa svincolato) |
| Scambio tra manager | Trasferimento contratto, ricalcolo al consolidamento |

**NOTA:** Le variazioni al monte ingaggi durante rubata e svincolati impattano il bilancio incrementale ma il ricalcolo formale avviene al prossimo consolidamento.

---

## 8. FORMULA COSTO TAGLIO

```
Costo taglio = CEIL(ingaggio * durata / 2)
```

Arrotondamento per ECCESSO (Math.ceil).

| Ingaggio | Durata | Costo taglio |
|----------|--------|-------------|
| 10 | 3 | ceil(15) = 15 |
| 10 | 2 | ceil(10) = 10 |
| 7 | 3 | ceil(10.5) = 11 |
| 3 | 1 | ceil(1.5) = 2 |
| 1 | 1 | ceil(0.5) = 1 |

> **Edge case**: il costo taglio minimo per un contratto attivo e sempre 1 (mai 0).

**Eccezioni:**
- Giocatori ESTERO: costo taglio = 0
- Giocatori RETROCESSO: costo taglio = 0

---

## 9. INDENNIZZI

### 9.1 Giocatori ESTERO
- L'admin imposta il valore di indennizzo per ogni giocatore ESTERO
- Minimo 0 (esiste il caso di indennizzo pari a 0)
- Formula automatica: da definire in futuro

### 9.2 Giocatori RETROCESSO
- Nessun indennizzo
- Costo taglio: 0

---

## 10. REGOLE IMPORTANTI

1. **Bilancio negativo — solo durante il mercato**: per effetto di operazioni gia validate (rubata, svincolati) il monte ingaggi puo temporaneamente superare il budget, rendendo il bilancio incrementale negativo. **Al consolidamento (Fase 3), invece, il bilancio deve essere >= 0**: non si puo consolidare in rosso — il sistema blocca il consolidamento se il monte ingaggi supera il budget, e il manager deve tagliare ingaggi per rientrare.

2. **Budget sempre >= 0**: il budget (liquidita) non puo mai essere negativo. Il sistema valida la disponibilita prima di ogni operazione (asta, rubata, taglio, scambio).

3. **Rinnovo NON decrementa budget**: il rinnovo aumenta solo il monte ingaggi. Questa e una regola FONDAMENTALE.

4. **Budget transfer nella rubata**: solo l'OFFERTA si trasferisce tra manager, non il prezzo totale. L'ingaggio e una componente implicita che rappresenta il costo/risparmio del contratto.

5. **Verifica disponibilita**: prima di ogni operazione (asta, offerta, rubata), il sistema verifica che il bilancio sia sufficiente a coprire il costo totale (prezzo + ingaggio).

6. **Consolidamento irreversibile**: una volta consolidato, le operazioni sono definitive. L'admin ha interfaccia per correzioni (vedi Bibbia ADMIN-CORREZIONI, futura).

---

## 11. COSTO ACQUISTI (Tabellone Finanze)

### 11.1 Definizione

**La somma dei prezzi d'asta pagati per tutti i giocatori attivi in rosa.**

- Calcolato come `SUM(PlayerRoster.acquisitionPrice)` dove `status = ACTIVE`
- Rappresenta il **costo storico** degli acquisti, non il valore di mercato attuale
- Visibile nel tabellone Finanze nella colonna "Acquisti"

### 11.2 Relazione con Budget

```
Budget Iniziale - Costo Acquisti = Budget Attuale (currentBudget)
```

**Nota**: `currentBudget` nel DB e gia decrementato dei costi acquisto. Il Costo Acquisti e una voce **esplicativa** che spiega la differenza tra Budget Iniziale e Budget Attuale.

### 11.3 Formula Completa Visibile

Il tabellone mostra la formula completa:

```
Budget Iniziale (500) - Acquisti (8) = Budget Attuale (492) - Ingaggi (1) = Bilancio (491)
```

Dove:
- **Budget Iniziale**: `currentBudget + totalAcquisitionCost` (ricostruito)
- **Acquisti**: `SUM(PlayerRoster.acquisitionPrice)` dei giocatori ACTIVE
- **Budget Attuale**: `currentBudget` (salvato nel DB)
- **Ingaggi**: `SUM(PlayerContract.salary)` (monte ingaggi)
- **Bilancio**: `Budget Attuale - Ingaggi`

### 11.4 Esempio

```
giulia_bianchi: budget iniziale 500, compra falcone a 8, ingaggio 1x3
  Budget Iniziale = 500
  Acquisti = 8 (prezzo asta)
  Budget Attuale = 500 - 8 = 492
  Ingaggi = 1
  Bilancio = 492 - 1 = 491
```

---

## 12. STORICITA FASI (Tabellone Finanze)

### 12.1 Concetto

Il tabellone Finanze permette di visualizzare l'evoluzione delle finanze tra le diverse fasi di una sessione di mercato. Il selettore fase in alto consente di navigare tra:

- **Attuale**: stato corrente delle finanze
- **Sessioni passate**: dati storici per ogni sessione di mercato

### 12.2 Dati Storici Disponibili

I dati storici sono basati su:
- `ManagerSessionSnapshot` (tipo: SESSION_START, PHASE_START, PHASE_END)
- `PlayerMovement` raggruppati per `marketSessionId`

### 12.3 Fasi Tracciabili

| Fase | Tipo Snapshot | Descrizione |
|------|--------------|-------------|
| Inizio Sessione | SESSION_START | Budget e ingaggi dopo decremento durata |
| Dopo Premi | PHASE_START | Budget dopo assegnazione premi |
| Dopo Contratti | PHASE_END | Budget dopo consolidamento |
| Dopo Rubata | - | Budget dopo fase rubata |
| Dopo Svincolati | - | Budget dopo asta svincolati |

### 12.4 Sessioni nel Selettore

Il selettore mostra tutte le sessioni di mercato della lega, con indicazione di:
- Tipo sessione (Primo Mercato / Mercato Ricorrente)
- Fase corrente (se attiva)
- Stato (In corso / Completata)

---

## 13. SCAMBI NEL TABELLONE FINANZE

### 13.1 Definizione

Il tabellone Finanze mostra per ogni squadra i **crediti movimentati tramite scambi** nella sessione di mercato corrente.

I dati provengono dalle `TradeOffer` con `status = ACCEPTED` e budget > 0:

| Campo | Calcolo |
|-------|---------|
| `tradeBudgetIn` | Somma dei crediti **ricevuti** dal manager (come `offeredBudget` quando e' receiver, o `requestedBudget` quando e' sender) |
| `tradeBudgetOut` | Somma dei crediti **ceduti** dal manager (come `offeredBudget` quando e' sender, o `requestedBudget` quando e' receiver) |
| Saldo netto | `tradeBudgetIn - tradeBudgetOut` |

### 13.2 Visualizzazione

Nel tabellone squadre, la colonna **"Scambi"** appare solo se almeno un manager ha effettuato scambi con crediti. Mostra:

- **Saldo netto** con colore semantico (verde se positivo, ambra se negativo)
- **Dettaglio** `+ricevuti / -ceduti` in riga secondaria

Sopra la tabella, tre card di riepilogo:

| Card | Valore |
|------|--------|
| Crediti Ricevuti (lega) | Somma di tutti i `tradeBudgetIn` |
| Crediti Ceduti (lega) | Somma di tutti i `tradeBudgetOut` |
| Volume Scambi | `Crediti Ricevuti + Crediti Ceduti` (= doppio del totale reale, perche' ogni trasferimento ha un mittente e un destinatario) |

### 13.3 Relazione con Budget

I crediti scambiati sono gia' inclusi nel `currentBudget` di ogni manager (vengono trasferiti atomicamente all'accettazione dello scambio). Il tracciamento nel tabellone Finanze e' **esplicativo**: spiega quanto del budget attuale deriva da scambi.

### 13.4 Zero-Sum

I trasferimenti di crediti tra manager sono a somma zero per la lega:

```
SUM(tradeBudgetIn) == SUM(tradeBudgetOut)  (per l'intera lega)
```

---

## 14. GAP NOTI E DEBITO TECNICO

### 14.1 Bug storici corretti (2026-08-30)

Durante un playthrough reale della fase Svincolati (azioni utente vere su produzione, non simulate) sono stati trovati e corretti due bug, entrambi relativi al Monte Ingaggi:

- **Modifica contratto post-acquisto non aggiornava `totalSalaries`** (qualsiasi fase: Primo Mercato, Rubata, Svincolati). Il contratto veniva aggiornato correttamente, il campo Monte Ingaggi restava indietro per la differenza. Impatto reale: gli **Scambi** (§1.4, §13), che si fidano del campo fissato, potevano mostrare un bilancio disponibile piu alto del vero. Asta/Rubata/Svincolati non erano a rischio (ricalcolano sempre live). Contratti/`modifyContractPostAcquisition` ora aggiorna il delta atomicamente nella stessa transazione.
- **Primo Mercato non aggiornava `totalSalaries` per singola asta**, a differenza di Rubata/Svincolati: il campo restava a 0 (o al valore precedente) per tutta la fase e veniva fissato in blocco solo alla chiusura dell'intera fase (`closeAuctionSession`). Nessun rischio finanziario reale (stesso motivo sopra), ma il numero mostrato in UI durante la fase poteva essere sbagliato. Allineato al pattern live di Rubata/Svincolati.

Entrambi coperti da test di regressione (`contract.service.test.ts`, `auction.service.test.ts`).

### 14.2 Osservazione architetturale (non urgente, da valutare in un refactor futuro)

`LeagueMember.totalSalaries` fa strutturalmente due lavori diversi (vedi §1.4): "verita corrente" in tre fasi, "istantanea congelata all'ultimo consolidamento" in altre due. Questa doppia semantica sullo stesso campo e il motivo per cui i bug in §14.1 sono nati — chi tocca codice nuovo assume ragionevolmente che il campo debba essere sempre accurato.

Miglioramento possibile, non implementato per scelta (refactor di logica di business critica, rimandato):
1. Rinominare il campo (richiede migrazione Prisma) per rendere esplicito che e "l'istantanea all'ultimo consolidamento", non una verita live.
2. Estrarre in un'unica funzione condivisa il calcolo `bilancio live = currentBudget - somma reale contratti`, oggi duplicato in ~10 punti quasi identici tra `auction.service.ts`, `rubata.service.ts`, `svincolati.service.ts` — la duplicazione e essa stessa un rischio (stesso pattern gia visto con `getAgeColor` duplicata 7 volte, vedi memoria `feedback-metodo-verifica-bug-finanziari`).

### 14.3 Profezie assenti in Svincolati

A differenza di Primo Mercato e Rubata, la fase Svincolati non ha alcuna funzionalita "profezia" (ne in UI ne nel backend — `handleAcknowledge` non ha nemmeno il parametro). Non e un bug del modello finanziario, ma un gap di prodotto trovato durante la stessa verifica del 2026-08-30, non ancora implementato.

---

## CHANGELOG

| Data | Modifica |
|------|----------|
| 2026-08-30 | Verifica end-to-end (playthrough reale Svincolati) + sezione 1.4 (live vs fissato) + sezione 14 (gap noti): 2 bug corretti (modifica contratto non aggiornava monte ingaggi; Primo Mercato non live), 1 osservazione architetturale, 1 gap di prodotto (profezie assenti in Svincolati) |
| 2026-02-08 | Aggiunta sezione Scambi nel Tabellone Finanze (13): tradeBudgetIn/Out, colonna Scambi, card riepilogo |
| 2026-02-07 | Aggiunta sezione Costo Acquisti (11) e storicita fasi (12) per OSS-6 |
| 2026-02-06 | Creazione documento con modello finanziario completo, scomposizione rubata offerta+ingaggio |
