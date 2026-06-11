# Mockup Asta / Primo Mercato — Round 2 (post direzione-guida)

> Rifacimento dei mockup del pilota (`../`) alla luce della **direzione-guida decisa il 2026-06-11**:
> linguaggio v2 (una zona di decisione dominante, contorno demoto, intel azionabile) reso in
> **Stadium Nights** (token di produzione), con innesti v3 sulla gerarchia (numeroni leggibili a
> distanza, ordinamento per minaccia, fuori-gioco sbiaditi).
> Differenza chiave dal pilota: **tutte e tre le varianti usano già la palette di produzione** —
> l'esplorazione è su struttura/gerarchia/densità, non su palette/font (lezione Hub Leghe, commit `139ce7f`).
> Riferimento codice: `src/components/auction-room-v2/*` (AuctionRoomLayout, StatusBar,
> FinancialDashboard, CenterStage, MyPortfolio, MobileBottomBar). Regole: `docs/bibbie/PRIMO-MERCATO.md`.

## Diagnosi (verificata sul codice attuale, invariata dal pilota)

Le 4 cose che servono per decidere in 8 secondi — giocatore, offerta corrente + detentore, timer,
mio margine (budget/max/slot) — competono con:

1. **3 colonne di pari peso** (Spy Financials | CenterStage | Board Strategica) — `AuctionRoomLayout` 3/6/3.
2. **Gergo finanziario**: Market Pulse, P.A.R., C.M.S., inflazione reparto, Analisi Obiettivi, savings % — metriche da post-partita.
3. **Lista rivali piatta**: tutti gli 8 manager uguali, anche chi ha slot pieni e non può rilanciare.
4. **Naming decorativo**: "ASTA LIVE PROFESSIONAL", "Spy Financials", "Board Strategica".

Scenario dati condiviso fra le varianti: lega a 8, io = Diego (budget 187, max 121, C 2/6),
all'asta Barella (Inter, quot. 36), offerta corrente 42 di Michele, timer 8s, fase C
(P/D completati, A futura). Mirko è la minaccia massima (max 144), Emmanuele non può superare
(max 41), Marcolino è fuori (slot C pieni).

---

## v1 — Riordino conservativo (`v1-conservativo.html`)

Stessa struttura a 3 zone dell'attuale, gerarchia corretta per dimensione: implementabile col minor delta.

- Status bar dimezzata (niente "PROFESSIONAL"): crest + connessione + chiamata; a destra solo Budget e Offerta Max (Max evidenziata oro).
- Riga ruoli: pill P✓ D✓ → C in corso → A spento + progress slot lega 89/200.
- Center stage dominante: prezzo Oswald 62px + timer ring + RILANCIA + quick-bid; laterali strette (252px).
- Manager ordinati per rilevanza: detentore pinnato, io in oro, poi per max decrescente; slot-pieni in fondo al 38% di opacità. Solo max + budget per riga.
- Rosa demota a inventario righe compatte; slot C "in asta ora" marcato per legare rosa↔asta.
- Mobile: tab Asta/Manager/Rosa + barra rilancio fissa in basso.

## v2 — Evoluzione (`v2-evoluzione.html`) — baricentro atteso

Linguaggio v2 pieno (pattern validati su Hub Leghe) in token Stadium Nights puri.

- Command bar: crest + LIVE + stat-card Budget (oro) / Offerta Max (blu, più evidente del budget).
- Role rail come spina del processo: P/D fatti ✓, C attivo con glow oro e "tocca a Michele", A sbiadito, 89/200.
- Arena di decisione 2/3: giocatore + blocco rilancio (anello timer SVG, prezzo 70px, quick-bid, RILANCIA A 43M).
- **"Chi può superarti"**: rivali ordinati per minaccia reale (slot C liberi E max > corrente); divisore "Fuori gioco" per Emmanuele (41<42) e Marcolino (barrato). Sostituisce Spy Financials + analytics.
- Striscia trasparenza-regola: "8M trattenuti per 4 slot vuoti → max 121M" (Bibbia §8 resa visibile).
- Mobile: dock fisso (anello + 42M + stepper + RILANCIA), strip rossa "Possono superarti: Mirko 144 · Marco 120 · …".

## v3 — Audace strutturale (`v3-audace.html`)

Massima spinta broadcast (leggibile a 2 metri) ma dentro il dark di produzione: audacia strutturale/tipografica, non cromatica.

- Layout 60/40: zona-decisione | board unica.
- Pricebar elevated come fulcro: timer conico rosso + prezzo 78px + RILANCIA 43M in un'unica riga visiva.
- Ribbon ruoli stepper con C allargato e "ATTIVO".
- Board unica "Chi può rilanciare" con barre di minaccia proporzionali (max/144); riga "TU · Diego" invertita (fondo chiaro, bordo oro) sempre individuabile; fuori-gara degradati ("NON BASTA", "SLOT PIENI" barrato).
- Rosa come barre-pixel per ruolo + riserva esplicitata ("−8M per 4 slot min.").
- Mobile: dock nero ancorato con timer/prezzo/RILANCIA giganti.

---

## Come le 3 risolvono la diagnosi (sintesi)

| Problema | v1 | v2 | v3 |
|---|---|---|---|
| 3 colonne pari peso | center stage dominante, laterali 252px | arena 2/3 + 1 pannello | 60/40 decisione/board |
| gergo PAR/CMS/Pulse | rimosso | rimosso → "chi può superarti" | rimosso → barre di minaccia |
| rivali piatti | ordinati per max, fuori sbiaditi | classifica minaccia + "fuori gioco" | classifica + barre proporzionali + TU invertito |
| focale debole | prezzo 62px + ring | prezzo 70px + anello SVG | pricebar con prezzo 78px |
| naming decorativo | etichette funzionali | etichette funzionali | etichette funzionali |

Render: `node scripts/render-mockups.mjs docs/reviews/mockups/01-asta/r2` → PNG in `shots/`.
I mockup sono artefatti di presentazione, NON codice di produzione.
