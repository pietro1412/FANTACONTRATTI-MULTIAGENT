# BIBBIA: Mercato Ricorrente

> Fonte di verita per il mercato ricorrente e le sue 7 fasi.
> Per le fasi 4 (Rubata) e 5 (Svincolati) esistono Bibbie dedicate.
> Ultima revisione: 2026-02-06

---

## 1. PANORAMICA

Il Mercato Ricorrente e il ciclo di mercato che si ripete periodicamente. Viene avviato dall'admin e si compone di 7 fasi in successione obbligatoria.

### 1.1 Avvio

1. L'admin avvia il mercato ricorrente
2. I manager ricevono notifica di avvio
3. **All'avvio**: decremento automatico durata contratti (vedi sezione 2)

### 1.2 Le 7 Fasi

```
┌─────────────────────────────────────────────────────────────┐
│                   MERCATO RICORRENTE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  APERTURA: decremento durata contratti, svincoli  → CONTRATTI │
│                                                              │
│  FASE 1 → Offerte e Scambi Liberi (pre-rinnovi)             │
│  FASE 2 → Assegnazione Premi                     → FINANZE  │
│  FASE 3 → Rinnovo Contratti e Consolidamento → CONTRATTI+FIN │
│  FASE 4 → Asta Rubata          → vedi Bibbia RUBATA.md      │
│  FASE 5 → Asta Svincolati      → vedi Bibbia SVINCOLATI.md  │
│  FASE 6 → Offerte e Scambi Liberi (post-svincolati)         │
│  FASE 7 → Fine Mercato                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. APERTURA MERCATO: DECREMENTO DURATA

All'apertura del mercato ricorrente, PRIMA di qualsiasi fase:

1. **Tutti i contratti attivi**: `durata -= 1`
2. **Ricalcolo clausole** rescissorie con nuove durate
3. **Contratti con durata 0**: giocatore diventa svincolato automaticamente (evento tracciato)
4. **Giocatori ESTERO/RETROCESSO**: gestiti separatamente (possono cambiare stato con aggiornamento quotazioni)
5. **Comunicazione**: ogni manager vede chiaramente la situazione contrattuale aggiornata e gli eventi (svincoli, partenze estero/serie B)

**NOTA:** I dati possono cambiare durante il periodo di mercato a fronte di aggiornamenti del file quotazioni.

---

## 3. FASE 1 - OFFERTE E SCAMBI LIBERI (PRE-RINNOVI)

### 3.1 Descrizione

I manager possono scambiarsi giocatori e/o crediti liberamente tramite offerte.

### 3.2 Durata

L'admin decide quando chiudere la fase. Non c'e un limite di tempo automatico.

### 3.3 Tipi di Offerta

Un'offerta puo contenere qualsiasi combinazione di giocatori e crediti:

```
Esempi:
- Ti do Sommer e mi dai Maignan
- Ti do Sommer + 10M e mi dai Maignan
- Ti do Sommer e mi dai Maignan + 10M
- Dammi Maignan a 10M (solo crediti)
- Ti offro Sommer a 10M (solo crediti)
- Ti do Sommer e Barella e mi dai Maignan e Vardy
- Ti do Sommer + 10M e mi dai Maignan e Marusic
```

### 3.4 Flusso Offerta

```
Manager A invia offerta a Manager B
  ↓
Manager B puo:
  - Accettare → accordo chiuso
  - Rifiutare → offerta chiusa
  - Controofferta → modifica completa dell'offerta (aggiungere/togliere giocatori e soldi)
    ↓
  Manager A valuta controofferta (accetta/rifiuta/contro-controofferta)
```

### 3.5 Visibilita

| Stato offerta | Chi vede i dettagli | Chi sa che esiste |
|---------------|--------------------|--------------------|
| In corso | Solo i 2 manager coinvolti | Tutti (sanno che c'e trattativa, ma non i dettagli) |
| Accettata | Tutti | Tutti |
| Rifiutata | Tutti | Tutti |

### 3.6 Trasferimento Contratto

Quando un giocatore viene scambiato, il contratto esistente viene **trasferito** (come nella rubata, NON ricreato).

**In questa fase, il contratto trasferito NON incide sul bilancio.** L'impatto si vedra al consolidamento (Fase 3).

### 3.7 Budget Check

- Verificato **prima dell'invio** dell'offerta
- Se il manager offre crediti, deve averli a bilancio
- Il bilancio NON tiene conto dei contratti dei giocatori ricevuti (monte ingaggi non ricalcolato)

### 3.8 Impatto Finanziario

Solo i movimenti economici (crediti) impattano il bilancio:

```
Manager A dà 10M a Manager B per Maignan:
  Manager A: budget -= 10, bilancio -= 10
  Manager B: budget += 10, bilancio += 10
  Maignan: contratto trasferito a Manager A (nessun impatto bilancio)
