# FANTACONTRATTI
## Dynasty Fantasy Football Platform

---

# IL PROBLEMA

## Il fantacalcio tradizionale e' diventato noioso

### Ogni anno si ricomincia da zero
- Aste annuali senza continuita
- Nessun valore strategico a lungo termine
- Giocatori intercambiabili, nessun legame emotivo

### Engagement limitato alla giornata di campionato
- Partecipazione attiva solo 38 giorni/anno
- Zero interazioni tra manager durante la settimana
- Nessuna strategia di mercato significativa

### Mercato statico e prevedibile
- Asta iniziale e poi il nulla
- Scambi rari e poco interessanti
- Nessun meccanismo per bilanciare la competitivita

---

# LA SOLUZIONE

## FANTACONTRATTI - Dynasty Fantasy Football

**La prima piattaforma italiana di fantacalcio dinastico con sistema di contratti realistici**

### Continuita Pluriennale
Le rose si mantengono di anno in anno. I tuoi giocatori crescono con te.

### Sistema Contratti
Ingaggi, durate, clausole rescissorie. Gestisci la tua squadra come un vero DS.

### Mercato Dinamico Tutto l'Anno
Cinque fasi di mercato che tengono vivo l'engagement 365 giorni.

---

# PROPOSTA DI VALORE UNICA

## Cosa ci rende diversi

| Feature | Fantacalcio Tradizionale | FANTACONTRATTI |
|---------|--------------------------|----------------|
| Continuita | Reset annuale | Rose pluriennali |
| Contratti | Non esistono | Ingaggio, durata, clausole |
| Mercato | 1 asta/anno | 5 fasi dinamiche |
| Scambi | Liberi, caotici | Regolamentati con vincoli |
| Riequilibrio | Nessuno | Sistema RUBATA |
| Engagement | 38 giorni/anno | 365 giorni/anno |
| Strategia | A breve termine | Pianificazione pluriennale |

---

# COME FUNZIONA

## Il Ciclo di Mercato in 4 Step

### 1. ASTA INIZIALE
Il primo anno: costruisci la tua rosa con un budget iniziale.
- Asta libera real-time
- Timer configurabili
- WebSocket per sincronizzazione istantanea

### 2. FASE CONTRATTI
Imposta i contratti per i tuoi giocatori.
- **Ingaggio**: quanto costa il giocatore per semestre
- **Durata**: da 1 a 4 semestri
- **Clausola Rescissoria**: calcolata automaticamente (Ingaggio x Moltiplicatore)
- **SPALMAINGAGGI**: riduci l'ingaggio allungando la durata

### 3. SCAMBI E OFFERTE
Negozia con gli altri manager.
- Offerte multi-giocatore + budget
- Controproposte
- Vincolo anti-scambi a ritroso (stesso giocatore non puo' tornare indietro)
- Timer di scadenza offerte

### 4. RUBATA
Il meccanismo rivoluzionario per il bilanciamento competitivo.
- Ordine di turno deciso dal presidente
- Ogni squadra "mette sul piatto" i propri giocatori
- Le altre squadre possono "rubare" pagando clausola + ingaggio
- **Impossibile rifiutare**: se qualcuno paga, il giocatore parte

### + SVINCOLATI
Acquista giocatori liberi (non in nessuna rosa).
- Pool aggiornato con nuovi acquisti Serie A
- Asta libera con prezzo base = quotazione

---

# FEATURE UNICHE

## Meccaniche Innovative

### Sistema RUBATA
Il primo sistema di "free agency forzata" nel fantasy italiano.
- Riequilibria le leghe sbilanciate
- Punisce chi tesaurizza troppi campioni
- Genera dinamiche di mercato imprevedibili

### Profezie
I manager possono lasciare "profezie" sui giocatori acquistati.
- Commenti ironici o seri
- Storico delle dichiarazioni
- Engagement sociale tra manager

### Storico Completo
Ogni movimento e' tracciato e consultabile.
- Career view per giocatore
- Timeline per sessione
- Statistiche aggregate

### Strategie Rubata
Pianifica in anticipo le tue mosse.
- Imposta bid massimi per giocatore
- Priorita' di acquisto
- Note strategiche private

---

# MERCATO TARGET

## Dimensioni e Segmenti

### TAM (Total Addressable Market)
**8 milioni** di italiani giocano a fantacalcio ogni anno
- Fonte: ricerche di mercato settore fantasy sports Italia

### SAM (Serviceable Addressable Market)
**2 milioni** di "fantacalcisti hardcore"
- Giocano tutto l'anno
- Partecipano a piu' leghe
- Disposti a pagare per feature premium

### SOM (Serviceable Obtainable Market)
**100.000** utenti nei primi 3 anni
- Early adopters interessati a meccaniche innovative
- Leghe storiche stufe del formato tradizionale
- Community fantasy football online

### Segmenti Target

| Segmento | Descrizione | Priorita' |
|----------|-------------|-----------|
| Leghe Storiche | Gruppi di amici che giocano da 5+ anni | Alta |
| Hardcore Gamers | Utenti su forum/Discord fantasy | Alta |
| Content Creators | Youtuber/Twitch fantasy football | Media |
| Casual Upgraders | Giocatori stanchi del formato base | Media |

---

# MODELLO DI BUSINESS

## Revenue Streams

### Freemium Model

**FREE TIER**
- 1 lega attiva
- Max 8 partecipanti
- Funzionalita base complete
- Pubblicita' discreta

**PREMIUM (4.99/mese o 29.99/anno)**
- Leghe illimitate
- Max 16 partecipanti
- Statistiche avanzate
- Storico completo
- Esportazione dati
- Zero pubblicita'
- Badge esclusivi
- Accesso anticipato nuove feature

**LEAGUE PREMIUM (9.99/anno per lega)**
- Customizzazione regolamento
- Analytics avanzati
- Backup automatici
- Supporto prioritario

### Proiezioni Revenue

| Anno | Utenti Attivi | % Premium | Revenue Annuo |
|------|---------------|-----------|---------------|
| Y1 | 10.000 | 5% | 15.000 |
| Y2 | 50.000 | 8% | 120.000 |
| Y3 | 100.000 | 12% | 360.000 |

---

# TRACTION E ROADMAP

## Cosa abbiamo fatto

### MVP Completato (Sprint 0-8)
- Sistema auth completo (JWT, refresh token)
- Gestione leghe multi-utente
- Database giocatori Serie A
- Sistema aste real-time (WebSocket)
- Gestione contratti completa
- Sistema scambi
- Meccanismo RUBATA
- Fase Svincolati
- Dashboard admin
- Storico completo
- Sistema Profezie

### Stack Tecnologico
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Render)
- **Real-time**: Socket.io
- **Hosting**: Vercel + Render
- **Test Coverage**: Target 95%

