# BIBBIA: Registrazione e Creazione Lega

> Fonte di verita per il flusso di registrazione utente e creazione/gestione lega.
> Ultima revisione: 2026-02-06

---

## 1. REGISTRAZIONE UTENTE

### 1.1 Metodi di Registrazione (MVP)

| Metodo | Stato |
|--------|-------|
| Email + Password | Attivo |
| Google (Gmail) | MVP |
| Facebook | MVP |
| Altro (Apple, etc.) | Nice to have |

### 1.2 Login

L'utente fa login con le stesse credenziali di registrazione.

---

## 2. CREAZIONE LEGA

### 2.1 Chi Puo Creare

Qualsiasi utente registrato puo creare una o piu leghe di cui e admin.

### 2.2 Parametri di Creazione

| Parametro | Tipo | Default | Note |
|-----------|------|---------|------|
| Nome lega | Stringa | - | Obbligatorio |
| Tipo lega | Pubblica/Privata | Privata | Nice to have |
| Budget iniziale | Intero | 500 | Configurabile dall'admin |
| Slot Portieri | Intero | 3 | Configurabile |
| Slot Difensori | Intero | 8 | Configurabile |
| Slot Centrocampisti | Intero | 8 | Configurabile |
| Slot Attaccanti | Intero | 6 | Configurabile |
| Lista email inviti | Array | [] | Inviti automatici alla creazione |

### 2.3 Slot Ruoli

- Default: 3P + 8D + 8C + 6A = 25 giocatori per manager
- Configurabili dall'admin alla creazione
- Servono **solo per la prima asta** (primo mercato assoluto)
- Nei mercati successivi non ci sono vincoli di slot ruoli

### 2.4 Lega Pubblica vs Privata (Nice to Have)

| Aspetto | Pubblica | Privata |
|---------|----------|---------|
| Ricercabile | Si | No |
| Statistiche visibili a non-partecipanti | Si | No |
| Richiesta di partecipazione | Si (utente puo chiedere) | No (solo su invito admin) |
| Invito admin | Si | Si |

---

## 3. INVITI E PARTECIPAZIONE

### 3.1 Inviti dall'Admin

- L'admin puo inviare inviti via email in qualsiasi momento (prima dell'avvio o del raggiungimento del numero massimo)
- Se l'email non corrisponde a un utente registrato, l'invito include anche un invito a iscriversi alla piattaforma
- **Non ci sono vincoli**: l'admin e libero di fare inviti indipendentemente da accettazioni o rifiuti precedenti

### 3.2 Ricezione Invito

Il manager invitato riceve notifica via **email** e **nell'app**:
- Accetta → entra nella lega
- Rifiuta → non entra nella lega

### 3.3 Richiesta di Partecipazione (Solo Lega Pubblica)

Un utente dalla dashboard puo:
- Cercare una lega per **nome lega** o **nome partecipanti**
- Chiedere di partecipare a una lega pubblica
- L'admin approva o respinge la richiesta

### 3.4 Vincoli

- Se la lega e **avviata**: non e possibile richiedere accesso
- Se la lega e **piena** (numero massimo manager): non e possibile richiedere accesso

---

## 4. NUMERO MANAGER

### 4.1 Regole

| Regola | Valore |
|--------|--------|
| Minimo | 6 |
| Massimo | 20 |
| Parita | Sempre pari (6, 8, 10, 12, 14, 16, 18, 20) |

### 4.2 Abbandono

Un manager **non puo abbandonare** la lega dopo l'avvio.

---

## 5. RUOLO ADMIN

### 5.1 Stato Attuale

L'admin e **sempre anche partecipante** (ha squadra, budget, partecipa alle aste).

### 5.2 Admin Solo Admin (Nice to Have - Backlog)

In futuro: possibilita che l'admin gestisca le fasi senza essere partecipante (no squadra, no budget).

---

## 6. AVVIO LEGA

### 6.1 Precondizioni

- Numero minimo di manager raggiunto (6)
- Numero manager pari

### 6.2 Cosa Succede

1. L'admin avvia la lega
2. Si passa a **Primo Mercato pronto ad iniziare**
3. L'admin dovra poi avviare l'asta del primo mercato (azione separata)

---

## 7. PARTECIPAZIONE MULTIPLA

Un utente puo:
- Creare **una o piu** leghe (di cui e admin)
- Partecipare a **una o piu** leghe
- Essere admin di una lega e partecipante di un'altra

---

## CHANGELOG

| Data | Modifica |
|------|----------|
| 2026-02-06 | Creazione documento con flusso registrazione, creazione lega, inviti, numero manager, avvio |
