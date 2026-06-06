# Backlog di Completamento — Walkthrough Flusso di Gioco

> Prodotto dal walkthrough bibbie ↔ codice (avviato 2026-06-05).
> Per ogni tappa del flusso: gap rilevati e decisione presa (IMPLEMENTARE / AGGIORNA BIBBIA / RINVIA POST-BETA / BUG-FIX).
> Stato avanzamento in fondo.

Legenda stato: ⬜ da fare · 🔄 in corso · ✅ fatto

---

## 🚀 STATO IMPLEMENTAZIONE — Sprint A (aggiornato 2026-06-05)

**Fatti e committati** (typecheck + 1696 test verdi):
- ✅ TR-1 — rimosso dead code `src/modules/` (9 moduli + barrel + file dead di identity)
- ✅ T5-D — rimossa pagina Indennizzi + path residuo CALCOLO_INDENNIZZI
- ✅ TR-2 (T6-1 / T7-1) — riserva-1-credito uniformata alle Bibbie (Rubata + Svincolati)
- ✅ T5-F — rinnovo post-trade condizionale al timing; ✅ T5-G — fallback moltiplicatore + costante indennizzo
- ✅ T1-B1 — msg "3 semestri"; ✅ T1-B2 — bug pause/resume (ricevevano leagueId, cercavano per id); ✅ T2-4 — logging sui catch muti
- ✅ T2-1 / T5-C / T8-3 — Bibbie aggiornate (esteri timing, bilancio al consolidamento, modello statistiche JSON)

**Resto di Sprint A completato:**
- ✅ T6-2 — dedup chiusura Rubata (estratta `applyRubataAuctionClose`)
- ✅ T7-5 — rimosse funzioni legacy Svincolati (service + route + client)
- ✅ T5-B — **già presente e corretto**: reset `preConsolidation*` in `auction.service.ts:581-596` (`setMarketPhase`, uscita da CONTRATTI). Era un falso gap del walkthrough.
- ✅ T4-3 — **già risolto**: indennizzo custom per-giocatore letto al RELEASE in `contract.service.ts:1323-1340` + uso a `:1350` (`playerIndemnityMap[name] ?? default`). Falso gap del walkthrough.

### ✅ SPRINT A COMPLETO

Prossimo → **Sprint B** (feature decise) e **Sprint C** (formula indennizzo + nice-to-have).

**Hardening opzionale** (post-Sprint A, non bloccante): test per reset preConsolidation e per indennizzo-custom→RELEASE; `$transaction` su reset+cambio fase; matching indennizzo per `playerId` invece che per nome; commento obsoleto `prize-phase.service.ts:819`.

---

## 🚀 STATO IMPLEMENTAZIONE — Sprint B (aggiornato 2026-06-05)

**Fatti e committati** (tutto verde):
- ✅ T8-2 — statistiche `duelsWon` + `foulsCommitted`
- ✅ T3-3 — auto-scadenza offerte di scambio attivata
- ✅ T7-2 (backend) — eventi Pusher real-time Svincolati
- ✅ T1-1 (backend) — Lega Pubblica/Privata: schema `isPublic`, migration, service, validation
- ✅ T2-3 — riepilogo eventi apertura per-manager (`GET /market/opening-summary`)
- ✅ T4-1 — correzioni admin post-finalize premi (`PATCH /prizes/correct`, con audit)
- ✅ T1-2 — annulla-fine-asta / reopen (`POST /auctions/:leagueId/:id/reopen`)

**Rimanenti Sprint B — solo UI:**
- ⬜ T1-1 (UI) — toggle Pubblica/Privata nella creazione lega + badge nella ricerca
- ⬜ T3-2 / T3-1 — controfferta UI completa + indicatore "trattativa in corso" ai terzi
- ⬜ T7-2 (wiring frontend) — collegare gli eventi Pusher Svincolati a `useSvincolatiState`

