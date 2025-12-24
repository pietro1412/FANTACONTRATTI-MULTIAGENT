# Guida Utente - Fantacontratti

## Indice

1. [Introduzione](#introduzione)
2. [Primi Passi](#primi-passi)
3. [Dashboard](#dashboard)
4. [Gestione Leghe](#gestione-leghe)
5. [Il Mercato](#il-mercato)
6. [Rose e Contratti](#rose-e-contratti)
7. [Scambi](#scambi)
8. [Rubata](#rubata)
9. [Svincolati](#svincolati)
10. [Storico Movimenti e Profezie](#storico-movimenti-e-profezie)
11. [Pannello Admin di Lega](#pannello-admin-di-lega)
12. [Pannello Super Admin](#pannello-super-admin)
13. [Glossario](#glossario)

---

## Introduzione

**Fantacontratti** e' una piattaforma web per la gestione di leghe fantacalcio "dinastiche", dove le squadre hanno continuita' pluriennale invece di ricominciare ogni stagione.

### Caratteristiche Principali

- **Leghe Dinastiche**: I giocatori acquistati restano nella tua rosa finche' il contratto e' attivo
- **Sistema Contratti**: Ogni giocatore ha un contratto con durata, ingaggio e clausola rescissoria
- **Aste Multiple**: Primo mercato, rubata e svincolati
- **Scambi**: Possibilita' di scambiare giocatori e budget con altri manager
- **Profezie**: Lascia commenti memorabili sui tuoi acquisti e cessioni

---

## Primi Passi

### Registrazione

1. Vai alla pagina di registrazione
2. Inserisci:
   - **Email**: La tua email (verra' verificata)
   - **Username**: Il tuo nome utente univoco
   - **Password**: Minimo 8 caratteri
3. Clicca su "Registrati"
4. Verifica la tua email (opzionale ma consigliato)

### Login

1. Vai alla pagina di login
2. Inserisci email e password
3. Clicca su "Accedi"

---

## Dashboard

La dashboard e' la tua home page dopo il login. Da qui puoi:

### Visualizzare le Tue Leghe

- Vedi tutte le leghe a cui sei iscritto
- Controlla lo stato di ogni lega (Bozza, Attiva, Archiviata)
- Accedi rapidamente a ciascuna lega

### Creare una Nuova Lega

1. Clicca su "Crea una Lega"
2. Compila i dettagli:
   - **Nome**: Nome della lega
   - **Descrizione**: Descrizione opzionale
   - **Partecipanti**: Min 6, Max 20 (consigliato numero pari)
   - **Budget Iniziale**: Default 500 crediti
   - **Slot Rosa**: Configura quanti portieri, difensori, centrocampisti e attaccanti

### Entrare in una Lega Esistente

1. Clicca su "Partecipa a una Lega"
2. Inserisci il **Codice Invito** fornito dall'admin
3. Attendi l'approvazione dell'admin (se non sei stato invitato direttamente)

---

## Gestione Leghe

### Stati della Lega

| Stato | Descrizione |
|-------|-------------|
| **DRAFT** | Lega in preparazione. I manager possono unirsi, nessun mercato attivo |
| **ACTIVE** | Lega attiva con mercato in corso |
| **ARCHIVED** | Lega archiviata, solo consultazione |

### Dettaglio Lega

Dalla pagina della lega puoi vedere:

- **Panoramica**: Nome, stato, configurazione
- **Partecipanti**: Lista dei manager con budget e rose
- **Sessione Mercato**: Fase corrente del mercato
- **Statistiche**: Dati aggregati della lega

---

## Il Mercato

Il mercato in Fantacontratti si divide in piu' fasi. L'admin di lega controlla quando attivare ogni fase.

### Tipi di Mercato

#### Primo Mercato Assoluto
Il primo mercato quando la lega inizia. Include la fase **Asta Libera** dove si acquistano i giocatori iniziali.

#### Mercato Ricorrente
I mercati successivi (estivo/invernale). Non include l'Asta Libera ma tutte le altre fasi.

### Fasi del Mercato

| Fase | Disponibile | Descrizione |
|------|-------------|-------------|
| **ASTA_LIBERA** | Solo Primo Mercato | Asta per acquistare giocatori senza proprietario |
| **SCAMBI_OFFERTE_1** | Tutti | Prima finestra per proporre scambi |
| **CONTRATTI** | Tutti | Gestione rinnovi e svincoli |
| **RUBATA** | Tutti | Fase per "rubare" giocatori ad altri manager |
| **SVINCOLATI** | Tutti | Aste per giocatori senza contratto |
| **SCAMBI_OFFERTE_2** | Tutti | Seconda finestra per scambi |

### Come Funziona l'Asta Libera

1. L'admin imposta l'ordine dei turni
2. A turno, ogni manager **nomina** un giocatore
3. Si attende che tutti i partecipanti siano "pronti" (ready check)
4. Parte l'asta con timer (default 30 secondi)
5. Tutti possono fare offerte; ogni offerta resetta il timer
6. Quando il timer scade, il miglior offerente vince
7. Si procede al turno successivo

---

## Rose e Contratti

### Visualizzare la Rosa

Dalla sezione **Rosa** puoi vedere tutti i tuoi giocatori divisi per ruolo:
- **P** - Portieri (default: 3 slot)
- **D** - Difensori (default: 8 slot)
- **C** - Centrocampisti (default: 8 slot)
- **A** - Attaccanti (default: 6 slot)

Per ogni giocatore vedi:
- Nome e squadra di Serie A
- Quotazione attuale
- Prezzo di acquisto
- Dettagli contratto

### Il Sistema Contratti

Ogni giocatore acquisito ha un contratto con:

| Parametro | Descrizione |
|-----------|-------------|
| **Ingaggio** | Costo per semestre (scalato dal budget) |
| **Durata** | Da 1 a 4 semestri |
| **Clausola Rescissoria** | Prezzo minimo per la Rubata (ingaggio x moltiplicatore) |

### Gestione Contratti

Durante la fase **CONTRATTI** puoi:

#### Rinnovare un Contratto
- Aumenta la durata (max 4 semestri totali)
- Puoi modificare l'ingaggio entro certi limiti
- Il rinnovo costa budget

#### Svincolare un Giocatore
- Liberi il giocatore (torna tra gli svincolati)
- Recuperi parte del budget
- Perdi il giocatore definitivamente

---

## Scambi

### Proporre uno Scambio

1. Vai alla sezione **Scambi**
2. Seleziona il manager con cui vuoi trattare
3. Configura l'offerta:
   - **Giocatori Offerti**: Seleziona dalla tua rosa
   - **Budget Offerto**: Crediti che dai
   - **Giocatori Richiesti**: Seleziona dalla rosa avversaria
   - **Budget Richiesto**: Crediti che chiedi
4. Aggiungi un messaggio (opzionale)
5. Invia l'offerta

### Rispondere a un'Offerta

Quando ricevi un'offerta puoi:

| Azione | Descrizione |
|--------|-------------|
| **Accetta** | Lo scambio viene eseguito immediatamente |
| **Rifiuta** | L'offerta viene chiusa |
| **Controproposta** | Invii una nuova offerta modificata |

### Regole degli Scambi

- Gli scambi sono possibili solo durante le fasi **SCAMBI_OFFERTE_1** e **SCAMBI_OFFERTE_2**
- Un giocatore scambiato non puo' tornare al precedente proprietario nella stessa sessione
- Il budget scambiato deve essere disponibile

---

## Rubata

La **Rubata** e' una fase speciale dove puoi tentare di "rubare" giocatori ad altri manager.

### Come Funziona

1. L'admin imposta l'ordine di rubata
2. A turno, ogni manager puo':
   - **Mettere sul piatto** un giocatore di un altro manager
   - **Saltare** il proprio turno
3. Quando un giocatore viene messo sul piatto, parte un'asta
4. Il prezzo base e': **Clausola Rescissoria + Ingaggio**
5. Tutti possono fare offerte (incluso il proprietario attuale)
6. Il vincitore acquisisce il giocatore

### Prezzo Base Rubata

```
Prezzo Base = Clausola Rescissoria + Ingaggio Semestrale
```

Esempio:
- Clausola: 50 crediti
- Ingaggio: 10 crediti/semestre
- **Prezzo Base**: 60 crediti

### Difendersi dalla Rubata

Se qualcuno mette sul piatto un tuo giocatore, puoi:
1. **Rilanciare**: Offri di piu' per tenerti il giocatore
2. **Lasciar andare**: Non fai offerte e perdi il giocatore

---

## Svincolati

La fase **Svincolati** permette di acquistare giocatori senza contratto.

### Pool Svincolati

Contiene tutti i giocatori di Serie A che:
- Non sono stati acquistati nel primo mercato
- Sono stati svincolati da un manager
- Sono stati ceduti in rubata senza essere ricomprati

### Filtri di Ricerca

Puoi filtrare per:
- **Ruolo**: P, D, C, A
- **Squadra**: Una specifica squadra di Serie A
- **Nome**: Ricerca testuale

### Come Acquistare uno Svincolato

1. L'admin avvia l'asta per un giocatore
2. Il prezzo base e' la **quotazione** del giocatore
3. Tutti i manager possono fare offerte
4. L'admin chiude l'asta quando il tempo e' scaduto
5. Il miglior offerente vince

---

## Storico Movimenti e Profezie

### Storico Movimenti

La sezione **Movimenti** mostra la cronologia completa di tutte le transazioni:

| Tipo | Descrizione |
|------|-------------|
| **FIRST_MARKET** | Acquisto al primo mercato |
| **TRADE** | Scambio tra manager |
| **RUBATA** | Giocatore rubato |
| **SVINCOLATI** | Acquisto da svincolati |
| **RELEASE** | Svincolo volontario |
| **CONTRACT_RENEW** | Rinnovo contratto |

### Profezie

Le **Profezie** sono commenti che puoi lasciare sui movimenti che ti coinvolgono.

#### Chi puo' fare una profezia?

- **Acquirente**: Chi ha comprato/acquisito il giocatore
- **Venditore/Cedente**: Chi ha perso il giocatore

#### Come aggiungere una profezia

1. Vai allo storico movimenti
2. Trova il movimento che ti coinvolge
3. Clicca su "Aggiungi Profezia"
4. Scrivi il tuo commento (max 500 caratteri)
5. Pubblica

Le profezie sono visibili a tutti i membri della lega e restano permanenti!

---

## Pannello Admin di Lega

Se sei l'admin della lega (il creatore), hai accesso a funzionalita' speciali.

### Tab Panoramica

- Statistiche della lega
- Configurazione attuale
- Avvio della lega (da DRAFT ad ACTIVE)

### Tab Membri

- Visualizza tutti i membri
- **Accetta/Rifiuta** richieste di adesione
- **Espelli** membri (tranne te stesso)

### Tab Inviti

- Invia inviti via email
- Visualizza inviti pendenti
- Annulla inviti

### Tab Sessioni

- **Crea** nuove sessioni di mercato
- **Imposta la fase** corrente
- **Chiudi** sessioni

### Tab Export

- Esporta lista membri in CSV
- Esporta tutte le rose in CSV

### Gestire le Fasi del Mercato

1. Vai al pannello admin
2. Nella sezione "Sessione Corrente", clicca sulla fase desiderata
3. La fase viene attivata immediatamente
4. I manager possono ora operare in quella fase

---

## Pannello Super Admin

Il **Super Admin** gestisce l'intera piattaforma (non una singola lega).

### Chi e' il Super Admin?

Un utente con il flag `isSuperAdmin = true` nel database. Solitamente il proprietario/gestore della piattaforma.

### Funzionalita'

#### Tab Upload

- Carica file Excel con le quotazioni Fantacalcio
- Visualizza statistiche giocatori (totale, per ruolo, attivi/non attivi)
- Storico dei caricamenti
- Cancella tutti i giocatori (reset)

#### Tab Giocatori

- Visualizza tutti i giocatori di Serie A
- Filtra per ruolo, squadra, stato
- Cerca per nome

#### Tab Leghe

- Visualizza tutte le leghe della piattaforma
- Espandi per vedere i membri
- Visualizza le rose di ogni manager

#### Tab Utenti

- Lista tutti gli utenti registrati
- Visualizza stato (verificato/non verificato)
- Identifica altri super admin

### Caricare le Quotazioni

1. Scarica il file Excel ufficiale delle quotazioni
2. Vai al pannello Super Admin > Upload
3. Specifica il nome del foglio (es. "Tutti")
4. Seleziona il file .xlsx
5. Clicca "Importa Quotazioni"

Il sistema:
- Crea nuovi giocatori se non esistono
- Aggiorna quotazioni dei giocatori esistenti
- Marca come "Non in Lista" i giocatori non presenti nel file

---

## Glossario

| Termine | Definizione |
|---------|-------------|
| **Budget** | I crediti virtuali per acquistare giocatori |
| **Clausola** | Prezzo minimo per rubare un giocatore (clausola rescissoria) |
| **Dinastica** | Tipo di lega dove le rose si mantengono tra le stagioni |
| **Ingaggio** | Costo semestrale di un contratto |
| **Manager** | Un partecipante alla lega |
| **Nominare** | Proporre un giocatore per l'asta |
| **Profezia** | Commento lasciato su un movimento |
| **Quotazione** | Valore ufficiale del giocatore (da file Excel) |
| **Ready Check** | Conferma di tutti i manager prima di un'asta |
| **Rosa** | L'insieme dei giocatori di un manager |
| **Rubata** | Fase per acquisire giocatori di altri manager |
| **Semestre** | Unita' di tempo per i contratti (6 mesi) |
| **Sessione** | Un periodo di mercato con le sue fasi |
| **Svincolato** | Giocatore senza contratto con nessun manager |

---

## Supporto

Per problemi o suggerimenti:
- Contatta l'admin della tua lega per questioni specifiche
- Contatta il super admin per problemi tecnici della piattaforma

---

*Fantacontratti - La tua lega dinastica*
