# Mockup — Composizione per reparto (RosterOverview)

Contesto: in `src/components/league-detail/RosterOverview.tsx` la prima versione di "età +
conteggio per reparto" impila due numeri nella stessa cella P/D/C/A (es. "30.7" sopra "3 gioc."),
sia nella card "La mia rosa" sia nella tabella "Rose degli avversari". Pietro l'ha vista e ha
detto esplicitamente: **"non è abbastanza chiara la visualizzazione dei dati in tabella"**.

I 4 mockup qui sotto esplorano **tagli concettualmente diversi** per risolvere lo stesso
problema — non varianti cosmetiche dello stesso layout impilato. Ogni file è autonomo (apribile
direttamente nel browser, nessun build step) e mostra sia la resa desktop (tabella) sia quella
mobile (card, frame telefono 375px affiancato, stessa convenzione già usata in
`docs/reviews/mockups/27-rose-table-redesign/index.html`). Dataset di esempio comune a tutti e
quattro: 8 manager (io = Sordillo FC, admin, + 7 "Simulato N"), con un caso limite incluso
(Simulato 4 ha 0 portieri in rosa → età "N.D.") per verificare come ogni layout gestisce i dati
mancanti.

Nessun file in `src/` è stato toccato — solo mockup statici e questo report.

## A — `A-colonne-separate.html`

Due gruppi di intestazione distinti — "Età media per reparto" e "N. giocatori per reparto" —
ciascuno con le 4 sotto-colonne P/D/C/A colorate. Ogni cella mostra **un solo valore**: niente
più ambiguità su cosa sia il numero in alto e cosa quello in basso.

