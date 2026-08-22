# Audit strutturato 100% piattaforma — sintesi (2026-08-21)

> Indice dei 6 report cluster + pattern trasversali. Dettagli/citazioni file:riga nei singoli report.
> `docs/reviews/audit-cluster-1-accesso-account-2026-08-21.md`
> `docs/reviews/audit-cluster-2-hub-rose-2026-08-21.md`
> `docs/reviews/audit-cluster-3-consultazione-2026-08-21.md`
> `docs/reviews/audit-cluster-4-aste-live-2026-08-21.md`
> `docs/reviews/audit-cluster-5-storico-extra-2026-08-21.md`
> `docs/reviews/audit-cluster-6-admin-2026-08-21.md`

Metodo: 6 agenti in parallelo, ciascuno con azioni reali (non solo lettura) su ambiente dev locale, verifica funzionale + confronto con i 10 Assiomi UI/UX di CLAUDE.md + ricerca di ridondanza.

---

## Pattern trasversali di ripetizione (il tema centrale della richiesta)

1. **La mappa fase→etichetta esiste in 3 implementazioni indipendenti**: `src/lib/phaseSteps.ts` (canonica, usata da `PhaseBar`), `MarketPhaseManager.tsx` (AdminPanel), `AdminBanner.tsx` (Hub). Non è solo duplicazione: un dato anomalo di test lo dimostra — mostra 3 fasi diverse contemporaneamente su Admin/Hub/PhaseBar per la stessa lega. **Assioma 4.**
2. **Budget/Monte Ingaggi/Residuo ripetuti identici nella stessa pagina**: Contratti (testata + card sidebar "Residuo dopo consolidamento"), Finanze (`MyTeamHero` + sezione "La lega in numeri" 11 righe sotto).
3. **QuickAccessTiles nell'Hub ripropone 8 tile su 10 già presenti nel menu in alto**, stessa schermata — probabilmente il caso più diretto della sensazione "troppo ripetuto".
4. **Un'intera pagina duplicata**: `Movements.tsx` ("Storico Movimenti") rifà da zero gli stessi dati di `History.tsx` ("Storico"), con grafica diversa, e non è nemmeno raggiungibile dal menu desktop.
5. **Carriera-lega di un giocatore mostrata due volte**: `PlayerCareerPanel` dedicato in Storico + tab omonimo dentro `PlayerStatsModal` (già raggiungibile da ogni nome cliccabile).
6. **Logica di rinnovo contratto reimplementata**: `ContractModifier.tsx` (usato da Trades/Rubata/Svincolati/AuctionRoom) duplica `DURATION_MULTIPLIERS`/validazioni già in `renewal-logic.ts`, con stepper disegnato a mano invece del componente condiviso `Stepper.tsx` — rischio di divergenza silenziosa.
7. **Profilo utente ripete avatar/nome/email in 3 blocchi separati** prima di qualunque azione utile.
8. **Controlli admin duplicati nella stessa schermata** (Concludi asta / Forza Conferme presenti 2-3 volte tra cockpit, pannello legacy e modale) — l'agente stesso ha cliccato per errore "Simula ricorso" al posto di "Conferma" per questa ambiguità.

## Bug funzionali reali trovati

| # | Bug | Dove | Gravità |
|---|-----|------|---------|
| 1 | Pagina Regole mostra moltiplicatore clausola **×4** per 1 semestre; codice e Bibbia dicono **×3** | `Rules.tsx:520` | Alta — induce calcoli sbagliati sul rischio rubata |
| 2 | Ordine turni Svincolati **non precompilato** come inverso della Rubata (regola esplicita `SVINCOLATI.md §2.1`), pur avendo già il dato (`rubataOrder`) | Fase Svincolati | Alta — violazione diretta della Bibbia |
| 3 | ~100 chiamate `GET can-prophecy` in parallelo al caricamento di Movimenti, causa probabile di un glitch di scroll riprodotto 3x | `Movements.tsx` | Media — performance |
| 4 | **Assioma 5 (storico per stagione sportiva) non implementato** in `History.tsx`/`history.service.ts`, nonostante segnato "già conforme" in una verifica precedente | Storico | Media — memoria disallineata dalla realtà |
| 5 | `PlayerStatsModal` non mostra ingaggio/durata/clausola/rubata in modo prominente (solo scavando nel tab Carriera) | Ogni pagina che apre la modale | Media — viola Assiomi 6/9 |
| 6 | Overflow-x su **desktop** a 1300-1440px (larghezze laptop comuni), non solo mobile: badge budget, bottone "Concludi asta", pannello admin tagliati | Aste live | Media — Assioma 2 più ampio del previsto |
| 7 | Sessione `PRIMO_MERCATO` con `currentPhase: CONTRATTI` (dato anomalo) manda in contraddizione l'AdminPanel (bottone avanzamento morto) | Lega Test (dato di seed) | Bassa (dato di test) ma il prodotto dovrebbe fallire in modo esplicito, non con un bottone morto |
| 8 | Ready-check pesante nel Primo Mercato (tutti gli 8 manager devono confermare a ogni nomina) — la Bibbia richiede solo conferma anti-misclick del nominatore; il prodotto stesso espone "Forza Tutti Pronti" per bypassarlo | AuctionRoom | Media — UX, non bug di dati |
| 9 | Click rapido su due giocatori diversi in sequenza può disallineare nome/quotazione nello step di conferma nomina | AuctionRoom | Bassa — race condition UI |
| 10 | Registrazione riuscita senza schermo di conferma (redirect muto), a differenza di CreateLeague che ce l'ha | Register | Bassa |
| 11 | Preferenze notifiche silenziose (nessun toast su successo/errore), viola policy CLAUDE.md | Profile | Bassa |
| 12 | Messaggio "rosa vuota, partecipa a un'asta" fuorviante fuori dalla fase Primo Mercato | Rose | Bassa |
| 13 | Controlli di test (Simula Ricorso, Completa manager, Forza Tutti Pronti) raggiungibili da qualunque admin **senza gate d'ambiente** | Admin/Aste | Da chiudere prima del lancio pubblico (non bloccante per beta cerchia ristretta) |

## Dati di test generati durante l'audit (da valutare se ripulire)

- Lega **"Audit Cluster1 20260821"** + utente **`audit-test-01@test.it`** (cluster 1)
- **"Lega finale"** portata da DRAFT fino a fase Svincolati aperta, con un'asta Primo Mercato e una Rubata completate realmente (cluster 4)
- Offerta di scambio reale su "Fantacontratti Test" (5M a Michele) e una precedente (Provedel) dalla sessione principale
- Profezia su Okereke + segnalazione feedback "Audit Cluster5 - test" (cluster 5)

## Verifiche non completate dal vivo (gap dichiarati)

- Fase **Premi**: nessuna lega di test era in quella fase, verificata solo da codice (cluster 3).
- Viewport **mobile** per Aste live: tool di resize non ha funzionato nell'ambiente condiviso tra agenti (cluster 4); anche mobile di Contratti verificato solo da codice per lo stesso motivo (cluster 3).
- Login browser **SuperAdmin**: evitato di proposito per non rischiare di dirottare le sessioni cookie condivise degli altri agenti in parallelo — verificato via API diretta (cluster 6).
