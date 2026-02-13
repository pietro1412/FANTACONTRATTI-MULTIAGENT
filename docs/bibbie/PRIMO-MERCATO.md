# BIBBIA: Primo Mercato Assoluto

> Fonte di verita per l'asta del primo mercato.
> Si svolge UNA SOLA VOLTA per lega, subito dopo la creazione.
> Ultima revisione: 2026-02-06

---

## 1. PANORAMICA

Il Primo Mercato Assoluto e la prima asta della lega. Tutti i manager acquistano giocatori per riempire gli slot della propria rosa. Al termine, non si ripresentera mai piu per quella lega.

### 1.1 Precondizioni

- La lega e stata creata e avviata dall'admin
- Numero manager pari, compreso tra 6 e 20
- Slot ruoli definiti (default: 3P, 8D, 8C, 6A = 25 giocatori)
- Budget iniziale configurato (default: 500)

### 1.2 Avvio

1. L'admin avvia la lega → si passa a "Primo Mercato pronto"
2. L'admin avvia l'asta
3. Tutti i partecipanti devono dichiarare di essere presenti
4. L'admin imposta l'ordine di chiamata (oppure random)

---

## 2. MECCANICA DELL'ASTA

### 2.1 Ordine di Chiamata

- L'admin definisce l'ordine dei turni (o sceglie random)
- Ogni manager, a turno, sceglie un giocatore svincolato da mettere all'asta
- Il turno ruota ciclicamente tra tutti i manager attivi

### 2.2 Vincolo Slot per Ruolo

L'asta procede per ruolo in ordine: **Portieri → Difensori → Centrocampisti → Attaccanti**.

**Regola fondamentale:** Finche TUTTI i manager non hanno completato gli slot di un ruolo, non si puo passare al ruolo successivo.

```
Esempio con 3 slot portiere:
- Manager A ha 3/3 portieri ✓
- Manager B ha 2/3 portieri ✗
→ Si resta sui portieri finche B (e tutti gli altri) arrivano a 3/3
→ Poi si passa automaticamente ai difensori
```

### 2.3 Chi Puo Fare Offerte

- Tutti i manager possono fare offerte per qualsiasi giocatore all'asta
- **Eccezione slot pieno**: se un manager ha gia riempito gli slot del ruolo corrente, NON puo offrire
- **Eccezione budget**: se un manager non ha bilancio sufficiente (prezzo offerta + ingaggio default), viene escluso

### 2.4 Meccanica Offerta

- **Base d'asta**: 1
- **Offerta libera**: qualsiasi manager puo rilanciare
- **Timer**: configurabile dall'admin, reset ad ogni offerta (come la rubata)
- **Vincitore**: ultimo offerente allo scadere del timer

### 2.5 Conferma Chiamata

Quando un manager sceglie il giocatore da mettere all'asta, il sistema chiede **conferma** per evitare errori di click.

---

## 3. ACQUISTO E CONTRATTO

### 3.1 Contratto Default

Alla vittoria dell'asta, il giocatore riceve un contratto default:

```
ingaggio = Math.max(1, Math.round(prezzo_asta / 10))
durata = 3
```

Vedi **Bibbia CONTRATTI.md** sezione 3 per la tabella fasce completa.

### 3.2 Verifica Budget Pre-Offerta

Il manager deve avere bilancio sufficiente per costo asta + ingaggio default:

```
bilancio >= offerta + ingaggio_default
```

**Esempio:** Per offrire 75, serve bilancio >= 83 (75 + 8 di ingaggio default).

### 3.3 Modifica Contratto Post-Acquisto

Il vincitore puo modificare il contratto immediatamente dopo l'acquisto:
- Solo in **aumento** (ingaggio, oppure ingaggio e durata insieme). La durata da sola NON puo essere aumentata senza aumentare anche l'ingaggio.
- Se aumenta l'ingaggio, il costo effettivo e `prezzo_asta + nuovo_ingaggio`
- La durata non impatta il costo immediato

Vedi **Bibbia CONTRATTI.md** sezione 4 per le regole di modifica.

---

## 4. IMPATTO FINANZIARIO

### 4.1 Per Ogni Acquisto

```
Budget -= prezzo_asta
Monte Ingaggi += ingaggio_effettivo (default o modificato)
Bilancio = Budget - Monte Ingaggi
```

### 4.2 Visibilita Budget

Tutti i manager devono poter vedere il budget in tempo reale di tutti i manager durante l'asta.

---

## 5. POTERI DELL'ADMIN

### 5.1 Gestione Timer

L'admin puo modificare la durata del timer dell'offerta durante l'asta.

### 5.2 Pausa Timer

L'admin puo bloccare il timer d'asta in qualsiasi momento (pausa admin).

Un manager puo chiedere una pausa (urgenza). Due tipi:
- **Pausa chiamata**: ferma la scelta del giocatore da astare
- **Pausa asta**: ferma l'asta in corso

### 5.3 Rettifiche

L'admin deve sempre poter rettificare il risultato dell'ultima transazione:

| Azione | Effetto |
|--------|---------|
| **Annulla fine asta** | Riprende dall'ultima offerta (timer riparte) |
| **Annulla chiamata** | Il giocatore torna svincolato, il turno resta al manager che deve scegliere |
| **Rettifica transazione** | Asta conclusa annullata: giocatore torna libero, crediti restituiti al manager |

### 5.4 Fine Asta

L'admin dichiara conclusa l'asta quando tutti i manager hanno riempito tutti gli slot.

---

## 6. TRACCIAMENTO

Tutti i movimenti devono essere tracciati:
- Giocatore acquistato da quale manager, a quale prezzo
- Correzioni admin (annullamenti, rettifiche)
- L'acquisto deve essere chiaro e visibile a tutti i partecipanti in tempo reale

---

## 7. FINE PRIMO MERCATO

Al termine:
- Tutti i manager hanno la rosa completa (tutti gli slot riempiti)
- L'admin dichiara concluso il primo mercato
- Il primo mercato **NON si ripresentera mai** per questa lega
- Da questo momento si potranno avviare i mercati ricorrenti

---

## 8. MANAGER ESCLUSO

Se un manager non ha budget sufficiente per fare offerte (bilancio < offerta minima 1 + ingaggio minimo 1 = 2):
- Viene **escluso** dall'asta
- Non partecipa ai turni di chiamata
- I suoi slot rimanenti restano vuoti? (da definire con admin)

---

## CHANGELOG

| Data | Modifica |
|------|----------|
| 2026-02-06 | Creazione documento con tutte le regole del primo mercato assoluto |
