# Verifica pre-lancio beta — lega da 8 manager (avviato 2026-08-24)

> Documento vivo. Aggiornare "Stato avanzamento" a ogni sessione, prima di compact/clear.
> Obiettivo: verificare funzionalità + prestazioni su ambiente Vercel deployato, prima di aprire la piattaforma a una lega reale di 8 manager.
> Piano di riferimento (fasi 0-7): `C:\Users\39349\.claude\plans\inherited-whistling-tulip.md` (approvato da Pietro il 2026-08-24).

---

## PUNTO DI RIPRESA (leggere per primo dopo un /clear o /compact)

**Ultimo aggiornamento: 2026-08-28.**

**Dove siamo**: dopo una sessione dedicata alla Fase Premi (rework completo: correzioni post-finalizzazione, re-incremento base per-manager — vedi sezioni sotto), Pietro ha chiesto un **controllo definitivo su Bilancio/Budget/Monte Ingaggi in tutta la piattaforma**, vista la quantità di bug trovati in Premi. Fatto: 6 flussi verificati a mano (Primo Mercato, Rubata, Svincolati, Consolidamento Contratti, Scambi, Premi), 9 bug trovati e corretti, buco di test automatici chiuso su 3 service prima scoperti (auction/svincolati/prize-phase). Tutto deployato in `main`/prod. **Dettagli completi nella sezione `## Controllo definitivo Bilancio/Budget/Monte Ingaggi (2026-08-28)` in fondo a questo file.**

Prossimo passo naturale (dichiarato da Pietro): **verifica grafica/UI di Rubata e Svincolati** — non ancora iniziata. In alternativa: Pietro verifica dal vivo i fix di oggi, poi si riprende la Fase 5 (playthrough) da Contratti, oppure altro su richiesta di Pietro.

