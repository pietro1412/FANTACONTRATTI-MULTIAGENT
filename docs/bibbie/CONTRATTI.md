# BIBBIA: Contratti e Budget

> Fonte di verita per le regole dei contratti, il calcolo del budget e del bilancio.
> Ultima revisione: 2026-02-06

---

## 1. STRUTTURA DI UN CONTRATTO

Ogni giocatore sotto contratto ha:

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `salary` (ingaggio) | Intero, >= 1 | Costo annuale del giocatore |
| `duration` (durata) | Intero, 1-4 | Semestri rimanenti |
| `rescissionClause` (clausola) | Intero, calcolato | salary * moltiplicatore(duration) |
| `initialSalary` | Intero | Ingaggio al momento della creazione. MAI modificato. |

### 1.1 Notazione

Un contratto si esprime come **ingaggio x durata**. Esempio: `4x4` = ingaggio 4, durata 4 semestri.

---

## 2. CLAUSOLA RESCISSORIA

### 2.1 Moltiplicatori

| Durata (semestri) | Moltiplicatore |
|-------------------|---------------|
| 4 | 11 |
| 3 | 9 |
| 2 | 7 |
| 1 | 3 |

### 2.2 Formula

```
clausola = ingaggio * moltiplicatore(durata)
```

### 2.3 Tabella Esempi

| Contratto | Clausola | Prezzo Rubata (clausola + ingaggio) |
|-----------|----------|-------------------------------------|
| 4x4 | 44 | 48 |
| 4x3 | 36 | 40 |
| 4x2 | 28 | 32 |
| 4x1 | 12 | 16 |
| 10x4 | 110 | 120 |
| 10x3 | 90 | 100 |
| 20x4 | 220 | 240 |

---

## 3. CONTRATTO DEFAULT

Quando un giocatore viene acquistato tramite asta (primo mercato, svincolati), riceve un contratto default.

### 3.1 Formula Ingaggio Default

```
ingaggio_default = Math.max(1, Math.round(costo_asta / 10))
```

Arrotondamento standard (half-up): 0.5 arrotonda verso l'alto.

### 3.2 Tabella Fasce

| Costo Asta | Ingaggio Default |
|------------|-----------------|
| 1 - 4 | 1 |
| 5 - 14 | 1 |
| 15 - 24 | 2 |
| 25 - 34 | 3 |
| 35 - 44 | 4 |
| 45 - 54 | 5 |
| 55 - 64 | 6 |
| 65 - 74 | 7 |
| 75 - 84 | 8 |
| 85 - 94 | 9 |
| 95 - 104 | 10 |

### 3.3 Durata Default

**Sempre 3 semestri**, indipendentemente dal costo d'asta o dal tipo di acquisto.

### 3.4 Verifica Budget

Per poter fare un'offerta in asta, il manager deve avere bilancio sufficiente per il costo totale:

```
bilancio_richiesto >= prezzo_offerta + ingaggio_default
```

**Esempio:** Per offrire 75 per Esposito (ingaggio default 8), serve bilancio >= 83.

---

## 4. MODIFICA CONTRATTO POST-ACQUISTO

Dopo ogni acquisto (primo mercato, rubata, svincolati), il manager puo modificare il contratto.

### 4.1 Regole di Modifica

| Regola | Dettaglio |
|--------|-----------|
| Ingaggio | Puo solo **AUMENTARE** (no diminuzione) |
| Durata | Puo solo **AUMENTARE** (no diminuzione) |
| Durata massima | 4 semestri |
| Aumento durata | Richiede **PRIMA** un aumento di ingaggio |
| Spalma | **NON disponibile** post-acquisto |
| Taglio | **NON disponibile** post-acquisto |

### 4.2 Impatto sul Bilancio

Il costo totale dell'operazione e:

```
costo_totale = prezzo_asta + ingaggio_effettivo
```

Dove `ingaggio_effettivo` e l'ingaggio dopo eventuale modifica.

**Esempi:**
```
Compro a 75, lascio default (8x3):   costo = 75 + 8 = 83
Compro a 75, modifico a 9x3:         costo = 75 + 9 = 84
Compro a 75, modifico a 9x4:         costo = 75 + 9 = 84
Compro a 75, modifico a 12x4:        costo = 75 + 12 = 87
```

**NOTA:** La durata NON impatta il costo immediato. L'ingaggio e il costo semestrale.

