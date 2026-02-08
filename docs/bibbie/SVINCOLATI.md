# BIBBIA: Asta Svincolati

> Fonte di verita per la fase 5 del mercato ricorrente: asta giocatori svincolati.
> Ultima revisione: 2026-02-06

---

## 1. PANORAMICA

L'asta svincolati e la fase 5 del mercato ricorrente. I manager, a turno, possono acquistare giocatori svincolati (senza contratto attivo) tramite asta.

### 1.1 Precondizioni

- Fase 4 (Rubata) completata
- Giocatori svincolati disponibili (scadenza contratto, tagli, mai acquistati)
- Almeno un manager con budget sufficiente

---

## 2. ORDINE DI CHIAMATA

### 2.1 Regola

L'ordine di chiamata e **inverso** all'ordine della rubata.

```
Se ordine rubata:     A → B → C → D → E → F
Ordine svincolati:    F → E → D → C → B → A
```

Il primo manager della rubata (vantaggiato nella rubata) e l'ultimo negli svincolati (svantaggiato) e viceversa.

### 2.2 Turno

Ogni manager, al proprio turno, sceglie un giocatore svincolato da mettere all'asta. Il turno ruota ciclicamente tra i manager ancora attivi.

---

## 3. MECCANICA DELL'ASTA

### 3.1 Svolgimento

L'asta si svolge come il Primo Mercato:
- **Base d'asta**: 1
- **Offerta libera**: qualsiasi manager puo rilanciare
- **Timer**: configurabile dall'admin, reset ad ogni offerta
- **Vincitore**: ultimo offerente allo scadere del timer

### 3.2 Conferma Chiamata

Quando un manager sceglie il giocatore da mettere all'asta, il sistema chiede conferma.

### 3.3 Pausa

Un manager puo richiedere uno stop temporaneo.

### 3.4 Rettifiche Admin

L'admin deve sempre poter rettificare (come nel primo mercato):
- Annulla fine asta e riprendi da ultima offerta
- Annulla chiamata del giocatore
- Rettifica ultima transazione (giocatore torna libero, crediti restituiti)

---

## 4. CONTRATTO DEFAULT

### 4.1 Formula

Stessa formula del primo mercato:

```
ingaggio_default = Math.max(1, Math.round(prezzo_asta / 10))
durata_default = 3
```

Vedi **Bibbia CONTRATTI.md** sezione 3 per la tabella fasce completa.

### 4.2 Modifica Post-Acquisto

Il vincitore puo modificare il contratto subito dopo l'acquisto:
- Solo in aumento (increase-only)
- Ingaggio puo aumentare
- Durata puo aumentare (richiede prima aumento ingaggio)
- Max durata: 4

Vedi **Bibbia CONTRATTI.md** sezione 4 per le regole complete.

---

## 5. IMPATTO FINANZIARIO

### 5.1 Costo Acquisto

```
Costo totale = prezzo_asta + ingaggio_effettivo (default o modificato)
```

Il manager deve avere bilancio sufficiente per ENTRAMBI prima di fare offerta.

### 5.2 Verifica Pre-Offerta

```
bilancio >= offerta + ingaggio_default
```

**Esempio offerta minima:**
- Offerta 1, ingaggio default = Math.max(1, Math.round(1/10)) = 1
- Serve bilancio >= 2 (1 + 1)

### 5.3 Esempio Completo

```
Manager A, bilancio 250
Asta svincolato Bernabe, vince a 25
Ingaggio default = Math.max(1, Math.round(25/10)) = 3, durata 3
Costo = 25 + 3 = 28
Bilancio = 250 - 28 = 222

Manager A modifica contratto da 3x3 a 5x4:
Costo = 25 + 5 = 30
Bilancio = 250 - 30 = 220
```

---

## 6. RINUNCIA AL TURNO

### 6.1 Regola

Un manager puo dichiarare di voler **saltare il turno**. Questa rinuncia e **definitiva**: il manager smette di partecipare all'asta svincolati anche per tutti i turni futuri.

### 6.2 Effetto

- Il manager esce dalla rotazione dei turni
- Puo ancora fare offerte quando altri manager mettono giocatori all'asta? (da definire)
- Non puo piu chiamare giocatori

---

## 7. FINE FASE

La fase si conclude quando si verifica una delle seguenti condizioni:

| Condizione | Descrizione |
|------------|-------------|
| **Niente svincolati** | Non ci sono piu giocatori svincolati disponibili |
| **Nessun budget** | Nessun manager ha bilancio >= 2 (offerta minima 1 + ingaggio minimo 1) |
| **Tutti rinunciano** | Tutti i manager ancora attivi hanno rinunciato al turno |
| **Admin chiude** | L'admin puo dichiarare fine fase in qualsiasi momento |

---

## 8. TRACCIAMENTO

Tutti i movimenti devono essere tracciati:
- Giocatore acquistato da quale manager, a quale prezzo
- Contratto assegnato (default o modificato)
- Correzioni admin
- Rinunce al turno

---

## CHANGELOG

| Data | Modifica |
|------|----------|
| 2026-02-06 | Creazione documento con regole asta svincolati, ordine inverso, rinuncia turno, fine fase |
