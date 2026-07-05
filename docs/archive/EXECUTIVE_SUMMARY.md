# Executive Summary - FANTACONTRATTI

## Cos'e FANTACONTRATTI

FANTACONTRATTI e una piattaforma web innovativa per la gestione di leghe di fantacalcio in formato **dynasty** (o dinastico). A differenza del fantacalcio tradizionale, dove le rose vengono completamente azzerate ogni stagione, FANTACONTRATTI introduce un sistema di **contratti pluriennali** che permette ai giocatori di mantenere i propri calciatori nel tempo, creando un'esperienza di gioco piu strategica e coinvolgente.

La piattaforma offre un'esperienza completa e real-time per gestire aste, contratti, scambi e mercati di riparazione, tutto accessibile via browser senza necessita di installare applicazioni.

---

## Problema Risolto e Proposta di Valore

### Il Problema

Le leghe di fantacalcio tradizionali soffrono di diversi limiti:

- **Azzeramento annuale**: Ogni stagione si ricomincia da zero, vanificando le strategie a lungo termine
- **Gestione manuale**: Molte leghe usano fogli Excel condivisi, con rischi di errori e conflitti
- **Mancanza di sincronia**: Le aste vengono gestite via WhatsApp o chiamate, con difficolta di coordinamento
- **Regolamenti complessi**: Le regole dynasty sono difficili da tracciare manualmente

### La Soluzione

FANTACONTRATTI risolve questi problemi offrendo:

- **Contratti strutturati**: Sistema automatizzato di ingaggi, clausole rescissorie e rinnovi
- **Aste real-time**: Sincronizzazione istantanea tra tutti i partecipanti via WebSocket
- **Fasi di mercato guidate**: Workflow chiaro per ogni fase (rubata, svincolati, scambi)
- **Trasparenza totale**: Storico completo di tutte le transazioni e movimenti
- **Zero carta**: Tutto digitalizzato e accessibile ovunque

---

## Target di Mercato

### Utenti Primari

- **Gruppi di amici** che giocano a fantacalcio insieme da anni e cercano una modalita piu avanzata
- **Leghe esistenti** che vogliono passare al formato dynasty senza gestione manuale
- **Appassionati di fantasy sports** abituati ai formati americani (NFL, NBA dynasty)

### Caratteristiche Demografiche

- Eta: 25-45 anni
- Profilo: Appassionati di calcio e tecnologia
- Utilizzo: Prevalentemente mobile-first (accesso da smartphone)
- Dimensione lega tipica: 6-12 partecipanti

### Mercato Potenziale (Italia)

- ~6 milioni di giocatori di fantacalcio in Italia
- Trend crescente verso formati piu complessi e coinvolgenti
- Gap di mercato: poche piattaforme dynasty native in italiano

---

## Funzionalita Chiave

### Gestione Lega
- Creazione lega con parametri personalizzabili
- Sistema di inviti via email o codice
- Approvazione membri
- Dashboard amministrativa completa

### Sistema Aste Real-Time
- Nomination a turni
- Timer configurabile
- Offerte sincronizzate in tempo reale
- Sistema ricorsi integrato

### Contratti Dynasty
- Durata 1-4 semestri
- Clausola rescissoria automatica
- Rinnovi con vincoli realistici
- Decadenza naturale

### Fase Rubata
- Tabellone automatico ordinato per clausola
- Aste lampo per "rubare" giocatori avversari
- Strategie e watchlist personali

### Scambi tra Manager
- Proposte multi-asset (giocatori + budget)
- Controproposte
- Scadenza automatica
- Storico completo

### Premi e Riconoscimenti
- Re-incremento budget stagionale
- Categorie premio personalizzabili
- Indennizzo automatico per partenze

---

## Stack Tecnologico (High-Level)

| Componente | Tecnologia |
|------------|------------|
| **Frontend** | React 19 + Tailwind CSS |
| **Backend** | Node.js + Express |
| **Database** | PostgreSQL (cloud-hosted) |
| **Real-time** | Pusher (WebSocket) |
| **Hosting** | Vercel (edge deployment) |
| **Email** | Gmail / Resend API |

### Caratteristiche Architetturali
- **Single Page Application** per esperienza fluida
- **API REST** per tutte le operazioni
- **WebSocket** per aggiornamenti in tempo reale
- **Serverless functions** per scalabilita automatica
- **Database managed** per zero manutenzione

---

## Metriche e KPI Potenziali

### Metriche di Utilizzo
| Metrica | Descrizione |
|---------|-------------|
| **MAU** | Monthly Active Users |
| **Leghe attive** | Leghe con almeno 1 sessione negli ultimi 30 giorni |
| **Aste/settimana** | Volume di aste concluse |
| **Tempo medio sessione** | Engagement per visita |

### Metriche di Crescita
| Metrica | Descrizione |
|---------|-------------|
| **Tasso di retention** | % leghe che completano 2+ stagioni |
| **Viral coefficient** | Nuovi utenti per lega esistente |
| **NPS** | Net Promoter Score |

### Metriche Tecniche
| Metrica | Descrizione |
|---------|-------------|
| **Latenza aste** | Tempo medio risposta WebSocket |
| **Uptime** | Disponibilita piattaforma |
| **Error rate** | Percentuale richieste fallite |

---

## Roadmap Potenziale

### Fase 1 - MVP (Completata)
- Sistema aste completo
- Gestione contratti
- Rubata e svincolati
- Scambi base

### Fase 2 - Engagement
- App mobile nativa (iOS/Android)
- Notifiche push
- Statistiche avanzate
- Integrazione calendari

### Fase 3 - Monetizzazione
- Piano premium per leghe
- Funzionalita extra (AI assistant, analytics)
- White-label per organizzazioni

### Fase 4 - Espansione
- Altri campionati europei
- Altri sport (basket, football americano)
- Marketplace giocatori tra leghe

---

## Punti di Forza Competitivi

1. **Focus Dynasty**: Unica piattaforma italiana nativa per formato dynasty
2. **Real-time**: Esperienza aste sincronizzata e coinvolgente
3. **Semplicita**: Interfaccia intuitiva nonostante la complessita delle regole
4. **Trasparenza**: Storico completo e tracciabilita di ogni operazione
5. **Flessibilita**: Parametri lega altamente configurabili
6. **Scalabilita**: Architettura cloud-native pronta per la crescita

---

## Contatti e Link

| Risorsa | Link |
|---------|------|
| **Repository** | github.com/pietro1412/FANTACONTRATTI-MULTIAGENT |
| **Demo** | fantacontratti.vercel.app |
| **Documentazione Tecnica** | docs/TECHNICAL.md |
| **Documentazione Funzionale** | docs/FUNCTIONAL.md |
