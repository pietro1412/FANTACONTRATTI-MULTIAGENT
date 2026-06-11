# Sessione di Test Manuale — 2026-06-07

> Test end-to-end della piattaforma lato utente, fase per fase su una lega che evolve da zero.
> Tester: Pietro (più finestre incognito per i manager). Regia/tracking/correzioni: Claude.

## Setup ambiente

| Componente | Indirizzo | Note |
|---|---|---|
| Frontend | http://localhost:5174 | `:5173` occupato da altro progetto |
| API | http://localhost:3003 | |
| DB | localhost:5433 (Docker `fantacontratti-db`) | |

Credenziali (seed locale): vedi `CLAUDE.md`. Admin lega: `pietro@test.it` / `Pietro2025!`. Manager: `<nome>@test.it` / `<Nome>2025!` (michele, mirko, emmanuele, diego, marco, marcolino, emiliano).

## Modalità di lavoro

- **Percorso**: end-to-end da zero, una lega che evolve fase per fase.
- **Correzioni**: i bug **bloccanti** (impediscono di proseguire la fase) si correggono subito; tutto il resto va in batch a fine sessione.
- **Multi-manager**: Pietro pilota più finestre incognito loggate con manager diversi.

## Legenda

- **Severità**: 🔴 Bloccante · 🟠 Maggiore · 🟡 Minore · 🔵 UX/cosmetico
- **Decisione**: `FIX-SUBITO` · `FIX-FINE` · `DA-VALUTARE` · `WONTFIX`
- **Stato**: ⬜ Aperto · 🔄 In corso · ✅ Risolto · ❌ Scartato

---

## Registro osservazioni

| # | Fase | Osservazione | Severità | Decisione | Stato | Note |
|---|------|--------------|----------|-----------|-------|------|
| 1 | F0 Setup | In creazione lega si può impostare un **numero di partecipanti < 6**, mentre 6 è il minimo previsto dal dominio (min 6, max 20). Manca la validazione del minimo. | 🟠 Maggiore | FIX-FINE | ✅ | Risolto (agente): `validation.ts` min 6 + `CreateLeague` min 6 + guard service |
| 2 | F0 Setup | In creazione lega si possono impostare **slot ruolo inferiori ai default** (P3/D8/C8/A6). Quei valori devono essere i **minimi**: si possono aumentare, non diminuire. | 🟠 Maggiore | FIX-FINE | ✅ | Risolto (agente): min slot = default (P3/D8/C8/A6) form+Zod+service |
| 3 | F0 Setup | Il bottone **"Accetta" nel dropdown Inviti Pendenti** (`PendingInvites.tsx:82`) chiama `inviteApi.accept(token)` **senza teamName**, ma il backend (`invites.ts:121`) lo esige obbligatorio → l'accettazione dal banner fallisce **sempre** con "Il nome squadra deve avere almeno 2 caratteri". Funziona solo da "Vedi Dettagli". | 🟠 Maggiore | FIX-FINE | ✅ | Risolto (agente): "Accetta" del dropdown ora reindirizza a InviteDetail |
| 5 | F0 Setup | **Re-invito dopo kick → 500 all'accettazione.** `acceptInvite` (`invite.service.ts:215-221`) cerca il membro esistente solo per status `ACTIVE`/`PENDING`, ignorando `LEFT`; poi a riga 243 fa `leagueMember.create()` → un membro `LEFT` con stesso `(userId,leagueId)` viola il vincolo unique → eccezione → 500 "Errore interno del server". Stesso rischio probabile in `requestJoin`/approvazione lega pubblica. | 🟠 Maggiore | FIX-FINE | ✅ | Risolto (agente): `acceptInvite` riattiva membro LEFT (update); requestJoin già ok |
| 4 | F0 Setup | **Modal shared perde il focus a ogni carattere** (riprodotto su "Richiedi Partecipazione"): in `Modal.tsx:133-152` un unico `useEffect` gestisce keydown + focus iniziale e dipende da `handleKeyDown`→`onClose`; `onClose` è ricreata a ogni render del chiamante → l'effetto ri-runna a ogni keystroke e rifocalizza il **primo elemento (la X)**. **Trasversale a tutte le modali** con input come primo campo. | 🟠 Maggiore | FIX-FINE | ✅ | Risolto (agente): `Modal.tsx` effetto focus separato (deps `[isOpen]`) dal keydown |
| 7 | Trasversale (auth) | **Race condition di refresh token → sessione persa / "Lega non trovata".** Access token in memoria (TTL 15m); il client (`api.ts:85`) NON ha single-flight sul refresh: a ogni 401 lancia un refresh indipendente. Al reload o allo scadere, più chiamate concorrenti (`auth/me` + `getLeague`...) inviano lo **stesso** refresh token in parallelo; la 1ª lo ruota, la 2ª arriva col token revocato → il backend (`auth.ts:169-176`) rileva **reuse → revoca l'intera family** → 401 → la sessione muore e `getLeague` fallisce → LeagueDetail mostra "Lega non trovata" (`LeagueDetail.tsx:256`). | 🟠 Maggiore | FIX-SUBITO | ✅ | **Risolto** in `api.ts`: `refreshAccessToken` ora single-flight (promise condivisa `refreshPromise`); le 401 concorrenti aspettano un solo refresh → niente reuse spurio. tsc 0 errori. _Da confermare lato utente con hard reload + attesa >15m._ Residuo secondario → tracciato come **#8** |
| 8 | Trasversale (auth/UX) | **Messaggio fuorviante a sessione scaduta.** Quando la sessione scade davvero (refresh token > 7 giorni, o family revocata), `getLeague` torna 401 e `LeagueDetail.tsx:256` mostra "Lega non trovata" invece di "Sessione scaduta, effettua di nuovo il login". L'utente crede che la lega sia sparita. Vale per ogni pagina che tratta il fallimento auth come "risorsa non trovata". | 🟡 Minore | FIX-FINE | ✅ | Risolto (agente): `ApiResponse.authExpired` + LeagueDetail mostra "Sessione scaduta" |
| 9 | F1 Primo Mercato | **Input offerta non si auto-valorizza in real-time.** L'auto-valorizzazione a `currentPrice+1` esiste solo in `loadCurrentAuction` (`useAuctionRoomState.ts:222-223`), che gira sul polling (30s). L'handler Pusher `onBidPlaced` (`:95-121`) aggiorna `currentPrice` istantaneamente ma NON ri-valorizza `bidAmount` → all'arrivo dell'offerta avversaria l'input resta al valore vecchio finché non scatta il polling. Atteso: a ogni nuova offerta il campo si porta a offerta+1 (rispettando un valore più alto già digitato). | 🟠 Maggiore | FIX-SUBITO | ✅ | **Risolto** in `onBidPlaced` (`useAuctionRoomState.ts`): `setBidAmount(prev => (parseInt(prev)||0) <= data.amount ? String(data.amount+1) : prev)` dopo `setAuction`. tsc 0 errori. _Da confermare lato utente._ |
| 10 | F1 Primo Mercato | **Modale "Transazione Completata" — rischio misclick ricorso.** La modale post-asta ha "Conferma" e "Invia Ricorso" sempre entrambi attivi: scritto il motivo del ricorso, si può ancora cliccare "Conferma" per errore (azione importante/irreversibile). Atteso: appena si imposta un ricorso (motivo compilato), nascondere/disabilitare "Conferma" e mostrare "Invia Ricorso" + "Annulla richiesta ricorso"; solo annullando il ricorso si può confermare la transazione. | 🟡 Minore | FIX-FINE | ✅ | Risolto (agente): bottoni condizionali su `isAppealMode` (normale: Conferma+Ricorso; ricorso: Annulla richiesta+Invia Ricorso) |
| 11 | F1 Primo Mercato | **Ricorso e profezia post-asta non vengono inviati (wiring rotto).** In `AuctionRoom.tsx:292` la `AcknowledgmentModal` riceve `onAcknowledge={() => void handleAcknowledge(false)}`: una arrow che **scarta gli argomenti**. La modale chiama `onAcknowledge(false, true)` su "Invia Ricorso" e `onAcknowledge(!!prophecy)` su "Conferma", ma entrambi i parametri (`hasProphecy`, `isAppeal`) vengono ignorati → `handleAcknowledge(false)` sempre. Conseguenze: il **ricorso non parte** (verificato: asta Audero `COMPLETED` a Michele, 0 record in `AuctionAppeal` per la lega E2E) e la **profezia non viene mai salvata**. La schermata "Modifica Contratto" vista è il flusso normale del vincitore. | 🟠 Maggiore | FIX-SUBITO | ✅ | Fix riga 292: `onAcknowledge={(hasProphecy, isAppeal) => void handleAcknowledge(hasProphecy, isAppeal)}` (o passare `handleAcknowledge` diretto). **Da verificare post-fix**: flusso vincitore+ricorso (deve attendere decisione admin, non aprire subito modifica contratto). Collegato a #10. **Risolto (agente)**: wiring `onAcknowledge` propaga `hasProphecy`/`isAppeal`. |
| 6 | F1 Primo Mercato | **Ritardo all'avvio asta**: avviato il mercato dall'admin, gli altri client restano sulla "Sala Riunioni" (loading "L'admin sta definendo l'ordine dei turni…") per un tempo percepibile prima di entrare. L'uscita dalla waiting room arriva sul **polling di fallback** (`useAuctionRoomState.ts:399` → 5s disconnesso / 30s connesso) anziché istantanea via Pusher; l'evento di transizione di fase / `auction-started` non sblocca subito i client. | 🟡 Minore | FIX-FINE | ✅ | Risolto (agente): `setFirstMarketTurnOrder` emette `auction-started`; `onAuctionStarted` chiama `loadFirstMarketStatus` → uscita real-time dalla waiting room |

