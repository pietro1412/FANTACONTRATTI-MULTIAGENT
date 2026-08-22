# Audit Cluster 6 — Admin (AdminPanel di lega + SuperAdmin piattaforma)

Data: 2026-08-21
Ambiente: dev locale (`localhost:5174` + API `localhost:3003`, DB Docker condiviso con altri agenti in parallelo)
Metodo: navigazione browser (Chrome MCP, tab dedicato) su AdminPanel di **Lega Test** e **Fantacontratti Test** con `pietro@test.it`; verifica funzionale via API diretta (Bearer token, non tocca i cookie) per **SuperAdmin** con `admin@fantacontratti.it`; lettura codice sorgente (`AdminPanel.tsx`, `MarketPhaseManager.tsx`, `PhaseBar.tsx`, `AdminBanner.tsx`, `SuperAdmin.tsx` e componenti `src/components/admin/*`, `src/components/superadmin/*`).

## Nota metodologica — azione a cui mi sono fermato

**Non ho fatto login browser come SuperAdmin.** Ho verificato (`src/hooks/useAuth.tsx` + `src/api/routes/auth.ts:122-134`) che il refresh token vive in un cookie **httpOnly condiviso da tutti i tab dello stesso browser** (non per-tab), e che il logout/login lato server **revoca/sovrascrive quel cookie per l'intera sessione browser**. Con altri agenti attivi in parallelo su tab che usano `pietro@test.it` (visti aperti su Scambi, Contratti, Rose, Finanze, Asta di Lega Test/Fantacontratti Test), un login come superadmin nel mio stesso tab avrebbe potuto **dirottare silenziosamente** le loro sessioni al successivo refresh token (l'access token scade ogni 15 min). Ho quindi verificato SuperAdmin via **chiamate API dirette con Bearer token** (`/api/superadmin/status`, `/leagues`, `/users` — tutte funzionanti, dati reali restituiti) e via lettura del codice per l'analisi UI/UX. Se serve una verifica visiva completa del pannello SuperAdmin nel browser, va fatta in un secondo momento isolato (nessun altro agente attivo) o con un profilo browser separato.

Non ho eliminato leghe né utenti, non ho cancellato l'anagrafica giocatori, non ho toccato la lega "Fantacontratti Ufficiale" né account reali.

---

## Sintesi esecutiva (5 problemi a più alto impatto)

1. **Bug di dati reale in produzione-locale**: la sessione attiva di "Lega Test" ha `type: PRIMO_MERCATO` ma `currentPhase: CONTRATTI` — una fase che per regolamento esiste solo nel `MERCATO_RICORRENTE` — e questo rompe silenziosamente il tab "Fasi & Stato" dell'AdminPanel (bottone avanzamento permanentemente disabilitato, "Fase corrente: N/A").
2. **Tre fonti di verità divergenti per "in che fase siamo"**: `src/lib/phaseSteps.ts` (canonica, usata da `PhaseBar`), `MarketPhaseManager.tsx` (usata nell'AdminPanel) e `AdminBanner.tsx` (usata nell'Hub lega) hardcodano ciascuna la propria lista di fasi/etichette/icone — il terreno esatto su cui nasce il bug #1 e la causa strutturale della sensazione "troppo ripetuto".
3. **Ridondanza "less is more"**: l'AdminPanel mostra "Flusso delle Fasi" (7 card verticali con descrizioni estese) che duplica quasi integralmente lo stepper compatto già visibile in testata su ogni pagina (`PhaseBar`), a pochi pixel di distanza sullo stesso schermo.
4. **Controlli di test/simulazione senza gate d'ambiente**, raggiungibili da qualunque admin di lega anche in produzione: "Simula Ricorso", "Simula Tutti" (consolidamento), "Completa a 8 manager (+N test)". Nessun `import.meta.env`/flag di ambiente li nasconde.
5. **Asimmetria di sicurezza nelle azioni distruttive di SuperAdmin**: eliminare una lega richiede di digitare "ELIMINA" (buon pattern); eliminare **tutti i giocatori della piattaforma** (azione enormemente più distruttiva, impatta ogni lega) richiede solo un click di conferma generico.

---

## Findings per dimensione

### 1. Gerarchia informativa / Navigazione — Assioma 1 ("sapere sempre dove ci si trova")

**Cosa**: in Lega Test, la pillola di fase nella testata dell'AdminPanel dice **"PRIMO MERCATO"** mentre la barra fasi globale (`PhaseBar`, sopra la testata, su ogni pagina della lega) dice **"FASE 3 DI 7 — Rinnovo Contratti"** con "Contratti" evidenziato.

