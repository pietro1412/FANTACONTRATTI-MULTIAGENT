# Audit — Tabella Rose (RosterTableRow / RosterPlayerCard)

> Richiesta di Pietro: "rendere la tabella più leggibile... sottolineando le info essenziali del gioco (contratto, durata, clausola, rubata) e usando meglio gli spazi", dopo aver visto dati reali popolati.
> File coinvolti: `src/components/players/RosterTableRow.tsx`, `src/components/players/RosterPlayerCard.tsx`, usati da `src/pages/RoseGiocatori.tsx` (tab "Rose" e "Tutti i giocatori"). Componente di riferimento valutato: `src/components/ui/ContractInline.tsx`.

## 1. Diagnosi

**Ridondanza label per-cella su desktop.** `RosterTableRow.tsx:32-49` (`FinancialValue`) stampa una micro-label 8px ("Ing"/"Dur"/"Cls"/"Rub") sopra ogni valore, riga per riga. Ma l'header di colonna — definito in `RoseGiocatori.tsx:943-950` (tab Rose: "Ingaggio/Durata/Clausola/Rubata") e `RoseGiocatori.tsx:1152-1160` (tab "Tutti i giocatori": "Ing/Dur/Cls/Rub") — è sempre visibile sopra il pannello scrollabile (pattern cockpit, header non scrolla via `.panel-scroll`). Il risultato: la stessa informazione ("questa colonna è l'ingaggio") viene comunicata due volte per ogni riga × ~25 righe per rosa. Il numero, che è l'informazione a valore decisionale, condivide lo spazio verticale della cella con testo ridondante invece di essere l'elemento dominante.

**Mini-statistiche con peso visivo pari ai dati contrattuali, nonostante siano quasi sempre ND.** `MiniStat` (`RosterTableRow.tsx:23-30`) usa lo stesso trattamento tipografico (`stat-number`) di `FinancialValue`, solo con colore leggermente più tenue (`text-gray-300` vs `text-white`). Per l'Assioma 6, le statistiche sono l'**ultimo** elemento della gerarchia di importanza (dopo prezzo rubata) — ma nel contesto reale attuale (dati Serie A non sincronizzati di frequente) sono quasi sempre 4× "ND" per riga, occupando 120px (`ROSTER_ROW_GRID_BASE`, riga 19) di larghezza fissa per informazione quasi sempre assente. Decine di riquadri "ND" per rosa competono visivamente con i 4 valori di contratto che contano davvero.

**Bug di formattazione su mobile.** `RosterPlayerCard.tsx:56-58`:
```
{formatStat(cs?.appearances)}P {formatStat(cs?.totalGoals)}G {formatStat(cs?.totalAssists)}A
```
`formatStat` (in `src/utils/stat-format.ts:29-37`) non aggiunge suffisso al fallback `'ND'` — solo ai numeri reali. Con dati assenti (il caso più comune oggi) il markup produce `NDPNDGNDA` incollato senza spazi, illeggibile. Inoltre il voto (VT) non compare affatto su mobile — solo P/G/A — mentre il desktop mostra 4 mini-stat (PR/G/A/VT): incoerenza tra le due viste dello stesso componente condiviso.

**Cosa è già corretto e va preservato:**
- Badge ruolo a colori token (`PlayerRoleBadge`), coerente su desktop e mobile.
- Tono gold riservato solo a Rubata (`RosterTableRow.tsx:139`, `RosterPlayerCard.tsx:82`) — allineato all'Assioma 6: è il "numero-decisione" della riga (quanto costa rubare/essere rubati).
- Età con fallback `N.D.` a bassissimo contrasto (`RosterTableRow.tsx:81`, colore `text-gray-600`), correttamente subordinata.
- Nome giocatore sempre cliccabile → modale statistiche (Assioma 7), su entrambe le viste.
- Card mobile: griglia contratto a 4 celle con label sempre visibili (`RosterPlayerCard.tsx:78-83`) — già pienamente conforme all'Assioma 9.

## 2. Assioma 9 vs header di colonna — ragionamento

