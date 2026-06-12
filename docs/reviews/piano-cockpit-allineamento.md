# Piano: Cockpit + Allineamento Asta↔Rubata (P1-P7)

> Approvato dall'utente il 2026-06-12. Fonte di verità visiva:
> `docs/reviews/mockups/05-allineamento-asta-rubata/cockpit.html` (frame 1440×860, zero
> scroll di pagina) + `allineamento.html` (dettaglio dei 7 punti, 61 classi condivise) + `NOTE.md`.
> Branch: `feature/1.x-graphic-rework`. Commit atomici per fase, niente push senza ok.
>
> **Portata strategica**: i componenti e il layout estratti qui diventano LA BASE per tutti i
> layout simili della piattaforma (schermate dense con tabelle/liste/dati: Svincolati, Scambi,
> Rose, Storico, ecc.). Estrarre SEMPRE in componenti condivisi, mai copia-incolla.

## I 7 punti (riferimento rapido)

P1 timer stessa veste (Oswald oro tabulare + anello; posizioni diverse e motivate) ·
P2 arena unica (bordo oro, tag fase micro-label, badge ruolo 46px, chip proprietario) ·
P3 controlli rilancio identici (RILANCIA verde, quick bid, warning) · P4 ultimi rilanci a chip ·
P5 riga manager unificata · P6 ready check a chip avatar · P7 admin sempre visibile compatto.

Più: **cockpit a viewport bloccata** — pagina `h-screen`, testata+admin+arena sempre visibili,
scroll SOLO interno ai pannelli lunghi (manager, tabellone, rosa) con fade; arena rubata
ORIZZONTALE; pannello a tab Bilanci|Attività|Strategie nella rubata. Mobile INVARIATO.

## FASE A — Componenti condivisi (commit 1)

Nuovi/promossi in `src/components/ui/` (o `src/components/cockpit/` per i layout):

1. **Monogram**: promuovere da `components/rubata/Monogram.tsx` a `components/ui/` (aggiornare import).
2. **TimerDisplay** (P1): numerone `.timer-sport` oro tabulare + anello sottile SVG; prop
   `size` (40/44px), `critical` (rosso <10s). Sostituisce l'`AuctionTimer` compact nell'asta
   e il timer della `RubataStateBar`.
3. **BidControlsShared** (P3): quick bid +1/+5/+10 (blu), +20 (passion), MAX (oro), stepper
   [−][importo][+], bottone RILANCIA **verde** con glow, warning soglie (≥75% budget; limite
   strategia opzionale). ⚠️ Unifica `auction-room-v2/BidControls` (bidAmount string, conferma
   MAX = flusso T-002 TESTATO) e il form di `RubataBidPanel` (number, highBidConfirmed):
   definire UNA API e adattare nelle pagine SENZA perdere i comportamenti T-001/T-002/T-003.
4. **BidChips** (P4): chip orizzontali "ultimi rilanci" (estrazione da `BiddingPanel`),
   primo chip evidenziato, scroll orizzontale.
5. **ManagerListRow** (P5): riga manager unificata — monogramma, titolo, sottoriga stato,
   numero grande + dettaglio piccolo a destra; stati `isMe` (bordo oro), `isHolding`
   (bordo blu), `dim` (sbiadito). Adottata da `auction-room-v2/ManagerRow` E dal
   `BudgetPanel` della rubata.
6. **MemberReadyChips** (P6): spostare da `auction-room-v2/` a `ui/`; aggiungere variante
   "striscia sottile" (1 riga, label micro-label "PRONTI x/8").
7. **CockpitShell** (layout): griglia `h-screen` `[testata][admin-bar][main 1fr]` con
   overflow gestito; + utility `.panel-scroll` in `index.css` (scrollbar sottile 6px + fade
   bottom via mask o pseudo-elemento).
8. **PanelTabs**: pannello a tab leggero (header micro-label, 2-4 tab) per Bilanci|Attività|Strategie.

Gate dopo la fase: tsc + eslint + test:all verdi (i componenti vecchi restano finché B/C non migrano).

## FASE B — Asta Primo Mercato a cockpit (commit 2)

