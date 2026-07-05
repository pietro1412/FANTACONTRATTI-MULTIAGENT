# UX Audit — Pagina Rubata

> Audit specializzato del 2026-02-19. Analisi usabilita' web e mobile della pagina Rubata.
> Contesto: interfaccia gia' ristrutturata (board-first layout), utenza 50/50 desktop/mobile, leghe 8-20 manager.
> Obiettivo: identificare migliorie incrementali su un'interfaccia gia' di buon livello.

---

## Scorecard Rubata

| Dimensione | Score | Note |
|------------|-------|------|
| **Layout & Gerarchia visiva** | 4.2/5 | Board-first eccellente, ActionBar compatta, buon uso spazio |
| **Interazione Mobile** | 3.8/5 | Bottom bar asta ottima, ma BidPanel sovrasta board; budget footer sempre visibile |
| **Sistema Strategie** | 2.5/5 | Presente ma sotto-valorizzato — deve diventare il tratto distintivo |
| **Feedback sensoriale** | 3.0/5 | Timer visivo buono, mancano haptic/suoni/confetti presenti in AuctionRoom |
| **Scalabilita' (20 manager)** | 2.8/5 | ~500 righe senza virtualizzazione; nessun filtro/raggruppamento |
| **Accessibilita'** | 3.0/5 | Touch target OK, ma no aria-live per timer/bid, no keyboard nav sul board |
| **Consistenza con piattaforma** | 4.0/5 | Pattern allineati con Svincolati e AuctionRoom, PositionBadge centralizzato |

**Score complessivo Rubata: 3.3/5** (era 3.0/5 nel precedente audit — migliorato con board-first)

---

## Punti di Forza (da preservare)

| Elemento | Qualita' | Dettaglio |
|----------|----------|----------|
| **Board-first layout** | Eccellente | ~92px overhead vs 386px precedenti, board immediatamente visibile |
| **ActionBar compatta** | Eccellente | Stepper dots + badge stato + timer + LIVE + progresso in ~48px |
| **Mobile auction bottom bar** | Eccellente | Timer compatto + prezzo + quick bid, fixed bottom, safe area |
| **ReadyBanner** | Molto buono | Collassato ~44px, espandibile, azioni inline |
| **Modali stato critico** | Molto buono | PENDING_ACK, APPEAL, AUCTION_READY_CHECK — non-closeable, centrate |
| **Scroll-to-current FAB** | Molto buono | Appare solo quando current player fuori viewport |
| **Admin BottomSheet mobile** | Buono | Tutti i controlli admin accessibili via FAB |
| **@dnd-kit ordine rubata** | Buono | Touch-friendly + bottoni freccia accessibili |
| **Activity Feed** | Buono | Due viste (feed/riepilogo), collassabile, non invasivo |
| **Riga corrente enhanced** | Buono | Padding maggiore, foto piu' grande, pulsing border, VOGLIO RUBARE inline |

---

## Raccomandazioni — Ordinate per Impatto

### R1 — Elevare il Sistema Strategie (Priorita' ALTA)

Il sistema strategie (PreferenceModal + indicatori inline) e' funzionale ma sotto-valorizzato.
L'utente vuole che diventi "uno dei tratti fondamentali e distintivi della piattaforma".

| Issue | Dettaglio | Suggerimento |
|-------|----------|--------------|
| **R1.1** Watchlist e AutoPass non esposti in UI | Il data model ha `isWatchlist` e `isAutoPass` ma PreferenceModal non li mostra | Aggiungere toggle switch per watchlist (occhio) e auto-pass (skip). Colorare la riga board: bordo indigo per watchlist, opacita' ridotta per auto-pass |
| **R1.2** "Nessuna strategia" e' negativo | Testo scoraggiante, non invita all'azione | Sostituire con CTA: "Imposta strategia" come link cliccabile. Usare icona `+` anziche' testo vuoto |
| **R1.3** Bottone strategia poco visibile | Piccolo, a fine riga, facile da ignorare | In stato WAITING/PREVIEW (quando c'e' tempo): mostrare un banner "Prepara le tue strategie!" con progress bar (X/Y giocatori configurati) |
| **R1.4** Nessuna overview strategie | Si puo' vedere solo una strategia alla volta, aprendo il modal per ogni giocatore | Creare una vista "Riepilogo Strategie" nella sidebar desktop / sezione collassabile mobile — tabella con colonne: giocatore, priorita', maxBid, note, azioni |
| **R1.5** maxBid non collegato al live | Se il prezzo asta si avvicina al maxBid, l'utente non ha feedback | Durante AUCTION: mostrare indicatore "vicino al tuo limite" quando currentPrice >= maxBid * 0.8, e "OLTRE IL LIMITE" se supera maxBid |
| **R1.6** Nessun contatore strategie | L'utente non sa quanti giocatori ha strategizzato | Aggiungere badge nel header: "Strategie: 12/146" o mini-bar di completamento |