## Roadmap

### Q1 2026 - Launch
- [ ] Beta pubblica
- [ ] Onboarding guidato
- [ ] Mobile PWA ottimizzata

### Q2 2026 - Growth
- [ ] App nativa iOS/Android
- [ ] Sistema notifiche push
- [ ] Integrazione dati live partite
- [ ] Statistiche avanzate giocatori

### Q3 2026 - Expansion
- [ ] Liga spagnola
- [ ] Premier League
- [ ] Sistema tornei inter-lega
- [ ] Marketplace badge/skin

### Q4 2026 - Monetization
- [ ] Premium features complete
- [ ] Partnership content creators
- [ ] API pubblica per terze parti

---

# TEAM

## Founders

### [Nome Founder 1]
**CEO & Product**
- [Background]
- [Esperienza rilevante]
- [LinkedIn]

### [Nome Founder 2]
**CTO**
- [Background tecnico]
- [Esperienza sviluppo]
- [GitHub]

### [Nome Founder 3]
**CMO**
- [Background marketing]
- [Esperienza growth]
- [LinkedIn]

## Advisors

### [Nome Advisor]
- [Ruolo/Expertise]
- [Aziende precedenti]

---

# METRICHE CHIAVE

## KPIs Placeholder

| Metrica | Attuale | Target Y1 |
|---------|---------|-----------|
| Utenti Registrati | [N] | 10.000 |
| MAU (Monthly Active Users) | [N] | 5.000 |
| Leghe Create | [N] | 1.500 |
| Retention D30 | [N]% | 60% |
| Conversion Free->Premium | [N]% | 5% |
| NPS | [N] | 50+ |

---

# THE ASK

## Cosa cerchiamo

### Round Pre-Seed: 150.000

**Utilizzo dei Fondi**

| Area | Allocazione | % |
|------|-------------|---|
| Sviluppo Prodotto | 75.000 | 50% |
| Marketing & Growth | 45.000 | 30% |
| Operazioni | 22.500 | 15% |
| Buffer | 7.500 | 5% |

**Milestones con questi fondi**
- [ ] 10.000 utenti attivi
- [ ] App mobile nativa
- [ ] 500 leghe premium
- [ ] Break-even operativo

### Cosa offriamo
- Equity: [X]%
- Board seat: No (Advisory solo)
- Reporting: Mensile

---

# CONTATTI

## Let's Talk

**FANTACONTRATTI**

Email: [email@fantacontratti.com]
Website: [fantacontratti.com]
LinkedIn: [linkedin.com/company/fantacontratti]

---

*Deck Version 1.0 - Gennaio 2026*
*Confidenziale - Solo per potenziali investitori*
