# Piano di fix — race condition sui bid concorrenti (Rubata / Asta / Svincolati)

> Prodotto: 2026-08-29, sessione "verifica carico Rubata 8 utenti su prod".
> Da eseguire da un agente separato. Confermato con Pietro: fix su tutti e 3 i file.
> **File di business logic critici** (CLAUDE.md): non toccare senza aver letto questo
> piano per intero. Se qualcosa qui non torna col codice attuale (righe spostate,
> firma diversa), fermarsi e chiedere conferma invece di improvvisare.

## 1. Il bug, in una frase

In tutte le funzioni che gestiscono un rilancio (`placeBid`, `bidOnRubataAuction`,
`bidOnRubata`, `bidOnFreeAgent`) il codice legge `auction.currentPrice`, valida
`amount > currentPrice`, poi scrive `currentPrice: amount` **senza nessuna
condizione atomica** sulla scrittura. Sotto Postgres in READ COMMITTED (default),
due rilanci concorrenti possono passare *entrambi* la validazione contro lo stesso
prezzo "vecchio" e poi scrivere entrambi — chi scrive per ultimo vince, anche se il
suo importo è più basso di un'offerta già accettata nello stesso burst. È il
classico "lost update" da check-then-act.

Confermato empiricamente il 2026-08-29 su produzione (non solo per analisi statica):
vedi §3. Conseguenza osservata, non solo teorica: quando due bid restano marcati
`isWinning=true` in conflitto, la chiusura dell'asta (`closeAuction`) va in errore
(2× HTTP 500 osservati) e il lotto resta bloccato, richiedendo intervento admin —
esattamente lo scenario "8 manager rilanciano assieme" di una Rubata vissuta dal
vivo.

## 2. Come riprodurlo velocemente

### 2a. Riprodurlo su produzione (prova già fatta, riutilizzabile)

Lo script `scripts/_rubata-full-verify.mjs` (non tracciato da git, resta nel repo)
fa l'intero setup end-to-end (crea una lega dedicata nuova con sim01..sim08,
riempie il Primo Mercato, genera il tabellone Rubata, apre un'asta) e poi al
punto 10 ("OBIETTIVO 1") spara un burst di bid concorrenti con importi diversi
sfalsati e verifica l'invariante. Log e report già presenti da questa sessione:

- `scripts/_rubata-full-verify.log` — log testuale completo della corsa già fatta.
- `scripts/_rubata-full-verify-report.json` — dati machine-readable degli stessi tentativi.
- Lega di test usata: **"Rubata LoadTest 2026-08-29T10-53-22-267Z"**, id
  `cmte9igm9032zkjve2sx2g6rg` (su produzione, isolata, nessun impatto su leghe reali).
  Ha ancora un tabellone Rubata con giocatori disponibili: si può ripartire da lì
  senza rifare tutto il setup (Primo Mercato + generazione tabellone), basta
  richiamare `POST /api/leagues/{leagueId}/rubata/offer` sul prossimo giocatore
  in coda e poi il burst di bid.
- Rilanciare l'intero script: `node scripts/_rubata-full-verify.mjs` (crea
  un'ENNESIMA lega dedicata nuova — va bene, ma più lento). Per un ciclo più
  rapido, isolare solo la funzione `playOneLot({ raceTest: true })` (righe
  ~216-256) in un mini-script a parte che riusa `leagueId` sopra invece di
  ricreare la lega da zero.
- **Esito atteso PRIMA del fix** (bug presente): `pass: false` in almeno una
  parte dei tentativi, con `currentPrice` osservato diverso sia dal massimo
  sottomesso sia, in alcuni casi, dal bid marcato `isWinning`.

### 2b. Riprodurlo in locale (consigliato per lo sviluppo del fix — molto più veloce)

Non serve toccare prod per ogni iterazione del fix. In locale (`npm run dev:local`
+ DB Docker), scrivere un mini-script Vitest o un file `scripts/_local-race-test.ts`
che:

1. Importa direttamente la funzione di servizio (es. `bidOnRubataAuction` da
   `src/services/rubata.service.ts`), niente HTTP.