**Dove**:
- `src/pages/AdminPanel.tsx:560-565` — `phaseLabel` deriva da `activeSession.type` (PRIMO_MERCATO vs MERCATO_RICORRENTE), non da `currentPhase`.
- `src/components/league/PhaseBar.tsx:33-41` — `PHASE_UI` deriva da `currentPhase` (enum `MarketPhase`), ignora `session.type`.
- Dato osservato via API: `GET /api/leagues/cms7tw7c600are3d5quvxe0g7/auctions` → sessione `cms7u34of00jee3d56kkxkary` con `"type":"PRIMO_MERCATO"`, `"currentPhase":"CONTRATTI"`.

**Perché è un problema**: un admin che apre il pannello per gestire la fase Contratti vede scritto "Primo Mercato" in testata — la primissima cosa che legge è sbagliata. Viola direttamente l'Assioma 1. Inoltre, dentro il tab "Fasi & Stato", `MarketPhaseManager` (vedi §2) sceglie l'array di fasi in base a `session.type === 'PRIMO_MERCATO'`, quindi usa `PRIMO_MERCATO_PHASES` (una sola fase: `ASTA_LIBERA`). Non trovando `CONTRATTI` in quell'array, `currentPhaseIndex` è `-1`, `currentPhase` è `undefined`, "Fase corrente" mostra **N/A**, e il bottone "Avanza a Asta Primo Mercato →" è **permanentemente disabilitato** (`canAdvance()` ritorna `false` se `!currentPhase`, `src/components/MarketPhaseManager.tsx:163-176`). Anche la "Selezione rapida fasi (avanzato)" mostrerebbe solo il bottone Asta Primo Mercato, non le 7 fasi del mercato ricorrente in cui la lega si trova davvero. **L'admin non ha, da questa schermata, alcun modo di avanzare la fase reale della sessione.**

**Causa profonda**: il backend valida correttamente (`src/services/auction.service.ts:539-552`, `setMarketPhase` rifiuta `CONTRATTI` su una sessione `PRIMO_MERCATO`), e non esiste in tutto `src/services` un punto che scriva `currentPhase` di valore ricorrente su una sessione di tipo primo mercato — quindi questo stato specifico è quasi certamente un **artefatto di dati di test** (probabilmente creato con una simulazione/seed che ha scritto `currentPhase` direttamente, bypassando la validazione applicativa), non un bug riproducibile da un flusso utente normale. **Ho verificato che "Fantacontratti Test" non ha questo problema** (type e currentPhase coerenti, FASE 1 DI 7 corretta su entrambe le UI). Resta comunque un **gap di robustezza da correggere**: se questo stato si verifica mai (bug futuro, migrazione, manipolazione diretta DB), l'AdminPanel deve fallire in modo esplicito e comprensibile, non con un bottone morto e un "N/A" silenzioso.

**Benchmark**: Football Manager e Hattrick non lasciano MAI un pannello gestionale in uno stato "azione disponibile ma inerte senza spiegazione" — se un'azione non è eseguibile, il motivo è sempre a schermo.

---

### 2. Coerenza — Assioma 4 (componenti condivisi, non copia-incolla)

**Cosa**: esistono **tre implementazioni indipendenti** della mappa fase→etichetta/icona/navigazione:

| Fonte | Uso | Note |
|---|---|---|
| `src/lib/phaseSteps.ts` + `src/components/league/PhaseBar.tsx` | Barra fase persistente in testa a ogni pagina lega | Canonica, dichiarata tale nel commento (`PhaseBar.tsx:9`), linguaggio Stadium Nights corretto |
| `src/components/MarketPhaseManager.tsx` (righe 31-127) | Tab "Fasi & Stato" dell'AdminPanel | `PRIMO_MERCATO_PHASES`/`MERCATO_RICORRENTE_PHASES` hardcoded, emoji (🔨🔄🏆📝🎯📋), card `rounded-2xl` con gradiente — **stile pre-redesign**, non usa `.micro-label`/`font-display`/`budget-display` |
| `src/components/league-detail/AdminBanner.tsx` (righe 22-53) | Banner fase nell'Hub lega (`LeagueDetail`) | `PHASE_LABELS`/`PHASE_CONFIG` hardcoded, altre emoji, altra palette colori |

**Perché è un problema**: tre elenchi di fasi da mantenere sincronizzati a mano sono esattamente il meccanismo che produce incongruenze come il finding #1 — e sono già visivamente disallineati (icone ed etichette leggermente diverse tra `PhaseBar` e `AdminBanner` per la stessa fase, es. "Offerte e Scambi" vs "Scambi e Offerte"). È anche una violazione diretta della convenzione CLAUDE.md "Elementi grafici condivisi... mai copia-incolla divergenti".

