# Documentazione Funzionale - FANTACONTRATTI

## Indice

1. [Panoramica della Piattaforma](#panoramica-della-piattaforma)
2. [Ruoli Utente](#ruoli-utente)
3. [Gestione Lega](#gestione-lega)
4. [Sistema di Mercato](#sistema-di-mercato)
5. [Gestione Contratti](#gestione-contratti)
6. [Sistema Scambi](#sistema-scambi)
7. [Premi e Profezie](#premi-e-profezie)
8. [Notifiche e Inviti](#notifiche-e-inviti)
9. [Flussi Operativi](#flussi-operativi)

---

## Panoramica della Piattaforma

FANTACONTRATTI e una piattaforma web per la gestione di leghe di fantacalcio in formato **dynasty** (o dinastico). A differenza del fantacalcio tradizionale dove le rose vengono azerate ogni anno, nel formato dynasty i giocatori vengono mantenuti attraverso un sistema di **contratti** con durata variabile.

### Caratteristiche Distintive

- **Contratti a durata**: Ogni giocatore ha un contratto con ingaggio e durata (1-4 semestri)
- **Clausola rescissoria**: Ogni contratto ha una clausola che determina il costo per "rubare" il giocatore
- **Mercato strutturato**: Fasi di mercato definite con regole specifiche
- **Profezie**: I manager possono lasciare commenti/profezie sugli acquisti
- **Real-time**: Aste sincronizzate in tempo reale tra tutti i partecipanti

---

## Ruoli Utente

### SuperAdmin (Amministratore Piattaforma)

Il SuperAdmin gestisce la piattaforma a livello globale. Non partecipa alle leghe.

**Responsabilita:**
- Importazione quotazioni ufficiali da file Excel
- Gestione lista giocatori Serie A
- Visualizzazione di tutte le leghe e utenti
- Assegnazione/revoca privilegi SuperAdmin ad altri utenti

**Accesso:**
- Pannello dedicato `/superadmin`
- Non visualizza leghe in dashboard (redirect automatico a pannello)

---

### Admin Lega (Presidente)

Ogni lega ha almeno un Admin (tipicamente il creatore). L'Admin gestisce la lega e le fasi di mercato.

**Responsabilita:**
- Configurazione lega (nome, partecipanti, budget, slot rosa)
- Approvazione/rifiuto richieste di partecipazione
- Invito membri tramite email
- Avvio della lega
- Gestione sessioni di mercato
- Controllo fasi di mercato
- Gestione ordine turni (rubata, svincolati)
- Risoluzione ricorsi
- Assegnazione premi

**Privilegi esclusivi:**
- Avviare/chiudere sessioni di mercato
- Cambiare fase di mercato
- Impostare timer aste
- Forzare conferme/ready check (per test o blocchi)
- Visualizzare audit log

---

### Manager (Direttore Generale - DG)

I Manager sono i partecipanti standard della lega. Ogni Manager gestisce una squadra.

**Responsabilita:**
- Gestione della propria rosa
- Partecipazione alle aste
- Gestione contratti (rinnovi, tagli)
- Proposte di scambio
- Impostazione strategie rubata
- Scrittura profezie

**Capacita:**
- Nominare giocatori (durante il proprio turno)
- Fare offerte alle aste
- Accettare/rifiutare/controproporre scambi
- Rinnovare o svincolare giocatori
- Visualizzare rose avversarie (solo giocatori, non dettagli contratto)

---

## Gestione Lega

### Creazione Lega

1. L'utente accede alla dashboard
2. Clicca "Crea Nuova Lega"
3. Compila il form:
   - **Nome lega**: Identificativo univoco
   - **Descrizione**: Opzionale
   - **Partecipanti**: Min 6, Max 20, numero pari richiesto
   - **Budget iniziale**: Default 500
   - **Slot rosa**:
     - Portieri: Default 3
     - Difensori: Default 8
     - Centrocampisti: Default 8
     - Attaccanti: Default 6
4. Viene generato un **codice invito** univoco
5. Il creatore diventa automaticamente Admin

### Stati della Lega

| Stato | Descrizione |
|-------|-------------|
| **DRAFT** | Lega in preparazione, si accettano membri |
| **ACTIVE** | Lega avviata, mercati e stagione in corso |
| **ARCHIVED** | Lega conclusa/archiviata |

### Partecipazione alla Lega

**Tramite codice invito:**
1. L'utente ottiene il codice dalla pagina lega o condivisione Admin
2. Inserisce il codice nella ricerca leghe
3. Visualizza info lega e richiede partecipazione
4. L'Admin approva/rifiuta la richiesta
5. Se approvato, diventa membro ACTIVE

**Tramite invito email:**
1. L'Admin inserisce l'email dell'invitato
2. Il sistema invia email con link univoco
3. L'invitato clicca il link e accetta
4. Viene aggiunto automaticamente come membro ACTIVE

### Avvio della Lega

Requisiti per l'avvio:
- Almeno `minParticipants` membri attivi
- Se `requireEvenNumber` = true, numero pari di membri
- Solo l'Admin puo avviare

Cosa succede all'avvio:
1. Stato lega passa a ACTIVE
2. Budget iniziale assegnato a tutti i membri
3. Viene creata la prima sessione di mercato (PRIMO_MERCATO)

---

## Sistema di Mercato

### Tipi di Sessione

| Tipo | Descrizione |
|------|-------------|
| **PRIMO_MERCATO** | Prima asta assoluta per formare le rose |
| **MERCATO_RICORRENTE** | Mercati successivi (semestrali) |

### Fasi del Mercato Ricorrente

```
OFFERTE_PRE_RINNOVO
        ↓
      PREMI
        ↓
    CONTRATTI
        ↓
      RUBATA
        ↓
  ASTA_SVINCOLATI
        ↓
OFFERTE_POST_ASTA_SVINCOLATI
```

---

### Fase 1: Primo Mercato (ASTA_LIBERA)

Asta iniziale per formare le rose. Tutti partono da zero.

**Flusso:**
1. Admin imposta ordine turni dei manager
2. Admin seleziona ruolo da riempire (P, D, C, A)
3. Manager di turno nomina un giocatore
4. Conferma la nomination (puo annullare prima)
5. Tutti i manager devono segnare "SONO PRONTO"
6. Parte l'asta con timer (default 30 secondi)
7. I manager fanno offerte (rilanci di +1)
8. Timer si resetta ad ogni offerta
9. Allo scadere, Admin chiude l'asta
10. Vincitore assegna contratto al giocatore
11. Tutti confermano visione (con profezia opzionale)
12. Si passa al prossimo turno

**Gestione turni:**
- Ordine turni impostato dall'Admin
- Turno ciclico tra tutti i manager
- Si cambia ruolo quando tutti hanno riempito gli slot

---

### Fase 2: Offerte Pre-Rinnovo

Periodo per proposte di scambio tra manager prima del rinnovo contratti.

**Funzionalita:**
- Creazione proposte di scambio
- Scambio giocatori + budget
- Controproposte
- Scadenza automatica offerte (default 24h)

---

### Fase 3: Premi

L'Admin assegna premi budget ai manager.

**Struttura:**
- **Re-incremento base**: Importo fisso uguale per tutti
- **Categorie premio**: Create dall'Admin (es. "Classifica Portieri", "Miglior Difesa")
- **Indennizzo partenza estero**: Premio automatico per giocatori usciti dalla Serie A

**Flusso:**
1. Admin configura re-incremento base
2. Admin crea categorie premio
3. Admin assegna importi ai manager per categoria
4. Admin finalizza e i budget vengono aggiornati

---

### Fase 4: Contratti

I manager rinnovano i contratti esistenti o tagliano giocatori.

**Regole rinnovo:**
- Durata minima: 1 semestre
- Durata massima: 4 semestri
- Ingaggio minimo: clausola rescissoria attuale
- Ingaggio massimo: iniziale + 50% * numero rinnovi

**Flusso:**
1. Manager visualizza contratti in scadenza
2. Per ogni giocatore sceglie:
   - **Rinnova**: Imposta nuovo ingaggio e durata
   - **Taglia**: Giocatore diventa svincolato
   - **Lascia scadere**: Automaticamente svincolato
3. Salva bozze delle modifiche
4. Conferma consolidamento finale
5. Admin attende che tutti consolidino

**Decremento automatico:**
- All'inizio di ogni mercato ricorrente, tutti i contratti perdono 1 semestre di durata

---

### Fase 5: Rubata

Fase dove i manager possono "rubare" giocatori dagli avversari pagando la clausola rescissoria.

**Preparazione:**
1. Admin imposta ordine rubata
2. Sistema genera "tabellone" ordinato:
   - Giocatori ordinati per clausola rescissoria (dalla piu alta)
   - Raggruppati per manager secondo l'ordine rubata

**Flusso asta:**
1. Admin avvia rubata
2. Si visualizza il primo giocatore nel tabellone
3. Timer parte (default 30 secondi)
4. Qualsiasi manager (tranne il proprietario) puo fare offerta
5. Se arriva offerta: inizia asta con timer ridotto (15 secondi)
6. Rilanci successivi resettano il timer
7. Allo scadere, Admin chiude l'asta
8. Se c'e vincitore: giocatore trasferito, prezzo pagato
9. Se nessuna offerta: giocatore resta al proprietario
10. Tutti confermano visione
11. Si passa al prossimo giocatore

**Strategie Rubata:**
- I manager possono impostare preferenze prima della rubata:
  - **Watchlist**: Giocatori di interesse
  - **Auto-pass**: Giocatori da ignorare
  - **Budget max**: Limite offerta per giocatore
  - **Priorita**: Ordine di interesse

---

### Fase 6: Asta Svincolati

Asta a turni per acquistare giocatori liberi (svincolati o mai acquisiti).

**Caratteristiche:**
- Ordine turni impostato dall'Admin
- Manager di turno nomina uno svincolato
- Parte asta come nel primo mercato
- Manager puo "passare" il turno
- Manager puo dichiarare "ho finito" (esce dalla rotazione)
- Fase termina quando tutti hanno finito o passato

**Flusso:**
1. Admin imposta ordine turni
2. Manager di turno:
   - Nomina giocatore svincolato, oppure
   - Passa il turno (puo tornare dopo), oppure
   - Dichiara "Ho finito" (esce definitivamente)
3. Se nomination: asta standard
4. Contratto assegnato al vincitore
5. Turno passa al prossimo

---

### Fase 7: Offerte Post-Asta Svincolati

Ultima fase per scambi tra manager prima della chiusura del mercato.

Identica alla fase "Offerte Pre-Rinnovo".

---

## Gestione Contratti

### Struttura Contratto

| Campo | Descrizione |
|-------|-------------|
| **Ingaggio (salary)** | Costo semestrale del giocatore |
| **Durata (duration)** | Semestri rimanenti (1-4) |
| **Clausola rescissoria** | Ingaggio x moltiplicatore (calcolo interno) |
| **Ingaggio iniziale** | Per validazione rinnovi |
| **Durata iniziale** | Per validazione rinnovi |

### Assegnazione Contratto

Dopo aver vinto un'asta:
1. Manager sceglie ingaggio (minimo 1)
2. Manager sceglie durata (1-4 semestri)
3. Sistema calcola clausola rescissoria
4. Contratto salvato

### Rinnovo Contratto

Durante la fase CONTRATTI:
1. Nuovo ingaggio >= clausola attuale
2. Nuovo ingaggio <= iniziale + 50% * rinnovi precedenti
3. Nuova durata 1-4 semestri
4. Aggiornamento clausola

### Svincolo/Taglio

Durante la fase CONTRATTI:
- Manager marca giocatore per il taglio
- Al consolidamento: giocatore diventa svincolato
- Giocatore tornera disponibile nella fase ASTA_SVINCOLATI

### Scadenza Naturale

Se un contratto arriva a durata 0:
- Giocatore automaticamente svincolato
- Nessun costo per il manager

---

## Sistema Scambi

### Creazione Proposta

Il sender puo proporre:
- **Giocatori offerti**: Dalla propria rosa
- **Budget offerto**: Importo in crediti
- **Giocatori richiesti**: Dalla rosa del destinatario
- **Budget richiesto**: Importo in crediti
- **Messaggio**: Nota opzionale

### Stati della Proposta

| Stato | Descrizione |
|-------|-------------|
| **PENDING** | In attesa di risposta |
| **ACCEPTED** | Accettata, scambio eseguito |
| **REJECTED** | Rifiutata |
| **COUNTERED** | Controproposta creata |
| **CANCELLED** | Annullata dal sender |
| **EXPIRED** | Scaduta (default 24h) |

### Controproposta

Il receiver puo creare una controproposta:
- Modifica giocatori/budget offerti
- Modifica giocatori/budget richiesti
- Proposta originale passa a COUNTERED
- Nuova proposta collegata come "figlia"

### Esecuzione Scambio

Quando accettato:
1. Giocatori trasferiti tra le rose
2. Budget aggiornati
3. Contratti mantenuti con lo stesso stato
4. Movimenti registrati nello storico

### Vincolo Anti-Retrocessione

Una volta che un giocatore e coinvolto in uno scambio accettato, non puo essere ri-scambiato nella stessa sessione di mercato tra gli stessi manager.

---

## Premi e Profezie

### Sistema Premi

**Tipologie:**
1. **Re-incremento base**: Uguale per tutti
2. **Premi categoria**: Definiti dall'Admin
3. **Indennizzo partenza**: Automatico per giocatori usciti

**Flusso assegnazione:**
1. Admin entra nella fase PREMI
2. Imposta re-incremento base
3. Crea categorie (es. "1° Classifica", "Miglior Difesa")
4. Assegna importi ai manager per categoria
5. Finalizza: budget aggiornati

### Sistema Profezie

Dopo ogni asta conclusa, i manager possono lasciare una "profezia" sul nuovo acquisto.

**Caratteristiche:**
- Testo libero
- Associata al movimento (acquisto)
- Visibile nello storico
- Puo essere inserita sia dal venditore che dall'acquirente

**Esempio:**
> "Vedremo se questo giovane talento sara all'altezza delle aspettative..."

---

## Notifiche e Inviti

### Inviti Email

**Flusso:**
1. Admin inserisce email invitato
2. Sistema genera token univoco con scadenza
3. Email inviata con link tipo: `/invite/{token}`
4. Invitato clicca link e accede
5. Se non registrato: redirect a registrazione, poi ritorno
6. Accetta o rifiuta invito
7. Se accetta: aggiunto come membro ACTIVE

**Configurazione email:**
- Gmail: richiede App Password
- Resend: API key

### Richieste Partecipazione

**Flusso:**
1. Utente trova lega (ricerca o codice)
2. Richiede partecipazione (con nome squadra opzionale)
3. Admin visualizza richiesta in "Richieste Pendenti"
4. Admin approva o rifiuta
5. Utente vede stato in dashboard

---

## Flussi Operativi

### Flusso Completo Prima Stagione

```
1. Creazione Lega (Admin)
   └── Configurazione parametri

2. Raccolta Membri
   ├── Inviti email
   └── Richieste spontanee → Approvazione

3. Avvio Lega (Admin)
   └── Creazione sessione PRIMO_MERCATO

4. Primo Mercato
   ├── Impostazione ordine turni
   ├── Asta per ruolo (P, D, C, A)
   │   ├── Nomination
   │   ├── Ready check
   │   ├── Asta con timer
   │   ├── Assegnazione contratto
   │   └── Conferme + Profezie
   └── Completamento rose

5. Fine Prima Stagione
   └── Lega pronta per mercati ricorrenti
```

### Flusso Mercato Ricorrente

```
1. Creazione Sessione (Admin)
   └── Decremento automatico contratti

2. OFFERTE_PRE_RINNOVO
   └── Scambi tra manager

3. PREMI
   ├── Re-incremento base
   ├── Premi categoria
   └── Indennizzi

4. CONTRATTI
   ├── Rinnovi/Tagli
   └── Consolidamento

5. RUBATA
   ├── Generazione tabellone
   ├── Aste su giocatori avversari
   └── Trasferimenti

6. ASTA_SVINCOLATI
   ├── Turni nomination
   ├── Aste giocatori liberi
   └── Assegnazione contratti

7. OFFERTE_POST_ASTA
   └── Ultimi scambi

8. Chiusura Sessione
   └── Pronto per prossimo semestre
```

### Flusso Ricorsi

```
1. Asta conclusa con contestazione
2. Manager presenta ricorso (testo motivazione)
3. Asta passa a stato APPEAL_REVIEW
4. Admin visualizza ricorso
5. Admin decide:
   ├── ACCEPTED: Asta riaperta
   │   ├── Tutti confermano decisione
   │   ├── Ready check
   │   └── Asta riprende
   └── REJECTED: Esito confermato
       ├── Tutti confermano decisione
       └── Si procede
```

---

## Appendice: Glossario

| Termine | Definizione |
|---------|-------------|
| **DG** | Direttore Generale, ovvero Manager |
| **Rosa** | Insieme di giocatori di un manager |
| **Slot** | Posizione disponibile in rosa per ruolo |
| **Clausola** | Clausola rescissoria del contratto |
| **Rubata** | Fase dove si possono acquistare giocatori avversari |
| **Svincolato** | Giocatore senza contratto, libero di essere acquisito |
| **Consolidamento** | Conferma definitiva delle modifiche ai contratti |
| **Nomination** | Proposta di un giocatore per l'asta |
| **Ready Check** | Verifica che tutti i manager siano pronti |
| **Profezia** | Commento lasciato dopo un acquisto |