> Note operative:
> - `db:push` del campo `isPublic` va eseguito sul DB (locale e prod) prima dell'uso reale.
> - ✅ Test flaky `SuperAdmin.test.tsx > uses initialTab prop` STABILIZZATO (assertion avvolta in `waitFor`).

---

## ✅ STATO 2026-06-06 — pronto al merge in `main`

Sprint A + Sprint B (feature di gioco) **completi e verdi**. Branch `feature/1.x-gap-analysis` è 28 commit avanti `main`, 0 indietro → merge **fast-forward** senza conflitti.

**Rinviati a round dedicati post-merge (decisione utente):**
- Formula indennizzo ESTERO (T4-2 / T5-A) — in attesa che l'utente fornisca la formula; oggi default 50.
- Polish UX web (task separato): debounce/conferma aste, WCAG, componenti duplicati, responsive 375px.
- Revisione visiva fine delle UI di Sprint B (toggle lega, controfferta, indicatore, real-time svincolati).
- Nice-to-have: OAuth, ordine chiamata random, admin-solo, stato fine mercato esplicito; hardening (test extra, transazioni).

---

## T1 — Setup: Registrazione Lega + Primo Mercato

Primo Mercato implementato ~100% (formule contratto, slot ruolo, riserva budget, timer, rettifiche, anti-misclick). Gap concentrati su gestione lega.

| ID | Gap | Decisione | Stato |
|----|-----|-----------|-------|
| T1-1 | Lega Pubblica/Privata assente (nessun campo DB; privata comunque ricercabile/richiedibile — `league.service.ts:269,880`) | **IMPLEMENTARE** | ⬜ |
| T1-2 | "Annulla fine asta" / reopen che riprende dall'ultima offerta (solo rettifica totale oggi) | **IMPLEMENTARE** (tocca `auction.service.ts`, file critico) | ⬜ |
| T1-3 | Bulk-invite (lista email) alla creazione lega | RINVIA POST-BETA | — |
| T1-B1 | Messaggio "2 semestri" ma durata reale = 3 (`auction.service.ts:752`) | **BUG-FIX** | ⬜ |
| T1-B2 | Route `pause` passa `leagueId` dove il service vuole `auctionId` (`auctions.ts:982`) | **BUG-FIX** (verificare prima) | ⬜ |
| T1-N | OAuth Google/FB, ordine chiamata random, admin-solo, vincoli min6/pari alla creazione | NICE-TO-HAVE / noti | — |

---

## T2 — Apertura mercato ricorrente (decremento durata, svincoli)

Apertura ben implementata (decremento durata, ricalcolo clausole, svincolo per scadenza tracciato).