2. Prepara nel DB locale un'asta `RUBATA` `ACTIVE` con `currentPrice` noto e due
   `LeagueMember` con budget sufficiente (fixture minima, vedi
   `src/__tests__/` per esempi di setup già esistenti per `auction.service.ts` /
   `svincolati.service.ts` dopo il giro di test del 2026-08-28).
3. Lancia `Promise.all([bidOnRubataAuction(league, userA, amountA), bidOnRubataAuction(league, userB, amountB)])`
   con `amountA` e `amountB` entrambi validi (> prezzo iniziale, uno dei due più alto).
4. Rilegge l'`Auction` e gli `AuctionBid` associati, assert:
   - `auction.currentPrice === Math.max(amountA, amountB)`
   - esattamente un `AuctionBid` con `isWinning: true`, e il suo `amount` è il massimo.

Questo è anche il test automatico da aggiungere in modo permanente (§5) — non è
lavoro usa-e-getta, va scritto una volta e riutilizzato sia come repro sia come
regression test.

## 3. Evidenza raccolta (produzione, 2026-08-29)

Due tentativi di burst (6 bidder concorrenti, importi sfalsati, tutti accettati
via HTTP 200):

| Giocatore | Importi sottomessi | Atteso (max) | `currentPrice` osservato | Bid `isWinning` osservato | Esito |
|---|---|---|---|---|---|
| Caprile | 14,16,18,17,15,13 | 18 | **13** | 18 | FAIL |
| Maignan | 18,13,14,15,17,16 | 18 | **15** | 18 | FAIL |

`currentPrice` finisce sistematicamente più basso del vero massimo, e in modo
disallineato rispetto al bid marcato vincente — segno che le tre scritture
(`updateMany` unset-winning + `create` bid + `update` currentPrice) di
transazioni concorrenti diverse si sono interfogliate a livello di singola
statement.

## 4. Design del fix

Stesso principio già usato nel progetto per il fix della doppia chiusura asta
(`closeAuction`, vedi `src/services/auction.service.ts` righe ~1112-1128 e
~1621-1634): **compare-and-swap atomico via `updateMany` guardato su un campo
che cattura lo stato letto**, `count === 0` ⇒ qualcun altro ha scritto nel
frattempo. La differenza rispetto al caso "chiusura": lì basta che il primo
vinca e gli altri falliscano (un solo claim è corretto). Qui invece un bid più
alto arrivato *dopo* uno più basso deve **comunque poter vincere** — non è un
"perdente", è un'offerta legittima. Serve quindi CAS + **retry con rilettura**,
non solo CAS + abort.

### Pattern da applicare (pseudocodice, uguale nei 4 siti)

```ts
async function placeBidSafely(auctionId, amount, /* altri parametri di validazione */) {
  const MAX_ATTEMPTS = 5
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // 1. Rilettura FRESCA del prezzo ad ogni tentativo (non riusare il valore
    //    letto prima del primo giro, altrimenti il retry è inutile)
    const auction = await prisma.auction.findUnique({ where: { id: auctionId }, ... })
    if (!auction || auction.status !== 'ACTIVE') return { success: false, message: '...' }
    if (amount <= auction.currentPrice) {
      return { success: false, message: `Offerta minima: ${auction.currentPrice + 1}` }
    }
    // 2. Tutte le altre validazioni (budget, slot, seller...) INVARIATE, qui o prima del loop
    //    (le validazioni che non dipendono da currentPrice possono restare fuori dal loop)

    try {
      const applied = await prisma.$transaction(async (tx) => {
        // CAS: la condizione where.currentPrice deve combaciare col valore
        // appena letto. Se un altro bid è stato scritto nel frattempo, count===0.
        const claim = await tx.auction.updateMany({
          where: { id: auctionId, currentPrice: auction.currentPrice },
          data: { currentPrice: amount, timerExpiresAt: newTimerExpires, timerSeconds },
        })
        if (claim.count === 0) {
          throw new ConcurrentBidError() // fa rollback della transazione, niente scritto
        }
        await tx.auctionBid.updateMany({ where: { auctionId }, data: { isWinning: false } })
        const bid = await tx.auctionBid.create({ data: { auctionId, bidderId, userId, amount, isWinning: true } })
        return bid
      })
      return { success: true, data: applied, message: `Offerta di ${amount} registrata` }
    } catch (e) {
      if (e instanceof ConcurrentBidError) {
        continue // riprova: rilegge il prezzo aggiornato al giro successivo
      }
      throw e
    }
  }
  return { success: false, message: 'Troppi rilanci concorrenti, riprova.' }
}
```

