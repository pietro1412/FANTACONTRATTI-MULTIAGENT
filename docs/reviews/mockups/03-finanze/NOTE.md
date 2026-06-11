# Mockup Finanze & Storia — Note di design

> Sezione: **Finanze** (`LeagueFinancials` + componenti `finance/`), con vista sul problema
> trasversale di **Movements** e **History**. 3 varianti statiche, tutte in palette
> Stadium Nights (token di produzione). Direzione-guida: v2 baricentro, innesti v3 di gerarchia.
> Diagnosi completa: agente ux-auditor 2026-06-11. Riferimento codice:
> `src/pages/{LeagueFinancials,Movements,History}.tsx`, `src/components/finance/*`, `src/components/history/*`.

## Diagnosi (sintesi)

1. **Prospettiva sbagliata**: la Panoramica mostra 8 KPI aggregati di lega ("Budget Totale" = somma di tutti) e non risponde mai a *"io quanto posso spendere?"*; la squadra dell'utente non è mai evidenziata, nemmeno nel ranking.
2. **Tripla sovrapposizione storico/movimenti**: gli stessi eventi vivono in `Movements.tsx`, in Finanze→tab Movimenti (`FinanceTimeline`) e in History→Timeline (`TimelineView`), con 3 UI e 3 stili diversi. Prima causa della sensazione di densità.
3. **Gergo da BI**: Indice Gini, Liquidità Media, Esposizione al Rischio, waterfall a 3 baseline, sigle PM/MR, badge tipo-movimento a 2 lettere con legenda a fondo pagina, 10 tooltip "i" come stampella.
4. **Chart zoo**: 5 grafici di pari peso nella vista Squadre (radar troncato a 5 squadre senza avviso).
5. **Tema non tokenizzato**: hex hardcoded nei recharts, colori posizione ridefiniti in 3 file, emoji come icone, micro-font 10px ovunque.
6. Costi nascosti: N+1 `canMakeProphecy` su ogni movimento, stagione hardcoded 2025, 6 endpoint lazy per SessionCard.

Domanda a cui la pagina deve rispondere in 5 secondi: **"Quanto posso spendere io adesso, e come sto rispetto agli altri?"**

Dati condivisi fra varianti: io = Diego (budget 187, ingaggi 124/anno, riserva 8, bilancio 55, slot 18/25, 4 scadenze a giugno), lega a 8, movimenti d'esempio con profezie (Lautaro 85M Marco→Mirko).

---

## v1 — Riordino conservativo (`v1-conservativo.html`)

Mantiene tab e struttura attuali; corregge gerarchia e gergo.

- Hero "La mia squadra": 55M Oswald 50px + formula esplicita `187 − 124 − 8 = 55` (il calcolo sostituisce il tooltip); riserva e scadenze dentro il hero.
- KPI lega demoted a 4 card piccole con micro-confronto "il tuo: 187M"; Gini/Liquidità eliminati.
- Classifica bilanci con riga mia in oro + badge TU.
- Vista Squadre ridotta a 2 grafici (stacked a 3 segmenti + line trend con la mia linea evidenziata).
- Sessioni umanizzate ("Primo Mercato 2025/26"); titoli sezione 17px con sottotitolo, basta micro-titoli uniformi.

## v2 — Evoluzione (`v2-evoluzione.html`) — baricentro atteso

Riorganizza la sezione in 3 zone e **unifica il registro movimenti**.

- **Zona 1 "La mia cassa"** dominante: 55M a 62px + formula a token + barra di composizione del budget; scadenze come stat-card AZIONE ("4 contratti → entro 30 giugno") + chip vincoli.
- **Zona 2 "La lega"**: una sola domanda ("chi può spendere?") — classifica a barre, riga mia oro, sparkline, 3 chip di sintesi.
- **Zona 3 "Registro" UNIFICATO** (sostituisce le 3 viste): feed per giorno+fase, badge a parola intera autoesplicativi (niente legenda), prezzi mono a destra, **profezie inline di prima classe** (🔮 autore qualificato, duello profezia/controprofezia), filo oro sui movimenti che mi coinvolgono, filtri pill con conteggi.
- Mobile: cassa hero, filtri sticky, feed a card.

## v3 — Audace strutturale (`v3-audace.html`)

"Sala operativa finanziaria", una sola pagina senza tab, leggibile a 2 metri.

- Cruscotto a tutta larghezza: 55M a 78px + formula + 3 numeroni (ingaggi, slot a tacche, scadenze pulsanti).
- Radar lega 60%: indicatori di tendenza ▲▼ stile borsa, barre proporzionali, riga "TU" invertita (fondo chiaro, bordo oro).
- Ticker mercato 40% stile TG finanziario: "340M mossi", eventi per giorno, profezie come citazioni bordo-oro.
- Scadenze come card-allarme con countdown e CTA "Pianifica rinnovo".
- "Storico sessioni →" come link discreto; audacia tutta tipografica (Oswald 78/46/30), zero colori nuovi.

---

## Come le 3 risolvono la diagnosi

| Problema | v1 | v2 | v3 |
|---|---|---|---|
| mai "io quanto ho?" | hero mia squadra | "La mia cassa" + azione scadenze | cruscotto broadcast 78px |
| 3 viste movimenti | (non affronta) | **registro unificato** | ticker unico |
| gergo BI | rimosso | rimosso | sostituito da tendenze ▲▼ |
| chart zoo | 5→2 grafici | classifica+sparkline | barre+tendenze, zero chart |
| profezie sepolte | — | inline prima classe | citazioni bordo-oro |
| mia squadra invisibile | riga oro | riga oro + filo oro sui miei | riga TU invertita |

Render: `node scripts/render-mockups.mjs docs/reviews/mockups/03-finanze` → PNG in `shots/`.
I mockup sono artefatti di presentazione, NON codice di produzione.