**Proposta concreta**: rifattorizzare `MarketPhaseManager` e `AdminBanner` per consumare `src/lib/phaseSteps.ts` (già esistente e già riusato da `PhaseBar`/`PhaseIndicator`) invece delle proprie tabelle locali. Questo elimina la divergenza e rende impossibile, per costruzione, lo scenario del finding #1 (se `currentPhase` non è nella lista attesa per il tipo di sessione, tutti i punti di lettura lo scoprirebbero allo stesso modo).

---

### 3. Progressive disclosure / Ridondanza "less is more"

**Cosa**: nel tab "Fasi & Stato" dell'AdminPanel, la sezione **"Flusso delle Fasi"** (dentro `MarketPhaseManager`, righe 249-369) mostra le 7 fasi del mercato ricorrente come card verticali larghe, ciascuna con titolo, icona, descrizione a paragrafo e (per la fase corrente) un elenco puntato "Cosa puoi fare". Questo blocco occupa gran parte dello scroll del tab **e duplica quasi integralmente** lo stepper a 7 fasi già presente, compatto e cliccabile, nella `PhaseBar` in testa alla pagina (sempre visibile, un livello sopra).

**Dove**: `src/components/MarketPhaseManager.tsx:248-369` vs `src/components/league/PhaseBar.tsx:94-123`.

