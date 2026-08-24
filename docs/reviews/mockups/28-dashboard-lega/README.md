# Mockup — Dashboard di lega (Hub Lega)

Rework di `LeagueDetail.tsx` + `src/components/league-detail/*`, la home della singola lega
(non la Dashboard globale). Tre alternative HTML statiche, stesso dataset di esempio (Lega
"Fantacontratti Dynasty League", 8 manager, tu = Sordillo FC/admin, fase attiva = **Rubata**,
fase 4 di 7) per confronto diretto. Ogni file include un toggle in alto per vedere anche lo
stato **Pre-mercato**, a dimostrazione che la fase resta leggibile in ogni stato della lega.

Apri i file direttamente nel browser, nessun build step richiesto.

## A — `A-me-al-centro.html`

**Cosa cambia**: l'hero "I miei numeri" (stile `MyTeamHero` di Finanze, reso qui più compatto)
diventa l'elemento dominante della pagina, con dentro anche i contatori di strategia
(Target/Top priorità/Sotto oss./Da cedere) come striscia di chip — non più un blocco a parte.
Tutti i dati di lega/altri manager (KPI aggregati, classifica bilanci, movimenti) sono
raggruppati in un **accordion collassato di default** ("Dati di lega e altri manager"),
aperto con un tap. La fase resta una barra sempre visibile subito sotto l'header.

**Compromesso principale**: la classifica bilanci — oggi sempre visibile in sidebar — sparisce
dalla prima vista. Chi consulta l'Hub Lega principalmente per controllare gli altri manager
(tipico di un admin) deve fare un tap in più.

**Perché può piacere**: è la risposta più diretta e letterale al requisito "voglio vedere i
miei dati in primo piano, quelli degli altri in secondo piano" — nessuna ambiguità, single
column, pochissimi blocchi in superficie (hero + attenzione + un accordion). Massima
applicazione di "less is more".

**Perché può non piacere**: Pietro è admin di lega — potrebbe voler tenere d'occhio la
classifica/i movimenti senza un tap extra ad ogni visita. Perde anche la sidebar persistente
con codice invito, utile in fase di reclutamento manager.

## B — `B-fase-guida.html`

**Cosa cambia**: la fase diventa l'**hero della pagina** — non più una barra sottile ma una
card grande con nome fase, posizione "4 di 7", stepper integrato, descrizione di cosa
succede ora e CTA primaria. Gli item di "richiede attenzione" sono assorbiti come righe
dentro l'hero stesso invece di card separate. Sotto, due colonne di peso minore: "i tuoi
numeri" (versione compatta, senza il grande hero verde) + colonna con movimenti/classifica.

**Compromesso principale**: i "miei dati" sono presenti ma secondari — non è la risposta più
diretta al requisito #1 di Pietro ("i miei dati in primo piano"), anche se restano sempre a
un solo sguardo (riga in alto a destra + card compatta).

**Perché può piacere**: rende il requisito #3 ("deve essere sempre chiaro in che fase si è")
non solo rispettato ma **strutturante** — impossibile aprire la pagina senza sapere dove si è
e cosa fare. Utile soprattutto durante le fasi ad azione diretta (Rubata, Asta Svincolati)
dove "cosa devo fare ora" conta più di "quanto ho in tasca".

**Perché può non piacere**: se Pietro entra nell'Hub Lega soprattutto per un check veloce del
proprio bilancio, qui deve cercarlo in una posizione meno dominante rispetto ad A.

## C — `C-ibrido-tab.html`

**Cosa cambia**: bilancia le due priorità con **pari peso visivo** — riga superiore a due
card 50/50 ("Il mio bilancio" compatto + "Cosa devi fare ora", che fonde CTA di fase e
richieste di attenzione). Sotto, la colonna centrale usa **tab interne** (Andamento /
Strategie / Movimenti — stesso pattern a tab già usato in `LeagueFinancials.tsx`, riuso
di un linguaggio esistente) per non impilare 3-4 blocchi separati come oggi: un solo
contenitore, meno "accozzaglia". La sidebar classifica bilanci resta sempre visibile
(compresa di codice invito), senza tap aggiuntivi. La fase è una barra persistente e
compatta, con CTA inline quando è il tuo turno.

**Compromesso principale**: è il meno radicale dei tre — riduce i blocchi ma non arriva alla
semplicità a colonna singola di A né alla centralità totale della fase di B. La tab di
default ("Strategie") cambia in base alla fase attiva, il che è potente ma introduce una
piccola regola implicita da spiegare in onboarding.

**Perché può piacere**: è il compromesso più "sicuro" — nulla sparisce dietro un tap
imprevisto (a differenza di A), la fase è comunque sempre leggibile (anche se meno
scenografica di B), e riusa un pattern già familiare (tab) invece di introdurne uno nuovo
(accordion). Probabilmente il più semplice da implementare senza sorprendere gli utenti
abituati alla pagina attuale.

**Perché può non piacere**: nessuna delle tre dimensioni (io / lega / fase) vince
chiaramente sulle altre — se Pietro preferisce una gerarchia più netta, A o B comunicano la
scelta in modo più leggibile a colpo d'occhio.

## Nota tecnica per l'implementazione (se una direzione viene scelta)

I "miei numeri" mostrati in tutti e tre i mockup (budget − ingaggi = disponibile, rank,
scadenze contrattuali) **non richiedono un nuovo endpoint**: `leagueApi.getFinancials(leagueId)`
è già chiamato da `LeagueDetail.tsx` (per `leagueTotals`, aggregato su tutta la lega) e
restituisce anche l'array `teams: TeamData[]` per singolo manager — esattamente il dato che
`FinanceDashboard.tsx` usa per popolare `MyTeamHero`. Basterebbe, come già fa
`FinanceDashboard`, individuare `myTeam` per `username` dentro quell'array invece di
scartarlo dopo `computeLeagueTotals`.
