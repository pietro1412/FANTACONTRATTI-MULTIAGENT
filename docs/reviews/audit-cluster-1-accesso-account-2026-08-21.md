# Audit Cluster 1 — Accesso & Account (2026-08-21)

> Perimetro: `Login`, `Register`, `Profile`, `CreateLeague`, `Dashboard`, `Rules` (`src/pages/`)
> + componenti dedicati (`src/components/auth/*`, `src/components/profile/*`,
> `src/components/league/attention.tsx`, `Navigation.tsx`).
> Metodo: lettura sorgente completa delle 6 pagine + componenti figli, cross-check contro
> `docs/bibbie/CONTRATTI.md` e `contract.service.ts` per i dati di regolamento mostrati in
> `Rules.tsx`, sessione browser autenticata (`pietro@test.it`) su Dashboard/Profile/
> CreateLeague, verifica diretta via `fetch()` degli endpoint `/api/auth/register` e
> `/api/auth/login` per bypassare l'instabilità della sessione UI condivisa (vedi nota sotto).
>
> **Nota ambientale**: sessione browser condivisa con altri cluster paralleli sullo stesso
> profilo Chrome (stessa causa già segnalata nell'audit Cluster 2). Nel mio caso l'effetto
> è stato più marcato: un tentativo di registrazione via UI è stato invalidato a metà
> flusso (campi svuotati/dropdown di navigazione aperti da un altro tab) e un tentativo di
> login post-registrazione è avvenuto mentre un altro agente aveva già rimpiazzato la
> sessione con quella di Pietro. Ho verificato register+login **direttamente via API**
> (`fetch` da console, utente `audit-test-01@test.it` — 201 poi 200) per avere una prova
> solida indipendente dalla UI, e ho comunque completato dal vivo un ciclo reale
> logout → login-fallito → registrazione UI → **creazione lega reale** ("Audit Cluster1
> 20260821", visibile ora in Dashboard come 4ª lega di Pietro, stato DRAFT/"In
> preparazione" — nessuna lega esistente toccata). `resize_window` a viewport mobile
> (390×844) non ha avuto alcun effetto sullo screenshot in questo ambiente (stesso limite
> già osservato dal Cluster 2): i finding mobile sotto sono basati su lettura delle classi
> Tailwind responsive, non su screenshot reali a 390px.

## Sintesi esecutiva (5 problemi a più alto impatto)

1. **`Rules.tsx` mostra un moltiplicatore clausola SBAGLIATO per i contratti a 1 semestre** (×4 invece di ×3): è l'unica pagina in-app dove un manager impara le regole, e il dato contraddice sia il codice (`contract.service.ts`) sia la Bibbia (`CONTRATTI.md`).
2. **`Profile` ripete avatar+nome+email in 3 blocchi separati** (testata, "Foto profilo", "Informazioni account") nei primi ~500px della pagina, prima di arrivare a qualunque azione utile — l'esempio più diretto del "troppo e troppo ripetuto" nel cluster.
3. **Le preferenze notifiche non danno mai un riscontro**: successo e fallimento sono entrambi silenziosi (`.catch(() => {})`), in violazione della policy toast di `CLAUDE.md`.
4. **La registrazione riuscita non dà alcuna conferma positiva**: redirect silenzioso a `/login`, identico a un login qualsiasi — l'utente non sa se l'account è stato creato, mentre `CreateLeague` ha una vera schermata di successo per un'azione analoga.
5. **Il mini-onboarding dinastico scompare per sempre dopo la prima lega**: i 3 passi "Crea o Cerca / Invita Amici / Inizia l'Asta" su Dashboard sono visibili solo quando `leagues.length === 0`; da lì in poi l'unico modo per capire il modello contrattuale è cercare da sé "Regole del Gioco", che non è mai linkato da Dashboard o dalla schermata di successo di CreateLeague.

---

## Findings per dimensione

### 1. Gerarchia informativa (Assioma 6/7/9)

Il cluster non mostra liste di giocatori (competenza di altri cluster), quindi l'Assioma 6
(ruolo→nome→squadra→età→ingaggio→durata→clausola→prezzo rubata→statistiche) non si applica
direttamente. Un solo punto di contatto: `Rules.tsx` usa `PlayerRoleBadge`/icone ruolo per
gli esempi di slot rosa, coerente col resto della piattaforma.

**F1 — Dashboard: la riga di lega rispetta bene la gerarchia "cosa serve decidere ora" (positivo, nessuna azione)**
- Dove: `src/pages/Dashboard.tsx`, righe 340-428 (tabellone desktop) e 430-471 (mobile).
- Cosa: l'ordine colonne — Lega (crest+nome+ruolo+conteggio manager) → Fase → **Azioni** (chip che segnala cosa manca: "Consolida", "Tocca a te") → Budget → CTA — mette l'azione richiesta prima del dato numerico, ed è lo stesso ordine desktop/mobile. È l'equivalente, per una lista di leghe, del principio "ciò che serve alla decisione prima del resto" dell'Assioma 6.
- Nessuna proposta: cito questo pattern come riferimento positivo per eventuali revisioni future di altre pagine.

### 2. Navigazione e Information Architecture

**F2 — Il dropdown Profilo ripropone "Le Mie Leghe", già presente e attiva nella nav bar nello stesso istante (Medio)**
- Dove: `src/components/Navigation.tsx`, righe 593-600 (voce dropdown "Le Mie Leghe") vs righe 464-471 (`NavButton` "Le Mie Leghe" sempre visibile nella barra principale quando non si è dentro una lega).
- Cosa: su Dashboard, la barra di navigazione mostra già il pill attivo "🏆 Le Mie Leghe"; aprendo il menu Profilo (avatar in alto a destra) compare una seconda voce "Le Mie Leghe" che porta esattamente alla stessa pagina in cui ci si trova già.
- Perché è un problema: stesso pattern segnalato dal Cluster 2 per le tile Hub — è tecnicamente DRY (`onNavigate('dashboard')` in entrambi i punti) ma il risultato percepito è un link duplicato a un click di distanza dall'originale. Su una pagina di lega (non Dashboard) la voce ha più senso perché lì la nav bar non mostra "Le Mie Leghe" come pill primario.
- Proposta (bassa priorità, sforzo minimo): nascondere la voce "Le Mie Leghe" dal dropdown quando `currentPage === 'dashboard'` (la pagina è già lì), tenendola per le altre pagine dove serve davvero come scorciatoia.

**F3 — "Regole del Gioco" è raggiungibile solo da due punti poco scoperti, mai da Dashboard/CreateLeague (Alto)**
- Dove: link presente in `src/pages/Login.tsx` righe 54-66 (footer, solo pre-login) e nel dropdown Profilo `Navigation.tsx` riga 601-609 (post-login, ma dentro un menu a tendina, non in vista).
- Cosa: una volta autenticato, un manager alle prime armi che crea/entra nella sua prima lega non incontra mai un invito esplicito a leggere le regole — non su Dashboard (l'onboarding a 3 step generico non menziona contratti/clausole/KEEP-RELEASE, vedi F7), non sulla schermata di successo di `CreateLeague.tsx` (righe 226-318, che offre solo "Invita manager" e "Vai alla Dashboard").
- Perché è un problema: il modello dinastico (contratti pluriennali, clausole, spalma, KEEP/RELEASE) è la caratteristica che più differenzia FantaContratti da un fantacalcio classico — e verso di essa manca deliberatamente qualunque richiamo automatico dopo il primo accesso. Contrasto con benchmark: Hattrick e Football Manager introducono i concetti chiave (contratti, budget) nel primissimo flusso post-onboarding, non li relegano a un link in un menu.
- Proposta: aggiungere un link "📖 Leggi le regole del gioco" nella schermata di successo di `CreateLeague` (accanto a "Vai alla Dashboard") e, se la lega è ancora `DRAFT` o alla primissima visita, un banner leggero e dismissabile su Dashboard ("Prima lega? Leggi le regole in 5 minuti").

### 3. Progressive disclosure

**F4 — Profile: nessuna disciplina di progressive disclosure, tutto espanso di default (Alto)**
- Dove: `src/pages/Profile.tsx` righe 56-96 (composizione della pagina); `src/components/profile/AccountInfo.tsx` (intera, sempre visibile); `src/components/profile/ProfilePhotoSection.tsx` (intera, sempre visibile); `src/components/profile/NotificationPreferences.tsx` righe 123-158 (5 switch sempre visibili).
- Cosa (verificato dal vivo, `pietro@test.it`): scorrendo la pagina dall'alto si incontrano in sequenza — testata (avatar+nome+email+badge verificata) → card "Foto profilo" (avatar di nuovo + pulsante) → card "Informazioni account" (username+email di nuovo, sola lettura) → card "Sicurezza" (collassata dietro un bottone, **questa sì ben fatta**) → card "Notifiche" (5 toggle sempre espansi) → card "Le mie squadre". Tre blocchi su sei mostrano contenuto ridondante prima di arrivare a un'azione utile.
- Perché è un problema: viola lo spirito "less is more in superficie" del principio guida — non c'è alcuna gerarchia tra "cosa serve vedere subito" (chi sono, sono verificato) e "cosa serve solo se lo cerco" (cambiare foto, vedere username in un campo bloccato che è identico al nome già mostrato sopra). `ChangePasswordForm.tsx` (righe 61-65) dimostra che il pattern giusto è già nel codice — parte come un bottone "Cambia Password" e si espande solo su richiesta — ma non è stato applicato al resto della pagina.
- Proposta: vedi mockup `docs/reviews/mockups/26-audit-cluster1-accesso/profile-consolidato.html` — una card identità unica (avatar con badge fotocamera in overlay, nome, email, badge verificata) sostituisce testata + Foto profilo + Informazioni account, senza perdere nessuna funzione (cambia/rimuovi foto restano, il lucchetto segnala sola lettura). Nessuna decisione di prodotto delicata: stessi dati, stessi componenti (`usePhotoUpload`, `userApi`), solo consolidati in un contenitore.

**F5 — CreateLeague: form sempre tutto aperto anche per sezioni quasi mai toccate (Medio — richiede conferma di Pietro)**
- Dove: `src/pages/CreateLeague.tsx` righe 320-524 (`FormSection` "Informazioni Lega", "Configurazione", "Visibilità", "Slot Rosa" tutte renderizzate in sequenza e sempre aperte).
- Cosa: "Visibilità" ha un default sensato e commentato nel codice stesso (riga 88: *"Default: lega privata... accessibile solo su invito"*) e "Slot Rosa" pre-compila 3/8/8/6 (righe 84-87), che sono gli stessi valori standard citati in `docs/bibbie/PRIMO-MERCATO.md`. Un manager che crea una lega con gli amici userà quei default nella maggioranza dei casi.
- Perché è un problema: la superficie del form obbliga a scorrere/leggere 4 sezioni complete anche quando le ultime due non richiedono alcuna decisione.
- Proposta: vedi mockup `docs/reviews/mockups/26-audit-cluster1-accesso/create-league-avanzate.html` — raggruppare "Visibilità" + "Slot Rosa" in un accordion "Impostazioni avanzate" collassato di default, con un sottotitolo che riassume i default scelti ("Privata · 3/8/8/6") così anche senza aprirlo si sa cosa si sta accettando. **Attenzione**: è una scelta di prodotto (cambia cosa vede per primo chi crea una lega) — da validare con Pietro prima di implementare, non un semplice bugfix.

**F6 — CreateLeague success: due meccanismi di invito mostrati insieme, senza gerarchia esplicita (Basso)**
- Dove: `src/pages/CreateLeague.tsx` righe 239-311 — blocco "Invita manager" (email/username) e blocco "Oppure condividi il codice invito" mostrati entrambi, sempre, subito dopo la creazione.
- Cosa: il codice li tratta già come primario/secondario nei commenti (riga 238 "primario", riga 293 "secondario") e li stila diversamente (bordo pieno vs tratteggiato) — la gerarchia visiva **c'è**, ma resta comunque un secondo meccanismo sempre visibile invece che dietro un "mostra codice invito" pieghevole.
- Proposta (facoltativa, sforzo minimo): collassare il blocco codice-invito dietro un link testuale "Preferisci condividere un codice?" — riduce di un blocco la schermata di successo senza perdere la funzione.

### 4. Coerenza (componenti condivisi, colori, tipografia)

**F7 — Nome del brand incoerente tra pagine pre-login e post-login (Basso)**
- Dove: `src/components/auth/AuthShell.tsx` riga 50 (`FantaContratti`, camelCase) e riga 65 (footer `© {year} FantaContratti`) vs `src/components/Navigation.tsx` righe 304 e 672 (`Fantacontratti`, una sola maiuscola).
- Cosa: Login, Register e le altre pagine su `AuthShell` mostrano "FantaContratti"; una volta autenticati, l'header e il pannello mobile mostrano "Fantacontratti". Stesso brand, due grafie diverse a pochi secondi di distanza (login → dashboard).
- Proposta: allineare su una sola grafia (il progetto usa "FantaContratti" nel `package.json`/README e "Fantacontratti" nei testi discorsivi di CLAUDE.md — andrebbe deciso una volta e applicato ovunque; sforzo trascurabile, 2 file).

**F8 — Copyright anno hardcoded su Rules, dinamico altrove (Basso)**
- Dove: `src/pages/Rules.tsx` riga 656 (`© 2024 Fantacontratti`, stringa fissa) vs `src/components/auth/AuthShell.tsx` riga 34 (`const year = new Date().getFullYear()`) e riga 65 (`© {year} FantaContratti`).
- Cosa: `AuthShell` calcola l'anno corrente; `Rules.tsx` ha "2024" scritto a mano, oggi (2026) già disallineato di 2 anni.
- Proposta: riusare lo stesso pattern `new Date().getFullYear()` in `Rules.tsx` (una riga).

**F9 — Register non usa mai `useToast`, in coerenza però con la policy sugli errori bloccanti (nessuna azione)**
- Verificato: nessuna delle 6 pagine (`Login`, `Register`, `Profile`, `CreateLeague`, `Dashboard`, `Rules`) importa `useToast` direttamente — usano `AuthError`/banner inline per gli errori di form, che è esattamente l'eccezione prevista da CLAUDE.md ("banner inline persistente SOLO per errori bloccanti... o validazione form vicino al campo"). I componenti di `Profile` che eseguono azioni con effetto reale (`ChangePasswordForm`, `ProfilePhotoSection`) **usano correttamente** `useToast` per successo/errore. L'eccezione è `NotificationPreferences` — vedi F10.

### 5. Densità contestuale

Login/Register (card singola stretta) e Profile/CreateLeague (colonna singola `max-w-2xl`)
sono coerentemente a bassa densità, appropriata per un contesto di lettura/decisione
ragionata (non asta live) — nessun pattern cockpit necessario qui, in linea con CLAUDE.md.
Dashboard usa correttamente il "tabellone stile classifica" (denso ma non sovraccarico,
azione sempre a destra). Nessun problema di densità rilevato.

### 6. Stati (loading / empty / error / success)

**F10 — NotificationPreferences: nessun riscontro né in caso di successo né di errore (Alto)**
- Dove: `src/components/profile/NotificationPreferences.tsx`, funzione `toggle` righe 94-98: `await pushApi.updatePreferences(updated).catch(() => {})` — l'errore viene inghiottito silenziosamente e **non c'è nemmeno un `toast.success` nel percorso positivo**.
- Cosa: verificato dal vivo — ho disattivato e riattivato "Offerte scambio" da Profilo: lo switch cambia stato otticamente (stato locale ottimistico), ma non appare alcun toast né in caso di successo né se la chiamata `PATCH` fallisse. Un manager che disattiva "Scadenze contratti" pensando di essere protetto da una richiesta di rilascio silenziosa non ha modo di sapere se la preferenza è stata davvero salvata sul server.
- Perché è un problema: viola direttamente CLAUDE.md ("esiti di azioni (successo o errore transiente) → toast via `useToast()`"), ed è particolarmente delicato perché le notifiche che si stanno disattivando riguardano proprio gli eventi critici di un dynasty (scadenze contratti, inizio aste).
- Proposta: aggiungere `toast.success`/`toast.error` nella funzione `toggle` e in `handlePushToggle`, riusando lo stesso `useToast` già importato correttamente in `ProfilePhotoSection.tsx` e `ChangePasswordForm.tsx` nella stessa cartella — intervento di poche righe, zero rischio.

**F11 — Register: nessuna conferma positiva dopo la registrazione riuscita (Alto)**
- Dove: `src/pages/Register.tsx` righe 71-76 — su `result.success`, se non c'è `inviteToken`, `onNavigate('login')` senza alcun messaggio.
- Cosa: verificato via API (`POST /api/auth/register` → `201 {"success":true,"message":"Registrazione completata"}`) che il backend restituisce già un messaggio di successo — il frontend lo scarta e mostra semplicemente la schermata di Login pulita, indistinguibile da un login normale.
- Perché è un problema, in ottica di coerenza: `CreateLeague.tsx` (righe 226-236) mostra una vera schermata di successo (icona ✓, titolo "Lega Creata!", messaggio) per un'azione paragonabile — due flussi di "creazione" nello stesso cluster, trattati in modo opposto sul feedback di riuscita.
- Proposta: passare un flag via query string/state alla navigazione verso `login` (es. `onNavigate('login', { justRegistered: '1' })`) e mostrare un `AuthSuccessCard` (già usato da `CreateLeague`) o un banner "Registrazione completata, accedi per iniziare" sopra il form di Login.

**F12 — Profile: spinner a pagina intera invece dello skeleton usato altrove (Basso)**
- Dove: `src/pages/Profile.tsx` righe 41-47 (spinner centrato a pagina intera durante `loadProfile`) e `src/pages/CreateLeague.tsx` righe 206-212 (stesso pattern per il check superadmin) vs `src/pages/Dashboard.tsx` righe 272-277 (`SkeletonPlayerRow` × 3, che mantiene visibile la struttura della pagina durante il caricamento).
- Cosa: due pattern di loading diversi per lo stesso tipo di attesa (fetch dati utente) nello stesso cluster.
- Proposta (bassa priorità, Assioma 4): riusare uno skeleton coerente con la struttura reale della pagina (card grigie sagomate) al posto dello spinner pieno schermo, come già fa Dashboard.

### 7. Onboarding & first-run

Vedi F3 sopra per il gap principale (Regole del Gioco non collegato dopo il primo accesso).
Nota positiva: l'empty-state di Dashboard (`src/pages/Dashboard.tsx` righe 296-321, commento
`T-019: Onboarding steps`) è un buon esempio di onboarding leggero a 3 passi — il problema
è solo che scompare per sempre non appena esiste una lega, invece di restare disponibile
(es. come voce richiamabile) per chi è comunque nuovo al modello dinastico.

### 8. Mobile

Basato su lettura del codice (nessuno screenshot reale a 390px ottenuto in questo ambiente,
vedi nota in testa al documento).

- `Login`/`Register` (`AuthShell.tsx`): colonna singola `max-w-md`, nessuna tabella, nessun rischio di troncamento (Assioma 2 non applicabile per assenza di dati tabellari).
- `Dashboard`: doppio markup esplicito desktop/mobile con commento nel codice (`src/pages/Dashboard.tsx` riga 430: *"Tabellone mobile (3 zone, niente troncamenti)"*) — conformità intenzionale e dichiarata all'Assioma 2.
- `Rules`: TOC desktop `hidden lg:block` (sidebar sticky) sostituito su mobile da un `<details>` collassabile (`lg:hidden`, righe 186-199) — buon pattern, nessun contenuto perso.
- `CreateLeague`: griglia slot `grid-cols-2 md:grid-cols-4` (riga 496) — 2 colonne su mobile, valori numerici brevi, nessun rischio di troncamento.
- `Switch` (usato da `NotificationPreferences`): touch target ≥44px ottenuto correttamente via padding sul `button` wrapper (`src/components/ui/Switch.tsx` riga 28, commento esplicito "Touch target >= 44px"), pur mantenendo il track visivo compatto 46×26 — buona pratica, nessuna azione necessaria.

Nessuna violazione strutturale dell'Assioma 2 rilevata da codice in questo cluster; consiglio
comunque una verifica visiva rapida di Pietro su device reale per `CreateLeague` (form più
lungo, più punti in cui un padding sbagliato potrebbe creare overflow orizzontale non
catturabile dalla sola lettura del JSX).

---

## Bug di dati (riepilogo per riproducibilità)

| # | Dove | Cosa è mostrato | Cosa dovrebbe essere | Fonte di verità |
|---|---|---|---|---|
| B1 | `src/pages/Rules.tsx` riga 520, sezione "Sistema Contratti → Moltiplicatori Clausola" | Contratto 1 semestre → moltiplicatore **×4** | **×3** | `docs/bibbie/CONTRATTI.md` §2.1 (riga 34: "1 → 3") + `src/services/contract.service.ts` riga 18 (`1: 3`) |

**Impatto**: un manager che legge le regole in-app per calcolare quanto rischia di perdere un
giocatore con contratto 1 semestre sottostimerebbe la clausola reale del 25% (es. ingaggio
10M: la pagina suggerisce clausola 40M, quella vera calcolata dal backend è 30M) — errore di
lettura pericoloso proprio nella sezione pensata per insegnare le regole senza dover leggere
le Bibbie. Fix: cambiare `{ duration: 1, multiplier: 4 }` in `{ duration: 1, multiplier: 3 }`
in `src/pages/Rules.tsx` (riga 520).

---

## Azioni reali eseguite durante l'audit

| Azione | Esito |
|---|---|
| Lettura Dashboard/Profile/CreateLeague/Rules dal vivo (`pietro@test.it`) | OK, nessun errore console/rete rilevante |
| Toggle preferenza notifica "Offerte scambio" (off → on, ripristinata) | Funziona lato UI/API, ma senza alcun riscontro visivo (F10) |
| Logout reale (dropdown Profilo → Esci) | OK, redirect a `/login` |
| Registrazione nuovo utente `audit-test-01@test.it` / `AuditTest01` (via UI, poi confermata via API diretta per la race della sessione condivisa) | `201 Registrazione completata` |
| Login con l'utente appena creato (via API diretta) | `200 OK` — conferma che il ciclo registrazione→login funziona end-to-end lato backend |
| Creazione lega reale **"Audit Cluster1 20260821"** (squadra "Audit FC", default 8 partecipanti / 500 budget / privata / 3-8-8-6) | Lega creata con successo, invite code generato, ora visibile in Dashboard come 4ª lega di Pietro (stato DRAFT) — **lasciata sul DB locale**, riconoscibile dal nome per eliminazione futura |
| Nessuna lega esistente (Fantacontratti Test, Lega Test, Lega finale) toccata o modificata | Confermato |

---

## Proposte prioritizzate

| # | Proposta | Impatto | Sforzo | Rif. |
|---|---|---|---|---|
| 1 | Fix dato: moltiplicatore clausola 1 semestre ×4 → ×3 in `Rules.tsx` | **Alto** | S | B1 |
| 2 | Toast successo/errore su `NotificationPreferences.toggle`/`handlePushToggle` | **Alto** | S | F10 |
| 3 | Conferma positiva dopo registrazione riuscita (banner/success card prima del Login) | **Alto** | S | F11 |
| 4 | Consolidare testata+Foto profilo+Informazioni account in un'unica card identità | **Alto** | S/M | F4 |
| 5 | Collegare "Regole del Gioco" da CreateLeague-success e/o Dashboard per i nuovi manager | **Alto** | S | F3 |
| 6 | Collassare "Visibilità"+"Slot Rosa" in "Impostazioni avanzate" su CreateLeague (da validare con Pietro) | Medio | M | F5 |
| 7 | Nascondere "Le Mie Leghe" dal dropdown Profilo quando si è già su Dashboard | Medio | S | F2 |
| 8 | Skeleton coerente al posto dello spinner pieno schermo su Profile/CreateLeague | Basso | S | F12 |
| 9 | Uniformare grafia brand "FantaContratti"/"Fantacontratti" | Basso | S | F7 |
| 10 | Anno copyright dinamico su `Rules.tsx` | Basso | S | F8 |
| 11 | Collassare il codice-invito dietro un link su CreateLeague-success | Basso | S | F6 |

---

## Mockup

Due interventi ad alto impatto che beneficiano di un disegno (less-is-more visibile, non
solo descritto), stessa palette/font dei mockup già approvati (`16-profile/profile.html`,
`15-create-league/create-league.html`):

- `docs/reviews/mockups/26-audit-cluster1-accesso/profile-consolidato.html` — before/after
  della card identità unica per `Profile` (F4).
- `docs/reviews/mockups/26-audit-cluster1-accesso/create-league-avanzate.html` — before/after
  dell'accordion "Impostazioni avanzate" per `CreateLeague` (F5).

Non ho prodotto un mockup per F10/F11/F3 (toast, success card, link regole): sono interventi
puntuali su componenti/testo già esistenti (stesso `useToast`/`AuthSuccessCard` già in uso
altrove), dove il file/riga preciso vale più di un disegno.

---

## File letti per questo audit (nessuna modifica a `src/`)

- `src/pages/{Login,Register,Profile,CreateLeague,Dashboard,Rules}.tsx`
- `src/components/auth/{AuthShell,AuthError}.tsx`
- `src/components/profile/{AccountInfo,ChangePasswordForm,MyTeamsList,NotificationPreferences,ProfilePhotoSection}.tsx`
- `src/components/Navigation.tsx`
- `src/components/ui/{Switch,Turnstile}.tsx`
- `src/services/contract.service.ts` (righe 1-50, per la verifica del moltiplicatore clausola)
- `docs/bibbie/INDEX.md`, `docs/bibbie/CONTRATTI.md` (§1-2)
- `docs/reviews/mockups/{16-profile/profile.html,15-create-league/create-league.html,14-auth/auth.html}` (per verificare se le ridondanze fossero già previste nei mockup approvati — lo erano, quindi F4/F5 sono proposte di ulteriore semplificazione rispetto a un design già accettato, non correzioni di un'implementazione che ha deviato dal mockup)
