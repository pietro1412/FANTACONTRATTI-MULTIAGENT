# Guida Utente FANTACONTRATTI

## Introduzione

FANTACONTRATTI e' una piattaforma di fantacalcio dinastico con sistema di contratti realistici. Questa guida copre tutte le funzionalita' disponibili per ogni ruolo utente.

---

## Ruoli Utente

La piattaforma prevede tre ruoli principali:

| Ruolo | Descrizione | Livello |
|-------|-------------|---------|
| **Super Admin** | Amministratore della piattaforma | Piattaforma |
| **Presidente (Admin)** | Amministratore di una lega | Lega |
| **Direttore Generale (Manager)** | Partecipante a una lega | Squadra |

---

# SUPER ADMIN

Il Super Admin gestisce la piattaforma a livello globale. Non partecipa alle leghe come manager.

## Accesso

Dopo il login, il Super Admin viene reindirizzato automaticamente alla dashboard `/superadmin`.

## Dashboard Super Admin

La dashboard presenta 4 tab principali:

### 1. Upload Quotazioni

Gestione del database giocatori tramite upload di file Excel.

**Funzionalita':**
- Carica file XLSX con le quotazioni ufficiali
- Supporto per diversi formati di fogli
- Creazione automatica di nuovi giocatori
- Aggiornamento quotazioni esistenti
- Report dettagliato: creati, aggiornati, errori
- Storico degli upload precedenti

**Come fare:**
1. Clicca su "Upload Quotazioni"
2. Seleziona il file XLSX
3. Conferma l'upload
4. Verifica il report dei risultati

### 2. Giocatori

Gestione del database giocatori della piattaforma.

**Funzionalita':**
- Visualizza tutti i giocatori per ruolo (P, D, C, A)
- Filtra per stato lista (IN_LIST, NOT_IN_LIST)
- Statistiche per ruolo e stato
- Elimina tutti i giocatori (solo per test/reset)

**Statistiche disponibili:**
- Numero totale giocatori
- Distribuzione per ruolo
- Giocatori in lista vs fuori lista

### 3. Leghe

Panoramica di tutte le leghe della piattaforma.

**Informazioni visualizzate:**
- Nome lega e stato
- Numero partecipanti
- Stagione corrente
- Sessione di mercato attiva
- Elenco membri per lega

### 4. Utenti

Gestione degli utenti registrati.

**Funzionalita':**
- Elenco completo utenti
- Username, email, stato verifica
- Conteggio leghe per utente
- Promuovi/revoca status Super Admin
- Visualizza membership per utente

**Come promuovere un Super Admin:**
1. Trova l'utente nella lista
2. Clicca sull'icona di promozione
3. Conferma l'operazione

---

# PRESIDENTE (ADMIN DI LEGA)

Il Presidente gestisce una lega specifica con pieni poteri amministrativi.

## Creazione Lega

**Passo 1: Dati Base**
- Nome della lega
- Descrizione (opzionale)

**Passo 2: Configurazione Partecipanti**
- Numero minimo partecipanti
- Numero massimo partecipanti
- Vincolo numero pari (opzionale)

**Passo 3: Budget e Rose**
- Budget iniziale per manager
- Slot portieri (GK)
- Slot difensori (DEF)
- Slot centrocampisti (MID)
- Slot attaccanti (FWD)

**Dopo la creazione:**
- Diventi automaticamente Presidente
- La lega e' in stato "in preparazione"
- Puoi iniziare a invitare membri

## Dashboard Lega

### Panoramica
- Stato della lega e sessione corrente
- Elenco membri con budget
- Fase di mercato attiva
- Pulsanti azione rapida

### Menu Amministrazione

Il menu Admin presenta le seguenti sezioni:

#### Mercato
Controllo completo delle fasi di mercato.

**Sessioni disponibili:**
- **Primo Mercato**: Prima sessione con asta libera
- **Mercato Ricorrente**: Sessioni successive (Rubata + Svincolati)

