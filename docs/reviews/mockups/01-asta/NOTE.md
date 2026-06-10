# Mockup Asta / Primo Mercato — Note di design

> Sezione pilota: **schermata d'asta a chiamata in tempo reale** (Primo Mercato).
> 3 varianti statiche di presentazione. Nessun codice di produzione toccato.
> Riferimento codice analizzato: `src/pages/AuctionRoom.tsx`, `src/hooks/useAuctionRoomState.ts`, `src/components/auction-room-v2/*`. Regole: `docs/bibbie/PRIMO-MERCATO.md`.

## Diagnosi della confusione attuale

Le 4 cose che il manager DEVE sapere per decidere sotto timer — **giocatore all'asta, offerta corrente + chi la detiene, timer, il mio margine (budget/offerta max/slot)** — competono visivamente con molto rumore:

- **3 colonne di pari peso** (Spy Financials | CenterStage | Board Strategica): nessuna gerarchia, l'occhio non sa dove andare.
- **Gergo da cruscotto finanziario**: `Market Pulse`, `P.A.R.`, `C.M.S.`, "inflazione reparto", "Analisi Obiettivi", "savings %". Sono metriche da post-partita, non da decisione in 8 secondi.
- **Lista rivali piatta**: tutti gli 8 manager mostrati uguali, anche chi ha lo slot pieno e non può più rilanciare → informazione che non guida l'azione.
- **Doppia identità** ("ASTA LIVE PROFESSIONAL", "Spy Financials", "Board Strategica"): naming decorativo che aggiunge carico.

Principio guida comune alle 3 varianti: **una sola zona di decisione dominante** (giocatore + prezzo + timer + bottone rilancio), tutto il resto demoto a contorno scansionabile.

---

## v1 — Riordino conservativo (`v1-conservativo.html`)

Stesso tema Stadium Nights, stessi token (`surface-*`, `primary` blu, `secondary` verde, `accent` oro, `danger` rosso): zero rischio di identità, intervento solo su gerarchia e densità.

- **Status bar dimezzata**: tolto "PROFESSIONAL", spostate le pill ruolo su una riga dedicata sotto; restano solo Budget + Offerta Max, le uniche due cifre che servono prima di rilanciare.
- **Center stage come unico focale**: card giocatore e box prezzo/timer affiancati e ingranditi; il prezzo a 56px col timer-ring rosso pulsante è l'elemento più grande dello schermo.
- **Rimosso tutto il gergo analitico** (Market Pulse, PAR, CMS, savings): le colonne laterali diventano "Manager & Budget" (con max bid per riga, l'unica metrica azionabile) e "La mia rosa" a slot colorati per ruolo.
- **Mobile**: tab Asta/Rivali/Mia rosa per non impilare tre pannelli; barra di rilancio fissa in basso col pollice (timer + prezzo + stepper + bottone), il resto scorre sopra.

## v2 — Evoluzione (`v2-evoluzione.html`)

Dark ripensato (palette più fredda/profonda, font Sora, raggi e ombre più morbidi), nuova gerarchia e componenti nuovi, micro-interazioni suggerite staticamente (anello timer SVG, glow del bottone).

- **Command bar + role rail**: l'header diventa un cruscotto con stat-card Budget/Offerta-Max evidenziate, e una "rotaia" dei 4 ruoli che mostra a colpo d'occhio dove siamo nel mercato (P/D done, C attivo, A futuro).
- **Arena a 2 colonne** (giocatore | timer+prezzo+rilancio): la decisione è tutta in un riquadro, con quick-bid `+1/+5/+10` per rilanciare senza digitare quando restano pochi secondi.
- **Pannello "Chi può superarti"**: la novità concettuale. I rivali non sono più una lista piatta ma una classifica di **minaccia reale** — solo chi ha slot CEN liberi *e* budget per battere la tua offerta max è in evidenza; chi è "fuori" (slot pieno) è barrato. Trasforma dati grezzi in intel azionabile.
- **Mobile**: dock inferiore con anello-timer, prezzo gigante e stepper; sopra, hero giocatore + i due-tre rivali pericolosi. La riserva budget ("trattenuti 14 M per 4 slot") è esplicitata, regola chiave della Bibbia §8 spesso invisibile.

## v3 — Redesign audace (`v3-audace.html`)

Piena libertà: direzione **broadcast editoriale** (carta avorio + inchiostro, accento fiamma/arancio + verde campo, font Archivo Expanded condensato, Space Mono per le cifre). Look da "programma TV d'asta", alto contrasto, leggibile a distanza e sotto pressione.

- **Una sola zona-decisione a sinistra**: lotto all'asta (nome enorme condensato + badge ruolo), pricebar nera con orologio fiamma e prezzo a 72px, bottone **RILANCIA** arancio con ombra fisica — impossibile sbagliare l'azione primaria. Quick-bid sotto.
- **Board a destra ordinata per minaccia**: i manager sono una classifica con la riga "Tu" invertita (inchiostro pieno) sempre individuabile; chi è fuori dal ruolo è tratteggiato e sbiadito. La mia rosa è ridotta a barre-pixel per ruolo: densità informativa minima, leggibilità massima.
- **Ribbon ruoli come stepper di processo**: P/D completati, C attivo (nero pieno), A futuro — il flusso del Primo Mercato (ruoli in ordine, regola Bibbia §2.2) diventa la spina dorsale della pagina, non una nota a margine.
- **Mobile**: stessa gerarchia compressa — header inchiostro con Budget+Max, ribbon ruoli, lotto + classifica minaccia che scorrono, dock nero ancorato con orologio/prezzo/RILANCIA. Pollice sempre sul bottone, occhio sempre sul timer.

---

## Come le 3 risolvono la confusione (sintesi)

| Problema attuale | v1 | v2 | v3 |
|---|---|---|---|
| 3 colonne pari peso | center stage dominante | arena + 1 pannello | 60/40 decisione/board |
| gergo PAR/CMS/Pulse | rimosso | rimosso, sostituito da "minaccia" | rimosso |
| rivali piatti | budget+maxbid per riga | classifica minaccia | classifica minaccia + "fuori" sbiaditi |
| focale debole | prezzo 56px + ring | prezzo 64px + anello SVG | prezzo 72px + bottone fisico |
| identità decorativa | naming pulito | command bar funzionale | linguaggio broadcast |