L'Assioma 9 ("quando si mostrano ingaggio e durata ci vogliono sempre label che li identificano") nasce per evitare numeri "nudi" senza contesto — il caso tipico è una card, un chip in una riga di scambio, o un valore inline in un modale, dove il numero appare isolato e nessun elemento circostante ne chiarisce il significato. Nella tabella desktop di Rose questo contesto è già garantito strutturalmente: un header di colonna sortabile, sempre visibile (grid a 6/8 colonne, non scrolla via il pattern cockpit `.panel-scroll`), etichetta ogni colonna in modo esplicito e persistente. È lo stesso principio di qualunque tabella dati tabellare (foglio di calcolo, Football Manager, Hattrick): l'intestazione di colonna sostituisce l'etichetta per singola cella — ripeterla su ogni riga è ridondanza, non chiarezza.

Sulla card mobile invece non esiste un header persistente sopra ogni carta (specie in una lista scrollata/virtualizzata dove la card può comparire senza l'header nel viewport) — qui l'Assioma 9 si applica in pieno e l'implementazione attuale (`ContractStat`, 4 celle con label) è corretta e va mantenuta.

**Interpretazione proposta:** l'Assioma 9 impone label esplicite quando il numero appare *fuori da una tabella con header di colonna esplicito e persistente*. Dentro una tabella con header cockpit, l'header è la label. Questa non è una violazione dell'assioma ma un'applicazione del suo stesso principio (identificare il valore) tramite un meccanismo diverso (colonna vs. per-cella). Segnalo comunque la modifica come **decisione di prodotto da confermare con Pietro**, trattandosi di uno scostamento dalla lettera ("sempre") dell'assioma dettato esplicitamente.

**Su `ContractInline`:** è un componente a flusso inline (span con separatore `·`), pensato per righe di testo non tabellari (es. dentro una frase o un blocco compatto). Non è direttamente riusabile in `RosterTableRow`/`RosterPlayerCard`, che richiedono allineamento a griglia rigido (colonne allineate verticalmente su desktop, box quadrati su mobile) — esigenza di layout diversa. Il pattern "label sopra + valore sotto" di `FinancialValue`/`ContractStat` duplica però la logica di `Field` in `ContractInline` (label + value + tono): estrarre un atomo condiviso `LabeledStat` sarebbe una pulizia sensata ma è fuori scope per questo intervento (basso impatto, refactor puramente interno).

## 3. Proposta di redesign

### Desktop — `RosterTableRow.tsx`
- **Rimuovere** la micro-label per-cella da Ingaggio/Durata/Clausola/Rubata: il valore diventa l'unico contenuto della cella, centrato verticalmente, font aumentato (14px → 17px, Rubata a 18px). L'header colonna resta l'unica fonte di identificazione (già sortabile, invariato).
- **Mini-statistiche a peso ridotto e condizionali:** quando i 4 valori sono *tutti* ND per una riga, collassarli in una singola dicitura muted "stats non sync." invece di 4 riquadri "ND" — libera spazio visivo e riduce il rumore senza nascondere il dato quando presente. Quando almeno un valore è disponibile, mantenere la griglia 4-mini-stat ma con contrasto ridotto (`text-gray-500`) rispetto ai dati contrattuali, per restare subordinata secondo l'Assioma 6.
- **Larghezze colonna:** lieve incremento su Ingaggio/Clausola/Rubata (80px → 88-92px) per accogliere il font più grande; Durata resta compatta (64px, sufficiente per "3 s"); la colonna Rendimento assorbe lo spazio quando collassata.

### Mobile — `RosterPlayerCard.tsx`
- **Contratto invariato**: griglia 4 celle con label già conforme, solo font leggermente più leggibile.
- **Mini-statistiche spostate** fuori dalla riga anagrafica (elimina il bug di concatenazione) in una riga dedicata sotto il contratto, con le stesse 4 sigle del desktop (PR/G/A/VT, aggiungendo VT che oggi manca) e lo stesso collasso "statistiche non sincronizzate" quando tutte ND — coerenza totale fra le due viste dello stesso componente condiviso.
- **Nota minore:** l'area di tap del nome giocatore è oggi solo il testo (nessun padding dedicato), sotto la soglia consigliata di 44px per il touch target mobile — segnalato ma non affrontato in questo mockup (intervento separato, a basso impatto visivo).

## 4. Mockup

`docs/reviews/mockups/27-rose-table-redesign/index.html` — confronto diretto prima/dopo, sia riga desktop sia card mobile, con tre giocatori reali (Barella Inter, Leão Milan, Falcone Lecce) nei valori forniti, palette e font ripresi dal mockup esistente `docs/reviews/mockups/12-rose/rose.html`.