**Fasi di una sessione:**
1. PRIMO_MERCATO - Asta iniziale
2. CONTRATTI - Rinnovo contratti
3. SCAMBI - Trattative tra manager
4. RUBATA - Asta forzata
5. ASTA_SVINCOLATI - Acquisto giocatori liberi
6. PREMI - Assegnazione bonus budget

**Azioni disponibili:**
- Crea nuova sessione di mercato
- Imposta ordine turni (Primo Mercato)
- Imposta ordine rubata
- Imposta ordine svincolati
- Avanza/retrocedi fase
- Reset Primo Mercato

#### Membri
Gestione dei partecipanti alla lega.

**Funzionalita':**
- Visualizza tutti i membri
- Approva richieste pendenti
- Sospendi membri attivi
- Visualizza rosa di ogni manager
- Monitora budget disponibili

**Stati membro:**
- PENDING: In attesa di approvazione
- ACTIVE: Membro attivo
- SUSPENDED: Membro sospeso
- LEFT: Ha abbandonato

#### Premi
Assegnazione bonus budget ai manager.

**Durante la fase PREMI:**
1. Imposta il re-incremento base
2. Crea categorie premio personalizzate
3. Assegna premi per categoria
4. Visualizza premi di sistema (es. partenze estero)
5. Finalizza la fase premi

**Esempi categorie:**
- Miglior portiere
- Capocannoniere
- Fair play
- Miglior difesa

#### Ricorsi
Gestione delle contestazioni durante le aste.

**Flusso ricorso:**
1. Manager contesta un'asta
2. Ricorso appare nel pannello
3. Rivedi storico offerte
4. Accetta o rifiuta con motivazione
5. Se accettato, asta viene annullata

#### Inviti
Gestione degli inviti alla lega.

**Funzionalita':**
- Invia nuovi inviti via email
- Configura scadenza invito
- Reinvia inviti pendenti
- Cancella inviti non utilizzati
- Visualizza storico inviti

**Come invitare:**
1. Clicca "Nuovo Invito"
2. Inserisci email destinatario
3. Imposta giorni di validita'
4. Invia l'invito

#### Sessioni
Storico delle sessioni di mercato.

**Informazioni per sessione:**
- Data inizio/fine
- Tipo sessione
- Fasi completate
- Statistiche movimenti

#### Export
Esportazione dati della lega.

**Dati esportabili:**
- Rose complete di tutti i manager
- Contratti con dettagli
- Storico movimenti
- Budget e statistiche

#### Audit Log
Registro di tutte le azioni nella lega.

**Informazioni tracciate:**
- Timestamp
- Utente che ha eseguito l'azione
- Tipo di azione
- Entita' modificata
- Valori precedenti e nuovi
- Indirizzo IP

## Gestione Fasi di Mercato

### Avvio Primo Mercato

1. Vai su Admin > Mercato
2. Clicca "Crea Sessione Primo Mercato"
3. Imposta l'ordine turni dei manager
4. Configura timer asta (secondi per offerta)
5. Avvia la sessione

### Avvio Mercato Ricorrente

1. Vai su Admin > Mercato
2. Clicca "Crea Sessione Mercato Ricorrente"
3. La sessione parte dalla fase CONTRATTI
4. Gestisci manualmente il passaggio tra fasi

### Passaggio tra Fasi

- Usa i pulsanti "Avanza Fase" / "Fase Precedente"
- Alcune fasi richiedono che tutti i manager abbiano completato le azioni
- Verifica lo stato di completamento nel pannello

---

# DIRETTORE GENERALE (MANAGER)

Il Manager partecipa attivamente alla lega gestendo la propria squadra.

## Dashboard Personale

### Panoramica
- Nome squadra e lega
- Budget disponibile
- Fase di mercato corrente
- Azioni disponibili nella fase

### Navigazione Rapida
- Rosa: visualizza i tuoi giocatori
- Contratti: gestisci i rinnovi
- Scambi: proponi o ricevi offerte
- Storico: movimenti della lega

## Rosa (Roster)

### Visualizzazione Rosa
- Elenco giocatori ordinati per ruolo
- Dettagli contratto per ogni giocatore
- Quotazione attuale
- Squadra reale di appartenenza

