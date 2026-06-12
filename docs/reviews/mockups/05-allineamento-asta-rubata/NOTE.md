# Allineamento Asta Primo Mercato ↔ Fase Rubata — Note di design

> Mockup comparativo (`allineamento.html`): i due scenari impilati, costruiti con UN solo
> CSS — **61 classi condivise** tra i frame, sezioni etichettate CONDIVISO / PECULIARITÀ ASTA /
> PECULIARITÀ RUBATA. La prova dell'allineamento è strutturale: stessi componenti, stesso stile.
> Origine: richiesta utente 2026-06-12 ("grafica simile mantenendo le peculiarità").

## I 7 punti applicati

| # | Allineamento | Asta | Rubata |
|---|---|---|---|
| P1 | Timer: stessa veste (Oswald oro tabulare + anello, rosso <10s) | accanto al prezzo (timer d'asta, 40px) | nella barra di stato (timer di fase, 44px) |
| P2 | Arena: bordo oro + doppio anello, tag fase micro-label oro, badge ruolo 46px, chip proprietario | + card giocatore con statistiche e quotazione | + costo scomposto, affordability, watchlist |
| P3 | Controlli rilancio identici: quick bid blu/+20 passion/MAX oro, stepper, **RILANCIA verde** | warning 75% budget | warning limite strategia |
| P4 | "Ultimi rilanci" a chip orizzontali (primo evidenziato) | = | = |
| P5 | Riga manager unificata (monogramma, riga TU oro, numero grande+dettaglio, fuori gioco sbiaditi) | lista Manager (max/budget) | BudgetPanel (bilancio/budget) |
| P6 | Ready check a chip avatar (check verde / punto ambra) | già in uso | sostituisce il banner |
| P7 | Admin sempre visibile, barra compatta senza chevron | preset timer + concludi + annulla | pausa/avanza/indietro/chiudi + completa fase (outline danger) |

Peculiarità preservate per costruzione: l'asta tiene la lista nomination/rotaia ruoli/la mia rosa;
la rubata tiene il tabellone, il costo clausola+ingaggio e l'intel watchlist/strategia.

Render: `node scripts/render-mockups.mjs docs/reviews/mockups/05-allineamento-asta-rubata`.
Artefatto di presentazione, NON codice di produzione.
