# Mockup Fase Rubata — Note di design

> Sezione: **Rubata** (`src/pages/Rubata.tsx` + componenti rubata) con vista sul problema
> di coerenza con `StrategieRubata.tsx`. 3 varianti in palette Stadium Nights.
> Desktop = stato OFFERING ("voglio rubare?"), Mobile = stato AUCTION (rilancio).
> Diagnosi completa: agente ux-auditor 2026-06-11. Regole: `docs/bibbie/RUBATA.md`.

## Diagnosi (sintesi)

1. **Tripla ridondanza di stato**: RubataStateBar + RubataStepper a fondo colonna + timer
   ripetuto dentro HeroPlayerCard — tre indicatori per la stessa informazione.
2. **Coda di banner**: fino a 3 banner (strategie indigo, watchlist, onboarding) tra la
   card decisione e il resto, che diluiscono il CTA.
3. **Tabellone illeggibile senza legenda**: righe con 6+ segmenti separati da pipe
   testuali, micro-font 8-11px, gergo compresso ("Ing 4M · 3s · Cl 36M").
4. **Tema non rispettato**: ~140 classi colore raw (indigo/purple/cyan/violet/orange),
   backdrop-blur sulle barre mobile, emoji come sistema iconografico ("🎯 VOGLIO RUBARE").
5. **Watchlist incoerente** tra le due pagine: 5 categorie in StrategieRubata, booleano
   con emoji occhio in Rubata; tre etichette per lo stesso concetto ("sul piatto"/"Rimanenti"/"SUL PIATTO").
6. I pannelli admin ufficiali stanno (giustamente, scelta utente) in alto, ma espansi
   schiacciano la card decisione; "Completa Rubata" rosso pieno accanto ai CTA di gioco.

Domande dei 5 secondi: OFFERING → *"chi è sul piatto, quanto mi costa, lo voglio?"*;
AUCTION → *"chi sta vincendo, quanto, rilancio entro il mio limite?"*.

Scenario dati: Lautaro (A, Inter) sul piatto dalla rosa di Marco — clausola 36M +
ingaggio 12M×2 = **48M**; io Diego (budget 611M, bilancio dopo 563M), board 23/64,
turno di Mirko; mobile: asta a 52M di Mirko.

---

## v1 — Riordino conservativo (`v1-conservativo.html`)

Struttura attuale invariata (zona azione 40% + tabellone 60%), solo gerarchia/leggibilità.

- **Barra di stato unica**: stato leggibile + timer Oswald 44px + progresso 23/64 +
  micro-stepper a dot. Card e tabellone non ripetono il timer.
- **Admin collassato a una riga** "Conduzione · Timer · Completa fase" (posizione
  invariata); "Completa Rubata" outline danger, mai rosso pieno.
- **Costo dominante** nella card OFFERING: 48M a 42px + scomposizione mono
  "36M clausola + 12M ingaggio/anno"; CTA verde senza emoji; bilancio-dopo demoted.
- **Un solo banner contestuale** (watchlist + "Vedi strategie").
- **Tabellone a 2 livelli** senza pipe né abbreviazioni: "Costo rubata 48M" ambra per
  riga; sul piatto = bordo oro; miei = bordo blu; processati attenuati con esito.
- Mobile AUCTION: 52M Oswald, "di Mirko · 3° rilancio", barra fissa [-][54][+][RILANCIA].

## v2 — Evoluzione (`v2-evoluzione.html`)

v1 + intel azionabile e ponte con le Strategie.

- **"Te lo puoi permettere — bilancio dopo 563M"** in verde prima del click (ambra se
  oltre soglia); **chip watchlist con la stessa tassonomia delle Strategie**
  (★ Top / ↑ Alta / = Media) anche nei badge del tabellone — modello unificato.
- **"Chi altro può rubarlo"**: monogrammi dei rivali con bilancio ≥ costo, gli altri
  sbiaditi ("Emmanuele 41M — fuori") — l'intel competitiva PRIMA dell'asta.
- Costo 48M a 54px scomposto visivamente; mobile con "il tuo limite di strategia: 55M"
  nel dock di rilancio.

## v3 — Audace strutturale (`v3-audace.html`)

"Il tavolo della rapina" — broadcast heist, leggibile a 2 metri, palette di produzione.

- Topbar di regia: timer 60px centrale, "banco: Mirko", 23/64; admin = 3 icone inline.
- Refurtiva sotto spotlight oro: nome 44px, "dalla cassaforte di MARCO", cartellino
  prezzo fisico 48M a 72px con scomposizione tratteggiata.
- CTA con ombra meccanica da pulsante d'emergenza; monogrammi "chi può permetterselo".
- Tabellone di borsa: riga corrente invertita, prossime 3 con filo ambra, ticker
  "bottino di giornata" in fondo ("Leao: Michele → Mirko per 67M").

---

## Come le 3 risolvono la diagnosi

| Problema | v1 | v2 | v3 |
|---|---|---|---|
| stato ×3 + banner | 1 barra + 1 banner | 1 barra + 1 banner | topbar di regia unica |
| tabellone con legenda | 2 livelli leggibili | 2 livelli + badge watchlist | borsa semantica via bordi |
| admin ingombrante | riga collassata | riga collassata | 3 icone in topbar |
| emoji/colori raw | token + SVG | token + SVG | token + SVG |
| watchlist incoerente | — | **tassonomia unificata ★/↑/=** | — |
| costo poco chiaro | 48M scomposto 42px | 48M scomposto 54px + affordability | cartellino 72px |

Render: `node scripts/render-mockups.mjs docs/reviews/mockups/04-rubata` → PNG in `shots/`.
I mockup sono artefatti di presentazione, NON codice di produzione.