### Dettagli Contratto
Per ogni giocatore:
- **Ingaggio**: costo per semestre
- **Durata**: semestri rimanenti
- **Clausola Rescissoria**: prezzo per la rubata

### Slot Disponibili
Monitora gli slot per ruolo:
- Portieri: X/Y utilizzati
- Difensori: X/Y utilizzati
- Centrocampisti: X/Y utilizzati
- Attaccanti: X/Y utilizzati

## Sistema Aste

### Primo Mercato

Il Primo Mercato e' l'asta iniziale per costruire la rosa.

**Come funziona:**
1. A turno, ogni manager nomina un giocatore
2. Parte l'asta con timer
3. Tutti possono rilanciare
4. Il timer si resetta ad ogni rilancio
5. Quando scade, il miglior offerente vince
6. Il giocatore viene aggiunto alla rosa

**Durante l'asta:**
- Visualizza il giocatore in asta
- Vedi l'offerta corrente e chi l'ha fatta
- Clicca per rilanciare
- Il budget disponibile si aggiorna in tempo reale

**Profezie:**
Puoi lasciare una "profezia" sul giocatore:
- Commento ironico o serio
- Visibile a tutti dopo l'asta
- Crea engagement nella lega

### Fase Rubata

La Rubata e' il meccanismo di riequilibrio competitivo.

**Come funziona:**
1. Ogni manager "espone" i propri giocatori
2. Gli altri possono "rubarli" pagando clausola + ingaggio
3. Se qualcuno paga, il giocatore cambia squadra
4. Impossibile rifiutare!

**Tabellone Rubata:**
- Vedi tutti i giocatori esposti
- Ordinati per clausola rescissoria
- Stato: disponibile, in asta, acquisito

**Strategie Rubata:**
Puoi impostare preferenze per ogni giocatore:
- **Watchlist**: giocatori da monitorare
- **Auto-Pass**: salta automaticamente
- **Max Bid**: offerta massima automatica
- **Priorita'**: ordine di preferenza
- **Note private**: appunti strategici

### Asta Svincolati

Acquisto di giocatori senza contratto (free agent).

**Come funziona:**
1. A turno, nomini un giocatore svincolato
2. Parte l'asta libera
3. Vince il miglior offerente
4. Il prezzo base e' la quotazione del giocatore

**Azioni disponibili:**
- Nomina un giocatore
- Rilancia durante l'asta
- Dichiara "Auto-Pass" per saltare
- Dichiara "Finito" quando soddisfatto

## Gestione Contratti

### Fase Contratti

Durante questa fase puoi rinnovare i contratti dei tuoi giocatori.

**Per ogni giocatore puoi:**
- Modificare l'ingaggio (entro limiti)
- Modificare la durata (1-4 semestri)
- Segnare per lo svincolo (taglio)

**Regole di rinnovo:**
- Aumenti/diminuzioni massime per parametro
- Budget sufficiente richiesto
- Clausola ricalcolata automaticamente

**Come rinnovare:**
1. Vai su Contratti
2. Seleziona un giocatore
3. Imposta nuovo ingaggio e durata
4. Verifica l'anteprima costi
5. Conferma le modifiche
6. Quando hai finito, clicca "Consolida"

### Svincolo Giocatori

Per liberare un giocatore:
1. Nella fase contratti, seleziona "Svincola"
2. Il giocatore tornera' nel pool svincolati
3. Non riceverai compenso

## Scambi tra Manager

### Proporre uno Scambio

1. Vai su Scambi > Nuova Offerta
2. Seleziona il manager destinatario
3. Scegli i giocatori da offrire
4. Scegli i giocatori da richiedere
5. Aggiungi/richiedi budget (opzionale)
6. Scrivi un messaggio (opzionale)
7. Imposta la scadenza
8. Invia l'offerta

### Ricevere un'Offerta

Quando ricevi un'offerta:
1. Visualizza i dettagli completi
2. Verifica giocatori e budget
3. Scegli un'azione:
   - **Accetta**: lo scambio viene eseguito
   - **Rifiuta**: l'offerta viene chiusa
   - **Controproposta**: modifica i termini