**Cosa manca per chiudere il ciclo di verifica pre-lancio** (piano originale, Fasi 0-7 in `C:\Users\39349\.claude\plans\inherited-whistling-tulip.md`):
- Fase 4 (sweep bug aperti #7/#13): triage fatto, non bloccante, non azionato — va bene lasciarlo così per la beta cerchia ristretta.
- **Fase 5 (playthrough) INTERROTTA per il rework Dashboard**: Primo Mercato completato (25/25 rose piene, via script `scripts/_playthrough-load-test.mjs`) sulla lega "Playthrough Beta 2026-08-24" (`cmt72bxuw0005sls2o232kz7x`, prod). **Prossima fase naturale da testare: Contratti** (rinnovi post-asta) — non ancora iniziata.
- Fase 6 (performance): fatta solo per Primo Mercato (0 errori su 3186 chiamate, vedi sotto), non ancora per Rubata/Svincolati.
- Fase 7 (Go/No-Go): non siamo ancora arrivati a decidere, main riceve ancora fix mirati via push diretto (prassi consolidata in questa sessione, sempre con conferma esplicita di Pietro prima di ogni push).

**Credenziali/lega di test attive**: Sim01 = admin (`sim01@sim.fantacontratti.it` / `SimBeta2026!`), Sim02-08 stessa password. Lega `cmt72bxuw0005sls2o232kz7x` su prod (`fantacontratti-multiagent.vercel.app`), NON la lega reale.

**Nota ricorrente su falsi allarmi**: più volte in questa sessione Pietro ha segnalato un fix "non funzionante" che in realtà era una **tab del browser rimasta aperta da prima del deploy** (SPA, non ricarica il bundle JS da sola). Prima di investigare un bug segnalato subito dopo un deploy, sospettare sempre questo e chiedere di provare con una tab nuova/hard refresh — confrontando l'hash del chunk JS servito ora vs quello nell'errore, se serve la controprova.

**Debito tecnico scoperto (non risolto, solo aggirato)**: `GET /api/leagues/:id/rosters` è registrata due volte (`src/api/routes/auctions.ts` e `src/api/routes/leagues.ts`), con forme di risposta diverse — vince quella di `leagues.ts` a runtime. `Trades.tsx` e ora anche `LeagueDetail.tsx` gestiscono l'ambiguità in modo difensivo lato frontend, ma la duplicazione backend resta. Da pulire in un giro dedicato futuro (basso rischio, non urgente).

## Stato avanzamento

| Fase | Stato | Note |
|------|-------|------|
| 0 — Salute locale | ✅ Fatta | test:all 1765/1765, lint 0 errori, build ok |
| 1 — Deploy preview develop | ✅ Fatta | Superata: ora si pusha direttamente main dopo conferma, develop e main allineati |
| 2 — Smoke sul preview | ✅ Fatta | |
| 3 — Documento di sessione | ✅ Fatta | Questo file, aggiornato più volte |
| 4 — Sweep bug aperti | 🟡 Parziale, accettato così | #7/#13 non bloccanti per beta cerchia ristretta |
| 5 — Playthrough 8 fasi | 🟡 In corso | Primo Mercato ✅ completato; Contratti da iniziare; interrotto per rework Dashboard di lega (vedi sopra) |
| 6 — Performance | 🟡 Parziale | Primo Mercato ✅ (0 errori/3186 chiamate); Rubata/Svincolati da fare |
| 7 — Go/No-Go main | ⬜ Da fare | |

---

## Deploy attivo

- **Preview URL**: `https://fantacontratti-multiagent-git-develop-pietros-projects-1747b1de.vercel.app`
- Commit deployato: `9757e23` (= HEAD di `develop` dopo il merge di `REVIEW_PRE_BETA`, 38 commit di rework grafico esteso)
- **`main`/prod NON toccato** — resta a `91addae` (13/08), com'era prima di questo ciclo
- **⚠️ Protetto da Vercel SSO** (`ssoProtection: all_except_custom_domains`): per accedervi senza essere loggati come membro del team Vercel serve un link di bypass (`get_access_to_vercel_url`, scade 23h) — va rigenerato ad ogni sessione. Se Pietro accede da browser già loggato su vercel.com con l'account del team, non serve il bypass.
- DB condiviso col prod reale (Neon) — **usare solo leghe/account di test** (`Simulazione Beta 2026-07`, `sim01..07@sim.fantacontratti.it` / `SimBeta2026!`), mai la lega "Fantacontratti Ufficiale".

---

## Smoke test (Fase 2) — esito

Eseguito via curl con cookie di bypass SSO (stesso pattern del luglio 2026):

| Check | Esito |
|-------|-------|
| Health API | 200 `{"status":"ok"}` |
| `/api/debug/timing` (deve essere rimosso in prod) | 404 ✓ |
| `/api/push/vapid-key` (route montata, non configurata) | 503 config ✓ |
| `/api/feedback` senza auth | 401 ✓ |
| Login reale `sim01@sim.fantacontratti.it` | 200 + JWT valido ✓ (dopo 1 retry, vedi finding sotto) |

### Finding: cold-start / pool di connessioni Neon
Il primo tentativo di login ha dato **500 `PrismaClientInitializationError: Timed out fetching a new connection from the connection pool` (limit 5, timeout 10s)**. Ripetendo dopo ~8s, login riuscito 2/2. Non è una regressione di questo deploy — stesso errore già presente in log dal **2026-08-15** (`get_runtime_errors`). È lo stesso limite del piano Free Neon già documentato a luglio (`connection pool timeout`). Da monitorare in Fase 6 (performance) con carico simultaneo reale: se 8 manager fanno login nello stesso istante su un'istanza fredda, il rischio di 500 transitorio è concreto — valutare retry lato frontend o warm-up prima dell'apertura della lega.

---

## Triage 13 bug audit strutturato (2026-08-21)

Fonte: `docs/reviews/audit-2026-08-21-sintesi.md`. Verificato leggendo i commit di `REVIEW_PRE_BETA` successivi all'audit + grep sul codice attuale.

| # | Bug | Stato | Come verificato |
|---|-----|-------|------------------|
| 1 | Rules.tsx moltiplicatore clausola ×4 invece di ×3 | ✅ FIXATO | commit `8cd4d92` |
| 2 | Ordine turni Svincolati non precompilato come inverso Rubata | ✅ FIXATO | commit `01c9e59` |
| 3 | ~100 chiamate `can-prophecy` in parallelo su Movimenti | ✅ FIXATO (di fatto) | `Movements.tsx` rimosso (commit `9aef658`, redirect a History); `History.tsx` non chiama più `can-prophecy` (grep: 0 risultati nei componenti, solo la funzione in `api.ts` rimasta inutilizzata) |
| 4 | Pagina Movements duplicata rispetto a History | ✅ FIXATO | commit `9aef658` |
| 5 | PlayerStatsModal non mostra ingaggio/durata/clausola/rubata in evidenza | ✅ FIXATO | commit `a4aba65` |
| 6 | Overflow-x desktop 1300-1440px su Aste live | ✅ FIXATO | commit `81df1ec` |
| 7 | Sessione con `currentPhase` anomalo manda in contraddizione AdminPanel (bottone morto) | 🟡 APERTO, bassa priorità | Dato di test, non regola di gioco. Non risulta un fix esplicito in `MarketPhaseManager.tsx`. Non bloccante per beta cerchia ristretta (serve solo un dato di seed anomalo per manifestarsi) |
| 8 | Ready-check pesante su ogni nomina Primo Mercato | ✅ FIXATO | commit `418e22f` |
| 9 | Race su click rapido doppia nomina | ✅ FIXATO | commit `02f1989` |
| 10 | Registrazione senza schermo di conferma | ✅ FIXATO | commit `8cd4d92` |
| 11 | Preferenze notifiche Profile senza toast | ✅ FIXATO | `NotificationPreferences.tsx` ora usa `useToast()` (`toast.success`/`toast.error`), confermato via grep |
| 12 | Messaggio rosa vuota fuorviante fuori dal Primo Mercato | ✅ FIXATO | commit `8cd4d92` |
| 13 | Controlli test admin senza gate d'ambiente | 🟡 APERTO per scelta esplicita | Decisione Pietro (luglio 2026, vedi memoria `programma-beta-lancio`): FAB test attivo per ogni admin lega anche in prod (`VITE_TEST_CONTROLS=true`), rischio equità accettato. Non bloccante per beta cerchia ristretta |

**Risultato: 11 su 13 bug già chiusi.** Restano solo #7 (edge case da dato anomalo, bassa priorità) e #13 (non è un bug, è una scelta di prodotto già presa).

Non ancora verificati in questo giro (dai pattern di ridondanza, non dai 13 bug — priorità più bassa, tracciata separatamente in HANDOFF.md §6 "Semplificazione UI/IA"): le 8 duplicazioni strutturali (mappa fase→etichetta, budget ripetuto, QuickAccessTiles, ContractModifier vs renewal-logic, ecc.).

---

## Performance — Primo Mercato completo sotto carico (Fase 5+6, 2026-08-24)

**Fuse le Fasi 5 e 6 per il Primo Mercato su decisione Pietro**: invece di un giro manuale + uno stress test separato, l'intero Primo Mercato della lega "Playthrough Beta 2026-08-24" è stato giocato con burst di 8 offerte concorrenti reali (`Promise.all`, non sequenziali) su **ogni singolo giocatore**, tramite `scripts/_playthrough-load-test.mjs` (nuovo, non committato — riusa la logica di `_stress-test.mjs` di luglio ma senza accesso diretto al DB, solo API, e senza cap sui lotti).

**Esito: 197 giocatori assegnati (Primo Mercato dichiarato "terminato" dal motore stesso), 0 errori di carico su 3186 chiamate.**

| Metrica | Valore |
|---|---|
| Lotti completati | 197 (tutti i ruoli P/D/C/A esauriti) |
| Errori 5xx/429/timeout/neterr | **0 / 3186** |
| `bid:burst` (8 offerte simultanee per lotto) | 1576 chiamate, avg 131ms, p95 207ms, max 517ms |
| `nominate` | avg 135ms, p95 184ms |
| `close` (chiusura asta) | avg 125ms, p95 172ms |
| Confronto baseline luglio (hardening pre-rework) | avg 272ms / **p95 1580ms** → ora p95 207ms: nessuna regressione da rework grafico, anzi meglio (verosimilmente niente cold-start dato che gli account erano già "caldi" dai login sequenziali) |

I 400 sui bid sono scarti logici attesi (prezzo superato da un concorrente nel burst, o budget squadra esaurito a fine asta) — comportamento corretto sotto race, non un bug.

**Non ancora testato con questo metodo**: Rubata e Svincolati (script `_stress-test-rs.mjs` di luglio copre quel caso, da adattare allo stesso modo se si vuole ripetere l'esercizio su quelle fasi).

---

## Performance — baseline da riprendere (Fase 6)

Baseline luglio 2026 (pre-rework, hardening only), da rieseguire sul preview attuale:
- Asta Primo Mercato: bid burst avg 272ms / p95 1580ms / max 1582ms, 0 errori
- Rubata: bid burst avg 245ms / p95 362ms / max 1358ms, 0 errori
- Svincolati: bid burst avg 146ms / p95 187ms / max 844ms, 0 errori
- Cold-start: ~1.9s freddo / 473ms caldo

Script: `scripts/_stress-test.mjs` (asta), `scripts/_stress-test-rs.mjs` (rubata+svincolati) — da ripuntare su `E2E_BASE_URL` = preview URL corrente, verificando che gestiscano il bypass SSO (cookie di share) prima del lancio.

---

## Playthrough end-to-end 8 fasi (Fase 5) — runbook

**Avviato 2026-08-24 (sessione ripresa).** Lega di riferimento: **Simulazione Beta 2026-07** (`cmrhiriba0008x3t07twekh9d`), verificata via API prima di iniziare: `status: ACTIVE`, `currentSeason: 1`, **nessuna sessione di mercato attiva** (`/api/leagues/.../auctions` → `[]`) — confermato lo stato "ripulita" di luglio (memoria `verifica-pre-lancio-8-manager`). È lo stato ideale: si può fare un Primo Mercato vero da zero.

**Nota password admin**: il tentativo di login con `pietro1412@gmail.com` / `TestAdmin2026!` (password impostata a luglio per lo stress test) ha dato "Credenziali non valide" — Pietro l'ha presumibilmente ricambiata dal profilo dopo i test di luglio. **Serve la sua password attuale**, non ricostruibile/indovinabile da Claude.

**Modalità operativa (adattata 2026-08-24)**: password reale di `pietro1412` non disponibile → Pietro guida da browser come **Sim01, che è stato reso ADMIN** di una lega nuova di scratch creata per questo playthrough. Claude pilota via API gli altri 7 account (Sim02-08) per velocizzare conferme/offerte multiple senza serve 8 persone reali.

### Lega di playthrough (creata 2026-08-24 via API)
- **Nome**: "Playthrough Beta 2026-08-24" — **id**: `cmt72bxuw0005sls2o232kz7x`
- **Registrato Sim08** (`sim08@sim.fantacontratti.it` / `SimBeta2026!`, era il 7° account mancante per arrivare a 8)
- 8 membri ACTIVE: Sim01 (ADMIN, "Simulato 1") + Sim02..08 ("Simulato 2".."Simulato 8"), tutti via invito email + accept (non tramite richiesta+approvazione)
- Lega **avviata** (`POST /leagues/:id/start` → `status: ACTIVE`, ordini di turno assegnati, 8 partecipanti) — **nessuna sessione di mercato aperta**: il Primo Mercato va avviato dal vivo da Pietro/Sim01 dall'interfaccia, così il test copre anche quel flusso admin
- Budget 500, slot standard (3P/8D/8C/6A)

**Login per Pietro**: `sim01@sim.fantacontratti.it` / `SimBeta2026!` — è ADMIN della nuova lega, può avviare/gestire il Primo Mercato dal pannello.

Accesso preview: link di bypass SSO generato alle 2026-08-24 09:46 (scade 2026-08-25 08:46) — se scaduto, richiederne uno nuovo. In alternativa Pietro può accedere direttamente se loggato al team Vercel nel suo browser.

Checklist (da compilare durante il playthrough):

| Fase di gioco | Chi testa | Esito | Bug collegati |
|---|---|---|---|
| Registrazione/Login/Invito lega | Pietro (browser) | ⬜ | |
| Primo Mercato (asta live, timer reale) | Pietro (browser) + Claude (script per riempire velocemente se serve) | ⬜ | |
| Contratti (rinnovi, consolidamento) | Pietro (browser) | ⬜ | |
| Rubata | Pietro (browser) | ⬜ | |
| Svincolati | Pietro (browser) | ⬜ | |
| Scambi (offerta/controfferta tra manager) | Pietro (browser, 2 account) | ⬜ | |
| Premi/indennizzi | Pietro (browser) | ⬜ | Nessuna lega di test l'ha mai attraversata dal vivo (gap noto da cluster 3 audit) |
| Storico/Statistiche/Rose | Pietro (browser) | ⬜ | |

Ogni bug trovato durante il playthrough va aggiunto qui sotto, non solo detto in chat.

## Log nuovi findings (da questo ciclo)

| # | Finding | Severità | Dove |
|---|---------|----------|------|
| 1 | Cold-start: pool connessioni Neon (limit 5) può dare 500 transitorio su login/richieste concorrenti dopo inattività | Media — da confermare sotto carico reale in Fase 6 | Backend, tutte le route che usano Prisma |

### Osservazioni Pietro da screenshot live (playthrough Primo Mercato, 2026-08-24) — TUTTE FIXATE

Raccolte in `OSSERVAZIONI.docx` (7 punti, letto testo + screenshot incorporati), mappate sul codice e corrette nella stessa sessione:

| # | Osservazione | Fix | File |
|---|---|---|---|
| 1 | Foto giocatore mancante nel modale "Transazione Completata" | Aggiunta foto reale (con fallback a badge ruolo se assente) | `AuctionRoomModals.tsx` (`AcknowledgmentModal`) |
| 2 | Budget disponibile sparisce a rosa completata in "La mia rosa" | **Bug reale**: la prop `budget` non era mai usata, il footer mostrava solo "speso". Ora mostra sempre "Budget disponibile" | `MyPortfolio.tsx` |
| 3 | Sfondo logo squadra non bianco nella striscia filtro di "Ricerca & Nomina" | Aggiunto wrapper `bg-white/90` coerente con le altre istanze del logo nella stessa schermata | `NominationPanel.tsx` |
| 4 | Manca vista tabellare in "Ricerca & Nomina" | Il toggle card/tabella esisteva già in codice (icone in alto a destra) — nessun fix, solo da verificare/notare sul preview | `NominationPanel.tsx` (invariato) |
| 5 | "Ricerca & Nomina" mostra statistiche complete invece della sola età | Rimossa `MiniStats` (presenze/gol/assist/media voto) dalla card grid; lasciate intatte in card focale e vista tabella (viste più di dettaglio) | `NominationPanel.tsx` |
| 6 | Modale statistiche giocatore non si chiude col click esterno | **Bug reale nel componente condiviso `Modal`**: il backdrop click-handler era su un div esterno mentre lo sfondo visivo era un div separato sovrapposto — `event.target` non coincideva mai con `event.currentTarget`. Fuso in un solo div. **Corregge il problema per OGNI modale che usa il componente condiviso**, non solo `PlayerStatsModal` | `src/components/ui/Modal.tsx` |
| 7 | Modale rosa avversario piccola/disordinata | Allargata (`max-w-lg`→`max-w-2xl`), aggiunta foto giocatore per riga, layout a 2 colonne su schermi larghi | `AuctionRoomModals.tsx` (`ManagerDetailModal`) |

Effetto collaterale utile dei fix #1/#7: `apiFootballId` mancava nel roster inviato dal backend per il modale rosa avversario (sia lato Primo Mercato in `auction.service.ts` sia lato Svincolati in `useSvincolatiState.ts`/tipi) — aggiunto in entrambi i percorsi, altrimenti le foto non sarebbero mai comparse pur con il fix del componente.

**Verifica**: typecheck 0 errori, test:all 1765/1765 verdi, lint 0 errori (invariato). Verifica visiva rimandata al preview live con Pietro (già autenticato nella sessione in corso) invece che a un setup locale Docker/API dedicato.

### Feedback live sui fix (screenshot Pietro dopo il primo deploy) — 2 problemi trovati, corretti

**#2 (budget) non risolto al primo giro + #7 (modale rosa avversario) peggiorata dal mio stesso fix.** Analisi da screenshot:

1. **Budget disponibile ancora invisibile a rosa piena (25/25)** — non era un bug nel testo del footer (quello era corretto), ma un **bug di layout CSS più profondo**: la griglia cockpit a 3 colonne (`AuctionRoomLayout.tsx`) usa una riga implicita `auto` senza altezza vincolata. Con rosa parziale il contenuto capiva nella viewport per puro caso; con **rosa 25/25 completa** (mai vista prima in test, dato che questa sessione è il primo playthrough a rose piene) il contenuto della colonna "La mia rosa" supera l'altezza disponibile, la riga della griglia cresce oltre `h-full`, e l'`overflow-hidden` di un antenato (`CockpitShell`) taglia silenziosamente il fondo di **tutte e 3 le colonne** — non solo il footer budget, un bug strutturale che sarebbe emerso anche altrove a mano a mano che le rose si riempiono. Fix: `lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden` sulla riga della griglia, per forzare la riga a restare dentro `h-full` e delegare lo scroll ai pannelli interni (`.panel-scroll`) come da design.
   - **Stesso pattern trovato e corretto preventivamente in altre 5 pagine cockpit** (stessa struttura di griglia, stesso rischio non ancora osservato perché mai testate a piena capacità): `SvincolatiCockpit.tsx`, `Contracts.tsx`, `RoseGiocatori.tsx`, `Rubata.tsx`, `Trades.tsx`. Decisione Pietro: fix preventivo su tutte, non aspettare di incontrarlo di nuovo pagina per pagina.
2. **Modale rosa avversario ("Simulato 3") con dati sovrapposti** — causato dal MIO fix precedente: avevo cambiato il layout da colonna singola a griglia 2 colonne per "ridurre il disordine verticale", ma a metà larghezza modale ogni riga (foto+logo+nome+contratto inline a 4 campi+prezzo acquisto) non ci stava e si accavallava visivamente. Fix: tornato a colonna singola (`space-y-4`), mantenendo la modale allargata (`max-w-2xl`, dal fix precedente) che da sola dà lo spazio in più richiesto senza bisogno del multi-colonna.

**Verifica**: typecheck 0 errori, test:all 1765/1765 verdi, lint 0 errori. File toccati in questo secondo giro: `AuctionRoomLayout.tsx`, `SvincolatiCockpit.tsx`, `Contracts.tsx`, `RoseGiocatori.tsx`, `Rubata.tsx`, `Trades.tsx`, `AuctionRoomModals.tsx` (revert griglia→colonna singola).

### Push su `main` (produzione) — decisione esplicita di Pietro, fuori sequenza dal piano

Pietro ha chiesto di pushare `develop`→`main` a questo punto (prima delle Fasi 5-6 complete) per verificare i fix direttamente sull'ambiente di produzione reale, invece che sul preview. **Deviazione consapevole dal piano**: normalmente il Go/No-Go per `main` è condizionato a Fasi 4-6 verdi (Fase 7). Rischio comunicato e accettato: porta in prod l'intero rework di `REVIEW_PRE_BETA` (38+ commit), non solo i fix di oggi.
- **Backup pre-deploy eseguito** (`npm run db:backup` con `.env.vercel`): 23.111 record (PlayerMatchRating, PlayerRoster, PlayerContract, LeagueMember, SerieAPlayer) in `scripts/backups/pre-deploy/`.
- **Verificato**: nessuna modifica a `prisma/` tra `main` e `develop` (diff vuoto) → zero rischio schema/migrazioni.
- Merge fast-forward pulito, push su `main` (commit `ad4a4a0`), deploy prod READY.
- `main` e `develop` ora allineati.

### Falso allarme: "non vedo ancora il fix" era cache di una tab già aperta, non un bug

Dopo il deploy in prod, Pietro segnalava di nuovo budget/modale rotti. **Diagnosi verificata empiricamente** (non solo ipotizzata): script Playwright standalone, browser pulito, stesso URL prod/account/lega → **il fix funziona correttamente** (footer "Budget disponibile" visibile e pinnato in fondo al pannello anche a viewport ridotto fino a 650px, modale rosa avversario a colonna singola senza overlap). Causa: la tab del browser di Pietro era rimasta aperta da prima del deploy — un'app SPA non rifetcha il bundle JS su semplice navigazione client-side, serve un reload vero o una tab nuova. Il badge Vercel "master@\<sha\>" (overlay esterno al nostro codice, non generato da React) mostrava il commit giusto ma non garantisce che il JS già in memoria nella tab sia aggiornato — fuorviante in questo contesto. **Risolto chiudendo la tab e aprendone una nuova.**

### Finding aggiuntivo da screenshot (non un bug, richiesta di enfasi visiva)

A fine Primo Mercato (tutti gli slot di ruolo pieni, fase ATTESA), la colonna Manager mostrava un trattino "—" grande in oro/bianco (ex "offerta max", non più significativo) mentre il **budget residuo** — l'unico dato ancora rilevante in quello stato — restava in piccolo grigio sotto. Fix: quando lo slot del ruolo corrente è pieno, il budget diventa il valore grande in oro al posto del trattino (`FinancialDashboard.tsx`, righe con `bigValue`/`bigUnit`/`bigValueGold`/`smallValue` condizionati su `roleFull`). Verificato: typecheck 0 errori, test:all 1765/1765 verdi.

### Cambio font piattaforma (2026-08-24, richiesta esplicita Pietro fuori dal ciclo di verifica)

Sostituito **Barlow + Barlow Condensed** (tema "Broadcast") con **Inter ovunque** — corpo testo, titoli, numeri/timer/budget — su richiesta di Pietro ("un font più gradevole"). Toccati: `index.html` (Google Fonts link), `tailwind.config.js` (`fontFamily.sans/mono/display/sport` → Inter), `src/index.css` (base `html` + `.stat-number`/`.timer-sport`/`.budget-display`/`.micro-label`, che avevano `Barlow`/`Barlow Condensed` hardcoded fuori dal token Tailwind).
- **Nessun impatto sull'allineamento cifre**: le classi numeriche usano già `font-variant-numeric: tabular-nums`, non dipendono da un font monospace.
- **Verificato anche visivamente**: build locale servita con `vite preview`, screenshot Playwright della pagina di login, confermato `getComputedStyle(document.body).fontFamily === "Inter, ..."`.
- Push su `develop` (`e7af41e`) poi fast-forward su `main` — stesso commit ora in produzione.
- **Da riverificare**: Pietro deve controllare il font su una tab nuova (stesso avvertimento cache/SPA di prima) su più pagine, non solo login.

### Rework Dashboard di lega (2026-08-24) — richiesta esplicita, fuori sequenza dal piano

Pietro ha chiesto un rework completo dell'Hub Lega (`LeagueDetail.tsx`): troppa complessità, voleva dati personali in primo piano + rose avversari + fase sempre chiara. Ciclo: delega a `esperto-prodotto-manageriale` → 3 mockup (A/B/C) → feedback "troppe informazioni, ridurre all'osso" → mockup D (essenziale) → feedback "voglio budget + composizione rosa mia e avversari, cliccabili" → mockup E (rose) → **"procedi"**.

**Implementato**: nuovo componente `RosterOverview.tsx` ("La mia rosa" con budget disponibile + composizione P/D/C/A cliccabile → Rose; "Rose degli avversari" solo composizione, ogni riga cliccabile → Rose con quel manager preselezionato via nuovo query param `?member=`). Rimossi 5 componenti ridondanti con pagine dedicate (AttentionRail, FinancialKPIs, StrategySummary, RecentMovements, ManagersSidebar) — invariata solo `AdminBanner` (CTA di fase).

**Bug in produzione al primo deploy, poi corretto**: `/api/leagues/:id/rosters` ha una route duplicata pre-esistente (`auctions.ts` vs `leagues.ts`, quest'ultima vince a runtime) — il codice assumeva la forma sbagliata, crash `s.find is not a function`. `Trades.tsx` aveva già lo stesso problema con un workaround difensivo, riapplicato qui. **Root cause non risolta a livello di route** (le due route duplicate restano entrambe registrate) — solo il consumo lato frontend è stato reso robusto. Da considerare per un giro di pulizia futuro se si vuole eliminare la duplicazione alla fonte.

**Verificato dal vivo** (Playwright, browser pulito, prod, lega "Playthrough Beta 2026-08-24" con rose piene 25/25): pagina corretta, nessun errore JS, click su rosa avversaria naviga a `/rose?member=<id>` con quella rosa effettivamente selezionata. Mockup pubblicati come Artifact e in `docs/reviews/mockups/28-dashboard-lega/` (A, B, C, D, E + README).

---

## Sessione Scambi + fix Monte Ingaggi (2026-08-26)

> Sessione lunga, fuori sequenza dal piano Fase 0-7. Tutto quanto sotto è già in `main`/produzione.
> Questa sezione è pensata come **checklist di verifica per Pietro** dopo un `/clear`: ogni punto
> dice cosa controllare e dove, non solo cosa è stato fatto.

### 1. Piccoli fix UI sulla fase Scambi

Partiti da osservazioni dirette di Pietro sullo screenshot del tavolo scambio:

| Cosa | Prima | Dopo | Dove verificare |
|---|---|---|---|
| Età giocatore | Non sempre mostrata (assente nel tavolo scambio, nelle chip Ricevute/Inviate/Concluse, nella modale controfferta) | Sempre mostrata, o "N.D." se assente | Lega → Scambi, qualunque tab |
| Manager destinatario | Una volta scelto, bloccato (nessun modo di cambiarlo senza uscire dal form) | Chip col nome + pulsante ✕ per cambiarlo, azzera i giocatori già selezionati per quel manager | Lega → Scambi → Nuova Offerta, dopo aver scelto un destinatario |

**Come verificare**: aprire Scambi → Nuova Offerta su una lega con rose popolate, controllare che ogni riga giocatore mostri l'età e che il chip destinatario abbia la ✕.

### 2. Scoperta e fix: Monte Ingaggi non doveva essere "live" negli Scambi

**Il problema trovato**: scambiando un giocatore, il Bilancio (Budget − Monte Ingaggi) di entrambi i manager cambiava **immediatamente**, mentre le regole di gioco (`docs/bibbie/MERCATO-RICORRENTE.md` §3.6-3.8, `FINANZE.md` §2.1/§7, `CONTRATTI.md` §10.2) impongono che il contratto trasferito in uno scambio non tocchi il Bilancio fino al **prossimo consolidamento di Fase 3 Contratti**. Rubata e Svincolati restano invece "live" per scelta di design (creano un impegno finanziario nuovo, non solo uno spostamento) — confermato da Pietro con un esempio numerico discusso a turni in chat.

**Il fix**: nuovo campo `LeagueMember.totalSalaries` (il "monte ingaggi fissato"), aggiornato SOLO da 4 eventi — chiusura Primo Mercato, consolidamento Contratti (ricalcolo pieno), Rubata (± incrementale), Svincolati (+ incrementale) — e **mai** toccato dagli Scambi. Ogni punto dell'app che mostrava il Bilancio (Dashboard/Rose/Finanze/validazioni scambio) ora legge questo campo invece di ricalcolare live dal roster.

**Cosa verificare tu (Pietro), in produzione, su una lega reale**:

1. Vai su Dashboard di una tua lega reale (es. "Fantacontratti Ufficiale") e annota il Bilancio mostrato ("La mia rosa"). **Deve essere lo stesso numero di prima di questo deploy** — il backfill è stato calcolato apposta per non cambiare nulla di visibile in quel momento.
2. Vai su Finanze → Panoramica, stesso controllo: il numero deve coincidere con quello della Dashboard.
3. (Se in una fase Scambi attiva) fai uno scambio di prova reale: dopo l'accettazione, il Bilancio **non deve muoversi** — né su Dashboard, né su Rose, né su Finanze — finché non arriva il prossimo consolidamento Contratti.
4. In Rubata/Svincolati, invece, il Bilancio **deve continuare a muoversi subito** come sempre (comportamento invariato).

**Verifica tecnica già fatta da Claude** (non serve rifarla, riportata per trasparenza):
- 6 script di verifica backend in `scripts/test-session/` (`verify-f3-trades.ts`, `verify-f3b-trades-extra.ts`, `verify-f3c-trade-renewal.ts`, `verify-f6-rubata.ts`, `verify-f7-svincolati.ts`, nuovo `verify-f6f7-totalsalaries-live.ts`) — 114 check totali, tutti passati, su una lega di test dedicata isolata dalle leghe vive ("Lega test E2E", ricreata da zero perché quella storica non esisteva più sul DB locale — vedi memoria `project-lega-test-e2e-ricreata`).
- Suite di test automatici del progetto: 1776/1776 verdi, 0 errori TypeScript.
- Verifica visiva via browser (Playwright): scambio reale eseguito, Bilancio Dashboard/Finanze confermato invariato prima/dopo, screenshot raccolti durante la sessione (non salvati su disco, solo controllati a video).
- **Backfill eseguito su produzione PRIMA del deploy del codice** (mai una finestra con dato a 0): 38 membri su 8 leghe reali, incluse "Fantacontratti Ufficiale" e "Playthrough Beta 2026-08-24" (quella di questo stesso piano di verifica) — nessun valore cambiato rispetto a quanto già mostrato agli utenti in quel momento.
- Backup pre-deploy: `npm run db:backup` (23.111 record) prima di ogni modifica allo schema di produzione.

**Se qualcosa non torna**: il campo `totalSalaries` si ricalcola in automatico al prossimo consolidamento Contratti di quel manager — non serve un intervento manuale per "auto-correggersi" nel tempo. Se invece un numero sembra sbagliato SUBITO dopo questo deploy, segnalarlo con lega/manager specifico: si può ricalcolare al volo con `scripts/test-session/backfill-total-salaries.ts` (idempotente, riscrive sempre col valore live corretto).

**Debito noto, non affrontato in questa sessione** (annotato, non bloccante per la beta):
- Test E2E Playwright esistente per gli scambi (`tests/e2e/f3-trades-realtime.spec.ts`) ha selettori obsoleti (risalgono a prima della bonifica palette/cockpit di giugno) — non riscritto per intero, sostituito da verifica mirata ad-hoc per questa sessione. Da riscrivere in un giro dedicato se si vuole automatizzare di nuovo quel test.
- Nessuna notifica push quando una TUA offerta inviata viene accettata/rifiutata (esiste solo per le offerte ricevute, e solo se sei sulla pagina Scambi in quel momento via realtime) — gap noto, da decidere se aprire come task a parte.
- `recordMovement` (storico movimenti) fallisce in silenzio se il DB ha un problema in quel momento — annotato, non testato forzando un errore.

### 3. Altri fix UI di questa sessione (prima della parte Scambi)

Cronologia, tutti già deployati in `main` prima della parte Scambi:

| Fix | Commit (develop→main) |
|---|---|
| Scroll rotto nel tab "Rose" (catena altezza CSS + classe `panel-scroll` morta) | `1682690` |
| Label "Budget disponibile" → "Bilancio" in RosterOverview (stesso numero, nome sbagliato) | `a939722` |
| Dashboard: aggiunto breakdown Budget − Monte ingaggi sotto il Bilancio | `f732883` |
| Sala d'asta: nuova fase "Primo Mercato completato" quando tutti gli slot sono pieni (prima restava sull'ambiguo "in attesa nomina") | `81aab1e` |
| Dashboard: parità dati "mia rosa"/avversari (età media rosa/reparto) + header tabella avversari più leggibile | `a65ce05` |
| Scambi: età sempre visibile + destinatario modificabile (vedi punto 1 sopra) | `15f3f31` |
| **Fix Monte Ingaggi (punto 2 sopra)** | `d97ff6a` |

---

## Prossimi passi

1. **Pietro verifica la sezione "Sessione Scambi + fix Monte Ingaggi" qui sopra** su una lega reale in produzione.
2. Decidere con Pietro se procedere poi con Fase 4 (chiudere #7, opzionale), Fase 5 (playthrough live, da riprendere da Contratti), o Fase 6 (performance).
3. Per Fase 5: Pietro logga sul preview/prod e segue la checklist playthrough sopra.
4. Per Fase 6: adattare gli script stress-test al preview e gestire il bypass SSO nelle richieste HTTP dello script.

---

## Sessione 2026-08-26/27 — giro di bug-fix/polish su main (workflow diretto, niente feature branch)

Pietro ha chiesto di lavorare direttamente su `main`/`develop` per questo giro (niente `feature/1.x-*`): ogni fix committato e pushato singolarmente, con conferma esplicita prima del push. `main` = `develop` = `origin/*`, sempre allineati dopo ogni giro.

Cronologia (dal termine della sessione Scambi/Monte Ingaggi sopra, commit `d97ff6a` → `ae565f4`):

| Fix/feature | Commit |
|---|---|
| Budget vs Bilancio coerenti in tutta la piattaforma (RosterOverview, header lega, dashboard multi-lega, Rose, Scambi) + `src/utils/finance.ts:computeBilancio` centralizzato | `efded41` |
| Conteggio giocatori per reparto in RosterOverview (senza limiti slot, non più validi dopo 1° Mercato) | `deb8051` |
| Scambi/Contratti in nav solo durante la loro fase attiva (come Asta/Rubata/Svincolati) | `d53c75d` |
| Mockup A "colonne separate" per età/conteggio per reparto (scelto da Pietro tra 4 proposti da agente `esperto-prodotto-manageriale`) | `2a9fc63` |
| Rimosso scroll orizzontale inutile in RosterOverview (min-width copiato dal mockup, non necessario nella pagina reale) | `0973111` |
| Font troppo piccoli in TradeOfferCard (tab Concluse Scambi) | `fa1c75b` |
| **Bug navigazione**: header andava in overflow con molti badge (lega+Admin+Live), profilo finiva fuori schermo | `cea7667` |
| **Fix definitivo dropdown profilo**: portato su `document.body` via React Portal (stesso pattern di `Toast.tsx`), posizione calcolata in JS — elimina la fragilità del CSS absolute annidato nell'header denso. Diagnosi lunga (~2h, vedi lezione sotto) | `5b6ac43` |
| Scadenza automatica offerte Scambi pendenti alla chiusura fase (prima restavano "orfane" e potevano ripresentarsi azionabili in una fase Scambi successiva) | `edcd45f` |
| Etichetta leggibile per stato Scambi nello Storico (badge italiano invece di emoji + tooltip inglese) | `9fdf6ae` |
| Foto + logo squadra + nome cliccabile per ogni giocatore nello Storico (nuovo componente condiviso `PlayerMediaName`) | `cf42e24` |
| Indicatore "Fuori Serie A" quando un giocatore lascia la Serie A (trigger `listStatus==='NOT_IN_LIST'`, mai solo `exitReason`) — Rose (caso KEEP) + Storico | `ae565f4` |

**Lezione da portare avanti**: quando un fix di layout sembra funzionare in un test ma non in un altro nello stesso identico scenario, sospettare subito una race/dipendenza dal viewport prima di ipotizzare cache/build stale — nel caso del dropdown profilo, la causa vera (header che andava a capo in modo imprevedibile) è stata trovata solo dopo aver riprodotto l'inconsistenza con Playwright in loop, non dal primo tentativo "sembra funzionare".

## Task aperto ora (avviato 2026-08-27, DA FARE in un contesto pulito dopo `/clear`)

**Fase Premi**, lega **"Playthrough Beta 2026-08-24"** (`cmt72bxuw0005sls2o232kz7x`, **produzione**, `https://fantacontratti-multiagent.vercel.app/leagues/cmt72bxuw0005sls2o232kz7x/prizes`). File coinvolti (già localizzati, non ancora aperti): `src/components/PrizePhaseManager.tsx`, `src/components/MarketPhaseManager.tsx`.

Richiesta di Pietro, 4 parti — **tutte e 4 completate 2026-08-27**:

1. ✅ **Seed dati indennizzi**: `scripts/seed-indemnity-sim01.ts` (nuovo, non idempotente in senso stretto — controlla `exitReason: null` prima di scegliere) marca 3 giocatori già in rosa a Sim01 (Butez, Audero, Skorupski) come `exitReason: ESTERO` + `listStatus: NOT_IN_LIST` — è l'unico motivo di uscita che genera indennizzo configurabile (RITIRATO/RETROCESSO sono gratuiti). Eseguito su produzione via `bash scripts/with-env.sh .env.vercel npx tsx scripts/seed-indemnity-sim01.ts` (nessun DB secret in chiaro in chat). **Nota importante, decisione esplicita di Pietro**: `listStatus`/`exitReason` sono globali sul catalogo `SerieAPlayer`, non per-lega — per il tempo del test questi 3 giocatori risultano "fuori Serie A" in OGNI lega della piattaforma, non solo in Playthrough Beta. Pietro ha scelto di procedere senza controlli di isolamento extra. **Da ricordare**: se serve tornare allo stato pulito dopo il test, va rieseguito un reset mirato su questi 3 `playerId` (non un reset globale, per non toccare eventuali uscite reali nel frattempo).
2. ✅ **UI "Assegnazione premi"**: rimosso l'input+bottone sotto la tabella. Aggiunto pulsante **"+ Aggiungi Premio"** sempre visibile a destra dell'header dello Step 3 (via `StepCard.headerAction`, slot già esistente nel componente), che apre un form inline (nome + Salva/Annulla) senza lasciare la vista; alla conferma la tabella si aggiorna con la nuova colonna. Ogni categoria non di sistema è ora **rinominabile** (icona matita → input inline) ed **eliminabile**, entrambe disabilitate quando `config.isFinalized` (stesso cancello già esistente per l'eliminazione). Nuovo endpoint `PATCH /api/prizes/categories/:categoryId` (`renamePrizeCategory` in `prize-phase.service.ts`).
3. ✅ **Budget → Bilancio**: `PrizeAssignmentTable.tsx` ora mostra "Bilancio"/"Bilancio Tot." calcolati con `computeBilancio(currentBudget, totalSalaries)` da `src/utils/finance.ts`, sia desktop sia mobile. Il backend (`getPrizePhaseData`) ora restituisce anche `totalSalaries` per membro. Estesa per coerenza anche la vista manager (header "Bilancio pre-premi"/"Bilancio aggiornato" invece di "Budget").
4. ✅ **Rimosso pulsante "VEDI I PREMI →"**: fix generale in `PhaseBar.tsx` (non solo per Premi) — la CTA di fase ora si nasconde quando `currentPage` (passato da `Navigation.tsx`) coincide già con la pagina di destinazione, invece di essere sempre presente. Si applica a qualunque fase futura con lo stesso problema, non solo Premi.

**Verifica fatta**: `tsc --noEmit` 0 errori, lint invariato (0 nuovi errori/warning), `vitest run` 1780/1780 verdi. **Verifica visiva live NON ancora fatta** — Pietro deve controllare su `https://fantacontratti-multiagent.vercel.app/leagues/cmt72bxuw0005sls2o232kz7x/prizes` (tab nuova, non riusare una già aperta prima del deploy — vedi nota cache/SPA più sopra in questo file) dopo il prossimo deploy.

5. A valle: Pietro verifica dal vivo, poi eventualmente deploy su `main`, poi Fase 7 (Go/No-Go finale).

**Aggiunta 2026-08-27 (sera)**: su richiesta di Pietro, l'admin ora può correggere gli importi premio per-manager anche **dopo la finalizzazione**, per tutta la durata del mercato (non solo durante la fase Premi) — non solo prima. Il backend aveva già `adminCorrectMemberPrize`/`PATCH /api/leagues/:leagueId/prizes/correct` pronto e mai collegato (Bibbia MERCATO-RICORRENTE §4.5: applica il delta al budget già accreditato, logga la correzione come ANOMALY); il lavoro è stato collegare la UI (`PrizePhaseManager.handleSavePrize` sceglie l'endpoint giusto in base a `config.isFinalized`, `PrizeAssignmentTable` non blocca più gli importi a fase finalizzata) e correggere due frasi che dicevano il contrario.

**Estensione immediata (stessa sera)**: Pietro ha chiesto "tutto", non solo i premi normali — sbloccati anche **indennizzi** (`setCustomIndemnity`/`consolidateIndemnities`: nessun lock su isFinalized, sicuro perché l'importo non viene mai accreditato in fase Premi, letto dal vivo al momento del KEEP/RELEASE in Contratti) e **re-incremento base** (`updateBaseReincrement`: qui serve il delta, perché è accreditato in blocco a TUTTI i manager al finalize — la correzione applica il delta al budget di ogni membro attivo nella stessa transazione, loggata ANOMALY). Nessun blocco residuo tranne gestione categorie premio (aggiungi/rinomina/elimina), invariata.

**Bug scoperto e corretto nello stesso giro**: "Bilancio Tot." (tabella admin) e "Bilancio aggiornato" (vista manager) sommavano *due volte* base+premi normali una volta finalizzato — quei valori sono proiezioni pensate per PRIMA della finalizzazione (bilancio ancora da accreditare + pacchetto premi), ma dopo la finalizzazione il bilancio mostrato li include già. Fix: nuova funzione condivisa `getBilancioIncrement` in `PrizePhaseManager.tsx` — prima della finalizzazione invariata (proiezione intera, zero rischio regressione, verificato anche a mano con casi numerici), dopo somma solo l'eventuale indennizzo non ancora pagato (mai accreditato dal finalize). Riusata identica sia in tabella admin sia in vista manager (unica fonte di verità, niente formule divergenti). **Secondo bug scoperto e corretto nello stesso giro**: la proiezione PRIMA della finalizzazione includeva l'indennizzo dentro "Premio Tot."/"Bilancio Tot.", come se il finalize lo accreditasse — ma `finalizePrizePhase` esclude sempre le categorie di sistema (indennizzi) dall'accredito (pagato solo più avanti in Contratti, se il manager rilascia il giocatore). Stesso problema anche nella vista manager: il banner "Totale accreditato" includeva l'indennizzo pur non essendo mai stato accreditato. Fix: `calculateMemberTotal` non somma più l'indennizzo (ora è "Premio Garantito" = solo base + premi normali, ciò che il finalize accredita davvero); `getBilancioIncrement` semplificato a sempre 0 se finalizzato, mai più l'indennizzo in nessuno dei due rami. L'indennizzo resta visibile SOLO nella sua colonna/card dedicata, con nota esplicita che è potenziale ("La colonna Indennizzi è potenziale...", "Indennizzi estero (potenziale)... liquidato in fase Contratti solo se rilasci il giocatore"). Rinominata la colonna "Premio Tot." → "Premio Garantito" per chiarezza. Verificato a mano con lo stesso esempio numerico: nessuna discontinuità in nessuno stato (pre-finalize, post-finalize, dopo correzione).

Verificato: typecheck/lint puliti, 1780/1780 test verdi. **Non ancora testato dal vivo** il flusso di correzione post-finalizzazione (premi/indennizzi/base) su una sessione reale.

**Aggiunta 2026-08-28: Re-incremento Base spostato in tabella, per-manager**. Richiesta di Pietro: il valore deve stare nella tabella Assegnazione Premi ed essere modificabile da lì, di default uguale per tutti ma con possibilità di assegnazione individuale. Indagine preliminare ha mostrato che il valore (`PrizePhaseConfig.baseReincrement`, un unico numero condiviso) veniva letto in 3 punti — Assegnazione Premi, Storico → tab Premi di sessione, Storico Premi (accordion) — e che gli ultimi due avevano GIÀ un bug di doppio conteggio sugli indennizzi indipendente dalla richiesta. Pietro ha scelto "fix completo e coerente" per tutti e 3 i punti.

**Design** (zero migrazioni Prisma — riuso di `PrizeCategory`/`SessionPrize`, gli stessi modelli già usati per gli indennizzi): il re-incremento base è ora una categoria di sistema "Re-incremento Base" (`isSystemPrize: true`, non rinominabile/eliminabile ma editabile per-manager come ogni altra categoria), creata da `initializePrizePhase` per le nuove sessioni e da una migrazione lazy idempotente (`ensureBaseReincrementCategory`, chiamata da `getPrizePhaseData`/`finalizePrizePhase`) per le sessioni già esistenti — seedata col valore storico di `config.baseReincrement`, quindi zero salti visibili per la sessione di test di Pietro. `createdAt` ancorato a 1s prima di `config.createdAt` per garantire che la colonna sorti sempre per prima.

**Modifiche principali**:
- `updateBaseReincrement` (funzione + route + client API) **rimosso**: ridondante, editare la categoria usa gli stessi meccanismi già esistenti (`setMemberPrize`/`adminCorrectMemberPrize`).
- Nuovo helper `isCreditedCategory` (duplicato in `prize-phase.service.ts` e `history.service.ts`, stesso pattern già in uso per `isIndemnityCategory`): vero per le categorie normali E per "Re-incremento Base", falso per gli indennizzi — sostituisce ovunque il vecchio controllo `!isSystemPrize` che non distingueva le due cose.
- `finalizePrizePhase`/`adminCorrectMemberPrize`: usano `isCreditedCategory` invece di sommare/accreditare in blocco `config.baseReincrement`.
- **Bug scoperto e corretto nello stesso giro, in `getPrizePhaseData`**: il calcolo di `memberTotals` (campo `totalPrize`, oggi non ancora consumato dal frontend ma presente nell'interfaccia) aveva lo stesso doppio conteggio degli indennizzi delle funzioni storiche — sistemato con lo stesso `isCreditedCategory`.
- **Vincolo scoperto in corsa**: `categories` viene inviato dal backend SOLO all'admin (`categories: isAdmin ? formattedCategories : []`, anti-collusione: i manager non devono vedere gli importi altrui). Rimuovere `config.baseReincrement` dal calcolo frontend avrebbe azzerato silenziosamente il riepilogo "I tuoi premi" del manager (che oggi, scoperto per inciso, non mostra MAI i premi per-categoria individuali né l'indennizzo per lo stesso motivo — bug preesistente, mai notato perché il re-incremento flat mascherava il problema). Fix: nuovi campi mirati nella risposta — `member.baseReincrement` (per-manager, visibile a tutti) e due campi a livello di risposta `myCategoryPrizes`/`myIndemnityTotal` (SOLO il dettaglio del chiamante, non l'intera `categories`) — la privacy verso gli altri manager resta intatta, ma ora il manager vede finalmente il proprio dettaglio invece di un riepilogo vuoto.
- Storico → tab Premi sessione (`history.service.ts::getSessionPrizes`) e Storico Premi accordion (`prize-phase.service.ts::getPrizeHistory`): stessa logica, con **fallback al valore flat storico** quando la categoria non esiste ancora (sessioni finalizzate PRIMA di questa feature, mai più migrate perché non passano più da `getPrizePhaseData`) — zero regressioni per le stagioni reali già concluse in produzione. Rimosso il chip singolo "Base Xm" nell'header collassato dell'accordion (può variare per manager, valore accurato resta nella tabella per-riga).
- Frontend (`PrizePhaseManager.tsx`): rimossa la StepCard "Re-incremento Budget Base" (era Step 1), stepper passato da 4 a 3 step (Indennizzi→1, Assegna premi→2, Finalizza→3). Il valore ora vive come prima colonna della tabella "Assegnazione premi", editabile per-manager con lo stepper esistente.

---

## Controllo definitivo Bilancio/Budget/Monte Ingaggi (2026-08-28)

Vista la quantità di bug trovati in Fase Premi, Pietro ha chiesto un controllo definitivo sui calcoli di Bilancio/Budget/Monte Ingaggi in tutta la piattaforma (Primo Mercato, Rubata, Svincolati, Consolidamento Contratti, Scambi), prima di passare alla verifica grafica di Rubata/Svincolati (prossima attività). Piano approvato: `C:\Users\39349\.claude\plans\twinkling-foraging-crab.md`. Metodo: ricognizione con 4 agenti in parallelo (regole Bibbie, mappa scritture backend, mappa letture frontend, copertura test), poi verifica a mano flusso per flusso con tracciamento numerico, poi fix mirati.

**Esito per flusso:**

| Flusso | Esito | Commit |
|---|---|---|
| **Premi** | Coperto nelle sezioni sopra (stessa sessione) | vedi sopra |
| **Primo Mercato** | 🔴 3 bug trovati e corretti | `09ba90d`, `62ca2da` |
| **Rubata** (flusso reale) | ✅ Conforme, già testato (`rubata-budget-bug.test.ts`) | — |
| **Rubata** (simulazione admin) | 🔴 1 bug trovato e corretto | `693e381` |
| **Svincolati** | 🔴 1 bug trovato e corretto | `dbc6634` |
| **Consolidamento Contratti** | ✅ Logica principale conforme (guardia `postMonteIngaggi > budget`, indennizzo letto dal vivo al RELEASE); 🔴 1 bug atomicità | `03d9d3f` |
| **Scambi** | ✅ Conforme, nessun bug (già transazionale, monte ingaggi correttamente mai toccato) | — |
| **Reset Primo Mercato (admin)** | 🔴 1 bug trovato in corsa | `03d9d3f` |

**Dettaglio bug corretti:**

1. **3 formule "offerta massima" divergenti** (`auction-room-v2/StatusBar.tsx`, `BiddingPanel.tsx`, `FinancialDashboard.tsx`): ciascuna ricalcolava bilancio+riserva-slot autonomamente lato client, con riserve diverse (2M/slot in due punti, ~1M/slot nel terzo) — stesso pattern del bug storico Monte Ingaggi/Scambi. Unificate in `computeMaxAuctionBid`/`computeSlotReserve` in `src/utils/finance.ts`, mirror esatto della validazione server (`auction.service.ts`, Bibbia `PRIMO-MERCATO.md` §8).
2. **Messaggio di rifiuto offerta impreciso** (server, `auction.service.ts`): mostrava un'"offerta massima" che non sottraeva l'ingaggio risultante — ritentando esattamente quel numero, l'offerta veniva respinta di nuovo. Corretto con lo stesso calcolo iterativo lato server (usa `calculateDefaultSalary` reale).
3. **Race concorrente su chiusura asta Primo Mercato**: due client che interrogano `getCurrentAuction` nello stesso istante in cui il timer scade potevano ENTRAMBI superare il check "status===ACTIVE" ed eseguire l'assegnazione — stesso giocatore assegnato due volte, budget scalato due volte. Stessa race tra chiusura admin esplicita e auto-chiusura lazy. Fix: `updateMany` guardato su `status:'ACTIVE'` come compare-and-swap atomica, dentro `$transaction` insieme a roster/contratto/budget (`closeAuction` e `getCurrentAuction`).
4. **Stesso pattern di race in Svincolati** (`closeSvincolatiAuction`): auto-chiusura per timer lato client (gate `isAdmin`, ma niente protezione da doppia tab) vs click manuale. Stesso fix (claim atomico).
5. **`completeRubataWithTransactions`** (simulazione admin, usata anche su leghe reali per playthrough): aggiornava `currentBudget` ma MAI `totalSalaries` — a differenza del flusso reale, lasciando il Monte Ingaggi disallineato dai contratti effettivi fino al prossimo consolidamento. Corretto (+ reso transazionale, prima 7 chiamate Prisma sequenziali).
6. **`releasePlayer`** (svincolo pre-consolidamento) e **`resetFirstMarket`** (tool admin "resetta e ricomincia"): scritture non transazionali, avvolte in `$transaction`.
7. **Bug aggiuntivo trovato in `resetFirstMarket`**: dopo aver cancellato tutti i contratti, `totalSalaries` non veniva MAI azzerato — restava al valore "fantasma" precedente il reset, dando un Bilancio sbagliato subito dopo ogni reset di Primo Mercato. Corretto.

**Buco di test chiuso** (`b76a31c`): `auction.service.ts`, `svincolati.service.ts`, `prize-phase.service.ts` non avevano ALCUN test automatico nonostante gestiscano i movimenti di budget/monte ingaggi più frequenti della piattaforma. Aggiunti 3 nuovi file mirati sull'invariante finanziario critico di ciascun flusso (non copertura esaustiva) — 1791/1791 test verdi.

**Verificato per ogni fix**: tracciamento numerico a mano, `tsc --noEmit`, lint file toccati, `npm run test:all` (rimasto verde ad ogni commit). **Non ancora testato dal vivo** nessuno di questi fix su una sessione reale — in particolare la race di concorrenza (finding 3/4) è per natura difficile da riprodurre manualmente in un playthrough normale; l'unica verifica pratica è che il comportamento normale (nessuna concorrenza) resti identico, cosa già confermata dai test.

**Fuori scope per questo giro** (esplicitamente, vedi piano): verifica grafica/UI di Rubata e Svincolati (prossima attività); hardening generale della concorrenza oltre ai punti sopra; modifiche allo schema Prisma (nessuna necessaria).

Verificato: typecheck/lint/build (frontend + backend) puliti, 1780/1780 test verdi. Tracciato a mano l'intero ciclo di vita (init → override individuale → finalizzazione → correzione post-finalizzazione) per Bilancio/Premio Garantito, nessuna discontinuità. **Non ancora testato dal vivo** — Pietro deve verificare su Playthrough Beta che la migrazione lazy sia trasparente (nessun numero cambiato) e che l'override individuale funzioni end-to-end.