```

---

## 4. FASE 2 - ASSEGNAZIONE PREMI

### 4.1 Descrizione

L'admin assegna premi ai manager e gestisce indennizzi per giocatori ESTERO.

### 4.2 Budget Premi Standard

- Importo uguale per tutti i manager
- Configurato dall'admin **ad ogni mercato ricorrente** (puo variare)

### 4.3 Premi Variabili

L'admin puo aggiungere premi specifici:

| Tipo | Descrizione |
|------|-------------|
| Miglior portiere | L'admin assegna importo a un manager |
| Disciplina | L'admin assegna importo |
| Punteggio | L'admin assegna importo |
| Altro | Qualsiasi premio custom |

Per ogni premio variabile, l'admin inserisce manualmente l'importo per ogni manager interessato.

### 4.4 Indennizzi Giocatori ESTERO

- L'admin **deve** inserire un valore di indennizzo per ogni giocatore ESTERO
- Valore minimo: 0 (esiste il caso di indennizzo pari a 0)
- Formula automatica: da definire in futuro (attualmente manuale)

### 4.5 Tagli

In questa fase i manager possono tagliare giocatori:

```
Costo taglio = CEIL(ingaggio * durata / 2)
```

- Giocatori ESTERO: costo taglio = 0
- Giocatori RETROCESSO: costo taglio = 0

### 4.6 Consolidamento Premi

Quando l'admin consolida:
- Le finanze dei manager si aggiornano
- Tutti i manager vedono la situazione aggiornata
- Il consolidamento e **irreversibile**
- L'admin ha interfaccia per correzioni successive (vedi futura Bibbia ADMIN-CORREZIONI)

### 4.7 Impatto Finanziario

```
Budget += premi_standard + premi_variabili + indennizzi - costi_tagli
```

---

## 5. FASE 3 - RINNOVO CONTRATTI E CONSOLIDAMENTO

### 5.1 Descrizione

I manager decidono come gestire i contratti dei propri giocatori. Al consolidamento, il monte ingaggi viene ricalcolato.

### 5.2 Operazioni Disponibili

| Operazione | Effetto Budget | Effetto Monte Ingaggi |
|------------|---------------|----------------------|
| Rinnovo (aumento ingaggio) | Invariato | Aumenta |
| Rinnovo (aumento durata) | Invariato | Invariato (fino a prossimo decremento) |
| Spalma | Invariato | Varia |
| Taglio | -= costo taglio | Diminuisce |
| Nessuna azione | Invariato | Invariato |

### 5.3 Regola Fondamentale

> **Il rinnovo aumenta il monte ingaggi, NON decrementa il budget.**

Questo e il punto piu importante dell'intero sistema contrattuale.

### 5.4 Consolidamento

- L'admin consolida i rinnovi
- Il monte ingaggi viene **ricalcolato completamente** con tutti i contratti attuali
- Il bilancio = Budget - Monte Ingaggi (ricalcolo completo)
- Da questo punto il bilancio e il riferimento per le fasi successive (rubata, svincolati)
- **Irreversibile** (con possibilita di correzione admin)

---

## 6. FASE 4 - ASTA RUBATA

Vedi **Bibbia RUBATA.md** per la documentazione completa.

Punti chiave:
- L'admin definisce l'ordine rubata
- I giocatori di ogni manager vengono esposti al tabellone
- Qualsiasi manager puo dichiarare di voler "rubare" un giocatore altrui
- Il bilancio segue il modello offerta + ingaggio (vedi Bibbia FINANZE.md sezione 3)

---

## 7. FASE 5 - ASTA SVINCOLATI

Vedi **Bibbia SVINCOLATI.md** per la documentazione completa.

Punti chiave:
- Ordine chiamata inverso a rubata
- Contratto default come nel primo mercato
- Manager puo rinunciare al turno (definitivo)
- Fine: admin, niente svincolati, o nessun budget minimo

---

## 8. FASE 6 - OFFERTE E SCAMBI LIBERI (POST-SVINCOLATI)

**Identica alla Fase 1.** Stesse regole, stesso flusso.

Precisazione: i giocatori appena acquistati (svincolati) **possono essere scambiati subito**.

---

## 9. FASE 7 - FINE MERCATO

### 9.1 Chiusura

- Solo l'admin dichiara la chiusura
- **Blocco di tutte le operazioni**

### 9.2 Cosa NON Succede

- La durata dei contratti **NON varia** a fine mercato
- Il decremento avverra all'apertura del **prossimo** mercato ricorrente

### 9.3 Stato Post-Mercato

Dopo la chiusura, la lega e in stato "idle" fino all'avvio del prossimo mercato ricorrente.

---

## 10. RIEPILOGO FLUSSO FINANZIARIO

```
Bilancio iniziale (da fine primo mercato o mercato precedente)
  ↓
APERTURA: decremento durata, svincoli, ricalcolo clausole
  ↓
FASE 1: bilancio +/- scambi economici (monte ingaggi non ricalcolato)
  ↓
FASE 2: bilancio + premi + indennizzi - tagli
  ↓
FASE 3: CONSOLIDAMENTO → bilancio = budget - monte_ingaggi (ricalcolo completo)
  ↓
FASE 4: bilancio incrementale rubata (offerta + ingaggio, vedi FINANZE.md)
  ↓
FASE 5: bilancio -= costo_asta + ingaggio (vedi FINANZE.md)
  ↓
FASE 6: bilancio +/- scambi economici
  ↓
FASE 7: blocco operazioni, bilancio finale
```

---

## CHANGELOG

| Data | Modifica |
|------|----------|
| 2026-02-06 | Creazione documento con overview 7 fasi, dettaglio fasi 1/2/3/6/7, rimandi a Bibbie dedicate |