### R2 — Feedback Sensoriale alla Pari con AuctionRoom (Priorita' ALTA)

AuctionRoom ha 13 pattern haptic, confetti, shake, suoni. Rubata ne ha zero.

| Issue | Dettaglio | Suggerimento |
|-------|----------|--------------|
| **R2.1** Nessun haptic feedback | `haptics.ts` non e' mai importato in Rubata | Aggiungere: `haptics.bid()` su RILANCIA, `haptics.outbid()` quando superati, `haptics.win()` su rubata completata (PENDING_ACK winner) |
| **R2.2** Nessun confetti per rubata vinta | AuctionRoom usa 4 varianti confetti | Sparare `confetti.win()` nel PendingAckModal quando `pendingAck.winner === true` |
| **R2.3** Timer senza escalation sensoriale | Solo colore + pulse visivo | Aggiungere `haptics.tick()` a 5s, `haptics.urgentTick()` a 3s, come in AuctionRoom |
| **R2.4** Nessuna notifica quando tocca a te | Se un giocatore nella tua watchlist e' "sul piatto", non lo sai senza guardare | Push notification / vibrazione / evidenziazione tab quando il giocatore corrente e' nella tua watchlist |

### R3 — Ottimizzare Mobile durante AUCTION (Priorita' MEDIA)

| Issue | Dettaglio | Suggerimento |
|-------|----------|--------------|
| **R3.1** BidPanel sopra il board su mobile | Durante AUCTION, il BidPanel (~350px) sovrasta il board. L'utente deve scrollare per vedere il tabellone | Su mobile, renderizzare il BidPanel come BottomSheet drag-to-expand anziche' inline. Il bottom bar attuale e' gia' ottimo per rilanci rapidi; il BidPanel full potrebbe essere accessible swipando su dal bottom bar |
| **R3.2** Info duplicata: prezzo in BidPanel e bottom bar | Su mobile si vedono entrambi (scrollando) | Se BidPanel diventa BottomSheet, il bottom bar diventa l'unico punto di rilancio compatto. Il BidPanel full (con history, quick bids, warning) si apre on-demand |
| **R3.3** Quick bid buttons `grid-cols-5` su 320px | 5 bottoni (+1, +5, +10, +20, MAX) in ~300px utili = ~56px ciascuno, borderline | Gia' min-h-[44px], ma verificare su 320px reali. Se necessario: 2 righe (3+2) |
| **R3.4** Budget footer occupa ~60px fissi | Sempre visibile quando non in AUCTION — sottrae spazio al board | Rendere il budget footer collassabile di default, espandibile al tap. Oppure integrarlo nell'ActionBar come tooltip/popover |

### R4 — Scalabilita' per Leghe Grandi (Priorita' MEDIA)

Con 20 manager e ~25 giocatori ciascuno, il board ha ~500 righe.

| Issue | Dettaglio | Suggerimento |
|-------|----------|--------------|
| **R4.1** Nessuna virtualizzazione | 500 DOM nodes nella lista scrollabile, potenziale jank su mobile | Adottare `@tanstack/react-virtual` per il board. Soglia: virtualizzare solo se board.length > 50 |
| **R4.2** Nessun filtro/raggruppamento | In un board da 500 righe, trovare un giocatore specifico e' difficile | Aggiungere: (a) barra di ricerca rapida nel board header, (b) filtro per ruolo (P/D/C/A), (c) raggruppamento per manager (accordion), (d) toggle "solo non passati" |
| **R4.3** Nessun bookmark/jump | L'utente deve scrollare per trovare i propri giocatori | Aggiungere chips veloci: "Miei giocatori" / "Watchlist" / "Sul piatto" che scrollano al primo match |
| **R4.4** Board row senza memo | `board?.map(...)` ricrea tutti gli elementi ad ogni render | Estrarre `BoardRow` come componente React.memo con proper key |

### R5 — Micro-Miglioramenti di Usabilita' (Priorita' BASSA)