**Perché è un problema**: è precisamente il tipo di ripetizione che Pietro segnala come "c'è troppo e troppo spesso ripetuto". Un admin che apre "Fasi & Stato" vede la stessa informazione (elenco fasi, fase corrente, avanzamento) **due volte sullo stesso schermo**, con stili grafici diversi (uno Stadium Nights/cockpit, l'altro pre-redesign).

**Proposta concreta**: nel tab "Fasi & Stato" dell'AdminPanel, **rimuovere il blocco "Flusso delle Fasi"** (la `PhaseBar` già copre "dove siamo" per tutti) e tenere solo ciò che è **esclusivo del ruolo admin**: i controlli di avanzamento/blocco ("Avanza a...", "Torna a...", "Chiudi sessione"), lo stato di consolidamento contratti, e la selezione rapida avanzata. Questo taglia lo scroll del tab di oltre metà senza perdere informazione (less is more in superficie: il "cosa sto per fare" resta, il "spiegami di nuovo tutte le 7 fasi" sparisce).

---

### 4. Controlli di test visibili senza gate d'ambiente (da nascondere prima del lancio pubblico)

Verificati sia lato UI (nessun `import.meta.env`/flag in `src/components/admin/*`) sia lato API (nessun controllo di ambiente in `src/api/routes/admin.ts`, `auctions.ts`, `contracts.ts` per questi endpoint — solo verifica ruolo ADMIN):

| Controllo | Dove (UI) | Dove (API) |
|---|---|---|
| "Simula Ricorso" | `AdminAppealsTab.tsx:82-88` | `POST /api/auctions/.../simulate-appeal` (`auctions.ts:947`) |
| "Simula Tutti" (consolidamento contratti di tutti i manager) | `MarketPhaseManager.tsx:337-347` | `contracts.ts:449` (`simulateAllConsolidation`) |
| "Completa a 8 manager (+N test)" | `AdminMembersTab.tsx:30-39` | `admin.ts:198` (`complete-with-test-users`) |

**Perché è un problema**: sono azioni che, se premute per errore da un admin di lega in una lega reale in beta, alterano lo stato di gioco (contratti auto-consolidati per tutti, ricorsi finti creati, manager fittizi aggiunti alla rosa) senza alcuna via di rollback visibile in UI. Per una cerchia ristretta e fidata (beta attuale) il rischio è basso, ma **vanno nascosti prima di un lancio più ampio** — coerente con la richiesta esplicita del task.

**Proposta concreta**: introdurre un flag `VITE_ENABLE_TEST_TOOLS` (o equivalente) che nasconda questi tre controlli, verificato sia lato frontend (non renderizzare i bottoni) sia lato backend (rifiutare le route se il flag non è attivo in quell'ambiente) — la sola gate frontend non basta perché gli endpoint restano chiamabili direttamente.

---

### 5. Densità contestuale e coerenza — Gestione Membri

**Cosa**: nel tab "Gestione Membri", il badge accanto al nome del tab mostra **sempre** il conteggio totale dei membri attivi (es. "8"), e — solo se >0 — un secondo badge con le richieste pendenti. Nel tab "Ricorsi" invece il badge appare **solo** se ci sono ricorsi pendenti (comportamento "serve attenzione").

**Dove**: `src/pages/AdminPanel.tsx:670-684`.

**Perché è un problema**: un badge accanto a un'etichetta di tab è convenzionalmente un segnale "qui c'è qualcosa che richiede attenzione" (come fanno correttamente Ricorsi ed Export). Il badge "8" su Gestione Membri non richiede alcuna azione — è solo un contatore informativo — e la sua presenza costante lo confonde visivamente con l'altro badge (colore oro) che invece segnala richieste pendenti reali. È un'incoerenza minore ma sistematica nel linguaggio dei badge.

**Proposta concreta**: rimuovere il badge "conteggio membri" dal tab (l'informazione è comunque visibile subito dentro il tab, in "Membri attivi (8)"), lasciando solo il badge oro per le richieste pendenti — uniforma il significato di "badge sul tab" in tutto l'AdminPanel.

---

### 6. SuperAdmin — asimmetria nelle conferme distruttive

**Cosa**: `LeaguesTab.tsx` implementa un pattern di conferma solido per l'eliminazione di una lega — dialog con riepilogo (nome, numero membri, "non può essere annullata") + campo di testo che richiede di digitare **"ELIMINA"** (`src/components/superadmin/LeaguesTab.tsx:9, 244-254`). `UploadTab`/`SuperAdmin.tsx` invece, per **"Elimina tutti i giocatori"** (azione che cancella l'intera anagrafica giocatori usata da tutte le leghe della piattaforma), usa un `confirmDialog` generico con un solo click su "Conferma" (`src/pages/SuperAdmin.tsx:426-433`).

**Perché è un problema**: l'azione con raggio d'impatto maggiore (tutta la piattaforma) ha la barriera di conferma più debole. Non è coerente con il principio "la frizione della conferma deve essere proporzionale al danno potenziale".

**Proposta concreta**: applicare lo stesso pattern "digita per confermare" (es. `CANCELLA TUTTO` o il numero di giocatori) anche a `handleRequestDeleteAllPlayers`.

---

### 7. Aspetti positivi da preservare

- `AdminMembersTab.tsx` ha già un buon pattern responsive: card mobile dedicate (`md:hidden`) vs tabella desktop (`hidden md:block`), coerente con l'Assioma 2 (nessun dato troncato su mobile).
- Le sezioni "Configurazione lega" e "Storico sessioni" nel tab Fasi & Stato sono **collassate di default** (`AdminPhasesTab.tsx:39-40, 122-237`) — buona applicazione di progressive disclosure, da tenere come modello.
- Export Dati: due azioni chiare, minimali, senza fronzoli — verificato funzionante (scaricato realmente `lega_Lega Test_membri.xlsx`, 17KB, con dati corretti).
- SuperAdmin usa correttamente il pattern cockpit (`CockpitShell`, header, tab bar con badge) — coerente con AdminPanel di lega, buona base di riuso a livello di shell anche se il contenuto delle tab (vedi punto 2) non lo è sempre.
- Il pattern "digita ELIMINA" per la cancellazione di una lega è solido e va preso a modello per altre azioni distruttive.

---

## Proposte prioritizzate

| # | Proposta | Impatto | Sforzo | Assioma/principio |
|---|---|---|---|---|
| 1 | Rimuovere il blocco "Flusso delle Fasi" da `MarketPhaseManager` (ridondante con `PhaseBar`) | Alto | S | Less is more |
| 2 | Rifattorizzare `MarketPhaseManager` e `AdminBanner` per usare `src/lib/phaseSteps.ts` come unica fonte | Alto | M | Assioma 4 |
| 3 | Difesa robusta: se `currentPhase` non appartiene alle fasi valide per `session.type`, mostrare uno stato di errore esplicito invece di "N/A" + bottone morto | Alto | S | Assioma 1 |
| 4 | Gate d'ambiente per "Simula Ricorso" / "Simula Tutti" / "Completa a 8 manager" (frontend + backend) | Alto (pre-lancio) | M | Sicurezza/pulizia pre-lancio |
| 5 | "Digita per confermare" su "Elimina tutti i giocatori" in SuperAdmin | Medio | S | Sicurezza |
| 6 | Rimuovere badge conteggio membri dal tab "Gestione Membri" (tenere solo badge richieste pendenti) | Basso | S | Coerenza badge |
| 7 | Verificare/sistemare il dato incoerente della sessione di "Lega Test" (type/currentPhase) se serve continuare a testare quella lega | Medio (solo per questa lega di test) | S | Igiene dati locali |

---

## Nota su ambiente condiviso multi-agente

Durante l'audit ho osservato in altri tab (non miei) che altri agenti stavano operando in parallelo sullo stesso DB locale (es. una lega "Audit Cluster1 20260821" creata da un altro cluster, sessioni d'asta aperte su "Lega finale"). Questo è coerente con l'assetto dichiarato del task (6 cluster paralleli) e non indica un problema applicativo — l'ho citato solo per spiegare la cautela su logout/login e per il caso in cui il dato incoerente di "Lega Test" (finding #1) fosse in realtà stato prodotto da un altro agente durante l'audit stesso piuttosto che preesistente.