---

| 12 | F1 Primo Mercato | **Invio ricorso (lato manager) richiede molti click** prima di andare a buon fine. Da indagare nel flusso `handleAcknowledge`/modalità ricorso (#10/#11 appena introdotti): possibile problema di stato (`ackSubmitting`, `isAppealMode`, pendingAck non aggiornato) o bottone che non risponde al primo click. | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto (agente): il ramo ricorso non concatena più `acknowledgeAuction` (falliva perché l'asta è già in APPEAL_REVIEW) → 1 click, modale si chiude subito |
| 13 | F1 Primo Mercato | **Gestione ricorso admin sbalza fuori dalla maschera asta.** Cliccando per gestire il ricorso, l'admin viene portato a `/leagues/:id/admin?tab=appeals` invece di restare inline. Causa: bottoni del vecchio flusso non disattivati — `AuctionRoomModals.tsx:330` ("Gestisci Ricorsi") e `:453` ("Gestisci Ricorso") fanno `onNavigate('admin',{tab:'appeals'})`. Contraddice il requisito (gestione inline nel pannello Azioni Admin). | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto (agente): `AppealReviewModal` per admin mostra Accetta/Rifiuta inline; rimosso "Gestisci Ricorsi" che navigava via. Gestione 100% nella maschera asta |

| 14 | F1 Primo Mercato | **Dopo ricorso accettato, la modale "Pronto a Riprendere?" non si chiude (admin bloccato).** L'asta riprende (status→ACTIVE) ma `AwaitingResumeModal` (`AuctionRoomModals.tsx:633`) resta visibile finché `appealStatus.auctionStatus==='AWAITING_RESUME'`, aggiornato solo dal polling di `loadAppealStatus` (5-30s). Manca un evento real-time al completamento del resume → l'admin (e gli altri) restano dietro la modale mentre l'asta procede; "Forza Pronti" dà "L'asta non è in attesa di ripresa" (stato già ripartito). | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto (agente): nuovo evento `auction-resumed` emesso nei 3 punti di ripresa → ACTIVE; handler client chiude la modale su tutti (loadAppealStatus+loadPendingAck+loadCurrentAuction) |

| 15 | F1 / trasversale | **Sincronia tra client non uniforme (tema sistemico).** Alcune transizioni di stato dell'asta arrivano ai client via Pusher (istantanee), altre solo via polling (5-30s) → un client vede il prompt/contatore (es. comparsa "Conferma pronti" / "X/8" dopo la chiusura) prima dell'altro. Tre falle: (a) copertura eventi incompleta su alcune transizioni; (b) handler che aggiornano solo `auction` e non `pendingAck`/`appealStatus`/stato manager; (c) nessun re-sync robusto se un client perde un evento. Stessa radice di #6 e #14. | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto (agente): evento generico `auction-state-changed` su tutte le transizioni + handler reload completo + re-sync alla riconnessione Pusher + polling adattivo (3s attesa / 30s asta). test:all 1701 verdi |

| 16 | F1 / architettura | **Chiusura asta per scadenza timer è "lazy"** (emersa dall'audit #15): l'asta non si chiude da sola allo scadere del timer, ma solo quando un client chiama `getCurrentAuction` (auto-close lazy). Mitigato dal polling adattivo 3s in fase di attesa + timer client-side che mostra la modale a 0s, quindi latenza percepita minima. Renderla push proattiva richiederebbe uno scheduler server-side (job/cron). | 🟡 Minore | CHIUSA | ✅ | Diagnosi rivista: NON è lazy-passiva. Il timer client a 0 (`useAuctionRoomState.ts:419-453`) chiama subito la chiusura server-side e l'evento `auction-closed` (#15) propaga a tutti → chiusura entro ~1s se c'è ≥1 client. Caso limite "zero client connessi" non risolvibile in serverless senza cron; **accettato** (in asta live i manager guardano). Decisione utente: client-trigger sufficiente, niente backstop cron |

| 17 | F1 Primo Mercato | **Esito ricorso respinto invisibile al ricorrente.** Quando l'admin risolve un ricorso, la fase passa a `AWAITING_APPEAL_ACK` e appare `AppealAckModal` con l'esito (accolto/respinto). Ma `AuctionRoomModals.tsx:510-519`: l'admin **auto-conferma e dopo 500ms forza l'ack di tutti** → la fase si chiude per tutti prima che il manager ricorrente (Michele) possa leggere "ricorso respinto". La modale sparisce quasi subito. | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto (agente): rimosso auto-ack/force-all admin; ognuno vede l'esito e clicca "Ho preso visione". Bottone [TEST] manuale mantenuto |

| 18 | F1 / infra | **Rate limit sul login blocca i test multi-utente.** `authLimiter` (`src/api/index.ts:73`) limitava login/register a 100 req/15min in dev; con 8 manager su più finestre + ri-login frequenti (sessione persa al refresh incognito) si esaurisce → "Troppe richieste, riprova tra qualche minuto" → impossibile accedere. | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto: `skip: () => NODE_ENV !== 'production'` → nessun rate limit login in locale, invariato in prod. Reload backend azzera il contatore |

| 19 | F1 Primo Mercato | **"Conferma scelta giocatore" visibile agli altri solo dopo ~20s (polling).** I bid sono istantanei (Pusher OK) perché `onBidPlaced` usa i dati dell'evento; invece `onNominationConfirmed` (hook:150) ricaricava solo `loadCurrentAuction`+`loadReadyStatus`, NON `loadFirstMarketStatus` che fa passare i non-nominator dalla vista "attesa nomina" alla vista asta → restavano indietro fino al polling. È il caso (b) di #15 mancato su questa transizione. | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto: `onNominationConfirmed` ora ricarica anche `loadFirstMarketStatus`+`loadManagersStatus` |

| 20 | F1 Primo Mercato | **Modale "Modifica Contratto" del vincitore non si chiude quando un ricorso viene accettato.** Sequenza (DB coerente, no corruzione): Michele vince Pessina → modale Modifica Contratto; ricorso accettato → asta riaperta (rollback + AWAITING_RESUME); ma la modale `pendingContractModification` di Michele NON si chiude → resta bloccato sulla modifica di un giocatore non più suo ("michele non lo vede"), mentre l'admin vede l'asta riaperta. `resolveAppeal` emette `auction-state-changed` ma l'handler client non azzera `pendingContractModification`. | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto in `onAuctionStateChanged` (`useAuctionRoomState.ts`): se `data.reason === 'appeal-accepted'` → `setPendingContractModification(null)`. Sicuro perché `appeal-accepted` è emesso SOLO quando un'aggiudicazione viene annullata da ricorso accolto, mai nel flusso vincita-senza-ricorso. tsc 0 errori, AuctionRoom.test 14/14 verdi |
| 21 | F1 / integrità | **`resolveAppeal(ACCEPTED)` non è atomico.** Le operazioni di rollback (delete roster/contratto, ripristino budget, delete movement/acks, update asta→AWAITING_RESUME, mark ACCEPTED) sono chiamate Prisma separate, NON in `$transaction`. Non si è manifestata corruzione (stato attuale coerente), ma un fallimento a metà lascerebbe stato incoerente (ricorso ACCEPTED senza rollback applicato). | 🟡 Minore | FIX-FATTO | ✅ | Risolto (agente, ok utente): rami ACCEPTED e REJECTED di `resolveAppeal` avvolti in `prisma.$transaction` (rollback atomico); Pusher fuori dalla transazione; logica/ordine/valori invariati. 170 test verdi |
| 31 | F1 / ready-check | **Ready-check di ripresa saltato: la modale "Pronto a Riprendere?" appare e sparisce subito, il timer riparte senza che i manager confermino.** `AwaitingResumeModal` (`AuctionRoomModals.tsx:625-635`) aveva un auto-ready dell'admin (auto `onReadyToResume` + `setTimeout(onForceAllReadyResume,500)`) → tutti marcati pronti → resume immediato → nessuna consapevolezza. Stesso pattern del #17 (su AppealAckModal). Vale per ricorso accettato E annullo movimento (#29, stessa modale). | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto: rimosso l'auto-ready/auto-force dell'admin; il ready-check attende il "SONO PRONTO" manuale di ciascuno; resta il bottone [TEST] Forza Tutti Pronti |
| 30 | F1 / Azioni Admin | **Dopo annullo movimento + ri-asta, la conferma dà "Hai già confermato questa transazione" (contatore 0/8).** `reopenAuction` riapre la STESSA asta ma la sua transazione non cancellava gli `AuctionAcknowledgment` della chiusura precedente (`resolveAppeal` invece li cancella) → alla ri-conclusione la vecchia conferma dell'utente resta nel DB e blocca la nuova. | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto: aggiunto `tx.auctionAcknowledgment.deleteMany({ where: { auctionId } })` nella transazione di `reopenAuction` (step 3b, come resolveAppeal) |
| 29 | F1 / Azioni Admin | **"Annulla ultimo movimento" riavvia l'asta subito, senza avvisare gli utenti.** Atteso (coerenza con ricorso accettato): l'annullo deve mettere l'asta in **AWAITING_RESUME** → tutti i client ricevono indicazione puntuale ("l'admin ha annullato l'ultimo movimento, si riparte dall'ultima offerta valida per [giocatore]") → ready-check: tutti confermano "sono pronto" → poi l'asta riparte. L'admin deve avere il bottone [TEST] "Forza Tutti Pronti" (simula conferme). | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto (agente): `reopenAuction` → AWAITING_RESUME + `resumeReason='movement-reverted'`; AwaitingResumeModal messaggio differenziato; ready-check + [TEST] Forza Tutti Pronti + resume. Colonna `Auction.resumeReason` applicata al DB locale (`db push` ok, additiva); client Prisma rigenerato. **Richiede riavvio `dev:api` per caricare il client aggiornato.** 1703 test verdi. ⚠️ Errore runtime "Unknown argument winnerId" = sintomo del client Prisma VECCHIO in memoria (senza `resumeReason`): l'inferenza XOR sceglie il ramo checked dove `winnerId` non è ammesso. Fix codice corretto; risolto dal **restart del processo `dev:api`** (ricarica `@prisma/client`) |
| 28 | F1 / Azioni Admin | **"Annulla ultimo movimento" disponibile solo durante la finestra di conferma.** `canReopenAuction={!!props.pendingAck?.winner}` (`AuctionRoomLayout.tsx:68`): una volta forzate/completate le conferme e passati alla nomina successiva, `pendingAck` è null → bottone disabilitato → l'admin non può più annullare l'ultima aggiudicazione. Decisione utente: deve restare disponibile **anche dopo, finché non parte la prossima asta**, riaprendo l'ultima asta conclusa e riportando il turno alla nomina di quel giocatore. | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto (agente): `getCurrentAuction` espone `lastReopenableAuction` (ultima COMPLETED, solo se nessuna ACTIVE); `reopenAuction` ripristina turno (`currentTurnIndex`/`currentRole` da nominatorId+player.position) e annulla nomina pendente + evento real-time; rifiuta se nuova asta già in corso. 1703 test verdi. ⚠️ niente test DB-backed sul rollback turno → verificare a mano |
| 27 | F1 / Azioni Admin | **Timer asta: nel posto sbagliato + cambio non recepito durante l'asta.** (a) Il selettore "Timer Asta" (5–60s) è nella sezione "Controlli Admin (TEST)" anziché nel pannello ufficiale "Azioni Admin" (deve essere sempre disponibile all'admin). (b) `updateSessionTimer` (`auction.service.ts:620`) aggiorna solo `auctionTimerSeconds` (reset futuri) ma NON applica il nuovo valore all'asta in corso né emette evento real-time → cambiando il timer tra un'offerta e l'altra non si vede effetto. | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto (agente): selettore spostato in `AdminActionsPanel`; `updateSessionTimer` riparametra l'asta in corso + emette `auction-state-changed`; **causa vera del "non recepito"**: wiring `onUpdateTimer` scartava il valore cliccato (come #11) → corretto. 1703 test verdi |
| 25 | F1 Primo Mercato | **teamName incoerente nello storico offerte tra client.** Un client mostra "Michele (Michele FC)", l'altro solo "Michele" finché non ricarica. Causa: l'evento Pusher `onBidPlaced` porta solo l'username (`teamName: null`); il team compare solo al reload dal DB. | 🔵 UX | FIX-FINE | ✅ | Risolto: `teamName: string \| null` aggiunto a `BidPlacedData` (pusher.service + pusher.client); `placeBid` (auction.service) carica `bidder.teamName` nel select e lo emette nel payload; `onBidPlaced` (hook) usa `data.teamName` invece di `null`. Bot primo mercato riusa `placeBid` → coperto. Dedup #23 invariata |
| 26 | F1 Primo Mercato | **BLOCCANTE — modale "Modifica Contratto" si blocca su modifica invalida.** Aumentando la durata senza aumentare l'ingaggio (es. 1M/3s→1M/4s) il backend (regola corretta `contract.service.ts:104-109`) risponde **400**, ma: (a) la validazione locale della modale (`ContractModifier.tsx` `preview.isValid`) NON applica quella regola → mostra anteprima valida e abilita "Conferma"; (b) su errore `isSubmitting` non viene resettato e `handleContractModification` (hook) non propaga l'errore né sblocca → modale **non chiudibile, impossibile proseguire**. | 🔴 Bloccante | FIX-SUBITO | ✅ | Risolto: `AuctionRoom.tsx` passa `increaseOnly={true}` alla `ContractModifierModal` → la validazione locale applica la stessa regola di `modifyContractPostAcquisition` (no taglio, durata cresce solo se ingaggio cresce, max 4): 1M/3s→1M/4s ora è preview INVALIDO + "Conferma" disabilitato. Sblocco modale: `handleContractModification` (hook) ora fa `throw` su errore → `handleConfirm` lo cattura, mostra in `error` e il `finally` resetta `isSubmitting`; "Mantieni contratto" resta cliccabile. +2 test ContractModifier. Regola backend invariata |
| 24 | F1 / infra | **Rate limiter GLOBALE (`apiLimiter`) esaurito in dev blocca tutte le API** ("Troppe richieste. Riprova tra qualche minuto."). Distinto da #18 (era solo `authLimiter` sul login). `apiLimiter` (`api/index.ts:63`, max 2000 req/15min su tutto `/api`) si esaurisce col polling intenso multi-client della sessione di test → anche il login fallisce. | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto: `skip: () => NODE_ENV !== 'production'` anche su `apiLimiter` (come #18). Reload backend azzera il contatore |
| 23 | F1 Primo Mercato | **Offerta duplicata nello storico sul client che la triggera.** Chi piazza/triggera un bid (es. admin con "Simula Offerta Bot") riceve la stessa offerta due volte: una dall'evento Pusher `onBidPlaced` (bid ottimistica, `teamName` null) + una dal reload `loadCurrentAuction` (bid reale dal DB con team) → doppione nello storico ("Marcolino" + "Marcolino (Marcolino FC)" stesso importo/orario). Gli altri client ne vedono una sola. Cosmetico (currentPrice corretto). | 🟡 Minore | FIX-SUBITO | ✅ | Risolto: dedup in `onBidPlaced` — non aggiunge la bid ottimistica se già presente (stesso `amount`+`username`) |
| 22 | F1 / bot | **I percorsi bot non emettono eventi Pusher → gli altri client vedono nomina/conferma/offerta solo al polling (~20s).** `bot.service.ts` (`botNominate`/`botConfirmNomination`/bot bid) cambia lo stato nel DB ma NON emette `triggerNominationPending`/`triggerNominationConfirmed`/`triggerBidPlaced` come i path umani. Gli handler client (`handleBotNominate`/`handleBotConfirmNomination`) ricaricano solo localmente (chi clicca). Spiega il ritardo visto usando i bottoni "[TEST] Simula Scelta/Conferma". Bug reale anche per i **bot di produzione** (feature svincolati). | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto (agente): `bot.service.ts` emette `triggerNominationPending`/`triggerNominationConfirmed`/`triggerAuctionStarted` come i path umani; bot bid già via `placeBid`; svincolati bot già coperto. 1701 test verdi |

## F2 — Verifica automatica apertura Mercato Ricorrente (2026-06-09)

Apertura eseguita oggi (sessione ricorrente `cmq6fav4j04kzx6pmj7cuykq3`, creata 09:14). Verifica di dominio non distruttiva (`scripts/test-session/verify-f2-opening.ts`, ricostruzione before/after da `ContractHistory`+`PlayerMovement`): **11/11 PASS**.

| Effetto | Atteso | Verificato |
|---|---|---|
| Decremento durata | tutti i contratti attivi −1, salary invariato, clausola ricalcolata | ✅ 154 `DURATION_DECREMENT`, 0 errori durata/clausola |
| Svincolo per scadenza (dur 1→0) | release senza clausola, roster RELEASED, movimento RELEASE price 0 | ✅ 62 `AUTO_RELEASE_EXPIRED`, 62 RELEASE price 0, 0 contratti residui |
| Snapshot inizio sessione | 1 `SESSION_START` per membro attivo (in `ManagerSessionSnapshot`) | ✅ 8/8 |
| Auto-svincolo RITIRATI | release RITIRATO (NOT_IN_LIST) gratuito, movimento RETIREMENT | ⚠️ ramo eseguito su **0 giocatori** (seed senza RITIRATI) — non realmente esercitato |
| Conservazione | attivi_dopo + svincolati = attivi_prima | ✅ 154 + 62 = 216 |

**Gap di copertura**: il ramo RITIRATI (`autoReleaseRitiratiPlayers`) e i casi RETROCESSO/ESTERO (gestiti in fase CONTRATTI, F5) non sono esercitati perché il seed non contiene giocatori usciti. Per testarli serve seedare ≥1 `RITIRATO` prima dell'apertura (richiede reset).

### Re-test controllato con usciti (2026-06-09, post-decisione utente)

Per chiudere il gap, lega **ricostruita pulita** alla situazione "Primo Mercato COMPLETED, rose piene (216 contratti, durate miste), 0 sessioni ACTIVE" + seed giocatori usciti. Catena di script (in `scripts/test-session/`): `cleanup-recurrent-e2e` (elimina sessione ricorrente + trade) → `reset-e2e-to-first-market-pending` → `prepare-f2-fill-rosters` → `close-first-market` → `seed-exits-e2e`.

**Seed usciti** (contratti forzati a durata 3, così l'uscita è imputabile solo al ramo "usciti", non alla scadenza): 2 RITIRATO (Maignan/Pietro, Carnesecchi/Michele), 1 RETROCESSO (Di Gregorio/Mirko), 1 ESTERO (Sommer/Emmanuele).

**Baseline pre-apertura** (`baseline-f2.ts`): 216 contratti attivi, durate `{1:62, 2:65, 3:46, 4:43}`.

**Attese all'apertura** (da verificare con `verify-f2-postopen.ts` dopo l'avvio UI): 62 `AUTO_RELEASE_EXPIRED` + 62 `RELEASE`, 154 `DURATION_DECREMENT`, **2 `RETIREMENT`** (ritirati svincolati), retrocesso+estero **mantenuti attivi** (durata 2), 8 `SESSION_START` snapshot, 152 contratti attivi dopo.

**Stato corrente**: apertura eseguita dall'admin via UI; verifica automatica post-apertura `verify-f2-postopen.ts` → **14/14 PASS** (62 svincoli scadenza, 154 decrementi, 2 RETIREMENT, retrocesso+estero mantenuti a durata 2, 8 snapshot, 152 attivi). Backend F2 confermato corretto end-to-end.

### Osservazioni F2

| # | Fase | Osservazione | Severità | Decisione | Stato | Note |
|---|------|--------------|----------|-----------|-------|------|
| 32 | F2 Apertura ricorrente | **Riepilogo eventi di apertura mai mostrato all'admin.** `createAuctionSession` (backend) restituisce un riepilogo ricco — `message` ("Contratti decrementati: 154, Svincolati per scadenza: 62, Ritirati auto-rilasciati: 2") + `data.contractsDecremented`/`playersReleased`/`ritiratiAutoReleased` — ma `handleConfirmCreateSession` (`LeagueDetail.tsx:186-201`) nel ramo `success` **scarta `result.message` e `result.data`**: chiude la modale e ricarica solo la lista sessioni, senza toast né modale di riepilogo. L'admin (e i manager) non ricevono alcun feedback su cosa è successo all'apertura. Unica traccia parziale: tab "Riepilogo" (overview) → sezione Movimenti (Cessioni 62 + RETIREMENT 2); il **decremento durata (154) non è mostrato da nessuna parte** (è in ContractHistory per manager). È l'esatto sintomo notato in sessione ("non vedo compilato nulla"). | 🟠 Maggiore | FIX-SUBITO | ✅ | Risolto: nuovo `MarketOpeningSummaryModal` (`src/components/league-detail/`) mostra decremento + svincoli scadenza (con nomi) + ritirati (con nomi); `handleConfirmCreateSession` cattura `result.data` nel ramo success per il mercato ricorrente e apre la modale. tsc 0 errori, LeagueDetail 8/8 verdi, lint pulito. **Confermato lato utente**: modale apparsa con decremento 154 + svincoli scadenza 62 + ritirati 2. Backend ri-verificato 14/14. |
| 33 | F2 / overview | **`RETIREMENT` senza label umana nel riepilogo Movimenti.** `movementTypeLabels` (`SessionCard.tsx:284-291`) non mappa `RETIREMENT` (né `RELEGATION_*`, `ABROAD_*`, `INDEMNITY_*`): nella tab Riepilogo i 2 svincoli ritirati appaiono come stringa grezza "RETIREMENT" invece di es. "Svincoli ritirati". | 🔵 UX | FIX-SUBITO | ✅ | Risolto: aggiunte label `RETIREMENT`/`RELEGATION_RELEASE`/`RELEGATION_KEEP`/`ABROAD_COMPENSATION`/`ABROAD_KEEP` a `movementTypeLabels`. |

## F3 — Verifica automatica backend scambi (2026-06-09)

Esercitate le funzioni di produzione di `trade.service` sulla sessione ricorrente ATTIVA (OFFERTE_PRE_RINNOVO), con snapshot/restore non distruttivo (`scripts/test-session/verify-f3-trades.ts`): **31/31 PASS**, nessuna anomalia.

| Scenario | Verificato |
|---|---|
| Creazione offerta valida | ✅ PENDING, scadenza ~24h, `involvedPlayers` corretti |
| Validazioni negative | ✅ offerto non posseduto / richiesto non posseduto dal destinatario / budget > disponibile / offerta a se stessi → tutti rifiutati |
| Rifiuto | ✅ solo il destinatario può rifiutare; stato → REJECTED |
| Controfferta | ✅ originale → COUNTERED, nuova offerta PENDING con from/to invertiti |
| Accettazione + trasferimento | ✅ giocatori+contratti trasferiti, `acquisitionType=TRADE`, budget aggiornati (offerto/richiesto), 2 movimenti TRADE |
| Anti-reverse | ✅ scambio inverso nella stessa sessione rifiutato |
| Auto-invalidazione | ✅ offerta conflittuale (giocatore condiviso) → INVALIDATED all'accettazione dell'altra; warning di sovrapposizione |
| Indicatore trattative | ✅ conteggio/pairs delle pending tra altri, esclude chi interroga e le proprie offerte |

Stato ripristinato (rose, contratti, budget allo snapshot; trade+movimenti della sessione cancellati). Lega lasciata pulita in OFFERTE_PRE_RINNOVO.

### F3 — E2E UI + real-time (Playwright, 3 utenti reali)

Spec `tests/e2e/f3-trades-realtime.spec.ts` (multi-context Michele/Mirko/Diego, snapshot+restore via DB nel before/afterAll): **5/5 PASS** sia headless sia headed. Copre la parte che il backend non tocca (rendering + Pusher):

| Passo | Esito |
|---|---|
| Michele crea offerta a Mirko dalla deal room (1 ceduto + 1 richiesto) | ✅ offerta in "Inviate" |
| Mirko vede l'offerta in "Ricevute" real-time | ✅ **0.45–0.67s** (≪ polling) |
| Diego (estraneo) vede l'indicatore "trattative in corso" real-time | ✅ **0.03–0.07s** |
| Mirko accetta → conferma UI + trasferimento sul DB | ✅ 1 trade ACCEPTED, 2 movimenti TRADE |

Nessuna anomalia. **F3 completo: backend (31/31) + UI/real-time (5/5).**

## F4 — Fase Premi (2026-06-10)

**Backend** (`scripts/test-session/verify-f4-prizes.ts`, snapshot/restore di budget+fase): **35/35 PASS**. Init (config 100M + categoria sistema "Indennizzo Partenza Estero" 50M/membro), re-incremento base (+validazioni neg/non-int/non-admin), categorie custom (dup/empty/delete-system rifiutati), premi per manager (upsert), indennizzo ESTERO custom (Sommer → categoria sistema "Indennizzo - Sommer"; non-ESTERO rifiutato), **finalize** (accredito budget = base + premi NON-sistema; indennizzi di sistema ESCLUSI; verificato per-membro), re-finalize/setPrize/createCategory dopo finalize rifiutati, **correzione admin post-finalize** (delta a budget solo per categorie non-sistema), getData leggibile da manager.

### Osservazione F4

| # | Fase | Osservazione | Severità | Decisione | Stato | Note |
|---|------|--------------|----------|-----------|-------|------|
| 34 | F4 / Premi (dev) | **Auto-init fase premi va in race → "Errore interno del server" al primo accesso alla pagina /prizes.** `PrizePhaseManager.fetchData` auto-inizializza quando `getData` torna "non inizializzata", ma NON aveva guard anti-doppia-chiamata; con React **StrictMode** (dev, `main.tsx`) l'effect gira 2 volte → 2 `getData` (400) → 2 `initialize` concorrenti. `initializePrizePhase` non è idempotente (TOCTOU: check `existingConfig` poi `prizePhaseConfig.create`) → la seconda viola l'unique `marketSessionId` (P2002) → 500 → la UI mostra "Errore interno del server". Un reload risolveva (config ormai creato). Solo dev (StrictMode strippato in prod), ma è l'ambiente di test. | 🟠 Maggiore (dev) | FIX-SUBITO | ✅ | Risolto (UI, non file critico): in `PrizePhaseManager` la `initialize` è ora condivisa via `initPromiseRef` (useRef) → entrambe le invocazioni dell'effect attendono la STESSA promise, parte una sola `initialize`. Verificato: E2E test 1 auto-init senza "Errore interno del server"; log API mostra **una sola** POST /init (200), niente P2002/500; PrizePhasePage 12/12, tsc 0, lint 0 errori. Service `initializePrizePhase` non toccato (file critico). |

**E2E UI** (`tests/e2e/f4-prizes.spec.ts`, single-context admin, snapshot/restore via DB): **4/4 PASS** (headless + headed). Test 1 valida il fix #34 (auto-init senza 500); poi modifica re-incremento base 100→110 + Salva (persistito), creazione categoria custom, **finalizzazione** → 8 budget accreditati +110 + `config.isFinalized`. Stato lega ripristinato (fase OFFERTE_PRE_RINNOVO, budget, config/categorie cancellati).

**Nota infra**: durante F4 è stato necessario diagnosticare il 500 della pagina premi → causa #34. Il processo `dev:api` è stato riavviato (ora gira come processo background gestito da Claude su :3003); Vite (:5174) intatto. Il riavvio NON era la causa del 500 (è #34, riproducibile anche su API fresca).

**F4 completo: backend (35/35) + UI/admin E2E (4/4). 1 anomalia trovata e RISOLTA (#34, race auto-init StrictMode → fix `initPromiseRef` in `PrizePhaseManager`).**

## F5 — Fase Contratti (2026-06-10)

**Backend** (`scripts/test-session/verify-f5-contracts.ts`, snapshot/restore COMPLETO contratti+rose+budget+fase con verifica integrità): **29/29 PASS**. Formule pure (`calculateReleaseCost`=ceil(s·d/2), `isValidRenewal` tutti i rami: salary↓, durata↑-senza-salary, >MAX, spalma valido/invalido), `renewContract` standalone (rinnovo valido + clausola ricalcolata, salary↓ rifiutato, ownership), spalma dur1→2, `releasePlayer` standalone (costo normale scalato dal budget; **GRATIS** per ESTERO Sommer e RETROCESSO Di Gregorio), pipeline `consolidateContracts` (rinnovo applicato + `ContractConsolidation` creato + `preConsolidationBudget` salvato), `getConsolidationStatus`, **lock post-consolidamento** (renew/re-consolidate bloccati), `canAdvanceFromContratti`=false se non tutti consolidati.

**E2E UI** (`tests/e2e/f5-contracts.spec.ts`, manager Diego senza usciti): **2/2 PASS**. Apertura /contracts in fase CONTRATTI → click **Consolida** → record `ContractConsolidation` sul DB + bottone Consolida rimosso (lock UI). Restore: record eliminato, `preConsolidationBudget` azzerato, fase ripristinata.

**Gap di copertura (per il giro manuale)**: la pipeline KEEP/RELEASE **esteri/retrocessi via consolidamento** (`saveDrafts` exitDecisions → `consolidateContracts` con logica indennizzi `RELEASE_ESTERO`/`KEEP_ESTERO`/income) NON è esercitata a fondo: il backend test copre lo svincolo *standalone* degli usciti (gratis) ma non il ramo draft+indennizzo dentro il consolidamento. Da validare manualmente (Mirko=Di Gregorio RETROCESSO, Emmanuele=Sommer ESTERO ancora in rosa). Anche `newContracts` (contratti per giocatori senza contratto) e il dettaglio rinnovo/svincolo *dalla UI* per-giocatore restano per il giro manuale.

**F5 completo (core): backend (29/29) + UI consolidamento E2E (2/2). Nessuna anomalia. Gap KEEP/RELEASE-indennizzi documentato.**

## F6 — Fase Rubata (2026-06-10)

**Backend** (`scripts/test-session/verify-f6-rubata.ts`, snapshot/restore campi rubata sessione + rubataOrder membri + fase): **18/18 PASS**. `setRubataOrder` (admin-only, ordine completo obbligatorio, persistenza su sessione + `member.rubataOrder` 1..8 = ultimo in classifica sceglie per primo), `generateRubataBoard` (**prezzo base = clausola + ingaggio** per ogni contratto attivo; board 152/152; ordinamento per membro secondo rubataOrder + ruoli P→D→C→A; stato → READY_CHECK), `getRubablePlayers` (rubataBasePrice = clausola+ingaggio), RubataPreference CRUD (watchlist/autoPass/maxBid/priority, upsert, delete).

**E2E UI** (`tests/e2e/f6-rubata.spec.ts`, admin): **2/2 PASS**. /rubata in fase RUBATA → "Conferma Ordine" (rubataOrder 8 membri sul DB) → "Genera Tabellone" (board 152 giocatori, stato READY_CHECK). Restore campi sessione + ordine membri + fase.

**Gap di copertura (per il giro manuale)**: l'**asta forzata stateful** — offer/bid/ready-check/ack, "asta NON rifiutabile dal proprietario", "se nessuno offre il giocatore resta", trasferimenti e budget — non è esercitata (flusso board multi-turno complesso, multi-manager + real-time). È il cuore di F6 da validare a mano.

**F6 completo (core): backend (18/18) + UI setup E2E (2/2). Nessuna anomalia. Gap asta-forzata stateful documentato.**

## F7 — Fase Svincolati (2026-06-10)

**Backend** (`scripts/test-session/verify-f7-svincolati.ts`, snapshot/restore campi svincolati sessione + fase): **23/23 PASS**. `setSvincolatiTurnOrder` (admin-only, ordine esplicito + **auto-reverse da rubataOrder**, persistenza, stato READY_CHECK), `getFreeAgents` (pool = 435 giocatori IN_LIST non in rosa; nessuna sovrapposizione con rose), `setSvincolatiTimer` (admin, range 10-300; fuori range rifiutato), `nominateFreeAgent` (turno corrente, free-agent, budget ≥2, → NOMINATION), `confirmSvincolatiNomination` (solo nominatore), `passSvincolatiTurn` (turno + avanzamento indice + passedMembers).

**E2E UI** (`tests/e2e/f7-svincolati.spec.ts`, admin): **1/1 PASS**. /svincolati in ASTA_SVINCOLATI → "Conferma e Inizia Aste" → svincolatiTurnOrder (8 membri) + stato READY_CHECK sul DB. Restore campi sessione + fase.

**Gap di copertura (per il giro manuale)**: l'**esecuzione asta svincolati** — ready-check completo, bid + reset timer ad ogni offerta, chiusura → assegnazione + contratto (10% prezzo, 3 sem), real-time multi-manager, bot nomination/bid. È il cuore di F7 da validare a mano.

**F7 completo (core): backend (23/23) + UI setup E2E (1/1). Nessuna anomalia. Gap esecuzione-asta stateful documentato.**

## F8 — Post-asta + trasversali (2026-06-10)

**Backend** (`scripts/test-session/verify-f8-postasta.ts`, snapshot/restore): **10/10 PASS**. Scambi in **OFFERTE_POST_ASTA_SVINCOLATI** (createTradeOffer/acceptTrade abilitati nel secondo round; trasferimento + 2 movimenti TRADE) + trasversali read-only: `getLeagueMovements` (include i 64 movimenti apertura F2), `getLeagueFinancials` (8/8 squadre, bilancio = budget − monte ingaggi coerente), `getLeagueStatistics`. Ricorsi/appeals già esercitati e corretti in F1 (#10-#21, #31).

**E2E UI** (`tests/e2e/f8-trasversali.spec.ts`): **1/1 PASS**. Pagina /movements ("Storico Movimenti") renderizza i dati reali (no empty state).

**F8 completo (core): backend (10/10) + UI trasversali E2E (1/1). Nessuna anomalia.**

---

## ✅ Sessione E2E F2–F8 completata (2026-06-10)

| Fase | Backend | E2E UI | Anomalie |
|---|---|---|---|
| F2 Apertura ricorrente | 14/14 | (UI utente) | — |
| F3 Scambi | 31/31 | 5/5 | — |
| F4 Premi | 35/35 | 4/4 | #34 ✅ risolta |
| F5 Contratti | 29/29 | 2/2 | — |
| F6 Rubata | 18/18 | 2/2 | — |
| F7 Svincolati | 23/23 | 1/1 | — |
| F8 Post-asta+trasversali | 10/10 | 1/1 | — |

Tutti gli script in `scripts/test-session/verify-f*.ts` (snapshot/restore non distruttivo) e spec in `tests/e2e/f*-*.spec.ts`. Lega ripristinata pulita dopo ogni run. **Gap per il giro manuale dell'utente**: F5 KEEP/RELEASE esteri-retrocessi via consolidamento+indennizzi e rinnovo/svincolo per-giocatore UI; F6 asta forzata stateful; F7 esecuzione asta svincolati (bid/timer/close→contratto, bot, real-time).

## Feature aggiunte in sessione

## Feature aggiunte in sessione

- **Pannello "Azioni Admin" nella maschera asta** (`src/components/auction-room-v2/AdminActionsPanel.tsx`, reso in `AuctionRoomLayout`, visibile solo admin). Raggruppa: **Concludi asta manualmente** (spostato dal bottone sciolto), **Annulla ultimo movimento** = riapri asta (`reopenAuction`, con ConfirmDialog), **Gestione ricorsi** (lista PENDING + Accetta/Rifiuta con nota). Backend riusato (nessuna nuova logica); aggiunto solo `auctionApi.reopenAuction`. I bottoni `[TEST]` restano fino a fine sessione.

## Avanzamento fasi

- [x] **F0 — Setup**: registrazione/login, creazione lega (pubblica/privata), inviti — _completata, lega "Lega test E2E" portata a 8 membri ACTIVE via `scripts/test-session/complete-lega-e2e.ts`_
- [x] **F1 — Primo Mercato**: asta libera P→D→C→A, turni, rilanci, timer, riserva budget, formule contratto — _completata e validata E2E (spec `tests/e2e/f1-sync-validation.spec.ts`, sincronia <1s); 31 osservazioni tracciate e tutte chiuse_
- [x] **F2 — Apertura ricorrente**: decremento durata, svincoli scaduti/ritirati — _backend validato E2E con seed usciti (`verify-f2-postopen.ts` 14/14: 62 svincoli scadenza, 154 decrementi, 2 ritirati, retrocesso/estero mantenuti). 2 osservazioni UX risolte in sessione: #32 riepilogo apertura ora mostrato via `MarketOpeningSummaryModal` (🟠 ✅), #33 label movimenti RETIREMENT/RELEGATION/ABROAD aggiunte (🔵 ✅)_
- [x] **F3 — Offerte pre-rinnovo**: scambi, controfferta, indicatore trattativa — _backend validato (`verify-f3-trades.ts` 31/31) + UI/real-time E2E (`tests/e2e/f3-trades-realtime.spec.ts` 5/5, sync 0.4–0.7s). Nessuna anomalia_
- [x] **F4 — Premi**: reintegro base, premi custom, indennizzi — _backend `verify-f4-prizes.ts` 35/35 + UI/admin E2E `tests/e2e/f4-prizes.spec.ts` 4/4. Anomalia #34 (dev) RISOLTA: auto-init premi andava in race sotto StrictMode → 500; fix `initPromiseRef` (init condivisa) in `PrizePhaseManager`_
- [x] **F5 — Contratti**: rinnovi, svincoli, spalma, consolidamento — _backend `verify-f5-contracts.ts` 29/29 + UI consolidamento E2E `tests/e2e/f5-contracts.spec.ts` 2/2. Gap: KEEP/RELEASE esteri/retrocessi via consolidamento+indennizzi e rinnovo/svincolo per-giocatore dalla UI → giro manuale_
- [x] **F6 — Rubata**: ordine inverso, tabellone, preferenze — _backend `verify-f6-rubata.ts` 18/18 (ordine, prezzo base clausola+ingaggio, P→D→C→A, preferenze) + UI setup E2E `tests/e2e/f6-rubata.spec.ts` 2/2 (ordine + genera tabellone). Gap: asta forzata stateful (offer/bid/ack/trasferimenti) → giro manuale_
- [x] **F7 — Svincolati**: nomination, pass, ordine turni — _backend `verify-f7-svincolati.ts` 23/23 (ordine+auto-reverse, free agents, timer, nomination/confirm, pass) + UI setup E2E `tests/e2e/f7-svincolati.spec.ts` 1/1. Gap: esecuzione asta (bid/timer-reset/close→contratto, bot, real-time) → giro manuale_
- [x] **F8 — Post-asta + trasversali**: scambi post, statistiche, movimenti — _backend `verify-f8-postasta.ts` 10/10 (scambi OFFERTE_POST_ASTA_SVINCOLATI + movimenti/finanze/statistiche) + UI E2E `tests/e2e/f8-trasversali.spec.ts` 1/1 (Storico Movimenti). Ricorsi già coperti in F1_