Punti da presidiare nell'implementazione reale:

- `ConcurrentBidError` può essere una classe interna minima nel file di servizio
  (non serve condividerla tra file), usata solo per distinguere "rollback
  volontario per retry" da un vero errore da rilanciare.
- Il timer va resettato (`timerExpiresAt`) **dentro** la stessa `updateMany` CAS,
  non in una query separata dopo — altrimenti si riapre la stessa finestra di
  race sul timer.
- Le validazioni che NON dipendono da `currentPrice` (membro, seller,
  budget/bilancio, slot ruolo) possono restare fuori dal loop per non rifare
  query inutili ad ogni retry — ma la lettura di `currentPrice` e il confronto
  `amount > currentPrice` DEVONO essere dentro il loop, altrimenti il retry non
  serve a nulla (si ripete lo stesso confronto stantio).
- Nel caso comune (nessuna contesa) il loop esce al primo giro: **zero overhead
  aggiuntivo** rispetto a oggi per l'utente normale. L'overhead esiste solo sotto
  contesa reale, che è raro e comunque il caso che stiamo proteggendo.
- Se dopo `MAX_ATTEMPTS` (5 è ragionevole: con 8 manager al più 7 bidder
  concorrenti, 5 retry coprono ampiamente lo scenario peggiore) il prezzo
  continua a muoversi, restituire un messaggio onesto tipo "Troppi rilanci
  concorrenti in questo istante, riprova" — **non deve mai** silenziosamente
  accettare un'offerta ormai superata.

### 4 siti da correggere (stesso pattern, adattato ai campi di ciascuno)

| File | Funzione | Righe attuali (indicative, verificare prima di editare) | Note specifiche |
|---|---|---|---|
| `src/services/auction.service.ts` | `placeBid` | 1386–1570 | **Oggi non è nemmeno wrappato in `$transaction`**: `updateMany` (~1495), `create` (~1506), `update currentPrice` (~1536) sono tre `await` separati. Va prima incapsulato in transazione, poi reso CAS. Occhio: contiene anche la logica `slotReserve`/`bidCap` (Primo Mercato) — non toccarla, solo il blocco di scrittura finale. |
| `src/services/rubata.service.ts` | `bidOnRubataAuction` | 1601–1706 | Quello confermato buggato empiricamente (§3). È l'endpoint realmente usato dal frontend (`POST /api/leagues/:leagueId/rubata/auction/bid`, vedi `rubataApi.bidOnAuction()` in `src/services/api.ts` + `src/hooks/useRubataState.ts`). Priorità massima. |
| `src/services/rubata.service.ts` | `bidOnRubata` | 443–533 | Stesso identico pattern. **Verosimilmente codice morto** (nessun hook/componente lo chiama più, verificato via grep in questa sessione — route legacy `POST /api/rubata/:auctionId/bid`) ma va comunque fixato per non lasciare una bomba a orologeria se qualcosa lo richiama in futuro (es. tool admin). Se si vuole risparmiare tempo, alternativa accettabile: confermare che è davvero irraggiungibile e marcarlo `@deprecated` con commento invece di duplicare il fix — ma verificare bene prima (grep su tutto `src/`, non solo hook, e su `docs/bibbie/` per capire se è previsto un flusso che lo usa). |
| `src/services/svincolati.service.ts` | `bidOnFreeAgent` | 146–283 (transazione a 256–283) | Stesso pattern, guardia CAS su `currentPrice` come sopra. |

## 5. Test automatici da aggiungere