| Issue | Dettaglio | Suggerimento |
|-------|----------|--------------|
| **R5.1** Etichette contratto `text-[10px]` | "INGAGGIO", "DURATA", "CLAUSOLA", "RUBATA" a 10px sono al limite di leggibilita' | Alzare a `text-[11px]` o `text-xs` (12px) — margine minimo |
| **R5.2** "SUL PIATTO" badge `text-[10px]` | Badge importante ma quasi illeggibile su mobile | Alzare a `text-xs` e aumentare padding |
| **R5.3** Stato WAITING poco utile | Mostra solo EmptyState con testo. L'utente non ha nulla da fare | Se il board e' gia' generato (isOrderSet), mostrare il tabellone in sola lettura con CTA "Prepara le tue strategie" |
| **R5.4** Progress counter duplicato | L'ActionBar ha "29/146" e il header ha il box "Progresso 29/146" | Rimuovere il box header "Progresso" quando l'ActionBar e' visibile, oppure differenziare il contenuto (header = overview, actionbar = dettaglio fase) |
| **R5.5** Nessun indicatore di chi possiede il giocatore corrente | Su mobile, l'owner e' nella seconda riga, facile da perdere | Per il giocatore corrente (isCurrent): dare piu' prominenza all'owner — magari con avatar/colore team |
| **R5.6** Age badge ripetuto desktop/mobile | Lo stesso codice per `playerAge` badge e' duplicato in due blocchi (desktop inline, mobile sotto) | Estrarre un `AgeBadge` component. Non critico ma riduce manutenzione |
| **R5.7** Nessun onboarding contestuale | Un utente nuovo non sa cosa fare durante la rubata | Aggiungere un piccolo tooltip/coach-mark la prima volta: "Quando un giocatore e' SUL PIATTO, clicca VOGLIO RUBARE per avviare un'asta" |
| **R5.8** Separatore strategia con `border-t` su mobile | La sezione strategia usa `border-t border-surface-50/20` solo su mobile (`md:border-t-0`), ma e' sottile e non sempre visibile | Usare un piccolo gap/spacing anziche' un bordo sottile |

### R6 — Accessibilita' (Priorita' MEDIA)