- `AuctionRoomLayout` → `CockpitShell`: testata (StatusBar attuale, ~56px), riga 2 = rail
  ruoli compressa a sinistra + `AdminActionsPanel` compatto a destra (già sempre visibile),
  main a 3 colonne `[Manager 300px panel-scroll][arena 1fr][La mia rosa 280px panel-scroll]`.
- Arena (P2): `arena-gold` sul CenterStage in bidding, tag fase micro-label ORO
  ("ALL'ASTA · CENTROCAMPISTI"), PlayerCard con statistiche compresse in UNA riga a 5 celle
  (pres/gol/assist/FM/quotazione), TimerDisplay nel price box, BidControlsShared, BidChips,
  striscia PRONTI sottile (ReadyCheck già a chip).
- ManagerRow → ManagerListRow. Mobile: MobileSidePanel/MobileBottomBar INVARIATI.
- Test: aggiornare `AuctionRoom.test.tsx` (mock/stringhe).

## FASE C — Rubata a cockpit (commit 3)

- `Rubata.tsx` → `CockpitShell`: testata = `RubataStateBar` (timer piatto 40px, niente
  anello grande), riga 2 = admin SEMPRE VISIBILE compatto (P7: via chevron/collasso;
  Conduzione · preset timer · Completa fase outline danger), main `[zona azione ~40%][tabellone ~60% panel-scroll]`.
- **Arena ORIZZONTALE** (≤380px): sinistra identità (badge ruolo, nome, chip proprietario)
  + costo scomposto + watchlist; destra OFFERTA ATTUALE grande + affordability +
  BidControlsShared + BidChips. In OFFERING: destra = costo/CTA VOGLIO RUBARE.
- Sotto l'arena: 2 strisce da ~38px — RubataRivalsStrip inline + MemberReadyChips striscia.
- **PanelTabs Bilanci|Attività|Strategie** (sostituisce le 3 card impilate): Bilanci =
  ManagerListRow (riga TU oro), Attività = feed, Strategie = summary; panel-scroll interno.
- Tabellone: header+filtri su una riga, righe in panel-scroll con fade.
- Mobile INVARIATO (dock fisso, sheet, FAB). Test: `Rubata.test.tsx`.

## FASE D — Gate e verifica live (insieme a B e C)

- Gate per OGNI commit: `npx tsc --noEmit` · `npx eslint src` 0 errori · `npm run test:all` verdi.
- Verifica visiva live: lega "Fantacontratti Test" `cmq1a61zj000938rrglhxl7u2` ha una sessione
  in fase RUBATA pronta (ordine da definire dalla UI come Pietro). Per ripristinarla:
  `bash scripts/with-env.sh .env.local npx tsx scripts/reset-to-rubata-order.ts`. Bot panel per
  simulare offerte/rilanci. Asta PM: verificare almeno layout/nomination (serve sessione PM
  se si vuole il flusso completo).
- Confronto side-by-side col mockup cockpit (render: `node scripts/render-mockups.mjs docs/reviews/mockups/05-allineamento-asta-rubata/cockpit.html`).
- Dev: API :3003, client Vite :5174, DB Docker :5433 (.env.local).

## FASE E — Base per il resto della piattaforma (commit 4)

- CLAUDE.md §Stili: documentare il **pattern cockpit** come standard per schermate dense/live
  (testata fissa, scroll interno ai pannelli, arena/zona dominante) e l'elenco dei componenti
  condivisi (TimerDisplay, BidControlsShared, BidChips, ManagerListRow, MemberReadyChips,
  CockpitShell, PanelTabs, .panel-scroll) come base OBBLIGATORIA per le prossime sezioni
  (Svincolati è la prossima del rework — Fase 3.2).
- Aggiornare memoria `redesign-ux-mockups` (fase completata, prossimo passo Svincolati).
- Eliminare il codice rimasto orfano dopo le migrazioni (vecchi BidControls/ManagerRow/ecc.
  se non più importati).

## Vincoli sempre validi

Palette SOLO token Stadium Nights + classi tema (`micro-label`, `arena-gold`, `dot-live`,
`progress-gradient`); niente emoji-icona (lucide-react); no `any`; no console.log; import `@/`
per nuovo codice; messaggi utente in italiano; NESSUN cambio backend; mobile invariato;
flussi testati T-001/T-002/T-003 (conferma MAX, disabilitazioni) preservati.