---

## 5. OPERAZIONI SUI CONTRATTI

### 5.1 Rinnovo

- Aumenta l'ingaggio e/o la durata
- Impatta il monte ingaggi (aumenta)
- **NON decrementa il budget** - regola FONDAMENTALE
- Clausola ricalcolata con nuovi valori

### 5.2 Taglio

```
costo_taglio = CEIL(ingaggio * durata / 2)
```

- Arrotondamento per eccesso (Math.ceil)
- Il costo viene scalato dal budget
- Il giocatore diventa svincolato
- Il monte ingaggi diminuisce

**Eccezioni:**
- Giocatori ESTERO: costo taglio = 0
- Giocatori RETROCESSO: costo taglio = 0

### 5.3 Spalma

- Redistribuisce il peso del contratto nel tempo
- Disponibile solo in fase rinnovo (NON post-acquisto)

### 5.4 Scadenza Naturale

- All'apertura del mercato ricorrente, la durata decrementa di 1
- Se durata arriva a 0: giocatore si svincola automaticamente
- L'evento deve essere tracciato e visibile al manager

---

## 6. DECREMENTO DURATA

### 6.1 Quando Avviene

Il decremento della durata avviene **all'apertura del mercato ricorrente**, NON alla fine.

### 6.2 Cosa Succede

1. Tutti i contratti attivi: `durata -= 1`
2. Ricalcolo clausole rescissorie con nuove durate
3. Contratti con durata 0: giocatore diventa svincolato (tracciare)
4. Giocatori ESTERO o RETROCESSO: gestiti separatamente (vedi Bibbia GIOCATORI)
5. La situazione contrattuale deve essere chiara ad ogni manager

---

## 7. BUDGET E BILANCIO

### 7.1 Definizioni

| Termine | Formula | Dove |
|---------|---------|------|
| Budget | `currentBudget` (DB) | LeagueMember.currentBudget |
| Monte Ingaggi | Somma ingaggi contratti attivi | Calcolato on-the-fly |
| Bilancio | Budget - Monte Ingaggi | Calcolato on-the-fly (frontend) |

### 7.2 Quando Cambia il Budget

| Operazione | Effetto |
|------------|---------|
| Acquisto (primo mercato) | Budget -= prezzo asta |
| Acquisto (svincolati) | Budget -= prezzo asta |
| Rubata (acquirente) | Budget -= OFFERTA (clausola + rilanci, NON ingaggio) |
| Rubata (venditore) | Budget += OFFERTA |
| Scambio tra manager | Budget +/- importo concordato |
| Premio ricevuto | Budget += importo |
| Indennizzo ESTERO | Budget += importo |
| Taglio giocatore | Budget -= ceil(salary * duration / 2) |
| Taglio ESTERO/RETROCESSO | Budget invariato |
| Aumento ingaggio | Budget invariato |
| Rinnovo/Spalma | Budget invariato |

### 7.3 Bilancio nella Rubata

Vedi **Bibbia FINANZE.md** sezione 3 per il modello completo di scomposizione offerta + ingaggio.

---

## 8. CAMPO initialSalary

Il campo `initialSalary` registra l'ingaggio al momento della creazione del contratto.

**Regola:** MAI modificato dopo la creazione, indipendentemente da rinnovi o aumenti successivi.

Serve per:
- Storico del contratto
- Calcoli retroattivi
- Audit delle operazioni

---

## 9. TRASFERIMENTO CONTRATTO

### 9.1 Nella Rubata

La rubata **TRASFERISCE** il record `PlayerContract` e `PlayerRoster` esistente. NON elimina e ricrea.

- `salary`, `duration`, `rescissionClause`, `initialSalary` restano invariati
- Solo `leagueMemberId` cambia (dal venditore al vincitore)
- Il vincitore puo poi modificare il contratto (increase-only)

### 9.2 Negli Scambi (Fase 1/6)

Il contratto viene trasferito come nella rubata. NON incide sul bilancio corrente: l'impatto si vedra al prossimo consolidamento.

---

## CHANGELOG

| Data | Modifica |
|------|----------|
| 2026-02-03 | Creazione documento originale (solo Budget/Bilancio) |
| 2026-02-06 | Riscrittura completa: aggiunto regole contratto, formula default, modifica post-acquisto, decremento durata, trasferimento contratto, allineamento con modello FINANZE |