| ID | Gap | Decisione | Stato |
|----|-----|-----------|-------|
| T2-1 | ESTERO/RETROCESSO: Bibbia §2 dice "all'apertura" ma codice/§5.2 li gestiscono in Fase 3 (KEEP/RELEASE) | **AGGIORNA BIBBIA** §2 (allinea a §5.2: all'apertura solo scaduti+RITIRATI) | ⬜ |
| T2-2 | Codice morto `autoProcessExitedPlayers` (`indemnity-phase.service.ts:767-940`), mai chiamato | **BUG-FIX** rimuovere | ⬜ |
| T2-3 | Comunicazione eventi per-manager all'apertura assente (solo aggregati + push generica) | **IMPLEMENTARE** riepilogo eventi per manager | ⬜ |
| T2-4 | Silent catch su snapshot/auto-release ritirati (`auction.service.ts:426-438`) | **BUG-FIX** aggiungere logging strutturato | ⬜ |

## T3 — Fasi 1/6 — Offerte e Scambi liberi

Core scambi corretto (creazione, accetta/rifiuta, trasferimento contratto senza impatto bilancio, impatto crediti simmetrico, budget check, gating di fase).

| ID | Gap | Decisione | Stato |
|----|-----|-----------|-------|
| T3-1 | Visibilità "trattativa in corso" ai terzi assente (§3.5) | **IMPLEMENTARE** indicatore (terzi vedono che esiste, non i dettagli) | ⬜ |
| T3-2 | Controfferta: backend+API pronti, manca UI in `Trades.tsx` + giro completo contro-controofferta (§3.4) | **IMPLEMENTARE** UI completa | ⬜ |
| T3-3 | Auto-scadenza offerte server-side disabilitata (3 TODO "stale": `expiresAt`/`EXPIRED` già esistono) — = C1 | **BUG-FIX** sbloccare codice + check scadenza in `acceptTrade` | ⬜ |

## T4 — Fase 2 — Premi e Indennizzi

Premi (reintegro fisso, variabili custom, accredito, irreversibilità) implementati e fedeli.

| ID | Gap | Decisione | Stato |
|----|-----|-----------|-------|
| T4-1 | Interfaccia correzioni admin post-finalize assente (§4.5); tutto si blocca a fase finalizzata | **IMPLEMENTARE** correzioni post-finalize (→ tema trasversale "rettifica admin", vedi T5-C/D) | ⬜ |
| T4-2 | Indennizzo ESTERO: default automatico 50M, non confermato dall'admin (§4.4) | **IMPLEMENTARE** calcolo via **FORMULA** (input utente — vedi nota in fondo) | ⬜ |
| T4-3 | `setCustomIndemnity` crea categorie per-giocatore (`Indennizzo - {nome}`) che NON vengono lette al RELEASE (Fase 3 legge solo "Indennizzo Partenza Estero" per-manager) | **BUG** verificare + correggere | ⬜ |

## T5 — Fase 3 — Rinnovi e Consolidamento

Formule core **corrette e fedeli**: clausola {4:11,3:9,2:7,1:3}, costo taglio CEIL(ing×dur/2), spalma (solo durata=1), regola fondamentale "rinnovo += monte ingaggi, budget invariato", KEEP/RELEASE, limite rosa 29.

| ID | Gap | Decisione | Stato |
|----|-----|-----------|-------|
| T5-A | **Formula indennizzo ESTERO divergente tra due path**: `consolidateContracts` usa valore pieno; `submitPlayerDecisions`/`autoProcess` usano `MIN(clausola, indennizzo)` (cap NON previsto da Bibbia) | **RISOLVERE** con formula unica (lega a T4-2) | ⬜ |
| T5-B | Reset `preConsolidation*`→null a fine fase ASSENTE (CONTRATTI §12.2): i dati congelati restano valorizzati | **BUG-FIX** | ⬜ |
| T5-C | Guard `postMonteIngaggi > budget` blocca il consolidamento, ma FINANZE §10.1 consente bilancio **negativo** | **AGGIORNA BIBBIA** FINANZE §10.1 (no bilancio negativo al consolidamento); mantieni guard | ⬜ |
| T5-D | Doppio path KEEP/RELEASE. Attivo: `Contracts.tsx`→`consolidateContracts` (nel menu). Residuo: `Indemnity.tsx` + route `/indemnity` + `submitPlayerDecisions` + `indemnityApi` (tolto dal menu ma raggiungibile via URL/palette, formula divergente MIN(clausola,indennizzo)) | ✅ **RIMUOVERE path residuo** (confermato utente) | ✅ FATTO |
| T5-E | Codice morto `autoProcessExitedPlayers` (= T2-2) | **BUG-FIX** rimuovere | ⬜ |
| T5-F | Blocco rinnovo contratti acquisiti via TRADE (`contract.service.ts:608-610`) è incondizionato | **DOCUMENTARE + CORREGGERE**: rinnovabile se lo scambio avviene PRIMA della fase contratti; NON rinnovabile se avviene DOPO (Fase 6) → fino al ciclo successivo | ⬜ |
| T5-G | Minori: ricevuta consolidamento conta come "rinnovo" modifiche di sessioni precedenti; fallback moltiplicatore incoerente (`\|\|7` vs `??3`); default `50` hardcoded sparso | **CLEANUP** | ⬜ |

---

### ⚠️ INPUT MANCANTE (da fornire): formula indennizzo ESTERO
**Stato: in attesa dall'utente** (2026-06-05). NON blocca le altre tappe.
La formula sostituirà il default 50M e renderà canonico un solo algoritmo. **Blocca l'implementazione di T4-2 e T5-A** (finché non arriva, non si tocca il calcolo indennizzo). Aggiornerà FINANZE §9.1 ("formula da definire in futuro" → formula definita).

## T6 — Fase 4 — Rubata

Implementata molto bene. Formule finanziarie conformi a FINANZE §3 (prezzo=clausola+ingaggio, trasferimento solo-OFFERTA zero-sum, modifica post-acquisto increase-only, verifica su bilancio). Layer attivo = `src/services/rubata.service.ts`; `src/modules/rubata/` è dead code non montato.

| ID | Gap | Decisione | Stato |
|----|-----|-----------|-------|
| T6-1 | Riserva 1 credito sul rilancio (`amount ≤ bilancio−1`) incoerente con offerta iniziale (`≥`, no riserva); Bibbia §4.2 vuole `bilancio ≥ amount` | **BUG-FIX** uniformare a Bibbia (no riserva), salvo obiezione | ⬜ |
| T6-2 | Duplicazione logica di chiusura (auto-close `getRubataBoard:1038` vs `closeCurrentRubataAuction:1992`) | **CLEANUP** estrarre funzione condivisa | ⬜ |
| T6-3 | Dead code `src/modules/rubata/` (router non montato): stub 501 DELETE board (era "C2") + POST board errato | **BUG-FIX** rimuovere dead code — **C2 ridimensionato: non è feature mancante** | ✅ (in TR-1) |

## T7 — Fase 5 — Svincolati

Implementata bene. Formule contratto default corrette (ingaggio=max(1,round(prezzo/10)), durata 3). Layer attivo = `src/services/svincolati.service.ts`; `src/modules/svincolati/` è dead code.

| ID | Gap | Decisione | Stato |
|----|-----|-----------|-------|
| T7-1 | Verifica pre-offerta riserva 1 credito (`bilancio−1`) divergente da Bibbia §5.2 e incoerente con la nomina (`<2`, corretta). Stesso pattern di T6-1 | **BUG-FIX** uniformare (coerenza con T6-1) | ⬜ |
| T7-2 | Real-time Pusher assente nel layer attivo (eventi solo nel dead code modules); il client fa polling `/board` | **IMPLEMENTARE** Pusher real-time (coerenza con Rubata) | ⬜ |
| T7-3 | Dead code `src/modules/svincolati/` (il "C3" `activeAuction: null`) non cablato | **BUG-FIX** rimuovere — **C3 ridimensionato: non è feature mancante** | ✅ (in TR-1) |
| T7-4 | Pausa admin-only (Bibbia §3.3: anche il manager può richiederla); annullo/rettifica svincolati con restituzione crediti non confermato nel service | **VERIFICARE** + eventuale fix | ⬜ |
| T7-5 | Funzioni legacy `startFreeAgentAuction`/`closeFreeAgentAuction` coesistono col flusso a-turni (entrambe montate) | **CLEANUP** rimuovere legacy | ⬜ |

## T8 — Fase 7 — Fine + trasversali (Ricorsi, Statistiche)

**Ricorsi: ✅ pienamente implementato e aderente** (rollback completo, AWAITING_RESUME, auto-rifiuto altri, ack, force admin, 8 endpoint). Nessun gap.

| ID | Gap | Decisione | Stato |
|----|-----|-----------|-------|
| T8-1 | Fine mercato: nessuno stato lega "idle"/FINE_MERCATO esplicito; blocco operazioni implicito (check `session ACTIVE`) | RINVIA: valutare in implementazione (basso impatto, comportamento già corretto) | ⬜ |
| T8-2 | Statistiche: sync NON salva `duelsWon` e `foulsCommitted` previsti da Bibbia §4 (altri 17 campi ok) | **IMPLEMENTARE** aggiungere i 2 campi a `syncStats` | ⬜ |
| T8-3 | Statistiche salvate come JSON blob (`apiFootballStats`) vs colonne DB descritte in Bibbia §1.2/§4 | **AGGIORNA BIBBIA** (modello JSON equivalente), salvo preferenza colonne | ⬜ |

---

## Temi trasversali (emersi da più tappe)

| ID | Tema | Note | Decisione |
|----|------|------|-----------|
| TR-1 | **Dead code `src/modules/`** | Layer DDD scaffolding non cablato (rubata, svincolati, e parz. league/auction/identity/trade/prize): duplica logica e contiene i falsi "C2/C3" (501/TODO) | ✅ **FATTO** — rimossi 9 moduli + barrel + dead di identity (DDD resta target per codice NUOVO) |
| TR-2 | **Riserva 1 credito** | Incoerente in rubata (T6-1) e svincolati (T7-1) | Fix unico di coerenza → uniformare a Bibbia |
| TR-3 | **Rettifica/correzione admin** | Richiesta in più fasi (T4-1 premi, T5 contratti) | Valutare sistema unico di rettifica admin post-consolidamento |
| TR-4 | **Formula indennizzo ESTERO** | Input mancante dall'utente | Blocca T4-2 / T5-A |

---

## Avanzamento walkthrough — ✅ COMPLETO
- [x] T1 Setup
- [x] T2 Apertura
- [x] T3 Scambi liberi
- [x] T4 Premi
- [x] T5 Rinnovi/Consolidamento
- [x] T6 Rubata
- [x] T7 Svincolati
- [x] T8 Fine + trasversali

---

## Piano di implementazione (proposto)

### Sprint A — Pulizia & coerenza (basso rischio, sblocca chiarezza)
- **RIMUOVERE** dead code `src/modules/` non cablato (TR-1) → fa sparire i falsi C2/C3, T6-3, T7-3
- **RIMUOVERE** pagina "Indennizzi" + route/API/servizio residui (T5-D)
- **FIX coerenza** riserva-1-credito in Rubata + Svincolati (TR-2: T6-1, T7-1)
- **FIX** bug minori: msg "2 semestri"→3 (T1-B1), route pause (T1-B2), reset `preConsolidation` (T5-B), indennizzo custom (T4-3), minori (T5-G), legacy svincolati (T7-5)
- **AGGIORNA BIBBIE** testuali: §2 esteri (T2-1), §10.1 bilancio (T5-C), statistiche modello (T8-3), regola rinnovo post-trade (T5-F), formula §9.1 (all'arrivo)

### Sprint B — Feature decise
- Lega Pubblica/Privata (T1-1)
- Controfferta UI completa + indicatore trattativa ai terzi (T3-2, T3-1)
- Auto-scadenza offerte server-side (T3-3)
- Annulla-fine-asta / reopen (T1-2)
- Riepilogo eventi apertura per-manager (T2-3)
- Correzioni admin post-finalize (T4-1, → tema TR-3 rettifica admin unica)
- Real-time Pusher Svincolati (T7-2)
- Aggiungere 2 campi statistiche (T8-2)
- Correggere regola rinnovo post-trade condizionale (T5-F)

### Sprint C — Bloccato / da decidere
- Formula indennizzo ESTERO → implementare T4-2 + T5-A (in attesa input)
- Stato fine mercato esplicito (T8-1)
- Nice-to-have T1 (OAuth, ordine random, admin-solo)

### Separato (task dedicato)
- Polish UX web (vedi `docs/PROJECT-STATUS.md` e `docs/reviews/`)

> Nota: aggiornare `docs/PROJECT-STATUS.md` — C2/C3 NON erano feature mancanti ma dead code.