### Controproposta

1. Clicca "Controproposta"
2. Modifica giocatori offerti/richiesti
3. Modifica budget
4. Aggiungi messaggio
5. Invia la controproposta

### Storico Scambi

Visualizza:
- Offerte inviate (stato e risposta)
- Offerte ricevute
- Scambi completati
- Offerte scadute/annullate

## Fase Premi

Durante la fase PREMI ricevi:
- **Re-incremento base**: bonus per tutti
- **Premi categoria**: assegnati dal Presidente
- **Premi di sistema**: es. compenso partenze estero

Visualizza lo storico premi delle stagioni precedenti.

## Storico e Movimenti

### Movimenti

Registro di tutte le transazioni della lega:
- Acquisti Primo Mercato
- Movimenti Rubata
- Acquisti Svincolati
- Scambi tra manager
- Svincoli
- Rinnovi contratto

**Dettagli movimento:**
- Data e ora
- Tipo operazione
- Giocatore coinvolto
- Manager coinvolti
- Prezzo/valore
- Dettagli contratto

### Sessioni

Naviga tra le diverse sessioni di mercato:
- Filtra per sessione
- Vedi movimenti per fase
- Statistiche aggregate

### Profezie

Archivio delle profezie lasciate:
- Filtra per giocatore o autore
- Visualizzazione compatta o dettagliata
- Statistiche predizioni

## Chat e Comunicazione

### Chat Asta

Durante le aste attive:
- Messaggi in tempo reale
- Notifiche di sistema
- Annunci nominazioni
- Aggiornamenti offerte

### Notifiche

Ricevi notifiche per:
- Nuove offerte di scambio
- Risposte alle tue offerte
- Cambi di fase
- Aste che ti riguardano

---

# Funzionalita' Comuni

## Profilo Utente

### Gestione Account
- Modifica username
- Cambia email (richiede verifica)
- Aggiorna password

### Impostazioni Lega
Per ogni lega a cui partecipi:
- Nome squadra personalizzato
- Visualizza budget attuale
- Stato partecipazione

## Visualizzazione Rose

Tutti i ruoli possono:
- Vedere le rose di tutti i manager
- Visualizzare i contratti
- Consultare i budget disponibili

## Navigazione

### Menu Principale
- Dashboard
- Rose (tutte le squadre)
- Contratti
- Scambi
- Storico
- Admin (solo Presidente)

### Indicatori di Stato
- Fase corrente evidenziata
- Badge notifiche
- Stato connessione real-time

---

# Appendice

## Glossario

| Termine | Significato |
|---------|-------------|
| **Ingaggio** | Costo del giocatore per semestre |
| **Clausola Rescissoria** | Prezzo per "rubare" un giocatore |
| **Rubata** | Fase di aste forzate |
| **Svincolato** | Giocatore senza contratto |
| **Consolidamento** | Conferma definitiva dei contratti |
| **Profezia** | Commento/previsione su un'acquisizione |

## Fasi di Mercato in Ordine

1. **PRIMO_MERCATO** - Asta iniziale (solo prima sessione)
2. **CONTRATTI** - Rinnovo contratti esistenti
3. **SCAMBI** - Trattative tra manager
4. **RUBATA** - Aste forzate con clausola
5. **ASTA_SVINCOLATI** - Acquisto free agent
6. **PREMI** - Assegnazione bonus budget

## Calcolo Clausola Rescissoria

```
Clausola = Ingaggio x Moltiplicatore
```

Il moltiplicatore dipende dalla durata del contratto:
- 1 semestre: moltiplicatore basso
- 4 semestri: moltiplicatore alto

## Limiti di Sistema

- Durata contratto: 1-4 semestri
- Partecipanti lega: configurabile (tipico 6-12)
- Slot rosa: configurabili per ruolo
- Timer asta: configurabile dal Presidente

---

*Guida Utente v1.0 - Gennaio 2026*
*FANTACONTRATTI - Dynasty Fantasy Football Platform*
