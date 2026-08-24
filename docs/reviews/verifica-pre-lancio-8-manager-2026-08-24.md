# Verifica pre-lancio beta — lega da 8 manager (avviato 2026-08-24)

> Documento vivo. Aggiornare "Stato avanzamento" a ogni sessione, prima di compact/clear.
> Obiettivo: verificare funzionalità + prestazioni su ambiente Vercel deployato, prima di aprire la piattaforma a una lega reale di 8 manager.
> Piano di riferimento (fasi 0-7): `C:\Users\39349\.claude\plans\inherited-whistling-tulip.md` (approvato da Pietro il 2026-08-24).

---

## Stato avanzamento

**Ultimo aggiornamento: 2026-08-24 — Fasi 0-3 completate.** Prossimo passo: Fase 4 (sweep #7) o Fase 5 (playthrough con Pietro), a scelta di Pietro su cosa fare prima.

| Fase | Stato | Note |
|------|-------|------|
| 0 — Salute locale | ✅ Fatta | test:all 1765/1765, lint 0 errori (1214 warning pre-esistenti), build ok |
| 1 — Deploy preview develop | ✅ Fatta | `REVIEW_PRE_BETA` pushato + merge fast-forward in `develop` (91addae→9757e23) + push. Vercel preview READY |
| 2 — Smoke sul preview | ✅ Fatta | Vedi sezione dedicata sotto |
| 3 — Documento di sessione | ✅ Fatta | Questo file + HANDOFF.md + memoria aggiornati |
| 4 — Sweep bug aperti | 🟡 Parziale | #3 e #11 risultano già risolti dal rework; #7 e #13 verificati ma non azionati (vedi sotto) |
| 5 — Playthrough 8 fasi | ⬜ Da fare | Serve disponibilità Pietro per i test utente da browser |
| 6 — Performance | ⬜ Da fare | Script pronti, da ripuntare sul preview |
| 7 — Go/No-Go main | ⬜ Da fare | Dopo 4-6 |

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

---

## Prossimi passi

1. Decidere con Pietro se procedere prima con Fase 4 (chiudere #7, opzionale) o Fase 5 (playthrough live) o Fase 6 (performance).
2. Per Fase 5: Pietro logga sul preview (via team Vercel o link di bypass da rigenerare) e segue la checklist sopra.
3. Per Fase 6: adattare gli script stress-test al preview e gestire il bypass SSO nelle richieste HTTP dello script.
4. A valle di 4-6: Fase 7, proporre `npm run deploy:main` (azione da confermare esplicitamente).