| Issue | Dettaglio | Suggerimento |
|-------|----------|--------------|
| **R6.1** Timer non annunciato a screen reader | Il countdown e' solo visivo | Aggiungere `aria-live="polite"` con annuncio a 10s, 5s, 3s |
| **R6.2** Board rows non navigabili da tastiera | No tabIndex, no keyboard nav | Rendere ogni row focusable con `tabIndex={0}` e gestire Enter per aprire stats, Space per strategia |
| **R6.3** Stato badge nell'ActionBar senza ruolo semantico | `<span>` con emoji non e' informativo per AT | Aggiungere `role="status"` e `aria-label` descrittivo (es. "Stato: Offerta in corso, 23 secondi rimanenti") |
| **R6.4** Bottone strategia con solo emoji su note | `📝` senza testo o aria-label quando solo note impostate | Aggiungere `aria-label="Note strategia impostate"` |
| **R6.5** PendingAckModal non intrappolato | Modal usa shared Modal component che manca focus trapping | Risolvere a livello di design system (issue #14 dell'audit generale) |

---

## Confronto Pattern: Rubata vs AuctionRoom vs Svincolati

| Pattern | AuctionRoom | Svincolati | Rubata | Gap Rubata |
|---------|-------------|------------|--------|------------|
| Haptic feedback | 13 pattern | Nessuno | Nessuno | Colmare (R2.1-R2.3) |
| Confetti celebrativi | 4 varianti | Nessuno | Nessuno | Aggiungere su win (R2.2) |
| Timer escalation | Colore + pulse + shake + glow + haptic | Colore + pulse | Colore + pulse | Aggiungere haptic (R2.3) |
| Mobile bid bar | Fixed bottom, compatto | Fixed bottom, nomination | Fixed bottom, compatto | OK |
| Quick bid buttons | grid-cols-5 + MAX | N/A | grid-cols-5 + MAX | OK |
| Player card in asta | Full card con foto/posizione/team | Full card | Full card | OK |
| Activity feed | N/A | N/A | Collapsible, 2 viste | Punto di forza unico |
| Search/filter | Presente | Presente | Assente | Aggiungere (R4.2) |
| Strategy/preference | N/A | N/A | Presente (inline + modal) | Punto di forza unico, da elevare (R1) |
| Board navigation | N/A | N/A | Scroll FAB | Aggiungere chips (R4.3) |
| Virtualized list | N/A | N/A | Assente | Necessaria per 500+ (R4.1) |

---

## Roadmap Suggerita

### Sprint A — Strategie + Feedback (3-4 giorni)

| # | Task | Effort | Impatto |
|---|------|--------|---------|
| A1 | Esporre watchlist e autoPass in PreferenceModal + riga board | 4h | Alto |
| A2 | CTA "Imposta strategia" al posto di "Nessuna strategia" | 30min | Medio |
| A3 | Banner "Prepara strategie" in WAITING/PREVIEW | 2h | Medio |
| A4 | Integrare haptics.ts (bid, outbid, win, tick) | 2h | Alto |
| A5 | Aggiungere confetti su rubata vinta | 1h | Medio |
| A6 | maxBid warning durante AUCTION | 1h | Medio |

### Sprint B — Mobile AUCTION + Scalabilita' (3-4 giorni)

| # | Task | Effort | Impatto |
|---|------|--------|---------|
| B1 | Virtualizzare board con @tanstack/react-virtual | 4h | Alto per leghe grandi |
| B2 | BidPanel come BottomSheet su mobile | 4h | Alto |
| B3 | Budget footer collassabile di default | 1h | Basso |
| B4 | Barra ricerca + filtri ruolo nel board | 3h | Alto per leghe grandi |
| B5 | Chips "Miei" / "Watchlist" / "Sul piatto" | 2h | Medio |
| B6 | React.memo su BoardRow | 1h | Medio |

### Sprint C — Polish + Accessibilita' (2-3 giorni)

| # | Task | Effort | Impatto |
|---|------|--------|---------|
| C1 | aria-live per timer e bid updates | 2h | Medio (accessibilita') |
| C2 | Keyboard navigation sul board | 3h | Medio (accessibilita') |
| C3 | Alzare text-[10px] a text-[11px]/text-xs | 30min | Basso |
| C4 | Rimuovere duplicazione progress header/actionbar | 30min | Basso |
| C5 | Estrarre AgeBadge component | 30min | Basso (manutenibilita') |
| C6 | Tooltip onboarding prima visita | 2h | Medio |

### Sprint D — Hub Strategie (futuro, post-lancio)

| # | Task | Effort | Impatto |
|---|------|--------|---------|
| D1 | Pagina dedicata "Hub Strategie" accessibile tutto l'anno | 2-3 giorni | Alto (feature distintiva) |
| D2 | Riepilogo strategie con tabella completa | 4h | Alto |
| D3 | Bulk operations (imposta maxBid per ruolo, auto-pass per team) | 4h | Medio |
| D4 | Notifiche push per giocatori in watchlist | 3h | Alto |
| D5 | Confronto giocatori side-by-side con stats | 4h | Medio |
| D6 | Import/export strategie (condivisione opzionale tra sessioni) | 3h | Basso |

---

## Metriche di Successo Suggerite

| Metrica | Baseline attuale | Target post-Sprint A+B |
|---------|-----------------|------------------------|
| Strategie impostate per utente | (non misurabile pre-lancio) | >50% giocatori con almeno 1 campo |
| Tempo medio prima di scrollare al board | ~0s (board-first) | Mantenere <1s |
| Rubate con bid (non "nessuna offerta") | N/A | >30% |
| Crash/jank su board 500 righe (mobile) | Probabile | 0 con virtualizzazione |
| Feedback sensoriale: azioni coperte | 0% | 80%+ (bid, outbid, win, timer) |

---

## Confronto con Audit Precedente

| Metrica | Audit 17/02 | Oggi 19/02 | Delta |
|---------|-------------|------------|-------|
| Score Rubata | 3.0/5 | 3.3/5 | +0.3 |
| Overhead sopra board (mobile) | ~386px | ~92px | -294px |
| Admin mobile accessibile | No (sidebar nascosta) | Si (FAB + BottomSheet) | Risolto |
| D&D touch-friendly | No (HTML5) | Si (@dnd-kit + frecce) | Risolto |
| Haptic feedback | 0 pattern | 0 pattern | Da fare (R2) |
| Board search/filter | Assente | Assente | Da fare (R4.2) |
| Virtualizzazione board | Assente | Assente | Da fare (R4.1) |
| Strategy prominence | Presente ma nascosta | Presente ma nascosta | Da fare (R1) |
