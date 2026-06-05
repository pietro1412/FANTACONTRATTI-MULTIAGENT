# Bibbie — Indice e Guida alla Lettura

> Le "Bibbie" sono la **fonte di verità sulle regole di gioco** di FantaContratti.
> In caso di conflitto tra codice e Bibbia, la Bibbia ha ragione: il codice va allineato (o la Bibbia aggiornata con decisione esplicita).
> 10 documenti. Ultima revisione indice: 2026-06-05.

---

## Le 10 Bibbie

| # | File | Dominio | Note |
|---|------|---------|------|
| 1 | `REGISTRAZIONE-LEGA.md` | Registrazione utente, creazione lega, inviti, avvio | Punto di ingresso |
| 2 | `PRIMO-MERCATO.md` | Asta primo mercato assoluto (slot, contratto default, rettifiche) | Una tantum per lega |
| 3 | `CONTRATTI.md` | Contratti, clausole rescissorie, rinnovi, spalma, taglio, KEEP/RELEASE | **Core** |
| 4 | `FINANZE.md` | Budget, Monte Ingaggi, Bilancio; operazioni economiche | **Core trasversale** |
| 5 | `MERCATO-RICORRENTE.md` | Overview ciclo a 7 fasi del mercato ricorrente | **Mappa del flusso** |
| 6 | `RUBATA.md` | Fase 4 — Asta Rubata (macchina a stati, formule, real-time) | Bibbia dedicata |
| 7 | `SVINCOLATI.md` | Fase 5 — Asta Svincolati (ordine inverso, contratto default) | Bibbia dedicata |
| 8 | `GIOCATORI.md` | Stati giocatore (IN_LISTA, SVINCOLATO, ESTERO, RETROCESSO, RITIRATO) | Dati di dominio |
| 9 | `STATISTICHE-GIOCATORI.md` | Matching nome, sync statistiche (flusso SuperAdmin) | Dati di dominio |
| 10 | `RICORSI.md` | Sistema ricorsi (appeal) durante le aste | Trasversale alle aste |

---

## Ordine di lettura consigliato (per capire il flusso end-to-end)

1. **`REGISTRAZIONE-LEGA.md`** — come nasce una lega e i suoi manager
2. **`PRIMO-MERCATO.md`** — la prima asta che popola le rose
3. **`CONTRATTI.md`** + **`FINANZE.md`** — il modello contrattuale ed economico (Budget / Monte Ingaggi / Bilancio). Vanno letti in coppia.
4. **`MERCATO-RICORRENTE.md`** — il ciclo che si ripete, con le sue 7 fasi:
   - APERTURA → decremento durata, svincoli automatici
   - FASE 1 → Offerte e Scambi Liberi (pre-rinnovi)
   - FASE 2 → Assegnazione Premi e Indennizzi → dettagli in `FINANZE.md`
   - FASE 3 → Rinnovo Contratti e Consolidamento → dettagli in `CONTRATTI.md` (incl. KEEP/RELEASE da `GIOCATORI.md`)
   - FASE 4 → Asta Rubata → **`RUBATA.md`**
   - FASE 5 → Asta Svincolati → **`SVINCOLATI.md`**
   - FASE 6 → Offerte e Scambi Liberi (post-svincolati, = Fase 1)
   - FASE 7 → Fine Mercato
5. **`GIOCATORI.md`** + **`STATISTICHE-GIOCATORI.md`** — gestione anagrafica e statistiche
6. **`RICORSI.md`** — meccanismo di appeal, attivo durante le aste

---

## Mappa dipendenze (chi rimanda a chi)

- `MERCATO-RICORRENTE.md` è la mappa: rimanda a `CONTRATTI`, `FINANZE`, `RUBATA`, `SVINCOLATI` per i dettagli di fase.
- `FINANZE.md` §3 e `RUBATA.md` §3 descrivono lo stesso modello di scomposizione (offerta + ingaggio): la fonte dettagliata è `RUBATA.md`, `FINANZE.md` ne è il riassunto. ⚠️ Mantenere sincronizzati o ridurre a rimando.
- KEEP/RELEASE per ESTERO/RETROCESSO: regola in `GIOCATORI.md` §5, applicata in Fase 3 (`CONTRATTI.md` §6.4), implementata in `src/services/indemnity-phase.service.ts`.

---

## Bibbie previste ma non ancora create

- `ADMIN-CORREZIONI.md` — citata in `FINANZE.md` come "futura" (interfaccia correzioni admin post-consolidamento). Da creare se/quando la funzionalità viene formalizzata.