**Pro**: la lettura verticale (tutte le età in un blocco, tutti i conteggi nell'altro) è la più
esplicita e diretta possibile — zero curva di apprendimento, l'utente non deve mai decifrare un
formato. Rispetta alla lettera il suggerimento "colonne separate" di Pietro.

**Contro**: 12 colonne totali portano la tabella a >980px di larghezza minima — su laptop più
piccoli (13", finestra non massimizzata) richiede scroll orizzontale *dentro il pannello*
(mitigato, non elimina il problema: è comunque più denso di quanto serva). È l'opzione con più
"superficie" occupata, in tensione con "less is more" se applicata senza criterio ad altre
tabelle dense della piattaforma.

## B — `B-cella-compatta.html`

Stessa struttura a 4 colonne di oggi (minimo cambiamento), ma dentro ogni cella un'**unica riga**
— "**3** · 24.5" — invece di due numeri impilati senza contesto. Il conteggio (il dato nuovo, più
rilevante per la domanda "quanti ne ho in quel reparto") è in grassetto grande; l'età è più
piccola e attenuata. L'ordine è fisso e spiegato una volta nell'header colonna, mai ripetuto per
cella.

**Pro**: è il fix più economico da implementare — stesso layout `RosterOverview.tsx` di oggi,
solo la cella cambia da due righe a una con un separatore esplicito. Larghezza tabella quasi
invariata (colonne P/D/C/A passano da 44px a ~64px).

**Contro**: risolve l'ambiguità ma non la densità — resta comunque un dato composito in una
cella stretta, meno scannabile a colpo d'occhio di un componente visivo dedicato. Chi non legge
la legenda in header può ancora confondere quale numero sia "quanti" e quale "quanti anni" al
primo sguardo (anche se l'ordine fisso + il grassetto aiutano molto più della v1).

## C — `C-chip-colorato.html`

Le 4 colonne numeriche diventano una **striscia di 4 chip colorati** (stesso codice colore già
usato per i badge ruolo: oro P, blu D, verde C, rosso A). Il numero grande nel chip è il
conteggio, l'età è l'etichetta piccola accanto. Componente riusabile, ispirato al `.pos-chip` già
presente in `docs/reviews/mockups/28-dashboard-lega/E-rose.html`.

**Pro**: si scansiona per **colore e forma**, non solo per posizione in colonna — il canale
visivo primario (colore reparto) è coerente con badge ruolo già in uso altrove nella piattaforma
(Assioma 4, componenti condivisi). Il chip-strip **wrappa naturalmente** su mobile senza bisogno
di una griglia rigida a 4 colonne: è probabilmente la resa mobile più pulita delle quattro.
Tabella desktop più snella (5 colonne invece di 8/12).

**Contro**: richiede investire in un nuovo componente condiviso (non è un puro riuso di markup
esistente) — sforzo M invece di S. Su schermi molto stretti la colonna "Composizione" (min
300px) può spingere la tabella a scrollare comunque se combinata con nomi squadra lunghi.

## D — `D-riga-espandibile.html`

La tabella mostra di default **solo l'aggregato**: totale giocatori + mini-barra proporzionale
colorata (nessun numero per reparto). Il dettaglio età+conteggio è dietro un tap sul pulsante
▾, che apre una riga espansa inline sotto la riga principale, senza lasciare la pagina.

**Pro**: applicazione più fedele del principio "less is more in superficie, profondità un
livello sotto" — la vista di default è la più leggera delle quattro, utile se l'obiettivo
primario di quella riga è "quanto bilancio ha, quanti giocatori totali ha" più che il dettaglio
per reparto. La mini-barra dà comunque un'idea visiva immediata delle proporzioni senza leggere
numeri.

**Contro**: è l'unica opzione che **nasconde per default** un dato che Pietro ha esplicitamente
chiesto di vedere "in tabella" — va contro la richiesta originale se interpretata alla lettera.
Ha anche un costo di implementazione reale non banale: oggi l'intera riga avversario in
`RosterOverview.tsx` è un `<button>` che naviga a Rose; aggiungere un toggle di espansione
richiede o un secondo elemento cliccabile con `stopPropagation`, o restringere l'area-click a
solo il nome squadra. Flag esplicito nel file stesso (`.impl-note`) perché non è solo grafica.

## Confronto rapido

| Mockup | Colonne tabella | Sforzo impl. | Chiarezza al primo sguardo | Densità di default | Rischio |
|---|---|---|---|---|---|
| A — Colonne separate | 12 (largo) | S | Massima (nessuna ambiguità) | Alta | Tabella larga, scroll su laptop piccoli |
| B — Cella compatta | 8 (come oggi) | S (minimo) | Buona (ordine fisso + grassetto) | Media | Ancora un dato composito per cella |
| C — Chip colorato | 5 (stretto) | M (nuovo componente) | Alta (colore+forma) | Media | Nuovo componente da costruire e mantenere |
| D — Riga espandibile | 6 (aggregato) | M/L (cambio interazione) | Alta se aperto, nulla se chiuso | Bassissima | Nasconde per default il dato richiesto; tocca il click-through della riga |

## Raccomandazione

**C — Chip colorato** è la mia raccomandazione principale: risolve l'ambiguità della v1 nel modo
più diretto (colore + numero grande = conteggio, età secondaria e leggibile), riduce le colonne
della tabella invece di aumentarle (in linea con "less is more" anche nella vista dettagliata,
non solo nella prima schermata), e la sua resa mobile è la più naturale delle quattro perché il
chip-strip wrappa da solo senza bisogno di una griglia rigida. È anche l'opzione con più
potenziale di riuso: lo stesso chip può sostituire, in futuro, formati simili altrove (es. Rose,
Giocatori) senza reinventare la formula ogni volta — coerente con l'Assioma 4.

Se invece la priorità è **il minimo sforzo di implementazione** partendo da quello che c'è già
oggi (nessun nuovo componente, stesso numero di colonne), **B — Cella compatta** è la scelta più
pragmatica: risolve comunque l'ambiguità lamentata da Pietro (ordine fisso, gerarchia
tipografica chiara) con un cambiamento minimo rispetto al codice attuale.

Sconsiglio **D** come soluzione di default per questa specifica richiesta: Pietro ha chiesto di
*vedere* il conteggio in tabella, non di doverlo scoprire con un tap — nasconderlo per default
va contro l'intento esplicito, anche se il principio di progressive disclosure che rappresenta è
valido e vale la pena tenerlo in tasca per tabelle più dense di questa (es. Storico, Tutti i
giocatori) dove i reparti non sono l'informazione primaria della riga.

**A** resta un'opzione valida se Pietro preferisce la massima esplicitezza letterale a costo di
una tabella più larga — ma su questa pagina (che convive con budget, età rosa e altri dati nella
stessa riga) rischia di essere più densa del necessario rispetto a C.

La decisione finale spetta a Pietro — questi quattro mockup sono pensati per essere aperti uno
accanto all'altro nel browser e confrontati a colpo d'occhio.
