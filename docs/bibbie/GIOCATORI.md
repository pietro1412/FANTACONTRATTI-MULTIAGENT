# BIBBIA: Giocatori Serie A

> Fonte di verita per i dati dei giocatori, fonti dati e gestione stati.
> Ultima revisione: 2026-02-06

---

## 1. FONTI DATI

### 1.1 Fantagazzetta (Master per Lista e Quotazioni)

| Dato | Fonte | Aggiornamento |
|------|-------|---------------|
| Lista giocatori Serie A | Fantagazzetta | Import manuale file quotazioni |
| Stato giocatore (in lista, svincolato) | Fantagazzetta | Import manuale |
| Quotazione | Fantagazzetta | Import manuale |
| Statistiche (gol, assist, voti, etc.) | Fantagazzetta | Import manuale (da comparare con API Football) |

**File di esempio** disponibili in: `docs/archive/` (quotazioni e statistiche Fantagazzetta)

### 1.2 API Football (Statistiche e Dati Real-Time)

| Dato | Fonte | Aggiornamento |
|------|-------|---------------|
| Statistiche dettagliate (anno in corso e passati) | API Football | Chiamate API |
| Foto giocatore | API Football | Chiamate API |
| Squadra di appartenenza | API Football | Chiamate API |
| Eta | API Football | Chiamate API |

### 1.3 Priorita in Caso di Conflitto

| Dato | Master |
|------|--------|
| Lista giocatori (chi esiste) | Fantagazzetta |
| Stato (in lista, svincolato, ceduto) | Fantagazzetta |
| Quotazione | Fantagazzetta |
| Statistiche | Da comparare (entrambe le fonti) |
| Foto, eta, squadra | API Football |

---

## 2. DATI FONDAMENTALI DI UN GIOCATORE

### 2.1 Dati Anagrafica

| Campo | Fonte | Sempre presente |
|-------|-------|-----------------|
| Nome | Fantagazzetta / API Football | Si |
| Eta | API Football | Si |
| Foto | API Football | Si (quando disponibile) |
| Squadra Serie A | Fantagazzetta / API Football | Si |
| Ruolo (P/D/C/A) | Fantagazzetta | Si |

### 2.2 Dati Contrattuali (nella Lega)

| Campo | Calcolato da | Sempre presente |
|-------|-------------|-----------------|
| Ingaggio (salary) | Sistema | Si (se sotto contratto) |
| Durata (duration) | Sistema | Si (se sotto contratto) |
| Clausola rescissoria | Sistema | Si (se sotto contratto) |
| Rosa di appartenenza | Sistema | Si (o svincolato) |

### 2.3 Statistiche

| Campo | Fonte |
|-------|-------|
| Statistiche anno in corso | API Football + Fantagazzetta |
| Statistiche anni passati | API Football |
| Voto medio | Fantagazzetta |
| Gol, assist, presenze | Entrambe le fonti |

---

## 3. STATI DI UN GIOCATORE

### 3.1 Stati Possibili

| Stato | Descrizione | Chi lo Imposta |
|-------|-------------|----------------|
| **IN_LISTA** | Giocatore attivo in Serie A | Fantagazzetta (import quotazioni) |
| **SVINCOLATO** | Senza contratto nella lega | Sistema (scadenza, taglio, mai acquistato) |
| **ESTERO** | Ceduto a squadra estera | Super Admin (vale per tutte le leghe) |
| **RETROCESSO** | Squadra retrocessa in Serie B | Super Admin (vale per tutte le leghe) |
| **RITIRATO** | Giocatore ritirato | Super Admin (vale per tutte le leghe) |

### 3.2 Transizioni di Stato

```
IN_LISTA → ESTERO       (Super Admin, post aggiornamento quotazioni)
IN_LISTA → RETROCESSO   (Super Admin, fine stagione)
IN_LISTA → RITIRATO     (Super Admin)
IN_LISTA → SVINCOLATO   (Sistema: scadenza contratto o taglio nella lega)
SVINCOLATO → IN_LISTA   (Sistema: acquistato da un manager)
```

### 3.3 Chi Gestisce gli Stati Globali

Il **Super Admin** (non l'admin di lega) imposta ESTERO, RETROCESSO, RITIRATO. Questi stati valgono per **tutte le leghe**.

L'aggiornamento avviene:
1. Import nuovo file quotazioni Fantagazzetta → il sistema rileva giocatori ceduti/assenti
2. Il Super Admin conferma e imposta lo stato specifico (ESTERO vs RETROCESSO vs RITIRATO)

---

## 4. AGGIORNAMENTO DATI

### 4.1 File Quotazioni Fantagazzetta

- Import manuale da parte del Super Admin
- Quando caricato, aggiorna la lista giocatori (nuovi arrivi, cessioni)
- I dati possono cambiare durante un mercato ricorrente aperto

### 4.2 API Football

- Chiamate API per statistiche aggiornate
- Aggiornamento squadra di appartenenza (es. calciomercato gennaio)
- Foto e dati anagrafici

### 4.3 Calciomercato Reale

Quando un giocatore cambia squadra nella realta:
1. Viene aggiornato il file quotazioni Fantagazzetta
2. Vengono chiamate API Football aggiornate
3. Il sistema riflette il nuovo stato/squadra

---

## 5. IMPATTO SULLE LEGHE

### 5.1 Giocatore che Diventa ESTERO

- In ogni lega dove e sotto contratto:
  - Deve essere rilasciato (sia `draftReleased: true` che `draftExitDecision: 'RELEASE'`)
  - Costo taglio: 0
  - Indennizzo: valore impostato dall'admin di lega (min 0)

### 5.2 Giocatore che Diventa RETROCESSO

- In ogni lega dove e sotto contratto:
  - Deve essere rilasciato
  - Costo taglio: 0
  - Indennizzo: nessuno

### 5.3 Giocatore SVINCOLATO (nella Lega)

- Disponibile per acquisto nelle aste svincolati
- Non ha contratto attivo con nessun manager della lega

---

## CHANGELOG

| Data | Modifica |
|------|----------|
| 2026-02-06 | Creazione documento con fonti dati, stati giocatore, aggiornamento, impatto leghe |
