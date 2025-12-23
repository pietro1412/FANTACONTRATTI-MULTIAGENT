# Sprint 3 Brief - Contratti e Rinnovi

**Data:** Dicembre 2025
**Dipendenze:** Sprint 2 completato

---

## OBIETTIVO SPRINT

Implementare il sistema completo di gestione contratti: visualizzazione, rinnovo e svincolo giocatori. Al termine di questo sprint, i manager potranno gestire i contratti dei loro giocatori con tutte le regole di business definite.

---

## REGOLE BUSINESS CONTRATTI

### Parametri Contratto

| Parametro | Descrizione | Vincoli |
|-----------|-------------|---------|
| **Salary** | Ingaggio annuale | Min 1 credito |
| **Duration** | Durata in semestri | 1-4 semestri (max 2 anni) |
| **Rescission Clause** | Clausola rescissoria | salary × multiplier |

### Moltiplicatori Clausola Rescissoria

| Durata Contratto | Moltiplicatore |
|------------------|----------------|
| 1 semestre | 1.5× |
| 2 semestri (1 anno) | 2× |
| 3 semestri | 2.5× |
| 4 semestri (2 anni) | 3× |

### Regole Rinnovo

1. **Aumento massimo salary:** +50% rispetto al contratto precedente
2. **Durata massima totale:** 4 semestri
3. **Non può rinnovare:** se già al massimo della durata
4. **Costo rinnovo:** differenza salary × nuova durata

### Regole Svincolo

1. **Costo svincolo:** clausola rescissoria completa
2. **Giocatore torna:** agli svincolati (disponibile per aste future)
3. **Budget restituito:** nessuno (hai pagato la clausola)
4. **Contratto eliminato:** giocatore rimosso dalla rosa

---

## API ENDPOINTS

```
# Contracts
GET    /api/leagues/:id/contracts           - Lista contratti mia rosa
GET    /api/leagues/:id/contracts/:contractId - Dettaglio contratto

# Renewal
POST   /api/contracts/:id/renew             - Rinnova contratto
       Body: { newSalary: number, newDuration: number }

# Release
POST   /api/contracts/:id/release           - Svincola giocatore
```

---

## FLUSSO UTENTE

### Scenario 1: Visualizza Contratti
1. Manager va alla sua rosa
2. Clicca su un giocatore
3. Vede dettagli contratto: salary, durata residua, clausola
4. Vede opzioni: Rinnova / Svincola

### Scenario 2: Rinnovo Contratto
1. Manager clicca "Rinnova" su un giocatore
2. Sistema mostra: salary attuale, durata residua, max nuovo salary
3. Manager inserisce: nuovo salary, nuova durata
4. Sistema calcola: costo rinnovo, nuova clausola
5. Manager conferma
6. Budget scalato, contratto aggiornato

### Scenario 3: Svincolo Giocatore
1. Manager clicca "Svincola" su un giocatore
2. Sistema mostra: clausola da pagare
3. Manager conferma
4. Budget scalato, giocatore rimosso dalla rosa
5. Giocatore torna disponibile per aste

---

## CALCOLI

### Costo Rinnovo
```
costoRinnovo = (newSalary - currentSalary) × newDuration
```
Se newSalary > currentSalary, paga la differenza per tutti i semestri.
Se newSalary <= currentSalary, costo = 0 (non si paga per abbassare).

### Nuova Clausola Rescissoria
```
multiplier = getMultiplier(newDuration)
newClause = newSalary × multiplier
```

### Esempio Pratico
- Contratto attuale: salary=10, duration=2, clausola=20
- Rinnovo: newSalary=12, newDuration=4
- Costo: (12-10) × 4 = 8 crediti
- Nuova clausola: 12 × 3 = 36 crediti

---

## STRUTTURA FILE

```
src/
├── services/
│   └── contract.service.ts      - Business logic contratti
├── api/routes/
│   └── contracts.ts             - API routes
└── pages/
    └── ContractDetail.tsx       - Dettaglio e gestione contratto
```

---

## CHECKLIST MILESTONE 3

```
□ API lista contratti rosa
□ API dettaglio contratto
□ Logica rinnovo con validazioni
□ Logica svincolo con clausola
□ Calcolo corretto moltiplicatori
□ Frontend dettaglio contratto
□ Frontend form rinnovo
□ Frontend conferma svincolo
□ Test validazioni business rules
```