Per ciascuno dei 4 siti (o almeno per `bidOnRubataAuction` e `placeBid`, i due
sicuramente raggiungibili — valutare se `bidOnRubata` è davvero dead code prima
di scrivere un test per esso), aggiungere un test in `src/__tests__/` che:

1. Crea fixture minime (asta ACTIVE con `currentPrice` noto, due membri con
   budget sufficiente) — riusare gli helper di setup già scritti per i test di
   `auction.service.ts`/`svincolati.service.ts` del giro "controllo definitivo
   Bilancio" (2026-08-28), stesso stile.
2. Lancia due chiamate concorrenti alla funzione di servizio via `Promise.all`
   con importi diversi (uno più alto), in ENTRAMBI gli ordini di arrivo (test
   parametrico o due test) per non dipendere dal timing casuale del test runner.
3. Assert: `currentPrice` finale === importo più alto, esattamente un
   `AuctionBid.isWinning === true` e il suo `amount` è quello più alto,
   **entrambe le chiamate ritornano `success: true`** (la logica di retry deve
   far vincere comunque il bid più alto, non farlo fallire con un errore).

Aggiungere anche un test che il bid *più basso* arrivato per ultimo (dopo che
uno più alto è già stato accettato) venga correttamente RESPINTO con un
messaggio chiaro (non silenziosamente ignorato né va in retry loop fino a
esaurimento tentativi) — per verificare che il loop di retry si fermi
correttamente quando, alla rilettura, l'offerta non è più valida.

## 6. Validazione finale (dopo il fix)

1. `npm run typecheck` (o `tsc`) + `npm run lint` + `npm run test:all` verdi —
   standard del progetto per ogni commit su file di business logic.
2. Rilanciare la sezione di race del test empirico (§2a) — sia in locale (§2b,
   più veloce) sia, come conferma finale, un giro su produzione riusando la
   lega di test già esistente `cmte9igm9032zkjve2sx2g6rg` (ha ancora giocatori
   nel tabellone Rubata) o creandone una nuova con lo stesso script. Atteso:
   **tutti** i tentativi `pass: true` (`currentPrice === max sottomesso` e un
   solo `isWinning`), ripetuto almeno 3-5 volte per confidenza statistica (le
   race condition non sono deterministiche al 100% su un solo tentativo).
3. Verificare anche l'effetto collaterale osservato: chiudere un'asta subito
   dopo un burst di bid concorrenti non deve più dare HTTP 500 su
   `closeAuction`.

## 7. Cosa NON fare in questo giro

- Non toccare le regole di business (validazione budget/bilancio, slot ruolo,
  cap Primo Mercato) — solo il meccanismo di scrittura concorrente.
- Non introdurre nuove dipendenze (niente Redis/lock esterno: il CAS via
  Postgres `updateMany` basta, stesso pattern già collaudato in questo progetto).
- Non toccare `withRetry`/cold-start Neon (gap noto e separato, non oggetto di
  questo piano) né il rate-limiter/heartbeat in-memory (limite noto, non
  bloccante con 8 utenti secondo il load test di questa sessione).
- Non pulire le leghe di test abbandonate su produzione (`cmte9aq6x00166y8khwqkaais`,
  `cmte9dqzh0016h91k2aue47r6`, più le 2 leghe già note da prima) — debito
  esplicitamente rimandato da Pietro a un giro di pulizia complessiva futuro.
- Push/commit solo dopo conferma esplicita di Pietro (workflow confermato in
  questo ciclo di verifica pre-lancio: proponi, Pietro dice "sì", pusho).

## 8. Riferimenti

- Log/report della verifica empirica: `scripts/_rubata-full-verify.log`,
  `scripts/_rubata-full-verify-report.json`, script `scripts/_rubata-full-verify.mjs`
  (tutti non tracciati da git, restano nel repo).
- Pattern CAS di riferimento già in produzione: `src/services/auction.service.ts`
  righe ~1112-1128 (claim vincitore) e ~1621-1634 (claim NO_BIDS).
- Memoria di sessione: `verifica-pre-lancio-8-manager` (progetto Claude Code),
  aggiornamento 2026-08-29 "load test Rubata 8 utenti".
